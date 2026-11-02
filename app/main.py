from fastapi import FastAPI
from app.core.config import settings
from app.routers import health, habits, tasks
from app.core.database import engine, Base
from app.models import models 
try:
    print("Connecting to Supabase and generating database tables...")
    Base.metadata.create_all(bind=engine)
    print(" Database tables synchronized successfully!")
except Exception as e:
    print(f" Database connection initialization failed: {e}")

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    debug=settings.debug
)
app.include_router(health.router)
app.include_router(tasks.router)
app.include_router(habits.router)
@app.get("/")
def read_root():
    return{"message": f"welocome to {settings.app_name} API. Head over to /docs for interactive testing."}