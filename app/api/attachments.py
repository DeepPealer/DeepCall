from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
import shutil
import os
import uuid
from app.api import deps
from app.models.user import User

router = APIRouter()

UPLOAD_DIR = "uploads"
if not os.path.exists(UPLOAD_DIR):
    os.makedirs(UPLOAD_DIR)

@router.post("/upload")
async def upload_attachment(
    file: UploadFile = File(...),
    current_user: User = Depends(deps.get_current_user)
):
    """
    Upload a file and return its URL
    """
    # Check file size (8MB limit for free users for now)
    # We can implement more complex logic later
    
    file_ext = os.path.splitext(file.filename)[1]
    file_name = f"{uuid.uuid4()}{file_ext}"
    file_path = os.path.join(UPLOAD_DIR, file_name)
    
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not save file: {e}")
        
    # In production, we would use a CDN or S3 URL
    # For local dev, we use the local server's URL
    return {
        "url": f"http://localhost:8002/uploads/{file_name}",
        "filename": file.filename,
        "content_type": file.content_type
    }
