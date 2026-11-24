package com.ygy.service.content.tts.service;

import com.ygy.service.content.api.dto.ArticleTtsStatus;
import com.ygy.service.content.tts.config.ArticleTtsProperties;
import com.ygy.service.content.tts.entity.AiTtsTask;
import com.ygy.starter.oss.service.OssService;
import org.junit.jupiter.api.Test;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class ArticleAudioUrlServiceTest {

    @Test
    void signsSuccessfulObjectKeyForConfiguredTtl() {
        OssService oss = mock(OssService.class);
        ArticleTtsProperties properties = new ArticleTtsProperties();
        ArticleAudioUrlService service = new ArticleAudioUrlService(oss, properties, mock(EnglishListeningAudioSigner.class));
        AiTtsTask task = new AiTtsTask();
        task.setStatus(ArticleTtsStatus.SUCCEEDED);
        task.setAudioObjectKey("article-tts/899/longxiaochun.mp3");
        when(oss.getSignedUrl("article-tts/899/longxiaochun.mp3", 1))
                .thenReturn("https://signed.example/audio.mp3");

        var playback = service.resolve(task);

        assertEquals("https://signed.example/audio.mp3", playback.url());
        assertNotNull(playback.expiresAt());
        verify(oss).getSignedUrl("article-tts/899/longxiaochun.mp3", 1);
    }

    @Test
    void upgradesHttpSignedUrlToHttpsForAndroidPlayback() {
        OssService oss = mock(OssService.class);
        ArticleAudioUrlService service = new ArticleAudioUrlService(oss, new ArticleTtsProperties(), mock(EnglishListeningAudioSigner.class));
        AiTtsTask task = new AiTtsTask();
        task.setStatus(ArticleTtsStatus.SUCCEEDED);
        task.setAudioObjectKey("article-tts/899/longxiaochun.wav");
        when(oss.getSignedUrl("article-tts/899/longxiaochun.wav", 1))
                .thenReturn("http://lightread.oss-cn-hangzhou.aliyuncs.com/article-tts/899/longxiaochun.wav?Expires=1&Signature=test");

        var playback = service.resolve(task);

        assertEquals(
                "https://lightread.oss-cn-hangzhou.aliyuncs.com/article-tts/899/longxiaochun.wav?Expires=1&Signature=test",
                playback.url());
    }

    @Test
    void pendingOrMissingObjectKeyHasNoPlaybackUrl() {
        OssService oss = mock(OssService.class);
        ArticleAudioUrlService service = new ArticleAudioUrlService(oss, new ArticleTtsProperties(), mock(EnglishListeningAudioSigner.class));
        AiTtsTask task = new AiTtsTask();
        task.setStatus(ArticleTtsStatus.PENDING);

        var playback = service.resolve(task);

        assertNull(playback.url());
        assertNull(playback.expiresAt());
        verify(oss, never()).getSignedUrl(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.anyInt());
    }

    @Test
    void signsVariantObjectKeysWithTheSamePlaybackPolicy() {
        OssService oss = mock(OssService.class);
        ArticleAudioUrlService service = new ArticleAudioUrlService(oss, new ArticleTtsProperties(), mock(EnglishListeningAudioSigner.class));
        when(oss.getSignedUrl("listen/899/geek-debate.wav", 1))
                .thenReturn("http://signed.example/geek-debate.wav");

        var playback = service.resolveObjectKey("listen/899/geek-debate.wav");

        assertEquals("https://signed.example/geek-debate.wav", playback.url());
        assertNotNull(playback.expiresAt());
    }

    @Test
    void reviewedEnglishTtlIsBoundedToTheV4LimitAndMissesNeverUseMainOss() {
        OssService oss = mock(OssService.class);
        var english = mock(EnglishListeningAudioSigner.class);
        var properties = new ArticleTtsProperties();
        properties.setSignedUrlTtlHours(365 * 24);
        var service = new ArticleAudioUrlService(oss, properties, english);
        when(english.getSignedUrl("listen/en-US/reviewed.wav", "english-media", "reviewed+/=", 168))
                .thenReturn("https://signed.example/reviewed.wav?versionId=reviewed%2B%2F%3D");

        var playback = service.resolveEnglishObjectKey("listen/en-US/reviewed.wav", "english-media", "reviewed+/=");
        var missing = service.resolveEnglishObjectKey("listen/en-US/reviewed.wav", "wrong-bucket", "reviewed+/=");

        assertEquals("https://signed.example/reviewed.wav?versionId=reviewed%2B%2F%3D", playback.url());
        assertNotNull(playback.expiresAt());
        assertNull(missing.url());
        assertNull(missing.expiresAt());
        verifyNoInteractions(oss);
    }

    @Test
    void localEntrySignsPlaybackWithoutCallingCloudStorage() throws Exception {
        OssService oss = mock(OssService.class);
        var english = mock(EnglishListeningAudioSigner.class);
        var service = new ArticleAudioUrlService(oss, new ArticleTtsProperties(), english);
        service.useLocalAudio("https://wendydemacbook-air.local:8443", "unit-test-secret", "mindy-local-english");

        var englishPlayback = service.resolveEnglishObjectKey("local-listen/en.wav", "mindy-local-english", "local-v1");
        var chinesePlayback = service.resolveObjectKey("local-listen/zh.wav");
        var otherBucket = service.resolveEnglishObjectKey("local-listen/en.wav", "dedicated-en", "reviewed");

        assertLocalLink(englishPlayback.url(), "/local-listen/en.wav");
        assertLocalLink(chinesePlayback.url(), "/local-listen/zh.wav");
        assertNull(otherBucket.url());
        verifyNoInteractions(oss);
        verify(english).getSignedUrl("local-listen/en.wav", "dedicated-en", "reviewed", 1);
    }

    @Test
    void localEntryDoesNotSignTranscriptsOrOtherAudio() throws Exception {
        OssService oss = mock(OssService.class);
        var english = mock(EnglishListeningAudioSigner.class);
        var service = new ArticleAudioUrlService(oss, new ArticleTtsProperties(), english);
        service.useLocalAudio("https://wendydemacbook-air.local:8443", "unit-test-secret", "mindy-local-english");
        when(oss.getSignedUrl("transcripts/foo.json", 1)).thenReturn("https://signed.example/transcript.json");
        when(oss.getSignedUrl("audio/zh.wav", 1)).thenReturn("https://signed.example/zh.wav");
        when(english.getSignedUrl("audio/en.wav", "mindy-local-english", "local-v1", 1))
                .thenReturn("https://signed.example/en.wav");

        var transcript = service.resolveObjectKey("transcripts/foo.json");
        var otherAudio = service.resolveObjectKey("audio/zh.wav");
        var englishAudio = service.resolveEnglishObjectKey("audio/en.wav", "mindy-local-english", "local-v1");
        var local = service.resolveObjectKey("local-listen/zh.wav");

        assertEquals("https://signed.example/transcript.json", transcript.url());
        assertEquals("https://signed.example/zh.wav", otherAudio.url());
        assertEquals("https://signed.example/en.wav", englishAudio.url());
        assertLocalLink(local.url(), "/local-listen/zh.wav");
        verify(oss, never()).getSignedUrl("local-listen/zh.wav", 1);
    }

    private static void assertLocalLink(String url, String path) throws Exception {
        URI uri = URI.create(url);
        assertEquals("https", uri.getScheme());
        assertEquals("wendydemacbook-air.local", uri.getHost());
        assertEquals(8443, uri.getPort());
        assertEquals(path, uri.getPath());
        String expires = null;
        String md5 = null;
        for (String part : uri.getRawQuery().split("&")) {
            String[] pair = part.split("=", 2);
            if ("expires".equals(pair[0])) expires = pair[1];
            if ("md5".equals(pair[0])) md5 = pair[1];
        }
        byte[] digest = MessageDigest.getInstance("MD5")
                .digest((expires + path + " unit-test-secret").getBytes(StandardCharsets.UTF_8));
        assertEquals(Base64.getUrlEncoder().withoutPadding().encodeToString(digest), md5);
    }
}
