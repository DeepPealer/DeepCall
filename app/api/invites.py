from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.api import deps
from app.core.database import get_db
from app.models.user import User
from app.models.server import Server, Invite, ServerMember
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta
import uuid
import secrets

router = APIRouter()

class InviteCreate(BaseModel):
    max_uses: int = 0  # 0 = infinite
    expires_seconds: Optional[int] = 604800  # 7 days default, 0 = never

class InviteResponse(BaseModel):
    code: str
    server_id: uuid.UUID
    server_name: str
    server_icon: Optional[str]
    inviter_username: str
    inviter_avatar: Optional[str]
    uses: int
    max_uses: int
    expires_at: Optional[datetime]

@router.post("/servers/{server_id}/invites", status_code=status.HTTP_201_CREATED)
async def create_invite(
    server_id: str,
    invite_data: InviteCreate,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create an invite link for a server."""
    try:
        server_uuid = uuid.UUID(server_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid server ID")

    # Check if user is a member of the server
    result = await db.execute(
        select(ServerMember).where(
            ServerMember.server_id == server_uuid,
            ServerMember.user_id == current_user.id
        )
    )
    member = result.scalars().first()
    
    # Also allow owner (who might not be in member list due to legacy data, though we fixed that)
    server = await db.get(Server, server_uuid)
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")
        
    if not member and server.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="You must be a member to create an invite")

    # Generate unique code
    code = secrets.token_urlsafe(6)
    
    expires_at = None
    if invite_data.expires_seconds and invite_data.expires_seconds > 0:
        expires_at = datetime.utcnow() + timedelta(seconds=invite_data.expires_seconds)

    invite = Invite(
        code=code,
        server_id=server_uuid,
        creator_id=current_user.id,
        max_uses=invite_data.max_uses,
        expires_at=expires_at
    )
    db.add(invite)
    await db.commit()
    await db.refresh(invite)
    
    return {"code": code, "expires_at": expires_at}

@router.get("/invites/{code}", response_model=InviteResponse)
async def get_invite(
    code: str,
    db: AsyncSession = Depends(get_db)
):
    """Get invite info."""
    stmt = (
        select(Invite)
        .where(Invite.code == code)
    )
    result = await db.execute(stmt)
    invite = result.scalars().first()
    
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")
        
    # Check expiry
    if invite.expires_at and invite.expires_at < datetime.utcnow():
        raise HTTPException(status_code=404, detail="Invite expired")
    
    # Check uses
    if invite.max_uses > 0 and invite.uses >= invite.max_uses:
        raise HTTPException(status_code=404, detail="Invite limit reached")

    # Fetch server and inviter info
    server = await db.get(Server, invite.server_id)
    creator = await db.get(User, invite.creator_id)
    
    return {
        "code": invite.code,
        "server_id": server.id,
        "server_name": server.name,
        "server_icon": server.icon_url,
        "inviter_username": creator.username if creator else "Unknown",
        "inviter_avatar": creator.avatar_url if creator else None,
        "uses": invite.uses,
        "max_uses": invite.max_uses,
        "expires_at": invite.expires_at
    }

@router.post("/invites/{code}/join", status_code=status.HTTP_200_OK)
async def join_server(
    code: str,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Join a server using an invite code."""
    stmt = select(Invite).where(Invite.code == code)
    result = await db.execute(stmt)
    invite = result.scalars().first()
    
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")
        
    if invite.expires_at and invite.expires_at < datetime.utcnow():
        raise HTTPException(status_code=404, detail="Invite expired")
        
    if invite.max_uses > 0 and invite.uses >= invite.max_uses:
        raise HTTPException(status_code=404, detail="Invite limit reached")
        
    # Check if already a member
    result = await db.execute(
        select(ServerMember).where(
            ServerMember.server_id == invite.server_id,
            ServerMember.user_id == current_user.id
        )
    )
    if result.scalars().first():
        return {"message": "Already a member", "server_id": str(invite.server_id)}
        
    # Add member
    member = ServerMember(
        server_id=invite.server_id,
        user_id=current_user.id
    )
    db.add(member)
    
    # Increment uses
    invite.uses += 1
    
    await db.commit()
    
    return {"message": "Joined server", "server_id": str(invite.server_id)}
