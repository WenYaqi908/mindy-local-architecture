// Signed access credentials are transport data; the recording's identity is stable.
export function audioFileIdentity(url = '') {
  const [base, query = ''] = String(url).split('?')
  const retained = query.split('&').filter(Boolean).filter(part => {
    const key = part.split('=')[0].toLowerCase()
    return !['signature', 'expires', 'ossaccesskeyid'].includes(key) && !['x-oss-signature', 'x-oss-credential', 'x-oss-date', 'x-oss-expires', 'x-oss-security-token', 'x-oss-signature-version', 'x-oss-additional-headers'].includes(key)
  }).sort()
  return base.split('#')[0] + (retained.length ? '?' + retained.join('&') : '')
}

function parseAlignmentValue(value) {
  if (!value) return null
  if (typeof value === 'string') {
    try { return JSON.parse(value) } catch (_) { return null }
  }
  return value
}

function alignmentTime(value, milliseconds = false) {
  const number = Number(value)
  if (!Number.isFinite(number) || number < 0) return null
  return milliseconds ? number : number * 1000
}

/**
 * Normalize server-provided word/sentence timestamps into a small client contract.
 * Unknown or incomplete records are ignored so callers can keep the estimated fallback.
 */
export function normalizeListenAlignment(resource = {}) {
  const metadata = parseAlignmentValue(resource.metadata)
  const raw = parseAlignmentValue(resource.alignment)
    || parseAlignmentValue(metadata?.alignment)
    || parseAlignmentValue(metadata?.listenAlignment)
  const source = Array.isArray(raw) ? raw : raw?.segments || raw?.words || raw?.items
  if (!Array.isArray(source)) return []

  return source.map((item, index) => {
    const blockIndex = Number(item?.blockIndex ?? item?.block_index ?? item?.blockId)
    // DashScope's sentence-end payload uses millisecond offsets for begin_time/end_time.
    const startMs = alignmentTime(item?.startMs ?? item?.start_ms ?? item?.beginTime ?? item?.begin_time, true)
    const endMs = alignmentTime(item?.endMs ?? item?.end_ms ?? item?.endTime ?? item?.end_time, true)
    const charEnd = Number(item?.charEnd ?? item?.char_end ?? item?.endIndex ?? item?.end_index)
    return {
      blockIndex: Number.isInteger(blockIndex) && blockIndex >= 0 ? blockIndex : null,
      startMs,
      endMs,
      charEnd: Number.isFinite(charEnd) && charEnd >= 0 ? charEnd : null,
      text: typeof item?.text === 'string' ? item.text : '',
      order: index
    }
  }).filter(item => item.blockIndex !== null && item.startMs !== null && item.endMs !== null && item.endMs >= item.startMs)
}

export function findListenAlignmentPosition(alignment, currentTimeSeconds) {
  const currentMs = Math.max(0, Number(currentTimeSeconds) || 0) * 1000
  if (!Array.isArray(alignment) || !alignment.length) return null
  let selected = alignment[alignment.length - 1]
  for (const item of alignment) {
    if (currentMs <= item.endMs) {
      selected = item
      break
    }
  }
  return { blockIndex: selected.blockIndex, charEnd: selected.charEnd, text: selected.text }
}

function fileKey(url) {
  let first = 2166136261, second = 2246822519
  for (const char of audioFileIdentity(url)) {
    first = Math.imul(first ^ char.charCodeAt(0), 16777619)
    second = Math.imul(second ^ char.charCodeAt(0), 3266489917)
  }
  return 'file:' + (first >>> 0).toString(16).padStart(8, '0') + (second >>> 0).toString(16).padStart(8, '0')
}

// Unlabelled listening audio was produced in Chinese. A missing locale must not
// fall through to the English sample.
const LEGACY_LISTEN_LOCALE = 'zh-CN'

const LOCAL_LISTEN_STANDIN_HOSTS = ['mindy.local', 'wendydemacbook-air.local']

function localListenStandInHost(hostname) {
  return /^169\.254\.\d+\.\d+$/.test(hostname) || LOCAL_LISTEN_STANDIN_HOSTS.includes(hostname)
}

function readStandInEnv() {
  try {
    return import.meta.env
  } catch (_) {
    return undefined
  }
}

/** A normal production build leaves audio addresses unchanged. The sample
 * files are only for this machine's dev server or an explicit local flag. */
export function localListenStandInAllowed(env) {
  const source = env === undefined ? readStandInEnv() : env
  return source?.VITE_LOCAL_LISTEN_STANDIN === 'true' || source?.DEV === true
}

/** Local phone pages cannot open SeaweedFS. USB Vite pages and the local
 * HTTPS entry (built with VITE_LOCAL_LISTEN_STANDIN=true) may use the two
 * sample files. A normal production build leaves every address unchanged. */
export function localListenStandInUrl(url, locale, env) {
  if (typeof window === 'undefined') return url || ''
  const hostname = window.location?.hostname || ''
  if (!localListenStandInHost(hostname)) return url || ''
  if (!localListenStandInAllowed(env)) return url || ''
  const file = locale === 'en-US' ? 'en.wav' : 'zh.wav'
  const local = `${window.location.origin}/static/local-listen/${file}`
  if (!url) return local
  try {
    const parsed = new URL(url, window.location.origin)
    if (parsed.host === window.location.host) return url
  } catch (_) {
    return url
  }
  return local
}

function phoneReachableAudio(url, resource, env) {
  if (!url) return url
  const locale = resource.locale || resource.contentLocale || LEGACY_LISTEN_LOCALE
  return localListenStandInUrl(url, locale, env) || url
}

export function describeListenRecording(resource = {}, articleId = '', env) {
  const url = phoneReachableAudio(resource.audioUrl || resource.resourceUrl || '', resource, env)
  const voiceCode = resource.voiceCode || ''
  const identity = resource.taskId || resource.resourceId || resource.id || (url ? fileKey(url) : '')
  const duration = Number(resource.durationSeconds)
  return {
    articleId: String(articleId || ''), url, voiceCode, variantId: resource.variantId || 0,
    recordingId: resource.recordingId || (identity ? `${identity}:${voiceCode}` : ''),
    durationSeconds: Number.isFinite(duration) && duration > 0 ? duration : 0,
    expiresAt: resource.expiresAt || '',
    alignment: normalizeListenAlignment(resource),
    ready: resource.status === 'SUCCEEDED' && Boolean(url)
  }
}

export function selectListenRecording(resources, voiceCode = '', url = '', articleId = '') {
  const audio = (Array.isArray(resources) ? resources : []).filter(item =>
    String(item?.resourceType || '').toUpperCase() === 'AUDIO' && item.status === 'SUCCEEDED'
    && (item.audioUrl || item.resourceUrl))
  const selected = url
    ? audio.find(item => audioFileIdentity(item.audioUrl || item.resourceUrl) === audioFileIdentity(url))
    : audio.find(item => voiceCode && item.voiceCode === voiceCode) || audio[0]
  return describeListenRecording(selected || {}, articleId)
}
