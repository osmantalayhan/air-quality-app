from typing import List, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.schemas.measurement import AnomalyInDB
from app.crud import anomalies
from app.core.config import settings
from sqlalchemy.sql import func
from datetime import datetime, timedelta

from app.api import deps
from app.crud import crud_anomaly
from app.schemas.anomaly import AnomalyCreate, AnomalyUpdate, Anomaly
from app.core.websocket import manager

router = APIRouter()

@router.get("/", response_model=List[AnomalyInDB])
def get_anomalies(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):

    return anomalies.get_multi(db=db, skip=skip, limit=limit)

@router.get("/active", response_model=List[AnomalyInDB])
def get_active_anomalies(
    db: Session = Depends(get_db)
):

    return anomalies.get_active(db=db)

@router.post("/{anomaly_id}/resolve", response_model=AnomalyInDB)
def resolve_anomaly(
    anomaly_id: int,
    db: Session = Depends(get_db)
):
    return anomalies.resolve(db=db, anomaly_id=anomaly_id)

async def notify_anomaly(anomaly: dict, event_type: str = "created"):
    # WebSocket bildirimi
    await manager.broadcast_anomaly(anomaly, event_type)
    
    # E-posta bildirimi (sadece kritik ve yüksek öncelikli anomaliler için)
    if str(anomaly.get("severity")).upper() in ["CRITICAL", "HIGH"]:
        await email_manager.send_anomaly_notification(
            email_to=settings.NOTIFICATION_EMAILS,
            anomaly=anomaly
        )

@router.post("/", response_model=Anomaly)
async def create_anomaly(
    *,
    anomaly_in: AnomalyCreate,
    db: Session = Depends(deps.get_db)
) -> Any:
    """
    Yeni bir anomali oluştur
    """
    anomaly = crud_anomaly.anomaly.create(db=db, obj_in=anomaly_in)
    await notify_anomaly(anomaly.__dict__, "created")
    return anomaly

@router.get("/", response_model=List[Anomaly])
async def read_anomalies(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(deps.get_db)
) -> Any:
    """
    Tüm anomalileri getir
    """
    anomalies = crud_anomaly.anomaly.get_multi(db=db, skip=skip, limit=limit)
    return anomalies

@router.get("/active", response_model=List[Anomaly])
async def read_active_anomalies(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(deps.get_db)
) -> Any:
    """
    Aktif anomalileri getir
    """
    return crud_anomaly.anomaly.get_active(db=db, skip=skip, limit=limit)

@router.get("/{anomaly_id}", response_model=Anomaly)
def read_anomaly(
    anomaly_id: int,
    db: Session = Depends(deps.get_db)
) -> Any:
    """
    ID'ye göre anomali getir
    """
    anomaly = crud_anomaly.anomaly.get(db=db, id=anomaly_id)
    if not anomaly:
        raise HTTPException(
            status_code=404,
            detail="Anomali bulunamadı"
        )
    return anomaly

@router.put("/{anomaly_id}", response_model=Anomaly)
async def update_anomaly(
    *,
    anomaly_id: int,
    anomaly_in: AnomalyUpdate,
    db: Session = Depends(deps.get_db)
) -> Any:
    """
    Anomaliyi güncelle
    """
    anomaly = crud_anomaly.anomaly.get(db=db, id=anomaly_id)
    if not anomaly:
        raise HTTPException(
            status_code=404,
            detail="Anomali bulunamadı"
        )
    anomaly = crud_anomaly.anomaly.update(db=db, db_obj=anomaly, obj_in=anomaly_in)
    await notify_anomaly(anomaly.__dict__, "updated")
    return anomaly

@router.post("/{anomaly_id}/resolve", response_model=Anomaly)
async def resolve_anomaly(
    anomaly_id: int,
    db: Session = Depends(deps.get_db)
) -> Any:
    
    anomaly = crud_anomaly.anomaly.resolve(db=db, anomaly_id=anomaly_id)
    if not anomaly:
        raise HTTPException(
            status_code=404,
            detail="Anomali bulunamadı"
        )
    await notify_anomaly(anomaly.__dict__, "resolved")
    return anomaly

@router.post("/{anomaly_id}/close", response_model=Anomaly)
async def close_anomaly(
    anomaly_id: int,
    db: Session = Depends(deps.get_db)
) -> Any:
    """
    Anomaliyi kapat
    """
    anomaly = crud_anomaly.anomaly.close(db=db, anomaly_id=anomaly_id)
    if not anomaly:
        raise HTTPException(
            status_code=404,
            detail="Anomali bulunamadı"
        )
    await notify_anomaly(anomaly.__dict__, "closed")
    return anomaly

@router.get("/by-severity/{severity}", response_model=List[Anomaly])
def read_anomalies_by_severity(
    severity: str,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(deps.get_db)
) -> Any:
    """
    Belirli bir ciddiyet seviyesindeki anomalileri getir
    """
    return crud_anomaly.anomaly.get_by_severity(db=db, severity=severity, skip=skip, limit=limit)

@router.get("/search/", response_model=List[Anomaly])
async def search_anomalies(
    search_text: Optional[str] = None,
    severity: Optional[List[str]] = Query(None),
    status: Optional[List[str]] = Query(None),
    source: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(deps.get_db)
) -> Any:
  
    return crud_anomaly.anomaly.search(
        db=db,
        search_text=search_text,
        severity=severity,
        status=status,
        source=source,
        start_date=start_date,
        end_date=end_date,
        skip=skip,
        limit=limit
    )

@router.get("/statistics/", response_model=dict)
async def get_anomaly_statistics(
    days: int = Query(30, gt=0, le=365),
    db: Session = Depends(deps.get_db)
) -> Any:
   
    return crud_anomaly.anomaly.get_statistics(db=db, days=days)

@router.get("/daily-count/", response_model=dict)
async def get_daily_anomaly_count(
    start_date: datetime = Query(..., description="Başlangıç tarihi"),
    end_date: datetime = Query(..., description="Bitiş tarihi"),
    severity: Optional[str] = Query(None, description="Ciddiyet seviyesi filtresi"),
    status: Optional[str] = Query(None, description="Durum filtresi"),
    db: Session = Depends(deps.get_db)
) -> Any:
    """
    Günlük anomali sayılarını getirir
    """
    query = db.query(
        func.date(Anomaly.timestamp).label('date'),
        func.count(Anomaly.id).label('count')
    )

    # Tarih aralığı filtresi
    query = query.filter(Anomaly.timestamp.between(start_date, end_date))

    # Ciddiyet seviyesi filtresi
    if severity:
        query = query.filter(Anomaly.severity == severity)

    # Durum filtresi
    if status:
        query = query.filter(Anomaly.status == status)

    # Günlük gruplama
    query = query.group_by(func.date(Anomaly.timestamp))
    
    # Sorguyu çalıştır ve sonuçları döndür
    results = query.all()
    return {
        "daily_counts": [
            {"date": str(result.date), "count": result.count}
            for result in results
        ]
    }

@router.post("/send-daily-report")
async def send_daily_anomaly_report(
    background_tasks: BackgroundTasks,
    db: Session = Depends(deps.get_db)
) -> Any:
    """
    Günlük anomali raporunu e-posta ile gönderir
    """
    # Son 24 saatteki anomalileri al
    now = datetime.utcnow()
    yesterday = now - timedelta(days=1)
    recent_anomalies = crud_anomaly.anomaly.get_by_date_range(
        db=db,
        start_date=yesterday,
        end_date=now
    )
    
    # İstatistikleri hesapla
    statistics = {
        "total_count": len(recent_anomalies),
        "by_severity": {},
        "by_status": {},
        "by_source": {}
    }
    
    for anomaly in recent_anomalies:
        # Ciddiyet seviyesine göre sayılar
        if anomaly.severity not in statistics["by_severity"]:
            statistics["by_severity"][anomaly.severity] = 0
        statistics["by_severity"][anomaly.severity] += 1
        
        # Duruma göre sayılar
        if anomaly.status not in statistics["by_status"]:
            statistics["by_status"][anomaly.status] = 0
        statistics["by_status"][anomaly.status] += 1
        
        # Kaynağa göre sayılar
        source = anomaly.source or "unknown"
        if source not in statistics["by_source"]:
            statistics["by_source"][source] = 0
        statistics["by_source"][source] += 1
    
    # Raporun arkaplanda gönderilmesi için background task ekle
    background_tasks.add_task(
        email_manager.send_daily_report,
        email_to=settings.NOTIFICATION_EMAILS,
        statistics=statistics
    )
    
    return {"status": "success", "message": "Günlük rapor gönderiliyor"} 