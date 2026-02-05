from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from livekit import api
import os

from app.api import deps
from app.core import config
from app.core.database import get_db
from app.models.user import User
from app.models.message import Message
from app.models.server import Channel
from sqlalchemy import select

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
    return [{"id": str(c.id), "name": c.name, "type": c.type, "server_id": str(c.server_id)} for c in channels]

@router.get("/{channel_id}/messages")
async def get_channel_messages(
    channel_id: str,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get messages for a specific channel
    """
    import uuid as uuid_lib
    try:
        channel_uuid = uuid_lib.UUID(channel_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid channel ID")

    from sqlalchemy.orm import selectinload
    result = await db.execute(
        select(Message)
        .where(Message.channel_id == channel_uuid)
        .options(selectinload(Message.user))
        .order_by(Message.created_at.asc())
    )
    messages = result.scalars().all()
    
    return [{
        "id": str(m.id),
        "content": m.content,
        "user": m.user.username if m.user else "Unknown",
        "user_id": str(m.user_id),
        "user_avatar": m.user.avatar_url if m.user else None,
        "reply_to_id": str(m.reply_to_id) if m.reply_to_id else None,
        "created_at": m.created_at.isoformat() if m.created_at else None
    } for m in messages]

@router.patch("/message/{message_id}")
async def edit_channel_message(
    message_id: str,
    content: str, # For simplicity, just send content
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Edit a message in a channel"""
    import uuid
    msg_uuid = uuid.UUID(message_id)
    
    result = await db.execute(select(Message).where(Message.id == msg_uuid))
    msg = result.scalars().first()
    
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    if msg.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only edit your own messages")
    
    msg.content = content
    msg.is_edited = True
    await db.commit()
    await db.refresh(msg)
    
    # Broadcast to channel
    await manager.broadcast_to_channel(str(msg.channel_id), {
        "type": "message_update",
        "id": str(msg.id),
        "content": msg.content,
        "is_edited": True,
        "channel_id": str(msg.channel_id)
    })
    
    return {"status": "success"}

@router.delete("/message/{message_id}")
async def delete_channel_message(
    message_id: str,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a message in a channel"""
    import uuid
    msg_uuid = uuid.UUID(message_id)
    
    result = await db.execute(select(Message).where(Message.id == msg_uuid))
    msg = result.scalars().first()
    
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    if msg.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only delete your own messages")
    
    channel_id = str(msg.channel_id)
    msg_id = str(msg.id)
    
    await db.delete(msg)
    await db.commit()
    
    # Broadcast deletion
    await manager.broadcast_to_channel(channel_id, {
        "type": "message_delete",
        "id": msg_id,
        "channel_id": channel_id
    })
    
    return {"status": "success"}
