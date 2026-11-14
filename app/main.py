from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.routers import health, habits, tasks, goals, auth, journal

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    debug=settings.debug
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
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

@app.get("/")
def read_root():
    return {"message": f"Welcome to {settings.app_name} API. Head over to /docs for interactive testing."}
