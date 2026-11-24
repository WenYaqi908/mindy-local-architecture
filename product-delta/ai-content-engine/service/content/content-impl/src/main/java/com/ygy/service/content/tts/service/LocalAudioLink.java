package com.ygy.service.content.tts.service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;

/** Temporary playback links checked by the local Nginx entry.
 * The digest matches nginx secure_link_md5 "$secure_link_expires$uri $secret". */
final class LocalAudioLink {

    private LocalAudioLink() {
    }

    static String url(String baseUrl, String secret, String objectKey, long expiresEpoch) {
        String base = baseUrl.endsWith("/") ? baseUrl.substring(0, baseUrl.length() - 1) : baseUrl;
        String path = objectKey.startsWith("/") ? objectKey : "/" + objectKey;
        String material = expiresEpoch + path + " " + secret;
        byte[] digest;
        try {
            digest = MessageDigest.getInstance("MD5").digest(material.getBytes(StandardCharsets.UTF_8));
        } catch (Exception failed) {
            throw new IllegalStateException("MD5 is unavailable", failed);
        }
        String md5 = Base64.getUrlEncoder().withoutPadding().encodeToString(digest);
        return base + path + "?md5=" + md5 + "&expires=" + expiresEpoch;
    }
}
