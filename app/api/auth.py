from typing import Any
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.api import deps
from app.core import security
from app.core.database import get_db
from app.models.user import User
from app.schemas import auth as auth_schemas

router = APIRouter()

@router.post("/register", response_model=auth_schemas.User)
async def register(
    user_in: auth_schemas.UserCreate,
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Create new user.
    """
    try:
        print(f"Registering user: {user_in.email}")
        # Check if user exists
        result_email = await db.execute(select(User).where(User.email == user_in.email))
        if result_email.scalars().first():
            raise HTTPException(
                status_code=400,
                detail="The user with this email already exists in the system",
            )
        
        result_username = await db.execute(select(User).where(User.username == user_in.username))
        if result_username.scalars().first():
            raise HTTPException(
                status_code=400,
                detail="The user with this username already exists in the system",
            )

        print("Creating user object...")
        user = User(
            email=user_in.email,
            username=user_in.username,
            hashed_password=security.get_password_hash(user_in.password),
            is_active=True
        )
        db.add(user)
        print("Committing to DB...")
        await db.commit()
        print("Refreshing user...")
        await db.refresh(user)
        print("User created successfully")
        return user
    except Exception as e:
        print(f"Error in register: {e}")
        import traceback
        traceback.print_exc()
        raise e

@router.post("/login", response_model=auth_schemas.Token)
async def login(
    db: AsyncSession = Depends(get_db),
    form_data: OAuth2PasswordRequestForm = Depends()
) -> Any:
    """
    OAuth2 compatible token login, get an access token for future requests
    """
    result = await db.execute(select(User).where(User.email == form_data.username)) # OAuth2 form sends email as username
    user = result.scalars().first()

    if not user or not security.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect email or password"
        )
    elif not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
        
    access_token = security.create_access_token(subject=user.id)
    return {
        "access_token": access_token,
        "token_type": "bearer",
    }
