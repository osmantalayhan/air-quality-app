"""
Hava Kalitesi Verilerini İşleme Servisi
Burası RabbitMQ kuyruklarından mesajları dinler, işler ve gerekli analitik işlemleri gerçeklestirir.
"""
import asyncio
import json
import logging
import os
import sys
from datetime import datetime, timedelta
import signal
from typing import Dict, Any, List, Tuple

# RabbitMQ istemcisi
from rabbitmq_client import RabbitMQClient

# Loglama yapılandırması
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("data_processor")

# Global değişkenler
processed_data = {}  # İşlenmiş veri önbelleği
alert_history = {}   # Uyarı geçmişi

# Son 24 saatin AQI ortalamalarını tutan önbellek
# {location: [(timestamp, aqi_value), ...], ...}
aqi_history: Dict[str, List[Tuple[datetime, int]]] = {}

# Son 24 saatin diğer ölçümlerinin (PM2.5, PM10, vb.) ortalamalarını tutan önbellek
# {location: {metric: [(timestamp, value), ...], ...}, ...}
measurement_history: Dict[str, Dict[str, List[Tuple[datetime, float]]]] = {}

async def process_sensor_data(message: Dict[str, Any]):
    """
    Sensör verilerini işler, analiz eder ve gerekli hesaplamaları yapar
    """
    global aqi_history, measurement_history, processed_data
    
    try:
        location = message.get("location", "")
        timestamp_str = message.get("timestamp", "")
        
        if not location or not timestamp_str:
            logger.warning(f"Sensör verisi eksik bilgiler içeriyor: {message}")
            return
        
        # Timestamp'i datetime nesnesi olarak çevir
        timestamp = datetime.fromisoformat(timestamp_str)
        
        # AQI değerini al
        aqi = message.get("aqi", 0)
        
        # Diğer ölçüm değerlerini al
        pm25 = message.get("pm25", 0)
        pm10 = message.get("pm10", 0)
        no2 = message.get("no2", 0)
        so2 = message.get("so2", 0)
        o3 = message.get("o3", 0)
        
        # Lokasyon için AQI geçmişini başlat veya güncelle
        if location not in aqi_history:
            aqi_history[location] = []
        
        # Lokasyon için ölçüm geçmişini başlat veya güncelle
        if location not in measurement_history:
            measurement_history[location] = {
                "pm25": [],
                "pm10": [],
                "no2": [],
                "so2": [],
                "o3": []
            }
        
        # Yeni AQI değerini ekle
        aqi_history[location].append((timestamp, aqi))
        
        # Yeni ölçüm değerlerini ekle
        measurement_history[location]["pm25"].append((timestamp, pm25))
        measurement_history[location]["pm10"].append((timestamp, pm10))
        measurement_history[location]["no2"].append((timestamp, no2))
        measurement_history[location]["so2"].append((timestamp, so2))
        measurement_history[location]["o3"].append((timestamp, o3))
        
        # 24 saatten eski verileri temizle
        cutoff_time = datetime.now() - timedelta(hours=24)
        
        # AQI geçmişini temizle
        aqi_history[location] = [
            (ts, val) for ts, val in aqi_history[location]
            if ts > cutoff_time
        ]
        
        # Ölçüm geçmişini temizle
        for metric in measurement_history[location]:
            measurement_history[location][metric] = [
                (ts, val) for ts, val in measurement_history[location][metric]
                if ts > cutoff_time
            ]
        
        # AQI ortalamasını hesapla
        avg_aqi = 0
        if aqi_history[location]:
            avg_aqi = sum(val for _, val in aqi_history[location]) / len(aqi_history[location])
        
        # Diğer ölçümlerin ortalamalarını hesapla
        avg_metrics = {}
        for metric in measurement_history[location]:
            if measurement_history[location][metric]:
                avg_metrics[metric] = sum(val for _, val in measurement_history[location][metric]) / len(measurement_history[location][metric])
            else:
                avg_metrics[metric] = 0
        
        # İşlenmiş veriyi güncelle
        processed_data[location] = {
            "last_update": timestamp.isoformat(),
            "current_aqi": aqi,
            "avg_aqi_24h": round(avg_aqi, 1),
            "current_pm25": pm25,
            "avg_pm25_24h": round(avg_metrics["pm25"], 1),
            "current_pm10": pm10,
            "avg_pm10_24h": round(avg_metrics["pm10"], 1),
            "current_no2": no2,
            "avg_no2_24h": round(avg_metrics["no2"], 1),
            "current_so2": so2,
            "avg_so2_24h": round(avg_metrics["so2"], 1),
            "current_o3": o3,
            "avg_o3_24h": round(avg_metrics["o3"], 1),
            "data_points_count": len(aqi_history[location]),
            "trend": calculate_trend(aqi_history[location])
        }
        
        logger.info(f"Sensör verisi işlendi: {location}, AQI: {aqi}, Ortalama AQI: {round(avg_aqi, 1)}")
        
        # Trend ve eşik analizlerini yap
        perform_trend_analysis(location)
        
    except Exception as e:
        logger.error(f"Sensör verisi işlenirken hata: {str(e)}")

def calculate_trend(history: List[Tuple[datetime, int]]) -> str:
    """
    AQI değerlerinin trendi (yükselen, düşen, sabit) hesaplar
    """
    if len(history) < 2:
        return "stable"  # Yeterli veri yoksa sabit kabul et
    
    # En eski ve en yeni değerleri karşılaştır
    sorted_history = sorted(history, key=lambda x: x[0])
    oldest_val = sorted_history[0][1]
    newest_val = sorted_history[-1][1]
    
    # Değişim yüzdesi hesapla
    change_pct = ((newest_val - oldest_val) / max(1, oldest_val)) * 100
    
    if change_pct > 10:
        return "rising"  # %10'dan fazla artış varsa yükselen
    elif change_pct < -10:
        return "falling"  # %10'dan fazla düşüş varsa düşen
    else:
        return "stable"  # %10'dan az değişim varsa sabit

async def process_alert(message: Dict[str, Any]):
    """
    Uyarı mesajlarını işler ve gerekli analizleri yapar
    """
    global alert_history
    
    try:
        location = message.get("location", "")
        severity = message.get("severity", "")
        timestamp_str = message.get("timestamp", "")
        
        if not location or not severity or not timestamp_str:
            logger.warning(f"Uyarı mesajı eksik bilgiler içeriyor: {message}")
            return
        
        # Lokasyon için uyarı geçmişini başlat veya güncelle
        key = f"{location}_{severity}"
        if key not in alert_history:
            alert_history[key] = []
        
        # Yeni uyarıyı ekle
        alert_history[key].append(datetime.fromisoformat(timestamp_str))
        
        # Son 24 saatin uyarı sayısını hesapla
        cutoff_time = datetime.now() - timedelta(hours=24)
        alert_history[key] = [ts for ts in alert_history[key] if ts > cutoff_time]
        
        # Bu lokasyon ve severity için son 24 saatte kaç uyarı var?
        alert_count = len(alert_history[key])
        
        logger.info(f"Uyarı işlendi: {location}, Şiddet: {severity}, Son 24 saatteki uyarı sayısı: {alert_count}")
        
        # Eğer son 24 saatte belirli bir sayıdan fazla uyarı varsa ek işlemler yap
        if alert_count >= 3 and severity in ["high", "medium"]:
            logger.warning(f"DİKKAT! {location} bölgesinde son 24 saatte {alert_count} adet {severity} seviyeli uyarı var!")
            # Burada e-posta/SMS gönderme, yetkililere bildirim, vb. ek işlemler yapılabilir
    
    except Exception as e:
        logger.error(f"Uyarı mesajı işlenirken hata: {str(e)}")

def perform_trend_analysis(location: str):
    """
    Belirli bir lokasyon için trend analizi yapar ve gerekirse uyarı oluşturur
    """
    if location not in processed_data:
        return
    
    data = processed_data[location]
    
    # Trend analizi
    trend = data.get("trend", "stable")
    current_aqi = data.get("current_aqi", 0)
    avg_aqi = data.get("avg_aqi_24h", 0)
    
    # Eğer AQI yükseliyorsa ve belirli bir eşiği geçtiyse
    if trend == "rising" and current_aqi > 100 and current_aqi > (avg_aqi * 1.2):
        logger.warning(f"Trend Analizi: {location} bölgesinde AQI hızla yükseliyor! Mevcut: {current_aqi}, Ortalama: {avg_aqi}")
        # Burada ek uyarılar veya bildirimler oluşturulabilir

async def log_statistics():
    """
    Periyodik olarak istatistikleri loglar
    """
    while True:
        try:
            await asyncio.sleep(60)  # Her dakika bir istatistikleri logla
            
            if not processed_data:
                logger.info("İşlenmiş veri henüz yok, istatistikler atlanıyor")
                continue
            
            # Toplam lokasyon sayısı
            location_count = len(processed_data)
            
            # Tüm lokasyonların ortalama AQI'si
            avg_aqi = sum(data.get("current_aqi", 0) for data in processed_data.values()) / max(1, location_count)
            
            # En yüksek ve en düşük AQI değerleri
            max_aqi_loc = max(processed_data.items(), key=lambda x: x[1].get("current_aqi", 0))
            min_aqi_loc = min(processed_data.items(), key=lambda x: x[1].get("current_aqi", 0))
            
            logger.info(f"--- Hava Kalitesi İstatistikleri ---")
            logger.info(f"İzlenen lokasyon sayısı: {location_count}")
            logger.info(f"Ortalama AQI: {round(avg_aqi, 1)}")
            logger.info(f"En yüksek AQI: {max_aqi_loc[1].get('current_aqi', 0)} ({max_aqi_loc[0]})")
            logger.info(f"En düşük AQI: {min_aqi_loc[1].get('current_aqi', 0)} ({min_aqi_loc[0]})")
            logger.info(f"------------------------------")
            
        except Exception as e:
            logger.error(f"İstatistik loglama sırasında hata: {str(e)}")

async def main():
    """
    Ana işleyici fonksiyonu
    """
    # Sinyal işleyicileri ayarla
    loop = asyncio.get_event_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, lambda: asyncio.create_task(shutdown()))
    
    # RabbitMQ istemcisi
    rabbitmq_client = None
    
    try:
        # RabbitMQ bağlantı bilgilerini al
        rabbitmq_url = os.getenv("RABBITMQ_URL", "amqp://guest:guest@rabbitmq:5672/")
        
        # RabbitMQ istemcisini başlat
        logger.info(f"RabbitMQ'ya bağlanılıyor: {rabbitmq_url}")
        rabbitmq_client = RabbitMQClient(rabbitmq_url=rabbitmq_url)
        await rabbitmq_client.connect()
        logger.info("RabbitMQ bağlantısı başarılı")
        
        # Sensör verisi kuyruğunu dinle
        await rabbitmq_client.consume_messages(
            rabbitmq_client.queues["sensor_data"],
            process_sensor_data
        )
        logger.info(f"Sensör veri kuyruğu dinleniyor: {rabbitmq_client.queues['sensor_data']}")
        
        # Uyarı kuyruğunu dinle
        await rabbitmq_client.consume_messages(
            rabbitmq_client.queues["alerts"],
            process_alert
        )
        logger.info(f"Uyarı kuyruğu dinleniyor: {rabbitmq_client.queues['alerts']}")
        
        # İstatistik loglama görevini başlat
        asyncio.create_task(log_statistics())
        
        # Mesaj tüketimini başlat
        logger.info("Veri işleme servisi başlatıldı, mesajlar bekleniyor...")
        await rabbitmq_client.start_consuming()
        
    except Exception as e:
        logger.error(f"Servis başlatılırken hata: {str(e)}")
        if rabbitmq_client:
            await rabbitmq_client.close()
        sys.exit(1)

async def shutdown():
    """
    Servis kapatma işlemleri
    """
    logger.info("Kapatma sinyali alındı, servis sonlandırılıyor...")
    # Burada kapatma öncesi gerekli temizlik işlemleri yapılabilir
    sys.exit(0)

if __name__ == "__main__":
    try:
        # Hata akışını kontrol alt
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Kullanıcı tarafından sonlandırıldı")
    except Exception as e:
        logger.error(f"Beklenmeyen hata: {str(e)}")
        sys.exit(1) 
