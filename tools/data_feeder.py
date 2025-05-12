#!/usr/bin/env python3
"""
Hava Kalitesi Veri Gönderme Aracı
Bu script, gerçekçi hava kalitesi verileri üreterek API'ye gönderir.
"""

import os
import time
import json
import random
import logging
import requests
from datetime import datetime
import numpy as np
from dotenv import load_dotenv

# Loglama ayarları
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("data-feeder")

# Çevre değişkenlerini yükle
load_dotenv()

# Konfigürasyon
API_URL = os.getenv("API_URL", "http://localhost:8000")
SIMULATION_INTERVAL = int(os.getenv("SIMULATION_INTERVAL", 10))  # Veri gönderme aralığı (saniye)
ANOMALY_CHANCE = int(os.getenv("ANOMALY_CHANCE", 15))  # Anomali oluşma şansı (%)
SIMULATION_ENABLED = False  # Simülasyon devre dışı bırakıldı

# Sabit sensör konumları
SENSORS = [
    {"id": 1, "location": "Kadıköy", "latitude": 40.9840, "longitude": 29.0250, "base_aqi": 45},
    {"id": 2, "location": "Beşiktaş", "latitude": 41.0420, "longitude": 29.0080, "base_aqi": 52},
    {"id": 3, "location": "Üsküdar", "latitude": 41.0233, "longitude": 29.0152, "base_aqi": 38},
    {"id": 4, "location": "Şişli", "latitude": 41.0600, "longitude": 28.9900, "base_aqi": 65},
    {"id": 5, "location": "Bakırköy", "latitude": 40.9800, "longitude": 28.8680, "base_aqi": 42},
    # Dünya şehirleri
    {"id": 6, "location": "New York", "latitude": 40.7128, "longitude": -74.0060, "base_aqi": 55},
    {"id": 7, "location": "London", "latitude": 51.5074, "longitude": -0.1278, "base_aqi": 48},
    {"id": 8, "location": "Tokyo", "latitude": 35.6762, "longitude": 139.6503, "base_aqi": 72},
    {"id": 9, "location": "Paris", "latitude": 48.8566, "longitude": 2.3522, "base_aqi": 58},
    {"id": 10, "location": "Beijing", "latitude": 39.9042, "longitude": 116.4074, "base_aqi": 95},
    {"id": 11, "location": "Delhi", "latitude": 28.7041, "longitude": 77.1025, "base_aqi": 125},
    {"id": 12, "location": "Cairo", "latitude": 30.0444, "longitude": 31.2357, "base_aqi": 88},
    {"id": 13, "location": "Sydney", "latitude": -33.8688, "longitude": 151.2093, "base_aqi": 35},
    {"id": 14, "location": "Rio de Janeiro", "latitude": -22.9068, "longitude": -43.1729, "base_aqi": 62},
    {"id": 15, "location": "Moscow", "latitude": 55.7558, "longitude": 37.6173, "base_aqi": 78},
]

def generate_air_quality_data():
    """Sensörler için gerçekçi hava kalitesi verileri üretir"""
    now = datetime.now().isoformat()
    data_list = []
    
    for sensor in SENSORS:
        # Normal dağılım ile rastgele dalgalanmalar oluştur
        random_factor = np.random.normal(1.0, 0.2)  # Ortalama 1, std 0.2
        
        # Anomali oluştur
        create_anomaly = random.randint(1, 100) <= ANOMALY_CHANCE
        anomaly_factor = 1.8 if create_anomaly else 1.0
        
        # Hava kalitesi ölçüm değerlerini hesapla
        base_aqi = sensor["base_aqi"]
        aqi = int(base_aqi * random_factor * anomaly_factor)
        
        # Diğer ölçüm değerlerini AQI'ye bağlı olarak hesapla
        pm25 = max(5, int(aqi * 0.8 + random.randint(-5, 5)))
        pm10 = max(10, int(aqi * 1.2 + random.randint(-10, 10)))
        no2 = max(2, int(aqi * 0.4 + random.randint(-3, 3)))
        so2 = max(1, int(aqi * 0.2 + random.randint(-2, 2)))
        o3 = max(5, int(aqi * 0.6 + random.randint(-5, 5)))
        
        # Veri paketi oluştur
        data = {
            "sensor_id": sensor["id"],
            "location": sensor["location"],
            "latitude": sensor["latitude"],
            "longitude": sensor["longitude"],
            "timestamp": now,
            "aqi": aqi,
            "pm25": pm25,
            "pm10": pm10,
            "no2": no2,
            "so2": so2,
            "o3": o3,
            "is_anomaly": create_anomaly
        }
        
        data_list.append(data)
        
        # Eğer anomali oluşturulduysa log yaz
        if create_anomaly:
            logger.info(f"Anomali oluşturuldu: {sensor['location']} - AQI: {aqi}")
    
    return data_list

def send_data_to_api(data_list):
    """Verileri API'ye gönderir"""
    try:
        url = f"{API_URL}/api/v1/air-quality"
        for data in data_list:
            response = requests.post(url, json=data)
            if response.status_code != 200 and response.status_code != 201:
                logger.error(f"API hatası: {response.status_code} - {response.text}")
                return False
        return True
    except Exception as e:
        logger.error(f"Veri gönderirken hata: {str(e)}")
        return False

def main():
    """Ana program döngüsü"""
    logger.info(f"Veri gönderme aracı başlatıldı - API URL: {API_URL}")
    logger.info(f"Simülasyon modu: {'AÇIK' if SIMULATION_ENABLED else 'KAPALI'}")
    
    if not SIMULATION_ENABLED:
        logger.info("Simülasyon modu devre dışı. Program kapatılıyor...")
        return
    
    logger.info(f"Simülasyon aralığı: {SIMULATION_INTERVAL} saniye, Anomali şansı: {ANOMALY_CHANCE}%")
    
    while True:
        logger.info("Veri üretiliyor...")
        data_list = generate_air_quality_data()
        
        logger.info(f"{len(data_list)} sensör verisi gönderiliyor...")
        success = send_data_to_api(data_list)
        
        if success:
            logger.info("Veri başarıyla gönderildi")
        else:
            logger.warning("Veri gönderilemedi, API erişilemez olabilir")
        
        time.sleep(SIMULATION_INTERVAL)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        logger.info("Program kullanıcı tarafından sonlandırıldı")
    except Exception as e:
        logger.critical(f"Beklenmeyen hata: {str(e)}") 