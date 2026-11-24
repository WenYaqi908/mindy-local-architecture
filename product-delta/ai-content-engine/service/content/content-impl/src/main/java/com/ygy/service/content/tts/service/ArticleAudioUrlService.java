package com.ygy.service.content.tts.service;

import com.ygy.service.content.api.dto.ArticleTtsStatus;
import com.ygy.service.content.tts.config.ArticleTtsProperties;
import com.ygy.service.content.tts.entity.AiTtsTask;
import com.ygy.starter.oss.service.OssService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

@Service
@RequiredArgsConstructor
public class ArticleAudioUrlService {

    private static final int OSS_V4_MAX_URL_HOURS = 7 * 24;
    /** Nginx only accepts this prefix. Other keys stay on the original signer. */
    private static final String LOCAL_LISTEN_PREFIX = "local-listen/";

    private final OssService ossService;
    private final ArticleTtsProperties properties;
    private final EnglishListeningAudioSigner englishSigner;

    @Value("${mindy.content.local-audio.base-url:}")
    private String localAudioBaseUrl = "";
    @Value("${mindy.content.local-audio.secret:}")
    private String localAudioSecret = "";
    @Value("${mindy.content.local-audio.bucket:}")
    private String localAudioBucket = "";

    public Playback resolve(AiTtsTask task) {
        if (task == null || task.getStatus() != ArticleTtsStatus.SUCCEEDED
                || !StringUtils.hasText(task.getAudioObjectKey())) {
            return new Playback(null, null);
        }
        return resolveObjectKey(task.getAudioObjectKey());
    }

    /** Sign an already validated audio/transcript object key with the TTS playback TTL. */
    public Playback resolveObjectKey(String objectKey) {
        if (!StringUtils.hasText(objectKey)) {
            return new Playback(null, null);
        }
        int ttlHours = properties.getSignedUrlTtlHours();
        Playback local = localPlayback(objectKey, ttlHours);
        if (local != null) {
            return local;
        }
        String url = ossService.getSignedUrl(objectKey, ttlHours);
        if (StringUtils.hasText(url)) {
            url = url.replaceFirst("(?i)^http://", "https://");
        }
        return new Playback(url, Instant.now().plus(ttlHours, ChronoUnit.HOURS));
    }

    public Playback resolveEnglishObjectKey(String objectKey, String bucket, String versionId) {
        int ttlHours = Math.min(properties.getSignedUrlTtlHours(), OSS_V4_MAX_URL_HOURS);
        if (localAudioEnabled() && localAudioBucket.equals(bucket)
                && StringUtils.hasText(versionId) && StringUtils.hasText(objectKey)) {
            Playback local = localPlayback(objectKey, ttlHours);
            if (local != null) {
                return local;
            }
        }
        String url = englishSigner.getSignedUrl(objectKey, bucket, versionId, ttlHours);
        if (!StringUtils.hasText(url)) {
            return new Playback(null, null);
        }
        return new Playback(url, Instant.now().plus(ttlHours, ChronoUnit.HOURS));
    }

    public record Playback(String url, Instant expiresAt) {
    }

    void useLocalAudio(String baseUrl, String secret, String bucket) {
        this.localAudioBaseUrl = baseUrl;
        this.localAudioSecret = secret;
        this.localAudioBucket = bucket;
    }

    private boolean localAudioEnabled() {
        return StringUtils.hasText(localAudioBaseUrl) && StringUtils.hasText(localAudioSecret);
    }

    private Playback localPlayback(String objectKey, int ttlHours) {
        if (!localAudioEnabled() || ttlHours <= 0 || !objectKey.startsWith(LOCAL_LISTEN_PREFIX)) {
            return null;
        }
        Instant expiresAt = Instant.now().plus(ttlHours, ChronoUnit.HOURS);
        return new Playback(LocalAudioLink.url(localAudioBaseUrl, localAudioSecret, objectKey, expiresAt.getEpochSecond()), expiresAt);
    }
}
