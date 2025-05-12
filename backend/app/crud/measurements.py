from typing import List
from sqlalchemy.orm import Session
from sqlalchemy import desc, text
from app.models.measurement import AirQualityMeasurement
from app.schemas.measurement import MeasurementCreate

def create(db: Session, *, obj_in: MeasurementCreate) -> AirQualityMeasurement:
    db_obj = AirQualityMeasurement(
        timestamp=obj_in.timestamp,
        latitude=obj_in.latitude,
        longitude=obj_in.longitude,
        pm25=obj_in.pm25,
        pm10=obj_in.pm10,
        no2=obj_in.no2,
        so2=obj_in.so2,
        o3=obj_in.o3
    )
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj

def get_multi(db: Session, *, skip: int = 0, limit: int = 100) -> List[AirQualityMeasurement]:
    return db.query(AirQualityMeasurement)\
        .order_by(desc(AirQualityMeasurement.timestamp))\
        .offset(skip)\
        .limit(limit)\
        .all()

def get_latest(db: Session, *, limit: int = 10) -> List[AirQualityMeasurement]:
    return db.query(AirQualityMeasurement)\
        .order_by(desc(AirQualityMeasurement.timestamp))\
        .limit(limit)\
        .all()

def get_by_location(
    db: Session,
    *,
    latitude: float,
    longitude: float,
    radius: float = 25.0
) -> List[AirQualityMeasurement]:
    # Haversine formula for calculating distance
    query = text("""
        SELECT *
        FROM air_quality_measurements
        WHERE (
            6371 * acos(
                cos(radians(:lat)) * cos(radians(latitude)) *
                cos(radians(longitude) - radians(:lon)) +
                sin(radians(:lat)) * sin(radians(latitude))
            )
        ) < :radius
        ORDER BY timestamp DESC
        LIMIT 100;
    """)
    
    result = db.execute(
        query,
        {"lat": latitude, "lon": longitude, "radius": radius}
    )
    
    return [AirQualityMeasurement(**dict(row)) for row in result] 