from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field

class MeasurementBase(BaseModel):
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    pm25: Optional[float] = Field(None, ge=0)
    pm10: Optional[float] = Field(None, ge=0)
    no2: Optional[float] = Field(None, ge=0)
    so2: Optional[float] = Field(None, ge=0)
    o3: Optional[float] = Field(None, ge=0)

class MeasurementCreate(MeasurementBase):
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class MeasurementInDB(MeasurementBase):
    id: int
    timestamp: datetime
    created_at: datetime

    class Config:
        from_attributes = True

class AnomalyBase(BaseModel):
    measurement_id: int
    parameter: str
    threshold_value: float
    actual_value: float

class AnomalyCreate(AnomalyBase):
    pass

class AnomalyInDB(AnomalyBase):
    id: int
    detected_at: datetime
    status: str

    class Config:
        from_attributes = True 