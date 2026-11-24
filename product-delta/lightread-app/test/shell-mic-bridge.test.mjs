import assert from 'node:assert/strict'
import test from 'node:test'

import nativeAudio from '../common/realtime/nativeAudio.js'
import PcmRecorder from '../common/realtime/pcmRecorder.js'
import { SHELL_ECHO_RELEASE_MS, shellEchoHoldUntil } from '../common/realtime/shell-echo-gate.js'

const originalWindow = globalThis.window
const commands = []

function installShell() {
  commands.length = 0
  globalThis.window = {
    webkit: {
      messageHandlers: {
        mindyMic: { postMessage: command => commands.push(command) }
      }
    }
  }
}

test.afterEach(() => {
  if (originalWindow === undefined) delete globalThis.window
  else globalThis.window = originalWindow
})

test('the shell bridge speaks the commands the phone app accepts', async () => {
  installShell()
  const frames = []
  const status = await nativeAudio.startRecording(buffer => frames.push(buffer))
  assert.equal(status.implementation, 'ShellMic')
  assert.equal(status.aecEnabled, false)
  assert.deepEqual(commands, ['start'])

  const samples = new Int16Array([1000, -1000])
  const bytes = new Uint8Array(samples.buffer)
  let encoded = ''
  for (const byte of bytes) encoded += String.fromCharCode(byte)
  window.__mindyPushMic(btoa(encoded))
  assert.equal(frames.length, 1)
  assert.equal(new Int16Array(frames[0])[0], 1000)

  nativeAudio.playPcm(samples.buffer)
  assert.equal(commands.at(-1).startsWith('play:'), true)
  assert.equal(nativeAudio.setPlaybackPaused(true), true)
  assert.equal(commands.at(-1), 'play-pause')
  assert.equal(nativeAudio.setPlaybackPaused(false), true)
  assert.equal(commands.at(-1), 'play-resume')
  nativeAudio.suppressPlayback()
  assert.equal(commands.at(-1), 'play-stop')
  nativeAudio.stopRecording()
  assert.equal(commands.at(-1), 'stop')
  assert.equal(window.__mindyPushMic, null)
})

test('a late first shell frame gets one more start instead of failing immediately', () => {
  installShell()
  assert.equal(nativeAudio.recoverRecording(), true)
  assert.deepEqual(commands, ['start'])
})

test('shell playback holds the microphone through a tail and other recorders are untouched', () => {
  const playing = shellEchoHoldUntil('ShellMic', true, 1000)
  assert.equal(playing, 1000 + SHELL_ECHO_RELEASE_MS)
  assert.equal(shellEchoHoldUntil('ShellMic', false, 1500, playing), playing)
  assert.equal(shellEchoHoldUntil('ShellMic', false, 1500, 0), 0)
  assert.equal(shellEchoHoldUntil('WebMediaAudio', true, 1000), 0)
  assert.equal(shellEchoHoldUntil('VoiceProcessingIO', true, 1000, 5000), 0)
})

test('pushed shell audio reaches the recorder as 100ms frames', async () => {
  installShell()
  const forwarded = []
  const recorder = new PcmRecorder(nativeAudio, {
    captureTimeoutMs: 50,
    setTimeout: () => 1,
    clearTimeout: () => {}
  })
  await recorder.start(frame => forwarded.push(frame))
  const samples = new Int16Array(1600)
  samples.fill(7)
  const bytes = new Uint8Array(samples.buffer)
  let encoded = ''
  for (const byte of bytes) encoded += String.fromCharCode(byte)
  window.__mindyPushMic(btoa(encoded))
  assert.equal(forwarded.length, 1)
  assert.equal(forwarded[0].byteLength, 3200)
  recorder.stop()
})
