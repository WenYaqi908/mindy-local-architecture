import { getContentLocale } from '../i18n/content.js'
import { formatFeedTitle } from './feed-title.js'
import { LISTEN_CONTENT_STYLES, LISTEN_CONTENT_STYLE_CATALOG, LISTEN_DIALOGUE_STYLES } from './listen-role-preview.js'
import { localListenStandInUrl, selectListenRecording } from './listen-recording.js'

// Older audio and article records without a locale were produced in Chinese.
const LEGACY_AUDIO_LOCALE = 'zh-CN'

export function listenSelectionParams(selection) {
  return { contentStyle: selection?.contentStyleCode || 'NOVICE', dialogueStyle: selection?.dialogueStyleCode || 'DISCUSSION', locale: getContentLocale() }
}

function matchesArticleLanguage(article, audio) {
  return !article.contentLocale || (audio.locale || LEGACY_AUDIO_LOCALE) === article.contentLocale
}

function localPhoneAudio(article, audio, env) {
  const existing = audio?.audioUrl || ''
  const locale = audio?.locale || article.contentLocale || LEGACY_AUDIO_LOCALE
  if (!existing && (!['READY', 'STALE'].includes(audio?.status) || (locale !== 'en-US' && locale !== 'zh-CN'))) return ''
  return localListenStandInUrl(existing, locale, env)
}

/** Capabilities describe this article; the caller's desired preference is never changed. */
export function resolveListenArticle(article = {}, voiceCode = '', standInEnv) {
  const audio = article.selectedAudioVariant || article.listenAudio || {}
  const reading = article.selectedContent || audio.listenContent || {}
  const code = audio.resolvedVariantCode || ''
  const style = audio.contentStyle || code.split('_')[0]
  const mode = audio.dialogueStyle || code.split('_')[1]
  const audioUrl = localPhoneAudio(article, audio, standInEnv)
  const ready = matchesArticleLanguage(article, audio) && ['READY', 'STALE'].includes(audio.status) && !!audioUrl
  const declared = audio.availableVariantCodes
  const availableVariantCodes = Array.isArray(declared) ? declared.filter(code => {
    const [role, dialogue] = code.split('_')
    return LISTEN_CONTENT_STYLE_CATALOG.some(item => item.code === role) && LISTEN_DIALOGUE_STYLES.some(item => item.code === dialogue)
  }) : (article.audioVariants || []).filter(item => ['READY', 'STALE'].includes(item.status) && item.audioUrl
    && (article.availableContentStyles || []).includes(item.contentStyle)).map(item => item.variantCode)
  const role = ready && audio.sourceMode !== 'LEGACY' && availableVariantCodes.includes(code)
    && reading.resolvedContentStyle === style && !!reading.summary && !!reading.contentHash
  const legacyResources = (article.resources || []).filter(item => matchesArticleLanguage(article, item) && !String(item.voiceCode || '').startsWith('ROLE:'))
  const selectedResource = ready ? { resourceType: 'AUDIO', status: 'SUCCEEDED', audioUrl,
    variantId: audio.variantId || 0,
    recordingId: audio.recordingId || `variant:${article.id || article.feedId}:${code}:${audio.variantId || ''}`,
    ...(audio.locale ? { locale: audio.locale } : {}),
    durationSeconds: (Number(audio.durationMs) || 0) / 1000, expiresAt: audio.expiresAt,
    voiceCode: role ? `ROLE:${code}` : '', sourceMode: role ? 'ROLE' : 'LEGACY', transcriptUrl: audio.transcriptUrl } : null
  // Preserve historical voice choice for legacy articles; role audio is authoritative.
  const resources = role ? [selectedResource] : legacyResources.length ? legacyResources : selectedResource ? [selectedResource] : []
  const recording = selectListenRecording(resources, voiceCode, '', article.id || article.post_id || article.feedId)
  return { sourceMode: recording.ready ? role ? 'ROLE' : 'LEGACY' : 'UNAVAILABLE', resources, recording,
    availableVariantCodes: role ? availableVariantCodes : [],
    contentOptions: role ? LISTEN_CONTENT_STYLES.filter(item => availableVariantCodes.some(code => code.startsWith(item.code + '_'))) : [],
    appliedSelection: role ? { contentStyleCode: style, dialogueStyleCode: mode } : null,
    summary: role ? reading.summary : article.summary,
    content: role ? reading.content || '' : article.content }
}

export function projectListenArticle(article, voiceCode = '') {
  const resolved = resolveListenArticle(article, voiceCode)
  return { ...article, title: formatFeedTitle(article.title), resources: resolved.resources, summary: resolved.summary, content: resolved.content }
}

/** Cached recommendation selections belong to their request, not to a later preference. */
export function listenArticleMatchesSelection(article, selection) {
  const audio = article?.selectedAudioVariant || article?.listenAudio
  const params = listenSelectionParams(selection)
  const actualLocale = audio?.locale || article?.contentLocale || LEGACY_AUDIO_LOCALE
  if (actualLocale !== params.locale || (article?.contentLocale && article.contentLocale !== params.locale)) return false
  if (!audio) return true
  return audio.requestedVariantCode === params.contentStyle + '_' + params.dialogueStyle
}
export function articleForListenSelection(article, selection) {
  if (listenArticleMatchesSelection(article, selection)) return article
  // Keep readable legacy metadata but wait for the requested role's resolved audio.
  return { ...article, selectedAudioVariant: null, listenAudio: null, selectedContent: null, resources: [] }
}
