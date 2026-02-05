import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.core.database import Base


class AuditLogEntry(Base):
    """
    Immutable log of all moderation and administrative actions.
    Used for accountability and debugging.
    """
    __tablename__ = "audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    server_id = Column(UUID(as_uuid=True), ForeignKey("servers.id", ondelete="CASCADE"), nullable=False, index=True)
    actor_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    
    action_type = Column(String(50), nullable=False, index=True)  # MEMBER_BAN, MEMBER_KICK, CHANNEL_CREATE, etc.
    target_type = Column(String(50), nullable=True)  # user, channel, role, server
    target_id = Column(String, nullable=True)  # ID of affected object
    
    reason = Column(Text, nullable=True)
    changes = Column(JSONB, nullable=True)  # { "old": {...}, "new": {...} }
    
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    
    # Relationships
    server = relationship("Server", back_populates="audit_logs")
    actor = relationship("User", backref="audit_actions")

    def __repr__(self):
        return f"<AuditLog {self.action_type} by {self.actor_id}>"


# Common action types
class AuditActionType:
    # Member actions
    MEMBER_BAN = "MEMBER_BAN"
    MEMBER_UNBAN = "MEMBER_UNBAN"
    MEMBER_KICK = "MEMBER_KICK"
    MEMBER_TIMEOUT = "MEMBER_TIMEOUT"
    MEMBER_TIMEOUT_REMOVE = "MEMBER_TIMEOUT_REMOVE"
    MEMBER_ROLE_UPDATE = "MEMBER_ROLE_UPDATE"
    
    # Server actions
    SERVER_UPDATE = "SERVER_UPDATE"
    
    # Channel actions
    CHANNEL_CREATE = "CHANNEL_CREATE"
    CHANNEL_UPDATE = "CHANNEL_UPDATE"
    CHANNEL_DELETE = "CHANNEL_DELETE"
    
    # Role actions
    ROLE_CREATE = "ROLE_CREATE"
    ROLE_UPDATE = "ROLE_UPDATE"
    ROLE_DELETE = "ROLE_DELETE"
    
    # Message actions
    MESSAGE_DELETE = "MESSAGE_DELETE"
    MESSAGE_BULK_DELETE = "MESSAGE_BULK_DELETE"
