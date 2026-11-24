-- Tables Hibernate does not create, plus the session context column the
-- product schema already declares as LONGTEXT. Safe to run more than once.
-- On a brand-new database ai_session may not exist yet; the column change
-- waits until it does. The entity now also declares LONGTEXT.

CREATE TABLE IF NOT EXISTS ai_session_summary (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    member_id BIGINT UNSIGNED NOT NULL,
    session_id BIGINT UNSIGNED NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    memory_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    summary_text VARCHAR(600) NULL,
    summary_json JSON NULL,
    covered_max_sequence BIGINT UNSIGNED NOT NULL DEFAULT 0,
    prompt_version VARCHAR(64) NOT NULL,
    summary_attempt_count INT UNSIGNED NOT NULL DEFAULT 0,
    memory_attempt_count INT UNSIGNED NOT NULL DEFAULT 0,
    summary_lease_until DATETIME(3) NULL,
    memory_lease_until DATETIME(3) NULL,
    summary_lease_token CHAR(36) NULL,
    memory_lease_token CHAR(36) NULL,
    last_summary_error VARCHAR(500) NULL,
    last_memory_error VARCHAR(500) NULL,
    requested_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    summary_completed_at DATETIME(3) NULL,
    memory_completed_at DATETIME(3) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    UNIQUE KEY uk_ai_session_summary_session (session_id),
    KEY idx_ai_session_summary_member (member_id, status, requested_at),
    KEY idx_ai_session_summary_memory (member_id, memory_status, requested_at),
    CONSTRAINT ck_ai_session_summary_status CHECK (status IN ('PENDING','PROCESSING','COMPLETED','FAILED','SKIPPED')),
    CONSTRAINT ck_ai_session_summary_memory_status CHECK (memory_status IN ('PENDING','PROCESSING','COMPLETED','FAILED','SKIPPED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS member_block (
    member_id BIGINT NOT NULL,
    blocked_member_id BIGINT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (member_id, blocked_member_id)
);

CREATE TABLE IF NOT EXISTS moderation_record (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 record_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 idempotency_key CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 subject_type VARCHAR(32) NOT NULL,
 subject_id VARCHAR(128), member_id BIGINT,
 field_name VARCHAR(64) NOT NULL,
 scene VARCHAR(32) NOT NULL, direction VARCHAR(24) NOT NULL DEFAULT 'USER_INPUT',
 session_id VARCHAR(128) COLLATE utf8mb4_0900_ai_ci, turn_id VARCHAR(128) COLLATE utf8mb4_0900_ai_ci, response_id VARCHAR(128) COLLATE utf8mb4_0900_ai_ci,
 content_revision VARCHAR(128) NOT NULL,
 policy_version VARCHAR(64) NOT NULL,
 text_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 evidence_text TEXT, evidence_source VARCHAR(32) NOT NULL DEFAULT 'SERVER',
 vendor_service VARCHAR(80) NOT NULL,
 decision VARCHAR(24) NOT NULL,
 risk_level VARCHAR(24), risk_labels JSON,
 review_status VARCHAR(24) NOT NULL DEFAULT 'NOT_REQUIRED', review_conclusion VARCHAR(1000),
 vendor_request_id VARCHAR(128), error_code VARCHAR(100),
 attempt_count INT NOT NULL DEFAULT 0, chunk_state JSON,
 version BIGINT NOT NULL DEFAULT 0,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
 UNIQUE KEY uk_moderation_record (record_id), UNIQUE KEY uk_moderation_idempotency (idempotency_key),
 KEY idx_moderation_member_time (member_id,created_at),
 KEY idx_moderation_review_time (review_status,created_at),
 KEY idx_moderation_scene_time (scene,created_at),
 KEY idx_moderation_turn (member_id,session_id,turn_id,scene,decision),
 CONSTRAINT ck_moderation_decision CHECK (decision IN ('PENDING','PASS','BLOCK','REVIEW','UNAVAILABLE'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS management_action (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 action_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 request_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 payload_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 target_type VARCHAR(32) NOT NULL, target_id VARCHAR(128) NOT NULL,
 record_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin,
 action_type VARCHAR(32) NOT NULL, scope VARCHAR(32) NOT NULL DEFAULT 'NONE',
 reason VARCHAR(1000) NOT NULL, operator VARCHAR(128) NOT NULL, source VARCHAR(32) NOT NULL,
 starts_at DATETIME(3), expires_at DATETIME(3),
 execution_status VARCHAR(24) NOT NULL DEFAULT 'PENDING', effective_status VARCHAR(24) NOT NULL DEFAULT 'INACTIVE',
 revoked_at DATETIME(3), revoked_by VARCHAR(128), revoke_reason VARCHAR(1000),
 result_json JSON, error_code VARCHAR(100), version BIGINT NOT NULL DEFAULT 0,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
 UNIQUE KEY uk_management_action (action_id),
 UNIQUE KEY uk_management_request (request_id,target_type,target_id,scope),
 KEY idx_management_effective (target_type,target_id,effective_status,expires_at),
 KEY idx_management_record (record_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET @context_sql := (
  SELECT IF(COUNT(*) = 0, 'SELECT 1',
    'ALTER TABLE ai_session MODIFY COLUMN context_data LONGTEXT COMMENT ''上下文数据，如搜索历史/引用来源等''')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ai_session' AND COLUMN_NAME = 'context_data'
    AND DATA_TYPE <> 'longtext'
);
PREPARE context_stmt FROM @context_sql;
EXECUTE context_stmt;
DEALLOCATE PREPARE context_stmt;
