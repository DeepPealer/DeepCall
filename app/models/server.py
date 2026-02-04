import uuid
from sqlalchemy import Column, String, ForeignKey, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base
import enum

class ChannelType(str, enum.Enum):
    TEXT = "TEXT"
    VOICE = "VOICE"

class Server(Base):
    __tablename__ = "servers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    owner_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    icon_url = Column(String, nullable=True)

    owner = relationship("User")
    channels = relationship("Channel", back_populates="server", cascade="all, delete-orphan")

class Channel(Base):
    __tablename__ = "channels"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    server_id = Column(UUID(as_uuid=True), ForeignKey("servers.id"), nullable=False)
    type = Column(Enum(ChannelType, name="channel_type"), default=ChannelType.TEXT, nullable=False)

    server = relationship("Server", back_populates="channels")
