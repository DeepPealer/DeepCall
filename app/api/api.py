from fastapi import APIRouter
from app.api import auth, websockets, channels, friends, dms, servers, users, attachments, livekit, moderation, invites

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(websockets.router, tags=["websockets"])
api_router.include_router(channels.router, prefix="/channels", tags=["channels"])
api_router.include_router(friends.router, prefix="/friends", tags=["friends"])
api_router.include_router(dms.router, prefix="/dms", tags=["direct-messages"])
api_router.include_router(servers.router, prefix="/servers", tags=["servers"])
api_router.include_router(attachments.router, prefix="/attachments", tags=["attachments"])
api_router.include_router(livekit.router, prefix="/livekit", tags=["livekit"])
api_router.include_router(moderation.router, prefix="/moderation", tags=["moderation"])
api_router.include_router(invites.router, tags=["invites"])

