from typing import List, Optional, Dict, Any, Union
from sqlalchemy.orm import Session
from sqlalchemy import desc, and_, or_, func
from datetime import datetime, timedelta

from app.crud.base import CRUDBase
from app.models.anomaly import Anomaly, AnomalyStatus, AnomalySeverity
from app.schemas.anomaly import AnomalyCreate, AnomalyUpdate

class CRUDAnomalies(CRUDBase[Anomaly, AnomalyCreate, AnomalyUpdate]):
    def get_multi(
        self, db: Session, *, skip: int = 0, limit: int = 100
    ) -> List[Anomaly]:
        return db.query(self.model).order_by(desc(Anomaly.created_at)).offset(skip).limit(limit).all()

    def create(self, db: Session, *, obj_in: AnomalyCreate) -> Anomaly:
        db_obj = Anomaly(
            title=obj_in.title,
            description=obj_in.description,
            severity=obj_in.severity,
            status=obj_in.status,
            source=obj_in.source,
            timestamp=obj_in.timestamp,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def update(
        self, db: Session, *, db_obj: Anomaly, obj_in: Union[AnomalyUpdate, Dict[str, Any]]
    ) -> Anomaly:
        if isinstance(obj_in, dict):
            update_data = obj_in
        else:
            update_data = obj_in.dict(exclude_unset=True)
        
        update_data["updated_at"] = datetime.utcnow()
        return super().update(db, db_obj=db_obj, obj_in=update_data)

    def get_active(self, db: Session, *, skip: int = 0, limit: int = 100) -> List[Anomaly]:
        """Aktif olan (çözülmemiş) anomalileri getirir"""
        return db.query(self.model)\
            .filter(Anomaly.status != AnomalyStatus.RESOLVED)\
            .filter(Anomaly.status != AnomalyStatus.CLOSED)\
            .order_by(desc(Anomaly.created_at))\
            .offset(skip)\
            .limit(limit)\
            .all()

    def resolve(self, db: Session, *, anomaly_id: int) -> Optional[Anomaly]:
        """Anomaliyi çözüldü olarak işaretler"""
        anomaly = db.query(self.model).filter(Anomaly.id == anomaly_id).first()
        if not anomaly:
            return None
        
        anomaly.status = AnomalyStatus.RESOLVED
        anomaly.updated_at = datetime.utcnow()
        db.add(anomaly)
        db.commit()
        db.refresh(anomaly)
        return anomaly

    def close(self, db: Session, *, anomaly_id: int) -> Optional[Anomaly]:
        """Anomaliyi kapatır"""
        anomaly = db.query(self.model).filter(Anomaly.id == anomaly_id).first()
        if not anomaly:
            return None
        
        anomaly.status = AnomalyStatus.CLOSED
        anomaly.updated_at = datetime.utcnow()
        db.add(anomaly)
        db.commit()
        db.refresh(anomaly)
        return anomaly

    def get_by_severity(self, db: Session, severity: str, *, skip: int = 0, limit: int = 100) -> List[Anomaly]:
        """Belirli bir ciddiyet seviyesindeki anomalileri getirir"""
        return db.query(self.model)\
            .filter(Anomaly.severity == severity)\
            .order_by(desc(Anomaly.created_at))\
            .offset(skip)\
            .limit(limit)\
            .all()

    def search(
        self,
        db: Session,
        *,
        search_text: Optional[str] = None,
        severity: Optional[List[str]] = None,
        status: Optional[List[str]] = None,
        source: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        skip: int = 0,
        limit: int = 100
    ) -> List[Anomaly]:
        """
        Gelişmiş arama ve filtreleme
        """
        query = db.query(self.model)

        # Metin araması (başlık ve açıklamada)
        if search_text:
            search_filter = or_(
                Anomaly.title.ilike(f"%{search_text}%"),
                Anomaly.description.ilike(f"%{search_text}%")
            )
            query = query.filter(search_filter)

        # Ciddiyet seviyesi filtresi
        if severity:
            query = query.filter(Anomaly.severity.in_(severity))

        # Durum filtresi
        if status:
            query = query.filter(Anomaly.status.in_(status))

        # Kaynak filtresi
        if source:
            query = query.filter(Anomaly.source.ilike(f"%{source}%"))

        # Tarih aralığı filtresi
        if start_date:
            query = query.filter(Anomaly.timestamp >= start_date)
        if end_date:
            query = query.filter(Anomaly.timestamp <= end_date)

        # Sıralama ve sayfalama
        return query.order_by(desc(Anomaly.created_at)).offset(skip).limit(limit).all()

    def get_statistics(self, db: Session, *, days: int = 30) -> Dict[str, Any]:
        """
        Anomali istatistiklerini getirir
        """
        start_date = datetime.utcnow() - timedelta(days=days)
        
        # Toplam anomali sayısı
        total_count = db.query(func.count(Anomaly.id)).scalar()

        # Durum bazlı dağılım
        status_distribution = db.query(
            Anomaly.status,
            func.count(Anomaly.id)
        ).group_by(Anomaly.status).all()

        # Ciddiyet seviyesi bazlı dağılım
        severity_distribution = db.query(
            Anomaly.severity,
            func.count(Anomaly.id)
        ).group_by(Anomaly.severity).all()

        # Son X gündeki anomaliler
        recent_anomalies = db.query(
            func.date(Anomaly.timestamp),
            func.count(Anomaly.id)
        ).filter(
            Anomaly.timestamp >= start_date
        ).group_by(
            func.date(Anomaly.timestamp)
        ).order_by(
            func.date(Anomaly.timestamp)
        ).all()

        return {
            "total_count": total_count,
            "status_distribution": dict(status_distribution),
            "severity_distribution": dict(severity_distribution),
            "daily_distribution": {
                date.strftime("%Y-%m-%d"): count 
                for date, count in recent_anomalies
            }
        }

anomaly = CRUDAnomalies(Anomaly) 