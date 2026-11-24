import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('production app traffic uses the HTTPS API domain instead of a bare IP', async () => {
  const api = await readFile(new URL('../common/api.js', import.meta.url), 'utf8')
  const realtime = await readFile(new URL('../common/realtime/config.js', import.meta.url), 'utf8')

  assert.match(api, /DEFAULT_API_ORIGIN\s*=\s*'https:\/\/api\.lightread\.news'/)
  assert.doesNotMatch(api, /http:\/\/8\.139\.253\.111:8080/)
  assert.match(realtime, /wss:\/\/api\.lightread\.news\/ws\/realtime/)
})

test('local H5 traffic uses the Vite proxy on localhost and loopback IPs', async () => {
  const api = await readFile(new URL('../common/api.js', import.meta.url), 'utf8')
  const vite = await readFile(new URL('../vite.config.js', import.meta.url), 'utf8')

  assert.match(api, /localhost/)
  assert.match(api, /127\.0\.0\.1/)
  assert.match(api, /isLocalH5Host/)
  assert.match(vite, /\^\/\(api\|member\|vip\|ws\)/)
  assert.match(vite, /ws:\s*true/)
})

async function runAppOrigin(origin, windowValue, qa = false, initialStorage = {}) {
  const { default: vm } = await import('node:vm')
  const api = await readFile(new URL('../common/api.js', import.meta.url), 'utf8')
  // HBuilder's App-service bundle rewrites bare import.meta with its URL
  // descriptor. The service runtime has no document; env literals must not
  // require evaluation of this descriptor (observed in release build151).
  const env = origin ? { VITE_API_ORIGIN: origin } : {}
  if (qa) env.VITE_TESTFLIGHT_QA = 'true'
  const executable = api.slice(0, api.indexOf('export default {'))
    .replace(/^import[^\n]+\n/gm, '')
    .replaceAll('import.meta.env', JSON.stringify(env))
    .replaceAll('import.meta', '({url: new URL("app-service.js", document.baseURI).href})')
    .replace(/^export (const|(?:async )?function)/gm, '$1')
  const storage = new Map(Object.entries(initialStorage))
  const requests = []
  const sandbox = {
    storage, requests, window: windowValue, bindApiAuthInvalidator() {},
    accountQaTimeout: (_path, _configured, fallback) => fallback,
    withContentLocale: (_path, _method, data) => data,
    withUiLanguageHeader: header => header,
    isAndroidBasicMode: () => false,
    hasProcessingConsent: () => true,
    hasSavedIosLogin: () => false,
    uni: {
      getStorageSync: key => storage.get(key),
      setStorageSync: (key, value) => storage.set(key, value),
      removeStorageSync: key => storage.delete(key),
      request: ({ url, header, success }) => {
        requests.push({ url, authorization: header.Authorization })
        success({ statusCode: 200, data: { code: '0' } })
      }
    }
  }
  vm.runInNewContext(executable + '\nglobalThis.origin = API_ORIGIN; globalThis.base = BASE_URL; globalThis.TESTFLIGHT_QA_ORIGIN = TESTFLIGHT_QA_ORIGIN', sandbox)
  return sandbox
}

test('App service reads a configured LAN origin without a DOM', async () => {
  const result = await runAppOrigin('http://192.168.28.219:8080')
  assert.equal(result.origin, 'http://192.168.28.219:8080')
  assert.equal(result.base, result.origin)
})
test('App service with no test override keeps the production HTTPS origin', async () => {
  const result = await runAppOrigin()
  assert.equal(result.origin, 'https://api.lightread.news')
})
test('localhost H5 keeps relative HTTP proxy with an explicit realtime origin', async () => {
  const result = await runAppOrigin('http://192.168.28.219:8080', {location: {hostname: 'localhost'}})
  assert.equal(result.base, '')
  assert.equal(result.origin, 'http://192.168.28.219:8080')
})

test('TestFlight QA fails closed for missing, production, loopback, or non-origin API URLs', async () => {
  for (const origin of [undefined, 'https://api.lightread.news', 'https://lightread.news', 'https://127.0.0.1',
    'http://example.test', 'https://qa.localhost', 'https://qa.example.test/path', 'https://qa.example.test:65536']) {
    await assert.rejects(runAppOrigin(origin, undefined, true), /dedicated HTTPS API origin/)
  }
})

test('TestFlight QA pins live chat and HTTP to the same origin and bypasses saved WebRTC routing', async () => {
  const { default: vm } = await import('node:vm')
  const sandbox = await runAppOrigin('https://qa.example.test:8443', { location: { hostname: 'localhost' } }, true, {
    realtime_ws_url: 'wss://api.lightread.news/ws/realtime',
    realtime_webrtc_offer_url: 'https://api.lightread.news/webrtc/offer',
    realtime_webrtc_ice_servers: [{ urls: 'turn:example.test' }]
  })
  const readScript = async file => (await readFile(new URL(file, import.meta.url), 'utf8'))
    .replace(/^import .*$/gm, '').replaceAll('import.meta.env', '{ VITE_REALTIME_WS_URL: "wss://api.lightread.news/ws/realtime" }')
    .replace(/^export default /gm, '').replace(/^export /gm, '')
  vm.runInNewContext(await readScript('../common/realtime/config.js'), sandbox)
  vm.runInNewContext(await readScript('../common/realtime/androidWebRtcTransport.js'), sandbox)
  assert.equal(sandbox.base, 'https://qa.example.test:8443')
  assert.equal(sandbox.getRealtimeWsUrl(), 'wss://qa.example.test:8443/ws/realtime')
  assert.equal(sandbox.getOfferUrl(), 'https://qa.example.test:8443/webrtc/offer')
  assert.equal(sandbox.getIceServers().length, 0)
})

test('TestFlight QA only restores a session recorded on the same backend', async () => {
  const sandbox = await runAppOrigin('https://qa.example.test', undefined, true, {
    token: 'header.payload.production', refresh_token: 'header.payload.productionRefresh', locale: 'en-US'
  })
  sandbox.prepareTestflightQaSession()
  assert.equal(sandbox.storage.has('token'), false)
  assert.equal(sandbox.storage.has('refresh_token'), false)
  assert.equal(sandbox.storage.get('locale'), 'en-US')
  sandbox.storage.set('token', 'header.payload.qaAccess')
  sandbox.storage.set('refresh_token', 'header.payload.qaRefresh')
  sandbox.rememberTestflightQaSession()
  sandbox.prepareTestflightQaSession()
  assert.equal(sandbox.storage.get('token'), 'header.payload.qaAccess')
  sandbox.storage.set('refresh_token', 'header.payload.productionRefresh')
  sandbox.prepareTestflightQaSession()
  assert.equal(sandbox.storage.has('token'), false)
  assert.equal(sandbox.storage.has('refresh_token'), false)
})

const qaMarkerKey = 'mindy.testflight-qa-session'
const oldQaMarker = { origin: 'https://macbook-pro.local:18181', signatures: 'qaAccess.qaRefresh' }

test('upgrading build 238 clears the QA identity before initial store restore and first standard Engine request', async () => {
  const sandbox = await runAppOrigin(undefined, undefined, false, {
    [qaMarkerKey]: oldQaMarker,
    token: 'header.payload.qaAccess',
    accessToken: 'header.payload.qaAccess',
    refresh_token: 'header.payload.qaRefresh',
    isLogin: true,
    isMockLogin: false,
    user_profile: { id: 321 },
    userInfo: { id: 321 },
    membership_status: { isVip: true },
    TRACKER_MEMBER_ID: '321',
    user_likes: [1],
    user_favorites: [2],
    user_history: [3],
    locale: 'en-US'
  })
  const { default: vm } = await import('node:vm')
  const main = await readFile(new URL('../main.js', import.meta.url), 'utf8')
  const startup = main.slice(main.indexOf('export function createApp()'))
    .replace('export function createApp()', 'globalThis.createApp = function ()')
  let restored
  let first
  Object.assign(sandbox, {
    App: {}, TypographyProvider: {}, createPinia: () => ({}),
    createSSRApp: () => ({ use() {}, component() {} }), bindApiAuthStore() {},
    destroyAudioPlayer() {}, mayRestoreSavedSession: () => true,
    useUserStore: () => ({ initFromStorage() { restored = sandbox.storage.has('token') } }),
    setupRouteGuard() { first = sandbox.get('/member/me') }
  })
  vm.runInNewContext(startup, sandbox)
  sandbox.createApp()
  await first
  assert.equal(restored, false)
  assert.deepEqual([...sandbox.storage], [['locale', 'en-US']])
  assert.deepEqual(sandbox.requests, [{ url: 'https://api.lightread.news/member/me', authorization: undefined }])
})

test('standard startup clears any access alias or refresh token still marked as isolated QA', async () => {
  for (const retained of [
    { token: 'header.payload.qaAccess', refresh_token: 'header.payload.changed' },
    { token: 'header.payload.changed', refresh_token: 'header.payload.qaRefresh' },
    { accessToken: 'header.payload.qaAccess' }
  ]) {
    const sandbox = await runAppOrigin(undefined, undefined, false, { [qaMarkerKey]: oldQaMarker, ...retained })
    sandbox.prepareTestflightQaSession()
    assert.equal(sandbox.storage.size, 0)
  }
})

test('standard startup preserves ordinary credentials, including after an older build left a stale marker', async () => {
  const production = { token: 'header.payload.production', refresh_token: 'header.payload.productionRefresh', isLogin: true }
  for (const markers of [{}, { [qaMarkerKey]: oldQaMarker }]) {
    const sandbox = await runAppOrigin(undefined, undefined, false, { ...production, ...markers })
    sandbox.prepareTestflightQaSession()
    await sandbox.get('/member/me')
    assert.deepEqual(Object.fromEntries(sandbox.storage), production)
    assert.equal(sandbox.requests[0].authorization, 'Bearer header.payload.production')
  }
})
