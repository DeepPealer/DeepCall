import asyncio
from sqlalchemy import text
from app.core.database import engine

async def check():
    async with engine.connect() as conn:
        try:
            result = await conn.execute(text("SELECT version_num FROM alembic_version"))
            version = result.scalar()
            print(f"Current Alembic Version: {version}")
        except Exception as e:
            print(f"Error checking alembic version: {e}")

if __name__ == "__main__":
    asyncio.run(check())
