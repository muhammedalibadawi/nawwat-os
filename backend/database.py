from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

try:
    from app.config import get_settings
    _settings = get_settings()
    SQLALCHEMY_DATABASE_URL = _settings.database_url
except Exception:
    SQLALCHEMY_DATABASE_URL = "sqlite:///./nawwat.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
