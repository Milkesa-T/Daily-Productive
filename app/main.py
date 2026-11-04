from fastapi import FastAPI
from app.core.config import settings
from app.routers import health, habits, tasks, goals, auth

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    debug=settings.debug
)

app.include_router(health.router)
app.include_router(auth.router)
app.include_router(tasks.router)
app.include_router(habits.router)
app.include_router(goals.router)

@app.get("/")
def read_root():
    return {"message": f"Welcome to {settings.app_name} API. Head over to /docs for interactive testing."}
