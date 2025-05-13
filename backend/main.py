from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Body, HTTPException, Query, Depends
from fastapi.middleware.cors import CORSMiddleware
import json
import random
from datetime import datetime, timedelta
import asyncio
from typing import List, Optional, Dict, Any
import logging
import os
from pydantic import BaseModel, Field
import math

# api_client modülünü import et
from api_client import AirQualityClient
# RabbitMQ istemcisini import et
from rabbitmq_client import RabbitMQClient
# Veritabanı ve model importları
from database import engine, get_db, init_db
from models import Base, AirQualityData, Anomaly
from sqlalchemy.orm import Session
# Anomali tespit modülünü import et
from anomaly_detector import AnomalyDetector

# Loglama yapılandırması
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("main")

# Global değişkenler
SIMULATION_MODE_ENABLED = False  # Simülasyon modu devre dışı
api_client = None
rabbitmq_client = None
anomaly_detector = None  # Anomali tespit nesnesi

app = FastAPI(
    title="HavaQualityApp API",
    description="Hava Kalitesi verilerini izlemek için API",
    version="1.0.0",
)

# CORS ayarları
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Tüm kaynaklara izin ver
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],  # Tüm başlıkları aç
    max_age=1  # Önbellek süresini 1 saniye olarak ayarla (normalde 600 saniye/10 dakikadır)
)

# Bağlı websocket istemcilerini saklamak için liste
connected_websockets: List[WebSocket] = []

# Manuel veri girişi için model
class ManualAirQualityInput(BaseModel):
    location: str = Field(..., description="Konum adı")
    latitude: float = Field(..., description="Enlem")
    longitude: float = Field(..., description="Boylam")
    aqi: Optional[int] = Field(None, description="Hava Kalitesi İndeksi (0-500)")
    pm25: Optional[float] = Field(None, description="PM2.5 değeri (μg/m³)")
    pm10: Optional[float] = Field(None, description="PM10 değeri (μg/m³)")
    no2: Optional[float] = Field(None, description="NO2 değeri (μg/m³)")
    so2: Optional[float] = Field(None, description="SO2 değeri (μg/m³)")
    o3: Optional[float] = Field(None, description="O3 değeri (μg/m³)")
    co: Optional[float] = Field(None, description="CO değeri (μg/m³)")

# Sensör ve hava kalitesi verileri için modeller
class Sensor:
    def __init__(self, id: int, location: str, latitude: float, longitude: float, aqi: int = 0, 
                 pm25: float = 0, pm10: float = 0, no2: float = 0, so2: float = 0, o3: float = 0):
        self.id = id
        self.location = location
        self.latitude = latitude
        self.longitude = longitude
        self.aqi = aqi
        self.pm25 = pm25
        self.pm10 = pm10
        self.no2 = no2
        self.so2 = so2
        self.o3 = o3
    
    def to_dict(self):
        return {
            "id": self.id,
            "location": self.location,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "aqi": self.aqi,
            "pm25": self.pm25,
            "pm10": self.pm10,
            "no2": self.no2,
            "so2": self.so2,
            "o3": self.o3
        }

# Global değişkenler
sensors = []  # Sensör listesi
air_quality_data = []  # Tüm hava kalitesi verileri listesi

# Örnek hava kalitesi verileri
air_quality_data = []

# Uygulama başlangıcında son 24 saatlik örnek veri oluştur
def generate_initial_data():
    now = datetime.now()
    data = []
    # NOT: Artık sadece tarih bilgisi oluşturacağız, veriler API'den çekilecek
    # Sadece örnek bir yapı oluşturalım, update_data_background tarafından gerçek verilerle doldurulacak
    for i in range(1):  # Sadece 1 zaman dilimi oluştur, geri kalanını gerçek API'den alacağız
        timestamp = now
        for sensor in sensors:
            data.append({
                "sensor_id": sensor["id"],
                "location": sensor["location"],
                "timestamp": timestamp.isoformat(),
                "pm25": 0,
                "pm10": 0,
                "no2": 0,
                "so2": 0,
                "o3": 0,
            })
    return data

# Başlangıç verilerini oluştur
air_quality_data = generate_initial_data()

# Routerları bağla
# app.include_router(air_quality.router)

@app.get("/")
async def root():
    """
    API bilgisi ve sağlık kontrolü
    """
    return {
        "status": "online",
        "api_version": "1.0.0",
        "service": "HavaQualityApp API",
        "documentation": "/docs",
    }

@app.get("/health")
async def health_check():
    """
    Servis sağlık kontrolü - sistem durumunu kontrol eder
    """
    return {"status": "healthy"}

@app.get("/sensors")
async def get_sensors(limit: int = Query(100, ge=1, le=100), location: Optional[str] = None):
    
    # Filtreleme işlemi
    filtered_sensors = []
    
    for sensor in sensors:
        if location and isinstance(sensor, Sensor):
            if location.lower() in sensor.location.lower():
                filtered_sensors.append(sensor.to_dict())
        elif isinstance(sensor, Sensor):
            filtered_sensors.append(sensor.to_dict())
        elif isinstance(sensor, dict):
            # Eski tip dict objesi de olabilir
            filtered_sensors.append(sensor)
    
    # Limit uygula
    result = filtered_sensors[:limit]
    
    return {"sensors": result}

@app.get("/air-quality")
async def get_air_quality(hours: int = 24):
    """Son birkaç saatin hava kalitesi verilerini döndürür"""
    # Direkt olarak mevcut verileri döndür (update_data_background tarafından sürekli güncellenir)
    return air_quality_data

@app.get("/api/v1/air-quality/regional")
async def get_air_quality_regional(
    lat: float = Query(..., description="Merkez noktanın enlemi"),
    lon: float = Query(..., description="Merkez noktanın boylamı"),
    radius: float = Query(25.0, description="Yarıçap (km cinsinden, varsayılan 25 km)"),
    hours: int = Query(24, description="Kaç saatlik veri getirileceği")
):
  
    logger.info(f"Regional API çağrıldı: lat={lat}, lon={lon}, radius={radius}, hours={hours}")
    
    # Geçerli zaman aralığını hesapla
    time_threshold = datetime.now() - timedelta(hours=hours)
    
    # Verilen bölge içindeki sensörleri bul
    region_sensors = []
    for sensor in sensors:
        if isinstance(sensor, Sensor):
            # İki nokta arasındaki mesafeyi hesapla (Haversine formülü kullanarak)
            sensor_lat = sensor.latitude
            sensor_lon = sensor.longitude
        elif isinstance(sensor, dict):
            sensor_lat = sensor.get("latitude")
            sensor_lon = sensor.get("longitude")
        else:
            continue
            
        if sensor_lat is None or sensor_lon is None:
            continue
            
        # Haversine formülü: kilometre cinsinden iki koordinat arası mesafe
        # Basitleştirilmiş hali: 1 derece yaklaşık 111 km
        distance = (((float(sensor_lat) - float(lat)) ** 2 + 
                     (float(sensor_lon) - float(lon)) ** 2) ** 0.5) * 111
        
        if distance <= radius:
            if isinstance(sensor, Sensor):
                region_sensors.append(sensor.to_dict())
            else:
                region_sensors.append(sensor)
    
    # Bölge içindeki hava kalitesi verilerini filtrele
    region_data = []
    for data in air_quality_data:
        # Verinin saati uygun mu?
        if "timestamp" not in data:
            continue
            
        try:
            data_time = datetime.fromisoformat(data["timestamp"].replace('Z', '+00:00'))
            if data_time < time_threshold:
                continue
        except (ValueError, TypeError):
            continue
            
        # Veri bölge içinde mi?
        sensor_id = data.get("sensor_id")
        for sensor in region_sensors:
            if sensor.get("id") == sensor_id:
                region_data.append(data)
                break
    
    # Eğer veri yoksa, her sensör için örnek veri oluştur
    if len(region_data) == 0 and len(region_sensors) > 0:
        # API'dan veri gelmedi, boş liste dön
        logger.info("Bölgesel veri bulunamadı ve örnek veri üretimi devre dışı")
        region_data = []
    
    # Bölgesel ortalama değerleri hesapla
    if len(region_data) > 0:
        total_pm25 = sum(d.get("pm25", 0) for d in region_data if d.get("pm25") is not None)
        total_pm10 = sum(d.get("pm10", 0) for d in region_data if d.get("pm10") is not None)
        total_no2 = sum(d.get("no2", 0) for d in region_data if d.get("no2") is not None)
        total_so2 = sum(d.get("so2", 0) for d in region_data if d.get("so2") is not None)
        total_o3 = sum(d.get("o3", 0) for d in region_data if d.get("o3") is not None)
        total_aqi = sum(d.get("aqi", 0) for d in region_data if d.get("aqi") is not None)
        
        count = len(region_data)
        regional_averages = {
            "pm25": round(total_pm25 / count, 2) if total_pm25 > 0 else 0,
            "pm10": round(total_pm10 / count, 2) if total_pm10 > 0 else 0,
            "no2": round(total_no2 / count, 2) if total_no2 > 0 else 0,
            "so2": round(total_so2 / count, 2) if total_so2 > 0 else 0,
            "o3": round(total_o3 / count, 2) if total_o3 > 0 else 0,
            "aqi": round(total_aqi / count) if total_aqi > 0 else 0,
        }
    else:
        regional_averages = {
            "pm25": 0, 
            "pm10": 0,
            "no2": 0,
            "so2": 0,
            "o3": 0,
            "aqi": 0
        }
    
    return {
        "sensors": region_sensors,
        "air_quality": region_data,
        "regional_averages": regional_averages
    }

@app.get("/api/v1/air-quality/by-region")
async def get_air_quality_by_region(
    latitude: float = Query(..., description="Merkez noktanın enlemi"),
    longitude: float = Query(..., description="Merkez noktanın boylamı"),
    radius: float = Query(25.0, description="Yarıçap (km cinsinden, varsayılan 25 km)"),
    hours: int = Query(24, description="Kaç saatlik veri getirileceği")
):
   
    # Geçerli zaman aralığını hesapla
    time_threshold = datetime.now() - timedelta(hours=hours)
    
    # Verilen bölge içindeki sensörleri bul
    region_sensors = []
    for sensor in sensors:
        if isinstance(sensor, Sensor):
            # İki nokta arasındaki mesafeyi hesapla (Haversine formülü kullanarak)
            sensor_lat = sensor.latitude
            sensor_lon = sensor.longitude
        elif isinstance(sensor, dict):
            sensor_lat = sensor.get("latitude")
            sensor_lon = sensor.get("longitude")
        else:
            continue
            
        # Haversine formülü: kilometre cinsinden iki koordinat arası mesafe
        # Basitleştirilmiş hali: 1 derece yaklaşık 111 km
        distance = (((sensor_lat - latitude) ** 2 + 
                     (sensor_lon - longitude) ** 2) ** 0.5) * 111
        
        if distance <= radius:
            if isinstance(sensor, Sensor):
                region_sensors.append(sensor.to_dict())
            else:
                region_sensors.append(sensor)
    
    # Bölge içindeki hava kalitesi verilerini filtrele
    region_data = []
    for data in air_quality_data:
        # Verinin saati uygun mu?
        try:
            data_time = datetime.fromisoformat(data["timestamp"])
            if data_time < time_threshold:
                continue
                
            # Veri bölge içinde mi?
            sensor_id = data.get("sensor_id")
            for sensor in region_sensors:
                if sensor.get("id") == sensor_id:
                    region_data.append(data)
                    break
        except (ValueError, TypeError):
            continue
    
    # Debug bilgisi
    logger.info(f"Bölge içinde {len(region_sensors)} sensör ve {len(region_data)} veri noktası bulundu.")
    if region_data and len(region_data) > 0:
        logger.info(f"Örnek veri: {region_data[0]}")
    
    # Bölgesel ortalama değerleri hesapla
    regional_averages = {
        "pm25": 0,
        "pm10": 0,
        "no2": 0,
        "so2": 0,
        "o3": 0,
        "aqi": 0
    }
    
    # Sensör verileri ortalaması (direkt sensör objelerinden)
    if region_sensors:
        sensor_averages = {
            "pm25": 0,
            "pm10": 0,
            "no2": 0,
            "so2": 0,
            "o3": 0,
            "aqi": 0
        }
        
        for param in sensor_averages.keys():
            values = [sensor.get(param, 0) for sensor in region_sensors if sensor.get(param) is not None]
            logger.debug(f"Sensör {param}, Değer sayısı: {len(values)}, Değerler: {values[:5]}")
            if values:
                sensor_averages[param] = sum(values) / len(values)
                
        # Sensör ortalamalarını kullan
        regional_averages = sensor_averages
    
    # Eğer veri yoksa, her sensör için örnek veri oluştur
    if len(region_data) == 0 and len(region_sensors) > 0:
        # API'dan veri gelmedi, boş liste dön
        logger.info("Bölgesel veri bulunamadı ve örnek veri üretimi devre dışı")
        region_data = []
    
    # Sensör verileri ve bölgesel ortalamaları döndür
    return {
        "region": {
            "center": {"latitude": latitude, "longitude": longitude},
            "radius": radius,
            "sensor_count": len(region_sensors)
        },
        "sensors": region_sensors,
        "air_quality": region_data,
        "regional_averages": regional_averages,
        "time_range": {
            "from": time_threshold.isoformat(),
            "to": datetime.now().isoformat()
        }
    }

@app.websocket("/ws/alerts")
async def websocket_endpoint(websocket: WebSocket):
    
    await websocket.accept()
    connected_websockets.append(websocket)
    logger.info(f"Yeni WebSocket bağlantısı kabul edildi. Toplam bağlantı: {len(connected_websockets)}")
    
    # Bağlantı açıldığında bir test mesajı gönder
    try:
        welcome_message = {
            "type": "connection_established",
            "timestamp": datetime.now().isoformat(),
            "message": "WebSocket bağlantısı başarıyla kuruldu"
        }
        await websocket.send_text(json.dumps(welcome_message))
        logger.info("WebSocket bağlantısı açıldı, hoş geldiniz mesajı gönderildi")
    except Exception as e:
        logger.error(f"Hoş geldiniz mesajı gönderilirken hata: {str(e)}")
    
    try:
        while True:
            # Bağlantıyı canlı tutmak için her 5 saniyede bir ping gönder
            await asyncio.sleep(5)
            try:
                ping_message = {"type": "ping", "timestamp": datetime.now().isoformat()}
                await websocket.send_text(json.dumps(ping_message))
                logger.debug("Ping gönderildi")
            except Exception as e:
                logger.error(f"WebSocket ping gönderirken hata: {str(e)}")
                break
    except WebSocketDisconnect:
        logger.info("WebSocket bağlantısı kapandı")
        if websocket in connected_websockets:
            connected_websockets.remove(websocket)
            logger.info(f"WebSocket bağlantısı kaldırıldı. Kalan bağlantı: {len(connected_websockets)}")
    except Exception as e:
        logger.error(f"WebSocket bağlantısında beklenmeyen hata: {str(e)}")
        if websocket in connected_websockets:
            connected_websockets.remove(websocket)
            logger.info(f"WebSocket bağlantısı hata nedeniyle kaldırıldı. Kalan bağlantı: {len(connected_websockets)}")

# Uygulamaya gelen sensör verisi mesajı işlemek için callback
async def process_sensor_data_message(message: Dict[str, Any]):
    """RabbitMQ'dan gelen sensör veri mesajını işler"""
    logger.info(f"RabbitMQ'dan sensör verisi alındı: {message.get('location', 'Unknown')}")
    
    # Mesajı işle ve gerekli veri yapılarını güncelle
    global air_quality_data, anomaly_detector
    
    try:
        # Mesajdaki verileri al
        location = message.get("location")
        timestamp = message.get("timestamp")
        sensor_id = message.get("sensor_id")
        
        # Veritabanı bağlantısı oluştur
        from sqlalchemy.orm import sessionmaker
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        db = SessionLocal()
        
        try:
            # Hava kalitesi verilerini güncelle veya ekle
            for i, item in enumerate(air_quality_data):
                if item.get("sensor_id") == sensor_id:
                    # Aynı sensör için veriyi güncelle
                    air_quality_data[i] = message
                    break
            else:
                # Eğer mevcut bir veri bulunamazsa yeni ekle
                air_quality_data.append(message)
            
            # Veri sayısını sınırla (son 24 saatlik veri)
            now = datetime.now()
            cutoff_time = now - timedelta(hours=24)
            air_quality_data = [
                item for item in air_quality_data 
                if datetime.fromisoformat(item["timestamp"]) > cutoff_time
            ]
            
            # Veritabanına kaydet
            db_record = AirQualityData(
                timestamp=datetime.fromisoformat(timestamp) if isinstance(timestamp, str) else timestamp,
                latitude=message.get("latitude", 0),
                longitude=message.get("longitude", 0),
                pm25=message.get("pm25", 0),
                pm10=message.get("pm10", 0),
                no2=message.get("no2", 0),
                so2=message.get("so2", 0),
                o3=message.get("o3", 0),
                aqi=message.get("aqi", 0)
            )
            db.add(db_record)
            db.commit()
            
            # Anomali tespiti yap
            if anomaly_detector is None:
                from anomaly_detector import AnomalyDetector
                anomaly_detector = AnomalyDetector(db)
                
            # Anomali kontrolü yap
            anomalies = anomaly_detector.detect_anomalies(db_record)
            
            # Eğer anomali varsa bildirim gönder
            if anomalies:
                for anomaly in anomalies:
                    # Anomaliyi WebSocket üzerinden kullanıcılara bildir
                    alert = {
                        "id": anomaly.get("id", random.randint(1000, 9999)),
                        "timestamp": now.isoformat(),
                        "location": location,
                        "title": "Anomali Tespit Edildi",
                        "message": anomaly.get("description", "Anormal hava kalitesi değeri tespit edildi"),
                        "severity": anomaly.get("severity", "medium").lower(),
                        "parameter": anomaly.get("type", "unknown")
                    }
                    
                    # WebSocket aracılığıyla bildirim gönder
                    for ws in connected_websockets.copy():
                        try:
                            await ws.send_text(json.dumps(alert))
                        except Exception as e:
                            logger.error(f"WebSocket üzerinden uyarı gönderilirken hata: {str(e)}")
                            if ws in connected_websockets:
                                connected_websockets.remove(ws)
                    
                    # RabbitMQ aracılığıyla da bildirim gönder
                    if rabbitmq_client:
                        await send_alert_to_queue(alert)
            
        except Exception as inner_e:
            db.rollback()
            logger.error(f"Veritabanı işlemi sırasında hata: {str(inner_e)}")
        finally:
            db.close()
            
    except Exception as e:
        logger.error(f"Sensör verisi işlenirken hata: {str(e)}")

# Uygulamaya gelen uyarı mesajı işlemek için callback
async def process_alert_message(message: Dict[str, Any]):
    """RabbitMQ'dan gelen uyarı mesajını işler ve WebSocket üzerinden kullanıcılara iletir"""
    logger.info(f"RabbitMQ'dan uyarı mesajı alındı: {message.get('title', 'Unknown')}")
    
    global connected_websockets
    
    try:
        # Bağlı tüm WebSocket istemcilerine uyarı mesajını gönder
        for ws in connected_websockets.copy():
            try:
                await ws.send_text(json.dumps(message))
            except Exception as e:
                logger.error(f"WebSocket üzerinden uyarı gönderilirken hata: {str(e)}")
                if ws in connected_websockets:
                    connected_websockets.remove(ws)
    except Exception as e:
        logger.error(f"Uyarı mesajı işlenirken hata: {str(e)}")

# Sensör verilerini kuyruğa gönderme fonksiyonu
async def send_sensor_data_to_queue(sensor_data: Dict[str, Any]):
    """Sensör verisini RabbitMQ kuyruğuna gönderir"""
    global rabbitmq_client
    
    if rabbitmq_client:
        logger.debug(f"Sensör verisi kuyruğa gönderiliyor: {sensor_data.get('location', 'Unknown')}")
        return await rabbitmq_client.publish_sensor_data(sensor_data)
    else:
        logger.warning("RabbitMQ istemcisi başlatılmadığı için veri kuyruğa gönderilemedi")
        return False

# Uyarı mesajını kuyruğa gönderme fonksiyonu
async def send_alert_to_queue(alert_data: Dict[str, Any]):
    """Uyarı mesajını RabbitMQ kuyruğuna gönderir"""
    global rabbitmq_client
    
    if rabbitmq_client:
        logger.debug(f"Uyarı mesajı kuyruğa gönderiliyor: {alert_data.get('title', 'Unknown')}")
        return await rabbitmq_client.publish_alert(alert_data)
    else:
        logger.warning("RabbitMQ istemcisi başlatılmadığı için uyarı kuyruğa gönderilemedi")
        return False

# Eşik değerlerine göre uyarı oluşturma yardımcı fonksiyonu
async def check_and_create_alert(location, pm25, pm10, aqi, thresholds, last_alerts):
    
    global connected_websockets, rabbitmq_client
    
    now = datetime.now()
    alert_triggered = False
    alert_message = ""
    severity = "medium"
    alert_title = "Hava Kalitesi Uyarısı"
    
    # PM2.5 kontrolü
    if pm25 >= thresholds["pm25"]["very_high"]:
        alert_triggered = True
        alert_message = f"PM2.5 seviyesi yüksek: {pm25} μg/m³"
        severity = "high"
    elif pm25 >= thresholds["pm25"]["high"]:
        alert_triggered = True
        alert_message = f"PM2.5 seviyesi yüksek: {pm25} μg/m³"
        severity = "medium"
    elif pm25 >= thresholds["pm25"]["moderate"]:
        alert_triggered = True
        alert_message = f"PM2.5 seviyesi orta: {pm25} μg/m³"
        severity = "low"
        
    # PM10 kontrolü
    elif pm10 >= thresholds["pm10"]["very_high"]:
        alert_triggered = True
        alert_message = f"PM10 seviyesi yüksek: {pm10} μg/m³"
        severity = "high"
    elif pm10 >= thresholds["pm10"]["high"]:
        alert_triggered = True
        alert_message = f"PM10 seviyesi yüksek: {pm10} μg/m³"
        severity = "medium"
    elif pm10 >= thresholds["pm10"]["moderate"]:
        alert_triggered = True
        alert_message = f"PM10 seviyesi orta: {pm10} μg/m³"
        severity = "low"
        
    # AQI kontrolü
    elif aqi >= thresholds["aqi"]["very_high"]:
        alert_triggered = True
        alert_message = f"Hava kalitesi çok kötü: AQI {aqi}"
        severity = "high"
    elif aqi >= thresholds["aqi"]["high"]:
        alert_triggered = True
        alert_message = f"Hava kalitesi kötü: AQI {aqi}"
        severity = "medium"
    elif aqi >= thresholds["aqi"]["moderate"]:
        alert_triggered = True
        alert_message = f"Hava kalitesi orta: AQI {aqi}"
        severity = "low"
    
    # Uyarı oluştur
    if alert_triggered and connected_websockets:
        # Aynı lokasyon için son 5 dakika içinde aynı severity ile uyarı gönderilmiş mi kontrol et
        location_key = f"{location}_{severity}"
        last_alert_time = last_alerts.get(location_key)
        
        # Eğer aynı lokasyon için son 5 dakika içinde uyarı gönderilmemişse gönder
        if not last_alert_time or (now - last_alert_time).total_seconds() > 300:  # 5 dakika = 300 saniye
            # Yeni uyarı oluştur
            alert = {
                "id": random.randint(1000, 9999),
                "timestamp": now.isoformat(),
                "location": location,
                "title": alert_title,
                "message": alert_message,
                "severity": severity
            }
            
            # Son uyarı zamanını güncelle
            last_alerts[location_key] = now
            
            # Uyarıyı RabbitMQ kuyruğuna gönder
            if rabbitmq_client:
                await send_alert_to_queue(alert)
            
            # Tüm bağlı istemcilere bildirim gönder
            logger.info(f"Uyarı gönderiliyor: {location}, {alert_message}")
            for ws in connected_websockets.copy():
                try:
                    await ws.send_text(json.dumps(alert))
                except Exception as e:
                    logger.error(f"WebSocket üzerinden uyarı gönderilirken hata: {str(e)}")
                    if ws in connected_websockets:
                        connected_websockets.remove(ws)
        
            return True
    
    return False

# Periyodik olarak sensör verilerini gerçek API'den güncelleme
async def update_sensors_from_api():
    """Sensör verilerini periyodik olarak API'den günceller"""
    global api_client, sensors, rabbitmq_client, connected_websockets
    
    # Veritabanı bağlantısı için Session oluştur
    from sqlalchemy.orm import sessionmaker
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    
    try:
        logger.info("Sensör verileri API'den güncelleniyor...")
        logger.info(f"Aktif WebSocket bağlantı sayısı: {len(connected_websockets)}")
        
        # Manuel girilen sensörleri koru - ID'si 1000 ve üzeri olanlar manuel eklenenler
        manual_sensors = [s for s in sensors if (isinstance(s, dict) and s.get("id", 0) >= 1000) or 
                         (isinstance(s, Sensor) and s.id >= 1000)]
        
        if api_client:
            # Tüm lokasyonlardan veri getir
            all_locations = await api_client.get_locations(limit=40)  # 20 TR şehri + 5 İstanbul ilçesi + 15 dünya şehri
            
            if all_locations:
                updated_sensors = []
                for i, loc in enumerate(all_locations):
                    station = loc.get("station", {})
                    if "geo" in station and len(station.get("geo", [])) >= 2:
                        lat = station.get("geo", [0, 0])[0]
                        lon = station.get("geo", [0, 0])[1]
                        
                        city_name = station.get("name", "Unknown")
                        
                        # Şehir adı çok uzunsa kısalt
                        if ", " in city_name:
                            city_name = city_name.split(", ")[0]
                        
                        # Sadece valid koordinatlara sahip sensörleri ekle
                        if lat != 0 and lon != 0:
                            # Her sensör için detaylı veri çek
                            air_quality = await api_client.get_latest_by_coordinates(
                                latitude=lat,
                                longitude=lon,
                                location_name=city_name
                            )
                            
                            # API'den dönen ölçüm değerlerini al
                            measurements = air_quality.get("measurements", {})
                            pm25 = measurements.get("pm25", 0)
                            pm10 = measurements.get("pm10", 0)
                            no2 = measurements.get("no2", 0)
                            so2 = measurements.get("so2", 0)
                            o3 = measurements.get("o3", 0)
                            aqi = measurements.get("aqi", 0) or loc.get("aqi", 0)
                            
                            # Manuel eklenen bir sensör ile koordinat çakışması var mı kontrol et
                            is_manual_location = False
                            for manual_sensor in manual_sensors:
                                manual_lat = manual_sensor.latitude if isinstance(manual_sensor, Sensor) else manual_sensor.get("latitude", 0)
                                manual_lon = manual_sensor.longitude if isinstance(manual_sensor, Sensor) else manual_sensor.get("longitude", 0)
                                
                                # Koordinat karşılaştırması
                                if abs(float(manual_lat) - float(lat)) < 0.5 and abs(float(manual_lon) - float(lon)) < 0.5:
                                    is_manual_location = True
                                    break
                            
                            # Eğer bu konum manuel olarak eklenmişse, API'den güncelleme yapma
                            if is_manual_location:
                                logger.info(f"Konum {city_name} manuel olarak eklenmiş, API güncellemesi atlanıyor")
                                continue
                            
                            sensor = Sensor(
                                id=i + 1,
                                location=city_name,
                                latitude=lat,
                                longitude=lon,
                                aqi=aqi,
                                pm25=pm25,
                                pm10=pm10,
                                no2=no2,
                                so2=so2,
                                o3=o3
                            )
                            updated_sensors.append(sensor)
                            
                            logger.info(f"Sensör güncellendi: {city_name}, AQI: {aqi}, PM2.5: {pm25}, PM10: {pm10}, NO2: {no2}, SO2: {so2}, O3: {o3}")
                            
                            # Sensör verisini RabbitMQ kuyruğuna gönder
                            if rabbitmq_client:
                                sensor_data = sensor.to_dict()
                                sensor_data["timestamp"] = datetime.now().isoformat()
                                await send_sensor_data_to_queue(sensor_data)
                                
                            # Veritabanına kaydet
                            try:
                                now = datetime.now()
                                db_record = AirQualityData(
                                    timestamp=now,
                                    latitude=lat,
                                    longitude=lon,
                                    pm25=pm25,
                                    pm10=pm10,
                                    no2=no2,
                                    so2=so2,
                                    o3=o3,
                                    aqi=aqi
                                )
                                db.add(db_record)
                                db.commit()
                            except Exception as db_error:
                                db.rollback()
                                logger.error(f"Veri kaydederken hata: {str(db_error)}")
                            
                            # Uyarı eşiklerini kontrol et ve gerekirse uyarı oluştur
                            if aqi >= 50 and len(connected_websockets) > 0:  # Sarı kategori (AQI >= 50)
                                severity = "low"
                                if aqi >= 100:  # Kırmızı kategori
                                    severity = "high"
                                elif aqi >= 75:  # Turuncu kategori
                                    severity = "medium"
                                
                                logger.info(f"API'den alınan veri için uyarı oluşturuluyor: {city_name}, AQI: {aqi}, Seviye: {severity}")
                                
                                alert = {
                                    "id": random.randint(1000, 9999),
                                    "timestamp": now.isoformat(),
                                    "location": city_name,
                                    "title": "Hava Kalitesi Uyarısı",
                                    "message": f"AQI değeri: {aqi}, PM2.5: {pm25}, PM10: {pm10}",
                                    "severity": severity,
                                    "type": "api_update"
                                }
                                
                                # Tüm bağlı istemcilere bildirim gönder
                                sent_count = 0
                                logger.info(f"WebSocket bağlantı sayısı: {len(connected_websockets)}")
                                for ws in connected_websockets.copy():
                                    try:
                                        logger.info(f"WebSocket aracılığıyla uyarı gönderiliyor: {city_name}, AQI: {aqi}")
                                        await ws.send_text(json.dumps(alert))
                                        sent_count += 1
                                        logger.info(f"Uyarı başarıyla gönderildi")
                                    except Exception as e:
                                        logger.error(f"WebSocket üzerinden uyarı gönderilirken hata: {str(e)}")
                                        if ws in connected_websockets:
                                            connected_websockets.remove(ws)
                                
                                if sent_count > 0:
                                    logger.info(f"Uyarı {sent_count} WebSocket bağlantısına gönderildi")
                                else:
                                    logger.warning(f"Uyarı hiçbir WebSocket bağlantısına gönderilemedi")
                
                if updated_sensors:
                    # Önceki sensörlerle yenileri birleştirirken tekrarları önleyelim
                    unique_sensors = {}
                    
                    # Önce yeni sensörleri ekle
                    for sensor in updated_sensors:
                        key = f"{sensor.latitude:.3f}_{sensor.longitude:.3f}"
                        unique_sensors[key] = sensor
                    
                    # Manuel eklenen sensörleri koru
                    for manual_sensor in manual_sensors:
                        if isinstance(manual_sensor, Sensor):
                            key = f"{manual_sensor.latitude:.3f}_{manual_sensor.longitude:.3f}"
                            unique_sensors[key] = manual_sensor
                        elif isinstance(manual_sensor, dict):
                            key = f"{manual_sensor.get('latitude', 0):.3f}_{manual_sensor.get('longitude', 0):.3f}"
                            unique_sensors[key] = manual_sensor
                    
                    # Eğer eski sensörler yeni listede yoksa ve geçerli koordinatlara sahipse ekle
                    for old_sensor in sensors:
                        # Manuel sensörler zaten eklendi, tekrar ekleme
                        if (isinstance(old_sensor, dict) and old_sensor.get("id", 0) >= 1000) or \
                           (isinstance(old_sensor, Sensor) and old_sensor.id >= 1000):
                            continue
                            
                        if isinstance(old_sensor, Sensor):
                            key = f"{old_sensor.latitude:.3f}_{old_sensor.longitude:.3f}"
                            if key not in unique_sensors and old_sensor.latitude != 0 and old_sensor.longitude != 0:
                                unique_sensors[key] = old_sensor
                        elif isinstance(old_sensor, dict):
                            lat = old_sensor.get("latitude", 0)
                            lon = old_sensor.get("longitude", 0)
                            key = f"{lat:.3f}_{lon:.3f}"
                            if key not in unique_sensors and lat != 0 and lon != 0:
                                unique_sensors[key] = old_sensor
                    
                    # Listeyi güncelleyip hazır hale getir
                    sensors = list(unique_sensors.values())
                    logger.info(f"Sensör listesi API'den güncellendi: {len(sensors)} sensör")
                    
                    # air_quality_data listesini de güncelle - manuel veriler korunacak
                    new_air_quality_data = []
                    
                    # Mevcut manuel verileri koru
                    for data in air_quality_data:
                        sensor_id = data.get("sensor_id", 0)
                        if sensor_id >= 1000:  # Manuel eklenen sensör verisi
                            new_air_quality_data.append(data)
                    
                    # API'den gelen verilerle güncelle
                    now = datetime.now()
                    for sensor in sensors:
                        if isinstance(sensor, Sensor) and sensor.id < 1000:  # Sadece API sensörleri
                            new_data = {
                                "sensor_id": sensor.id,
                                "location": sensor.location,
                                "latitude": sensor.latitude,
                                "longitude": sensor.longitude,
                                "timestamp": now.isoformat(),
                                "pm25": sensor.pm25,
                                "pm10": sensor.pm10,
                                "no2": sensor.no2,
                                "so2": sensor.so2,
                                "o3": sensor.o3,
                                "aqi": sensor.aqi
                            }
                            new_air_quality_data.append(new_data)
                        elif isinstance(sensor, dict) and sensor.get("id", 0) < 1000:  # Eski format API sensörleri
                            new_data = {
                                "sensor_id": sensor.get("id", 0),
                                "location": sensor.get("location", "Unknown"),
                                "latitude": sensor.get("latitude", 0),
                                "longitude": sensor.get("longitude", 0),
                                "timestamp": now.isoformat(),
                                "pm25": sensor.get("pm25", 0),
                                "pm10": sensor.get("pm10", 0),
                                "no2": sensor.get("no2", 0),
                                "so2": sensor.get("so2", 0),
                                "o3": sensor.get("o3", 0),
                                "aqi": sensor.get("aqi", 0)
                            }
                            new_air_quality_data.append(new_data)
                    
                    # Güncellenen listeyi ata
                    air_quality_data = new_air_quality_data
            else:
                logger.warning("API'den hiç sensör verisi alınamadı, mevcut sensörler korunuyor")
    except Exception as e:
        logger.error(f"Sensör verilerini güncellerken hata: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
    finally:
        # Veritabanı bağlantısını kapat
        db.close()

# Periyodik olarak veri güncelleme ve anomali kontrolü yapacak arka plan görevi
async def update_data_background():
    """Arka planda düzenli olarak sensör verilerini API'den günceller"""
    global api_client, sensors
    
    try:
        logger.info("İlk sensör verileri çekiliyor...")
        # İlk başta hemen bir kez veri çek
        await update_sensors_from_api()
    except Exception as e:
        logger.error(f"İlk veri çekme işleminde hata: {str(e)}")
    
    while True:
        try:
            # 5 dakikada bir güncelle
            await asyncio.sleep(5 * 60)
            
            if api_client:
                # Önce sensörleri güncelle
                await update_sensors_from_api()
            else:
                logger.warning("Güncellemeler API istemcisi olmadığı için yapılamadı")
                
        except Exception as e:
            logger.error(f"Arka plan güncellemesi sırasında hata: {str(e)}")
            # Hata durumunda kısa süre bekleyip devam et
            await asyncio.sleep(10)

# Şehir adına göre veri çekme yardımcı fonksiyonu
async def fetch_city_data(city_name, api_client):
    try:
        # Şehir için koordinatları bul
        city_location = None
        
        # Önce Türkiye şehirlerinde ara
        for city in api_client.tr_cities:
            if city["name"].lower() == city_name.lower():
                city_location = city
                break
        
        # İstanbul ilçelerinde ara
        if not city_location:
            for district in api_client.istanbul_districts:
                if district["name"].lower() == city_name.lower() or city_name.lower().startswith(f"{district['name'].lower()}, "):
                    city_location = district
                    break
        
        # Dünya şehirlerinde ara
        if not city_location:
            for city in api_client.world_cities:
                if city["name"].lower() == city_name.lower():
                    city_location = city
                    break
        
        if city_location:
            # Koordinatlardan veri çek
            air_quality = await api_client.get_latest_by_coordinates(
                latitude=city_location["lat"],
                longitude=city_location["lon"],
                location_name=city_location["name"]
            )
            
            if "error" not in air_quality:
                # Sensör listesinde bu şehir var mı?
                for sensor in sensors:
                    if isinstance(sensor, Sensor):
                        if sensor.location.lower() == city_location["name"].lower():
                            # Mevcut sensörü güncelle
                            sensor.aqi = air_quality.get("measurements", {}).get("aqi", 50)
                            logger.info(f"{sensor.location} sensörü güncellendi, AQI: {sensor.aqi}")
                            break
                    elif isinstance(sensor, dict):
                        if sensor["location"].lower() == city_location["name"].lower():
                            # Mevcut sensörü güncelle (eski dict formatı için)
                            sensor["aqi"] = air_quality.get("measurements", {}).get("aqi", 50)
                            logger.info(f"{sensor['location']} sensörü güncellendi, AQI: {sensor['aqi']}")
                            break
        else:
            logger.warning(f"{city_name} için koordinat bulunamadı")
            
    except Exception as e:
        logger.error(f"{city_name} verileri çekilirken hata: {str(e)}")

# Uygulama başlatma olayı
@app.on_event("startup")
async def startup_event():
    global api_client, rabbitmq_client, anomaly_detector
    
    # Veritabanını başlat
    try:
        logger.info("Veritabanı tabloları oluşturuluyor...")
        Base.metadata.create_all(bind=engine)
        logger.info("Veritabanı tabloları başarıyla oluşturuldu")
        
        # Anomali tespit nesnesini oluştur
        # Not: Bu daha sonra asenkron bağlamda ilk ihtiyaç olduğunda da oluşturulabilir
        from sqlalchemy.orm import sessionmaker
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        db = SessionLocal()
        try:
            anomaly_detector = AnomalyDetector(db)
            logger.info("Anomali tespit modülü başlatıldı")
        finally:
            db.close()
    except Exception as e:
        logger.error(f"Veritabanı başlatılırken hata: {str(e)}")
    
    # API istemcisini başlat
    try:
        # Open-Meteo API için istemci oluştur (API anahtarı gerektirmez)
        api_client = AirQualityClient()
        logger.info("Open-Meteo Air Quality API istemcisi başlatıldı")
    except Exception as e:
        logger.error(f"API istemcisi başlatılırken hata: {str(e)}")
        if SIMULATION_MODE_ENABLED:
            logger.warning("Gerçek veri kaynağına bağlanılamadı. Simülasyon verileri kullanılacak.")
        else:
            logger.warning("Gerçek veri kaynağına bağlanılamadı. Simülasyon modu devre dışı olduğu için veri alınamayacak.")
    
    # RabbitMQ istemcisini başlat
    try:
        # RabbitMQ URL'ini ortam değişkenlerinden al
        rabbitmq_url = os.getenv("RABBITMQ_URL", "amqp://guest:guest@rabbitmq:5672/")
        rabbitmq_client = RabbitMQClient(rabbitmq_url=rabbitmq_url)
        await rabbitmq_client.connect()
        logger.info("RabbitMQ istemcisi başlatıldı")
        
        # Sensör verisi kuyruğunu dinlemeye başla
        await rabbitmq_client.consume_messages(
            rabbitmq_client.queues["sensor_data"], 
            process_sensor_data_message
        )
        
        # Uyarı kuyruğunu dinlemeye başla
        await rabbitmq_client.consume_messages(
            rabbitmq_client.queues["alerts"], 
            process_alert_message
        )
        
        # Mesaj tüketimini ayrı bir task'ta başlat
        asyncio.create_task(rabbitmq_client.start_consuming())
        
    except Exception as e:
        logger.error(f"RabbitMQ istemcisi başlatılırken hata: {str(e)}")
        logger.warning("RabbitMQ bağlantısı kurulamadı. Kuyruk sistemi devre dışı.")
    
    # Arka plan görevini hemen başlat
    asyncio.create_task(update_data_background())
    
    logger.info("Hava Kalitesi API başlatıldı ve hazır")

# Tek seferlik veri güncelleme fonksiyonu - Başlangıçta hemen veri yüklemek için
async def update_data_once():
    global air_quality_data, rabbitmq_client
    
    # Yeni veri ekle
    now = datetime.now()
    new_data = []
    
    for sensor in sensors:
        try:
            # Sensördeki koordinatlardan gerçek veri çek
            latitude = None
            longitude = None
            location = None
            sensor_id = None
            pm25 = 0
            pm10 = 0
            no2 = 0
            so2 = 0
            o3 = 0
            aqi_value = 0
            
            if isinstance(sensor, Sensor):
                latitude = sensor.latitude
                longitude = sensor.longitude
                location = sensor.location
                sensor_id = sensor.id
            elif isinstance(sensor, dict):
                latitude = sensor.get("latitude")
                longitude = sensor.get("longitude")
                location = sensor.get("location")
                sensor_id = sensor.get("id")
            
            if api_client and latitude and longitude:
                api_data = await api_client.get_latest_by_coordinates(
                    latitude=latitude,
                    longitude=longitude,
                    location_name=location
                )
                
                # API'den gelen verileri çıkar
                measurements = api_data.get("measurements", {})
                pm25 = measurements.get("pm25", 0)
                pm10 = measurements.get("pm10", 0)
                no2 = measurements.get("no2", 0)
                so2 = measurements.get("so2", 0)
                o3 = measurements.get("o3", 0)
                
                # AQI değeri güncelle
                api_aqi = measurements.get("aqi", None)
                if api_aqi:
                    if isinstance(sensor, Sensor):
                        sensor.aqi = api_aqi
                        sensor.pm25 = pm25
                        sensor.pm10 = pm10
                        sensor.no2 = no2
                        sensor.so2 = so2
                        sensor.o3 = o3
                    else:
                        sensor["aqi"] = api_aqi
                        sensor["pm25"] = pm25
                        sensor["pm10"] = pm10
                        sensor["no2"] = no2
                        sensor["so2"] = so2
                        sensor["o3"] = o3
                else:
                    # API'den AQI gelmezse PM2.5'ten basit hesapla
                    calculated_aqi = int(pm25 * 1.25) if pm25 else 0
                    if isinstance(sensor, Sensor):
                        sensor.aqi = calculated_aqi
                        sensor.pm25 = pm25
                        sensor.pm10 = pm10
                        sensor.no2 = no2
                        sensor.so2 = so2
                        sensor.o3 = o3
                    else:
                        sensor["aqi"] = calculated_aqi
                        sensor["pm25"] = pm25
                        sensor["pm10"] = pm10
                        sensor["no2"] = no2
                        sensor["so2"] = so2
                        sensor["o3"] = o3
                
                if isinstance(sensor, Sensor):
                    aqi_value = sensor.aqi
                    pm25 = sensor.pm25
                    pm10 = sensor.pm10
                    no2 = sensor.no2
                    so2 = sensor.so2
                    o3 = sensor.o3
                else:
                    aqi_value = sensor["aqi"]
                    pm25 = sensor.get("pm25", 0)
                    pm10 = sensor.get("pm10", 0)
                    no2 = sensor.get("no2", 0)
                    so2 = sensor.get("so2", 0)
                    o3 = sensor.get("o3", 0)
                    
                logger.info(f"Gerçek veri çekildi: {location}, AQI: {aqi_value}, PM2.5: {pm25}, PM10: {pm10}, NO2: {no2}, SO2: {so2}, O3: {o3}")
            else:
                # API yoksa veya koordinat bulunamazsa hata logla ve boş veri döndür
                logger.warning(f"API'den veri çekilemedi veya koordinat yok: {location}")
                
                # Sensor nesnesinden mevcut değerleri al (eğer daha önce güncellendiğinde set edilmişse)
                if isinstance(sensor, Sensor):
                    pm25 = sensor.pm25
                    pm10 = sensor.pm10
                    no2 = sensor.no2
                    so2 = sensor.so2
                    o3 = sensor.o3
                    aqi_value = sensor.aqi
                elif isinstance(sensor, dict):
                    pm25 = sensor.get("pm25", 0)
                    pm10 = sensor.get("pm10", 0)
                    no2 = sensor.get("no2", 0)
                    so2 = sensor.get("so2", 0)
                    o3 = sensor.get("o3", 0)
                    aqi_value = sensor.get("aqi", 0)
                    
                logger.info(f"API verisi kullanılamadı: {location}, AQI: {aqi_value}")
            
            # Veri oluştur - Tüm ölçüm değerlerini dahil et
            sensor_data = {
                "sensor_id": sensor_id,
                "location": location,
                "latitude": latitude,
                "longitude": longitude,
                "timestamp": now.isoformat(),
                "pm25": pm25,
                "pm10": pm10,
                "no2": no2,
                "so2": so2,
                "o3": o3,
                "aqi": aqi_value
            }
            
            # Veriyi listeye ekle
            new_data.append(sensor_data)
            
            # Sensör verisini RabbitMQ kuyruğuna gönder
            if rabbitmq_client:
                await send_sensor_data_to_queue(sensor_data)
                
        except Exception as e:
            sensor_location = getattr(sensor, 'location', sensor.get('location', 'Unknown')) if hasattr(sensor, 'get') else 'Unknown'
            logger.error(f"Sensör verisi güncellenirken hata: {sensor_location}, Error: {str(e)}")
    
    # Veri listesini güncelle
    air_quality_data = new_data  # Tamamen yeni verilerle değiştir
    logger.info(f"İlk veriler başarıyla yüklendi: {len(new_data)} sensör")

# Uygulama sonlandırma olayı 
@app.on_event("shutdown")
async def shutdown_event():
    global rabbitmq_client
    
    if rabbitmq_client:
        try:
            await rabbitmq_client.close()
            logger.info("RabbitMQ bağlantısı kapatıldı")
        except Exception as e:
            logger.error(f"RabbitMQ bağlantısı kapatılırken hata: {str(e)}")

@app.get("/api/v1/air-quality/history")
async def get_air_quality_history(
    hours: int = Query(24, description="Kaç saatlik veri getirileceği"),
    latitude: Optional[float] = Query(None, description="Filtrelemek için enlem"),
    longitude: Optional[float] = Query(None, description="Filtrelemek için boylam"),
    radius: float = Query(25.0, description="Yarıçap (km cinsinden)"),
    db: Session = Depends(get_db)
):
    
    # Zaman sınırını hesapla
    time_threshold = datetime.now() - timedelta(hours=hours)
    
    # Sorguyu oluştur
    query = db.query(AirQualityData).filter(AirQualityData.timestamp >= time_threshold)
    
    # Koordinat filtrelemesi (opsiyonel)
    if latitude is not None and longitude is not None:
        # Haversine formülü basitleştirilmiş - 1 derece ~= 111 km
        # Bu, yaklaşık bir hesaplama yapar ve performans sağlar
        lat_min = latitude - (radius / 111.0)
        lat_max = latitude + (radius / 111.0)
        
        # Boylam için düzeltme (enlem arttıkça uzunluk azalır)
        lng_factor = abs(math.cos(math.radians(latitude)))
        lng_min = longitude - (radius / (111.0 * lng_factor))
        lng_max = longitude + (radius / (111.0 * lng_factor))
        
        query = query.filter(
            AirQualityData.latitude.between(lat_min, lat_max),
            AirQualityData.longitude.between(lng_min, lng_max)
        )
    
    # Verileri al ve sırala
    records = query.order_by(AirQualityData.timestamp.desc()).limit(1000).all()
    
    # Sonuçları düzenle
    result = []
    for record in records:
        result.append({
            "id": record.id,
            "timestamp": record.timestamp.isoformat(),
            "latitude": record.latitude,
            "longitude": record.longitude,
            "pm25": record.pm25,
            "pm10": record.pm10,
            "no2": record.no2,
            "so2": record.so2,
            "o3": record.o3,
            "aqi": record.aqi
        })
    
    # Veritabanında kayıt yoksa, mevcut air_quality_data listesini kullan
    if not result:
        logger.info("Veritabanında kayıt bulunamadı, mevcut sensör verilerini kullanıyoruz")
        
        # air_quality_data listesinden filtreleme yap
        filtered_data = []
        for data in air_quality_data:
            # Zaman kontrolü
            try:
                data_time = datetime.fromisoformat(data["timestamp"].replace('Z', '+00:00'))
                if data_time < time_threshold:
                    continue
            except (ValueError, TypeError):
                continue
                
            # Koordinat kontrolü (varsa)
            if latitude is not None and longitude is not None:
                try:
                    data_lat = float(data.get("latitude", 0))
                    data_lon = float(data.get("longitude", 0))
                    
                    # Basit mesafe hesabı
                    distance = (((data_lat - latitude) ** 2 + 
                                (data_lon - longitude) ** 2) ** 0.5) * 111
                    
                    if distance > radius:
                        continue
                except (ValueError, TypeError):
                    continue
            
            # Veriyi ekle
            filtered_data.append(data)
        
        # Sonuçları döndür
        return {
            "count": len(filtered_data),
            "records": filtered_data,
            "time_range": {
                "from": time_threshold.isoformat(),
                "to": datetime.now().isoformat()
            },
            "source": "memory"  # Verinin kaynağını belirt
        }
    
    return {
        "count": len(result),
        "records": result,
        "time_range": {
            "from": time_threshold.isoformat(),
            "to": datetime.now().isoformat()
        },
        "source": "database"  # Verinin kaynağını belirt
    }

# Debug endpoint ekle
@app.get("/debug/sensors")
async def debug_sensors():

    result = []
    
    logger.info(f"Debug sensors endpoint çağrıldı. Toplam sensör sayısı: {len(sensors)}")
    
    for i, sensor in enumerate(sensors):
        if isinstance(sensor, dict):
            result.append({
                "index": i,
                "type": "dict",
                "id": sensor.get("id"),
                "location": sensor.get("location"),
                "latitude": sensor.get("latitude"),
                "longitude": sensor.get("longitude"),
                "aqi": sensor.get("aqi"),
                "pm25": sensor.get("pm25"),
                "pm10": sensor.get("pm10"),
                "no2": sensor.get("no2"),
                "so2": sensor.get("so2"),
                "o3": sensor.get("o3")
            })
        elif isinstance(sensor, Sensor):
            result.append({
                "index": i,
                "type": "Sensor",
                "id": sensor.id,
                "location": sensor.location,
                "latitude": sensor.latitude,
                "longitude": sensor.longitude,
                "aqi": sensor.aqi,
                "pm25": sensor.pm25,
                "pm10": sensor.pm10,
                "no2": sensor.no2,
                "so2": sensor.so2,
                "o3": sensor.o3
            })
        else:
            result.append({
                "index": i,
                "type": str(type(sensor)),
                "data": str(sensor)
            })
    
    return {
        "total_sensors": len(sensors),
        "sensors": result
    }

# Yeni endpoint ekle - Grafik verileri için son 24 saatlik veriyi döndür
@app.get("/api/v1/air-quality/latest")
async def get_latest_air_quality_data(
    location: Optional[str] = None,
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
    radius: float = 25.0
):
    
    # Zaman sınırını hesapla - son 24 saat
    time_threshold = datetime.now() - timedelta(hours=24)
    
    # Verileri filtrele
    filtered_data = []
    
    # Önce sensör listesinden istenen konumu bul
    target_sensor = None
    
    if location:
        # İsme göre sensör ara
        for sensor in sensors:
            if isinstance(sensor, Sensor):
                if location.lower() in sensor.location.lower():
                    target_sensor = sensor
                    break
            elif isinstance(sensor, dict):
                if location.lower() in sensor.get("location", "").lower():
                    target_sensor = sensor
                    break
    elif latitude and longitude:
        # Koordinata göre sensör ara
        for sensor in sensors:
            if isinstance(sensor, Sensor):
                sensor_lat = sensor.latitude
                sensor_lon = sensor.longitude
            elif isinstance(sensor, dict):
                sensor_lat = sensor.get("latitude", 0)
                sensor_lon = sensor.get("longitude", 0)
            else:
                continue
                
            # Mesafe hesapla
            distance = (((sensor_lat - latitude) ** 2 + 
                        (sensor_lon - longitude) ** 2) ** 0.5) * 111
                        
            if distance <= radius:
                target_sensor = sensor
                break
    
    # Eğer hedef sensör bulunduysa, onun için veri oluştur
    if target_sensor:
        # Sensör ID'sini al
        sensor_id = target_sensor.id if isinstance(target_sensor, Sensor) else target_sensor.get("id", 0)
        
        # Sensör verilerini al
        for data in air_quality_data:
            if data.get("sensor_id") == sensor_id:
                filtered_data.append(data)
                break
        
        # Eğer veri yoksa, mevcut sensör bilgilerinden bir veri noktası oluştur
        if not filtered_data:
            now = datetime.now()
            
            if isinstance(target_sensor, Sensor):
                new_data = {
                    "sensor_id": target_sensor.id,
                    "location": target_sensor.location,
                    "latitude": target_sensor.latitude,
                    "longitude": target_sensor.longitude,
                    "timestamp": now.isoformat(),
                    "pm25": target_sensor.pm25,
                    "pm10": target_sensor.pm10,
                    "no2": target_sensor.no2,
                    "so2": target_sensor.so2,
                    "o3": target_sensor.o3,
                    "aqi": target_sensor.aqi
                }
            else:
                new_data = {
                    "sensor_id": target_sensor.get("id", 0),
                    "location": target_sensor.get("location", "Unknown"),
                    "latitude": target_sensor.get("latitude", 0),
                    "longitude": target_sensor.get("longitude", 0),
                    "timestamp": now.isoformat(),
                    "pm25": target_sensor.get("pm25", 0),
                    "pm10": target_sensor.get("pm10", 0),
                    "no2": target_sensor.get("no2", 0),
                    "so2": target_sensor.get("so2", 0),
                    "o3": target_sensor.get("o3", 0),
                    "aqi": target_sensor.get("aqi", 0)
                }
            
            filtered_data.append(new_data)
            
            # Grafik için 24 saatlik veri noktaları oluştur
            for i in range(1, 24):
                past_time = now - timedelta(hours=i)
                past_data = new_data.copy()
                past_data["timestamp"] = past_time.isoformat()
                filtered_data.append(past_data)
    else:
        # Hedef sensör bulunamazsa, tüm sensörlerden ilk veriyi al
        if sensors and len(sensors) > 0:
            target_sensor = sensors[0]
            
            if isinstance(target_sensor, Sensor):
                new_data = {
                    "sensor_id": target_sensor.id,
                    "location": target_sensor.location,
                    "latitude": target_sensor.latitude,
                    "longitude": target_sensor.longitude,
                    "timestamp": datetime.now().isoformat(),
                    "pm25": target_sensor.pm25,
                    "pm10": target_sensor.pm10,
                    "no2": target_sensor.no2,
                    "so2": target_sensor.so2,
                    "o3": target_sensor.o3,
                    "aqi": target_sensor.aqi
                }
            else:
                new_data = {
                    "sensor_id": target_sensor.get("id", 0),
                    "location": target_sensor.get("location", "Unknown"),
                    "latitude": target_sensor.get("latitude", 0),
                    "longitude": target_sensor.get("longitude", 0),
                    "timestamp": datetime.now().isoformat(),
                    "pm25": target_sensor.get("pm25", 0),
                    "pm10": target_sensor.get("pm10", 0),
                    "no2": target_sensor.get("no2", 0),
                    "so2": target_sensor.get("so2", 0),
                    "o3": target_sensor.get("o3", 0),
                    "aqi": target_sensor.get("aqi", 0)
                }
                
            filtered_data.append(new_data)
            
            # Grafik için 24 saatlik veri noktaları oluştur
            now = datetime.now()
            for i in range(1, 24):
                past_time = now - timedelta(hours=i)
                past_data = new_data.copy()
                past_data["timestamp"] = past_time.isoformat()
                filtered_data.append(past_data)
    
    # Zaman sırasına göre sırala
    filtered_data.sort(key=lambda x: x["timestamp"])
    
    return filtered_data

# Yeni test endpoint ekle - Bu endpoint WebSocket bağlantısını test etmek için kullanılır
@app.get("/test-alert")
async def create_test_alert():
    """
    Test amaçlı bir uyarı oluşturur.
    Bu endpoint, WebSocket bağlantısını test etmek için kullanılır.
    """
    global connected_websockets
    
    logger.info(f"Test uyarısı oluşturuluyor. Aktif WebSocket bağlantı sayısı: {len(connected_websockets)}")
    
    # Test uyarısı oluştur
    test_alert = {
        "id": random.randint(10000, 99999),
        "timestamp": datetime.now().isoformat(),
        "location": "Test Lokasyonu",
        "title": "Test Uyarısı",
        "message": "Bu bir test uyarısıdır. WebSocket bağlantısı çalışıyor.",
        "severity": "medium",
        "type": "test_alert"
    }
    
    # WebSocket bağlantıları yoksa uyarı ver
    if len(connected_websockets) == 0:
        logger.warning("Aktif WebSocket bağlantısı yok, test uyarısı gönderilemedi!")
        return {
            "status": "warning",
            "message": "Aktif WebSocket bağlantısı yok, uyarı gönderilemedi",
            "alert": test_alert
        }
    
    # Tüm bağlı istemcilere bildirim gönder
    sent_count = 0
    for ws in connected_websockets.copy():
        try:
            logger.info(f"Test uyarısı WebSocket aracılığıyla gönderiliyor")
            await ws.send_text(json.dumps(test_alert))
            sent_count += 1
            logger.info(f"Test uyarısı başarıyla gönderildi")
        except Exception as e:
            logger.error(f"WebSocket üzerinden test uyarısı gönderilirken hata: {str(e)}")
            if ws in connected_websockets:
                connected_websockets.remove(ws)
    
    logger.info(f"Test uyarısı {sent_count} WebSocket bağlantısına gönderildi")
    
    # Test için ekstra bir uyarı daha oluştur (farklı ID ve şiddetle)
    if sent_count > 0:
        try:
            second_test_alert = {
                "id": random.randint(10000, 99999),
                "timestamp": datetime.now().isoformat(),
                "location": "İstanbul",
                "title": "Yüksek AQI Uyarısı",
                "message": "İstanbul'da AQI değeri 75'e ulaştı. Sarı kategori.",
                "severity": "low",
                "type": "test_alert"
            }
            
            for ws in connected_websockets.copy():
                await ws.send_text(json.dumps(second_test_alert))
            
            logger.info("İkinci test uyarısı gönderildi")
        except Exception as e:
            logger.error(f"İkinci test uyarısı gönderilirken hata: {str(e)}")
    
    return {
        "status": "success",
        "message": f"Test uyarısı oluşturuldu ve {sent_count} WebSocket bağlantısına gönderildi",
        "alert": test_alert
    }

# Manuel veri girişi endpoint'i
@app.post("/api/v1/air-quality/manual-input")
async def add_manual_measurement(data: ManualAirQualityInput = Body(...)):
   
    try:
        logger.info(f"Manuel veri girişi: {data.location}")
        
        # Yeni sensör ID'si oluştur (1000 ve üzeri ID'ler manuel sensörler için)
        max_sensor_id = 1000
        for sensor in sensors:
            if isinstance(sensor, Sensor) and sensor.id >= 1000:
                max_sensor_id = max(max_sensor_id, sensor.id)
            elif isinstance(sensor, dict) and sensor.get("id", 0) >= 1000:
                max_sensor_id = max(max_sensor_id, sensor.get("id", 0))
        
        new_sensor_id = max_sensor_id + 1
        
        # Eksik değerler için varsayılanlar
        pm25 = data.pm25 or 0
        pm10 = data.pm10 or 0
        no2 = data.no2 or 0
        so2 = data.so2 or 0
        o3 = data.o3 or 0
        aqi = data.aqi or 0
        
        # Aynı koordinatlara sahip sensör var mı kontrol et
        existing_sensor = None
        for sensor in sensors:
            if isinstance(sensor, Sensor):
                if abs(sensor.latitude - data.latitude) < 0.01 and abs(sensor.longitude - data.longitude) < 0.01:
                    existing_sensor = sensor
                    break
            elif isinstance(sensor, dict):
                if abs(sensor.get("latitude", 0) - data.latitude) < 0.01 and abs(sensor.get("longitude", 0) - data.longitude) < 0.01:
                    existing_sensor = sensor
                    break
        
        # Eğer aynı koordinatta sensör varsa onu güncelle, yoksa yeni oluştur
        if existing_sensor:
            logger.info(f"Mevcut sensör güncelleniyor: {data.location}")
            
            if isinstance(existing_sensor, Sensor):
                # Mevcut değerleri koru
                if not data.pm25:
                    pm25 = existing_sensor.pm25
                if not data.pm10:
                    pm10 = existing_sensor.pm10
                if not data.no2:
                    no2 = existing_sensor.no2
                if not data.so2:
                    so2 = existing_sensor.so2
                if not data.o3:
                    o3 = existing_sensor.o3
                if not data.aqi:
                    aqi = existing_sensor.aqi
                
                # Sensörü güncelle
                existing_sensor.location = data.location
                existing_sensor.pm25 = pm25
                existing_sensor.pm10 = pm10
                existing_sensor.no2 = no2
                existing_sensor.so2 = so2
                existing_sensor.o3 = o3
                existing_sensor.aqi = aqi
                
                # Veri için sensör ID'sini al
                sensor_id = existing_sensor.id
            else:
                # Mevcut değerleri koru (dict formatı)
                if not data.pm25:
                    pm25 = existing_sensor.get("pm25", 0)
                if not data.pm10:
                    pm10 = existing_sensor.get("pm10", 0)
                if not data.no2:
                    no2 = existing_sensor.get("no2", 0)
                if not data.so2:
                    so2 = existing_sensor.get("so2", 0)
                if not data.o3:
                    o3 = existing_sensor.get("o3", 0)
                if not data.aqi:
                    aqi = existing_sensor.get("aqi", 0)
                
                # Sensörü güncelle
                existing_sensor["location"] = data.location
                existing_sensor["pm25"] = pm25
                existing_sensor["pm10"] = pm10
                existing_sensor["no2"] = no2
                existing_sensor["so2"] = so2
                existing_sensor["o3"] = o3
                existing_sensor["aqi"] = aqi
                
                # Veri için sensör ID'sini al
                sensor_id = existing_sensor.get("id", 0)
        else:
            # Yeni sensör oluştur
            logger.info(f"Yeni sensör oluşturuluyor: {data.location}")
            
            new_sensor = Sensor(
                id=new_sensor_id,
                location=data.location,
                latitude=data.latitude,
                longitude=data.longitude,
                aqi=aqi,
                pm25=pm25,
                pm10=pm10,
                no2=no2,
                so2=so2,
                o3=o3
            )
            
            # Sensörü listeye ekle
            sensors.append(new_sensor)
            logger.info(f"Yeni sensör eklendi: {data.location}, ID: {new_sensor_id}")
            
            # Veri için sensör ID'sini ayarla
            sensor_id = new_sensor_id
        
        # Hava kalitesi verisi oluştur
        now = datetime.now()
        air_quality_record = {
            "sensor_id": sensor_id,
            "location": data.location,
            "latitude": data.latitude,
            "longitude": data.longitude,
            "timestamp": now.isoformat(),
            "pm25": pm25,
            "pm10": pm10,
            "no2": no2,
            "so2": so2,
            "o3": o3,
            "aqi": aqi
        }
        
        # Veriyi listeye ekle
        air_quality_data.append(air_quality_record)
        
        # Veritabanına kaydet
        from sqlalchemy.orm import sessionmaker
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        db = SessionLocal()
        
        try:
            db_record = AirQualityData(
                timestamp=now,
                latitude=data.latitude,
                longitude=data.longitude,
                pm25=pm25,
                pm10=pm10,
                no2=no2,
                so2=so2,
                o3=o3,
                aqi=aqi
            )
            db.add(db_record)
            db.commit()
            
            # Uyarı kontrolü - AQI 50 ve üzeri değerler için uyarı oluştur
            if aqi >= 50 and len(connected_websockets) > 0:
                # AQI değerine göre uyarı seviyesini belirle
                severity = "low"  # Sarı kategori (AQI: 50-74)
                if aqi >= 100:  # Kırmızı kategori
                    severity = "high"
                elif aqi >= 75:  # Turuncu kategori
                    severity = "medium"
                
                # Uyarı mesajını oluştur
                alert = {
                    "id": random.randint(10000, 99999),  # Manuel uyarılar için farklı ID aralığı
                    "timestamp": now.isoformat(),
                    "location": data.location,
                    "title": "Manuel Uyarı",
                    "message": f"AQI değeri: {aqi} - Manuel veri girişi sonucu tespit edildi",
                    "severity": severity,
                    "type": "manual_input"
                }
                
                # WebSocket üzerinden uyarı gönder
                logger.info(f"Manuel veri girişi için uyarı oluşturuluyor: {data.location}, AQI: {aqi}")
                sent_count = 0
                for ws in connected_websockets.copy():
                    try:
                        await ws.send_text(json.dumps(alert))
                        sent_count += 1
                    except Exception as e:
                        logger.error(f"WebSocket üzerinden uyarı gönderilirken hata: {str(e)}")
                        if ws in connected_websockets:
                            connected_websockets.remove(ws)
                
                logger.info(f"Manuel uyarı {sent_count} WebSocket bağlantısına gönderildi")
                
                # Uyarıyı RabbitMQ kuyruğuna gönder (eğer varsa)
                if rabbitmq_client:
                    await send_alert_to_queue(alert)
            
        except Exception as db_error:
            db.rollback()
            logger.error(f"Veritabanına kayıt sırasında hata: {str(db_error)}")
        finally:
            db.close()
        
        # Yanıt döndür
        return {
            "status": "success",
            "message": f"Hava kalitesi verisi başarıyla kaydedildi: {data.location}",
            "data": air_quality_record
        }
    except Exception as e:
        logger.error(f"Manuel veri girişinde hata: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Veri girişi sırasında hata oluştu: {str(e)}")

@app.post("/manual-input")
async def add_manual_air_quality_data(data: ManualAirQualityInput):
    """
    Manuel olarak hava kalitesi verisi girişi için API.
    Bu endpoint, kullanıcı tarafından girilen verileri sisteme ekler.
    """
    global sensors, air_quality_data
    
    try:
        # AQI değerlerini hesapla (girilen değerler varsa onları kullan)
        pm25 = data.pm25 if data.pm25 is not None else 0
        pm10 = data.pm10 if data.pm10 is not None else 0
        no2 = data.no2 if data.no2 is not None else 0
        so2 = data.so2 if data.so2 is not None else 0
        o3 = data.o3 if data.o3 is not None else 0
        co = data.co if data.co is not None else 0
        
        # Kullanıcı AQI değeri girmişse doğrudan kullan, yoksa hesapla
        aqi = data.aqi if data.aqi is not None else calculate_aqi(pm25, pm10, no2, so2, o3, co)
        
        # Şu anki zamanı al
        now = datetime.now()
        
        # Hava kalitesi verisi oluştur
        air_quality_record = {
            "timestamp": now.isoformat(),
            "location": data.location,
            "latitude": data.latitude,
            "longitude": data.longitude,
            "pm25": pm25,
            "pm10": pm10,
            "no2": no2,
            "so2": so2,
            "o3": o3,
            "co": co,
            "aqi": aqi
        }
        
        # Veriyi listeye ekle
        air_quality_data.append(air_quality_record)
        
        # Veritabanına kaydet
        from sqlalchemy.orm import sessionmaker
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        db = SessionLocal()
        
        try:
            db_record = AirQualityData(
                timestamp=now,
                latitude=data.latitude,
                longitude=data.longitude,
                pm25=pm25,
                pm10=pm10,
                no2=no2,
                so2=so2,
                o3=o3,
                aqi=aqi
            )
            db.add(db_record)
            db.commit()
            
            # Uyarı kontrolü - AQI değerine göre uyarı gönder
            if aqi >= 50:  # Sarı veya daha yüksek kategori
                severity = "low"  # Default: Sarı kategori (AQI 50-75)
                
                if aqi >= 100:  # Kırmızı kategori
                    severity = "high"
                elif aqi >= 75:  # Turuncu kategori
                    severity = "medium"
                
                logger.info(f"Manuel veri girişi için uyarı oluşturuluyor: {data.location}, AQI: {aqi}, Seviye: {severity}")
                
                alert_id = random.randint(1000, 9999)
                alert = {
                    "id": alert_id,
                    "timestamp": now.isoformat(),
                    "location": data.location,
                    "title": f"Yüksek AQI Uyarısı - {data.location}",
                    "message": f"{data.location} bölgesinde AQI değeri {aqi} seviyesine ulaştı.",
                    "severity": severity,
                    "type": "manual_alert",
                    "values": {
                        "aqi": aqi,
                        "pm25": pm25,
                        "pm10": pm10
                    }
                }
                
                # WebSocket üzerinden uyarı gönder
                for websocket in connected_websockets:
                    try:
                        await websocket.send_json(alert)
                        logger.debug(f"Manuel veri uyarısı WebSocket üzerinden gönderildi: {alert_id}")
                    except Exception as e:
                        logger.error(f"WebSocket üzerinden uyarı gönderilirken hata: {str(e)}")
            
            # Sensör verilerini güncelle
            found = False
            for i, sensor in enumerate(sensors):
                # Aynı konumdaki sensör varsa güncelle
                if sensor["location"] == data.location or (
                    abs(sensor["latitude"] - data.latitude) < 0.001 and
                    abs(sensor["longitude"] - data.longitude) < 0.001
                ):
                    sensors[i]["aqi"] = aqi
                    sensors[i]["pm25"] = pm25
                    sensors[i]["pm10"] = pm10
                    sensors[i]["no2"] = no2
                    sensors[i]["so2"] = so2
                    sensors[i]["o3"] = o3
                    sensors[i]["co"] = co
                    sensors[i]["timestamp"] = now.isoformat()
                    found = True
                    break
            
            # Yeni sensör ekle
            if not found:
                new_sensor = {
                    "id": len(sensors) + 1,
                    "location": data.location,
                    "latitude": data.latitude,
                    "longitude": data.longitude,
                    "aqi": aqi,
                    "pm25": pm25,
                    "pm10": pm10,
                    "no2": no2,
                    "so2": so2,
                    "o3": o3,
                    "co": co,
                    "timestamp": now.isoformat()
                }
                sensors.append(new_sensor)
            
            logger.info(f"Manuel veri girişi başarılı: {data.location}")
            return {"success": True, "message": "Veri başarıyla eklendi", "data": air_quality_record}
        
        except Exception as db_error:
            db.rollback()
            logger.error(f"Veritabanı kaydı sırasında hata: {str(db_error)}")
            raise HTTPException(status_code=500, detail=f"Veritabanı hatası: {str(db_error)}")
        finally:
            db.close()
        
    except Exception as e:
        logger.error(f"Manuel veri girişi sırasında hata: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Veri eklenirken hata oluştu: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 
