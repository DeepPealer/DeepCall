import json
import asyncio
from typing import Dict, List
from fastapi import WebSocket

class ConnectionManager:
    """
    Simple in-memory connection manager for local development.
    Does not require Redis - all routing is done in-process.
    """
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket, user_id: str):
        async with self._lock:
            if user_id not in self.active_connections:
                self.active_connections[user_id] = []
            self.active_connections[user_id].append(websocket)
            print(f"DEBUG: User {user_id} connected. Total connections: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket, user_id: str):
        if user_id in self.active_connections:
            if websocket in self.active_connections[user_id]:
                self.active_connections[user_id].remove(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
            print(f"DEBUG: User {user_id} disconnected. Remaining: {len(self.active_connections)}")

    async def broadcast_to_channel(self, channel_id: str, message: dict):
        """Broadcast message to all connected users (simplified for local dev)"""
        print(f"DEBUG: Broadcasting to channel {channel_id}")
        for user_id, connections in self.active_connections.items():
            for ws in connections:
                try:
                    await ws.send_json(message)
                except Exception as e:
                    print(f"DEBUG: Failed to send to {user_id}: {e}")

    async def send_personal_message(self, message: dict, user_id: str):
        """Send message directly to a specific user's WebSocket connections"""
        print(f"DEBUG: Sending personal message to user:{user_id}, type={message.get('type')}")
        
        if user_id in self.active_connections:
            print(f"DEBUG: Found {len(self.active_connections[user_id])} connections for {user_id}")
            for ws in self.active_connections[user_id]:
                try:
                    await ws.send_json(message)
                    print(f"DEBUG: Successfully sent to {user_id}")
                except Exception as e:
                    print(f"DEBUG: Failed to send to {user_id}: {e}")
        else:
            print(f"DEBUG: User {user_id} NOT connected. Active users: {list(self.active_connections.keys())}")

manager = ConnectionManager()
