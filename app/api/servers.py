from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.api import deps
from app.core.database import get_db
from app.models.user import User
from app.models.server import Server, Channel, ChannelType
from pydantic import BaseModel
from typing import Optional
import uuid

router = APIRouter()

class ServerCreate(BaseModel):
    name: str
    description: Optional[str] = None

class ChannelCreate(BaseModel):
    name: str
    type: ChannelType = ChannelType.TEXT
    description: Optional[str] = None

@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_server(
    server_data: ServerCreate,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new server"""
    server = Server(
        name=server_data.name,
        owner_id=current_user.id,
        icon_url=None
    )
    db.add(server)
    await db.flush()
    
    # Create default channel
    default_channel = Channel(
        name="general",
        server_id=server.id,
        type=ChannelType.TEXT
    )
    db.add(default_channel)
    await db.commit()
    await db.refresh(server)
    
    return {"id": str(server.id), "name": server.name, "message": "Server created"}

@router.get("/")
async def list_servers(
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List all servers (for MVP, list all - later filter by membership)"""
    result = await db.execute(select(Server))
    servers = result.scalars().all()
    
    return [{"id": str(s.id), "name": s.name, "icon_url": s.icon_url} for s in servers]

@router.post("/{server_id}/channels", status_code=status.HTTP_201_CREATED)
async def create_channel(
    server_id: str,
    channel_data: ChannelCreate,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new channel in a server"""
    import uuid as uuid_lib
    try:
        server_uuid = uuid_lib.UUID(server_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid server ID")
    
    channel = Channel(
        name=channel_data.name,
        server_id=server_uuid,
        type=channel_data.type
    )
    db.add(channel)
    await db.commit()
    await db.refresh(channel)
    
    return {"id": str(channel.id), "name": channel.name, "type": channel.type}
