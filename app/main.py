from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.routers import (
    health,
    habits,
    tasks,
    goals,
    auth,
    journal,
    categories,
    reminders,
    dashboard,
    github,
)

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    debug=settings.debug,
)

origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(auth.router)
app.include_router(tasks.router)
app.include_router(habits.router)
app.include_router(goals.router)
app.include_router(journal.router)
app.include_router(categories.router)
app.include_router(reminders.router)
app.include_router(dashboard.router)
app.include_router(github.router)


@app.get("/")
def read_root():
    return {"message": f"Welcome to {settings.app_name} API. Head over to /docs for interactive testing."}
