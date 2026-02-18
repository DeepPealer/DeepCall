from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, select, and_, case
from typing import List, Dict, Optional
from pydantic import BaseModel
from app.core.database import get_db
from app.api import deps
from app.models.user import User
from app.models.read_state import ReadState
from app.models.message import Message
from app.models.direct_message import DirectMessage
from app.models.server import Channel, ServerMember, Server
from datetime import datetime
import uuid

router = APIRouter()

class AckRequest(BaseModel):
    channel_id: Optional[str] = None
    dm_other_user_id: Optional[str] = None

class UnreadState(BaseModel):
    channel_id: Optional[str] = None
    server_id: Optional[str] = None
    dm_other_user_id: Optional[str] = None
    unread_count: int
    last_read_at: Optional[datetime] = None

@router.post("/ack")
async def acknowledge_read(
    ack: AckRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user)
):
    """
    Update the last read timestamp for a channel or DM.
    """
    if ack.channel_id:
        # Update channel read state
        query = select(ReadState).where(
            ReadState.user_id == current_user.id,
            ReadState.channel_id == ack.channel_id
        )
        result = await db.execute(query)
        read_state = result.scalars().first()

        if not read_state:
            read_state = ReadState(
                user_id=current_user.id,
                channel_id=ack.channel_id,
                last_read_at=func.now()
            )
            db.add(read_state)
        else:
            read_state.last_read_at = func.now()
        
        await db.commit()
    
    elif ack.dm_other_user_id:
        # Update DM read state
        query = select(ReadState).where(
            ReadState.user_id == current_user.id,
            ReadState.dm_other_user_id == ack.dm_other_user_id
        )
        result = await db.execute(query)
        read_state = result.scalars().first()

        if not read_state:
            read_state = ReadState(
                user_id=current_user.id,
                dm_other_user_id=ack.dm_other_user_id,
                last_read_at=func.now()
            )
            db.add(read_state)
        else:
            read_state.last_read_at = func.now()
        
        await db.commit()
    
    return {"status": "ok"}

@router.get("/sync", response_model=List[UnreadState])
async def sync_unread_states(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user)
):
    """
    Get unread counts for all channels and DMs the user is part of.
    """
    response = []

    # 1. Get all channels the user is in (via ServerMember)
    query_channels = select(Channel.id).\
        join(Server, Server.id == Channel.server_id).\
        join(ServerMember, ServerMember.server_id == Server.id).\
        where(ServerMember.user_id == current_user.id)
    
    result_channels = await db.execute(query_channels)
    channel_ids = [str(c) for c in result_channels.scalars().all()]

    if channel_ids:
        # Get existing read states
        query_read_states = select(ReadState).where(
            ReadState.user_id == current_user.id,
            ReadState.channel_id.in_(channel_ids)
        )
        result_rs = await db.execute(query_read_states)
        read_states = result_rs.scalars().all()
        read_state_map = {str(rs.channel_id): rs.last_read_at for rs in read_states}

        # Optimized Query
        query = select(
            Message.channel_id,
            Channel.server_id,
            func.count(Message.id).label('unread_count')
        ).join(
            Channel, Channel.id == Message.channel_id
        ).outerjoin(
            ReadState, 
            and_(ReadState.channel_id == Message.channel_id, ReadState.user_id == current_user.id)
        ).where(
            Message.channel_id.in_(channel_ids),
            Message.created_at > func.coalesce(ReadState.last_read_at, datetime.min)
        ).group_by(Message.channel_id, Channel.server_id)
        
        results = await db.execute(query)
        
        for channel_id, server_id, count in results:
            last_read = read_state_map.get(str(channel_id))
            response.append(UnreadState(
                channel_id=str(channel_id),
                server_id=str(server_id),
                unread_count=count,
                last_read_at=last_read
            ))

    # 2. Get unread DMs
    dm_query = select(
        DirectMessage.sender_id,
        func.count(DirectMessage.id).label('unread_count')
    ).outerjoin(
        ReadState,
        and_(ReadState.dm_other_user_id == DirectMessage.sender_id, ReadState.user_id == current_user.id)
    ).where(
        DirectMessage.receiver_id == current_user.id,
        DirectMessage.created_at > func.coalesce(ReadState.last_read_at, datetime.min)
    ).group_by(DirectMessage.sender_id)
    
    dm_results = await db.execute(dm_query)
    
    # Fetch last_read_at for DMs
    query_dm_read = select(ReadState).where(
        ReadState.user_id == current_user.id,
        ReadState.dm_other_user_id.isnot(None)
    )
    result_dm_read = await db.execute(query_dm_read)
    dm_read_states = result_dm_read.scalars().all()
    dm_read_map = {str(rs.dm_other_user_id): rs.last_read_at for rs in dm_read_states}
    
    for sender_id, count in dm_results:
        last_read = dm_read_map.get(str(sender_id))
        response.append(UnreadState(
            dm_other_user_id=str(sender_id),
            unread_count=count,
            last_read_at=last_read
        ))

    return response
