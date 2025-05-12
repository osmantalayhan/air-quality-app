from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
from dotenv import load_dotenv

load_dotenv()

# TimescaleDB bağlantı bilgileri
POSTGRES_USER = os.getenv("POSTGRES_USER", "postgres")
POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD", "postgres")
POSTGRES_HOST = os.getenv("POSTGRES_HOST", "db")  # Varsayılanı localhost yerine db olarak değiştiriyoruz
POSTGRES_PORT = os.getenv("POSTGRES_PORT", "5432")
POSTGRES_DB = os.getenv("POSTGRES_DB", "air_quality")

# Alternatif olarak DATABASE_URL varsa onu kullan
DATABASE_URL = os.getenv("DATABASE_URL")
SQLALCHEMY_DATABASE_URL = DATABASE_URL if DATABASE_URL else f"postgresql://{POSTGRES_USER}:{POSTGRES_PASSWORD}@{POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DB}"

# TimescaleDB için özel engine oluştur
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    """Veritabanı oturumu oluşturur"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    """Veritabanını başlatır ve TimescaleDB uzantısını etkinleştirir"""
    from sqlalchemy import text
    
    # Veritabanı bağlantısı oluştur
    engine = create_engine(SQLALCHEMY_DATABASE_URL)
    
    # TimescaleDB uzantısını etkinleştir
    with engine.connect() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE"))
        conn.commit()
    
    # Tabloları oluştur
    Base.metadata.create_all(bind=engine)
    
    # AirQualityData tablosunu hypertable olarak ayarla
    with engine.connect() as conn:
        conn.execute(text("""
            SELECT create_hypertable('air_quality_data', 'timestamp', 
                chunk_time_interval => INTERVAL '1 day',
                if_not_exists => TRUE)
        """))
        conn.commit() 