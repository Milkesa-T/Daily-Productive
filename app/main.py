from fastapi import FastAPI
from app.core.config import settings
from app.routers import health

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    debug=settings.debug
)
app.include_router(health.router)

@app.get("/")
def read_root():
    return{"message": f"welocome to {settings.app_name} API. Head over to /docs for interactive testing."}