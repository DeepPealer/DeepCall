import sys
import os

# Add the project directory to sys.path
sys.path.append(os.getcwd())

try:
    print("Importing app.main...")
    from app.main import app
    print("Successfully imported app.main")

    print("Importing app.api.read_states...")
    from app.api import read_states
    print("Successfully imported app.api.read_states")

    print("Checking database connection...")
    import asyncio
    from app.core.database import get_db
    
    async def check_db():
        async for session in get_db():
            print("Database session created successfully")
            await session.close()
            break
            
    asyncio.run(check_db())
    print("Database check complete")

except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
