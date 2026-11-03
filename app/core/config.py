from pydantic_settings import BaseSettings
class Settings(BaseSettings):
    app_name: str = "Daily-Productive"
    app_version : str = "0.1.0"
    debug : bool = True 
    database_url: str

    secret_key: str = "daily-productive-super-secret-jwt-key-2026-xyz-32bytes-min"
    algorithm: str = "HS256"
    access_token_expire_minutes : int = 60
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
settings = Settings()
