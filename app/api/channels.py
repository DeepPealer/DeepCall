from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from livekit import api
import os

from app.api import deps
from app.core import config
from app.core.database import get_db
from app.models.user import User

router = APIRouter()

@router.post("/{channel_id}/join")
async def join_channel(
    channel_id: str,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Generate a LiveKit token to join a voice/video channel.
    """
    # Verify channel exists (skipped for MVP speed, assuming ID is valid or checked by FE)
    # In production: await db.execute(select(Channel).where(Channel.id == channel_id))

    # Create access token
    token = (
        api.AccessToken(
            config.settings.LIVEKIT_API_KEY, 
            config.settings.LIVEKIT_API_SECRET
        )
        .with_grants(api.VideoGrants(room_join=True, room=channel_id))
        .with_identity(str(current_user.id))
        .with_name(current_user.username)
        .with_metadata(current_user.avatar_url or "")
    )
    
    jwt_token = token.to_jwt()
    
    return {
        "token": jwt_token,
        "url": config.settings.LIVEKIT_URL
    }

@router.get("/", response_model=list[dict])
async def list_channels(
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    List all channels (for MVP we list all, later filter by server)
    """
    from app.models.server import Channel
    from sqlalchemy import select
    
    result = await db.execute(select(Channel))
    channels = result.scalars().all()
    
    # Return simple list for MVP
    return [{"id": str(c.id), "name": c.name, "type": c.type} for c in channels]
