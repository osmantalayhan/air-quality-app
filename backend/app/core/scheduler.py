from fastapi_utils.tasks import repeat_every
from fastapi import FastAPI
from sqlalchemy.orm import Session
from datetime import datetime, time, timedelta
from app.db.session import SessionLocal
from app.api.v1.endpoints.anomalies import send_daily_anomaly_report
from app.core.config import settings
from app.core.email_manager import email_manager
from app.db.models import Anomaly

def setup_scheduler(app: FastAPI) -> None:
    """
    Zamanlanmış görevleri ayarlar
    """
    @app.on_event("startup")
    @repeat_every(seconds=60 * 60 * 24)  # Her 24 saatte bir
    async def send_daily_report() -> None:
        """
        Her gün belirli bir saatte günlük rapor gönderir
        """
        now = datetime.now().time()
        report_time = time(hour=settings.DAILY_REPORT_HOUR, minute=0)  # Varsayılan: sabah 8:00

        # Sadece belirlenen saatte çalıştır
        if now.hour == report_time.hour and now.minute < 5:  # 5 dakikalık bir pencere
            try:
                db = SessionLocal()
                await send_daily_anomaly_report(None, db)
            finally:
                db.close()

    @app.on_event("startup")
    @repeat_every(seconds=60 * 15)  # Her 15 dakikada bir
    async def check_critical_anomalies() -> None:
        """
        Kritik anomalileri kontrol eder ve gerekirse hatırlatma e-postası gönderir
        """
        try:
            db = SessionLocal()
            # Son 15 dakika içinde çözülmemiş kritik anomalileri al
            critical_anomalies = db.query(Anomaly).filter(
                Anomaly.severity == "CRITICAL",
                Anomaly.status.in_(["NEW", "IN_PROGRESS"]),
                Anomaly.created_at >= datetime.utcnow() - timedelta(minutes=15)
            ).all()

            # Her kritik anomali için hatırlatma gönder
            for anomaly in critical_anomalies:
                await email_manager.send_anomaly_notification(
                    email_to=settings.NOTIFICATION_EMAILS,
                    anomaly=anomaly.__dict__
                )
        finally:
            db.close() 