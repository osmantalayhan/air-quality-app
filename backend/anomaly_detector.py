from typing import Dict, Any, List
import numpy as np
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from models import AirQualityData, Anomaly
import logging

logger = logging.getLogger(__name__)

class AnomalyDetector:
    def __init__(self, db: Session):
        self.db = db
        self.thresholds = {
            'pm25': 35.0,  # WHO standartlarına göre
            'pm10': 50.0,
            'no2': 200.0,
            'so2': 20.0,
            'o3': 100.0
        }

    def detect_anomalies(self, data: AirQualityData) -> List[Dict[str, Any]]:
        """Hava kalitesi verilerinde anomali tespit eder"""
        anomalies = []
        
        # 1. Eşik değeri kontrolü
        for param in ['pm25', 'pm10', 'no2', 'so2', 'o3']:
            value = getattr(data, param)
            if param in self.thresholds and value > self.thresholds[param]:
                anomalies.append({
                    'id': data.id,
                    'type': param,
                    'severity': self._calculate_severity(param, value),
                    'description': f'{param.upper()} değeri eşik değerini aştı: {value} > {self.thresholds[param]}'
                })

        # 2. Son 24 saatlik ortalamaya göre kontrol
        last_24h_avg = self._get_last_24h_average(data.latitude, data.longitude)
        if last_24h_avg:
            for param in ['pm25', 'pm10', 'no2', 'so2', 'o3']:
                value = getattr(data, param)
                if param in last_24h_avg:
                    avg = last_24h_avg[param]
                    if avg > 0 and value > avg * 1.5:  # %50'den fazla artış
                        anomalies.append({
                            'id': data.id,
                            'type': param,
                            'severity': 'HIGH',
                            'description': f'{param.upper()} değeri son 24 saatlik ortalamaya göre %50\'den fazla arttı'
                        })

        # 3. Bölgesel farklılık kontrolü
        regional_diff = self._check_regional_differences(data)
        if regional_diff:
            anomalies.extend(regional_diff)

        # Anomalileri kaydet
        for anomaly in anomalies:
            self.save_anomaly(data.id, anomaly)

        return anomalies

    def _calculate_severity(self, param: str, value: float) -> str:
        """Anomali şiddetini hesaplar"""
        threshold = self.thresholds[param]
        if value > threshold * 2:
            return 'CRITICAL'
        elif value > threshold * 1.5:
            return 'HIGH'
        elif value > threshold * 1.2:
            return 'MEDIUM'
        else:
            return 'LOW'

    def _get_last_24h_average(self, latitude: float, longitude: float) -> Dict[str, float]:
        """Son 24 saatlik ortalamayı hesaplar"""
        last_24h = datetime.utcnow() - timedelta(hours=24)
        data = self.db.query(AirQualityData).filter(
            AirQualityData.latitude.between(latitude - 0.1, latitude + 0.1),
            AirQualityData.longitude.between(longitude - 0.1, longitude + 0.1),
            AirQualityData.timestamp >= last_24h
        ).all()

        if not data:
            return None

        averages = {}
        for param in ['pm25', 'pm10', 'no2', 'so2', 'o3']:
            values = [getattr(d, param) for d in data if getattr(d, param) is not None]
            if values:
                averages[param] = sum(values) / len(values)

        return averages

    def _check_regional_differences(self, data: AirQualityData) -> List[Dict[str, Any]]:
        """Bölgesel farklılıkları kontrol eder"""
        anomalies = []
        nearby_data = self.db.query(AirQualityData).filter(
            AirQualityData.latitude.between(data.latitude - 0.1, data.latitude + 0.1),
            AirQualityData.longitude.between(data.longitude - 0.1, data.longitude + 0.1),
            AirQualityData.timestamp >= datetime.utcnow() - timedelta(hours=1)
        ).all()

        if not nearby_data:
            return anomalies

        for param in ['pm25', 'pm10', 'no2', 'so2', 'o3']:
                nearby_values = [getattr(d, param) for d in nearby_data if getattr(d, param) is not None]
                if nearby_values:
                    avg_nearby = sum(nearby_values) / len(nearby_values)
                value = getattr(data, param)
                if avg_nearby > 0 and abs(value - avg_nearby) > avg_nearby * 0.5:  # %50'den fazla fark
                        anomalies.append({
                        'id': data.id,
                            'type': param,
                            'severity': 'MEDIUM',
                        'description': f'{param.upper()} değeri bölgesel ortalamadan önemli ölçüde farklı'
                        })

        return anomalies

    def save_anomaly(self, air_quality_data_id, anomaly):
        """Tespit edilen anormaliyi veritabanına kaydeder"""
        try:
            anomaly_record = Anomaly(
                air_quality_data_id=air_quality_data_id,
                type=anomaly['type'],
                severity=anomaly['severity'],
                description=anomaly['description']
            )
            self.db.add(anomaly_record)
            self.db.commit()
            return anomaly_record.id
        except Exception as e:
            self.db.rollback()
            logger.error(f"Anomali kaydı sırasında hata: {str(e)}")
            return None 