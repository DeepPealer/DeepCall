from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, and_
from app.api import deps
from app.core.database import get_db
from app.models.user import User
from app.models.direct_message import DirectMessage
from app.models.friendship import Friendship, FriendshipStatus
from app.schemas.friends import DirectMessageCreate, DirectMessageResponse
from typing import List
import datetime
import json
from app.websockets.manager import manager
from fastapi.encoders import jsonable_encoder

router = APIRouter()

async def check_are_friends(user_id: str, friend_id: str, db: AsyncSession) -> bool:
    """Check if two users are friends"""
    result = await db.execute(
        select(Friendship).where(
            or_(
                and_(Friendship.user_id == user_id, Friendship.friend_id == friend_id),
                and_(Friendship.user_id == friend_id, Friendship.friend_id == user_id)
            ),
            Friendship.status == FriendshipStatus.ACCEPTED
        )
    )
    return result.scalars().first() is not None

@router.get("/", response_model=List[dict])
async def list_dm_conversations(
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List all DM conversations with last message"""
    # Get all friends
    result = await db.execute(
        select(Friendship).where(
            or_(
                and_(Friendship.user_id == current_user.id, Friendship.status == FriendshipStatus.ACCEPTED),
                and_(Friendship.friend_id == current_user.id, Friendship.status == FriendshipStatus.ACCEPTED)
            )
        )
    )
    friendships = result.scalars().all()
    
    conversations = []
    for fs in friendships:
        friend_id = fs.friend_id if fs.user_id == current_user.id else fs.user_id
        
        # Get last message
        result = await db.execute(
            select(DirectMessage).where(
                or_(
                    and_(DirectMessage.sender_id == current_user.id, DirectMessage.recipient_id == friend_id),
                    and_(DirectMessage.sender_id == friend_id, DirectMessage.recipient_id == current_user.id)
                )
            ).order_by(DirectMessage.created_at.desc()).limit(1)
        )
        last_msg = result.scalars().first()
        
        # Get friend info
        result = await db.execute(select(User).where(User.id == friend_id))
        friend = result.scalars().first()
        
        if friend:
            conversations.append({
                "friend_id": str(friend.id),
                "friend_username": friend.username,
                "friend_avatar": friend.avatar_url,
                "last_message": last_msg.content if last_msg else None,
                "last_message_time": last_msg.created_at if last_msg else fs.created_at
            })
    
    return sorted(conversations, key=lambda x: x["last_message_time"], reverse=True)

@router.get("/{user_id}", response_model=List[DirectMessageResponse])
async def get_dm_history(
    user_id: str,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get message history with a specific user"""
    # Check if friends
    if not await check_are_friends(str(current_user.id), user_id, db):
        raise HTTPException(status_code=403, detail="You must be friends to view messages")
    
    from sqlalchemy.orm import selectinload
    result = await db.execute(
        select(DirectMessage).where(
            or_(
                and_(DirectMessage.sender_id == current_user.id, DirectMessage.recipient_id == user_id),
                and_(DirectMessage.sender_id == user_id, DirectMessage.recipient_id == current_user.id)
            )
        )
        .options(selectinload(DirectMessage.sender))
        .order_by(DirectMessage.created_at.asc())
    )
    messages = result.scalars().all()
    
    # Map to include avatar
    response = []
    for m in messages:
        m_dict = jsonable_encoder(m)
        m_dict["sender_avatar"] = m.sender.avatar_url if m.sender else None
        response.append(m_dict)
    
    return response

@router.post("/{user_id}", response_model=DirectMessageResponse, status_code=status.HTTP_201_CREATED)
async def send_dm(
    user_id: str,
    message: DirectMessageCreate,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Send a DM to a friend"""
    # Check if friends
    if not await check_are_friends(str(current_user.id), user_id, db):
        raise HTTPException(status_code=403, detail="You must be friends to send messages")
    
    import uuid
    recipient_uuid = uuid.UUID(user_id) if isinstance(user_id, str) else user_id

    dm = DirectMessage(
        sender_id=current_user.id,
        recipient_id=recipient_uuid,
        content=message.content,
        reply_to_id=message.reply_to_id
    )
    db.add(dm)
    await db.commit()
    await db.refresh(dm)
    
    # Broadcast to recipient and sender via WebSocket
    try:
        # Create safe payload
        # Ensure created_at is populated (in case refresh wasn't enough)
        ts = dm.created_at if dm.created_at else datetime.datetime.utcnow()
        created_at_iso = ts.isoformat()
        
        ws_message = {
            "type": "dm",
            "id": str(dm.id),
            "sender_id": str(current_user.id),
            "recipient_id": str(user_id),
            "content": dm.content,
            "user": current_user.username,
            "sender_avatar": current_user.avatar_url,
            "reply_to_id": str(dm.reply_to_id) if dm.reply_to_id else None,
            "created_at": created_at_iso
        }
        
        # Use jsonable_encoder for absolute safety
        safe_payload = jsonable_encoder(ws_message)
        
        # Send to recipient and sender
        await manager.send_personal_message(safe_payload, str(user_id))
        await manager.send_personal_message(safe_payload, str(current_user.id))
    except Exception as e:
        print(f"CRITICAL DM BROADCAST ERROR: {e}")
        # We don't want to fail the whole request if WS broadcast fails
            
    res = jsonable_encoder(dm)
    res["sender_avatar"] = current_user.avatar_url
    return res

@router.patch("/message/{message_id}", response_model=DirectMessageResponse)
async def edit_dm(
    message_id: str,
    message_update: DirectMessageCreate,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Edit a message sent by the user"""
    import uuid
    msg_uuid = uuid.UUID(message_id)
    
    result = await db.execute(select(DirectMessage).where(DirectMessage.id == msg_uuid))
    dm = result.scalars().first()
    
    if not dm:
        raise HTTPException(status_code=404, detail="Message not found")
    if dm.sender_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only edit your own messages")
    
    dm.content = message_update.content
    dm.is_edited = True
    await db.commit()
    await db.refresh(dm)
    
    # Broadcast update
    update_payload = jsonable_encoder({
        "type": "dm_update",
        "id": str(dm.id),
        "content": dm.content,
        "is_edited": True,
        "recipient_id": str(dm.recipient_id),
        "sender_id": str(dm.sender_id)
    })
    await manager.send_personal_message(update_payload, str(dm.recipient_id))
    await manager.send_personal_message(update_payload, str(dm.sender_id))
    
    return dm

@router.delete("/message/{message_id}")
async def delete_dm(
    message_id: str,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a message sent by the user"""
    import uuid
    msg_uuid = uuid.UUID(message_id)
    
    result = await db.execute(select(DirectMessage).where(DirectMessage.id == msg_uuid))
    dm = result.scalars().first()
    
    if not dm:
        raise HTTPException(status_code=404, detail="Message not found")
    if dm.sender_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only delete your own messages")
    
    recipient_id = str(dm.recipient_id)
    sender_id = str(dm.sender_id)
    msg_id = str(dm.id)
    
    await db.delete(dm)
    await db.commit()
    
    # Broadcast deletion
    delete_payload = jsonable_encoder({
        "type": "dm_delete",
        "id": msg_id,
        "recipient_id": recipient_id,
        "sender_id": sender_id
    })
    await manager.send_personal_message(delete_payload, recipient_id)
    await manager.send_personal_message(delete_payload, sender_id)
    
    return {"status": "success"}
