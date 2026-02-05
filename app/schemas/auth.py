from pydantic import BaseModel, EmailStr, Field
from typing import Optional, Literal
from uuid import UUID

# Shared properties
class UserBase(BaseModel):
    email: EmailStr
    username: str = Field(min_length=3, max_length=50)

# Properties to receive via API on creation
class UserCreate(UserBase):
    password: str = Field(min_length=8)

# Properties to receive via API on update
class UserUpdate(BaseModel):
    username: Optional[str] = Field(None, min_length=3, max_length=50)
    email: Optional[EmailStr] = None
    password: Optional[str] = Field(None, min_length=8)
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
    theme: Optional[Literal["dark", "light", "system"]] = None
    privacy_dm: Optional[Literal["everyone", "friends_only", "server_only"]] = None
    notif_friend_requests: Optional[bool] = None
    notif_direct_messages: Optional[bool] = None
    notif_mentions: Optional[bool] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenPayload(BaseModel):
    sub: Optional[str] = None

# Properties to return to client
class User(UserBase):
    id: UUID
    is_active: bool
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    theme: str
    privacy_dm: str
    notif_friend_requests: bool
    notif_direct_messages: bool
    notif_mentions: bool

    class Config:
        from_attributes = True
