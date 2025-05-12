from datetime import datetime
from sqlalchemy import Column, Integer, Float, DateTime, String
from app.db.base_class import Base

class AirQualityMeasurement(Base):
    __tablename__ = "air_quality_measurements"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime(timezone=True), nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    pm25 = Column(Float)
    pm10 = Column(Float)
    no2 = Column(Float)
    so2 = Column(Float)
    o3 = Column(Float)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

class Anomaly(Base):
    __tablename__ = "anomalies"

    id = Column(Integer, primary_key=True, index=True)
    measurement_id = Column(Integer, nullable=False)
    parameter = Column(String(10), nullable=False)
    threshold_value = Column(Float, nullable=False)
    actual_value = Column(Float, nullable=False)
    detected_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    status = Column(String(20), default="ACTIVE") 