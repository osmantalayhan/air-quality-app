from typing import List
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.schemas.measurement import MeasurementCreate, MeasurementInDB
from app.crud import measurements, anomalies
from app.api.v1.endpoints.websocket import manager

router = APIRouter()

async def check_and_notify_anomalies(measurement: MeasurementInDB, db: Session):
    """
    Background task to check for anomalies and notify via WebSocket
    """
    detected_anomalies = anomalies.check_measurement_for_anomalies(db, measurement)
    for anomaly in detected_anomalies:
        await manager.broadcast_anomaly({
            "id": anomaly.id,
            "parameter": anomaly.parameter,
            "threshold_value": anomaly.threshold_value,
            "actual_value": anomaly.actual_value,
            "location": {
                "latitude": measurement.latitude,
                "longitude": measurement.longitude
            }
        })

@router.post("/", response_model=MeasurementInDB)
async def create_measurement(
    measurement: MeasurementCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Create new air quality measurement.
    """
    db_measurement = measurements.create(db=db, obj_in=measurement)
    background_tasks.add_task(check_and_notify_anomalies, db_measurement, db)
    return db_measurement

@router.get("/", response_model=List[MeasurementInDB])
def read_measurements(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """
    Retrieve air quality measurements.
    """
    return measurements.get_multi(db=db, skip=skip, limit=limit)

@router.get("/latest", response_model=List[MeasurementInDB])
def get_latest_measurements(
    limit: int = 10,
    db: Session = Depends(get_db)
):
    """
    Get latest air quality measurements.
    """
    return measurements.get_latest(db=db, limit=limit)

@router.get("/location", response_model=List[MeasurementInDB])
def get_measurements_by_location(
    latitude: float,
    longitude: float,
    radius: float = 25.0,  # km
    db: Session = Depends(get_db)
):
    """
    Get measurements within radius of a location.
    """
    return measurements.get_by_location(
        db=db,
        latitude=latitude,
        longitude=longitude,
        radius=radius
    ) 