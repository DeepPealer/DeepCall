import asyncio
from sqlalchemy import inspect
from app.core.database import engine

async def check():
    async with engine.connect() as conn:
        def get_tables(sync_conn):
            inspector = inspect(sync_conn)
            tables = inspector.get_table_names()
            for table in tables:
                print(f"Table: {table}")
                for column in inspector.get_columns(table):
                    print(f"  - {column['name']} ({column['type']})")
        
        await conn.run_sync(get_tables)

if __name__ == "__main__":
    asyncio.run(check())
