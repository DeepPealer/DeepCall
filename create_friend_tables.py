import asyncio
from app.core.database import AsyncSessionLocal
from sqlalchemy import text

async def create_tables():
    async with AsyncSessionLocal() as db:
        # Create friendship_status enum
        await db.execute(text("""
            DO $$ BEGIN
                CREATE TYPE friendship_status AS ENUM ('PENDING', 'ACCEPTED', 'BLOCKED');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        """))
        
        # Create friendships table
        await db.execute(text("""
            CREATE TABLE IF NOT EXISTS friendships (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID NOT NULL REFERENCES users(id),
                friend_id UUID NOT NULL REFERENCES users(id),
                status friendship_status NOT NULL DEFAULT 'PENDING',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        """))
        
        # Create direct_messages table
        await db.execute(text("""
            CREATE TABLE IF NOT EXISTS direct_messages (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                sender_id UUID NOT NULL REFERENCES users(id),
                recipient_id UUID NOT NULL REFERENCES users(id),
                content TEXT NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        """))
        
        await db.commit()
        print("✅ Tables created successfully!")

if __name__ == "__main__":
    asyncio.run(create_tables())
