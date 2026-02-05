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
                # Handle incoming messages
                if "channel_id" in data and "content" in data:
                    # Save message to database
                    import uuid as uuid_lib
                    try:
                        channel_uuid = uuid_lib.UUID(data["channel_id"])
                        new_msg = Message(
                            content=data["content"],
                            channel_id=channel_uuid,
                            user_id=user.id
                        )
                        db.add(new_msg)
                        await db.commit()
                        
                        await manager.broadcast_to_channel(data["channel_id"], {
                            "type": "message",
                            "user": user.username,
                            "content": data["content"],
                            "channel_id": data["channel_id"],
                            "created_at": new_msg.created_at.isoformat() if new_msg.created_at else None
                        })
                    except Exception as e:
                        print(f"Error saving message: {e}")
        except WebSocketDisconnect:
            manager.disconnect(websocket, str(user.id))
        except Exception as e:
            # Handle other errors to prevent crash
            print(f"WebSocket Error: {e}")
            manager.disconnect(websocket, str(user.id))
