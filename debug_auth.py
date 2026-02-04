import asyncio
import uuid
from app.core.database import AsyncSessionLocal
from app.models.user import User
from app.core import security
from sqlalchemy import select

async def debug_register():
    print("Starting debug register...")
    async with AsyncSessionLocal() as db:
        username = "debug_user_" + str(uuid.uuid4())[:8]
        email = f"{username}@example.com"
        password = "password123"
        
        print(f"Creating user {username}...")
        try:
            hashed = security.get_password_hash(password)
            print(f"Hashed password: {hashed}")
            
            user = User(
                email=email,
                username=username,
                hashed_password=hashed,
                is_active=True
            )
            print("Adding to DB session...")
            db.add(user)
            print("Committing...")
            await db.commit()
            print("Refreshing...")
            await db.refresh(user)
            print(f"Success! User ID: {user.id}")
        except Exception as e:
            print(f"ERROR: {e}")
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(debug_register())
