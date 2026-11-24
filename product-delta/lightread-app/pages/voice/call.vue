<template>
  <!-- #ifdef APP-PLUS -->
  <page-meta :page-style="fixedDocumentStyle" />
  <!-- #endif -->
  <view @touchstart="onBackSwipeStart" @touchend="onBackSwipeEnd" @touchcancel="backSwipeStart = null" class="call-page" :class="{'is-english': isEnglishUi, 'is-quiet-entry': quietEntry, 'is-short-viewport': shortViewport, 'has-role-notice': rolePending || roleErrorMessage || roleSubmissionError, 'has-connection-error': errorCode === 'UPSTREAM_DISCONNECTED', 'text-display': controlState.displayMode === 'text', 'is-paused': controlState.lifecycle === 'paused', 'has-overlay': showVoicePicker || Boolean(activeCitation), 'has-keyboard': inputFocused || keyboardHeight > 0}" :data-active="pageVisible ? 'true' : 'false'" :style="pageChromeStyle">
    <TypographyProvider />
    <ShareSelection scope-selector=".chat-inner" kind="companion" :title="t('share.voiceExcerpt')" :source="t('share.voiceSource')" :active="pageVisible && controlState.displayMode === 'text' && !showVoicePicker && !showSpeakerConfirm && !showExitConfirm && !activeCitation" @preview="openSharePreview" />
    <view class="top-safe" :aria-hidden="(showVoicePicker || showSpeakerConfirm || showExitConfirm || activeCitation) ? 'true' : undefined" :inert="(showVoicePicker || showSpeakerConfirm || showExitConfirm || activeCitation) ? '' : undefined" />

    <view class="call-header" :aria-hidden="(showVoicePicker || showSpeakerConfirm || showExitConfirm || activeCitation) ? 'true' : undefined" :inert="(showVoicePicker || showSpeakerConfirm || showExitConfirm || activeCitation) ? '' : undefined">
      <view class="call-topbar">
        <button role="button" tabindex="0" id="companion-role-trigger" class="role-entry" :aria-label="t('companion.role')" aria-haspopup="dialog" :aria-expanded="showVoicePicker" @tap="openRolePicker" @keydown.enter.prevent="openRolePicker" @keydown.space.prevent="openRolePicker"><view class="role-entry-avatar" :class="{'is-interviewer': confirmedRoleCode === 'INTERVIEWER'}" aria-hidden="true"><image :src="`/static/companion/role-thumbnails/${confirmedRoleCode}.png`" mode="aspectFill" /></view><view class="role-entry-copy"><text class="role-entry-name">{{ confirmedRoleName }}</text><text class="role-entry-description">{{ roleDescription }}</text></view><image class="role-entry-chevron" src="/static/companion/header-chevron.svg" /></button>
        <view class="top-actions">
          <button role="button" tabindex="0" id="companion-display-toggle" class="top-action" :aria-label="controlState.displayMode === 'text' ? t('companion.hideText') : t('companion.showText')" @tap="toggleDisplay" @keydown.enter.prevent="toggleDisplay" @keydown.space.prevent="toggleDisplay"><image :src="controlState.displayMode === 'text' ? '/static/companion/header-avatar.svg' : '/static/companion/header-text.svg'" aria-hidden="true" /><text>{{ controlState.displayMode === 'text' ? t('companion.hideText') : t('companion.showText') }}</text></button>
          <button role="button" tabindex="0" id="companion-notes-entry" class="top-action" :aria-label="t('companion.notes')" :disabled="openingNotes" @tap="openMyNotes" @keydown.enter.prevent="openMyNotes" @keydown.space.prevent="openMyNotes"><image src="/static/companion/header-notes.svg" aria-hidden="true" /><text>{{ t('companion.notes') }}</text></button>
          <button role="button" tabindex="0" class="top-action call-feedback" :aria-label="t('companion.report')" @tap="openProductFeedback" @keydown.enter.prevent="openProductFeedback" @keydown.space.prevent="openProductFeedback"><image src="/static/companion/header-feedback.svg" aria-hidden="true" /><text>{{ t('companion.feedback') }}</text></button>
        </view>
      </view>
      <view v-if="rolePending" class="role-pending" role="status"><view class="role-pending-dot" aria-hidden="true" /><text>{{ rolePendingText }}</text></view>
      <view v-else-if="roleErrorMessage" class="role-pending role-error" role="alert"><view class="role-pending-dot" aria-hidden="true" /><text>{{ roleErrorDisplayText }}</text><button v-if="failedRoleCode" role="button" tabindex="0" class="role-retry" :aria-label="t('companion.roleRetry')" @tap="retryRoleChange" @keydown.enter.prevent="retryRoleChange" @keydown.space.prevent="retryRoleChange">{{ t('companion.retry') }}</button></view>
      <view v-if="roleSubmissionError && !roleErrorMessage && !rolePending" class="role-pending role-error" role="alert"><text>{{ t('companion.roleUnchanged') }}</text><button role="button" tabindex="0" class="role-retry" @tap="retryRoleChange" @keydown.enter.prevent="retryRoleChange" @keydown.space.prevent="retryRoleChange">{{ t('companion.retry') }}</button></view>
      <view v-if="openingTextChat" class="role-pending" role="status"><text>{{ t('companion.savingForText') }}</text></view>
    </view>

    <button v-if="articleSource" :aria-hidden="(showVoicePicker || showSpeakerConfirm || showExitConfirm || activeCitation) ? 'true' : undefined" :inert="(showVoicePicker || showSpeakerConfirm || showExitConfirm || activeCitation) ? '' : undefined" class="companion-article-source" role="button" tabindex="0" :aria-label="t('companion.viewArticle', {title: articleSource.title})" @tap="openConfirmedArticle" @keydown.enter.prevent="openConfirmedArticle" @keydown.space.prevent="openConfirmedArticle"><text class="companion-article-label">{{ t('companion.article') }}</text><view class="companion-article-title"><text>{{ articleSource.title }}</text><text aria-hidden="true">›</text></view></button>

    <view v-if="controlState.displayMode === 'avatar'" class="voice-stage" :aria-hidden="(showVoicePicker || showSpeakerConfirm || showExitConfirm || activeCitation) ? 'true' : undefined" :inert="(showVoicePicker || showSpeakerConfirm || showExitConfirm || activeCitation) ? '' : undefined">
      <view v-if="!articleSource" class="hero-copy"><text class="hero-kicker">MindyAI · GROW TOGETHER</text><text class="hero-title">{{ quietEntry ? t('companion.hello') : t('companion.hero') }}</text></view>
      <view v-if="rolePending" class="role-handoff" :class="{ 'is-connecting': rolePending.phase !== 'waiting' }" :aria-label="t('companion.handoffLabel', { current: confirmedRoleName, next: pendingRoleName })">
        <view class="role-handoff-faces">
          <view class="role-handoff-person is-current"><image :src="`/static/companion/role-thumbnails/${confirmedRoleCode}.png`" mode="aspectFill" /><text class="role-handoff-label">{{ t('companion.handoffCurrent') }}</text><text class="role-handoff-name">{{ confirmedRoleName }}</text></view>
          <view class="role-handoff-link" aria-hidden="true"><view class="role-handoff-track"><view class="role-handoff-pulse" /></view><text>→</text></view>
          <view class="role-handoff-person is-next"><image :src="pendingRoleAvatar" mode="aspectFill" /><text class="role-handoff-label">{{ t('companion.handoffNext') }}</text><text class="role-handoff-name">{{ pendingRoleName }}</text></view>
        </view>
        <text class="role-handoff-caption">{{ t('companion.handoffCopy') }}</text>
      </view>
      <view v-else class="portrait-group"><view class="role-portrait" :class="{'is-interviewer': confirmedRoleCode === 'INTERVIEWER'}"><image class="role-portrait-image" :src="`/static/companion/roles/${confirmedRoleCode}.jpg`" mode="aspectFill" :aria-label="t('companion.rolePortrait', {name: confirmedRoleName})" /></view><text class="portrait-name">{{ confirmedRoleName }}</text><text class="portrait-description">{{ roleDescription }}</text></view>
    </view>

    <scroll-view
      v-else
      class="chat-scroll"
      scroll-y
      :scroll-into-view="scrollTarget"
      :scroll-with-animation="false"
      :scroll-top="chatRestoreTop"
      @scroll="onChatScroll"
      @touchstart="onChatTouchStart"
      @touchmove="onChatTouchMove"
      @wheel="onChatWheel"
      @keydown="onChatKeydown"
      @touchend="onChatTouchEnd"
      @touchcancel="onChatTouchEnd"
      :aria-hidden="(showVoicePicker || showSpeakerConfirm || showExitConfirm || activeCitation) ? 'true' : undefined"
      :inert="(showVoicePicker || showSpeakerConfirm || showExitConfirm || activeCitation) ? '' : undefined"
    >
      <view class="chat-inner">
        <text v-if="!articleSource" class="chat-intro">{{ displayTurns.length ? t('companion.transcriptIntro') : t('companion.hello') }}</text>
        <view v-for="turn in displayTurns" :key="turn._key" :id="'msg-' + turn._key">
          <view class="turn-row" :class="turn.role">
            <text class="turn-speaker">{{ turn.role === 'user' ? t('companion.you') : (turn.companionRoleName || t('listen.role.NOVICE.name')) }}</text>
            <view class="turn-bubble" :class="{streaming: turn.streaming}">
              <view class="turn-text" data-share-message="true" :data-share-role="turn.role" :data-share-speaker="turn.role === 'user' ? t('companion.you') : (turn.companionRoleName || t('listen.role.NOVICE.name'))">
                <block v-for="(seg, i) in spokenSegments(turn)" :key="i">
                  <text selectable v-if="seg.type === 'text'" :id="seg.anchor ? 'companion-reading-position' : undefined" :class="{'spoken-text': seg.spoken}">{{ seg.value }}</text>
                  <button v-else class="cite-badge" role="button" tabindex="0" :aria-label="t('companion.viewCitation', {id: seg.id})" @tap.stop="showCitation(turn.turnSeq, seg.id)" @keydown.enter.stop.prevent="showCitation(turn.turnSeq, seg.id)" @keydown.space.stop.prevent="showCitation(turn.turnSeq, seg.id)">{{ seg.label }}</button>
                </block>
                <text v-if="turn.streaming" class="typing-cursor">▎</text>
              </view>
              <text v-if="turn.audioUnavailable" class="interrupt-hint" role="status">{{ t('companion.audioTextOnly') }}</text>
              <text v-if="turn.interrupted && !turn.streaming" class="interrupt-hint">{{ t('companion.interrupted') }}</text>
            </view>
          </view>
          <button
            v-if="turn.role === 'assistant' && turnCitationCount(turn) > 0"
            class="search-sources-entry" role="button" tabindex="0"
            @click="showCitation(turn.turnSeq, 1)"
            @keydown.enter.prevent="showCitation(turn.turnSeq, 1)"
            @keydown.space.prevent="showCitation(turn.turnSeq, 1)"
          >
            <text>{{ t('companion.sourcesCount', { count: turnCitationCount(turn) }) }}</text>
          </button>
        </view>

        <view v-if="listeningVisible" class="listening-row">
          <view class="listening-dots">
            <view v-for="i in 3" :key="i" class="ldot" :style="{ animationDelay: (i - 1) * 0.18 + 's' }" />
          </view>
          <text class="listening-text">{{ listeningLabel }}</text>
        </view>

        <view class="scroll-spacer" />
        <view class="scroll-anchor" id="chat-bottom" />
      </view>
    </scroll-view>

    <button v-if="controlState.displayMode === 'text' && !chatFollowing && !showVoicePicker && !showSpeakerConfirm && !showExitConfirm && !activeCitation" class="chat-latest" role="button" tabindex="0" :aria-label="t('companion.latestLabel')" @tap="returnToLatest" @keydown.enter.prevent="returnToLatest" @keydown.space.prevent="returnToLatest">{{ t(readingTurn ? 'companion.followReading' : 'companion.latest') }}</button>

    <!-- 引用浮动卡片 -->
    <view v-if="activeCitation" ref="citationOverlay" class="cite-overlay" @click="hideCitation()">
      <view class="cite-card" role="dialog" aria-modal="true" :aria-label="t('companion.sources')" tabindex="-1" @click.stop>
        <!-- Tavily 来源：图标 + 域名 -->
        <view v-if="activeCitation.source === 'tavily'" class="cite-source-row">
          <text class="cite-source-icon">{{ sourceTypeIcon(activeCitation.source_type) }}</text>
          <text class="cite-domain">{{ activeCitation.domain }}</text>
        </view>
        <!-- 站内文章：封面图 -->
        <image
          v-else-if="activeCitation.cover_image"
          class="cite-cover"
          :src="activeCitation.cover_image"
          mode="aspectFill"
        />
        <text class="cite-title">{{ activeCitation.title }}</text>
        <text class="cite-summary">{{ activeCitation.summary }}</text>
        <!-- Tavily 额外信息 -->
        <view v-if="activeCitation.source === 'tavily'" class="cite-meta-row">
          <text v-if="activeCitation.source_type" class="cite-source-type">{{ sourceTypeLabel(activeCitation.source_type) }}</text>
          <text v-if="activeCitation.score != null" class="cite-score">{{ t('companion.relevance', { score: (activeCitation.score * 100).toFixed(0) }) }}</text>
          <text v-if="activeCitation.published_date" class="cite-date">{{ activeCitation.published_date }}</text>
        </view>
        <view class="cite-actions">
          <button v-if="citationDestination(activeCitation)" role="button" tabindex="0" class="cite-action" @click="openCitationDetail(activeCitation)" @keydown.enter.prevent="openCitationDetail(activeCitation)" @keydown.space.prevent="openCitationDetail(activeCitation)">{{ t(citationDestination(activeCitation)?.kind === 'external' ? 'companion.viewSource' : 'companion.viewDetails') }}</button>
          <button role="button" tabindex="0" class="cite-action" data-initial-focus @click="hideCitation()" @keydown.enter.prevent="hideCitation()" @keydown.space.prevent="hideCitation()">{{ t('companion.closeSources') }}</button>
        </view>
      </view>
    </view>

    <!-- 服务端正尝试重连 DashScope -->
    <view v-if="isReconnecting" class="reconnecting-banner">
      <text class="reconnecting-dot" />
      <text class="reconnecting-text">{{ t('companion.reconnectingHint') }}</text>
    </view>
    <!-- 致命错误：重连失败 -->
    <view v-if="errorCode === 'UPSTREAM_DISCONNECTED'" class="error-fatal">
      <text class="error-fatal-text">{{ connectionErrorDisplayText }}</text>
      <button class="reconnect-btn" role="button" tabindex="0" :aria-label="t('companion.reconnect')" @tap="reconnect" @keydown.enter.prevent="reconnect" @keydown.space.prevent="reconnect"><text>{{ t('companion.reconnect') }}</text></button>
    </view>
    <!-- 其他错误：点击关闭的 toast -->
    <view v-else-if="controlState.error || errorMessage" class="error-tip" role="alert">
      <text>{{ inlineErrorText }}</text>
      <button v-if="controlState.error" role="button" tabindex="0" class="error-action" :disabled="retryingControl || (controlState.error.operation === 'sendText' && !canSendText)" @tap="retryControlOperation" @keydown.enter.prevent="retryControlOperation" @keydown.space.prevent="retryControlOperation">{{ retryingControl ? t('companion.retryingAction') : (controlState.error.operation === 'sendText' ? t('companion.resendText') : t('companion.retry')) }}</button>
      <button v-else role="button" tabindex="0" class="error-action" @tap="errorMessage = ''" @keydown.enter.prevent="errorMessage = ''" @keydown.space.prevent="errorMessage = ''">{{ t('companion.dismissError') }}</button>
    </view>

    <SubscribeGuideSheet
      :visible="showSubscribeGuide"
      @close="closeSubscribeGuide"
      @paid="onSubscribePaid"
    />

    <view class="companion-status" role="status" aria-live="polite" :aria-hidden="(showVoicePicker || showSpeakerConfirm || showExitConfirm || activeCitation) ? 'true' : undefined" :inert="(showVoicePicker || showSpeakerConfirm || showExitConfirm || activeCitation) ? '' : undefined">
      <view class="gold-wave" aria-hidden="true"><VoiceStateIndicator :state="voiceMotionState" :active="pageVisible && !showVoicePicker && !showExitConfirm && !showSpeakerConfirm && !activeCitation && !ended && !quietEntry" /></view>
      <text class="status-title">{{ presentationTitle }}</text><text class="status-subtitle">{{ presentationSupportingText }}</text>
    </view>
    <view v-if="quietEntry" class="quiet-call-controls safe-bottom" :inert="(showVoicePicker || showSpeakerConfirm || showExitConfirm || activeCitation) ? '' : undefined">
      <view v-if="routeInterrupted && lastConversationText" class="quiet-context"><text class="quiet-context-label">{{ t('companion.lastTopic') }}</text><text>{{ lastConversationText }}</text></view>
      <text v-else class="quiet-text-hint">{{ t('companion.quietHint') }}</text>
      <text v-if="!showQuietVoiceStart" class="quiet-auto-start" role="status">{{ t('companion.voicePreparing') }}</text>
      <button v-if="showQuietVoiceStart" class="quiet-voice-start" role="button" tabindex="0" :aria-label="quietCopy.action" @keydown.enter.prevent="beginQuietVoice" @keydown.space.prevent="beginQuietVoice" :disabled="!quietEntryReady || voiceStarting || textEntryPending" @tap="beginQuietVoice">{{ voiceStarting ? t('companion.voicePreparing') : quietCopy.action }}</button>
      <button class="quiet-text-start" role="button" tabindex="0" :aria-label="textEntryPending ? t('companion.textPreparing') : t('companion.textStart')" :aria-busy="textEntryPending" @keydown.enter.prevent="beginQuietText" @keydown.space.prevent="beginQuietText" :disabled="!quietEntryReady || voiceStarting || textEntryPending" @click="beginQuietText">{{ textEntryPending ? t('companion.textPreparing') : t('companion.textStart') }}</button>
      <button class="quiet-exit" role="button" tabindex="0" :aria-label="t('companion.back')" @keydown.enter.prevent="requestExit" @keydown.space.prevent="requestExit" @tap="requestExit">{{ t('companion.back') }}</button>
    </view>
    <view v-else class="call-controls safe-bottom" :class="{'text-input-controls': controlState.inputMode === 'text'}" :aria-hidden="(showVoicePicker || showSpeakerConfirm || showExitConfirm || activeCitation) ? 'true' : undefined" :inert="(showVoicePicker || showSpeakerConfirm || showExitConfirm || activeCitation) ? '' : undefined">
      <button role="button" tabindex="0" class="input-toggle" :disabled="ended" :aria-label="controlState.inputMode === 'voice' ? t('companion.keyboard') : t('companion.mic')" @tap="toggleInput" @keydown.enter.prevent="toggleInput" @keydown.space.prevent="toggleInput"><image :src="controlState.inputMode === 'voice' ? '/static/companion/keyboard.svg' : '/static/companion/mic-input.svg'" /></button>
      <view v-if="controlState.inputMode === 'text'" class="text-input-wrap">
        <input :maxlength="-1" v-model="inputText" :aria-label="t('companion.input')" :placeholder="t('companion.placeholder')" :disabled="ended || submittingText" :adjust-position="false" confirm-type="send" @confirm="submitText" @focus="onTextInputFocus" @blur="onTextInputBlur" />
        <button role="button" tabindex="0" class="send-text" :aria-label="t('companion.send')" :disabled="!canSendText" @tap="submitText" @keydown.enter.prevent="submitText" @keydown.space.prevent="submitText">↑</button>
      </view>
      <button role="button" tabindex="0" class="exit-call" :class="{compact: controlState.inputMode === 'text'}" :aria-label="t('companion.exit')" :disabled="ended" @tap="requestExit" @keydown.enter.prevent="requestExit" @keydown.space.prevent="requestExit"><image src="/static/companion/exit.svg" /><text v-if="controlState.inputMode === 'voice'">{{ t('companion.exit') }}</text></button>
      <button role="button" tabindex="0" class="pause-call" :aria-label="rolePending || roleErrorMessage ? t('companion.rolePauseUnavailable') : (controlState.lifecycle === 'paused' ? t('companion.resume') : t('companion.pause'))" :disabled="ended || Boolean(rolePending) || Boolean(roleErrorMessage)" @tap="togglePause" @keydown.enter.prevent="togglePause" @keydown.space.prevent="togglePause"><image :src="controlState.lifecycle === 'paused' ? '/static/companion/resume.svg' : '/static/companion/pause.svg'" /></button>
    </view>
    <CompanionExitSheet :visible="showExitConfirm" @close="resolveExitConfirmation(false)" @confirm="resolveExitConfirmation(true)" />
    <SpeakerPlaybackSheet :visible="showSpeakerConfirm" :unknown="outputRoute.kind === 'unknown'" @close="cancelQuietResume" @confirm="confirmQuietResume" />
    <CompanionRolePreview :visible="showVoicePicker" :roles="roleOptions" :current-code="rolePending?.contentStyleCode || confirmedRoleCode" :available="roleSelectionAvailable" :busy="roleSubmitBusy" :notice="rolePickerNotice" @apply="selectCompanionRole" @close="showVoicePicker = false" />
    <text v-if="qaMode" class="qa-diagnostics" data-testid="companion-qa-diagnostics">{{ qaDiagnostics }}</text>
    <view v-if="qaMode && qaVolumeControls" class="qa-volume-controls">
      <button :aria-label="t('companion.qaMuteLabel')" @tap="setQaVolume(0)">{{ t('companion.qaMute') }}</button>
      <button :aria-label="t('companion.qaRaiseLabel')" @tap="raiseQaVolume">{{ t('companion.qaRaise') }}</button>
      <button :aria-label="t('companion.qaHeadsetLabel')" @tap="setQaVolume(0.5, 'qa-headset')">{{ t('companion.qaHeadset') }}</button>
      <button :aria-label="t('companion.qaCallVolumeLabel')" @tap="setQaVolume(0.8, 'qa-call-speaker', true, 1 / 16)">{{ t('companion.qaCallVolume') }}</button>
      <button :aria-label="t('companion.qaMinimumVolumeLabel')" @tap="setQaVolume(1 / 16, qaVolumeContext, false, 1 / 16)">{{ t('companion.qaMinimumVolume') }}</button>
    </view>
  </view>
</template>

<script>
import { t, getUiLocale } from '@/i18n/index.js'
import { trackCompanionAudioRelease } from '@/common/companion-audio-release.js'
import { markListenHandoff } from '@/common/listen-handoff-metrics.js'
import ShareSelection from '@/components/ShareSelection.vue'
import { setShareDraft } from '@/common/share-draft.js'
import { API_PATHS, get, post } from '@/common/api.js'
import { companionTextUrl, prepareCompanionTextHistory } from '@/common/companion-text-handoff.js'
import { saveCompanionContext } from '@/common/companion-history-context.js'
import { companionEndUrl, isCompanionBackSwipe, trackCompanionSave, resolveCompanionListenReturnPlaying } from '@/common/companion-exit.js'
import { audioOutputMonitor, normalizeOutputRoute, quietAudioCopy, routeNeedsPause } from '@/common/audio-output.js'
import { normalizeArticleIds, acceptArticleReceipt } from '@/common/companion-article-association.js'
import { voiceMode } from '@/common/voice-mode.js'
import CompanionExitSheet from '@/components/CompanionExitSheet.vue'
import SpeakerPlaybackSheet from '@/components/SpeakerPlaybackSheet.vue'
import VoiceStateIndicator from '@/components/VoiceStateIndicator.vue'
import { resolveVoiceMotion } from '@/common/motion.js'
import { CompanionReadProgress, companionReadingSegments } from '@/common/companion-read-progress.js'
import { markRaw } from 'vue'
import { describeCitationSource, resolveCitationDestination } from '@/common/citation-source.js'
import { containSheetFocus } from '@/common/sheet-focus.js'
import { requestAndroidNotificationPermission } from '@/common/android-notification-permission.js'
import { getAudioPlayer } from '@/common/audio-player.js'
import { createCompanionVolumeGate, readCompanionEntryVolume, observeCompanionOutputVolume } from '@/common/companion-volume.js'
import { useUserStore } from '@/store/user.js'
import { useVoiceStore } from '@/store/voice.js'
import { applyMembershipStatusToStore, fetchMembershipStatus, isPlusMember } from '@/common/vip.js'
import SubscribeGuideSheet from '@/components/SubscribeGuideSheet.vue'
import RealtimeConnectionController from '@/common/realtime/connectionController.js'
import RealtimeSocket from '@/common/realtime/realtimeSocket.js'
import AoqTransport, { isAndroidAoqEnabled, isIosAoqEnabled } from '@/common/realtime/aoqTransport.js'
import AndroidWebRtcTransport, {
  isAndroidWebRtcAvailable,
  isIosWebRtcAvailable,
  isAndroidWebRtcQaMembershipBypass
} from '@/common/realtime/androidWebRtcTransport.js'
import PcmRecorder from '@/common/realtime/pcmRecorder.js'
import { requestMicrophonePermission } from '@/common/realtime/microphone-permission.js'
import PcmPlayer from '@/common/realtime/pcmPlayer.js'
import { WebRtcPlayer, WebRtcRecorder } from '@/common/realtime/webrtcMedia.js'
import nativeAudio from '@/common/realtime/nativeAudio.js'
import { shellEchoHoldUntil } from '@/common/realtime/shell-echo-gate.js'
import { acquireScreenAwake, releaseScreenAwake } from '@/common/screen-awake.js'
import {
  companionPresentationCopy,
  createCompanionPresentationState,
  reduceCompanionPresentation
} from '@/common/companion-state.js'
import { getCompanionQaEvents, getCompanionQaVolume, hasCompanionQaVolumeControls, getCompanionQaRolePreference, isCompanionQaEnabled, resolveCompanionQaPageUrl, runCompanionQaSequence, createCompanionQaAdapter } from '@/common/companion-qa.js'
import { getPageDocumentStyle, applyPageChrome, resetH5PageChrome, resolveKeyboardContentViewportHeight } from '@/common/page-chrome.js'
import CompanionRolePreview from '@/components/CompanionRolePreview.vue'
import { canSubmitCompanionText, createCompanionController } from '@/common/companion-controls.js'
import { COMPANION_ROLE_OPTIONS, COMPANION_ROLE_CODES, COMPANION_SELECTABLE_ROLE_CODES, loadCompanionRoles, resolveInitialCompanionRole, saveCompanionRolePreference } from '@/common/companion-roles.js'
import { getLocalVoiceCode } from '@/common/voice.js'
import { decodeRouteParam } from '@/common/navigation.js'
import { isAndroidBasicMode } from '@/common/privacy-state.js'
import { buildAuthLoginUrl } from '@/common/auth-navigation.js'

const INTERRUPT_COOLDOWN_MS = 1200

/** AI 播放期间的上行回声门控。VoiceProcessingIO 仍可能残留低强度回声，
 * 但不能因此吞掉用户的短句插话。仅留 300ms 给 AEC 稳定，随后用两个
 * 100ms 近端帧确认真人语音；阈值必须使用麦克风输入标尺，不能与 AI 原始
 * 播放 PCM 按比例比较，两者不在同一声学尺度上。 */
const ECHO_GUARD_MS = 300
const ECHO_RELEASE_MS = 350
const BARGE_IN_VAD = Object.freeze({
  rmsThreshold: 0.04,
  peakThreshold: 0.18,
  speechFrames: 2
})

const STREAM_COALESCE_MS = 50

/**
 * AI 文字缓冲兜底时长。服务端未对文本/音频统一下发 turn_seq 时，会出现
 * “AI 先到、用户 ASR final 后到”或“工具续写轮无 ASR”。客户端缓冲 AI 文字
 * 等待该轮 ASR final，最多等该时长；超时仍未到则强制放行，避免 AI 输出停在第一段。
 */
const AI_BUFFER_FLUSH_MS = 500

function getPcmLevel(frame) {
  if (!(frame instanceof ArrayBuffer) || frame.byteLength < 2) return { rms: 0, peak: 0 }
  const view = new DataView(frame)
  const samples = Math.floor(frame.byteLength / 2)
  let sumSquares = 0
  let peak = 0
  for (let offset = 0; offset < samples * 2; offset += 2) {
    const sample = view.getInt16(offset, true) / 32768
    const abs = Math.abs(sample)
    sumSquares += sample * sample
    if (abs > peak) peak = abs
  }
  return { rms: Math.sqrt(sumSquares / samples), peak }
}

function getInterruptDiagnosticEnvironment() {
  let system = {}
  let app = {}
  try { system = uni.getSystemInfoSync ? uni.getSystemInfoSync() : {} } catch (e) {}
  try { app = uni.getAppBaseInfo ? uni.getAppBaseInfo() : {} } catch (e) {}
  return {
    platform: String(system.platform || '').toLowerCase() || undefined,
    device_model: system.model || system.deviceModel || undefined,
    os_version: system.system || system.osVersion || undefined,
    app_version: app.appVersion || system.appVersion || undefined,
    app_build: app.appVersionCode || system.appVersionCode || undefined
  }
}

function normalizeAudioRoute(route) {
  if (!route) return null
  if (typeof route === 'string') {
    const value = route.trim()
    return value ? value.slice(0, 64) : null
  }
  if (typeof route !== 'object') return null
  const inputs = Array.isArray(route.inputPortTypes) ? route.inputPortTypes : []
  const outputs = Array.isArray(route.outputPortTypes) ? route.outputPortTypes : []
  const parts = []
  if (inputs.length) parts.push(`in:${inputs.map(String).join('+')}`)
  if (outputs.length) parts.push(`out:${outputs.map(String).join('+')}`)
  return parts.length ? parts.join('|').slice(0, 64) : null
}

let _keyCounter = 0
function nextKey() { _keyCounter += 1; return 'k' + _keyCounter }

import { rememberEpochRestartQa } from '@/common/realtime/epochRestartQa.js'
import { continuationSessionMatches } from '@/common/companion-continuation.js'

function createRealtimeTransport(forceLegacy = false, historyContinuation = false, resumeState = null) {
  if (forceLegacy) return new RealtimeSocket()
  if (historyContinuation) return new RealtimeConnectionController({ resumeState })
  if (isAndroidAoqEnabled() || isIosAoqEnabled()) return new AoqTransport()
  if (isAndroidWebRtcAvailable() || isIosWebRtcAvailable()) return new AndroidWebRtcTransport()
  try {
    if (uni.getStorageSync('realtime_protocol_v2_disabled') === true) return new RealtimeSocket()
  } catch (error) { /* V2 remains the default; V1 is the automatic fallback. */ }
  return new RealtimeConnectionController({ resumeState })
}

export default {
  components: { ShareSelection,
    VoiceStateIndicator,
    CompanionExitSheet,
    SpeakerPlaybackSheet,
    SubscribeGuideSheet,
    CompanionRolePreview
  },
  data() {
    return {
      phase: 'INIT',
      globalVoiceAutoStart: false, qaQuiet: false, quietStarted: false, quietEntryReady: false, voiceStarting: false, textEntryPending: false, routeInterrupted: false, showExitConfirm: false, showSpeakerConfirm: false,
      outputRoute: audioOutputMonitor.getState(),
      openingTextChat: false, textHandoffPaused: false, backSwipeStart: null,
      control: null,
      pageVisible: true,
      feedbackPaused: false,
      controlErrorMessage: '',
      controlState: { displayMode: 'avatar', inputMode: 'voice', voiceOutput: true, lifecycle: 'connecting', desiredCapture: false, desiredOutput: false },
      inputText: '',
      submittingText: false,
      qaCalls: [],
      viewportListener: null,
      viewportMeasurePending: false,
      keyboardListener: null,
      geometryTimer: null,
      keyboardHeight: 0,
      keyboardBaselineHeight: 0,
      inputFocused: false,

      companionPresentation: createCompanionPresentationState(),
      qaMode: false,
      qaCurrentVolume: 1,
      qaMinimumVolume: 0,
      qaVolumeContext: 'qa-speaker',
      qaPageUrl: '',
      authReturnUrl: '/pages/voice/call',
      authRedirectPending: false,
      voiceCode: getLocalVoiceCode(),
      showVoicePicker: false,
      confirmedRoleCode: 'NOVICE',
      rolePreferenceOwnerId: 0,
      qaRolePreferenceStorage: null,
      roleOptions: [],
      roleCatalogError: '',
      roleErrorMessage: '',
      roleFailureReasonCode: '',
      roleSubmissionError: '',
      retryingControl: false,
      failedRoleCode: '',
      rolePending: null,
      roleSubmitBusy: false,
      qaAdapter: null,
      pageChromeStyle: {},
      muted: false,
      openingFeedback: false,
      openingNotes: false,
      lifecycleSuspended: false,
      audioRecovering: false,
      companionVolumeGate: null,
      fallbackVolumeObserver: null,
      nativeVolumeEventsSeen: false,
      qaVolumeControls: false,
      audioRoute: null,
      systemAudioInterrupted: false,
      nativeEchoCancellationActive: false,
      androidEchoCancellationActive: false,
      iosVoiceProcessingActive: false,
      ended: false,
      showSubscribeGuide: false,
      isReconnecting: false,
      transportRecoveryState: 'IDLE',
      upstreamRecoveryState: 'IDLE',
      recoveryMessage: t('companion.networkRecovering'),
      elapsedSeconds: 0,
      startedAt: 0,
      activeElapsedMs: 0,
      durationTimer: null,
      sessionReadyTimer: null,
      resumeReadyTimer: null,
      responseWatchdogTimer: null,
      resumingFromBackground: false,
      backgroundSuspended: false,
      transportMode: 'v2',
      v2FallbackUsed: false,
      v2FallbackInProgress: false,
      fallbackAwaitingContext: false,
      errorMessage: '',
      errorCode: '',
      sessionId: '',
      socket: null,
      recorder: null,
      player: null,
      nativeVoiceSession: null,
      unsubscribers: [],
      destroyed: false,
      interrupting: false,
      suppressAiOutput: false,
      interruptSpeechFrames: 0,
      echoGateSpeechFrames: 0,
      iosBargeInPreroll: [],
      iosBargeInWindow: [],
      interruptDiagnosticEnvironment: null,
      audioImplementation: '',
      lastAiAudioAt: 0,
      lastInterruptAt: 0,
      aiSpeakingStartTime: 0,   // AI 开口时刻，回声保护窗口起点
      sourceTitle: '',
      conversationLocale: '',
      contextArticleIds: [],
      contextAttachedMsg: '',
      confirmedArticle: null,
      articleReceiptRevision: 0,
      articleAttachTimer: null,
      resumeFromHistory: false, historyContinuation: false,
      historySessionId: '',
      historySessionUuid: '',
      openingGate: 'WAITING',
      openingBargeInOnly: false,
      openingAutomatic: false,
      openingTimer: null,
      realtimeSessionReady: false,
      realtimeUploadReady: false,
      openingSupported: false,
      openingContextReady: false,
      toolExecuting: false,
      turns: [],
      readPlayback: null,
      readProgressTimer: null,
      readingRevision: 0,
      streamQueue: '',
      citationCardsByTurn: {},
      activeCitation: null,
      streamTimer: null,
      streamQueueTurnSeq: 0,
      scrollTarget: '',
      chatFollowing: true,
      chatTouching: false,
      chatScrollTop: 0,
      chatRestoreTop: 0,
      chatScrollRevision: 0,
      chatMeasureRevision: 0,
      showListening: false,
      listeningLabel: t('companion.listeningNow'),
      // 字幕顺序保护：等待用户最终 ASR 期间暂存 AI 文字
      lastUserAsrFinalTurn: 0,   // 已 final 的用户 ASR 所属轮次
      pendingAiChunks: [],        // 缓冲的 AI 文字（等待该轮 ASR final）
      pendingAiFlushTimer: null,
      // 轮次状态机（服务端 turn_seq，从 1 开始每轮 +1）
      currentTurnSeq: 0,    // 当前活跃轮次，小于该值的帧视为过期丢弃
      activeAudioTurn: 0,   // 当前正在接收/播放的音频所属轮次
      activePlayedTurn: 0,  // 实际已送入播放器的最高轮次（用于识别迟到打断确认）
      activeResponseId: '',
      cancelledOutputTurnSeqs: {},
      cancelledResponseIds: {},
      waitingForNextResponseStart: false,
      lastInterruptTargetSeq: 0, // 客户端最近一次发送 interrupt 的目标轮次
      interruptEventSeq: 0,
      activeInterruptEventId: '',
      playbackGeneration: 0,
      audioUnavailableGeneration: 0,
      audioUnavailableTurnSeq: 0,
      bargeInArmedGeneration: 0,
      lastNativeBargeInTriggerId: '',
      // 音频尾音估算：用于 turn_complete 后仍保持可打断，直到音频真正播完
      audioTurnStartAt: 0,  // 当前轮音频开始时间戳
      audioTurnTotalMs: 0,  // 当前轮累计音频时长（估算）
      mediaPlaybackPending: false,
      mediaTurnCompleted: false,
      _audioDrainTimer: null
    }
  },
  watch: {
    readingPositionKey() { this.scrollToBottom() }
  },
  computed: {
    articleSource() { return this.confirmedArticle?.sessionId === this.sessionId && this.confirmedArticle?.title ? this.confirmedArticle : null },
    readingTurn() {
      void this.readingRevision
      const playback = this.readPlayback
      if (!playback || !playback.started || playback.cancelled || playback.drained || (!playback.native && (!playback.textFinal || !playback.settled))) return null
      if (playback.native) return [...playback.parts].reverse().find(part => part.estimatedReadingOffset !== undefined) || null
      return playback.parts.find(part => (part.playedTextLength || 0) < (part.displayText || part.text || '').length) || null
    },
    readingPositionKey() {
      const turn = this.readingTurn
      if (!turn) return ''
      const segments = this.spokenSegments(turn)
      const anchorIndex = segments.findIndex(seg => seg.anchor)
      return String(turn._key) + ':' + segments.slice(0, anchorIndex).reduce((length, seg) => length + (seg.value || seg.label || '').length, 0)
    },
    isEnglishUi() { return getUiLocale() === 'en-US' },
    quietEntry() { return ((!this.qaMode || this.qaQuiet) && !this.quietStarted) || this.routeInterrupted },
    showQuietVoiceStart() { return this.routeInterrupted || !this.globalVoiceAutoStart },
    quietCopy() {
      if (this.globalVoiceAutoStart && !this.routeInterrupted) {
        return { title: t('companion.voicePreparing'), subtitle: t('companion.quietAuto'), action: t('companion.voiceStart') }
      }
      if (getUiLocale() === 'zh-CN') return quietAudioCopy(this.outputRoute, this.routeInterrupted, true)
      const route = this.outputRoute?.kind
      const routeLabel = { speaker: 'listen.speaker', headphones: 'listen.headphones', external: 'listen.external' }[route] || 'listen.unknown'
      const connectedTitle = { headphones: 'listen.quietHeadphones', external: 'listen.quietExternal' }[route]
      return {
        title: t(this.routeInterrupted ? connectedTitle || 'companion.quietPaused' : 'companion.quietReady'),
        subtitle: t(this.routeInterrupted ? 'companion.quietContinue' : 'companion.quietPrivacy'),
        action: t(this.routeInterrupted ? 'companion.voiceResume' : 'companion.voiceStart') + ' · ' + t(routeLabel)
      }
    },
    lastConversationText() { return [...this.turns].reverse().find(turn => turn.role === 'user' && turn.text)?.text || this.sourceTitle || '' },
    voiceMotionState() {
      if (this.quietEntry) return 'paused'
      return resolveVoiceMotion({ control: this.controlState, presentation: this.companionPresentation, ended: this.ended,
        error: Boolean(this.errorMessage || this.roleErrorMessage), reconnecting: this.isReconnecting || Boolean(this.rolePending),
        thinking: this.toolExecuting || this.phase === 'THINKING' })
    },
    shortViewport() {
      const height = Number.parseFloat(this.pageChromeStyle['--chrome-content-viewport-height'])
      return height > 0 && height <= 420
    },
    fixedDocumentStyle() { return getPageDocumentStyle('pages/voice/call', Number.parseFloat(this.pageChromeStyle['--chrome-content-viewport-height'])) },
    formattedDuration() {
      const m = Math.floor(this.elapsedSeconds / 60).toString().padStart(2, '0')
      const s = (this.elapsedSeconds % 60).toString().padStart(2, '0')
      return `${m}:${s}`
    },
    isActive() {
      return this.companionPresentation.presentation === 'SPEAKING' && !this.ended && this.controlState.lifecycle !== 'paused'
    },
    displayTurns() { return this.turns },
    canSendText() { return (this.contextArticleIds.length === 0 || this.openingContextReady) && !this.ended && !this.submittingText && Boolean(this.inputText.trim()) && canSubmitCompanionText(this.controlState) },
    qaDiagnostics() { return JSON.stringify({ state: this.controlState, calls: this.qaCalls, memories: this.qaAdapter?.getMemories?.() || [], turns: this.turns, role: {confirmed: this.confirmedRoleCode, pending: this.rolePending} }) },
    confirmedRoleName() {
      if (getUiLocale() === 'en-US') return t('listen.role.' + this.confirmedRoleCode + '.name')
      return this.roleOptions.find(role => role.contentStyleCode === this.confirmedRoleCode)?.label || COMPANION_ROLE_OPTIONS.find(role => role.contentStyleCode === this.confirmedRoleCode)?.label || t('listen.role.NOVICE.name') },
    pendingRoleName() { if (getUiLocale() === 'en-US') return COMPANION_ROLE_CODES.includes(this.rolePending?.contentStyleCode) ? t('listen.role.' + this.rolePending.contentStyleCode + '.name') : t('companion.roleNewCompanion'); return this.roleOptions.find(role => role.contentStyleCode === this.rolePending?.contentStyleCode)?.label || t('companion.roleNewCompanion') },
    pendingRoleAvatar() { return `/static/companion/role-thumbnails/${COMPANION_ROLE_CODES.includes(this.rolePending?.contentStyleCode) ? this.rolePending.contentStyleCode : 'NOVICE'}.png` },
    roleDescription() {
      if (getUiLocale() === 'en-US') return t('listen.role.' + this.confirmedRoleCode + '.detail')
      const description = this.roleOptions.find(role => role.contentStyleCode === this.confirmedRoleCode)?.description
      return (typeof description === 'string' && description.trim()) || (COMPANION_ROLE_CODES.includes(this.confirmedRoleCode) ? t('companion.roleDescription.' + this.confirmedRoleCode) : '')
    },
    roleSelectionAvailable() { if (this.ended || this.destroyed) return false; if (this.quietEntry && !this.quietStarted) return this.roleOptions.length > 0; return Boolean((this.controlState.connected || this.rolePending || this.roleErrorMessage) && this.roleOptions.length > 0 && (this.qaMode || typeof this.socket?.requestRoleChange === 'function')) },
    rolePickerNotice() {
      if (this.roleCatalogError) return t(this.roleCatalogError)
      if (this.roleSubmissionError) return getUiLocale() === 'zh-CN' ? this.roleSubmissionError : t('companion.roleUnchanged')
      return this.roleErrorDisplayText || this.rolePendingText
    },
    rolePendingText() {
      if (!this.rolePending) return ''
      const name = this.pendingRoleName
      if (this.rolePending.phase === 'waiting') {
        return t('companion.roleWaiting', {name})
      }
      return t('companion.roleConnecting', {name})
    },
    roleErrorDisplayText() {
      if (!this.roleErrorMessage) return ''
      if (this.roleFailureReasonCode === 'ROLE_HISTORY_UNCONFIRMED') return t('companion.roleHistoryPending')
      if (this.roleFailureReasonCode === 'ROLE_CHANGE_UNSUPPORTED') return t('companion.roleUnsupported')
      return t('companion.roleFailed')
    },
    listeningVisible() { return this.showListening && this.pageVisible && !this.ended && this.controlState.connected && this.controlState.lifecycle === 'active' && this.controlState.captureActive && this.capturePermitted && !this.isReconnecting && !this.showVoicePicker && !this.showSpeakerConfirm && !this.showExitConfirm && !this.activeCitation },
    capturePermitted() { return (!this.control || this.controlState.desiredCapture) && !this.rolePending && !this.roleErrorMessage },
    connectionErrorDisplayText() {
      return getUiLocale() === 'en-US' ? t('companion.connectionFailed') : this.errorMessage
    },
    inlineErrorText() {
      const message = this.controlState.error?.message || this.errorMessage
      if (!this.isEnglishUi) return message
      if (this.controlState.error) return this.presentationTitle
      return /[\u3400-\u9fff]/u.test(message) ? t('companion.operationFailed') : message
    },
    presentationTitle() {
      if (this.ended) return t('companion.callEnded')
      if (this.roleErrorMessage) return t('companion.roleNotChanged')
      if (this.rolePending && this.rolePending.phase !== 'waiting') return t('companion.roleResuming')
      if (this.rolePending) return t('companion.rolePreparing')
      if (this.errorCode === 'UPSTREAM_DISCONNECTED') return t('companion.disconnected')
      if (this.controlState.error) return ({sendText: t('companion.textNotSent'), startCapture: t('companion.micNotStarted'), stopCapture: t('companion.micNotStopped'), setOutputPaused: t('companion.playbackActionFailed'), setVoiceOutputEnabled: t('companion.voiceOutputActionFailed'), setLocalOutputMuted: t('companion.muteActionFailed')})[this.controlState.error.operation] || t('companion.operationFailed')
      if (this.errorMessage) return t('companion.operationFailed')
      if (this.isReconnecting) return t('companion.reconnecting')
      if (this.quietEntry) return this.quietCopy.title
      if (this.backgroundSuspended && this.controlState.lifecycle === 'paused') return t('companion.paused')
      if (!this.controlState.connected || this.controlState.lifecycle === 'connecting') return t('companion.connect')
      if (this.controlState.lifecycle === 'paused') return t('companion.paused')
      if (this.controlState.inputMode === 'text' && !this.controlState.voiceOutput) return t('companion.textChat')
      if (this.audioUnavailableGeneration > 0 && this.audioUnavailableGeneration === this.playbackGeneration) return t('companion.textChat')
      if (this.toolExecuting || this.phase === 'THINKING') return t('companion.thinkingRole', { name: this.confirmedRoleName })
      if (this.isActive) return this.controlState.voiceOutput && this.controlState.systemOutputAvailable !== false ? t('companion.speakingRole', { name: this.confirmedRoleName }) : t('companion.answeringRole', { name: this.confirmedRoleName })
      if (!this.controlState.voiceOutput && this.companionPresentation.presentation === 'YOUR_TURN') return t('companion.answerDone')
      if (this.controlState.inputMode === 'text') return t('companion.write')
      if (this.companionPresentation.presentation === 'YOUR_TURN') return t('companion.yourTurn')
      return companionPresentationCopy(this.companionPresentation.presentation, getUiLocale())[0]
    },
    presentationSupportingText() {
      if (this.ended) return t('companion.callEndedHint')
      if (this.roleErrorMessage) return t('companion.roleRetryHint')
      if (this.rolePending && this.rolePending.phase !== 'waiting') return t('companion.roleResumeHint')
      if (this.rolePending) return t('companion.rolePrepareHint')
      if (this.errorCode === 'UPSTREAM_DISCONNECTED') return t('companion.disconnectedHint')
      if (this.controlState.error || this.errorMessage) return this.inlineErrorText
      if (this.isReconnecting) return t('companion.reconnectingHint')
      if (this.quietEntry) return this.quietCopy.subtitle
      if (this.backgroundSuspended && this.controlState.lifecycle === 'paused') return t('companion.pausedReconnectHint')
      if (!this.companionPresentation.socketConnected || !this.controlState.connected || this.controlState.lifecycle === 'connecting') return t('companion.connecting')
      if (this.controlState.lifecycle === 'paused') return this.controlState.inputMode === 'text' ? t('companion.pausedText') : t('companion.pausedVoice')
      if (this.controlState.systemOutputAvailable === false && this.controlState.requestedVoiceOutput !== false) {
        return this.controlState.displayMode === 'text' ? t('companion.mutedRaiseVolume') : t('companion.mutedReadOrListen')
      }
      if (this.audioUnavailableGeneration > 0 && this.audioUnavailableGeneration === this.playbackGeneration) return t('companion.audioTextOnly')
      if (this.toolExecuting) return t('companion.searching')
      if (this.phase === 'THINKING') return t('companion.thinking')
      if (this.controlState.inputMode === 'text' && !this.controlState.voiceOutput) return t('companion.textMuted')
      if (this.controlState.inputMode === 'text') return this.controlState.voiceOutput ? t('companion.muted') : t('companion.textMuted')
      if (!this.controlState.voiceOutput) return t('companion.micOnly')
      if (this.isActive) return t('companion.interrupt')
      if (this.companionPresentation.presentation === 'YOUR_TURN') return t('companion.yourTurnHint')
      return companionPresentationCopy(this.companionPresentation.presentation, getUiLocale())[1]
    },
    audioRouteLabel() {
      if (this.qaMode || typeof window !== 'undefined') return t('companion.standardDevice')
      if (!this.realtimeSessionReady) return t('companion.connect')
      if (!this.realtimeUploadReady) return t('companion.sessionPreparing')
      const route = String(this.audioRoute || '').toLowerCase()
      if (route.includes('bluetooth')) return t('companion.bluetoothConnected')
      if (route.includes('car')) return t('companion.carConnected')
      if (route.includes('headphone') || route.includes('headset')) return t('companion.headphonesConnected')
      return t('companion.deviceReady')
    }
  },
  async onLoad(options) {
    options = options || {}
    this._listenHandoffId = options.handoffId
    this.qaPageUrl = resolveCompanionQaPageUrl(options)
    this.qaMode = isCompanionQaEnabled(this.qaPageUrl)
    this.qaQuiet = this.qaMode && options.qaQuiet === '1'
    this.globalVoiceAutoStart = !this.qaMode && voiceMode.canAutoStart()
    const authQuery = Object.entries(options)
      .filter(([, value]) => value !== undefined && value !== '')
      .map(([key, value]) => `${key}=${encodeURIComponent(decodeRouteParam(value))}`).join('&')
    this.authReturnUrl = '/pages/voice/call' + (authQuery ? '?' + authQuery : '')
    if (!this.ensureCallAuthentication()) return
    this.syncPageChrome()
    const qaPreference = this.qaMode ? getCompanionQaRolePreference(this.qaPageUrl) : null
    this.rolePreferenceOwnerId = this.qaMode ? qaPreference?.ownerId || 0 : this.userStore?.memberId || 0
    this.qaRolePreferenceStorage = qaPreference ? markRaw(qaPreference.storage) : null
    this.confirmedRoleCode = resolveInitialCompanionRole(options.contentStyleCode, this.rolePreferenceOwnerId,
      this.qaMode ? this.qaRolePreferenceStorage : undefined)
    this.sourceTitle = decodeRouteParam(options.sourceTitle)
    this.conversationLocale = ['en-US', 'zh-CN'].includes(options.conversationLocale) ? options.conversationLocale : getUiLocale()
    this.contextArticleIds = normalizeArticleIds(decodeRouteParam(options.articleIds))
    if (this.qaMode) this.roleOptions = COMPANION_SELECTABLE_ROLE_CODES.map(code => ({ ...COMPANION_ROLE_OPTIONS.find(role => role.contentStyleCode === code) }))
    this.initControls()
    if (!this.qaMode) {
      this.control.pause()
      this._stopOutputRoute = audioOutputMonitor.subscribe((route, previous) => this.handleOutputRoute(route, previous))
      audioOutputMonitor.refresh()
    }
    if (this.qaMode) {
      this.qaVolumeControls = hasCompanionQaVolumeControls(this.qaPageUrl)
      const qaVolume = getCompanionQaVolume(this.qaPageUrl) ?? (this.qaVolumeControls ? 1 : null)
      if (qaVolume !== null) {
        this.qaCurrentVolume = qaVolume
        this.companionVolumeGate = markRaw(createCompanionVolumeGate(qaVolume,
          available => this.control.systemOutputAvailable(available)))
        this.observeCompanionVolume({volume: qaVolume, volumeContext: 'qa-speaker', audioActive: true})
      }
      if (options.qaPureText === '1') this.control.pureText()
      this.companionPresentation = runCompanionQaSequence(getCompanionQaEvents(this.qaPageUrl))
      this.voiceStore = markRaw({setStatus() {}, setMuted() {}, end() {}})
      this.sessionId = 'companion-qa-session'
      if (options.qaArticle === 'confirmed') {
        this.confirmedArticle = acceptArticleReceipt({session_uuid: this.sessionId, article_ids: ['123'], article_title: t('companion.qaArticle')}, this.sessionId, [])
        this.openingContextReady = true
      }
      this.quietEntryReady = true
      this.quietStarted = !this.qaQuiet
      this.outputRoute = normalizeOutputRoute({ kind: options.qaOutputRoute })
      this.routeInterrupted = options.qaDisconnected === '1'
      this.openingGate = 'SKIPPED'
      if (this.control) this.control.rebind()
      this.control.connected(this.sessionId)
      const requestedPresentation = {...this.companionPresentation, transcript: []}
      const transcript = this.companionPresentation.transcript || []
      this.companionPresentation = {...this.companionPresentation, transcript: []}
      transcript.forEach((turn, index) => this.handleTextDelta({...turn, turn_seq: 1, is_final: turn.role === 'user'}))
      this.flushStreamSlice()
      if (requestedPresentation.presentation !== 'SPEAKING') this.finishCurrentAiTurn()
      this.companionPresentation = requestedPresentation
      if (options.qaReadProgress) this.applyReadProgressQa(options.qaReadProgress)
      if (options.qaCitation === '1') {
        const turn = this.turns.find(item => item.role === 'assistant')
        if (turn) {
          turn.text = turn.displayText = t('companion.qaCitedAnswer')
          this.citationCardsByTurn = { [turn.turnSeq]: { 1: { title: t('companion.qaCitationTitle'), summary: t('companion.qaCitationSummary'), source: 'internal', url: '/article/1' } } }
        }
      }
      if (options.qaScroll === 'long') {
        this.turns = Array.from({ length: 12 }, (_, index) => {
          const text = t('companion.qaScrollLine', { count: index + 1 }) + t('companion.qaScrollBody').repeat(index === 11 ? 45 : 6)
          return { _key: nextKey(), role: index % 2 ? 'assistant' : 'user', companionRoleName: this.confirmedRoleName,
            text, displayText: text, streaming: false, completed: true, turnSeq: index + 1 }
        })
      }
      if (!this.companionPresentation.socketConnected) this.control.disconnected()
      if (this.companionPresentation.error) { this.errorMessage = t('companion.qaConnectionError'); this.errorCode = 'UPSTREAM_DISCONNECTED' }
      if (this.companionPresentation.ended) { this.ended = true; this.control.end() }
      if (this.qaQuiet || this.routeInterrupted) this.control.pause()
      this.scrollToBottom()
      return
    }
    this.interruptDiagnosticEnvironment = getInterruptDiagnosticEnvironment()
    this.historyContinuation = options.continuation === '1'
    this.resumeFromHistory = options.resumeFromHistory === '1'
    this.historySessionId = decodeRouteParam(options.historySessionId)
    this.historySessionUuid = decodeRouteParam(options.historySessionUuid)

    if (this.resumeFromHistory && !this.historyContinuation) {
      // A restored business session owns its articles; never use the global last-history cache.
      this.contextArticleIds = []
      this.sourceTitle = ''
    }

    // Article context was parsed before the QA/production branch.
    this.openingContextReady = this.contextArticleIds.length === 0
    this.voiceStore = useVoiceStore()
    this.userStore = useUserStore()
    try {
      applyMembershipStatusToStore(this.userStore, await fetchMembershipStatus())
    } catch (error) {
      console.warn('伴聊权益刷新失败，使用本机到期校验结果:', error && error.message)
    }
    if (!this.ensureCallAuthentication() || this.destroyed) return
    if (!isPlusMember(this.userStore.membership || this.userStore.userInfo)
      && !isAndroidWebRtcQaMembershipBypass()) {
      const query = Object.entries(options)
        .filter(([key, value]) => key !== 'entry' && value !== undefined && value !== '')
        .map(([key, value]) => `${key}=${encodeURIComponent(decodeRouteParam(value))}`)
      uni.redirectTo({ url: `/pages/voice/entry${query.length ? '?' + query.join('&') : ''}` })
      return
    }
    this.refreshRoleCatalog()
    this.quietEntryReady = true
    this.globalVoiceAutoStart = voiceMode.canAutoStart()
    if (this.historyContinuation) await this.beginContinuationText()
    else if (voiceMode.canAutoStart()) await this.beginQuietVoice({ automatic: true })
  },
  onHide() {
    this.pageVisible = false
    this._textEntryAttempt = null
    this.textEntryPending = false
    this.hideCitation(false)
    if (this.authRedirectPending) return
    if (this.qaMode) { this.control.disconnected(); return }
    resetH5PageChrome('pages/voice/call', this)
    this.showSpeakerConfirm = false
    if (this.quietStarted && !this.ended && !this.destroyed) this.suspendForBackground()
  },
  onShow() {
    if (!this.ensureCallAuthentication()) return
    // #ifdef H5
    if (typeof uni !== 'undefined') uni.setNavigationBarTitle?.({ title: t('companion.endLabel') })
    // #endif
    this.pageVisible = true
    this.openingNotes = false
    this.syncPageChrome()
    if (this.qaMode) { if (this.control) this.control.connected(this.sessionId); return }
    audioOutputMonitor.refresh()
    this.globalVoiceAutoStart = voiceMode.canAutoStart()
    if (this.ended) { this.openEndedSession(); return }
    if (this.destroyed) return
    if (this.quietStarted === false) {
      if (this.quietEntryReady && voiceMode.canAutoStart()) this.beginQuietVoice({ automatic: true })
      return
    }
    if ((!voiceMode.canAutoStart() && !this.historyContinuation) || this.routeInterrupted) {
      this.control.pause()
      this.openingFeedback = false
      this.feedbackPaused = false
      this.textHandoffPaused = false
      return
    }
    if (this.rolePending || this.roleErrorMessage) return
    if (this.controlState.lifecycle === 'paused') this.control.resume()
    if (this.textHandoffPaused && !this.routeInterrupted && !this.ended) { this.control.resume(); this.textHandoffPaused = false }
    this.openingFeedback = false
    if (this.feedbackPaused && !this.routeInterrupted) { this.control.resume(); this.feedbackPaused = false }
    if (this.backgroundSuspended) {
      this.resumeFromBackground()
      return
    }
    if (this.socket && typeof this.socket.setForeground === 'function') {
      this.socket.setForeground(true)
    }
    if (this.socket && this.socket.connected) {
      acquireScreenAwake('voice-call')
    }
  },
  onReady() {
    this.syncPageChrome()
    // #ifdef APP-PLUS
    this.$scope?.$getAppWebview?.()?.setStyle({ popGesture: 'none' })
    // #endif
    this.viewportListener = () => { if (this.pageVisible && !this.destroyed && !this.ended) this.syncPageChrome() }
    if (uni.onWindowResize) uni.onWindowResize(this.viewportListener)
    this.keyboardListener = event => {
      this.keyboardHeight = Math.max(0, Number(event.height) || 0)
      if (!this.pageVisible || this.destroyed || this.ended) return
      this.syncPageChrome()
      this.recordNativeGeometry('keyboard-event', event)
      this.$nextTick(() => {
        if (!this.pageVisible || this.destroyed || this.ended) return
        this.syncPageChrome()
        // #ifdef APP-PLUS
        // The route is a fixed single screen; undo input-focus outer scrolling
        // after its viewport contracts. Inner transcript scrolling is separate.
        if (this.showSpeakerConfirm) { this.showSpeakerConfirm = false; return true }
    if (this.keyboardHeight > 0) uni.pageScrollTo({scrollTop: 0, duration: 0, fail() {}})
        // #endif
      })
      clearTimeout(this.geometryTimer)
      this.geometryTimer = setTimeout(() => this.recordNativeGeometry('keyboard-settled', event), 300)
    }
    if (uni.onKeyboardHeightChange) uni.onKeyboardHeightChange(this.keyboardListener)
  },
  onBackPress(event = {}) {
    if (event.from === 'navigateBack' && this._returningToListening) return false
    if (this.keyboardHeight > 0) { uni.hideKeyboard(); return true }
    if (this.showVoicePicker) { this.showVoicePicker = false; return true }
    if (this.showExitConfirm) { this.resolveExitConfirmation(false); return true }
    if (this.showSpeakerConfirm) { this.cancelQuietResume(); return true }
    if (this.activeCitation) { this.hideCitation(); return true }
    if (this.authRedirectPending || !this.control) return false
    if (!this.ended) this.requestExit()
    else this.openEndedSession()
    return true
  },
  onUnload() {
    markListenHandoff(this._listenHandoffId, 'T2', 'cancelled')
    markListenHandoff(this._listenHandoffId, 'T3')
    this._textEntryAttempt = null
    this.textEntryPending = false
    this.resolveExitConfirmation(false)
    this.hideCitation(false)
    this._stopOutputRoute?.()
    this.showSpeakerConfirm = false
    resetH5PageChrome('pages/voice/call', this)
    this.destroyed = true
    if (this.control) this.control.end()
    if (this.viewportListener && uni.offWindowResize) uni.offWindowResize(this.viewportListener)
    if (this.keyboardListener && uni.offKeyboardHeightChange) uni.offKeyboardHeightChange(this.keyboardListener)
    clearTimeout(this.geometryTimer)
    this.releaseCall()
  },
  methods: {
    t,
    openSharePreview(draft) {
      try {
        setShareDraft(draft, useUserStore().memberId)
        uni.navigateTo({ url: '/pages/share/preview' })
      } catch (error) {
        uni.showToast({ title: t(error?.code === 'SHARE_SELECTION_REQUIRED' ? 'share.selectText' : 'share.unavailable'), icon: 'none' })
      }
    },
    handleOutputRoute(route, previous) {
      this.outputRoute = route
      this.globalVoiceAutoStart = !this.qaMode && voiceMode.canAutoStart()
      if (!this.quietStarted || this.ended || this.destroyed || !routeNeedsPause(previous, route)) return
      this.routeInterrupted = true
      this.showSpeakerConfirm = false
      this.control.pause()
      // Stop devices immediately; serialized reconciliation also preserves intent
      // through late readiness, background recovery and transport replacement.
      this.stopMicrophone()
      try {
        if (this.socket?.mediaManaged) Promise.resolve(this.socket.setPlaybackPaused(true)).catch(error => {
          if (!this.ended && !this.destroyed && !String(error.code || '').startsWith('PAUSE_')) this.errorMessage = error.message || t('companion.pauseFailed')
        })
        else this.player?.setPaused(true)
      } catch (error) { this.errorMessage = error.message || t('companion.pauseUpdate') }
    },
    async beginContinuationText() {
      if (!this.historyContinuation || this.quietStarted || this.destroyed || !this.pageVisible) return
      // Explicit history continuation starts with keyboard input, without changing the global voice preference.
      this.control.input('text')
      this.control.view('text')
      this.control.output(voiceMode.canAutoStart())
      this.quietStarted = true
      this.control.resume()
      await this.startCall()
    },
    async beginQuietVoice(options = {}) {
      if (!this.quietEntryReady || this.voiceStarting || this.textEntryPending || !this.pageVisible || this.destroyed || this.ended) return
      if (options.automatic === true && !voiceMode.canAutoStart()) return
      if (options.automatic !== true && !this.qaMode) voiceMode.choose(true)
      this.showSpeakerConfirm = false
      this.routeInterrupted = false
      this.voiceStarting = true
      try {
        this.control.resume()
        if (!this.quietStarted) {
          this.quietStarted = true
          if (!this.qaMode) await this.startCall()
        } else if (this.backgroundSuspended) await this.resumeFromBackground()
        else if (!this.socket?.connected) await this.startCall({ resume: true })
      } finally { this.voiceStarting = false }
    },
    cancelQuietResume() { this.showSpeakerConfirm = false; if (!this.qaMode) voiceMode.choose(false) },
    confirmQuietResume() {
      this.showSpeakerConfirm = false
      if (!this.pageVisible || this.ended || this.destroyed) return
      if (!this.qaMode) voiceMode.choose(true)
      if (this.backgroundSuspended) return this.beginQuietVoice()
      this.control.resume()
    },
    async beginQuietText() {
      if (!this.quietEntryReady || this.voiceStarting || this.textEntryPending || !this.pageVisible || this.destroyed || this.ended) return
      if (this.sessionId) { await this.switchToText(); return }
      // Resolve a missing article title before handing off; a recap title is never fabricated here.
      const articleId = this.contextArticleIds[0]
      const owner = useUserStore().memberId
      const attempt = {}
      this._textEntryAttempt = attempt
      this.textEntryPending = true
      const current = () => this._textEntryAttempt === attempt && this.pageVisible && !this.destroyed && !this.ended
        && owner === useUserStore().memberId && articleId === this.contextArticleIds[0]
      let contextFailed = false
      try {
        let title = String(this.sourceTitle || '').trim()
        if (articleId && !title) {
          contextFailed = true
          const response = await get(API_PATHS.FEED_DETAIL.replace('{id}', encodeURIComponent(articleId)), {}, { timeout: 8000 })
          if (!current()) return
          const feed = response?.data
          if (!['0', '200'].includes(String(response?.code)) || String(feed?.id) !== String(articleId)
            || typeof feed?.title !== 'string' || !feed.title.trim()) throw new Error('Invalid article context')
          title = feed.title.trim()
          this.sourceTitle = title
          contextFailed = false
        }
        if (!current()) return
        const query = articleId ? JSON.stringify({ id: articleId, title }) : ''
        await new Promise((resolve, reject) => uni.navigateTo({
          url: '/pages/create/create' + (query ? '?query=' + encodeURIComponent(query) : ''), success: resolve, fail: reject
        }))
      } catch (_) {
        if (current()) uni.showToast({ title: t(contextFailed ? 'companion.textContextFailed' : 'companion.textOpenFailed'), icon: 'none' })
      } finally {
        if (this._textEntryAttempt === attempt) { this._textEntryAttempt = null; this.textEntryPending = false }
      }
    },
    ensureCallAuthentication() {
      if (this.qaMode) return true
      this.userStore = useUserStore()
      if (!isAndroidBasicMode() && (this.userStore.isAuthenticated || this.userStore.isMock)) {
        this.authRedirectPending = false
        return true
      }
      if (!this.authRedirectPending) {
        this.authRedirectPending = true
        if (this.control) this.control.end()
        if (this.socket || this.recorder || this.player) this.releaseCall()
        uni.redirectTo({ url: buildAuthLoginUrl(this.authReturnUrl || '/pages/voice/call') })
      }
      return false
    },
    initControls() {
      const adapter = this.qaMode ? createCompanionQaAdapter({
        url: this.qaPageUrl,
        initialContentStyleCode: this.confirmedRoleCode,
        onRoleEvent: (type, event) => this.handleRoleEvent(type, event),
        initialTurnSeq: getCompanionQaEvents(this.qaPageUrl).some(event => ['user_partial', 'user_final', 'ai_text_delta', 'ai_audio_delta'].includes(typeof event === 'string' ? event : event.type)) ? 1 : 0,
        onCitation: event => this.handleCitationCards(event),
        onText: event => this.handleTextDelta(event),
        onInterrupted: event => this.handleAudioInterrupted(event),
        onCalls: calls => { this.qaCalls = [...calls] },
        onComplete: () => { if (this.ended) return; this.flushStreamSlice(); this.finishCurrentAiTurn(); this.applyCompanionEvent({type: 'turn_complete'}); this.applyCompanionEvent({type: 'audio_drained'}) }
      }) : {
        startCapture: () => this.startMicrophone({bargeInOnly: ['SPEAKING', 'DRAINING'].includes(this.openingGate)}),
        // Keyboard input mutes immediately; native AOQ closes the capture device
        // after the current reply drains so the shared VoIP renderer stays stable.
        stopCapture: () => this.stopMicrophone({
          preservePlayback: this.controlState.inputMode === 'text'
            && this.controlState.requestedVoiceOutput !== false
            && !this.controlState.pureTextActive
            && this.controlState.lifecycle === 'active'
        }),
        setVoiceOutputEnabled: async enabled => {
          if (!enabled) this.cancelReadProgress()
          let result
          if (this.socket && this.socket.mediaManaged) result = await this.socket.setVoiceOutputEnabled(enabled)
          else if (this.player) result = await this.player.setOutputEnabled(enabled)
          if (result === false) return false
          if (!enabled) {
            this._clearAudioDrainTimer()
            this.audioTurnStartAt = 0
            this.audioTurnTotalMs = 0
            this.mediaPlaybackPending = false
            if (this.mediaTurnCompleted) this.setListeningState()
          }
          return result
        },
        cancelPendingPause: reason => this.socket?.cancelPlaybackPause?.(reason),
        setOutputPaused: paused => {
          // Route transitions release the old player. Rebind applies pause intent to the new session.
          if (this.backgroundSuspended || this.resumingFromBackground) return { deferred: true }
          if (this.socket && this.socket.mediaManaged) return this.socket.setPlaybackPaused(paused)
          if (this.player) return this.player.setPaused(paused)
        },
        setLocalOutputMuted: muted => {
          if (this.socket && this.socket.mediaManaged && this.socket.setLocalOutputMuted) return this.socket.setLocalOutputMuted(muted)
          // Older PCM playback keeps model generation unchanged and safely drops
          // local audio when it cannot apply a renderer-level mute.
          if (this.player?.setOutputEnabled) return this.player.setOutputEnabled(!muted && this.controlState.requestedVoiceOutput !== false)
          return true
        },
        sendText: (text, id) => {
          if (!this.socket || !this.socket.sendUserText) throw new Error(t('companion.textUnsupported'))
          return this.socket.sendUserText(text, id)
        },
        endSession: () => this.releaseCall()
      }
      if (this.qaMode) this.qaAdapter = markRaw(adapter)
      this.control = markRaw(createCompanionController(adapter, state => {
        this.controlState = {...state}
        this.muted = !state.desiredCapture
        if (state.error) { this.controlErrorMessage = state.error.message; this.errorMessage = state.error.message }
        else if (this.controlErrorMessage) {
          if (this.errorMessage === this.controlErrorMessage) this.errorMessage = ''
          this.controlErrorMessage = ''
        }
        if (this.voiceStore) this.voiceStore.setMuted(this.muted)
      }))
    },
    recordNativeGeometry(reason, keyboardEvent = {}) {
      if (import.meta.env.VITE_COMPANION_GEOMETRY_DIAGNOSTICS !== 'true' || !this.pageVisible || this.destroyed || this.ended) return
      let windowInfo = {}, appInfo = {}, webviewStyle = {}, immersed = null
      try { windowInfo = uni.getWindowInfo ? uni.getWindowInfo() : uni.getSystemInfoSync() } catch (_) {}
      try { appInfo = uni.getAppBaseInfo ? uni.getAppBaseInfo() : {} } catch (_) {}
      // #ifdef APP-PLUS
      try {
        const webview = this.$scope && this.$scope.$getAppWebview ? this.$scope.$getAppWebview() : null
        webviewStyle = webview ? webview.getStyle() : {}
        immersed = plus.navigator.isImmersedStatusbar()
      } catch (_) {}
      // #endif
      const record = {
        action: 'geometry', reason, keyboardHeight: keyboardEvent.height || 0,
        screenHeight: windowInfo.screenHeight, windowHeight: windowInfo.windowHeight,
        windowTop: windowInfo.windowTop, windowBottom: windowInfo.windowBottom,
        statusBarHeight: windowInfo.statusBarHeight, safeArea: windowInfo.safeArea,
        safeAreaInsets: windowInfo.safeAreaInsets, immersed,
        runtimeVersion: appInfo.SDKVersion, appVersion: appInfo.appVersion,
        webview: {top: webviewStyle.top, height: webviewStyle.height, softinputMode: webviewStyle.softinputMode},
        processedStyle: {...this.pageChromeStyle}
      }
      const query = uni.createSelectorQuery().in(this)
      query.selectAll('.call-page, .call-header, .call-controls, .role-entry, .top-action').boundingClientRect()
      query.exec(results => {
        if (this.destroyed || this.ended) return
        record.bounds = results[0]
        if (this.socket && typeof this.socket.trace === 'function') this.socket.trace(record)
        else console.info('[CompanionGeometry]', JSON.stringify(record))
      })
    },
    recordHeaderAction(control, event) {
      const point = event?.changedTouches?.[0] || event?.touches?.[0] || event?.detail || {}
      const record = {
        action: 'header_action', control, eventType: event?.type || '',
        targetId: event?.target?.id || '', currentTargetId: event?.currentTarget?.id || '',
        x: point.clientX ?? point.x ?? null, y: point.clientY ?? point.y ?? null,
        displayMode: this.controlState.displayMode, rolePickerVisible: this.showVoicePicker
      }
      const emit = value => {
        if (this.socket && typeof this.socket.trace === 'function') this.socket.trace(value)
        else console.info('[CompanionHeader]', JSON.stringify(value))
      }
      emit(record)
      // Query the rendered hit regions after the tap; no model/user content is recorded.
      this.$nextTick(() => {
        if (!this.pageVisible || this.destroyed || this.ended) return
        const query = uni.createSelectorQuery().in(this)
        query.selectAll('.role-entry, .top-action').boundingClientRect()
        query.exec(result => {
          if (this.pageVisible && !this.destroyed && !this.ended) emit({ ...record, action: 'header_hit_regions', bounds: result[0] })
        })
      })
    },
    toggleDisplay(event) {
      this.recordHeaderAction('display', event)
      this.chatRestoreTop = this.chatScrollTop
      this.scrollTarget = ''
      this.chatScrollRevision += 1
      this.chatMeasureRevision += 1
      this.chatTouching = false
      this.control.view(this.controlState.displayMode === 'avatar' ? 'text' : 'avatar')
      if (this.controlState.displayMode === 'text' && this.readingTurn) this.chatFollowing = true
      this.scrollToBottom()
    },
    async openRolePicker(event) {
      this.recordHeaderAction('role', event)
      uni.hideKeyboard?.()
      this.showVoicePicker = true
      if (this.qaMode || this.roleOptions.length) return
      await this.refreshRoleCatalog()
    },
    async refreshRoleCatalog() {
      if (this.qaMode || this.destroyed || this.ended) return
      if (this._roleCatalogPromise) return this._roleCatalogPromise
      this.roleCatalogError = ''
      this._roleCatalogPromise = this.fetchRoleCatalog()
      try { await this._roleCatalogPromise }
      finally { this._roleCatalogPromise = null }
    },
    async fetchRoleCatalog() {
      try {
        const catalog = await loadCompanionRoles()
        if (this.destroyed || this.ended) return
        this.roleOptions = catalog.roles
        if (this.socket && typeof this.socket.requestRoleChange !== 'function') this.roleCatalogError = 'companion.roleUnsupported'
      } catch (error) {
        this.socket?.trace?.({ action: 'role_catalog_load_failed', code: error.code, message: String(error.message || '').slice(0, 120) })
        if (!this.destroyed && !this.ended) this.roleCatalogError = 'companion.roleCatalogFailed'
      }
    },
    async selectCompanionRole(code) {
      if (!this.roleOptions.some(role => role.contentStyleCode === code)) return
      if (this.quietStarted === false && !this.qaMode) {
        this.confirmedRoleCode = code
        this.rememberCompanionRole(code)
        this.showVoicePicker = false
        return
      }
      if (!this.roleSelectionAvailable || this.roleSubmitBusy) return
      this.roleSubmitBusy = true
      this.roleCatalogError = ''
      this.roleSubmissionError = ''
      // Keep a failed handoff blocked until an authoritative role event recovers it.
      try {
        const transport = this.qaMode ? this.qaAdapter : this.socket
        const accepted = await transport.requestRoleChange(code)
        if (accepted !== true) throw new Error(t('companion.roleStartLater'))
        if (!this.rolePending && code === this.confirmedRoleCode) this.rememberCompanionRole(code)
        this.showVoicePicker = false
      } catch (error) {
        this.socket?.trace?.({ action: 'role_change_submit_failed', code: error.code, message: String(error.message || '').slice(0, 120) })
        if (!this.ended && !this.destroyed && !this.roleErrorMessage && !this.rolePending) {
          this.failedRoleCode = code
          this.roleSubmissionError = error.message || t('companion.roleStartFailed')
        }
      } finally { this.roleSubmitBusy = false }
    },
    handleRoleEvent(type, event = {}) {
      if (this.ended || this.destroyed) return
      if (type === 'role_pending') {
        this.roleSubmissionError = ''
        this.rolePending = {...event}
        this.roleErrorMessage = ''; this.roleFailureReasonCode = ''; this.errorMessage = ''
        this.failedRoleCode = event.contentStyleCode || ''
        this.toolExecuting = false
        this.mediaPlaybackPending = false
        this.applyCompanionEvent({ type: 'role_handoff' })
        this.control?.disconnected()
      }
      else if (type === 'role_applied') {
        const code = event.contentStyleCode || event.role?.contentStyleCode
        if (COMPANION_ROLE_CODES.includes(code)) {
          this.confirmedRoleCode = code
          if (this.rolePending?.contentStyleCode === code) this.rememberCompanionRole(code)
        }
        this.rememberCompanionContext()
        this.roleErrorMessage = ''
        this.roleFailureReasonCode = ''
        this.roleSubmissionError = ''
        this.failedRoleCode = ''
        if (!this.rolePending || this.rolePending.contentStyleCode === code) this.rolePending = null
        if (this.qaMode && this.control) this.control.connected(this.sessionId)
      } else if (type === 'role_failed') {
        // Rejected submissions never retired the current connection. Preserve
        // its pause/media state and any handoff already in progress.
        if (event.code === 'ROLE_NOT_READY' || event.code === 'INVALID_ROLE') {
          this.roleSubmissionError = event.message || t('companion.roleStartFailed')
          if (!this.rolePending && !this.roleErrorMessage) this.failedRoleCode = event.contentStyleCode || ''
          return
        }
        this.roleSubmissionError = ''
        this.rolePending = null
        this.failedRoleCode = event.contentStyleCode || this.failedRoleCode
        this.isReconnecting = false
        this.control?.disconnected()
        this.socket?.trace?.({ action: 'role_change_failed_ui', code: event.code, message: String(event.message || '').slice(0, 120) })
        this.roleFailureReasonCode = event.reasonCode || event.code || ''
        this.roleErrorMessage = event.message || t('companion.roleRetained')
      }
    },
    retryRoleChange() { if (this.failedRoleCode) return this.selectCompanionRole(this.failedRoleCode) },
    toggleInput() {
      this.control.input(this.controlState.inputMode === 'voice' ? 'text' : 'voice')
    },
    togglePause() {
      this.feedbackPaused = false
      // The entry action already authorizes the current speaker route. Ask again
      // only after an actual output-route interruption, never after manual pause.
      if (this.controlState.lifecycle === 'paused' && this.routeInterrupted && ['speaker', 'unknown'].includes(this.outputRoute.kind) && (!this.qaMode || this.qaQuiet)) { this.showSpeakerConfirm = true; return }
      const resume = this.controlState.lifecycle === 'paused'
      if (!this.qaMode) voiceMode.choose(resume)
      if (resume && this.backgroundSuspended) return this.beginQuietVoice()
      if (resume) this.control.resume()
      else this.control.pause()
    },
    async retryControlOperation() {
      if (this.retryingControl || this.ended || this.destroyed) return
      this.retryingControl = true
      try {
        if (this.controlState.error?.operation === 'sendText') await this.submitText()
        else await this.control.retryEffects()
      } finally { this.retryingControl = false }
    },
    async submitText(event = {}) {
      // App IME may deliver confirm before the last v-model input packet.
      // Its final value is authoritative; button taps retain the current draft.
      if (event.detail && typeof event.detail.value === 'string') this.inputText = event.detail.value
      if (!this.canSendText) return
      const text = this.inputText.trim()
      // Disable the platform's default 140-character truncation; validate explicitly.
      if (text.length > 4000) {
        this.errorMessage = t('companion.textTooLong')
        return
      }
      if (this.errorMessage === t('companion.textTooLong')) this.errorMessage = ''
      this.submittingText = true
      try {
        const accepted = await this.control.submit(text)
        if (!accepted) return
        if (this.inputText.trim() === text) this.inputText = ''
      } catch (error) { this.errorMessage = error.message || t('companion.sendFailed') }
      finally { this.submittingText = false }
    },
    syncPageChrome() {
      if (!this.pageVisible || this.destroyed) return
      const chrome = applyPageChrome('pages/voice/call', {}, this)
      // #ifdef APP-PLUS
      if (!this.keyboardBaselineHeight || (!this.inputFocused && !this.keyboardHeight)) {
        this.keyboardBaselineHeight = chrome.contentViewportHeight
      }
      const height = resolveKeyboardContentViewportHeight(chrome.contentViewportHeight, this.keyboardBaselineHeight, this.keyboardHeight)
      chrome.style['--chrome-content-viewport-height'] = `${height}px`
      // The contracted viewport owns the keyboard avoidance; no footer offset.
      chrome.style['--chrome-keyboard-overlap'] = '0px'
      // #endif
      this.pageChromeStyle = chrome.style
      // #ifdef APP-PLUS
      if (typeof plus !== 'undefined' && /ios/i.test(plus.os.name)) this.$nextTick(() => this.measureNativeViewport())
      // #endif
    },
    measureNativeViewport() {
      if (this.viewportMeasurePending || !this.pageVisible || this.destroyed || this.ended) return
      this.viewportMeasurePending = true
      const query = uni.createSelectorQuery().in(this)
      query.selectViewport().boundingClientRect()
      query.select('.call-page').boundingClientRect()
      query.exec(results => {
        this.viewportMeasurePending = false
        if (!this.pageVisible || this.destroyed || this.ended) return
        const viewport = results[0], root = results[1], height = Number(root?.height)
        if (!Number.isFinite(height) || height <= 0) return
        let info = {}, webviewStyle = {}, immersed = null
        try { info = uni.getWindowInfo ? uni.getWindowInfo() : uni.getSystemInfoSync() } catch (_) {}
        try {
          const webview = this.$scope?.$getAppWebview?.()
          webviewStyle = webview?.getStyle?.() || {}
          immersed = plus.navigator.isImmersedStatusbar()
        } catch (_) {}
        const record = { action: 'viewport_geometry',
          reason: `window_${info.windowHeight || 0}_root_${height}_viewport_${viewport?.height || 0}`,
          screenHeight: info.screenHeight, windowHeight: info.windowHeight,
          windowTop: info.windowTop, windowBottom: info.windowBottom,
          statusBarHeight: info.statusBarHeight, safeArea: info.safeArea, safeAreaInsets: info.safeAreaInsets,
          immersed, webview: webviewStyle, root, viewport, processedStyle: { ...this.pageChromeStyle } }
        if (this.socket?.trace) this.socket.trace(record)
        else console.info('[CompanionViewport]', JSON.stringify(record))
        // The fixed root measures the actual render window. Never subtract a guessed status-bar height.
        this.pageChromeStyle = { ...this.pageChromeStyle, '--chrome-content-viewport-height': `${height}px` }
        if (!this.inputFocused && !this.keyboardHeight) this.keyboardBaselineHeight = height
      })
    },
    onTextInputFocus() {
      this.inputFocused = true
      this.syncPageChrome()
    },
    onTextInputBlur() {
      this.inputFocused = false
      this.syncPageChrome()
    },
    applyCompanionEvent(event) {
      this.companionPresentation = reduceCompanionPresentation(this.companionPresentation, event)
    },
    openMyNotes() {
      if (this.openingNotes || this.destroyed) return
      this.openingNotes = true
      uni.hideKeyboard?.()
      const fail = () => {
        this.openingNotes = false
        uni.showToast({ title: t('companion.notesOpenFailed'), icon: 'none' })
      }
      // Push onto the current stack: notes can return to this exact call instance.
      // onHide/onShow own the existing audio suspension and recovery lifecycle.
      const url = '/pages/history/companion' + (this.qaMode ? '?aiHistoryQa=1&scenario=companion-notes' : '')
      try { uni.navigateTo({ url, fail }) } catch (_) { fail() }
    },
    openProductFeedback() {
      if (this.ended || this.openingFeedback) return
      this.openingFeedback = true
      const pausedForNavigation = !this.muted && this.controlState.lifecycle !== 'paused'
      if (!this.muted && this.controlState.lifecycle !== 'paused') { this.control.pause(); this.feedbackPaused = true }
      const sourceRef = String(this.qaMode ? 'qa-companion' : (this.sessionId || '')).replace(/[^A-Za-z0-9._:-]/g, '').slice(0, 128)
      const feedbackUrl = `/pages/mine/feedback?${this.qaMode ? 'qaFeedback=1&scenario=form-current-filled&' : ''}mode=CURRENT_PAGE&sourceRoute=${encodeURIComponent('pages/voice/call')}&sourceTitle=${encodeURIComponent(t('feedback.companion'))}&sourceRef=${encodeURIComponent(sourceRef)}`
      if (this.qaMode && typeof window !== 'undefined') {
        window.location.href = `${window.location.origin}${window.location.pathname}?qa=companion-feedback#${feedbackUrl}`
        return
      }
      const fail = () => {
        this.openingFeedback = false
        if (pausedForNavigation && this.feedbackPaused && this.controlState.lifecycle === 'paused' && !this.ended && !this.destroyed && this.pageVisible && !this.routeInterrupted && !this.rolePending && !this.roleErrorMessage) this.control.resume()
        this.feedbackPaused = false
        uni.showToast({ title: t('feedback.openFailed'), icon: 'none' })
      }
      try { uni.navigateTo({ url: feedbackUrl, fail }) } catch (_) { fail() }
    },
    // ==================== 通话生命周期 ====================

    closeSubscribeGuide() {
      this.showSubscribeGuide = false
      this.goBack()
    },

    onSubscribePaid() {
      this.showSubscribeGuide = false
      if (isPlusMember(this.userStore.membership || this.userStore.userInfo)) {
        this.quietEntryReady = true
      }
    },

    async startCall(options = {}) {
      if (!this.ensureCallAuthentication()) return
      if (this.quietStarted === false && !this.qaMode) return
      const resume = options.resume === true
      const memberId = this.userStore.memberId
      if (!memberId) { this.fail(t('companion.signInAgain')); return }
      if (!resume) this.voiceStore.begin()
      this.phase = 'AUTHORIZING'
      try {
        if (!resume) {
          this.companionVolumeGate?.dispose()
          this.companionVolumeGate = markRaw(createCompanionVolumeGate(readCompanionEntryVolume(),
            available => this.control.systemOutputAvailable(available)))
        }
        if (!resume && this.controlState.inputMode === 'voice') await this.requestMicrophonePermission()
        if (!this.ensureCallAuthentication() || this.destroyed || this.pageVisible === false) return
        if (!resume) {
          const listeningReleased = await getAudioPlayer().stopAllAndWait()
          if (!listeningReleased) throw new Error(t('companion.listeningReleaseFailed'))
        }
        if (!this.ensureCallAuthentication() || this.destroyed || this.pageVisible === false) return
        requestAndroidNotificationPermission()
        this.phase = 'CONNECTING'
        // Transport/controller instances own sockets, timers and Maps. Keeping
        // them raw prevents Vue from proxying nested socket identity/state.
        const resumeState = resume && this.socket?.getResumeState?.()
        this.socket = markRaw(createRealtimeTransport(false, this.historyContinuation, resumeState))
        this.transportMode = this.socket instanceof RealtimeConnectionController ? 'v2' : 'v1'
        if (this.socket.mediaManaged === true) {
          this.transportMode = this.socket.kind || 'webrtc'
          this.nativeVoiceSession = null
          this.recorder = new WebRtcRecorder(this.socket)
          this.player = new WebRtcPlayer()
        } else {
          const nativeSessionStatus = await nativeAudio.startVoiceSession(
            event => this.handleNativeAudioEvent(event)
          )
          this.nativeVoiceSession = nativeAudio.createVoiceSession(
            nativeSessionStatus && nativeSessionStatus.sessionGeneration
          )
          this.recorder = new PcmRecorder(this.nativeVoiceSession)
          this.player = new PcmPlayer(this.nativeVoiceSession)
        }
        if (this.destroyed || this.pageVisible === false) {
          this.stopNativeVoiceSession()
          return
        }
        this.control.rebind()
        this.bindSocketEvents()
        // V2 readiness and one-time fallback are owned by ConnectionController.
        // Keeping a second page timer can destroy a healthy call when iOS misses
        // only the first session_ready frame but receives later transport frames.
        if (this.transportMode === 'v1') this._armSessionReadyWatchdog()
        await this.socket.connect(memberId, {
          sessionId: resume ? this.sessionId : (this.resumeFromHistory ? this.historySessionUuid : ''),
          requiredSessionId: this.historyContinuation ? this.historySessionUuid : '',
          contextArticleIds: this.contextArticleIds,
          conversationLocale: this.conversationLocale,
          contentStyleCode: this.confirmedRoleCode,
          proactiveOpening: !resume,
          muted: this.controlState.inputMode !== 'voice' || this.controlState.lifecycle === 'paused',
          voiceOutputEnabled: this.controlState.voiceOutput,
          localOutputMuted: this.controlState.systemOutputAvailable === false,
          entryOutputVolume: this.companionVolumeGate?.entryVolume,
          playbackPaused: this.controlState.lifecycle === 'paused'
        })
      } catch (error) {
        this.fail(error.message || t('companion.connectionFailed'))
      }
    },

    requestMicrophonePermission() { return requestMicrophonePermission() },

    // ==================== WebSocket 事件 ====================

    bindSocketEvents() {
      this.fallbackVolumeObserver?.dispose()
      this.fallbackVolumeObserver = null
      this.nativeVolumeEventsSeen = false
      const transport = this.socket
      const on = (name, handler) => transport.on(name, event => {
        if (this.socket !== transport || this.ended || this.destroyed) return
        handler(event)
      })
      this.unsubscribers.push(
        on('output_volume', event => {
          this.nativeVolumeEventsSeen = true
          this.fallbackVolumeObserver?.dispose(); this.fallbackVolumeObserver = null
          this.observeCompanionVolume(event)
        }),
        on('role_pending', event => this.handleRoleEvent('role_pending', event)),
        on('role_applied', event => this.handleRoleEvent('role_applied', event)),
        on('role_failed', event => this.handleRoleEvent('role_failed', event)),
        on('fallback_required', event => this._fallbackToLegacy(event)),
        on('recovery_failed', event => {
          this.transportRecoveryState = 'FAILED'
          this.upstreamRecoveryState = 'IDLE'
          this.isReconnecting = false
          if (event.outcome === 'timeout') markListenHandoff(this._listenHandoffId, 'T2', 'timeout')
          const reason = event.code === 'NATIVE_VOICE_CONNECTION_FAILED' ? '' : event.reason
          this.fail(reason || t('companion.resumeCallFailed'))
        }),
        on('session_ready', event => {
          if (this.historyContinuation && !continuationSessionMatches(this.historySessionUuid, event)) {
            this.handleError({ code: 'CONTEXT_ATTACH_FAILED', message: t('notesList.resumeFailed') })
            this.socket?.close?.()
            return
          }
          this.errorCode = ''; this.errorMessage = ''
          this.applyCompanionEvent({ type: 'clear_error' })
          this._clearSessionReadyWatchdog()
          this.sessionId = event.session_uuid || ''
          if (import.meta.env.VITE_LOCAL_EPOCH_RESTART_QA === 'true') rememberEpochRestartQa(this.userStore.memberId, this.sessionId)
          if (event.role?.contentStyleCode) this.handleRoleEvent('role_applied', {role: event.role})
          if (!this.contextArticleIds.length && !this.resumeFromHistory) this.rememberCompanionContext()
          this.control.connected(this.sessionId)
          this.startFallbackVolumeObservation()
          const nextTurnSeq = Number(event.next_turn_seq || 0)
          if (nextTurnSeq > 0) this.currentTurnSeq = nextTurnSeq
          this.voiceStore.setReady(this.sessionId)
          this.realtimeSessionReady = true
          this.openingSupported = event.opening_supported === true
          this.openingAutomatic = event.opening_automatic === true
          if (this.resumingFromBackground) {
            this.openingGate = 'SKIPPED'
      if (this.control) this.control.rebind()
            this._armResumeReadyWatchdog()
            return
          }
          if (this.resumeFromHistory && event.resumed !== true) {
            this.handleError({code: 'CONTEXT_ATTACH_FAILED', message: t('companion.resumeFromNotes')})
            this.socket?.close?.()
            return
          }
          if (this.openingSupported) this.requestProactiveOpening()
          else this.handleOpeningSkipped({ message: t('companion.openingUnsupported') })
        }),
        on('upload_ready', () => {
          this.realtimeUploadReady = true
          this.control.connected(this.sessionId)
          this._clearResumeReadyWatchdog()
          if (this.ended || this.destroyed) return
          this.control.rebind()
          if (this.resumingFromBackground) {
            this._completeBackgroundResume()
            return
          }
          if (this.fallbackAwaitingContext) return
          if (['DONE', 'SKIPPED'].includes(this.openingGate)) this.startMicrophone()
        }),
        on('open', () => {
          if (this.ended || this.destroyed) return
          this.realtimeUploadReady = false
          this.applyCompanionEvent({ type: 'socket_open' })
          acquireScreenAwake('voice-call')
          this.startDurationTimer()
          // 带文章进入时先等服务端确认上游 instructions 已生效，避免第一问抢跑。
          if (this.contextArticleIds.length > 0) {
            this.phase = 'CONNECTING'
            this.voiceStore.setStatus(this.phase)
            this.sendContextAttach()
          } else if (!this.resumingFromBackground) {
            this.requestProactiveOpening()
          }
        }),
        on('opening_started', event => this.handleOpeningStarted(event)),
        on('opening_skipped', event => this.handleOpeningSkipped(event)),
        on('text_delta', event => this.handleTextDelta(event)),
        on('safety_withdrawn', event => {
          const seq = Number(event.turn_seq || 0)
          const earlierTurn = seq < this.currentTurnSeq
          const safetyBlocked = ['CONTENT_BLOCKED', 'CONTENT_REVIEW_REQUIRED', 'CONTENT_TURN_WITHDRAWN'].includes(event.code)
          this.pendingAiChunks = this.pendingAiChunks.filter(chunk => chunk.turnSeq !== seq)
          if (this.streamQueueTurnSeq === seq) { this.streamQueue = ''; this.streamQueueTurnSeq = 0 }
          this.turns = this.turns.filter(turn => turn.turnSeq !== seq)
          if (seq >= this.currentTurnSeq) this.handleAudioInterrupted(event)
          const messageKey = !safetyBlocked ? 'companion.safetyCheckUnavailable'
            : earlierTurn ? 'companion.safetyEarlierWithdrawn'
              : event.direction === 'USER_INPUT' ? 'companion.safetyInputWithdrawn' : 'companion.safetyReplyWithdrawn'
          if (messageKey === 'companion.safetyInputWithdrawn') {
            uni.showModal({
              title: t('companion.safetyNoticeTitle'),
              content: t(messageKey),
              showCancel: false,
              confirmText: t('companion.dismissError')
            })
            return
          }
          uni.showToast({ title: t(messageKey), icon: 'none', duration: 5000 })
        }),
        // AI 音频轮次边界帧：服务端在每轮 AI 音频开始前发送，用于给后续二进制 audio_delta 归属轮次
        on('response_start', event => {
          if (this.ended) return
          if (this.openingGate === 'SPEAKING' && this.openingTimer) {
            clearTimeout(this.openingTimer)
            this.openingTimer = null
          }
          this._logEvent('response_start', event)
          if (!this._acceptTurnEvent(event)) return
          this._clearResponseWatchdog()
          this.activeAudioTurn = this._eventTurnSeq(event) || this.currentTurnSeq
          this.activeResponseId = this._eventResponseId(event)
          this.activeInterruptEventId = ''
          this.playbackGeneration += 1
          this.audioUnavailableTurnSeq = 0
          this.beginReadProgress?.(event)
          this.bargeInArmedGeneration = 0
          this._resetBargeInWindow()
          this.iosBargeInPreroll = []
          this.lastNativeBargeInTriggerId = ''
          if (this.recorder) this.recorder.setBargeInDetection(false, this.playbackGeneration)
          if (this.player) this.player.begin(this.playbackGeneration)
          // A new output generation must reconcile the latest intent through
          // the same serialized controller, including async Web Audio failures.
          if (!this.controlState.desiredOutput) this.control.rebind()
          if (this.openingGate === 'SPEAKING') {
            this.startMicrophone({ bargeInOnly: true })
          }
          this.waitingForNextResponseStart = false
          // 新一轮开始：清掉旧的“已播放轮次”标记，避免 stale 值让下一次打断定位到旧轮
          this.activePlayedTurn = 0
          this.lastInterruptTargetSeq = 0
          this._clearAudioDrainTimer()
          this.audioTurnStartAt = 0
          this.audioTurnTotalMs = 0
          this.mediaPlaybackPending = this.controlState.voiceOutput && this.socket && this.socket.mediaManaged === true
          this.mediaTurnCompleted = false
          if (this.mediaPlaybackPending) {
            this.phase = 'AI_SPEAKING'
            this.voiceStore.setStatus(this.phase)
            this.aiSpeakingStartTime = Date.now()
          }
          // 新一轮 AI 响应开始，放行输出（兜底：即使打断处理被回声保护提前 return，也确保不吞下一轮文字）
          this.suppressAiOutput = false
          this.interrupting = false
        }),
        on('audio_delta', payload => {
          if (this.ended) return
          const frame = payload && payload.frame ? payload.frame : payload
          const meta = payload && payload.frame
            ? payload
            : { turn_seq: this.activeAudioTurn, response_id: this.activeResponseId }
          // 不再用 waitingForNextResponseStart 阻塞音频：服务端打断后不一定立即下发
          // response_start，硬等会导致新一轮音频（尤其 App 原生 base64 帧）被永久拦截。
          // 旧轮残留帧已由 _acceptTurnEvent 按 currentTurnSeq/取消标记丢弃。
          if (!this._acceptTurnEvent(meta, { advance: false })) return
          if (!(frame instanceof ArrayBuffer)) return
          if (this.suppressAiOutput || !this.controlState.voiceOutput) return
          if (this.audioUnavailableGeneration > 0 && this.audioUnavailableGeneration === this.playbackGeneration) return
          this.applyCompanionEvent({ type: 'ai_audio_delta', accepted: true })
          this.interruptSpeechFrames = 0
          // Output packets may arrive between microphone frames. Only input
          // silence, echo guards and generation changes reset near-end evidence.
          // 记录 AI 开口时刻，回声保护窗口起点
          if (this.phase !== 'AI_SPEAKING') this.aiSpeakingStartTime = Date.now()
          this.lastAiAudioAt = Date.now()
          // 估算音频尾音：24kHz/16bit/单声道，每字节播放 1/48000 秒
          if (this.audioTurnStartAt === 0) this.audioTurnStartAt = Date.now()
          if (frame && frame.byteLength) {
            this.audioTurnTotalMs += (frame.byteLength / (24000 * 2)) * 1000
          }
          this.phase = 'AI_SPEAKING'
          this.voiceStore.setStatus(this.phase)
          if (this.androidEchoCancellationActive
            && this.bargeInArmedGeneration !== this.playbackGeneration) {
            this.bargeInArmedGeneration = this.playbackGeneration
            if (this.recorder) this.recorder.setBargeInDetection(true, this.playbackGeneration)
          }
          // 记录实际播放轮次，供识别迟到的打断确认（旧轮 ACK 不得清空新一轮音频）
          const effectiveTurn = this._eventTurnSeq(meta) || this.activeAudioTurn || this.currentTurnSeq
          if (effectiveTurn > 0) this.activePlayedTurn = Math.max(this.activePlayedTurn, effectiveTurn)
          this._logEvent('audio_delta', meta)
          try { this.player.push(frame) }
          catch (error) {
            if (error?.code === 'PCM_PLAYBACK_BUFFER_FULL') { this.handlePlaybackBufferLimit(); return }
            this.fail(error.message || t('companion.audioBufferFailed'))
          }
          this.startReadProgressTimer?.(meta)
          if (this.showListening) this.showListening = false
        }),
        on('media_playback_started', event => {
          if (this.ended || !this.controlState.voiceOutput || !this.socket || this.socket.mediaManaged !== true) return
          if (!this._acceptTurnEvent(event || {}, { advance: false })) return
          this.startNativeReadProgress?.(event || {})
          this.applyCompanionEvent({ type: 'ai_audio_delta', accepted: true })
          this.mediaPlaybackPending = true
          this.phase = 'AI_SPEAKING'
          this.voiceStore.setStatus(this.phase)
          this.aiSpeakingStartTime = Date.now()
          this.lastAiAudioAt = Date.now()
          const effectiveTurn = this._eventTurnSeq(event || {}) || this.activeAudioTurn || this.currentTurnSeq
          if (effectiveTurn > 0) this.activePlayedTurn = Math.max(this.activePlayedTurn, effectiveTurn)
          if (this.showListening) this.showListening = false
        }),
        on('media_playback_progress', event => {
          if (this.ended || !this.controlState.voiceOutput || this.controlState.lifecycle === 'paused') return
          if (!this.readPlayback?.owns(event) || !this._acceptTurnEvent(event, { advance: false })) return
          this.readPlayback.sampleNative(event)
          this.readingRevision += 1
        }),
        on('media_playback_drained', event => {
          if (this.ended || !this.socket || this.socket.mediaManaged !== true) return
          if (!this._acceptTurnEvent(event || {}, { advance: false })) return
          if (event?.playback_cancelled) {
            if (this.readPlayback?.owns(event)) this.cancelReadProgress?.()
          }
          else if (this.controlState.voiceOutput) this.drainReadProgress?.(event || {})
          this.applyCompanionEvent({ type: 'audio_drained' })
          this.mediaPlaybackPending = false
          if (this.mediaTurnCompleted) this.setListeningState()
        }),
        on('citation_cards', event => this.handleCitationCards(event)),
        on('audio_interrupted', event => this.handleAudioInterrupted(event)),
        on('turn_complete', event => {
          if (!this.ended) {
            this._clearResponseWatchdog()
            this._logEvent('turn_complete', event || {})
            if (!this._acceptTurnEvent(event || {}, { advance: false })) return
            this.applyCompanionEvent({ type: 'turn_complete' })
            this.interrupting = false
            this.suppressAiOutput = false
            this.toolExecuting = false
            this.flushStreamSlice()
            this.finishCurrentAiTurn(this._eventTurnSeq(event || {}))
            if (this.openingGate === 'SPEAKING') this.openingGate = 'DRAINING'
            // 该轮已结束：用户 ASR final 若一直未到（工具续写轮 / 服务端未下发），此时放行缓冲文字
            this._releaseAiBufferForTurn(this._eventTurnSeq(event || {}))
            this.finishReadText?.(event || {})
            // WebRTC playout is paced by the media bridge; wait for its drained
            // event instead of estimating remote audio duration in Vue.
            if (this.socket && this.socket.mediaManaged === true) {
              this.mediaTurnCompleted = true
              if (!this.mediaPlaybackPending) {
                this.setListeningState()
                // A confirmed text-only response has no player drain callback.
                if (!this.controlState.voiceOutput) this.applyCompanionEvent({ type: 'audio_drained' })
              }
            } else {
              this._finishTurnAfterAudioDrain()
            }
          }
        }),
        on('context_attached', event => this.handleContextAttached(event)),
        on('reconnecting', event => this.handleReconnecting(event)),
        on('reconnected', event => this.handleReconnected(event)),
        on('error', event => this.handleError(event)),
        on('session_end', () => this.handleSessionEnd()),
        on('voice_selected', event => this.handleVoiceSelected(event)),
        on('tool_executing', () => { this.toolExecuting = true }),
        on('close', event => {
          if (event.reconnectExhausted) return
          if (!event.byClient && !this.ended) { this.control.disconnected(); this.handleUnexpectedClose() }
        })
      )
    },

    // Played text belongs to an audio response, independently of text streaming.
    // Keep its confirmed prefix on the message when the next response takes over.
    beginReadProgress(event = {}) {
      this.cancelReadProgress()
      this.readPlayback = markRaw(new CompanionReadProgress({
        turnSeq: this._eventTurnSeq(event) || this.activeAudioTurn || this.currentTurnSeq,
        responseId: this._eventResponseId(event) || this.activeResponseId,
        generation: this.playbackGeneration,
        native: this.socket?.mediaManaged === true
      }))
    },
    ensureReadProgress(event = {}) {
      if (!this.readPlayback || !this.readPlayback.owns(event)) this.beginReadProgress(event)
      return this.readPlayback
    },
    spokenSegments(turn) {
      return companionReadingSegments(turn.displayText || turn.text || '', this.readingTurn === turn ? (this.readPlayback?.native ? turn.estimatedReadingOffset : (turn.playedTextLength || 0)) : null)
    },
    startReadProgressTimer(event = {}) {
      const playback = this.ensureReadProgress(event)
      if (playback.native || playback.cancelled || this.readProgressTimer) return
      const tick = () => {
        this.readProgressTimer = null
        if (this.readPlayback !== playback || playback.cancelled || playback.drained || this.ended || this.destroyed) return
        this.syncReadProgress()
        this.readProgressTimer = setTimeout(tick, 100)
      }
      this.readProgressTimer = setTimeout(tick, 100)
    },
    syncReadProgress() {
      if (!this.readPlayback || this.readPlayback.native || this.controlState.lifecycle === 'paused') return
      if (this.player?.progress) this.readPlayback.sample(this.player.progress())
      this.readingRevision += 1
    },
    startNativeReadProgress(event) {
      this.ensureReadProgress(event).start()
    },
    finishReadText(event) {
      if (!this.readPlayback?.owns(event)) return
      // Buffered ASR-order protection may release the last text at turn_complete.
      this.flushStreamSlice()
      this.finishCurrentAiTurn(this._eventTurnSeq(event))
      this.syncReadProgress()
      this.readPlayback.finishText()
      this.readingRevision += 1
    },
    drainReadProgress(event = {}) {
      if (!this.readPlayback?.owns(event) || !this.controlState.voiceOutput) return
      this.syncReadProgress()
      this.readPlayback.drain()
      this.readingRevision += 1
      if (this.readProgressTimer) clearTimeout(this.readProgressTimer)
      this.readProgressTimer = null
    },
    cancelReadProgress() {
      this.syncReadProgress()
      this.readPlayback?.cancel()
      this.readingRevision += 1
      if (this.readProgressTimer) clearTimeout(this.readProgressTimer)
      this.readProgressTimer = null
    },
    applyReadProgressQa(scenario) {
      if (!this.qaMode) return
      const turn = [...this.turns].reverse().find(item => item.role === 'assistant')
      if (!turn) return
      turn.text = turn.displayText = t('companion.qaReadProgressAnswer')
      const progress = new CompanionReadProgress({ turnSeq: turn.turnSeq })
      progress.bind(turn)
      progress.sample({ started: true, totalMs: 10000, remainingMs: scenario === 'unplayed' ? 10000 : 5500, settled: true })
      progress.finishText()
      if (scenario === 'complete') progress.drain()
      if (scenario === 'interrupted') { progress.cancel(); turn.interrupted = true }
      turn.streaming = scenario === 'partial'
    },

    // ==================== 引用卡片 ====================

    handleCitationCards(event) {
      if (this.ended || this.destroyed) return
      if (!event.cards || !event.cards.length) return
      const turnSeq = this._eventTurnSeq(event) || this.currentTurnSeq
      if (!turnSeq) return
      const cards = {}
      this.hideCitation()
      event.cards.forEach((card, i) => {
        cards[i + 1] = card
      })
      this.citationCardsByTurn = { ...this.citationCardsByTurn, [turnSeq]: cards }
    },

    turnCitationCount(turn) {
      if (!turn || !turn.turnSeq) return 0
      return Object.keys(this.citationCardsByTurn[turn.turnSeq] || {}).length
    },

    showCitation(turnSeq, id) {
      const card = (this.citationCardsByTurn[turnSeq] || {})[id]
      if (!card) return
      // Capture the origin before the background becomes inert.
      const opener = typeof document !== 'undefined' ? document.activeElement : null
      this.activeCitation = card
      this.$nextTick(() => {
        if (this.activeCitation !== card || this.destroyed || !this.pageVisible) return
        this._releaseCitationFocus?.(false)
        const root = this.$refs.citationOverlay?.$el || this.$refs.citationOverlay
        this._releaseCitationFocus = containSheetFocus(root, () => this.hideCitation(), { opener })
      })
    },

    hideCitation(restore = true) {
      this.activeCitation = null
      const release = this._releaseCitationFocus
      this._releaseCitationFocus = null
      if (release) this.$nextTick(() => release(restore && !this.activeCitation && !this.destroyed))
    },

    citationDestination(card) { return resolveCitationDestination(card) },
    openCitationDetail(card) {
      const destination = resolveCitationDestination(card)
      if (!destination) return
      this.hideCitation()
      if (destination.kind === 'external') {
        // #ifdef APP-PLUS
        plus.runtime.openURL(destination.url)
        // #endif
        // #ifdef H5
        window.open(destination.url, '_blank')
        // #endif
        return
      }
      uni.navigateTo({ url: '/pages/news/detail?id=' + encodeURIComponent(destination.id) })
    },

    sourceTypeIcon(type) { return describeCitationSource(type, t, getUiLocale()).icon },
    sourceTypeLabel(type) { return describeCitationSource(type, t, getUiLocale()).label },

    // ==================== 文字处理 + 流式切片 ====================

    _eventTurnSeq(event = {}) {
      const raw = event.turn_seq !== undefined ? event.turn_seq : event.turnSeq
      const seq = Number(raw)
      return Number.isFinite(seq) && seq > 0 ? seq : 0
    },

    _eventResponseId(event = {}) {
      return String(event.response_id || event.responseId || '')
    },

    /** 同步轮次：丢弃过期或已取消的帧；无 turn_seq 的旧协议帧继续兼容。 */
    _acceptTurnEvent(event = {}, options = {}) {
      const { advance = true } = options
      const turnSeq = this._eventTurnSeq(event)
      const responseId = this._eventResponseId(event)
      if (turnSeq > 0) {
        if (turnSeq < this.currentTurnSeq) return false
        if (this.cancelledOutputTurnSeqs[turnSeq] && event.role !== 'user') return false
        if (advance && turnSeq > this.currentTurnSeq) this.currentTurnSeq = turnSeq
      }
      if (responseId && this.cancelledResponseIds[responseId]) return false
      return true
    },

    _cancelOutputTurn(event = {}, options = {}) {
      const { responseIdFallback = true } = options
      const turnSeq = this._eventTurnSeq(event) || this.activeAudioTurn || this.currentTurnSeq
      const responseId = this._eventResponseId(event) || (responseIdFallback ? this.activeResponseId : '')
      if (turnSeq > 0) {
        this.cancelledOutputTurnSeqs = { ...this.cancelledOutputTurnSeqs, [turnSeq]: true }
      }
      if (responseId) {
        this.cancelledResponseIds = { ...this.cancelledResponseIds, [responseId]: true }
      }
    },

    handleTextDelta(event) {
      if (this.ended) return
      this._logEvent('text_delta', event)
      if (!this._acceptTurnEvent(event)) return
      if (event.role === 'user') { this.handleUserAsr(event); return }
      if (this.suppressAiOutput) return
      if (!event.text) return
      this._clearResponseWatchdog()
      this.applyCompanionEvent({ type: 'ai_text_delta', accepted: true })
      if (this.phase !== 'AI_SPEAKING') this.aiSpeakingStartTime = Date.now()
      this.phase = 'AI_SPEAKING'
      this.voiceStore.setStatus(this.phase)
      if (this.toolExecuting) this.toolExecuting = false
      if (this.showListening) this.showListening = false
      // 该轮用户 ASR 尚未 final（AI 抢跑）时，先缓存 AI 文字，避免前几个字先于用户问题显示。
      // 缓存有界：ASR final 到达、turn_complete 或超时兜底任一都会放行，不会永久卡住 AI 输出。
      const turnSeq = this._eventTurnSeq(event) || this.currentTurnSeq
      if (this._shouldBufferAiText(turnSeq)) {
        this.pendingAiChunks.push({ turnSeq, text: event.text })
        this._scheduleAiFlush()
        return
      }
      this.enqueueAiText(event.text, turnSeq)
    },

    handleUserAsr(event) {
      const text = event.text || ''
      this.applyCompanionEvent({ type: event.is_final ? 'user_final' : 'user_partial', text })
      const turnSeq = this._eventTurnSeq(event) || this.currentTurnSeq
      const replyStarted = event.is_final && turnSeq > 0 && this.activeAudioTurn === turnSeq
      if (!replyStarted) this.phase = event.is_final ? 'THINKING' : 'USER_SPEAKING'
      this.voiceStore.setStatus(this.phase)
        if (event.is_final) {
        this.flushStreamSlice()
        this.finishCurrentAiTurn()
        this.interrupting = false
        this.suppressAiOutput = false
        this.interruptSpeechFrames = 0
        this._resetBargeInWindow()
        if (this.showListening) this.showListening = false
          if (text) {
            this.turns.push({ _key: nextKey(), role: 'user', text: text, displayText: text, turnSeq: this._eventTurnSeq(event) || this.currentTurnSeq })
            this.scrollToBottom()
            if (!replyStarted) this._armResponseWatchdog()
        }
        // 用户最终识别结果已到：标记该轮 ASR final，释放之前缓存的 AI 文字
        this.lastUserAsrFinalTurn = Math.max(this.lastUserAsrFinalTurn, this._eventTurnSeq(event) || this.currentTurnSeq)
        this._flushAiBuffer()
      } else {
        // 回声保护窗口：AI 刚开口时忽略服务端 VAD 流式结果，防止回声误触发打断
        if (this._isInEchoGuard()) return
        const last = this.turns.length > 0 ? this.turns[this.turns.length - 1] : null
        if (last && last.role === 'assistant' && last.streaming) {
          this.stopStreamSlice()
          last.streaming = false
          last.interrupted = true
        }
        if (!this.showListening) this.showListening = true
        if (text) this.listeningLabel = text
        this.scrollToBottom()
      }
    },

    startStreamSlice() {
      if (this.streamTimer) return
      this.streamTimer = setTimeout(() => {
        this.streamTimer = null
        this.flushStreamSlice()
      }, STREAM_COALESCE_MS)
    },

    stopStreamSlice() {
      if (this.streamTimer) { clearTimeout(this.streamTimer); this.streamTimer = null }
    },

    flushStreamSlice() {
      this.stopStreamSlice()
      if (this.streamQueue) {
        const aiMsg = this.getCurrentAiMsg(this.streamQueueTurnSeq)
        if (aiMsg) {
          aiMsg.text += this.streamQueue; aiMsg.displayText += this.streamQueue
          if (this.controlState.voiceOutput) this.ensureReadProgress?.({turn_seq: aiMsg.turnSeq}).bind(aiMsg)
        }
        console.debug('[VoiceStream] ui_flush', {
          turn_seq: this.streamQueueTurnSeq,
          chars: this.streamQueue.length
        })
        this.streamQueue = ''
        this.streamQueueTurnSeq = 0
        this.scrollToBottom()
      }
    },

    enqueueAiText(text, turnSeq = 0) {
      if (!text) return
      if (turnSeq > 0 && this.cancelledOutputTurnSeqs[turnSeq]) return
      if (this.streamQueue && this.streamQueueTurnSeq && turnSeq && this.streamQueueTurnSeq !== turnSeq) {
        this.flushStreamSlice()
        this.finishCurrentAiTurn(this.streamQueueTurnSeq)
      }
      this.ensureAiSlot(turnSeq)
      this.streamQueue += text
      this.streamQueueTurnSeq = turnSeq || this.streamQueueTurnSeq
      console.debug('[VoiceStream] app_receive', {
        turn_seq: this.streamQueueTurnSeq,
        chars: text.length,
        queue_chars: this.streamQueue.length
      })
      if (!this.streamTimer) this.startStreamSlice()
    },

    /**
     * 是否需要缓冲本轮 AI 文字（等待该轮用户 ASR final）。
     * - 当前 UI 末尾是“待回答的用户问题”：该轮 ASR final 已确认并展示，直接放行；
     * - 带 turn_seq 的帧：严格按“该轮 ASR final 是否已确认”判断；
     * - 无 turn_seq 的旧协议帧：仅当用户问题尚未展示（AI 抢跑）时缓冲，否则直接放行。
     */
    _shouldBufferAiText(turnSeq) {
      const last = this.turns.length > 0 ? this.turns[this.turns.length - 1] : null
      // 用户问题已展示（最后一轮是 user）→ 顺序已建立，直接放行
      if (last && last.role === 'user') return false
      if (turnSeq > 0) return turnSeq > this.lastUserAsrFinalTurn
      // 当前 AI 已在流式输出：顺序已建立，直接放行后续切片
      if (last && last.role === 'assistant' && last.streaming) return false
      // 用户问题尚未展示（AI 抢跑）→ 缓冲等 ASR final / 超时兜底
      return true
    },

    /** 缓冲 AI 文字后启动超时兜底：ASR final 长时间未到则强制放行，避免 AI 输出停在第一段 */
    _scheduleAiFlush() {
      if (this.pendingAiFlushTimer) return
      this.pendingAiFlushTimer = setTimeout(() => {
        this.pendingAiFlushTimer = null
        if (this.pendingAiChunks.length === 0) return
        const maxBufferedTurn = this.pendingAiChunks.reduce((m, c) => Math.max(m, c.turnSeq), 0)
        console.warn('[Voice] 该轮 ASR final 超时未到，强制放行 AI 文字缓冲:',
          { maxBufferedTurn, chunks: this.pendingAiChunks.length })
        // 打开门闩：视为已确认，统一放行所有已缓冲轮次
        this.lastUserAsrFinalTurn = Math.max(this.lastUserAsrFinalTurn, maxBufferedTurn)
        this._flushAiBuffer()
      }, AI_BUFFER_FLUSH_MS)
    },

    /** 该轮结束时放行该轮的缓冲 AI 文字（turn_complete 兜底，覆盖工具续写轮等无 ASR 场景） */
    _releaseAiBufferForTurn(turnSeq) {
      if (turnSeq > 0 && this.pendingAiChunks.length > 0) {
        this.lastUserAsrFinalTurn = Math.max(this.lastUserAsrFinalTurn, turnSeq)
        this._flushAiBuffer()
      }
    },

    /** 释放缓存的 AI 文字到当前 AI 槽；仍有未放行缓冲时重新武装超时兜底 */
    _flushAiBuffer() {
      if (this.pendingAiFlushTimer) { clearTimeout(this.pendingAiFlushTimer); this.pendingAiFlushTimer = null }
      if (this.pendingAiChunks.length === 0) return
      const waiting = []
      this.pendingAiChunks.forEach(chunk => {
        if (this.cancelledOutputTurnSeqs[chunk.turnSeq]) return  // 已取消输出轮次直接丢弃
        if (chunk.turnSeq <= this.lastUserAsrFinalTurn) {
          this.enqueueAiText(chunk.text, chunk.turnSeq)
        } else {
          waiting.push(chunk)
        }
      })
      this.pendingAiChunks = waiting
      if (waiting.length > 0) this._scheduleAiFlush()
    },

    /** 清空 AI 文字缓冲（打断/释放时调用） */
    _clearAiBuffer() {
      if (this.pendingAiFlushTimer) { clearTimeout(this.pendingAiFlushTimer); this.pendingAiFlushTimer = null }
      this.pendingAiChunks = []
    },

    /** 记录上游事件到达顺序（诊断轮次/顺序问题时定位用） */
    _logEvent(type, event = {}) {
      console.debug(`[VoiceArrival] ${type}`, {
        at: Date.now(),
        turn_seq: this._eventTurnSeq(event),
        response_id: this._eventResponseId(event),
        text: typeof event.text === 'string'
          ? (event.text.length > 24 ? event.text.slice(0, 24) + '…' : event.text)
          : undefined,
        is_final: event.is_final,
        currentTurnSeq: this.currentTurnSeq,
        activeAudioTurn: this.activeAudioTurn,
        activePlayedTurn: this.activePlayedTurn,
        waitingNext: this.waitingForNextResponseStart
      })
    },

    ensureAiSlot(turnSeq = 0) {
      const last = this.turns.length > 0 ? this.turns[this.turns.length - 1] : null
      if (!last || last.role === 'user') {
        this.turns.push({ _key: nextKey(), role: 'assistant', companionRoleName: this.confirmedRoleName, text: '', displayText: '',
          streaming: true, completed: false, interrupted: false, turnSeq })
      } else if (last.role === 'assistant' && (last.completed || (turnSeq && last.turnSeq && last.turnSeq !== turnSeq))) {
        this.turns.push({ _key: nextKey(), role: 'assistant', companionRoleName: this.confirmedRoleName, text: '', displayText: '',
          streaming: true, completed: false, interrupted: false, turnSeq })
      } else if (last.role === 'assistant') {
        if (turnSeq && !last.turnSeq) last.turnSeq = turnSeq
        last.streaming = true; last.completed = false; last.interrupted = false
      }
      if (turnSeq > 0 && turnSeq === this.audioUnavailableTurnSeq) {
        const turn = this.turns[this.turns.length - 1]
        if (turn?.role === 'assistant') turn.audioUnavailable = true
      }
      this.scrollToBottom()
    },

    getCurrentAiMsg(turnSeq = 0) {
      if (this.turns.length === 0) return null
      const last = this.turns[this.turns.length - 1]
      if (turnSeq && last.turnSeq && last.turnSeq !== turnSeq) return null
      return last.role === 'assistant' && !last.completed ? last : null
    },

    finishCurrentAiTurn(turnSeq = 0) {
      const aiMsg = this.getCurrentAiMsg(turnSeq)
      if (aiMsg) { aiMsg.streaming = false; aiMsg.completed = true }
      this.stopStreamSlice()
      this.streamQueue = ''
      this.streamQueueTurnSeq = 0
    },

    // ==================== 音频 + VAD 打断 ====================

    async startMicrophone(options = {}) {
      if (this.contextArticleIds.length && !this.openingContextReady) return {deferred: true}
      if (!this.capturePermitted) return {deferred: true}
      const openingDetectionOnly = options.bargeInOnly === true
        && ['SPEAKING', 'DRAINING'].includes(this.openingGate)
      if (!openingDetectionOnly && !['DONE', 'SKIPPED'].includes(this.openingGate)) return {deferred: true}
      this.openingBargeInOnly = openingDetectionOnly
      if (this.ended || this.destroyed) return false
      if (this.muted || this.lifecycleSuspended || !this.recorder) return {deferred: true}
      if (this.recorder.recording) {
        if (!openingDetectionOnly) markListenHandoff(this._listenHandoffId, 'T2', 'success')
        return true
      }
      try {
        const audioStatus = await this.recorder.start(
          frame => this.handleRecorderFrame(frame),
          event => this.handleNativeBargeIn(event),
          event => this.handleNativeAudioEvent(event)
        )
        if (!this.capturePermitted || this.ended || this.destroyed || this.lifecycleSuspended) { this.stopMicrophone(); return {deferred: true} }
        this.androidEchoCancellationActive = !!(
          audioStatus
          && audioStatus.implementation === 'AndroidCommunicationAudio'
          && audioStatus.aecEnabled === true
        )
        this.iosVoiceProcessingActive = !!(
          audioStatus && audioStatus.implementation === 'VoiceProcessingIO'
        )
        this.nativeEchoCancellationActive = !!(
          audioStatus
          && (this.androidEchoCancellationActive || this.iosVoiceProcessingActive)
        )
        this.audioImplementation = audioStatus && audioStatus.implementation
          ? String(audioStatus.implementation)
          : ''
        this.audioRoute = normalizeAudioRoute(audioStatus && audioStatus.route)
        this.applyCompanionEvent({ type: 'capture_ready' })
        if (!openingDetectionOnly) markListenHandoff(this._listenHandoffId, 'T2', 'success')
        if (!this.nativeEchoCancellationActive) {
          console.warn('[Voice] 原生 AEC 未启用，AI 播放期间使用回声门控降级', audioStatus || {})
        }
      }
      catch (error) { this.fail(error.message || t('companion.micStartFailed')); return false }
      return true
    },

    handleRecorderFrame(frame) {
      if (!this.capturePermitted) return
      if (!this.shouldForwardRecorderFrame(frame)) return
      if (this.socket) this.socket.sendAudioFrame(frame)
    },

    handlePlaybackBufferLimit() {
      if (this.ended || this.destroyed || !this.playbackGeneration
        || this.audioUnavailableGeneration === this.playbackGeneration) return
      // This is local backpressure, not proof of a disconnected transport.
      // Drop this reply's unplayed audio explicitly; preserve its text and user intent.
      this.audioUnavailableGeneration = this.playbackGeneration
      this.audioUnavailableTurnSeq = this.activeAudioTurn || this.currentTurnSeq
      this.player?.clear()
      this.cancelReadProgress?.()
      this._clearAudioDrainTimer()
      this.mediaPlaybackPending = false
      this.audioTurnStartAt = 0
      this.audioTurnTotalMs = 0
      const turn = [...this.turns].reverse().find(item => item.role === 'assistant'
        && (!this.audioUnavailableTurnSeq || item.turnSeq === this.audioUnavailableTurnSeq))
      if (turn) turn.audioUnavailable = true
      this.control.view('text')
      const diagnostic = {action: 'audio_buffer_limit', code: 'PCM_PLAYBACK_BUFFER_FULL',
        playback_generation: this.playbackGeneration, turn_seq: this.audioUnavailableTurnSeq,
        limit_ms: 60000, paused: this.controlState.lifecycle === 'paused'}
      console.warn('[CompanionAudioBuffer]', JSON.stringify(diagnostic))
      this.socket?.trace?.(diagnostic)
      uni.showToast({title: t('companion.audioBufferNotice'), icon: 'none', duration: 3500})
    },

    handleNativeAudioEvent(event = {}) {
      if (event.route) this.audioRoute = normalizeAudioRoute(event.route)

      if (event.type === 'audio_state') {
        if (event.state === 'interrupted') this.handleSystemAudioInterruption()
        const recoveringStates = ['route_changing', 'rebuilding', 'interrupted', 'resetting', 'failed']
        if (recoveringStates.includes(event.state)) this.audioRecovering = true
        return
      }

      if (event.type === 'capture_started') {
        if (!this.capturePermitted || this.ended || this.destroyed) { this.stopMicrophone(); return }
        // 原生真正收到第一帧后才恢复上传，避免“音频单元启动成功但车机麦克风无数据”。
        this.audioRecovering = false
        if (this.systemAudioInterrupted) {
          this.systemAudioInterrupted = false
        }
        this.applyCompanionEvent({ type: 'capture_ready' })
        return
      }

      if (event.type === 'capture_failed') {
        this.audioRecovering = false
        this.fail(event.error || t('companion.carMicUnavailable'))
        return
      }

      if (event.type === 'audio_error') {
        const legacyBufferLimit = !event.code && String(event.error || '').startsWith('PCM_PLAYBACK_BUFFER_FULL:')
        if (event.code === 'PCM_PLAYBACK_BUFFER_FULL' || legacyBufferLimit) { this.handlePlaybackBufferLimit(); return }
        if (event.recoverable !== false) {
          this.audioRecovering = true
          return
        }
        this.audioRecovering = false
        this.fail(event.error || t('companion.carAudioFailed'))
      }
    },

    handleSystemAudioInterruption() {
      if (this.systemAudioInterrupted) return
      this.systemAudioInterrupted = true
      this.audioRecovering = true
      // AVAudioSession interruption 表示系统音频所有权暂时变化，不代表用户插话。
      // 保留字幕和原生环形缓冲，等待 VoiceProcessingIO 恢复；绝不能因此取消模型响应。
    },

    handleNativeBargeIn(event = {}) {
      if (!this.androidEchoCancellationActive || this.ended || this.muted || this.lifecycleSuspended) return
      if (this.phase !== 'AI_SPEAKING' || !this._isAiAudioOpen()) return
      const generation = Number(event.generation || 0)
      if (!generation || generation !== this.playbackGeneration) return
      const triggerId = String(event.trigger_id || '')
      if (triggerId && triggerId === this.lastNativeBargeInTriggerId) return
      this.lastNativeBargeInTriggerId = triggerId
      const openingSpeechFrames = this.openingBargeInOnly ? this.iosBargeInPreroll.splice(0) : []
      if (this.openingBargeInOnly) {
        this.openingBargeInOnly = false
        this.openingGate = 'DONE'
        if (this.control) this.control.rebind()
      }
      this.interruptAiPlayback('native_barge_in', {
        schema_version: 1,
        detector: 'android_native_v1',
        capture_rms: Number(event.rms || 0),
        capture_peak: Number(event.peak || 0),
        residual_rms: Number(event.residual_rms || 0),
        rms_threshold: Number(event.rms_threshold || 0),
        peak_threshold: Number(event.peak_threshold || 0),
        matched_frames: Number(event.matched_frames || 0),
        required_frames: Number(event.required_frames || 0),
        decision_window_frames: Number(event.decision_window_frames || 0),
        frame_ms: Number(event.frame_ms || 0),
        aec_enabled: this.androidEchoCancellationActive,
        aec_implementation: this.audioImplementation || 'AndroidCommunicationAudio',
        audio_route: this.audioRoute || undefined,
        ...(this.interruptDiagnosticEnvironment || {}),
        client_timestamp: Date.now()
      })
      if (this.socket) openingSpeechFrames.forEach(item => this.socket.sendAudioFrame(item))
    },

    shouldForwardRecorderFrame(frame) {
      if (this.ended || this.muted || this.lifecycleSuspended || this.audioRecovering) return false
      if (!this.socket || !this.socket.connected) return false
      if (typeof this.socket.uploadAllowed === 'boolean' && this.socket.uploadAllowed !== true) return false
      // The USB shell plays through the handset speaker and records from the
      // same microphone, with no echo canceller. Speaker audio would otherwise
      // cross the local VAD and cancel the reply before it finishes.
      const now = Date.now()
      this._shellEchoHoldUntil = shellEchoHoldUntil(this.audioImplementation, this._isAiAudioOpen(), now, this._shellEchoHoldUntil)
      if (this._shellEchoHoldUntil > now) {
        this._resetBargeInWindow()
        this.iosBargeInPreroll = []
        return false
      }
      if (this.interrupting) return this.nativeEchoCancellationActive
      if (this.openingBargeInOnly) {
        this.iosBargeInPreroll.push(frame)
        if (this.iosBargeInPreroll.length > 5) this.iosBargeInPreroll.shift()
        if (!this._isAiAudioOpen()) return false
        const diagnostic = this._detectTrustedBargeIn(frame)
        if (!diagnostic) return false
        const speechFrames = this.iosBargeInPreroll.splice(0)
        this.openingBargeInOnly = false
        this.openingGate = 'DONE'
        if (this.control) this.control.rebind()
        this.interruptAiPlayback('local_vad', { ...diagnostic, opening: true })
        if (this.socket) speechFrames.forEach(item => this.socket.sendAudioFrame(item))
        return false
      }
      if (!this._isAiAudioOpen()) {
        this._resetBargeInWindow()
        this.iosBargeInPreroll = []
        return true
      }
      if (this.nativeEchoCancellationActive) {
        // Android 的近端检测在 AEC 后的 20ms 原生帧上完成；JS 这里只负责
        // 继续上传 100ms PCM，避免桥接粒度拖慢打断。
        if (this.androidEchoCancellationActive) return true
        // VoiceProcessingIO 的 AEC 在部分 iPhone/扬声器路由上仍会残留可被
        // 上游 server-VAD 识别的回声。播放期间不能把这些帧持续送上游；
        // 先在本机确认真人插话，再取消回答并补发少量近端语音 pre-roll。
        this.iosBargeInPreroll.push(frame)
        if (this.iosBargeInPreroll.length > 5) this.iosBargeInPreroll.shift()
        const diagnostic = this._detectTrustedBargeIn(frame)
        if (!diagnostic) return false
        const speechFrames = this.iosBargeInPreroll.splice(0)
        this.interruptAiPlayback('local_vad', diagnostic)
        if (this.socket) speechFrames.forEach(item => this.socket.sendAudioFrame(item))
        return false
      }
      const diagnostic = this._detectTrustedBargeIn(frame)
      if (diagnostic) {
        this.interruptAiPlayback('local_vad', diagnostic)
        return true
      }
      return false
    },

    _detectTrustedBargeIn(frame) {
      if (this.phase !== 'AI_SPEAKING') return null
      const vadProfile = BARGE_IN_VAD
      // AI 刚开口以及尾音播放阶段只做回声门控，不允许回声触发打断。
      if (this._isInEchoGuard()) { this._resetBargeInWindow(); return null }
      const now = Date.now()
      if (now - this.lastInterruptAt < INTERRUPT_COOLDOWN_MS) { this._resetBargeInWindow(); return null }
      const level = getPcmLevel(frame)
      const rmsMatched = level.rms >= vadProfile.rmsThreshold
      const peakMatched = level.peak >= vadProfile.peakThreshold
      const speaking = rmsMatched || peakMatched
      this.echoGateSpeechFrames = speaking ? this.echoGateSpeechFrames + 1 : 0
      if (!speaking) {
        this.iosBargeInWindow = []
        return null
      }
      this.iosBargeInWindow.push({ ...level, rmsMatched, peakMatched })
      if (this.iosBargeInWindow.length > vadProfile.speechFrames) this.iosBargeInWindow.shift()
      if (this.echoGateSpeechFrames < vadProfile.speechFrames) return null
      const window = this.iosBargeInWindow.slice(-vadProfile.speechFrames)
      const rmsValues = window.map(item => item.rms)
      return {
        schema_version: 1,
        detector: 'ios_js_pcm_v1',
        capture_rms: level.rms,
        capture_peak: level.peak,
        rms_threshold: vadProfile.rmsThreshold,
        peak_threshold: vadProfile.peakThreshold,
        matched_frames: window.length,
        required_frames: vadProfile.speechFrames,
        decision_window_frames: vadProfile.speechFrames,
        frame_ms: 100,
        window_rms_avg: rmsValues.reduce((sum, value) => sum + value, 0) / rmsValues.length,
        window_rms_max: Math.max(...rmsValues),
        window_peak_max: Math.max(...window.map(item => item.peak)),
        combined_hit_frames: window.filter(item => item.rmsMatched || item.peakMatched).length,
        rms_hit_frames: window.filter(item => item.rmsMatched).length,
        peak_hit_frames: window.filter(item => item.peakMatched).length,
        echo_guard_ms: ECHO_GUARD_MS,
        ai_playback_elapsed_ms: this.aiSpeakingStartTime > 0 ? now - this.aiSpeakingStartTime : 0,
        aec_enabled: this.iosVoiceProcessingActive,
        aec_implementation: this.audioImplementation || 'VoiceProcessingIO',
        audio_route: this.audioRoute || undefined,
        ...(this.interruptDiagnosticEnvironment || {}),
        client_timestamp: now
      }
    },

    _resetBargeInWindow() {
      this.echoGateSpeechFrames = 0
      this.iosBargeInWindow = []
    },

    _isAiAudioOpen() {
      if (this.player && this.player.remainingMs() > 0) return true
      if (this.phase === 'AI_SPEAKING') return true
      return this.lastAiAudioAt > 0 && (Date.now() - this.lastAiAudioAt) < ECHO_RELEASE_MS
    },

    /** 回声保护窗口：AI 开口后 ECHO_GUARD_MS 内禁止打断 */
    _isInEchoGuard() {
      return this.aiSpeakingStartTime > 0 && (Date.now() - this.aiSpeakingStartTime) < ECHO_GUARD_MS
    },

    interruptAiPlayback(source = 'local_vad', diagnostic = null) {
      this._clearResponseWatchdog()
      this.lastInterruptAt = Date.now()
      this.interrupting = true
      this.suppressAiOutput = true
      this.interruptSpeechFrames = 0
      this._resetBargeInWindow()
      this.iosBargeInPreroll = []
      this.bargeInArmedGeneration = 0
      if (this.recorder) this.recorder.setBargeInDetection(false, this.playbackGeneration)
      const targetTurn = this.activeAudioTurn || this.activePlayedTurn || this.currentTurnSeq
      const targetResponseId = this.activeResponseId
      this.lastInterruptTargetSeq = targetTurn
      // 只取消被打断轮次本身，不取消 response_id：服务端打断续写可能复用同一
      // response_id，误标会吞掉新一轮的音频/文字
      this._cancelOutputTurn({ turn_seq: targetTurn }, { responseIdFallback: false })
      // 打断即重置音频归属：即使服务端未回 response_start/audio_interrupted，
      // 新一轮原始音频帧（无 turn 元数据）也能按“无归属”放行，避免打断后永久静音
      this.activeAudioTurn = 0
      this.activeResponseId = ''
      this._clearAudioDrainTimer()
      this.audioTurnStartAt = 0
      this.audioTurnTotalMs = 0
      // 新一轮重新建立播放电平，避免上一轮高电平让 dynamicRms 阈值虚高、拦下正常插话
      this.cancelReadProgress?.()
      if (this.player) this.player.clear()
      this.stopStreamSlice()
      this.streamQueue = ''
      this.streamQueueTurnSeq = 0
      this.waitingForNextResponseStart = true
      const aiMsg = this.getCurrentAiMsg()
      if (aiMsg) { aiMsg.streaming = false; aiMsg.interrupted = true }
      this.showListening = true
      this.listeningLabel = t('companion.listeningNow')
      // Cancelling playback does not mean a new question or response exists.
      this.phase = 'LISTENING'
      this.voiceStore.setStatus(this.phase)
      if (!this._sendInterruptRequest(targetTurn, targetResponseId, source, diagnostic)) console.warn('[Voice] interrupt 发送失败')
      this.scrollToBottom()
    },

    _sendInterruptRequest(targetTurn, targetResponseId = this.activeResponseId, source = 'local_vad', diagnostic = null) {
      if (!this.socket) return false
      if (!this.activeInterruptEventId) {
        this.interruptEventSeq += 1
        this.activeInterruptEventId = `interrupt-${Date.now()}-${this.interruptEventSeq}`
      }
      return this.socket.sendInterrupt({
        event_id: this.activeInterruptEventId,
        turn_seq: targetTurn || this.currentTurnSeq,
        response_id: targetResponseId || undefined,
        playback_generation: this.playbackGeneration || undefined,
        source,
        diagnostic: diagnostic || undefined
      })
    },

    handleAudioInterrupted(event = {}) {
      this._logEvent('audio_interrupted', event)
      const interruptedSeq = this._eventTurnSeq(event)
      const isLateAck = interruptedSeq > 0
        ? (this.activePlayedTurn > interruptedSeq || this.activeAudioTurn > interruptedSeq)
        // 旧协议事件无 turn_seq：以客户端最近一次打断目标轮次兜底判断
        : (this.lastInterruptTargetSeq > 0 && this.activePlayedTurn > this.lastInterruptTargetSeq)
      this.lastInterruptTargetSeq = 0
      if (isLateAck) {
        // 迟到的打断确认：新一轮响应已开始播放，不能清空新一轮音频 / 阻塞后续帧，
        // 否则打断后新一轮 AI 音频全部丢失。只取消事件明确指出的旧轮，避免把新一轮
        // response_id 误判为已取消。
        if (interruptedSeq > 0) {
          // 只取消旧轮本身，不经过 _cancelOutputTurn：该方法的 response_id 会兜底到
          // activeResponseId（此时是新一轮），会把新一轮误标记为已取消，吞掉其后续音频/文字
          this.cancelledOutputTurnSeqs = { ...this.cancelledOutputTurnSeqs, [interruptedSeq]: true }
        }
        this.interrupting = false
        this.suppressAiOutput = false
        console.warn('[Voice] 迟到打断确认，保留新一轮音频: 被打断轮=', interruptedSeq,
          'playedTurn=', this.activePlayedTurn, 'activeAudioTurn=', this.activeAudioTurn)
        return
      }
      // 取消被打断的当前轮；事件无 turn_seq/response_id 时回退到当前活跃轮。
      // 不取消 response_id（同 interruptAiPlayback：服务端续写可能复用同一 response_id）。
      this._cancelOutputTurn({
        turn_seq: interruptedSeq || this.activePlayedTurn || this.activeAudioTurn || this.currentTurnSeq
      }, { responseIdFallback: false })
      // 硬停当前播放，清空音频队列（服务端已保证不再转发旧轮残留音频）
      this._clearAudioDrainTimer()
      this.audioTurnStartAt = 0
      this.audioTurnTotalMs = 0
      this.activeAudioTurn = 0
      this.activeResponseId = ''
      this.activePlayedTurn = 0
      this.waitingForNextResponseStart = true
      this.cancelReadProgress?.()
      if (this.player) this.player.clear()
      this.interrupting = false
      // 打断已确认：旧轮帧交给 turn_seq 机制丢弃，此处放行新一轮 AI 输出，
      // 否则新一轮前几个字（抢跑在用户 ASR final 之前）会被 suppressAiOutput 误吞
      this.suppressAiOutput = false
      this.interruptSpeechFrames = 0
      this._resetBargeInWindow()
      this.iosBargeInPreroll = []
      this.stopStreamSlice()
      this.streamQueue = ''
      this.streamQueueTurnSeq = 0
      // 打断后清空待定状态，等下一轮重新建立
      this._clearAiBuffer()
      const aiMsg = this.getCurrentAiMsg()
      if (aiMsg) {
        // 服务端返回的保留文字，替换当前 AI 消息内容
        if (event.kept_text) {
          aiMsg.text = event.kept_text
          aiMsg.displayText = event.kept_text
        }
        aiMsg.streaming = false
        aiMsg.interrupted = true
        aiMsg.completed = true
      }
      if (!this.ended && this.phase !== 'USER_SPEAKING' && this.phase !== 'LISTENING') {
        this.phase = 'LISTENING'
        this.voiceStore.setStatus(this.phase)
      }
    },

    stopMicrophone(options = {}) {
      this.openingBargeInOnly = false
      this.bargeInArmedGeneration = 0
      if (!this.recorder) return
      const stopped = this.recorder.stop(options)
      // Teardown/background callers do not await; the shared controller still
      // receives the original rejection when this is a normal capture operation.
      if (stopped && typeof stopped.catch === 'function') stopped.catch(error => {
        if (!this.ended && !this.destroyed && !this.lifecycleSuspended) console.warn('停止收音未确认:', error.message)
      })
      return stopped
    },

    stopNativeVoiceSession() {
      const nativeVoiceSession = this.nativeVoiceSession
      this.nativeVoiceSession = null
      if (nativeVoiceSession) nativeVoiceSession.stopVoiceSession()
    },

    // ==================== 控制 ====================

    toggleMute() {
      if (this.ended) return
      this.control.input(this.controlState.inputMode === 'voice' ? 'text' : 'voice')
    },

    setListeningState() {
      this.interrupting = false
      this.aiSpeakingStartTime = 0
      this.lastAiAudioAt = 0
      this.suppressAiOutput = false
      this.interruptSpeechFrames = 0
      this._resetBargeInWindow()
      this.bargeInArmedGeneration = 0
      if (this.recorder) this.recorder.setBargeInDetection(false, this.playbackGeneration)
      this.activeAudioTurn = 0
      this.activePlayedTurn = 0
      this.activeResponseId = ''
      this.lastInterruptTargetSeq = 0
      this.showListening = false
      this.phase = 'LISTENING'
      this.voiceStore.setStatus(this.phase)
      if (this.openingGate === 'SPEAKING' || this.openingGate === 'DRAINING') {
        this.openingGate = 'DONE'
        if (this.control) this.control.rebind()
        this.startMicrophone()
      }
    },

    /** 文本完成后，若音频还在播，延迟进入 LISTENING，期间保持可打断 */
    _finishTurnAfterAudioDrain() {
      const audioDoneAt = this.audioTurnStartAt + this.audioTurnTotalMs
      this.audioTurnStartAt = 0
      this.audioTurnTotalMs = 0
      const estimatedRemaining = Math.max(0, audioDoneAt - Date.now())
      const playerRemaining = this.player ? this.player.remainingMs() : 0
      const remaining = Math.max(estimatedRemaining, playerRemaining) + ECHO_RELEASE_MS
      if (remaining > 0) {
        // 音频未播完，保持 AI_SPEAKING，等尾音播完再进入 LISTENING
        this.phase = 'AI_SPEAKING'
        this.voiceStore.setStatus(this.phase)
        if (this._audioDrainTimer) clearTimeout(this._audioDrainTimer)
        this._audioDrainTimer = setTimeout(() => {
          this._audioDrainTimer = null
          if (this.ended || this.interrupting) return
          // A late PCM batch may extend playback after turn_complete. Re-check
          // the player before reopening microphone upload.
          if (this.player && this.player.remainingMs() > 0) {
            this._finishTurnAfterAudioDrain()
          } else {
            this.drainReadProgress?.()
            this.setListeningState()
            this.applyCompanionEvent({ type: 'audio_drained' })
          }
        }, remaining)
      } else {
        this.drainReadProgress?.()
        this.setListeningState()
        this.applyCompanionEvent({ type: 'audio_drained' })
      }
    },

    _clearAudioDrainTimer() {
      if (this._audioDrainTimer) { clearTimeout(this._audioDrainTimer); this._audioDrainTimer = null }
    },

    // ==================== 文章上下文注入 ====================

    sendContextAttach() {
      if (!this.socket || !this.socket.connected) return
      if (this.contextArticleIds.length === 0) return
      clearTimeout(this.articleAttachTimer)
      this.openingContextReady = false
      const transport = this.socket
      this.articleAttachTimer = setTimeout(() => {
        this.articleAttachTimer = null
        if (!this.ended && !this.destroyed && this.socket === transport && !this.openingContextReady) {
          this.handleError({code: 'CONTEXT_ATTACH_FAILED', message: t('companion.contextUnconfirmed')})
        }
      }, 12000)
      this.socket.sendControl('context_attach', {
        article_ids: this.contextArticleIds,
        ...(this.conversationLocale ? { conversation_locale: this.conversationLocale } : {})
      })
    },

    handleContextAttached(event = {}) {
      if (this.ended) return
      const receipt = acceptArticleReceipt(event, this.sessionId, this.contextArticleIds)
      if (!receipt) return
      clearTimeout(this.articleAttachTimer)
      this.articleAttachTimer = null
      this.articleReceiptRevision += 1
      this.confirmedArticle = receipt
      this.contextArticleIds = receipt.articleIds
      this.sourceTitle = receipt.title
      this.contextAttachedMsg = ''
      this.openingContextReady = true
      this.rememberCompanionContext()
      if (!receipt.title) this.loadConfirmedArticleTitle(receipt)
      if (this.fallbackAwaitingContext) {
        this.fallbackAwaitingContext = false
        if (!this.muted && this.socket && this.socket.uploadAllowed === true) this.startMicrophone()
        return
      }
      if (this.resumingFromBackground) {
        // 服务端仍需完成历史恢复并显式发送 upload_ready。
        return
      }
      console.log('[Voice] 文章上下文已注入:', event.message || '')
      this.requestProactiveOpening()
    },

    async loadConfirmedArticleTitle(receipt) {
      const revision = ++this.articleReceiptRevision
      try {
        const response = await get(API_PATHS.FEED_DETAIL.replace('{id}', receipt.articleIds[0]), {})
        if (this.destroyed || this.ended || revision !== this.articleReceiptRevision || this.sessionId !== receipt.sessionId || this.confirmedArticle?.articleIds[0] !== receipt.articleIds[0]) return
        const title = String((response.code === '0' || response.code === 0 || response.code === 200) ? response.data?.title || '' : '').trim()
        if (title) { this.confirmedArticle = { ...receipt, title }; this.sourceTitle = title; this.rememberCompanionContext() }
      } catch (_) { /* The association remains valid; do not invent an article title. */ }
    },
    openConfirmedArticle() {
      if (!this.confirmedArticle || this.confirmedArticle.sessionId !== this.sessionId) return
      uni.navigateTo({ url: `/pages/news/detail?id=${encodeURIComponent(this.confirmedArticle.articleIds[0])}` })
    },
    requestProactiveOpening() {
      if (!this.socket || !this.socket.connected || !this.realtimeSessionReady
        || !this.openingSupported || !this.openingContextReady || this.openingGate !== 'WAITING') return
      this.phase = 'CONNECTING'
      this.voiceStore.setStatus(this.phase)
      if (!this.openingAutomatic) {
        const sent = this.socket.sendControl('opening_request', {})
        if (!sent) {
          this.handleOpeningSkipped({ message: t('companion.openingUndelivered') })
          return
        }
      }
      if (this.openingTimer) clearTimeout(this.openingTimer)
      this.openingTimer = setTimeout(() => {
        this.openingTimer = null
        if (this.ended || this.openingGate !== 'WAITING') return
        this.socket.sendControl('opening_cancel', {})
        this.handleOpeningSkipped({ message: t('companion.openingConfirmTimeout') })
      }, 5000)
    },

    handleOpeningStarted(event = {}) {
      if (this.ended || this.openingGate !== 'WAITING') return
      if (this.openingTimer) clearTimeout(this.openingTimer)
      this.openingTimer = null
      this.openingGate = 'SPEAKING'
      this.phase = 'THINKING'
      this.voiceStore.setStatus(this.phase)
      this.openingTimer = setTimeout(() => {
        this.openingTimer = null
        if (this.ended || this.openingGate !== 'SPEAKING') return
        const sent = this.socket.sendControl('opening_cancel', {})
        this.cancelReadProgress?.()
        if (this.player) this.player.clear()
        if (!sent) this.handleOpeningSkipped({ message: t('companion.openingResponseTimeout') })
        else this.openingTimer = setTimeout(() => {
          this.openingTimer = null
          this.handleOpeningSkipped({ message: t('companion.openingCancelTimeout') })
        }, 2500)
      }, 20000)
      console.log('[Voice] 主动开场:', event.opening_state || '')
    },

    handleOpeningSkipped(event = {}) {
      if (this.ended || ['DONE', 'SKIPPED'].includes(this.openingGate)) return
      if (this.openingTimer) clearTimeout(this.openingTimer)
      this.openingTimer = null
      this.openingGate = 'SKIPPED'
      if (this.control) this.control.rebind()
      this.phase = 'LISTENING'
      this.voiceStore.setStatus(this.phase)
      if (!this.isReconnecting) this.startMicrophone()
      console.warn('[Voice] 主动开场降级:', event.message || '')
    },

    cancelOpeningForRecovery() {
      if (this.openingTimer) clearTimeout(this.openingTimer)
      this.openingTimer = null
      if (!['DONE', 'SKIPPED'].includes(this.openingGate)) this.openingGate = 'SKIPPED'
      this.openingBargeInOnly = false
      this.stopMicrophone()
    },

    startDurationTimer() {
      if (this.durationTimer) return
      this.startedAt = Date.now()
      this.durationTimer = setInterval(() => {
        this.elapsedSeconds = Math.floor((this.activeElapsedMs + Date.now() - this.startedAt) / 1000)
      }, 1000)
    },

    stopDurationTimer() {
      if (this.startedAt) {
        this.activeElapsedMs += Math.max(0, Date.now() - this.startedAt)
        this.elapsedSeconds = Math.floor(this.activeElapsedMs / 1000)
        this.startedAt = 0
      }
      if (this.durationTimer) clearInterval(this.durationTimer)
      this.durationTimer = null
    },

    _armSessionReadyWatchdog() {
      this._clearSessionReadyWatchdog()
      this.sessionReadyTimer = setTimeout(() => {
        this.sessionReadyTimer = null
        if (this.destroyed || this.ended || this.realtimeSessionReady) return
        this.fail(t('companion.voicePrepareTimeout'))
      }, 12000)
    },

    _clearSessionReadyWatchdog() {
      if (this.sessionReadyTimer) clearTimeout(this.sessionReadyTimer)
      this.sessionReadyTimer = null
    },

    _armResumeReadyWatchdog() {
      this._clearResumeReadyWatchdog()
      this.resumeReadyTimer = setTimeout(() => {
        this.resumeReadyTimer = null
        if (!this.resumingFromBackground || this.ended || this.destroyed) return
        this.fail(t('companion.callResumeTimeout'))
      }, 12000)
    },

    _clearResumeReadyWatchdog() {
      if (this.resumeReadyTimer) clearTimeout(this.resumeReadyTimer)
      this.resumeReadyTimer = null
    },

    _armResponseWatchdog() {
      this._clearResponseWatchdog()
      this.responseWatchdogTimer = setTimeout(() => {
        this.responseWatchdogTimer = null
        if (this.ended || this.destroyed || this.lifecycleSuspended || this.phase !== 'THINKING') return
        this.phase = 'LISTENING'
        this.voiceStore.setStatus(this.phase)
        uni.showToast({ title: t('companion.responseTimeout'), icon: 'none', duration: 2500 })
      }, 15000)
    },

    _clearResponseWatchdog() {
      if (this.responseWatchdogTimer) clearTimeout(this.responseWatchdogTimer)
      this.responseWatchdogTimer = null
    },

    async _fallbackToLegacy(event = {}) {
      if (this.historyContinuation) {
        this.handleError({ code: 'CONTEXT_ATTACH_FAILED', message: t('notesList.resumeFailed') })
        this.socket?.close?.()
        return
      }
      if (this.v2FallbackUsed || this.v2FallbackInProgress || this.ended || this.destroyed) return
      if (!['UNSUPPORTED_PROTOCOL', 'MISSING_CAPABILITY'].includes(String(event.code || ''))) {
        this.fail(event.reason || t('companion.voiceResumeFailed'))
        return
      }
      this.v2FallbackUsed = true
      this.v2FallbackInProgress = true
      this.transportMode = 'v1'
      this.phase = 'CONNECTING'
      this.voiceStore.setStatus(this.phase)
      this.stopMicrophone()
      this.cancelReadProgress?.()
      if (this.player) this.player.clear()
      if (this.openingTimer) clearTimeout(this.openingTimer)
      this.openingTimer = null
      this.openingGate = 'SKIPPED'
      if (this.control) this.control.rebind()
      this.suppressAiOutput = true

      const previous = this.socket
      this.unsubscribers.forEach(unsubscribe => unsubscribe())
      this.unsubscribers = []
      if (previous && typeof previous.destroy === 'function') previous.destroy()

      this.socket = markRaw(createRealtimeTransport(true))
      this.fallbackAwaitingContext = this.contextArticleIds.length > 0
      this.realtimeSessionReady = false
      this.bindSocketEvents()
      this._armSessionReadyWatchdog()
      try {
        await this.socket.connect(this.userStore.memberId, {
          sessionId: event.sessionId || this.sessionId || '',
          conversationLocale: this.conversationLocale,
          contextArticleIds: this.contextArticleIds
        })
        uni.showToast({ title: t('companion.stableConnectionSwitched'), icon: 'none', duration: 1500 })
      } catch (error) {
        this.fail(error.message || t('companion.voiceConnectFailed'))
      } finally {
        this.v2FallbackInProgress = false
        this.suppressAiOutput = false
      }
    },

    suspendForBackground() {
      if (this.backgroundSuspended || this.ended) return
      this.backgroundSuspended = true
      this.control.disconnected()
      this.lifecycleSuspended = true
      this.resumingFromBackground = false
      this.stopDurationTimer()
      this.stopMicrophone()
      this.stopStreamSlice()
      this._clearAiBuffer()
      this._clearResponseWatchdog()
      this._clearAudioDrainTimer()
      this.cancelReadProgress?.()
      if (this.player) this.player.stop()
      const eventId = `suspend-${this.sessionId || 'pending'}-${Date.now()}`
      if (this.socket) {
        const socket = this.socket
        this.socket.sendControl('client_suspend', {
          event_id: eventId,
          turn_seq: this.currentTurnSeq,
          response_id: this.activeResponseId || undefined
        })
        const release = typeof socket.destroy === 'function' ? socket.destroy() : socket.close()
        trackCompanionAudioRelease(release)
      }
      this.unsubscribers.forEach(unsubscribe => unsubscribe())
      this.unsubscribers = []
      this.stopNativeVoiceSession()
      this.realtimeSessionReady = false
      this.suppressAiOutput = true
      this.phase = 'SUSPENDED'
      this.voiceStore.setStatus(this.phase)
      releaseScreenAwake('voice-call')
    },

    async resumeFromBackground() {
      if (!this.backgroundSuspended || this.resumingFromBackground || this.ended || this.destroyed) return
      this.resumingFromBackground = true
      this.backgroundSuspended = false
      this.lifecycleSuspended = true
      this.realtimeSessionReady = false
      this.phase = 'CONNECTING'
      this.voiceStore.setStatus(this.phase)
      await this.startCall({ resume: true })
    },

    _completeBackgroundResume() {
      if (!this.resumingFromBackground || this.ended || this.destroyed) return
      this.resumingFromBackground = false
      this.lifecycleSuspended = false
      this.control.rebind()
      this.suppressAiOutput = false
      this.activeResponseId = ''
      this.activeAudioTurn = 0
      this.activePlayedTurn = 0
      this.phase = 'LISTENING'
      this.voiceStore.setStatus(this.phase)
      this.startDurationTimer()
      acquireScreenAwake('voice-call')
      if (!this.muted) this.startMicrophone()
    },

    hangup() {
      if (this.ended) return
      markListenHandoff(this._listenHandoffId, 'T2', 'cancelled')
      markListenHandoff(this._listenHandoffId, 'T3')
      this.rememberListenReturnMode()
      this.ended = true
      this.flushStreamSlice()
      this.finishCurrentAiTurn()
      this.control.end()
      this.releaseCall()
      this.ended = true
      this.phase = 'ENDED'
      this.applyCompanionEvent({ type: 'ended' })
      if (this.voiceStore) this.voiceStore.end()
      if (!this.qaMode) this.openEndedSession()
    },

    requestExit() {
      if (this.quietStarted === false && !this.qaMode) { this.goBack(); return Promise.resolve(true) }
      if (this.ended) { this.openEndedSession(); return Promise.resolve(true) }
      if (this._exitConfirmation) return this._exitConfirmation
      this._textHandoffCancelled = true
      this.showExitConfirm = true
      this._exitConfirmation = new Promise(resolve => { this._resolveExitConfirmation = resolve })
        .finally(() => { this._exitConfirmation = null })
      return this._exitConfirmation
    },
    resolveExitConfirmation(confirmed) {
      this.showExitConfirm = false
      const resolve = this._resolveExitConfirmation
      this._resolveExitConfirmation = null
      if (confirmed && !this.destroyed && !this.ended) this.hangup()
      resolve?.(confirmed === true)
    },
    onBackSwipeStart(event) {
      this.backSwipeStart = event.touches?.length === 1 && !this.showVoicePicker && !this.keyboardHeight
        ? { clientX: event.touches[0].clientX, clientY: event.touches[0].clientY } : null
    },
    onBackSwipeEnd(event) {
      const start = this.backSwipeStart
      this.backSwipeStart = null
      if (isCompanionBackSwipe(start, event.changedTouches?.[0])) this.requestExit()
    },
    async switchToText() {
      if (this.ended || this.destroyed || this.openingTextChat) return
      if (!this.sessionId || this.qaMode) { uni.showToast({ title: t('companion.textChatWaitForConnection'), icon: 'none' }); return }
      this.openingTextChat = true
      this._textHandoffCancelled = false
      let navigated = false
      const sourceSessionId = this.sessionId
      const resumeOnFailure = this.controlState.lifecycle !== 'paused'
      if (resumeOnFailure) { this.control.pause(); this.textHandoffPaused = true }
      try {
        await this.control.flush()
        // Flush accepted turns before the server snapshots the source conversation.
        await prepareCompanionTextHistory(this.socket)
        if (this.ended || this.destroyed || this._textHandoffCancelled || this.pageVisible === false || this.sessionId !== sourceSessionId) return
        this._textDerivationRequest ||= `companion-text-${sourceSessionId}-${Date.now()}`
        const response = await post(`${API_PATHS.AI_SESSIONS}/${encodeURIComponent(sourceSessionId)}/derivations`, {
          requestId: this._textDerivationRequest, sessionType: 'TEXT_CHAT'
        })
        if (this.ended || this.destroyed || this._textHandoffCancelled || this.pageVisible === false || this.sessionId !== sourceSessionId) { this._textDerivationRequest = ''; return }
        const child = response.data
        if (!child?.sessionId || child.sessionType !== 'TEXT_CHAT') throw new Error(t('companion.textChatCreateFailed'))
        await new Promise((resolve, reject) => uni.navigateTo({ url: companionTextUrl(child.sessionId, this), success: resolve, fail: reject }))
        navigated = true
        this._textDerivationRequest = ''
      } catch (error) {
        if (!this.ended && !this.destroyed) {
          if (resumeOnFailure && this.textHandoffPaused) { this.control.resume(); this.textHandoffPaused = false }
          uni.showToast({ title: (getUiLocale() === 'zh-CN' && error.message) || t('companion.textChatOpenFailed'), icon: 'none' })
        }
      } finally {
        this.openingTextChat = false
        if (!navigated && !this.ended && !this.destroyed && this.pageVisible !== false && resumeOnFailure && this.textHandoffPaused) {
          this.control.resume(); this.textHandoffPaused = false
        }
      }
    },

    goBack() {
      this.rememberListenReturnMode()
      this._returningToListening = true
      const pages = getCurrentPages()
      if (pages.length > 1) { uni.navigateBack({ delta: 1, fail: () => { this._returningToListening = false } }) }
      else { uni.reLaunch({ url: '/pages/daily/index' }) }
    },

    rememberListenReturnMode() {
      const fallbackPlaying = this.qaMode
        ? this.quietStarted === true && this.controlState?.voiceOutput === true && this.controlState.lifecycle !== 'paused'
        : voiceMode.canAutoStart()
      const inhibitAutoPlay = this.controlState.systemOutputAvailable === false || this.routeInterrupted
      this.listenReturnOutputLossRevision = audioOutputMonitor.getState().lossRevision || 0
      this.listenReturnPlaying = resolveCompanionListenReturnPlaying(
        typeof getCurrentPages === 'function' ? getCurrentPages() : [],
        this.contextArticleIds, fallbackPlaying, inhibitAutoPlay, this.listenReturnOutputLossRevision
      )
    },

    openEndedSession() {
      if (this.pageVisible === false || this._openingEndPage) return
      this._openingEndPage = true
      const fail = () => { this._openingEndPage = false; uni.showToast({ title: t('companion.endedPageOpenFailed'), icon: 'none' }) }
      try { uni.redirectTo({ url: companionEndUrl(this), fail }) } catch (_) { fail() }
    },

    rememberCompanionContext() {
      if (this.qaMode || (this.contextArticleIds.length && !this.confirmedArticle)) return
      saveCompanionContext(uni, this.userStore?.userInfo?.id, this.sessionId, {
        articleIds: this.contextArticleIds || [], sourceTitle: this.sourceTitle, contentStyleCode: this.confirmedRoleCode
      })
    },

    rememberCompanionRole(code) {
      if (!this.qaMode && this.userStore?.memberId !== this.rolePreferenceOwnerId) return
      saveCompanionRolePreference(this.rolePreferenceOwnerId, code, this.qaMode ? this.qaRolePreferenceStorage : undefined)
    },

    startFallbackVolumeObservation() {
      if (this.nativeVolumeEventsSeen || this.fallbackVolumeObserver || !this.companionVolumeGate) return
      const transport = this.socket
      const observer = observeCompanionOutputVolume(event => this.observeCompanionVolume(event), {
        ready: () => this.socket === transport && transport?.connected && !this.ended && !this.destroyed
          && (transport.mediaManaged || !this.controlState.desiredCapture || this.controlState.captureActive),
        isAudioActive: () => this.controlState.captureActive || this.controlState.outputEnabled
      })
      if (observer) this.fallbackVolumeObserver = markRaw(observer)
    },
    raiseQaVolume() {
      this.setQaVolume(Math.min(1, this.qaCurrentVolume + 0.1))
    },
    observeCompanionVolume(event) {
      this.companionVolumeGate?.observe(event)
    },
    setQaVolume(volume, volumeContext = this.qaVolumeContext, baseline = false, minimumVolume = this.qaMinimumVolume) {
      if (!this.qaMode) return
      this.qaCurrentVolume = volume
      this.qaMinimumVolume = minimumVolume
      this.qaVolumeContext = volumeContext
      this.observeCompanionVolume({volume, minimumVolume, volumeContext, baseline, audioActive: true})
    },

    releaseCall() {
      clearTimeout(this.articleAttachTimer)
      this.articleAttachTimer = null
      this.fallbackVolumeObserver?.dispose()
      this.fallbackVolumeObserver = null
      if (this.ended || this.destroyed) {
        this.companionVolumeGate?.dispose()
        this.companionVolumeGate = null
      }
      this.rememberCompanionContext()
      releaseScreenAwake('voice-call')
      if (this.openingTimer) clearTimeout(this.openingTimer)
      this.openingTimer = null
      this._clearSessionReadyWatchdog()
      this._clearResumeReadyWatchdog()
      this._clearResponseWatchdog()
      this.stopDurationTimer()
      this.stopMicrophone()
      this.stopStreamSlice()
      this.streamQueue = ''
      this.streamQueueTurnSeq = 0
      this.interrupting = false
      this.suppressAiOutput = false
      this.interruptSpeechFrames = 0
      this._resetBargeInWindow()
      this.lastAiAudioAt = 0
      this.lifecycleSuspended = false
      this.systemAudioInterrupted = false
      this.nativeEchoCancellationActive = false
      this.androidEchoCancellationActive = false
      this.iosVoiceProcessingActive = false
      this.iosBargeInPreroll = []
      this.bargeInArmedGeneration = 0
      this.lastNativeBargeInTriggerId = ''
      this.showListening = false
      this.lastUserAsrFinalTurn = 0
      this._clearAiBuffer()
      this.currentTurnSeq = 0
      this.activeAudioTurn = 0
      this.activePlayedTurn = 0
      this.activeResponseId = ''
      this.cancelledOutputTurnSeqs = {}
      this.cancelledResponseIds = {}
      this.waitingForNextResponseStart = false
      this.lastInterruptTargetSeq = 0
      this.audioTurnStartAt = 0
      this.audioTurnTotalMs = 0
      this._clearAudioDrainTimer()
      this.cancelReadProgress?.()
      if (this.player) this.player.stop()
      if (this.socket && this._releasedSocket !== this.socket) {
        this._releasedSocket = this.socket
        const socket = this.socket
        if (!this.qaMode && this.sessionId) {
          const sessionId = this.sessionId
          trackCompanionSave(sessionId, async () => {
            if (typeof socket.finishHistory === 'function') await socket.finishHistory()
            else {
              const result = await post(`/api/v1/realtime/aoq/${encodeURIComponent(sessionId)}/end`, {}, { rawResponse: true })
              if (result?.accepted !== true) throw new Error(t('companion.notesUnconfirmed'))
            }
          })
        }
        this.socket.sendControl('session_end')
        const handoffId = this._listenHandoffId
        markListenHandoff(handoffId, 'aoq_release_start')
        const release = typeof socket.destroy === 'function' ? socket.destroy() : socket.close()
        if (release && typeof release.then === 'function') {
          release.then(
            released => markListenHandoff(handoffId, 'T4', socket.audioReleaseOutcome || (released === true ? 'success' : 'failed')),
            () => markListenHandoff(handoffId, 'T4', 'failed')
          )
        } else markListenHandoff(handoffId, 'T4', 'skipped')
        trackCompanionAudioRelease(release)
      }
      this.stopNativeVoiceSession()
      this.unsubscribers.forEach(u => u())
      this.unsubscribers = []
    },

    fail(message) {
      if (this.ended) return
      markListenHandoff(this._listenHandoffId, 'T2', 'failed')
      clearTimeout(this.articleAttachTimer)
      this.articleAttachTimer = null
      this.isReconnecting = false
      this.transportRecoveryState = 'FAILED'
      this.upstreamRecoveryState = 'IDLE'
      this.errorMessage = message
      this.errorCode = 'UPSTREAM_DISCONNECTED'
      this.control.disconnected()
      this.phase = 'ERROR'
      this.applyCompanionEvent({ type: 'error', message })
      this.voiceStore.setStatus(this.phase)
      releaseScreenAwake('voice-call')
      this.stopMicrophone()
      this.cancelReadProgress?.()
      if (this.player) this.player.stop()
      this.stopNativeVoiceSession()
      uni.showToast({ title: this.connectionErrorDisplayText, icon: 'none', duration: 2500 })
    },

    // ==================== 服务端错误分类处理 ====================

    handleError(msg) {
      const code = msg.code || ''
      const message = msg.message || ''
      console.warn('[Voice] 服务端错误:', code, message)

      if (['WAITING', 'SPEAKING', 'DRAINING'].includes(this.openingGate)) {
        this.handleOpeningSkipped({ message: t('companion.openingUnavailable') })
        if (message && message.includes('Cannot create response')) {
          return
        }
      }

      switch (code) {
        case 'UPSTREAM_DISCONNECTED':
          markListenHandoff(this._listenHandoffId, 'T2', 'failed')
          // 致命：重连尝试全部失败
          this.isReconnecting = false
          this.transportRecoveryState = 'IDLE'
          this.upstreamRecoveryState = 'FAILED'
          this.errorCode = code
          this.errorMessage = t('companion.modelDisconnected')
          this.toolExecuting = false
          this.stopStreamSlice()
          this.streamQueue = ''
          this.stopMicrophone()
          this.cancelReadProgress?.()
          if (this.player) this.player.stop()
          this.stopNativeVoiceSession()
          break

        case 'TOOL_RESULT_SEND_FAILED':
          // 可恢复：Tool 结果没传回去，会话仍在
          this.toolExecuting = false
          uni.showToast({ title: t('companion.toolSearchTimedOut'), icon: 'none', duration: 2500 })
          break

        case 'TOOL_TURN_FAILED':
          // The AOQ controller has settled the old response before emitting this.
          // Keep the user's existing mute preference and microphone state unchanged.
          this._clearResponseWatchdog()
          this.toolExecuting = false
          this.errorCode = ''
          this.errorMessage = ''
          uni.showToast({ title: (getUiLocale() === 'zh-CN' && message) || t('companion.toolTurnFailed'), icon: 'none', duration: 3500 })
          break

        case 'TOOL_DELIVERY_UNCONFIRMED':
          this._clearResponseWatchdog()
          this.toolExecuting = false
          // Legacy unconfirmed state is not proof that the upstream disconnected.
          // Recover through the existing controller instead of silently muting forever.
          this.socket?.reconnectNow?.()
          break

        case 'CONTEXT_ATTACH_FAILED':
          this.confirmedArticle = null
          this.openingContextReady = false
          this.articleReceiptRevision += 1
          this.control?.pause()
          this.fail((getUiLocale() === 'zh-CN' && message) || t('companion.contextAttachFailed'))
          break

        case 'PARSE_ERROR':
          // 非阻塞，仅日志
          console.warn('[Voice] 服务端 PARSE_ERROR:', message)
          break

        default:
          // DashScope 透传错误
          if (message && (message.includes('no active response') || message.includes('another response is in progress'))) {
            // 协议竞态，忽略
            return
          }
          uni.showToast({ title: (getUiLocale() === 'zh-CN' && message) || t('companion.serviceTryAgain'), icon: 'none', duration: 2500 })
      }
    },

    handleUnexpectedClose() {
      if (this.ended) return
      // 正在重连中，不覆盖为断线错误（等重连结果）
      if (this.isReconnecting) return
      this.errorCode = 'UPSTREAM_DISCONNECTED'
      this.errorMessage = t('companion.voiceDisconnected')
      this.applyCompanionEvent({ type: 'error', message: this.errorMessage })
      this.toolExecuting = false
      this.stopStreamSlice()
      this.streamQueue = ''
      this.stopMicrophone()
      this.cancelReadProgress?.()
      if (this.player) this.player.stop()
      this.stopNativeVoiceSession()
    },

    handleReconnecting(event = {}) {
      if (this.ended) return
      this.control.disconnected()
      this.realtimeUploadReady = false
      this.isReconnecting = true
      if (event.scope === 'upstream' || event.upstream) {
        this.upstreamRecoveryState = 'RECOVERING'
        this.recoveryMessage = t('companion.aiRecovering')
      } else {
        this.transportRecoveryState = 'RECOVERING'
        this.recoveryMessage = event.message || t('companion.callRecovering')
      }
      this.errorCode = ''
      this.errorMessage = ''
      this.applyCompanionEvent({ type: 'clear_error' })
      if (event.transport || event.upstream) {
        // 网络断开后不继续播放旧回答，也不销毁 Native 录音会话；上传门控会
        // 丢弃重连期间采集的 PCM，恢复后只接收新声音。
        this.cancelOpeningForRecovery()
        this.cancelReadProgress?.()
        if (this.player) this.player.clear()
        this.playbackGeneration += 1
        this.suppressAiOutput = true
        this.phase = 'CONNECTING'
        this.voiceStore.setStatus(this.phase)
      }
      console.log('[Voice] Realtime 重连中:', event.message || '网络波动')
    },

    handleReconnected(event = {}) {
      if (this.ended) return
      if (event.session_uuid) this.sessionId = event.session_uuid
      this.control.connected(this.sessionId)
      this.control.rebind()
      if (event.scope === 'upstream' || event.upstream) this.upstreamRecoveryState = 'IDLE'
      else this.transportRecoveryState = 'IDLE'
      this.isReconnecting = this.transportRecoveryState === 'RECOVERING'
        || this.upstreamRecoveryState === 'RECOVERING'
      this.errorCode = ''
      this.errorMessage = ''
      this.applyCompanionEvent({ type: 'clear_error' })
      // 恢复正常通话状态
      if (this.phase === 'AI_SPEAKING' || this.phase === 'LISTENING' || this.phase === 'THINKING') {
        // 保持当前 phase，不强制切换
      } else {
        this.phase = 'LISTENING'
        this.voiceStore.setStatus(this.phase)
      }
      if (event.transport || event.upstream) {
        this.suppressAiOutput = false
        const nextTurnSeq = Number(event.next_turn_seq || 0)
        if (nextTurnSeq > 0) this.currentTurnSeq = nextTurnSeq
        this.activeResponseId = ''
        this.activeAudioTurn = 0
        this.activePlayedTurn = 0
        this.waitingForNextResponseStart = false
        this.interrupting = false
        this.cancelledOutputTurnSeqs = {}
        this.cancelledResponseIds = {}
        this.lastUserAsrFinalTurn = Math.max(0, this.currentTurnSeq - 1)
        this._clearAiBuffer()
        this.stopStreamSlice()
        this.streamQueue = ''
        this.streamQueueTurnSeq = 0
        this.phase = 'LISTENING'
        this.voiceStore.setStatus(this.phase)
      }
      if (!this.isReconnecting && !this.muted && this.socket && this.socket.uploadAllowed === true) {
        this.startMicrophone()
      }
      if (event.session_uuid) {
        this.sessionId = event.session_uuid
        this.voiceStore.setReady(this.sessionId)
      }
      console.log('[Voice] DashScope 重连成功:', event.message || '连接已恢复')
      uni.showToast({ title: t('companion.connectionRestored'), icon: 'none', duration: 1500 })
    },

    reconnect() {
      if (this.ended || this.destroyed) return
      if (this.failedRoleCode) { this.retryRoleChange(); return }
      this.errorCode = ''; this.errorMessage = ''
      this.applyCompanionEvent({ type: 'connection_start' })
      if (this.qaMode) {
        this.errorMessage = ''; this.errorCode = ''
        this.applyCompanionEvent({ type: 'socket_open' })
        this.applyCompanionEvent({ type: 'capture_ready' })
        this.control.connected(this.sessionId)
        return
      }
      this.errorCode = ''
      this.errorMessage = ''
      this.control.disconnected()
      this.phase = 'CONNECTING'
      this.voiceStore.setStatus(this.phase)
      this.stopMicrophone()
      this.cancelReadProgress?.()
      if (this.player) this.player.stop()
      if (this.socket && typeof this.socket.destroy === 'function') this.socket.destroy()
      this.unsubscribers.forEach(u => u())
      this.unsubscribers = []
      this.stopNativeVoiceSession()
      this.lifecycleSuspended = false
      this.realtimeSessionReady = false
      this.realtimeUploadReady = false
      // A stopped native/audio-context player needs fresh media adapters.
      // Preserve the business UUID and the controller's paused preferences.
      this.startCall({resume: Boolean(this.sessionId)})
    },

    handleSessionEnd() {
      if (this.ended) return
      this.resolveExitConfirmation?.(false)
      this.rememberListenReturnMode()
      this.ended = true
      if (this.control) this.control.end()
      this.toolExecuting = false
      this.flushStreamSlice()
      this.finishCurrentAiTurn()
      this.releaseCall()
      this.ended = true
      this.phase = 'ENDED'
      this.applyCompanionEvent({ type: 'ended' })
      this.voiceStore.end()
      this.openEndedSession()
    },

    handleVoiceSelected(event) {
      if (event.voice_name) {
        console.log('[Voice] 音色切换:', event.voice_name)
      }
    },

    onChatTouchStart() {
      this.chatTouching = true
      this.chatScrollRevision += 1
      this.scrollTarget = ''
    },
    onChatTouchMove() {
      this.chatMeasureRevision += 1
      this.chatFollowing = false
      this.chatScrollRevision += 1
      this.scrollTarget = ''
    },
    onChatWheel(event) {
      if (event.deltaY < 0) this.onChatTouchMove()
    },
    onChatKeydown(event) {
      if (['ArrowUp', 'PageUp', 'Home'].includes(event.key)) this.onChatTouchMove()
    },
    onChatTouchEnd() {
      this.chatTouching = false
    },
    onChatScroll(event) {
      const { scrollTop = 0, scrollHeight = 0 } = event.detail || {}
      const previousTop = this.chatScrollTop
      this.chatScrollTop = scrollTop
      // An upward gesture wins even while still inside the bottom tolerance.
      if (this.chatTouching && scrollTop < previousTop - 1) {
        this.chatFollowing = false
        this.chatScrollRevision += 1
        this.scrollTarget = ''
      }
      const revision = ++this.chatMeasureRevision
      const query = uni.createSelectorQuery().in(this)
      query.select('.chat-scroll').boundingClientRect()
      query.exec(results => {
        if (revision !== this.chatMeasureRevision || this.destroyed || !this.pageVisible || this.controlState.displayMode !== 'text') return
        const height = results?.[0]?.height
        if (!height) return
        const nearBottom = scrollHeight - scrollTop - height <= 24
        // Layout/font corrections also emit scroll: only user reading should
        // suspend follow, never an automatic correction after a bottom jump.
        if (!nearBottom && this.chatTouching) {
          this.chatFollowing = false
          this.chatScrollRevision += 1
          this.scrollTarget = ''
        }
        else if (nearBottom && scrollTop > previousTop + 1) this.chatFollowing = true
      })
    },
    returnToLatest() {
      this.chatMeasureRevision += 1
      this.chatFollowing = true
      this.chatTouching = false
      this.scrollToBottom()
    },
    scrollToBottom() {
      if (!this.chatFollowing || this.chatTouching || this.controlState.displayMode !== 'text') return
      const revision = ++this.chatScrollRevision
      this.scrollTarget = ''
      this.$nextTick(() => {
        if (revision !== this.chatScrollRevision || !this.chatFollowing || this.chatTouching || this.destroyed || !this.pageVisible || this.controlState.displayMode !== 'text') return
        this.scrollTarget = this.readingTurn ? 'companion-reading-position' : 'chat-bottom'
      })
    }
  }
}
</script>

<style scoped>
.role-retry { flex:none; min-width:44px; min-height:44px; margin:0 0 0 auto; padding:0 8px; color:inherit; background:transparent; font-size:12px; }
.call-controls .pause-call[disabled] { background:#191a17; border-color:#454641; }
.call-page{position:relative;height:var(--chrome-content-viewport-height,100dvh);box-sizing:border-box;background:var(--chrome-page-background);color:#f4f1e8;display:flex;flex-direction:column;overflow:hidden;}
.call-page::before{content:'';position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse 65% 35% at 84% 55%,rgba(212,173,112,.09),transparent 100%)}
.top-safe,.call-header,.voice-stage,.chat-scroll,.companion-status,.quiet-call-controls,.call-controls{position:relative;z-index:1}.top-safe{height:var(--chrome-top-content-inset);flex:none}
.call-header{width:min(100%,430px);box-sizing:border-box;margin:0 auto;padding:12px 16px 0 24px;flex:none}
.call-topbar{display:flex;align-items:center;min-height:48px;gap:24px}.role-entry{display:flex;align-items:center;gap:12px;margin:0;padding:0;min-height:44px;background:transparent;border:0;border-radius:8px;color:#f4f1e8;font-size:20px;font-weight:700;line-height:1.2;text-align:left}.role-entry image{height:15px;width:15px}.role-entry .role-entry-avatar{width:44px;height:44px;border-radius:50%;object-fit:cover}.role-entry-copy{display:flex;flex-direction:column;align-items:flex-start;gap:5px;min-width:0}.role-entry-name{font-size:18px;line-height:24px;font-weight:700;letter-spacing:.5px}.role-entry-description{font-size:12px;line-height:17px;font-weight:500;color:#929887}.role-entry .role-entry-chevron{width:16px;height:16px;margin-left:0;opacity:1}.top-actions{display:flex;flex:none;gap:4px;margin-left:auto}.top-action{width:44px;height:54px;padding:5px 0 4px;margin:0;display:flex;flex-direction:column;align-items:center;justify-content:space-between;background:transparent;border:0;border-radius:12px;color:#c6c7bf;font-size:11px;font-weight:400;line-height:16px;white-space:nowrap}.top-action:after{border:0}.top-action image{width:22px;height:22px;flex:none}.top-action:focus-visible{outline:2px solid #f5a524;outline-offset:-2px}.role-entry{min-width:0;flex:1;gap:8px}.role-entry-copy{flex:1;overflow:hidden}.role-entry-name,.role-entry-description{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.role-entry .role-entry-avatar,.role-entry .role-entry-chevron{flex:none}
.voice-stage{flex:1;min-height:0;width:min(100%,430px);margin:0 auto;display:flex;flex-direction:column;align-items:center;justify-content:space-between;gap:24px;padding:32px 24px 28px;box-sizing:border-box}
.hero-copy{display:flex;flex-direction:column;align-items:flex-start;align-self:stretch;gap:16px}.hero-kicker{color:#f5a524;letter-spacing:1.5px;font-size:10px;font-weight:700;line-height:1.5}.hero-title{font-family:var(--lr-font-heading);color:#f4f1e8;font-size:23px;line-height:1.6}.portrait-group{display:flex;flex-direction:column;align-items:center;flex:none;gap:7px;margin:auto 0}.role-portrait{width:220px;height:220px;flex:none}.portrait-name{font-size:17px;font-weight:500;color:#e7ddc8}.portrait-description{font-size:12px;color:#99988c}.role-entry{max-width:calc(100% - 96px);min-width:0;flex:1 1 auto}.role-entry text{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.role-entry image{flex:none}.role-pending{display:flex;align-items:center;gap:7px;width:max-content;max-width:100%;min-height:28px;box-sizing:border-box;margin-top:7px;padding:4px 10px;border:1px solid #5a4b34;border-radius:999px;background:#252118;color:#e5c99b;font-size:12px;line-height:1.35}.role-pending text{min-width:0}.role-pending-dot{width:6px;height:6px;flex:none;border-radius:50%;background:#e9aa4e;animation:role-switch-pulse var(--lr-ambient) var(--lr-ease-ambient) infinite}.role-error{border-color:#744a46;background:#271c1c;color:#f0a19a}.role-error .role-pending-dot{background:#f0a19a;animation:none}@keyframes role-switch-pulse{50%{opacity:.35;transform:scale(.7)}}@media(prefers-reduced-motion:reduce){.role-pending-dot{animation:none}}
.role-handoff{height:250px;max-width:100%;min-height:0;flex:0 1 250px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:15px;box-sizing:border-box}.role-handoff-faces{display:flex;align-items:center;justify-content:center;gap:12px}.role-handoff-person{width:104px;display:flex;flex-direction:column;align-items:center;gap:4px}.role-handoff-person image{width:96px;height:96px;border-radius:50%;box-sizing:border-box;border:2px solid #5b4e36;overflow:hidden}.role-handoff-person.is-current image{opacity:.68;border-color:#49463b}.role-handoff-person.is-next image{box-shadow:0 0 0 6px rgba(207,165,87,.08),0 0 28px rgba(207,165,87,.16)}.role-handoff-label{font-size:10px;color:#a9a79b}.role-handoff-name{font-size:16px;font-weight:700;color:#e9dfca}.role-handoff-link{width:54px;display:flex;align-items:center;gap:4px;color:#bda477;font-size:18px}.role-handoff-track{position:relative;flex:1;height:2px;border-radius:2px;background:#534a38;overflow:hidden}.role-handoff-pulse{position:absolute;inset:0;border-radius:2px;animation:role-handoff-flow var(--lr-ambient) var(--lr-ease-ambient) infinite}.role-handoff-pulse::after{content:"";display:block;width:12px;height:100%;border-radius:inherit;background:#efc777}.role-handoff-caption{font-size:12px;line-height:1.4;color:#b6a994;text-align:center}@keyframes role-handoff-flow{from{transform:translateX(-100%)}to{transform:translateX(100%)}}
.companion-status{width:min(100%,430px);margin:0 auto 64px;display:flex;flex-direction:column;align-items:center;gap:12px;flex:none;box-sizing:border-box;padding:0}.gold-wave{width:100%;height:68px;position:relative;margin-bottom:8px}.status-title,.status-subtitle{padding:0 24px;box-sizing:border-box}.status-title{font-size:22px;font-weight:500;text-align:center;line-height:1.4}.status-subtitle{font-size:13px;color:#a7a79e;text-align:center;line-height:1.5}
.chat-scroll{width:min(100%,430px);height:0;min-height:0;flex:1;margin:20px auto 16px}.chat-inner{padding:0 24px 12px;display:flex;flex-direction:column;gap:24px}.chat-intro{display:block;margin:12px 0 0;font-size:12px;font-weight:500;line-height:1.6;color:#a7a79e}.turn-row{display:flex;flex-direction:column;gap:9px;align-items:flex-start}.turn-speaker{font-size:13px;font-weight:500;color:#f5a524}.turn-bubble{width:100%;padding:20px;border-radius:22px;background:#191a17;border:1px solid #343530;max-width:100%;box-sizing:border-box}.turn-text{font-size:16px;color:#f4f1e8;line-height:1.8;word-break:break-word;white-space:pre-wrap}.user{align-items:flex-end}.user .turn-bubble{width:auto;max-width:calc(100% - 24px);background:#24251f;border-color:transparent}.user .turn-speaker{color:#a7a79e}.text-display .companion-status{align-items:flex-start;margin-bottom:32px;gap:6px}.text-display .status-title{font-size:12px;font-weight:500;color:#a7a79e;text-align:left;line-height:1.6}.text-display .status-subtitle{font-size:12px;text-align:left}.text-display .gold-wave{margin-bottom:14px}.spoken-text{color:#f0cb85;background:rgba(245,165,36,.1);border-radius:3px;box-decoration-break:clone;-webkit-box-decoration-break:clone}.typing-cursor{color:#dbbb80}.interrupt-hint{font-size:12px;color:#b69b63}.scroll-spacer{height:10px}.scroll-anchor{height:1px}
.call-controls{width:min(100%,430px);box-sizing:border-box;margin:0 auto;padding:0 24px calc(24px + var(--chrome-bottom-content-inset));display:flex;gap:8px;align-items:center;flex:none}.call-controls button{margin:0;padding:0;display:flex;justify-content:center;align-items:center;height:60px;min-height:44px;box-sizing:border-box;border-radius:16px;line-height:1}.call-controls image{width:24px;height:24px;flex:none}.input-toggle,.pause-call{width:64px;flex:none;background:#191a17;border:1px solid #454641}.exit-call{flex:1;background:#d94a2b;color:#fff;font-size:15px;font-weight:500;gap:10px}.exit-call.compact{width:44px;flex:none}.text-input-wrap{height:60px;display:flex;align-items:center;flex:1;min-width:0;border:1px solid #454641;border-radius:16px;background:#191a17;box-sizing:border-box;overflow:hidden}.text-input-wrap input{min-width:0;width:0;flex:1;color:#f4f1e8;font-size:14px;height:44px;padding-left:12px}.text-input-wrap .send-text{width:44px;height:44px;min-height:44px;flex:none;color:#dbbb80;background:transparent;font-size:23px;border-radius:10px}.call-controls button[disabled]{opacity:.4}.qa-diagnostics{position:absolute;display:none}.qa-volume-controls{position:fixed;right:6px;top:6px;z-index:200;display:flex;gap:4px}.qa-volume-controls button{font-size:10px;min-height:32px;line-height:32px;padding:0 6px;background:#393d33;color:#fff}.call-page>.role-mask{position:fixed;z-index:90;inset:0}
button::after{border:0}[role="button"]:focus-visible{outline:3px solid #f5a524;outline-offset:2px}button{cursor:pointer}

@media(max-height:740px){.voice-stage{gap:18px;padding-top:20px;padding-bottom:16px}.hero-copy{gap:8px}.role-portrait{width:174px;height:174px}.companion-status{margin-bottom:22px;gap:8px}.gold-wave{margin-bottom:0}.call-controls{padding-bottom:calc(16px + var(--chrome-bottom-content-inset))}}
@media(max-height:740px){.role-handoff{height:205px;flex-basis:205px;gap:9px}.role-handoff-person{width:84px}.role-handoff-person image{width:74px;height:74px}.role-handoff-link{width:42px}.role-handoff-caption{font-size:11px}}
@media(max-height:580px){.hero-copy,.portrait-description{display:none}.voice-stage{gap:8px;padding:4px}.role-portrait{width:144px;height:144px}.companion-status{margin-bottom:12px;gap:3px}.gold-wave{height:24px}.status-title{font-size:18px}.chat-scroll{margin-top:10px;margin-bottom:8px}}
@media(max-height:580px){.role-handoff{height:135px;flex-basis:135px;gap:4px}.role-handoff-person image{width:56px;height:56px}.role-handoff-caption{display:none}}
/* English labels need their own row; retain full copy and 44px touch targets. */
.is-english .call-topbar{flex-wrap:wrap;gap:10px}
.is-english .role-entry{flex:1 1 100%;width:100%;max-width:100%}
.is-english .role-entry-copy{overflow:visible}
.is-english .role-entry-name,.is-english .role-entry-description{white-space:normal;overflow:visible;text-overflow:clip}
.is-english .role-entry-description{font-size:12px;line-height:17px}
.is-english .top-actions{width:100%;margin-left:0;gap:8px}
.is-english .top-action{flex:1;width:0;min-width:0;min-height:44px;height:auto;padding:8px 4px;flex-direction:row;justify-content:center;gap:6px;line-height:16px;white-space:normal}
.is-english .top-action text{min-width:0;overflow-wrap:break-word}
@media(max-width:350px){.role-entry .role-entry-avatar{width:32px;height:32px}.role-entry{gap:6px}.role-entry-name{font-size:16px}.role-entry-description{font-size:10px}}
@media(max-width:380px){.call-header{padding-left:16px;padding-right:16px}.call-topbar{gap:16px}.call-controls{padding-left:16px;padding-right:16px}.hero-title{font-size:23px}}
@media(prefers-reduced-motion:reduce){.typing-cursor,.ldot,.role-handoff-pulse,.role-pending-dot{animation:none}}
/* #ifdef APP-PLUS */
.call-page{position:fixed;inset:0;height:auto}
/* #endif */
/* Compact from measured usable height too: native keyboard may contract before media queries do. */
.call-page.is-short-viewport{--role-notice-reserve:0px}
.call-page.is-short-viewport.has-role-notice{--role-notice-reserve:28px}
.is-short-viewport .hero-copy,.is-short-viewport .portrait-description,.is-short-viewport .portrait-name{display:none}
.is-short-viewport .voice-stage{gap:8px;padding:4px}
.is-short-viewport .role-handoff{height:100px;flex-basis:100px;gap:3px}.is-short-viewport .role-handoff-person image{width:46px;height:46px}.is-short-viewport .role-handoff-caption,.is-short-viewport .role-handoff-label{display:none}
.is-short-viewport .role-portrait{width:clamp(24px,calc(var(--chrome-content-viewport-height) - var(--chrome-top-content-inset) - var(--chrome-bottom-content-inset) - var(--role-notice-reserve) - 244px),106px);height:clamp(24px,calc(var(--chrome-content-viewport-height) - var(--chrome-top-content-inset) - var(--chrome-bottom-content-inset) - var(--role-notice-reserve) - 244px),106px)}
.is-short-viewport .companion-status{margin-bottom:12px;gap:3px}
.is-short-viewport .gold-wave{height:24px;margin-bottom:0}
.is-short-viewport .status-title{font-size:18px}
.is-short-viewport.text-display .status-title{font-size:12px}
/* 引用徽章 */
.cite-badge {
  color: #6090e8;
  font-weight: 700;
  padding: 2rpx 4rpx;
  pointer-events: auto;
  z-index: 5;
}

/* 浮动卡片 */
.cite-overlay {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,.55);
  z-index: 100;
  display: flex; align-items: center; justify-content: center;
}
.cite-card {
  width: 580rpx;
  max-height: 600rpx;
  background: #1c1c24;
  border-radius: 24rpx;
  border: 1rpx solid rgba(255,255,255,.1);
  overflow: auto;
  overscroll-behavior: contain;
  max-height: min(600rpx, 85vh);
  display: flex; flex-direction: column;
}
.cite-cover {
  width: 100%; height: 280rpx;
  background: #2a2a32;
}
.cite-title {
  font-size: 28rpx; font-weight: 700; color: #e8e8ed;
  padding: 20rpx 24rpx 8rpx;
  line-height: 38rpx;
}
.cite-summary {
  font-size: 24rpx; color: #9898a2;
  padding: 8rpx 24rpx 4rpx;
  line-height: 36rpx;
}
.cite-link-tip {
  font-size: 20rpx; color: #6090e8;
  padding: 4rpx 24rpx 24rpx;
}

/* Tavily 来源行 */
.cite-source-row {
  flex-direction: row; align-items: center;
  padding: 20rpx 24rpx 0;
}
.cite-source-icon {
  font-size: 36rpx; margin-right: 12rpx;
}
.cite-domain {
  font-size: 22rpx; color: #808890;
  flex: 1;
}
.cite-meta-row {
  flex-direction: row; flex-wrap: wrap; align-items: center;
  padding: 8rpx 24rpx 4rpx; gap: 12rpx;
}
.cite-source-type {
  font-size: 20rpx; color: #b0a060;
  background: rgba(176,160,96,.15);
  border-radius: 6rpx; padding: 2rpx 10rpx;
}
.cite-score {
  font-size: 20rpx; color: #60b080;
}
.cite-date {
  font-size: 20rpx; color: #808890;
}

.listening-row { display: flex; align-items: center; gap: 16rpx; padding: 8rpx 6rpx; }
.search-sources-entry {
  align-self: flex-start;
  margin: 8rpx 0 0;
  padding: 6px 0;
  background: transparent;
  color: #bba57f;
  font-size: 12px;
  line-height: 1.6;
}
.listening-dots { display: flex; gap: 7rpx; }
.ldot { width: 10rpx; height: 10rpx; border-radius: 50%; background: #d8b880; animation: dot-pulse var(--lr-ambient) var(--lr-ease-ambient) infinite; }
@keyframes dot-pulse { 0%,100%{opacity:.4} 50%{opacity:1} }
.listening-text { font-size: 24rpx; color: #c7b391; font-weight: 500; }

.scroll-spacer { flex-shrink: 0; }
.chat-latest { position:absolute; z-index:3; right:24px; top:calc(var(--chrome-top-content-inset) + 76px); min-height:44px; margin:0; padding:0 16px; display:flex; align-items:center; border:1px solid #454641; border-radius:22px; background:#24251f; color:#f0cb85; font-size:13px; line-height:1.5; }
.has-overlay .chat-latest { visibility:hidden; }

/* 重连中横幅 */
.reconnecting-banner {
  margin: 20rpx 40rpx 0;
  padding: 16rpx 24rpx;
  background: rgba(216,184,128,.08);
  border: 1rpx solid rgba(216,184,128,.22);
  border-radius: 16rpx;
  display: flex; flex-direction: row; align-items: center; justify-content: center; gap: 12rpx;
}
.reconnecting-dot {
  width: 16rpx; height: 16rpx; border-radius: 50%;
  background: #d8b880; animation: dot-pulse var(--lr-ambient) var(--lr-ease-ambient) infinite;
}
.reconnecting-text {
  color: #d8c7a7; font-size: 24rpx; line-height: 34rpx;
}

.error-tip { margin: 16rpx 40rpx 0; color: #ff9b9b; font-size: 22rpx; line-height: 32rpx; text-align: center; }

.error-fatal {
  width: calc(100% - 32px); max-width: 382px; box-sizing: border-box; flex: none;
  margin: 8px auto 12px;
  padding: 12px 16px;
  background: rgba(255,80,80,.12);
  border: 1px solid rgba(255,80,80,.25);
  border-radius: 12px;
  display: flex; flex-direction: column; align-items: center; gap: 10px;
}
.has-connection-error .hero-copy,.has-connection-error .portrait-name,.has-connection-error .portrait-description { display: none; }
.has-connection-error .voice-stage { padding: 12px 24px; gap: 8px; }
.has-connection-error .role-portrait { width: 144px; height: 144px; }
.error-fatal-text {
  color: #ff8080; font-size: 13px; line-height: 20px; text-align: center;
}
.reconnect-btn {
  min-height: 44px; padding: 0 24px; display: flex; align-items: center; justify-content: center;
  background: #ff5050; border-radius: 22px;
}
.reconnect-btn text {
  color: #fff; font-size: 14px; font-weight: 500;
}

.call-page[data-active="false"] .ldot,.call-page[data-active="false"] .reconnecting-dot,.call-page[data-active="false"] .role-handoff-pulse,.call-page[data-active="false"] .role-pending-dot,.is-paused .ldot,.is-paused .reconnecting-dot,.has-overlay .ldot,.has-overlay .reconnecting-dot{animation:none}
@media(prefers-reduced-motion:reduce){.ldot,.reconnecting-dot{animation:none}}

.role-portrait{border-radius:50%;border:1px solid #79633f;box-shadow:0 0 0 8px rgba(214,181,126,.035),0 16px 42px rgba(0,0,0,.2);box-sizing:border-box}
.turn-text{user-select:text;-webkit-user-select:text}
</style>

<style scoped>
.is-quiet-entry .hero-title{font-size:24px}.is-quiet-entry .companion-status{flex:none}.is-quiet-entry .gold-wave{height:2px;background:rgba(245,165,36,.3);margin:0 0 20px}.is-quiet-entry .gold-wave>*{display:none}
.quiet-call-controls{padding:12px 24px 16px;display:flex;flex-direction:column;gap:12px;flex-shrink:0}.quiet-voice-start,.quiet-text-start{width:100%;min-height:56px;margin:0;border-radius:16px;font-size:16px;line-height:1.4;display:flex;align-items:center;justify-content:center}.quiet-voice-start{background:#f5a524;color:#171816}.quiet-text-start{background:#191a17;color:#f4f1e8;border:1px solid #454641}.quiet-text-hint{font-size:14px;text-align:center;color:#c6c7bf;padding:8px 0 16px}.quiet-context{padding:12px 16px;border:1px solid #454641;border-radius:16px;background:#191a17;display:flex;flex-direction:column;gap:8px;font-size:14px;max-height:84px;overflow:auto}.quiet-context-label{font-size:11px;color:#a7a79e}.quiet-exit{background:transparent;color:#a7a79e;font-size:12px;min-height:44px;margin:0}.quiet-call-controls button::after{border:0}
.turn-text{user-select:text;-webkit-user-select:text}
</style>

<style scoped>
.is-quiet-entry .portrait-name,.is-quiet-entry .portrait-description{display:none}.is-quiet-entry .companion-status{margin-bottom:12px}.quiet-call-controls{width:min(100%,430px);box-sizing:border-box;margin:0 auto;padding-bottom:calc(12px + var(--chrome-bottom-content-inset))}.is-quiet-entry .portrait-group{min-height:0}.is-quiet-entry .role-portrait{max-height:100%;object-fit:cover}
@media(max-height:640px){.is-quiet-entry .hero-copy{display:none}.quiet-call-controls{gap:8px}.quiet-text-hint{padding:0}.is-quiet-entry .companion-status{gap:6px}.is-quiet-entry .status-title{font-size:18px}.is-quiet-entry .gold-wave{margin-bottom:8px}}
</style>

<style scoped>
.is-quiet-entry .gold-wave{width:calc(100% - 48px)}
</style>

<style scoped>
.call-page>.speaker-layer{position:absolute;inset:0;z-index:1100}
</style>

<style scoped>
.cite-badge{display:inline-flex;align-items:center;justify-content:center;min-width:24px;min-height:24px;margin:0 2px;padding:0 4px;background:transparent;font-size:inherit;line-height:inherit;vertical-align:baseline;border:0;border-radius:4px}
.search-sources-entry{margin-left:0;margin-right:0;text-align:left;min-height:44px;display:flex;align-items:center;border-radius:4px}
.cite-actions{display:flex;gap:12px;padding:12px;flex:none}.cite-action{min-height:44px;flex:1;margin:0;display:flex;align-items:center;justify-content:center;font-size:14px;line-height:1.5;background:#292b32;color:#f4f1e8;border-radius:10px}
.error-tip{display:flex;align-items:center;gap:8px;flex:none}.error-tip>text{flex:1;min-width:0}.error-action{flex:none;min-width:44px;min-height:44px;margin:0;padding:0 10px;display:flex;align-items:center;justify-content:center;font-size:13px;line-height:1.5;color:#f4f1e8;background:#343530;border-radius:10px}
.text-display.has-keyboard .gold-wave,.text-display.is-short-viewport .gold-wave{display:none}
.text-display.has-keyboard .companion-status,.text-display.is-short-viewport .companion-status{margin-bottom:8px;gap:2px}
.text-display.has-keyboard .chat-scroll,.text-display.is-short-viewport .chat-scroll{margin-top:8px;margin-bottom:8px}
.text-display.has-keyboard .call-controls,.text-display.is-short-viewport .call-controls{padding-bottom:calc(8px + var(--chrome-bottom-content-inset))}
</style>

<style scoped>
/* Keep the same controls in keyboard mode; enlarge only the three-button row. */
.text-input-controls .input-toggle,.text-input-controls .pause-call{width:44px}
.is-quiet-entry .voice-stage{gap:16px;padding:24px 24px 20px;overflow:hidden}
.is-quiet-entry .hero-copy{flex:none;gap:10px}
.is-quiet-entry .portrait-group{flex:1;width:100%;min-height:0;margin:0;justify-content:center;overflow:hidden}
.is-quiet-entry .role-portrait{width:min(220px,100%);height:100%;max-height:220px;aspect-ratio:1;object-fit:contain;flex-shrink:1;width:auto;max-width:220px}
.is-quiet-entry .gold-wave{flex:none;margin:0 0 12px}
.is-quiet-entry .companion-status{gap:8px;margin-bottom:8px}
.quiet-call-controls{gap:10px;padding-top:8px}
.quiet-text-hint{padding:0 0 4px;font-size:13px;line-height:20px}
.quiet-auto-start{text-align:center;color:#a7a79e;font-size:14px;line-height:24px;padding:12px 0}
@media(max-height:740px){.is-quiet-entry .voice-stage{padding-top:16px;padding-bottom:16px;gap:12px}.is-quiet-entry .hero-title{font-size:21px}.is-quiet-entry .status-title{font-size:20px}.quiet-voice-start,.quiet-text-start{min-height:48px}}
@media(max-height:640px){.is-quiet-entry .hero-copy{display:none}.is-quiet-entry .voice-stage{padding:12px 24px}.quiet-call-controls{gap:8px}}
</style>

<style scoped>
.companion-article-source{position:relative;z-index:1;flex:none;width:min(100%,430px);box-sizing:border-box;margin:18px auto 0;padding:0 24px;text-align:left;background:transparent;border:0;border-radius:0;line-height:1.5;color:#d8c6a0}
.companion-article-label{display:block;font-size:12px;color:#a7a79e;line-height:20px;margin-bottom:4px}
.companion-article-title{display:flex;align-items:center;gap:16px;font-size:16px;line-height:24px}
.companion-article-title>text:first-child{flex:1;min-width:0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.companion-article-title>text:last-child{flex:none;font-size:24px;color:#a7a79e}
.has-overlay .companion-article-source{visibility:hidden}
@media(max-height:700px){.companion-article-source{margin-top:12px}.companion-article-title{font-size:15px}}
</style>

<style scoped>
/* Keep the circular mask separate from the artwork's own rounded frame. */
.role-entry .role-entry-avatar{overflow:hidden;flex:none}
.role-entry .role-entry-avatar image,.role-portrait .role-portrait-image{display:block;width:100%;height:100%}
.role-portrait{overflow:hidden}
/* Center the crop so the artwork's inset black frame is removed on every edge. */
.role-entry-avatar.is-interviewer image,.role-portrait.is-interviewer .role-portrait-image{transform:scale(1.12);transform-origin:center}
</style>
