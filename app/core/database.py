from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from app.core.config import settings
engine = create_engine(settings.database_url)
sessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
SessionLocal = sessionLocal  # Alias for standard PascalCase naming
Base = declarative_base()

def get_db():
    db = sessionLocal()
    try:
        yield db 
    finally:
        db.close()
    