from typing import List
from sqlalchemy.orm import Session
from sqlalchemy import desc
from app.models.measurement import Anomaly, AirQualityMeasurement
from app.core.config import settings

def create_anomaly(
    db: Session,
    measurement_id: int,
    parameter: str,
    threshold_value: float,
    actual_value: float
) -> Anomaly:
    """
    Create a new anomaly record.
    """
    db_obj = Anomaly(
        measurement_id=measurement_id,
        parameter=parameter,
        threshold_value=threshold_value,
        actual_value=actual_value
    )
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj

def get_multi(db: Session, *, skip: int = 0, limit: int = 100) -> List[Anomaly]:
    """
    Get multiple anomalies.
    """
    return db.query(Anomaly)\
        .order_by(desc(Anomaly.detected_at))\
        .offset(skip)\
        .limit(limit)\
        .all()

def get_active(db: Session) -> List[Anomaly]:
    """
    Get active anomalies.
    """
    return db.query(Anomaly)\
        .filter(Anomaly.status == "ACTIVE")\
        .order_by(desc(Anomaly.detected_at))\
        .all()

def resolve(db: Session, *, anomaly_id: int) -> Anomaly:
    """
    Mark an anomaly as resolved.
    """
    anomaly = db.query(Anomaly).filter(Anomaly.id == anomaly_id).first()
    if not anomaly:
        raise ValueError(f"Anomaly with id {anomaly_id} not found")
    
    anomaly.status = "RESOLVED"
    db.commit()
    db.refresh(anomaly)
    return anomaly

def check_measurement_for_anomalies(db: Session, measurement: AirQualityMeasurement) -> List[Anomaly]:
    """
    Check a measurement for any anomalies based on WHO thresholds.
    """
    anomalies = []
    
    # Check PM2.5
    if measurement.pm25 and measurement.pm25 > settings.PM25_THRESHOLD:
        anomalies.append(create_anomaly(
            db=db,
            measurement_id=measurement.id,
            parameter="PM2.5",
            threshold_value=settings.PM25_THRESHOLD,
            actual_value=measurement.pm25
        ))
    
    # Check PM10
    if measurement.pm10 and measurement.pm10 > settings.PM10_THRESHOLD:
        anomalies.append(create_anomaly(
            db=db,
            measurement_id=measurement.id,
            parameter="PM10",
            threshold_value=settings.PM10_THRESHOLD,
            actual_value=measurement.pm10
        ))
    
    # Check NO2
    if measurement.no2 and measurement.no2 > settings.NO2_THRESHOLD:
        anomalies.append(create_anomaly(
            db=db,
            measurement_id=measurement.id,
            parameter="NO2",
            threshold_value=settings.NO2_THRESHOLD,
            actual_value=measurement.no2
        ))
    
    # Check SO2
    if measurement.so2 and measurement.so2 > settings.SO2_THRESHOLD:
        anomalies.append(create_anomaly(
            db=db,
            measurement_id=measurement.id,
            parameter="SO2",
            threshold_value=settings.SO2_THRESHOLD,
            actual_value=measurement.so2
        ))
    
    # Check O3
    if measurement.o3 and measurement.o3 > settings.O3_THRESHOLD:
        anomalies.append(create_anomaly(
            db=db,
            measurement_id=measurement.id,
            parameter="O3",
            threshold_value=settings.O3_THRESHOLD,
            actual_value=measurement.o3
        ))
    
    return anomalies 