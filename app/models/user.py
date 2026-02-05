import uuid
from sqlalchemy import Column, String, Boolean, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.core.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    avatar_url = Column(String, nullable=True)
    bio = Column(String, nullable=True)
    theme = Column(String, default="system")
    privacy_dm = Column(String, default="everyone")
    notif_friend_requests = Column(Boolean, default=True)
    notif_direct_messages = Column(Boolean, default=True)
    notif_mentions = Column(Boolean, default=True)
