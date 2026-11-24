package com.ygy.service.content.impl.entity;

import lombok.Data;
import jakarta.persistence.*;
import java.util.Date;

@Data
@Entity
@Table(name = "ai_session")
public class AiSession {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(name = "session_uuid", unique = true, nullable = false)
    private String sessionUuid;
    
    @Column(name = "member_id", nullable = false)
    private Long memberId;
    
    private String title;
    
    @Column(name = "model_version")
    private String modelVersion;
    
    @Column(name = "is_pinned")
    private Byte isPinned;
    
    @Lob
    @Column(name = "context_data", columnDefinition = "LONGTEXT")
    private String contextData;

    @Column(name = "session_type", nullable = false)
    private String sessionType;

    @Column(name = "parent_session_id")
    private Long parentSessionId;

    @Lob
    @Column(name = "context_snapshot", columnDefinition = "LONGTEXT")
    private String contextSnapshot;

    @Column(name = "context_snapshot_at")
    private Date contextSnapshotAt;

    @Column(name = "snapshot_schema_version")
    private Integer snapshotSchemaVersion;

    @Column(name = "derivation_request_hash", length = 64, columnDefinition = "CHAR(64)")
    private String derivationRequestHash;

    @Column(name = "derivation_request_id", length = 128)
    private String derivationRequestId;

    @Column(name = "last_active_at", nullable = false)
    private Date lastActiveAt;

    @Column(name = "next_sequence_no", nullable = false)
    private Long nextSequenceNo;

    @Column(name = "deleted_at")
    private Date deletedAt;
    
    @Column(name = "created_at", updatable = false)
    private Date createdAt;
    
    @Column(name = "updated_at")
    private Date updatedAt;
    
    @PrePersist
    protected void onCreate() {
        createdAt = new Date();
        updatedAt = new Date();
        if (lastActiveAt == null) {
            lastActiveAt = createdAt;
        }
        if (nextSequenceNo == null) {
            nextSequenceNo = 1L;
        }
    }
    
    @PreUpdate
    protected void onUpdate() {
        updatedAt = new Date();
    }
}
