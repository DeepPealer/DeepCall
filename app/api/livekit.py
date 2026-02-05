from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from livekit import api
import uuid
from app.core.config import settings
from app.api import deps
from app.models.user import User

router = APIRouter()

class TokenRequest(BaseModel):
    room_name: str
    username: str

class TokenResponse(BaseModel):
    token: str

@router.post("/token", response_model=TokenResponse)
async def get_token(
    request: TokenRequest,
    current_user: User = Depends(deps.get_current_user)
):
    """
    Generate a LiveKit access token for a room.
    """
    if not request.room_name:
         raise HTTPException(status_code=400, detail="Room name is required")

    try:
        token = api.AccessToken(
            settings.LIVEKIT_API_KEY, 
            settings.LIVEKIT_API_SECRET
        ).with_identity(current_user.username) \
         .with_name(current_user.username) \
         .with_grants(api.VideoGrants(
            room_join=True,
            room=request.room_name,
            can_publish=True,
            can_subscribe=True
         ))
        
        return {"token": token.to_jwt()}
    except Exception as e:
        print(f"Error generating LiveKit token: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate token")
