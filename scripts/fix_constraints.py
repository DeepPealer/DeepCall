import asyncio
from sqlalchemy import text
from app.core.database import engine

async def migrate():
    print("Updating foreign key constraints for safe deletion...")
    async with engine.begin() as conn:
        # For messages table
        print("Updating 'messages' table constraints...")
        # Drop if exists (we need to know the constraint name, or use a broad approach)
        # In SQLAlchemy default naming, it might be messages_reply_to_id_fkey
        try:
            # Try to find constraint name
            result = await conn.execute(text("""
                SELECT constraint_name 
                FROM information_schema.key_column_usage 
                WHERE table_name = 'messages' AND column_name = 'reply_to_id'
            """))
            for row in result:
                constraint_name = row[0]
                await conn.execute(text(f"ALTER TABLE messages DROP CONSTRAINT {constraint_name}"))
            
            await conn.execute(text("ALTER TABLE messages ADD FOREIGN KEY (reply_to_id) REFERENCES messages(id) ON DELETE SET NULL"))
        except Exception as e:
            print(f"Messages constraint update update skipped or failed: {e}")

        # For direct_messages table
        print("Updating 'direct_messages' table constraints...")
        try:
            result = await conn.execute(text("""
                SELECT constraint_name 
                FROM information_schema.key_column_usage 
                WHERE table_name = 'direct_messages' AND column_name = 'reply_to_id'
            """))
            for row in result:
                constraint_name = row[0]
                await conn.execute(text(f"ALTER TABLE direct_messages DROP CONSTRAINT {constraint_name}"))
                
            await conn.execute(text("ALTER TABLE direct_messages ADD FOREIGN KEY (reply_to_id) REFERENCES direct_messages(id) ON DELETE SET NULL"))
        except Exception as e:
            print(f"Direct messages constraint update update skipped or failed: {e}")
            
    print("Migration completed successfully!")

if __name__ == "__main__":
    asyncio.run(migrate())
