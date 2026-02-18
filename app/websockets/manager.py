import json
import asyncio
from typing import Dict, List, Set
from fastapi import WebSocket

class ConnectionManager:
    """
    In-memory connection manager for local development.
    Handles WebSocket connections, channel broadcasts, voice state, and user presence.
    """
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}
        self.voice_occupants: Dict[str, List[dict]] = {}  # channel_id -> [{id, username, avatar}]
        self.user_presence: Dict[str, str] = {}  # user_id -> status (online/idle/dnd/offline)
        self.user_info: Dict[str, dict] = {}  # user_id -> {username, avatar}
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket, user_id: str, username: str = None, avatar: str = None):
        async with self._lock:
            was_offline = user_id not in self.active_connections or len(self.active_connections.get(user_id, [])) == 0
            if user_id not in self.active_connections:
                self.active_connections[user_id] = []
            self.active_connections[user_id].append(websocket)
            
            # Track user info for presence broadcasts
            if username:
                self.user_info[user_id] = {"username": username, "avatar": avatar}
            
            # Set online if was offline
            if was_offline:
                self.user_presence[user_id] = "online"
                print(f"DEBUG: User {user_id} ({username}) is now ONLINE")
                await self._broadcast_presence(user_id, "online")
            
            print(f"DEBUG: User {user_id} connected. Total users online: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket, user_id: str):
        if user_id in self.active_connections:
            if websocket in self.active_connections[user_id]:
                self.active_connections[user_id].remove(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
                self.user_presence[user_id] = "offline"
                print(f"DEBUG: User {user_id} is now OFFLINE")
                # Schedule presence broadcast (can't await in sync method)
                asyncio.create_task(self._broadcast_presence(user_id, "offline"))
            print(f"DEBUG: User {user_id} disconnected. Remaining users: {len(self.active_connections)}")

    def get_online_user_ids(self) -> List[str]:
        """Get list of all online user IDs"""
        return list(self.active_connections.keys())

    def is_online(self, user_id: str) -> bool:
        return user_id in self.active_connections and len(self.active_connections[user_id]) > 0

    async def _broadcast_presence(self, user_id: str, status: str):
        """Broadcast presence change to all connected users"""
        info = self.user_info.get(user_id, {})
        message = {
            "type": "presence_update",
            "user_id": user_id,
            "status": status,
            "username": info.get("username", ""),
            "avatar": info.get("avatar", "")
        }
        for uid, connections in self.active_connections.items():
            for ws in connections:
                try:
                    await ws.send_json(message)
                except:
                    pass

    async def broadcast_full_presence(self, websocket: WebSocket):
        """Send current presence state of all users to a newly connected client"""
        online_users = []
        for uid in self.active_connections:
            info = self.user_info.get(uid, {})
            online_users.append({
                "user_id": uid,
                "status": self.user_presence.get(uid, "online"),
                "username": info.get("username", ""),
                "avatar": info.get("avatar", "")
            })
        try:
            await websocket.send_json({
                "type": "presence_bulk",
                "users": online_users
            })
        except:
            pass

    async def broadcast_to_channel(self, channel_id: str, message: dict):
        """Broadcast message to all connected users (simplified for local dev)"""
        for user_id, connections in self.active_connections.items():
            for ws in connections:
                try:
                    await ws.send_json(message)
                except Exception as e:
                    print(f"DEBUG: Failed to send to {user_id}: {e}")

    async def send_personal_message(self, message: dict, user_id: str):
        """Send message directly to a specific user's WebSocket connections"""
        if user_id in self.active_connections:
            for ws in self.active_connections[user_id]:
                try:
                    await ws.send_json(message)
                except Exception as e:
                    print(f"DEBUG: Failed to send to {user_id}: {e}")

    async def handle_voice_join(self, channel_id: str, user: dict):
        async with self._lock:
            if channel_id not in self.voice_occupants:
                self.voice_occupants[channel_id] = []
            self.voice_occupants[channel_id] = [u for u in self.voice_occupants[channel_id] if u['id'] != user['id']]
            self.voice_occupants[channel_id].append(user)
            print(f"DEBUG: User {user['username']} joined voice {channel_id}")
            await self.broadcast_voice_state(channel_id)

    async def handle_voice_leave(self, channel_id: str, user_id: str):
        async with self._lock:
            if channel_id in self.voice_occupants:
                self.voice_occupants[channel_id] = [u for u in self.voice_occupants[channel_id] if u['id'] != user_id]
                print(f"DEBUG: User {user_id} left voice {channel_id}")
                await self.broadcast_voice_state(channel_id)

    async def broadcast_voice_state(self, channel_id: str):
        users = self.voice_occupants.get(channel_id, [])
        message = {
            "type": "voice_state_update",
            "channel_id": channel_id,
            "users": users
        }
        for user_id, connections in self.active_connections.items():
            for ws in connections:
                try:
                    await ws.send_json(message)
                except:
                    pass

manager = ConnectionManager()
