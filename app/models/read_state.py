import uuid
from sqlalchemy import Column, DateTime, ForeignKey, Index, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base

class ReadState(Base):
    __tablename__ = "read_states"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    
    # For channels
    channel_id = Column(UUID(as_uuid=True), ForeignKey("channels.id"), nullable=True)
    
    # For DMs (context is "conversation with other_user")
    dm_other_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    last_read_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    user = relationship("User", foreign_keys=[user_id])
    channel = relationship("Channel")
    dm_other_user = relationship("User", foreign_keys=[dm_other_user_id])

    __table_args__ = (
        Index("idx_read_state_user", "user_id"),
        # Ensure only one record per channel per user
        UniqueConstraint("user_id", "channel_id", name="uq_read_state_user_channel"),
        # Ensure only one record per DM per user
        UniqueConstraint("user_id", "dm_other_user_id", name="uq_read_state_user_dm"),
    )
