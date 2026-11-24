import { REALTIME_AUDIO } from './config.js'

let nativePlugin = null
let webInputContext = null
let webOutputContext = null
let webStream = null
let webSource = null
let webProcessor = null
let nextSourceTime = 0
let webPlaybackPaused = false
const webPlayingSources = new Set()

// DEBUG: 累积收到的音频数据用于导出 WAV 排查格式问题
let debugAudioChunks = []
let debugDumped = false

// #ifdef APP-PLUS
try {
  nativePlugin = uni.requireNativePlugin('RealtimeAudio')
} catch (error) {
  console.warn('[Realtime] RealtimeAudio 原生插件未安装', error)
}
// #endif

function toArrayBuffer(value) {
  if (value instanceof ArrayBuffer) return value
  if (ArrayBuffer.isView(value)) return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength)
  // uni-app 原生插件桥：Java byte[] 可能以 base64 字符串到达
  if (typeof value === 'string') {
    try {
      if (typeof uni !== 'undefined' && typeof uni.base64ToArrayBuffer === 'function') {
        return uni.base64ToArrayBuffer(value)
      }
      const binary = atob(value)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      return bytes.buffer
    } catch (e) { return null }
  }
  if (value && typeof value === 'object' && value.data) return toArrayBuffer(value.data)
  return null
}

function requirePlugin() {
  if (!hasNativeRecorder() || !hasNativePlayer()) {
    throw new Error('实时 PCM 原生音频插件未安装，请使用 HBuilderX 原生基座或云打包后测试')
  }
  return nativePlugin
}

function hasNativeRecorder() {
  return !!(nativePlugin && typeof nativePlugin.startRecord === 'function')
}

function hasNativePlayer() {
  return !!(nativePlugin && typeof nativePlugin.playPCM === 'function')
}

function encodePcmBase64(buffer) {
  const bytes = new Uint8Array(buffer)
  const chunks = []
  const chunkSize = 0x8000
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    chunks.push(String.fromCharCode.apply(null, bytes.subarray(offset, offset + chunkSize)))
  }
  return btoa(chunks.join(''))
}

function floatToPcm16(input, sourceSampleRate) {
  const targetRate = REALTIME_AUDIO.input.sampleRate
  if (sourceSampleRate === targetRate) {
    const output = new Int16Array(input.length)
    for (let index = 0; index < input.length; index += 1) {
      output[index] = Math.max(-1, Math.min(1, input[index])) * 0x7fff
    }
    return output.buffer
  }
  const ratio = sourceSampleRate / targetRate
  const output = new Int16Array(Math.floor(input.length / ratio))
  for (let index = 0; index < output.length; index += 1) {
    const sourceIndex = Math.floor(index * ratio)
    output[index] = Math.max(-1, Math.min(1, input[sourceIndex])) * 0x7fff
  }
  return output.buffer
}

function hexPreview(buffer, maxBytes) {
  const bytes = new Uint8Array(buffer)
  const len = Math.min(bytes.length, maxBytes || 32)
  const parts = []
  for (let i = 0; i < len; i++) {
    parts.push(bytes[i].toString(16).padStart(2, '0'))
  }
  return parts.join(' ')
}

function shellMicAvailable() {
  return typeof window !== 'undefined'
    && window.webkit
    && window.webkit.messageHandlers
    && window.webkit.messageHandlers.mindyMic
}

function postShell(command) {
  if (shellMicAvailable()) window.webkit.messageHandlers.mindyMic.postMessage(command)
}

function startShellMic(onPcmData) {
  window.__mindyPushMic = encoded => {
    if (!encoded) return
    const binary = atob(encoded)
    const bytes = new Uint8Array(binary.length)
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
    onPcmData(bytes.buffer)
  }
  postShell('start')
  return {
    implementation: 'ShellMic',
    aecAvailable: false,
    aecEnabled: false,
    noiseSuppressorEnabled: false
  }
}

function stopShellMic() {
  window.__mindyPushMic = null
  postShell('stop')
}

async function startWebRecording(onPcmData) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error('当前浏览器不支持实时麦克风采集')
  }
  webStream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true }
  })
  const AudioContextConstructor = window.AudioContext || window.webkitAudioContext
  if (!AudioContextConstructor) throw new Error('当前浏览器不支持 PCM 音频')
  webInputContext = new AudioContextConstructor()
  await webInputContext.resume()
  webSource = webInputContext.createMediaStreamSource(webStream)
  webProcessor = webInputContext.createScriptProcessor(4096, 1, 1)
  webProcessor.onaudioprocess = event => {
    const pcm = floatToPcm16(event.inputBuffer.getChannelData(0), webInputContext.sampleRate)
    onPcmData(pcm)
  }
  webSource.connect(webProcessor)
  webProcessor.connect(webInputContext.destination)
  const settings = webStream.getAudioTracks()[0]?.getSettings?.() || {}
  return {
    implementation: 'WebMediaAudio',
    aecAvailable: true,
    aecEnabled: settings.echoCancellation !== false,
    noiseSuppressorEnabled: settings.noiseSuppression !== false
  }
}

function stopWebRecording() {
  if (webProcessor) webProcessor.disconnect()
  if (webSource) webSource.disconnect()
  if (webStream) webStream.getTracks().forEach(track => track.stop())
  if (webInputContext) webInputContext.close()
  webProcessor = null
  webSource = null
  webStream = null
  webInputContext = null
}

function playWebPcm(buffer) {
  if (!(buffer instanceof ArrayBuffer) || buffer.byteLength === 0) return

  // DEBUG: 累积音频数据
  debugAudioChunks.push(buffer.slice(0))

  const AudioContextConstructor = window.AudioContext || window.webkitAudioContext
  if (!AudioContextConstructor) throw new Error('当前浏览器不支持 PCM 音频')
  if (!webOutputContext) {
    webOutputContext = new AudioContextConstructor()
    nextSourceTime = webOutputContext.currentTime
  }

  const samples = new Int16Array(buffer)
  const sampleRate = REALTIME_AUDIO.output.sampleRate
  const duration = samples.length / sampleRate

  const audioBuffer = webOutputContext.createBuffer(1, samples.length, sampleRate)
  const channel = audioBuffer.getChannelData(0)
  for (let index = 0; index < samples.length; index += 1) {
    channel[index] = samples[index] / 0x8000
  }

  const source = webOutputContext.createBufferSource()
  source.buffer = audioBuffer
  source.connect(webOutputContext.destination)

  // 调度播放：按时间顺序排列，避免重叠和间隙
  const startTime = Math.max(nextSourceTime, webOutputContext.currentTime)
  source.start(startTime)
  nextSourceTime = startTime + duration

  source.onended = () => webPlayingSources.delete(source)
  webPlayingSources.add(source)
  if (!webPlaybackPaused) webOutputContext.resume()
}

// DEBUG: 导出为 WAV 文件下载
function downloadDebugWav() {
  if (debugAudioChunks.length === 0) {
    console.warn('[Realtime] 没有收到任何音频数据，无法导出')
    return
  }
  // 拼接所有收到的 PCM 帧
  const totalLength = debugAudioChunks.reduce((sum, chunk) => sum + chunk.byteLength, 0)
  const merged = new Uint8Array(totalLength)
  let offset = 0
  debugAudioChunks.forEach(chunk => {
    merged.set(new Uint8Array(chunk), offset)
    offset += chunk.byteLength
  })

  const sampleRate = REALTIME_AUDIO.output.sampleRate
  const numChannels = 1
  const bitsPerSample = 16
  const dataLength = merged.length
  const headerLength = 44
  const wav = new ArrayBuffer(headerLength + dataLength)
  const view = new DataView(wav)

  function writeStr(off, str) {
    for (let i = 0; i < str.length; i++) view.setUint8(off + i, str.charCodeAt(i))
  }

  writeStr(0, 'RIFF')
  view.setUint32(4, 36 + dataLength, true)
  writeStr(8, 'WAVE')
  writeStr(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * numChannels * bitsPerSample / 8, true)
  view.setUint16(32, numChannels * bitsPerSample / 8, true)
  view.setUint16(34, bitsPerSample, true)
  writeStr(36, 'data')
  view.setUint32(40, dataLength, true)
  new Uint8Array(wav, headerLength).set(merged)

  const blob = new Blob([wav], { type: 'audio/wav' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'realtime_debug_' + Date.now() + '.wav'
  a.click()
  URL.revokeObjectURL(url)
  console.log('[Realtime] WAV 已导出，总帧数:', debugAudioChunks.length, '总字节:', dataLength, '时长约:', (dataLength / (sampleRate * 2)).toFixed(1) + 's')
  debugDumped = true
}

export default {
  createVoiceSession(sessionGeneration) {
    const base = this
    const generation = Number.isFinite(Number(sessionGeneration)) ? Number(sessionGeneration) : 0
    return {
      startRecording: (onPcmData, onBargeIn, onAudioEvent) =>
        base.startRecording(onPcmData, onBargeIn, onAudioEvent, generation),
      stopRecording: () => base.stopRecording(generation),
      recoverRecording: () => base.recoverRecording(generation),
      beginPlayback: playbackGeneration => base.beginPlayback(playbackGeneration, generation),
      playPcm: (buffer, playbackGeneration) => base.playPcm(buffer, playbackGeneration, generation),
      suppressPlayback: playbackGeneration => base.suppressPlayback(playbackGeneration, generation),
      stopPlayback: () => base.stopPlayback(generation),
      setPlaybackPaused: paused => base.setPlaybackPaused(paused, generation),
      setBargeInDetection: (enabled, playbackGeneration) =>
        base.setBargeInDetection(enabled, playbackGeneration, generation),
      stopVoiceSession: () => base.stopVoiceSession(generation)
    }
  },

  startVoiceSession(onServiceEvent) {
    if (!nativePlugin || typeof nativePlugin.startVoiceSession !== 'function') {
      return Promise.resolve(null)
    }
    return new Promise((resolve, reject) => {
      let startupSettled = false
      nativePlugin.startVoiceSession({}, event => {
        if (event && event.error) {
          if (!startupSettled) {
            startupSettled = true
            reject(new Error(event.error))
          } else if (typeof onServiceEvent === 'function') onServiceEvent(event)
          return
        }
        if (event && event.status === 'started') {
          if (!startupSettled) {
            startupSettled = true
            resolve(event)
          }
          return
        }
        if (typeof onServiceEvent === 'function') onServiceEvent(event || {})
      })
    })
  },

  stopVoiceSession(sessionGeneration = 0) {
    if (nativePlugin && typeof nativePlugin.stopVoiceSession === 'function') {
      nativePlugin.stopVoiceSession({ sessionGeneration })
    }
  },

  async startRecording(onPcmData, onBargeIn, onAudioEvent, sessionGeneration = 0) {
    if (shellMicAvailable()) return startShellMic(onPcmData)
    if (hasNativeRecorder()) {
      return new Promise((resolve, reject) => {
        let startupSettled = false
        nativePlugin.startRecord({
          sampleRate: REALTIME_AUDIO.input.sampleRate,
          channels: REALTIME_AUDIO.input.channels,
          bitDepth: REALTIME_AUDIO.input.bitDepth,
          frameBytes: REALTIME_AUDIO.input.frameBytes,
          sessionGeneration
        }, event => {
          if (event && event.error) {
            // The recorder callback can carry playback events while microphone permission is pending.
            const playbackLimit = event.type === 'audio_error' && (event.code === 'PCM_PLAYBACK_BUFFER_FULL'
              || (!event.code && String(event.error).startsWith('PCM_PLAYBACK_BUFFER_FULL:')))
            if (!startupSettled && !playbackLimit) {
              console.error('[Realtime] 原生音频启动失败:', event.error)
              startupSettled = true
              reject(new Error(event.error))
            } else if (typeof onAudioEvent === 'function') {
              onAudioEvent({ ...event, type: event.type || 'audio_error' })
            }
            return
          }
          if (event && event.status === 'ready') {
            console.info('[Realtime] 原生音频已启动:', event.implementation || 'unknown')
            if (!startupSettled) {
              startupSettled = true
              resolve(event)
            }
            return
          }
          if (event && event.type === 'barge_in') {
            if (typeof onBargeIn === 'function') onBargeIn(event)
            return
          }
          if (event && event.type && event.type !== 'data') {
            if (typeof onAudioEvent === 'function') onAudioEvent(event)
            return
          }
          const buffer = toArrayBuffer(event && (event.data || event))
          if (buffer) onPcmData(buffer)
        })
      })
    }
    if (typeof window !== 'undefined') return startWebRecording(onPcmData)
    requirePlugin()
  },

  stopRecording(sessionGeneration = 0) {
    if (shellMicAvailable()) { stopShellMic(); return }
    if (hasNativeRecorder() && typeof nativePlugin.stopRecordForSession === 'function') {
      nativePlugin.stopRecordForSession({ sessionGeneration })
    } else if (hasNativeRecorder() && nativePlugin.stopRecord) nativePlugin.stopRecord()
    else if (typeof window !== 'undefined') stopWebRecording()
  },

  recoverRecording(sessionGeneration = 0) {
    if (shellMicAvailable()) {
      postShell('start')
      return true
    }
    if (hasNativeRecorder() && typeof nativePlugin.recoverAudioForSession === 'function') {
      nativePlugin.recoverAudioForSession({ sessionGeneration })
      return true
    }
    if (hasNativeRecorder() && typeof nativePlugin.recoverAudio === 'function') {
      nativePlugin.recoverAudio()
      return true
    }
    return false
  },

  setPlaybackPaused(paused, sessionGeneration = 0) {
    if (shellMicAvailable()) {
      postShell(paused ? 'play-pause' : 'play-resume')
      return true
    }
    if (hasNativePlayer()) {
      if (typeof nativePlugin.setPlaybackPaused !== 'function') throw new Error('当前原生音频插件不支持暂停播放，请更新安装包')
      nativePlugin.setPlaybackPaused({ paused: !!paused, sessionGeneration })
      return true
    }
    if (typeof window === 'undefined') throw new Error('当前环境不支持暂停播放')
    if (webOutputContext) {
      const outputContext = webOutputContext
      const change = paused ? outputContext.suspend() : outputContext.resume()
      return Promise.resolve(change).then(() => {
        if (outputContext !== webOutputContext) return false
        webPlaybackPaused = !!paused
        return true
      })
    }
    webPlaybackPaused = !!paused
    return true
  },

  beginPlayback(generation, sessionGeneration = 0) {
    if (hasNativePlayer() && typeof nativePlugin.beginPlayback === 'function') {
      nativePlugin.beginPlayback({ generation, sessionGeneration })
    }
  },

  playPcm(buffer, generation, sessionGeneration = 0) {
    if (!(buffer instanceof ArrayBuffer)) return
    if (shellMicAvailable()) {
      postShell('play:' + encodePcmBase64(buffer))
      return
    }
    if (hasNativePlayer()) {
      // 将 ArrayBuffer 转为 base64 字符串。
      // uni-app 原生桥无法直接将 JS ArrayBuffer 自动转为 Java byte[]，
      // 必须像录音上行一样使用 base64 编码，Java 侧再 Base64.decode 还原。
      nativePlugin.playPCM({
        data: encodePcmBase64(buffer),
        sampleRate: REALTIME_AUDIO.output.sampleRate,
        channels: REALTIME_AUDIO.output.channels,
        bitDepth: REALTIME_AUDIO.output.bitDepth,
        generation,
        sessionGeneration
      })
      return
    }
    if (typeof window !== 'undefined') return playWebPcm(buffer)
    requirePlugin()
  },

  suppressPlayback(generation, sessionGeneration = 0) {
    if (shellMicAvailable()) postShell('play-stop')
    if (hasNativePlayer() && typeof nativePlugin.suppressPlayback === 'function') {
      nativePlugin.suppressPlayback({ generation, sessionGeneration })
    } else if (hasNativePlayer() && nativePlugin.stopPlay) nativePlugin.stopPlay()
    else {
      webPlayingSources.forEach(source => { try { source.stop() } catch (e) { /* ignore */ } })
      webPlayingSources.clear()
    }
    nextSourceTime = 0
  },

  stopPlayback(sessionGeneration = 0) {
    if (shellMicAvailable()) postShell('play-stop')
    if (hasNativePlayer() && typeof nativePlugin.stopPlayForSession === 'function') {
      nativePlugin.stopPlayForSession({ sessionGeneration })
    } else if (hasNativePlayer() && nativePlugin.stopPlay) nativePlugin.stopPlay()
    else {
      webPlayingSources.forEach(source => { try { source.stop() } catch (e) { /* ignore */ } })
      webPlayingSources.clear()
    }
    nextSourceTime = 0
  },

  setBargeInDetection(enabled, generation, sessionGeneration = 0) {
    if (hasNativeRecorder() && typeof nativePlugin.setBargeInDetection === 'function') {
      nativePlugin.setBargeInDetection({ enabled: !!enabled, generation, sessionGeneration })
    }
  },

  // DEBUG: 暴露给控制台
  _dumpWav() {
    downloadDebugWav()
  },

  _resetDebug() {
    debugAudioChunks = []
    debugDumped = false
    console.log('[Realtime] debug 缓存已重置')
  },

  _debugInfo() {
    const totalBytes = debugAudioChunks.reduce((sum, c) => sum + c.byteLength, 0)
    console.log('[Realtime] debug 状态:', {
      frameCount: debugAudioChunks.length,
      totalBytes,
      sampleRate: REALTIME_AUDIO.output.sampleRate,
      estimatedDuration: (totalBytes / (REALTIME_AUDIO.output.sampleRate * 2)).toFixed(1) + 's'
    })
    // 打印前三帧的 hex 预览
    debugAudioChunks.slice(0, 3).forEach((chunk, i) => {
      console.log('[Realtime] 帧#' + (i + 1) + ' size=' + chunk.byteLength + ' hex:', hexPreview(chunk, 32))
    })
  }
}
