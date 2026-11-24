import { beginListenHandoff, listenHandoffNow, markListenHandoff, traceIosListenQa } from '../../common/listen-handoff-metrics.js'
import { readListenRoleSelection, localizeListenRoleOption } from '../../common/listen-role-preview.js'
import { formatAccountIdentifier } from '../../common/auth-methods.js'
import { t as translate } from '../../i18n/index.js'
import { isContentLanguageUnavailable } from '../../i18n/content.js'
import { formatFeedTitle } from '../../common/feed-title.js'
import { resolveListenArticle, projectListenArticle, listenSelectionParams, articleForListenSelection, listenArticleMatchesSelection } from '../../common/listen-variants.js'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'
import { createVoiceMode } from '../../common/voice-mode.js'
import { extractRecommendItems } from '../../common/recommend-response.js'
import { buildAuthLoginUrl } from '../../common/auth-navigation.js'
import { buildListenDetailUrl, getListenArticleId, LISTEN_ENTRY_URL } from '../../common/listen-navigation.js'
import { resolveCompanionListenReturnPlaying } from '../../common/companion-exit.js'

import { normalizeArticleIds, acceptArticleReceipt } from '../../common/companion-article-association.js'
import { shellEchoHoldUntil } from '../../common/realtime/shell-echo-gate.js'
import { messageStatusLabel } from '../../common/ai-history.js'
import { COMPANION_ROLE_OPTIONS } from '../../common/companion-roles.js'

export const noop = () => {}
export const success = data => ({ code: '0', data })

export async function loadVueOptions(path, globals = {}, { native = false } = {}) {
  const source = await readFile(new URL('../../' + path, import.meta.url), 'utf8')
  const rawScript = source.match(/<script>([\s\S]*?)<\/script>/)[1]
  const script = (native ? rawScript.replace(/\/\/ #ifdef H5[\s\S]*?\/\/ #endif/g, '') : rawScript)
    .replace(/^\s*import\s+[\s\S]*?\s+from\s+['"][^'"]+['"]\s*;?\s*$/gm, '')
    .replaceAll('import.meta.env', '({})')
    .replace('export default', 'globalThis.component =')
  const sandbox = {
    nextListenContinuation: async () => ({ fallback: true }),
    formatAccountIdentifier, localizeListenRoleOption, isContentLanguageUnavailable,
    t: (key, params) => translate(key, params, 'zh-CN'),
    getUiLocale: () => 'zh-CN',
    console: { log: noop, warn: noop, error: noop },
    getLocalVoiceCode: () => 'FEMALE_STANDARD',
    formatFeedTitle, setTimeout, clearTimeout, resolveListenArticle, projectListenArticle, listenSelectionParams, articleForListenSelection, listenArticleMatchesSelection,
    resolveCompanionListenReturnPlaying, normalizeArticleIds, acceptArticleReceipt, shellEchoHoldUntil,
    buildListenDetailUrl, getListenArticleId, LISTEN_ENTRY_URL,
    messageStatusLabel, COMPANION_ROLE_OPTIONS,
    getCompanionAudioRelease: () => null,
    clearCompanionAudioRelease: noop,
    trackCompanionAudioRelease: noop,
    beginListenHandoff, listenHandoffNow, markListenHandoff, traceIosListenQa,
    voiceMode: createVoiceMode(() => null),
    LISTEN_QUIET_PLAYER_HEIGHT: 160,
    prefersReducedMotion: () => false,
    observeReducedMotion: () => noop,
    HistoryIsolationQa: {}, MembershipCard: {}, MotionMenu: {}, SubscribeGuideSheet: {}, AudioPlayer: {}, ListenReadSurface: {},
    CompanionExitSheet: {}, SpeakerPlaybackSheet: {}, ShareSelection: {}, VoiceStateIndicator: {}, CompanionRolePreview: {}, audioOutputMonitor: { getState: () => ({ kind: 'unknown' }), refresh() {}, subscribe: () => noop },
    CommentList: {}, CommentInput: {}, ListenRoleSheet: {},
    ...globals
  }
  vm.runInNewContext(script, sandbox, { filename: path })
  return sandbox.component
}

export async function dailyHarness({ authenticated = false, basic = false, response = success([{ id: 91, title: '公开真实文章' }]), request } = {}) {
  const calls = { requests: [], navigation: [], notices: [], queues: [], pending: [], audioCleanup: 0, hidden: 0 }
  const user = {
    isAuthenticated: authenticated, isMock: false,
    setListenQueue: (...args) => calls.queues.push(args),
    setPendingArticle: article => calls.pending.push(article)
  }
  const component = await loadVueOptions('pages/daily/index.vue', {
    tracker: { track: noop },
    useUserStore: () => user,
    isAndroidBasicMode: () => basic,
    ensureListenColdStartCleanup: async () => { calls.audioCleanup++; return true },
    getMemberId: () => 7,
    API_PATHS: { RECOMMEND_LIST: '/api/v1/recommend/list' },
    isApiSuccess: value => String(value?.code) === '0',
    extractRecommendItems, readListenRoleSelection, listenSelectionParams,
    buildAuthLoginUrl, takePostAuthListenIntent: () => false,
    get: (...args) => { calls.requests.push(args); return request ? request(...args) : Promise.resolve(response) },
    uni: {
      setNavigationBarTitle: noop,
      navigateTo: args => calls.navigation.push(args),
      showToast: args => calls.notices.push(args),
      showLoading: noop,
      hideLoading: () => calls.hidden++
    }
  })
  const page = { ...component.methods, listenEntryPending: false, dailyContent: { id: 1 } }
  return { page, calls, user, component }
}

export function deferred() {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
