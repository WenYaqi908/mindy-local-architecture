import test from 'node:test'
import assert from 'node:assert/strict'
import { loadVueOptions } from './helpers/guest-listening-harness.mjs'

function pcm(amplitude) {
  const buffer = new ArrayBuffer(4800)
  const view = new DataView(buffer)
  for (let offset = 0; offset < buffer.byteLength; offset += 2) view.setInt16(offset, Math.round(amplitude * 32767), true)
  return buffer
}

async function harness() {
  const component = await loadVueOptions('pages/voice/call.vue', { ArrayBuffer, DataView, Date: { now: () => 10000 } })
  const events = new Map()
  const state = {
    ended: false, destroyed: false, phase: 'AI_SPEAKING', openingGate: 'DONE',
    socket: { on(name, handler) { events.set(name, handler); return () => {} } }, unsubscribers: [],
    controlState: { voiceOutput: true, desiredOutput: true },
    activeAudioTurn: 1, activePlayedTurn: 1, currentTurnSeq: 1, activeResponseId: 'r1', playbackGeneration: 1,
    aiSpeakingStartTime: 9000, lastInterruptAt: 0, audioTurnStartAt: 9000, audioTurnTotalMs: 0,
    echoGateSpeechFrames: 0, iosBargeInWindow: [], iosBargeInPreroll: [],
    androidEchoCancellationActive: false, iosVoiceProcessingActive: true,
    player: { push() {}, begin() {}, remainingMs: () => 1000 },
    voiceStore: { setStatus() {} }, applyCompanionEvent() {}, _acceptTurnEvent: () => true,
    _eventTurnSeq: () => 1, _eventResponseId: () => 'r1', _logEvent() {},
    _clearResponseWatchdog() {}, _clearAudioDrainTimer() {},
  }
  state._resetBargeInWindow = component.methods._resetBargeInWindow.bind(state)
  state._isInEchoGuard = component.methods._isInEchoGuard.bind(state)
  state.detect = component.methods._detectTrustedBargeIn.bind(state)
  component.methods.bindSocketEvents.call(state)
  return { state, events, component }
}

test('incoming AI audio between consecutive microphone speech frames must not erase near-end evidence', async () => {
  const { state, events } = await harness()
  assert.equal(state.detect(pcm(0.1)), null)
  events.get('audio_delta')({ frame: pcm(0.2), turn_seq: 1, response_id: 'r1' })
  const decision = state.detect(pcm(0.1))
  assert.equal(decision?.matched_frames, 2)
  assert.equal(decision?.rms_hit_frames, 2)
})

test('silence and a new output generation still reset accumulated microphone evidence', async () => {
  const { state, events } = await harness()
  assert.equal(state.detect(pcm(0.1)), null)
  assert.equal(state.detect(pcm(0)), null)
  assert.equal(state.detect(pcm(0.1)), null)
  events.get('response_start')({ turn_seq: 1, response_id: 'r1' })
  assert.equal(state.echoGateSpeechFrames, 0)
  assert.equal(state.detect(pcm(0.1)), null)
})

test('startup echo guard and quiet microphone do not trigger a semantic interruption', async () => {
  const { state, events } = await harness()
  state.aiSpeakingStartTime = 9900
  assert.equal(state.detect(pcm(0.2)), null)
  state.aiSpeakingStartTime = 9000
  for (let i = 0; i < 10; i++) {
    events.get('audio_delta')({ frame: pcm(0.2), turn_seq: 1 })
    assert.equal(state.detect(pcm(0.01)), null)
  }
})

test('iOS input gate emits one interrupt with both preroll frames despite interleaved AI packets', async () => {
  const { state, events, component } = await harness()
  const sent = [], decisions = []
  Object.assign(state, {
    muted: false, lifecycleSuspended: false, audioRecovering: false, nativeEchoCancellationActive: true,
    openingBargeInOnly: false, interrupting: false,
    _isAiAudioOpen: () => true,
    _detectTrustedBargeIn: state.detect,
    interruptAiPlayback(source, diagnostic) { decisions.push({ source, diagnostic }); this.interrupting = true },
  })
  Object.assign(state.socket, { connected: true, uploadAllowed: true, sendAudioFrame: frame => sent.push(frame) })
  const forward = component.methods.shouldForwardRecorderFrame.bind(state)
  const first = pcm(0.1), second = pcm(0.1)
  assert.equal(forward(first), false)
  events.get('audio_delta')({ frame: pcm(0.2), turn_seq: 1 })
  assert.equal(forward(second), false)
  assert.equal(decisions.length, 1)
  assert.equal(decisions[0].source, 'local_vad')
  assert.equal(decisions[0].diagnostic.matched_frames, 2)
  assert.deepEqual(sent, [first, second])
  assert.equal(forward(pcm(0.1)), true)
  assert.equal(decisions.length, 1)
})

test('ShellMic keeps microphone frames off the socket while the speaker plays and for 1.2 seconds after', async () => {
  let now = 10000
  const component = await loadVueOptions('pages/voice/call.vue', { ArrayBuffer, DataView, Date: { now: () => now } })
  const sent = []
  const state = {
    ended: false, muted: false, lifecycleSuspended: false, audioRecovering: false,
    openingBargeInOnly: false, interrupting: false,
    audioImplementation: 'ShellMic', _shellEchoHoldUntil: 0, iosBargeInPreroll: [],
    socket: { connected: true, uploadAllowed: true, sendAudioFrame: frame => sent.push(frame) },
    _isAiAudioOpen: () => true,
    _resetBargeInWindow() { this.iosBargeInPreroll = [] },
  }
  const forward = component.methods.shouldForwardRecorderFrame.bind(state)
  const frame = pcm(0.2)
  assert.equal(forward(frame), false)
  assert.deepEqual(sent, [])
  state._isAiAudioOpen = () => false
  assert.equal(forward(frame), false)
  now = 11200
  assert.equal(forward(frame), true)

  for (const implementation of ['WebMediaAudio', 'VoiceProcessingIO']) {
    now = 10000
    state.audioImplementation = implementation
    state._shellEchoHoldUntil = 0
    state._isAiAudioOpen = () => false
    assert.equal(forward(frame), true)
    assert.equal(state._shellEchoHoldUntil, 0)
  }
  assert.deepEqual(sent, [])
})
