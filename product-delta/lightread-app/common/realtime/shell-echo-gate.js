/** The USB shell has no echo canceller and keeps its own speaker queue after
 * the page thinks playback ended. Its microphone stays on the phone until this
 * tail has passed. Other recorders are not affected. */
export const SHELL_ECHO_RELEASE_MS = 1200

export function shellEchoHoldUntil(audioImplementation, aiAudioOpen, now, previous = 0) {
  if (audioImplementation !== 'ShellMic') return 0
  return aiAudioOpen === true ? now + SHELL_ECHO_RELEASE_MS : previous
}
