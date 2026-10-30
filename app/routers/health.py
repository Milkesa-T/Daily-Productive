from datetime import datetime
from fastapi import APIRouter
from app.core.config import settings
router = APIRouter()

@router.get("/health")
def get_health():
    return{
        "status": "ok",
        "app": settings.app_name,
        "version": settings.app_version,
        "timestamp": datetime.utcnow().isoformat() + "Z"
    }
