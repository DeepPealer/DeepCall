from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta
import uuid

from app.core.database import get_db
from app.api import deps
from app.models.user import User
from app.models.server import Server
from app.models.infraction import Infraction, PunishmentType
from app.models.audit_log import AuditLogEntry, AuditActionType
from app.core.permissions import Permission, has_permission
from app.websockets.manager import manager

router = APIRouter()


# ============ Schemas ============

class KickRequest(BaseModel):
    reason: Optional[str] = None


class BanRequest(BaseModel):
    reason: Optional[str] = None
    delete_message_days: Optional[int] = 0  # 0, 1, or 7


class TimeoutRequest(BaseModel):
    duration_seconds: int  # 60, 300, 600, 3600, 604800
    reason: Optional[str] = None


class InfractionResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    moderator_id: Optional[uuid.UUID]
    type: str
    reason: Optional[str]
    expires_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class AuditLogResponse(BaseModel):
    id: uuid.UUID
    actor_id: Optional[uuid.UUID]
    action_type: str
    target_type: Optional[str]
    target_id: Optional[str]
    reason: Optional[str]
    changes: Optional[dict]
    created_at: datetime

    class Config:
        from_attributes = True


# ============ Helper Functions ============

async def get_server_or_404(db: AsyncSession, server_id: str) -> Server:
    """Get server by ID or raise 404."""
    try:
        server_uuid = uuid.UUID(server_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid server ID")
    
    result = await db.execute(select(Server).where(Server.id == server_uuid))
    server = result.scalars().first()
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")
    return server


async def check_mod_permission(
    db: AsyncSession, 
    server: Server, 
    user: User, 
    required_permission: int
) -> bool:
    """Check if user has required permission on server."""
    # Owner has all permissions
    if server.owner_id == user.id:
        return True
    
    # TODO: Implement role-based permission check
    # For now, only owner can moderate
    return False


async def create_audit_log(
    db: AsyncSession,
    server_id: uuid.UUID,
    actor_id: uuid.UUID,
    action_type: str,
    target_type: str,
    target_id: str,
    reason: Optional[str] = None,
    changes: Optional[dict] = None
):
    """Create an audit log entry."""
    log = AuditLogEntry(
        server_id=server_id,
        actor_id=actor_id,
        action_type=action_type,
        target_type=target_type,
        target_id=target_id,
        reason=reason,
        changes=changes
    )
    db.add(log)
    await db.commit()
    return log


# ============ Endpoints ============

@router.post("/{server_id}/members/{user_id}/kick", status_code=status.HTTP_200_OK)
async def kick_member(
    server_id: str,
    user_id: str,
    request: KickRequest,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Kick a member from the server."""
    server = await get_server_or_404(db, server_id)
    
    # Permission check
    if not await check_mod_permission(db, server, current_user, Permission.KICK_MEMBERS):
        raise HTTPException(status_code=403, detail="Missing KICK_MEMBERS permission")
    
    try:
        target_uuid = uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user ID")
    
    # Can't kick yourself
    if target_uuid == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot kick yourself")
    
    # Can't kick the owner
    if target_uuid == server.owner_id:
        raise HTTPException(status_code=403, detail="Cannot kick the server owner")
    
    # Create infraction record
    infraction = Infraction(
        server_id=server.id,
        user_id=target_uuid,
        moderator_id=current_user.id,
        type=PunishmentType.KICK,
        reason=request.reason
    )
    db.add(infraction)
    
    # Create audit log
    await create_audit_log(
        db, server.id, current_user.id,
        AuditActionType.MEMBER_KICK, "user", user_id,
        reason=request.reason
    )
    
    await db.commit()
    
    # Notify the kicked user via WebSocket
    await manager.send_personal_message({
        "type": "kicked",
        "server_id": server_id,
        "reason": request.reason
    }, user_id)
    
    return {"message": f"User kicked successfully", "reason": request.reason}


@router.post("/{server_id}/members/{user_id}/ban", status_code=status.HTTP_200_OK)
async def ban_member(
    server_id: str,
    user_id: str,
    request: BanRequest,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Ban a member from the server."""
    server = await get_server_or_404(db, server_id)
    
    if not await check_mod_permission(db, server, current_user, Permission.BAN_MEMBERS):
        raise HTTPException(status_code=403, detail="Missing BAN_MEMBERS permission")
    
    try:
        target_uuid = uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user ID")
    
    if target_uuid == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot ban yourself")
    
    if target_uuid == server.owner_id:
        raise HTTPException(status_code=403, detail="Cannot ban the server owner")
    
    # Check if already banned
    existing = await db.execute(
        select(Infraction).where(
            Infraction.server_id == server.id,
            Infraction.user_id == target_uuid,
            Infraction.type == PunishmentType.BAN,
            Infraction.is_active == "true"
        )
    )
    if existing.scalars().first():
        raise HTTPException(status_code=400, detail="User is already banned")
    
    # Create ban record
    infraction = Infraction(
        server_id=server.id,
        user_id=target_uuid,
        moderator_id=current_user.id,
        type=PunishmentType.BAN,
        reason=request.reason
    )
    db.add(infraction)
    
    # Create audit log
    await create_audit_log(
        db, server.id, current_user.id,
        AuditActionType.MEMBER_BAN, "user", user_id,
        reason=request.reason,
        changes={"delete_message_days": request.delete_message_days}
    )
    
    await db.commit()
    
    # Notify the banned user
    await manager.send_personal_message({
        "type": "banned",
        "server_id": server_id,
        "reason": request.reason
    }, user_id)
    
    return {"message": "User banned successfully", "reason": request.reason}


@router.delete("/{server_id}/bans/{user_id}", status_code=status.HTTP_200_OK)
async def unban_member(
    server_id: str,
    user_id: str,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Unban a member from the server."""
    server = await get_server_or_404(db, server_id)
    
    if not await check_mod_permission(db, server, current_user, Permission.BAN_MEMBERS):
        raise HTTPException(status_code=403, detail="Missing BAN_MEMBERS permission")
    
    try:
        target_uuid = uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user ID")
    
    # Find active ban
    result = await db.execute(
        select(Infraction).where(
            Infraction.server_id == server.id,
            Infraction.user_id == target_uuid,
            Infraction.type == PunishmentType.BAN,
            Infraction.is_active == "true"
        )
    )
    ban = result.scalars().first()
    
    if not ban:
        raise HTTPException(status_code=404, detail="User is not banned")
    
    # Deactivate ban
    ban.is_active = "false"
    
    # Create audit log
    await create_audit_log(
        db, server.id, current_user.id,
        AuditActionType.MEMBER_UNBAN, "user", user_id
    )
    
    await db.commit()
    
    return {"message": "User unbanned successfully"}


@router.get("/{server_id}/bans")
async def list_bans(
    server_id: str,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List all banned members."""
    server = await get_server_or_404(db, server_id)
    
    if not await check_mod_permission(db, server, current_user, Permission.BAN_MEMBERS):
        raise HTTPException(status_code=403, detail="Missing BAN_MEMBERS permission")
    
    result = await db.execute(
        select(Infraction).where(
            Infraction.server_id == server.id,
            Infraction.type == PunishmentType.BAN,
            Infraction.is_active == "true"
        )
    )
    bans = result.scalars().all()
    
    return [InfractionResponse.model_validate(ban) for ban in bans]


@router.post("/{server_id}/members/{user_id}/timeout", status_code=status.HTTP_200_OK)
async def timeout_member(
    server_id: str,
    user_id: str,
    request: TimeoutRequest,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Timeout (mute) a member."""
    server = await get_server_or_404(db, server_id)
    
    if not await check_mod_permission(db, server, current_user, Permission.TIMEOUT_MEMBERS):
        raise HTTPException(status_code=403, detail="Missing TIMEOUT_MEMBERS permission")
    
    try:
        target_uuid = uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user ID")
    
    if target_uuid == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot timeout yourself")
    
    if target_uuid == server.owner_id:
        raise HTTPException(status_code=403, detail="Cannot timeout the server owner")
    
    expires_at = datetime.utcnow() + timedelta(seconds=request.duration_seconds)
    
    # Create timeout record
    infraction = Infraction(
        server_id=server.id,
        user_id=target_uuid,
        moderator_id=current_user.id,
        type=PunishmentType.TIMEOUT,
        reason=request.reason,
        expires_at=expires_at
    )
    db.add(infraction)
    
    # Create audit log
    await create_audit_log(
        db, server.id, current_user.id,
        AuditActionType.MEMBER_TIMEOUT, "user", user_id,
        reason=request.reason,
        changes={"duration_seconds": request.duration_seconds, "expires_at": expires_at.isoformat()}
    )
    
    await db.commit()
    
    # Notify the timed out user
    await manager.send_personal_message({
        "type": "timeout",
        "server_id": server_id,
        "expires_at": expires_at.isoformat(),
        "reason": request.reason
    }, user_id)
    
    return {"message": "User timed out", "expires_at": expires_at}


@router.delete("/{server_id}/members/{user_id}/timeout", status_code=status.HTTP_200_OK)
async def remove_timeout(
    server_id: str,
    user_id: str,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Remove timeout from a member."""
    server = await get_server_or_404(db, server_id)
    
    if not await check_mod_permission(db, server, current_user, Permission.TIMEOUT_MEMBERS):
        raise HTTPException(status_code=403, detail="Missing TIMEOUT_MEMBERS permission")
    
    try:
        target_uuid = uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user ID")
    
    # Find active timeout
    result = await db.execute(
        select(Infraction).where(
            Infraction.server_id == server.id,
            Infraction.user_id == target_uuid,
            Infraction.type == PunishmentType.TIMEOUT,
            Infraction.is_active == "true"
        )
    )
    timeout = result.scalars().first()
    
    if not timeout:
        raise HTTPException(status_code=404, detail="User is not timed out")
    
    timeout.is_active = "false"
    
    await create_audit_log(
        db, server.id, current_user.id,
        AuditActionType.MEMBER_TIMEOUT_REMOVE, "user", user_id
    )
    
    await db.commit()
    
    return {"message": "Timeout removed"}


@router.get("/{server_id}/audit-log")
async def get_audit_log(
    server_id: str,
    action_type: Optional[str] = Query(None),
    actor_id: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get server audit log."""
    server = await get_server_or_404(db, server_id)
    
    if not await check_mod_permission(db, server, current_user, Permission.VIEW_AUDIT_LOG):
        raise HTTPException(status_code=403, detail="Missing VIEW_AUDIT_LOG permission")
    
    query = select(AuditLogEntry).where(AuditLogEntry.server_id == server.id)
    
    if action_type:
        query = query.where(AuditLogEntry.action_type == action_type)
    
    if actor_id:
        try:
            actor_uuid = uuid.UUID(actor_id)
            query = query.where(AuditLogEntry.actor_id == actor_uuid)
        except ValueError:
            pass
    
    query = query.order_by(AuditLogEntry.created_at.desc()).limit(limit)
    
    result = await db.execute(query)
    logs = result.scalars().all()
    
    return [AuditLogResponse.model_validate(log) for log in logs]


@router.get("/{server_id}/infractions/{user_id}")
async def get_user_infractions(
    server_id: str,
    user_id: str,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get all infractions for a specific user."""
    server = await get_server_or_404(db, server_id)
    
    if not await check_mod_permission(db, server, current_user, Permission.VIEW_AUDIT_LOG):
        raise HTTPException(status_code=403, detail="Missing VIEW_AUDIT_LOG permission")
    
    try:
        target_uuid = uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user ID")
    
    result = await db.execute(
        select(Infraction).where(
            Infraction.server_id == server.id,
            Infraction.user_id == target_uuid
        ).order_by(Infraction.created_at.desc())
    )
    infractions = result.scalars().all()
    
    return [InfractionResponse.model_validate(inf) for inf in infractions]
