import uuid
import enum
from sqlalchemy import Column, String, ForeignKey, Enum, Boolean, BigInteger, Table, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base
from datetime import datetime

class ChannelType(str, enum.Enum):
    TEXT = "TEXT"
    VOICE = "VOICE"

# Association table for Member <-> Role
member_role_association = Table(
    "member_role_association",
    Base.metadata,
    Column("member_id", UUID(as_uuid=True), ForeignKey("server_members.id")),
    Column("role_id", UUID(as_uuid=True), ForeignKey("server_roles.id"))
)

class Server(Base):
    __tablename__ = "servers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    owner_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    icon_url = Column(String, nullable=True)

    owner = relationship("User")
    channels = relationship("Channel", back_populates="server", cascade="all, delete-orphan")
    infractions = relationship("Infraction", back_populates="server", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLogEntry", back_populates="server", cascade="all, delete-orphan")
    roles = relationship("ServerRole", back_populates="server", cascade="all, delete-orphan")
    members = relationship("ServerMember", back_populates="server", cascade="all, delete-orphan")

class Channel(Base):
    __tablename__ = "channels"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    server_id = Column(UUID(as_uuid=True), ForeignKey("servers.id"), nullable=False)
    type = Column(Enum(ChannelType, name="channel_type"), default=ChannelType.TEXT, nullable=False)

    server = relationship("Server", back_populates="channels")

class ServerRole(Base):
    __tablename__ = "server_roles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    server_id = Column(UUID(as_uuid=True), ForeignKey("servers.id"), nullable=False)
    name = Column(String, nullable=False)
    color = Column(String, nullable=True) # Hex color
    permissions = Column(BigInteger, default=0) # Bitmask
    is_hoisted = Column(Boolean, default=False)
    position = Column(BigInteger, default=0) 

    server = relationship("Server", back_populates="roles")
    members = relationship("ServerMember", secondary=member_role_association, back_populates="roles")

class ServerMember(Base):
    __tablename__ = "server_members"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    server_id = Column(UUID(as_uuid=True), ForeignKey("servers.id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    nickname = Column(String, nullable=True)
    joined_at = Column(String, default=lambda: datetime.utcnow().isoformat())
    
    # Moderation flags
    is_muted = Column(Boolean, default=False)
    muted_until = Column(String, nullable=True) # ISO format date
    is_deafened = Column(Boolean, default=False)

    server = relationship("Server", back_populates="members")
    user = relationship("User") # No back_populates to keep User model clean for now
    roles = relationship("ServerRole", secondary=member_role_association, back_populates="members")

class Invite(Base):
    __tablename__ = "invites"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code = Column(String, unique=True, index=True, nullable=False)
    server_id = Column(UUID(as_uuid=True), ForeignKey("servers.id", ondelete="CASCADE"), nullable=False)
    creator_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    expires_at = Column(DateTime, nullable=True)
    max_uses = Column(BigInteger, default=0) # 0 = infinite
    uses = Column(BigInteger, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    server = relationship("Server")
    creator = relationship("User")
