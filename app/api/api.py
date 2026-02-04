from fastapi import APIRouter
from app.api import auth, websockets, channels, friends, dms, servers

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(websockets.router, tags=["websockets"])
api_router.include_router(channels.router, prefix="/channels", tags=["channels"])
api_router.include_router(friends.router, prefix="/friends", tags=["friends"])
api_router.include_router(dms.router, prefix="/dms", tags=["direct-messages"])
api_router.include_router(servers.router, prefix="/servers", tags=["servers"])
