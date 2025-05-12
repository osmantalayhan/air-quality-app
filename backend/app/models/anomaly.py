from sqlalchemy import Column, Integer, String, DateTime, Enum
from app.db.base_class import Base
import enum

class AnomalyStatus(str, enum.Enum):
    NEW = "new"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"
    CLOSED = "closed"

class AnomalySeverity(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class Anomaly(Base):
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    description = Column(String)
    severity = Column(Enum(AnomalySeverity), default=AnomalySeverity.LOW)
    status = Column(Enum(AnomalyStatus), default=AnomalyStatus.NEW)
    source = Column(String)
    timestamp = Column(DateTime)
    created_at = Column(DateTime)
    updated_at = Column(DateTime) 