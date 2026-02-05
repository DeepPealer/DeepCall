from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, and_
from app.api import deps
from app.core.database import get_db
from app.models.user import User
from app.models.friendship import Friendship, FriendshipStatus
from app.schemas.friends import FriendRequestCreate, FriendResponse

router = APIRouter()

@router.post("/request", status_code=status.HTTP_201_CREATED)
async def send_friend_request(
    request: FriendRequestCreate,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Send a friend request to another user"""
    # Find friend by username
    result = await db.execute(select(User).where(User.username == request.friend_username))
    friend = result.scalars().first()
    
    if not friend:
        raise HTTPException(status_code=404, detail="User not found")
    
    if friend.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot add yourself as friend")
    
    # Check if friendship already exists
    result = await db.execute(
        select(Friendship).where(
            or_(
                and_(Friendship.user_id == current_user.id, Friendship.friend_id == friend.id),
                and_(Friendship.user_id == friend.id, Friendship.friend_id == current_user.id)
            )
        )
    )
    existing = result.scalars().first()
    
    if existing:
        raise HTTPException(status_code=400, detail="Friend request already exists")
    
    # Create friendship
    friendship = Friendship(
        user_id=current_user.id,
        friend_id=friend.id,
        status=FriendshipStatus.PENDING
    )
    db.add(friendship)
    await db.commit()
    
    return {"message": f"Friend request sent to {friend.username}"}

@router.get("/", response_model=list[FriendResponse])
async def list_friends(
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List all accepted friends"""
    result = await db.execute(
        select(Friendship).where(
            or_(
                and_(Friendship.user_id == current_user.id, Friendship.status == FriendshipStatus.ACCEPTED),
                and_(Friendship.friend_id == current_user.id, Friendship.status == FriendshipStatus.ACCEPTED)
            )
        )
    )
    friendships = result.scalars().all()
    
    friends = []
    for fs in friendships:
        friend_id = fs.friend_id if fs.user_id == current_user.id else fs.user_id
        result = await db.execute(select(User).where(User.id == friend_id))
        friend = result.scalars().first()
        if friend:
            friends.append(FriendResponse(
                id=friend.id,
                username=friend.username,
                email=friend.email,
                avatar_url=friend.avatar_url,
                bio=friend.bio,
                status="ACCEPTED",
                created_at=fs.created_at
            ))
    
    return friends

@router.get("/pending", response_model=list[FriendResponse])
async def list_pending_requests(
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List pending friend requests (received)"""
    result = await db.execute(
        select(Friendship).where(
            and_(
                Friendship.friend_id == current_user.id,
                Friendship.status == FriendshipStatus.PENDING
            )
        )
    )
    friendships = result.scalars().all()
    
    pending = []
    for fs in friendships:
        result = await db.execute(select(User).where(User.id == fs.user_id))
        requester = result.scalars().first()
        if requester:
            pending.append(FriendResponse(
                id=requester.id,
                username=requester.username,
                email=requester.email,
                avatar_url=requester.avatar_url,
                bio=requester.bio,
                status="PENDING",
                created_at=fs.created_at
            ))
    
    return pending

@router.post("/{user_id}/accept")
async def accept_friend_request(
    user_id: str,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Accept a friend request"""
    import uuid as uuid_lib
    try:
        user_uuid = uuid_lib.UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user ID format")
    
    result = await db.execute(
        select(Friendship).where(
            and_(
                Friendship.user_id == user_uuid,
                Friendship.friend_id == current_user.id,
                Friendship.status == FriendshipStatus.PENDING
            )
        )
    )
    friendship = result.scalars().first()
    
    if not friendship:
        raise HTTPException(status_code=404, detail="Friend request not found")
    
    friendship.status = FriendshipStatus.ACCEPTED
    await db.commit()
    
    return {"message": "Friend request accepted"}

@router.delete("/{user_id}")
async def remove_friend(
    user_id: str,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Remove friend or reject friend request"""
    import uuid as uuid_lib
    try:
        user_uuid = uuid_lib.UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user ID format")
    
    result = await db.execute(
        select(Friendship).where(
            or_(
                and_(Friendship.user_id == current_user.id, Friendship.friend_id == user_uuid),
                and_(Friendship.user_id == user_uuid, Friendship.friend_id == current_user.id)
            )
        )
    )
    friendship = result.scalars().first()
    
    if not friendship:
        raise HTTPException(status_code=404, detail="Friendship not found")
    
    await db.delete(friendship)
    await db.commit()
    
    return {"message": "Friendship removed"}
