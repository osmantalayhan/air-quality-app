from typing import Optional
from datetime import datetime
from pydantic import BaseModel
from app.models.anomaly import AnomalyStatus, AnomalySeverity

# Shared properties
class AnomalyBase(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    severity: Optional[AnomalySeverity] = AnomalySeverity.LOW
    status: Optional[AnomalyStatus] = AnomalyStatus.NEW
    source: Optional[str] = None
    timestamp: Optional[datetime] = None

# Properties to receive on anomaly creation
class AnomalyCreate(AnomalyBase):
    title: str
    description: str
    source: str
    timestamp: datetime

# Properties to receive on anomaly update
class AnomalyUpdate(AnomalyBase):
    pass

# Properties shared by models stored in DB
class AnomalyInDBBase(AnomalyBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# Properties to return to client
class Anomaly(AnomalyInDBBase):
    pass

# Properties stored in DB
class AnomalyInDB(AnomalyInDBBase):
    pass 