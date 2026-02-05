from pydantic import BaseModel
from datetime import datetime
from typing import Optional
import uuid

class FriendRequestCreate(BaseModel):
    friend_username: str

class FriendResponse(BaseModel):
    id: uuid.UUID
    username: str
    email: str
    avatar_url: Optional[str]
    bio: Optional[str]
    status: str  # PENDING, ACCEPTED
    created_at: datetime

    class Config:
        from_attributes = True

class DirectMessageCreate(BaseModel):
    content: str
    reply_to_id: Optional[uuid.UUID] = None

class DirectMessageResponse(BaseModel):
    id: uuid.UUID
    sender_id: uuid.UUID
    recipient_id: uuid.UUID
    content: str
    reply_to_id: Optional[uuid.UUID] = None
    sender_avatar: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
