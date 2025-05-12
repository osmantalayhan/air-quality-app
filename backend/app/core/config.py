from typing import List
from pydantic import BaseSettings

class Settings(BaseSettings):
    # API Settings
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "Hava Kalitesi API"

    # CORS Settings
    CORS_ORIGINS: str = "http://localhost:3000"

    # Database Settings
    DATABASE_URL: str = "postgresql://postgres:postgres@db:5432/hava"
    
    # RabbitMQ Settings
    RABBITMQ_URL: str = "amqp://guest:guest@rabbitmq:5672/"
    
    # SMTP Settings
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    EMAILS_FROM_EMAIL: str = ""
    EMAILS_FROM_NAME: str = "Hava Kalitesi Sistemi"
    
    # WHO Air Quality Standards (μg/m³)
    PM25_THRESHOLD: float = 15.0  # Annual mean
    PM10_THRESHOLD: float = 45.0  # Annual mean
    NO2_THRESHOLD: float = 25.0   # Annual mean
    SO2_THRESHOLD: float = 40.0   # 24-hour mean
    O3_THRESHOLD: float = 100.0   # 8-hour mean

    class Config:
        case_sensitive = True
        env_file = ".env"
        env_file_encoding = "utf-8"

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]

settings = Settings() 