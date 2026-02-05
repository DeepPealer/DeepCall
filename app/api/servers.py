from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.api import deps
from app.core.database import get_db
from app.models.user import User
from app.models.server import Server, Channel, ChannelType, ServerMember
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

class RoleCreate(BaseModel):
    name: str
    color: Optional[str] = None
    permissions: Optional[int] = 0
    is_hoisted: Optional[bool] = False

class RoleUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None
    permissions: Optional[int] = None
    is_hoisted: Optional[bool] = None
    position: Optional[int] = None

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
    
    # Add owner as member
    member = ServerMember(
        server_id=server.id,
        user_id=current_user.id
    )
    db.add(member)

    # Create default channel
    default_channel = Channel(
        name="general",
        server_id=server.id,
        type=ChannelType.TEXT
    )
    db.add(default_channel)
    await db.commit()
    await db.refresh(server)
    
    return {"id": str(server.id), "name": server.name, "message": "Server created", "owner_id": str(server.owner_id)}

@router.get("/")
async def list_servers(
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List servers the user is a member of or owns"""
    stmt = (
        select(Server)
        .outerjoin(ServerMember)
        .where(
            (ServerMember.user_id == current_user.id) | 
            (Server.owner_id == current_user.id)
        )
        .distinct()
    )
    result = await db.execute(stmt)
    servers = result.scalars().all()
    
    return [{"id": str(s.id), "name": s.name, "icon_url": s.icon_url, "owner_id": str(s.owner_id)} for s in servers]

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
    
    # Check permissions (Owner only for now)
    server = await db.get(Server, server_uuid)
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")
        
    if server.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only owner can create channels")

    channel = Channel(
        name=channel_data.name,
        server_id=server_uuid,
        type=channel_data.type
    )
    db.add(channel)
    await db.commit()
    await db.refresh(channel)
    
    return {"id": str(channel.id), "name": channel.name, "type": channel.type}

class ServerUpdate(BaseModel):
    name: Optional[str] = None
    icon_url: Optional[str] = None

@router.patch("/{server_id}")
async def update_server(
    server_id: str,
    server_data: ServerUpdate,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update server settings"""
    try:
        server_uuid = uuid.UUID(server_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid server ID")
    
    server = await db.get(Server, server_uuid)
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")
        
    if server.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only owner can update server settings")

    if server_data.name:
        server.name = server_data.name
    if server_data.icon_url:
        server.icon_url = server_data.icon_url
        
    await db.commit()
    await db.refresh(server)
    
    return {"id": str(server.id), "name": server.name, "icon_url": server.icon_url}

@router.post("/{server_id}/leave")
async def leave_server(
    server_id: str,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Leave a server"""
    try:
        server_uuid = uuid.UUID(server_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid server ID")
    
    server = await db.get(Server, server_uuid)
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")
        
    if server.owner_id == current_user.id:
        raise HTTPException(status_code=400, detail="Owners cannot leave their own server. Use delete instead.")

    # Remove the member record
    result = await db.execute(
        select(ServerMember).where(
            ServerMember.server_id == server_uuid,
            ServerMember.user_id == current_user.id
        )
    )
    member = result.scalars().first()
    if not member:
        raise HTTPException(status_code=404, detail="You are not a member of this server")

    await db.delete(member)
    await db.commit()
    
    return {"status": "success", "message": "You have left the server"}

@router.delete("/{server_id}")
async def delete_server(
    server_id: str,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a server"""
    try:
        server_uuid = uuid.UUID(server_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid server ID")
    
    server = await db.get(Server, server_uuid)
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")
        
    if server.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only owner can delete a server")

    await db.delete(server)
    await db.commit()
    
    return {"status": "success", "message": "Server deleted"}

@router.get("/{server_id}/members")
async def list_server_members(
    server_id: str,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List all members of a server"""
    try:
        server_uuid = uuid.UUID(server_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid server ID")
    
    # Check if user is a member or owner
    server = await db.get(Server, server_uuid)
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")
    
    # Check membership
    is_member = current_user.id == server.owner_id
    if not is_member:
        res = await db.execute(
            select(ServerMember).where(
                ServerMember.server_id == server_uuid,
                ServerMember.user_id == current_user.id
            )
        )
        if res.scalars().first():
            is_member = True
            
    if not is_member:
        raise HTTPException(status_code=403, detail="You are not a member of this server")

    # Fetch members with users and roles
    from sqlalchemy.orm import selectinload
    stmt = (
        select(ServerMember)
        .where(ServerMember.server_id == server_uuid)
        .options(selectinload(ServerMember.user), selectinload(ServerMember.roles))
    )
    result = await db.execute(stmt)
    members = result.scalars().all()
    
    return [
        {
            "id": str(m.id),
            "user_id": str(m.user_id),
            "username": m.user.username,
            "avatar_url": m.user.avatar_url,
            "nickname": m.nickname,
            "joined_at": m.joined_at,
            "is_owner": m.user_id == server.owner_id,
            "roles": [{"id": str(r.id), "name": r.name, "color": r.color} for r in m.roles]
        } for m in members
    ]

@router.delete("/{server_id}/members/{user_id}")
async def kick_member(
    server_id: str,
    user_id: str,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Kick a member from the server"""
    try:
        server_uuid = uuid.UUID(server_id)
        target_user_uuid = uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid ID format")
    
    server = await db.get(Server, server_uuid)
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")
        
    # Only owner can kick for now (Phase 2 will add permission checks)
    if server.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only server owner can kick members")

    if target_user_uuid == server.owner_id:
        raise HTTPException(status_code=400, detail="You cannot kick the owner")

    result = await db.execute(
        select(ServerMember).where(
            ServerMember.server_id == server_uuid,
            ServerMember.user_id == target_user_uuid
        )
    )
    member = result.scalars().first()
    if not member:
        raise HTTPException(status_code=404, detail="User is not a member of this server")

    await db.delete(member)
    await db.commit()
    
    return {"status": "success", "message": "Member kicked"}

class MemberUpdate(BaseModel):
    nickname: Optional[str] = None
    role_ids: Optional[list[str]] = None

@router.patch("/{server_id}/members/{user_id}")
async def update_member(
    server_id: str,
    user_id: str,
    member_data: MemberUpdate,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update a member's nickname or roles"""
    from app.models.server import ServerRole
    try:
        server_uuid = uuid.UUID(server_id)
        target_user_uuid = uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid ID format")
    
    server = await db.get(Server, server_uuid)
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")
        
    if server.owner_id != current_user.id:
         raise HTTPException(status_code=403, detail="Only server owner can update members")

    # Fetch member
    result = await db.execute(
        select(ServerMember).where(
            ServerMember.server_id == server_uuid,
            ServerMember.user_id == target_user_uuid
        )
    )
    member = result.scalars().first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    if member_data.nickname is not None:
        member.nickname = member_data.nickname

    if member_data.role_ids is not None:
        # Fetch roles
        role_uuids = [uuid.UUID(rid) for rid in member_data.role_ids]
        res = await db.execute(
            select(ServerRole).where(
                ServerRole.server_id == server_uuid,
                ServerRole.id.in_(role_uuids)
            )
        )
        roles = res.scalars().all()
        member.roles = roles

    await db.commit()
    return {"status": "success"}

@router.get("/{server_id}/roles")
async def list_server_roles(
    server_id: str,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List all roles in a server"""
    try:
        server_uuid = uuid.UUID(server_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid server ID")
    
    # Fetch roles
    from app.models.server import ServerRole
    stmt = select(ServerRole).where(ServerRole.server_id == server_uuid).order_by(ServerRole.position.desc())
    result = await db.execute(stmt)
    roles = result.scalars().all()
    
    return [
        {
            "id": str(r.id),
            "name": r.name,
            "color": r.color,
            "permissions": r.permissions,
            "is_hoisted": r.is_hoisted,
            "position": r.position
        } for r in roles
    ]

@router.post("/{server_id}/roles", status_code=status.HTTP_201_CREATED)
async def create_role(
    server_id: str,
    role_data: RoleCreate,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new role in a server"""
    from app.models.server import ServerRole
    try:
        server_uuid = uuid.UUID(server_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid server ID")
    
    server = await db.get(Server, server_uuid)
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")
        
    if server.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only owner can create roles")

    # Get max position
    res = await db.execute(select(func.max(ServerRole.position)).where(ServerRole.server_id == server_uuid))
    max_pos = res.scalar() or 0

    role = ServerRole(
        server_id=server_uuid,
        name=role_data.name,
        color=role_data.color,
        permissions=role_data.permissions,
        is_hoisted=role_data.is_hoisted,
        position=max_pos + 1
    )
    db.add(role)
    await db.commit()
    await db.refresh(role)
    
    return {"id": str(role.id), "name": role.name}

@router.patch("/{server_id}/roles/{role_id}")
async def update_role(
    server_id: str,
    role_id: str,
    role_data: RoleUpdate,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update a role"""
    from app.models.server import ServerRole
    try:
        server_uuid = uuid.UUID(server_id)
        role_uuid = uuid.UUID(role_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid ID format")
    
    server = await db.get(Server, server_uuid)
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")
    
    if server.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only owner can update roles")

    role = await db.get(ServerRole, role_uuid)
    if not role or role.server_id != server_uuid:
        raise HTTPException(status_code=404, detail="Role not found")

    if role_data.name is not None:
        role.name = role_data.name
    if role_data.color is not None:
        role.color = role_data.color
    if role_data.permissions is not None:
        role.permissions = role_data.permissions
    if role_data.is_hoisted is not None:
        role.is_hoisted = role_data.is_hoisted
    if role_data.position is not None:
        role.position = role_data.position

    await db.commit()
    return {"status": "success"}

@router.delete("/{server_id}/roles/{role_id}")
async def delete_role(
    server_id: str,
    role_id: str,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a role"""
    from app.models.server import ServerRole
    try:
        server_uuid = uuid.UUID(server_id)
        role_uuid = uuid.UUID(role_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid ID format")
    
    server = await db.get(Server, server_uuid)
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")
    
    if server.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only owner can delete roles")

    role = await db.get(ServerRole, role_uuid)
    if not role or role.server_id != server_uuid:
        raise HTTPException(status_code=404, detail="Role not found")

    await db.delete(role)
    await db.commit()
    return {"status": "success"}
