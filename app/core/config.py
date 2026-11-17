from typing import Optional
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "Daily-Productive"
    app_version: str = "1.0.0"
    debug: bool = False
    database_url: str

    secret_key: str = Field(..., alias="jwt_secret_key")
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    n8n_webhook_url: str = "http://localhost:5678/webhook/daily-productive"
    gemini_api_key: Optional[str] = None
    allow_registration: bool = True
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"

    @field_validator("secret_key")
    @classmethod
    def validate_secret_key(cls, v: str) -> str:
        if not v or len(v.strip()) < 32:
            raise ValueError("JWT secret_key must be at least 32 characters long.")
        return v.strip()

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        populate_by_name = True
        extra = "ignore"


settings = Settings()
