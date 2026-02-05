import uuid
import enum
from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, Enum, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base


class PunishmentType(str, enum.Enum):
    BAN = "ban"
    KICK = "kick"
    TIMEOUT = "timeout"
    WARN = "warn"


class Infraction(Base):
    """
    Tracks all moderation actions taken against users.
    Used for building user history and managing active punishments.
    """
    __tablename__ = "infractions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    server_id = Column(UUID(as_uuid=True), ForeignKey("servers.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    moderator_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    
    type = Column(Enum(PunishmentType), nullable=False)
    reason = Column(Text, nullable=True)
    expires_at = Column(DateTime, nullable=True)  # For timeouts and temp bans
    is_active = Column(String, default="true")  # Can be revoked
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    server = relationship("Server", back_populates="infractions")
    user = relationship("User", foreign_keys=[user_id], backref="infractions_received")
    moderator = relationship("User", foreign_keys=[moderator_id], backref="infractions_given")

    def __repr__(self):
        return f"<Infraction {self.type.value} on {self.user_id} by {self.moderator_id}>"
