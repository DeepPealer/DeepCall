import json
import asyncio
from typing import Dict, List
from fastapi import WebSocket
from redis.asyncio import Redis
from app.core.config import settings

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}
        self.redis = Redis.from_url(settings.REDIS_URL, decode_responses=True)
        self.pubsub = None
        self._listener_task = None
        self._lock = asyncio.Lock()

    async def _setup_pubsub(self):
        async with self._lock:
            if self.pubsub is None:
                self.pubsub = self.redis.pubsub()
                # Use pattern subscription to avoid individual subscribe calls later
                await self.pubsub.psubscribe("channel:*", "user:*")
                self._listener_task = asyncio.create_task(self._listen_to_redis())

    async def _listen_to_redis(self):
        try:
            # Use get_message loop for maximum control
            while True:
                if self.pubsub is None: break
                message = await self.pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
                if message and message['type'] == 'pmessage':
                    channel = message['channel'] # This is the actual channel name (e.g. user:uuid)
                    data_str = message['data']
                    try:
                        data = json.loads(data_str)
                    except:
                        continue
                        
                    if channel.startswith("channel:"):
                        # Broadcast to everyone (simplified for MVP)
                        for user_conns in self.active_connections.values():
                            for ws in user_conns:
                                try:
                                    await ws.send_json(data)
                                except: pass
                    elif channel.startswith("user:"):
                        user_id = channel.split(":")[1]
                        if user_id in self.active_connections:
                            for ws in self.active_connections[user_id]:
                                try:
                                    await ws.send_json(data)
                                except: pass
                await asyncio.sleep(0.01)
        except Exception as e:
            print(f"CRITICAL Redis listener error: {e}")
            self.pubsub = None
            # Immediate recovery attempt
            await asyncio.sleep(1)
            await self._setup_pubsub()

    async def connect(self, websocket: WebSocket, user_id: str):
        await self._setup_pubsub()
        async with self._lock:
            if user_id not in self.active_connections:
                self.active_connections[user_id] = []
            self.active_connections[user_id].append(websocket)
        
    def disconnect(self, websocket: WebSocket, user_id: str):
        if user_id in self.active_connections:
            if websocket in self.active_connections[user_id]:
                self.active_connections[user_id].remove(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]

    async def broadcast_to_channel(self, channel_id: str, message: dict):
        try:
            await self.redis.publish(f"channel:{channel_id}", json.dumps(message))
        except Exception as e:
            print(f"Publish error: {e}")

    async def send_personal_message(self, message: dict, user_id: str):
        try:
            await self.redis.publish(f"user:{user_id}", json.dumps(message))
        except Exception as e:
            print(f"Publish error: {e}")

manager = ConnectionManager()
