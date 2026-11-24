import assert from 'node:assert/strict'
import test from 'node:test'

import { describeListenRecording, localListenStandInUrl } from '../common/listen-recording.js'
import { resolveListenArticle } from '../common/listen-variants.js'

const originalWindow = globalThis.window
const devStandIn = { DEV: true }
const flaggedStandIn = { DEV: false, VITE_LOCAL_LISTEN_STANDIN: 'true' }

function usePage(host) {
  globalThis.window = {
    location: {
      hostname: host.split(':')[0],
      host,
      origin: `http://${host}`
    }
  }
}

test.afterEach(() => {
  if (originalWindow === undefined) delete globalThis.window
  else globalThis.window = originalWindow
})

test('a USB page rewrites an unreachable audio address to the matching sample', () => {
  usePage('169.254.73.88:18174')
  assert.equal(
    localListenStandInUrl('https://seaweedfs:8333/en.wav', 'en-US', devStandIn),
    'http://169.254.73.88:18174/static/local-listen/en.wav'
  )
  assert.equal(
    describeListenRecording({ status: 'SUCCEEDED', audioUrl: 'https://seaweedfs:8333/zh.wav', locale: 'zh-CN' }, '', devStandIn).url,
    'http://169.254.73.88:18174/static/local-listen/zh.wav'
  )
  assert.equal(
    localListenStandInUrl('https://seaweedfs:8333/old.wav', undefined, devStandIn),
    'http://169.254.73.88:18174/static/local-listen/zh.wav'
  )
})

test('an unlabelled ready article on the USB page plays the Chinese sample', () => {
  usePage('169.254.73.88:18174')
  const resolved = resolveListenArticle({
    id: 9,
    summary: '旧简读',
    content: '旧正文',
    listenAudio: { status: 'READY', sourceMode: 'LEGACY', audioUrl: 'http://127.0.0.1:8333/old.wav' }
  }, '', devStandIn)
  assert.equal(resolved.recording.url, 'http://169.254.73.88:18174/static/local-listen/zh.wav')
  assert.equal(resolved.recording.ready, true)
})

test('a same-page address stays, and other hosts are not rewritten', () => {
  usePage('169.254.73.88:18174')
  const same = 'http://169.254.73.88:18174/static/local-listen/en.wav'
  assert.equal(localListenStandInUrl(same, 'en-US', devStandIn), same)
  assert.equal(
    localListenStandInUrl('http://169.254.73.88:8333/audio.wav', 'en-US', devStandIn),
    'http://169.254.73.88:18174/static/local-listen/en.wav'
  )
  usePage('192.168.1.8:18174')
  assert.equal(localListenStandInUrl('https://seaweedfs:8333/en.wav', 'en-US', devStandIn), 'https://seaweedfs:8333/en.wav')
  usePage('api.lightread.news')
  assert.equal(describeListenRecording({
    status: 'SUCCEEDED', audioUrl: 'https://cdn.example/audio.wav', locale: 'en-US'
  }).url, 'https://cdn.example/audio.wav')
})

test('the local HTTPS entry can use the English sample when the article has no signed URL', () => {
  usePage('wendydemacbook-air.local:8443')
  globalThis.window.location.origin = 'https://wendydemacbook-air.local:8443'
  assert.equal(
    localListenStandInUrl('', 'en-US', devStandIn),
    'https://wendydemacbook-air.local:8443/static/local-listen/en.wav'
  )
  const resolved = resolveListenArticle({
    id: 1,
    contentLocale: 'en-US',
    listenAudio: { status: 'READY', locale: 'en-US', sourceMode: 'UNAVAILABLE', audioUrl: null, durationMs: 8000 }
  }, '', devStandIn)
  assert.equal(resolved.recording.url, 'https://wendydemacbook-air.local:8443/static/local-listen/en.wav')
  assert.equal(resolved.recording.ready, true)
})

test('a production build does not substitute the local sample', () => {
  usePage('169.254.73.88:18174')
  const remote = 'https://seaweedfs:8333/en.wav'
  assert.equal(localListenStandInUrl(remote, 'en-US', { DEV: false }), remote)
  assert.equal(localListenStandInUrl(remote, 'en-US'), remote)
  usePage('wendydemacbook-air.local:8443')
  globalThis.window.location.origin = 'https://wendydemacbook-air.local:8443'
  assert.equal(localListenStandInUrl('', 'en-US', { DEV: false }), '')
  assert.equal(
    localListenStandInUrl('', 'en-US', flaggedStandIn),
    'https://wendydemacbook-air.local:8443/static/local-listen/en.wav'
  )
})
