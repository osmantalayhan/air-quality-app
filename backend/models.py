from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime

Base = declarative_base()

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    name = Column(String)
    hashed_password = Column(String)
    is_active = Column(Boolean, default=True)

class AirQualityData(Base):
    __tablename__ = "air_quality_data"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    latitude = Column(Float)
    longitude = Column(Float)
    pm25 = Column(Float)  # PM2.5 değeri
    pm10 = Column(Float)  # PM10 değeri
    no2 = Column(Float)   # NO2 değeri
    so2 = Column(Float)   # SO2 değeri
    o3 = Column(Float)    # O3 değeri
    aqi = Column(Float)   # Hava Kalitesi İndeksi

class Anomaly(Base):
    __tablename__ = "anomalies"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    air_quality_data_id = Column(Integer, ForeignKey("air_quality_data.id"))
    type = Column(String)  # Anomali tipi (PM2.5, PM10, NO2, vb.)
    severity = Column(String)  # Anomali şiddeti (LOW, MEDIUM, HIGH, CRITICAL)
    description = Column(String)
    is_resolved = Column(Boolean, default=False)
    resolved_at = Column(DateTime, nullable=True)

    air_quality_data = relationship("AirQualityData") 