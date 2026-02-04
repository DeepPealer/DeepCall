from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from uuid import UUID

# Shared properties
class UserBase(BaseModel):
    email: EmailStr
    username: str = Field(min_length=3, max_length=50)

# Properties to receive via API on creation
class UserCreate(UserBase):
    password: str = Field(min_length=8)

# Properties to receive via API on update
class UserUpdate(UserBase):
    password: Optional[str] = None

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

    class Config:
        from_attributes = True
