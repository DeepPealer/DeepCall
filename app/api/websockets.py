from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, status
from jose import jwt, JWTError
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.websockets.manager import manager
from app.core import security
from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.models.user import User
from app.models.message import Message
from app.schemas import auth as auth_schemas

router = APIRouter()

async def get_user_from_token(token: str, db: AsyncSession) -> User:
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[security.ALGORITHM]
        )
        token_data = auth_schemas.TokenPayload(**payload)
    except (JWTError, ValidationError):
        return None
    
    result = await db.execute(select(User).where(User.id == token_data.sub))
    return result.scalars().first()

@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: str = Query(...)
):
    await websocket.accept()
    # Manual DB session for WebSocket connection
    async with AsyncSessionLocal() as db:
        user = await get_user_from_token(token, db)
        if not user or not user.is_active:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

        await manager.connect(websocket, str(user.id))
        try:
            while True:
                data = await websocket.receive_json()
                
                # Handle ping/heartbeat
                if data.get("type") == "ping":
                    await websocket.send_json({"type": "pong"})
                    continue

                # Handle incoming messages (Channel)
                if "channel_id" in data and "content" in data:
                    # Save message to database
                    import uuid as uuid_lib
                    try:
                        channel_uuid = uuid_lib.UUID(data["channel_id"])
                        new_msg = Message(
                            content=data["content"],
                            channel_id=channel_uuid,
                            user_id=user.id,
                            reply_to_id=uuid_lib.UUID(data["reply_to_id"]) if data.get("reply_to_id") else None
                        )
                        db.add(new_msg)
                        await db.commit()
                        await db.refresh(new_msg)
                        
                        await manager.broadcast_to_channel(data["channel_id"], {
                            "type": "message",
                            "id": str(new_msg.id),
                            "user": user.username,
                            "user_id": str(user.id),
                            "user_avatar": user.avatar_url,
                            "content": data["content"],
                            "channel_id": data["channel_id"],
                            "reply_to_id": data.get("reply_to_id"),
                            "created_at": new_msg.created_at.isoformat() if new_msg.created_at else None
                        })
                    except Exception as e:
                        print(f"Error saving channel message: {e}")

                # Handle incoming messages (DM)
                elif data.get("type") == "dm" and "recipient_id" in data and "content" in data:
                    import uuid as uuid_lib
                    try:
                        recipient_uuid = uuid_lib.UUID(data["recipient_id"])
                        from app.models.direct_message import DirectMessage
                        
                        new_dm = DirectMessage(
                            sender_id=user.id,
                            recipient_id=recipient_uuid,
                            content=data["content"],
                            reply_to_id=uuid_lib.UUID(data["reply_to_id"]) if data.get("reply_to_id") else None
                        )
                        db.add(new_dm)
                        await db.commit()
                        await db.refresh(new_dm)
                        
                        dm_payload = {
                            "type": "dm",
                            "id": str(new_dm.id),
                            "sender_id": str(user.id),
                            "recipient_id": str(recipient_uuid),
                            "content": data["content"],
                            "user": user.username,
                            "sender_avatar": user.avatar_url,
                            "reply_to_id": data.get("reply_to_id"),
                            "created_at": new_dm.created_at.isoformat() if new_dm.created_at else None
                        }
                        # Send to recipient and sender instance
                        await manager.send_personal_message(dm_payload, str(recipient_uuid))
                        await manager.send_personal_message(dm_payload, str(user.id))
                    except Exception as e:
                        print(f"Error saving DM: {e}")
                
                # Handle call signaling
                elif data.get("type") in ["call_invite", "call_accept", "call_reject", "call_end"]:
                    target_user_id = data.get("target_user_id")
                    if target_user_id:
                        call_payload = {
                            "type": data["type"],
                            "from_user_id": str(user.id),
                            "from_username": user.username,
                            "from_avatar": user.avatar_url,
                            "room_name": data.get("room_name"),
                            "call_type": data.get("call_type", "video"),
                            "target_user_id": target_user_id # Echo back for safety
                        }
                        await manager.send_personal_message(call_payload, target_user_id)
        except WebSocketDisconnect:
            manager.disconnect(websocket, str(user.id))
        except Exception as e:
            print(f"WebSocket Error: {e}")
            manager.disconnect(websocket, str(user.id))
