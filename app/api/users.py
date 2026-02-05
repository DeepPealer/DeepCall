from typing import Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.api import deps
from app.core import security
from app.core.database import get_db
from app.models.user import User
from app.schemas import auth as auth_schemas

router = APIRouter()

@router.get("/me", response_model=auth_schemas.User)
async def get_user_me(
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Get current user.
    """
    return current_user

@router.patch("/me", response_model=auth_schemas.User)
async def update_user_me(
    user_in: auth_schemas.UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Update own user.
    """
    if user_in.username is not None:
        # Check if username already exists
        result = await db.execute(select(User).where(User.username == user_in.username))
        existing_user = result.scalars().first()
        if existing_user and existing_user.id != current_user.id:
            raise HTTPException(
                status_code=400,
                detail="Username already taken",
            )
        current_user.username = user_in.username

    if user_in.email is not None:
        # Check if email already exists
        result = await db.execute(select(User).where(User.email == user_in.email))
        existing_user = result.scalars().first()
        if existing_user and existing_user.id != current_user.id:
            raise HTTPException(
                status_code=400,
                detail="Email already registered",
            )
        current_user.email = user_in.email

    if user_in.bio is not None:
        current_user.bio = user_in.bio
    
    if user_in.avatar_url is not None:
        current_user.avatar_url = user_in.avatar_url
    
    if user_in.theme is not None:
        current_user.theme = user_in.theme
    
    if user_in.privacy_dm is not None:
        current_user.privacy_dm = user_in.privacy_dm

    if user_in.notif_friend_requests is not None:
        current_user.notif_friend_requests = user_in.notif_friend_requests
    
    if user_in.notif_direct_messages is not None:
        current_user.notif_direct_messages = user_in.notif_direct_messages
    
    if user_in.notif_mentions is not None:
        current_user.notif_mentions = user_in.notif_mentions

    if user_in.password is not None:
        current_user.hashed_password = security.get_password_hash(user_in.password)

    db.add(current_user)
    await db.commit()
    await db.refresh(current_user)
    return current_user
