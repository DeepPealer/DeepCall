import asyncio
from app.core.database import AsyncSessionLocal
from sqlalchemy import text

async def check_tables():
    async with AsyncSessionLocal() as db:
        # Check if friendships table exists
        result = await db.execute(text("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('friendships', 'direct_messages')
        """))
        tables = result.fetchall()
        print("Found tables:", [t[0] for t in tables])
        
        # Check all tables
        result = await db.execute(text("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        """))
        all_tables = result.fetchall()
        print("\nAll tables:", [t[0] for t in all_tables])

if __name__ == "__main__":
    asyncio.run(check_tables())
