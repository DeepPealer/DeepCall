import asyncio
from sqlalchemy import text
from app.core.database import engine

async def migrate():
    print("Checking database schema...")
    async with engine.begin() as conn:
        # Check messages table
        print("Migrating 'messages' table...")
        await conn.execute(text("ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_id UUID REFERENCES messages(id)"))
        await conn.execute(text("ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_edited BOOLEAN DEFAULT FALSE"))
        await conn.execute(text("ALTER TABLE messages ADD COLUMN IF NOT EXISTS attachments TEXT"))
        
        # Check direct_messages table
        print("Migrating 'direct_messages' table...")
        await conn.execute(text("ALTER TABLE direct_messages ADD COLUMN IF NOT EXISTS reply_to_id UUID REFERENCES direct_messages(id)"))
        await conn.execute(text("ALTER TABLE direct_messages ADD COLUMN IF NOT EXISTS is_edited BOOLEAN DEFAULT FALSE"))
        await conn.execute(text("ALTER TABLE direct_messages ADD COLUMN IF NOT EXISTS attachments TEXT"))
        
    print("Migration completed successfully!")

if __name__ == "__main__":
    asyncio.run(migrate())
