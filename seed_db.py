import asyncio
from app.core.database import AsyncSessionLocal
from app.models.server import Server, Channel

async def seed_data():
    async with AsyncSessionLocal() as db:
        # Check if we already have data
        from sqlalchemy import select
        result = await db.execute(select(Server))
        existing_servers = result.scalars().all()
        
        if existing_servers:
            print("Database already has servers. Skipping seed.")
            return
        
        # Create a default server
        server = Server(
            name="DeepCall HQ",
            description="Welcome to the official DeepCall server!"
        )
        db.add(server)
        await db.flush()  # Get server.id
        
        # Create channels
        channels = [
            Channel(name="general", description="General chat", type="TEXT", server_id=server.id),
            Channel(name="announcements", description="Important announcements", type="TEXT", server_id=server.id),
            Channel(name="test-room", description="Voice chat room", type="VOICE", server_id=server.id),
        ]
        
        for channel in channels:
            db.add(channel)
        
        await db.commit()
        print(f"✅ Created server '{server.name}' with {len(channels)} channels")

if __name__ == "__main__":
    asyncio.run(seed_data())
