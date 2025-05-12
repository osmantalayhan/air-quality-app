"""
Hava Kalitesi API Routes
"""
from fastapi import APIRouter, HTTPException, Depends, Query, Body
from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Any
import logging
from datetime import datetime, timedelta

from api_client import AirQualityClient

# Loglama yapılandırması
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("air_quality_routes")

router = APIRouter(
    prefix="/api/v1/air-quality",
    tags=["air-quality"],
    responses={404: {"description": "Not found"}},
)

# Veri modelleri
class Coordinates(BaseModel):
    latitude: float = Field(..., description="Enlem")
    longitude: float = Field(..., description="Boylam")

class Measurement(BaseModel):
    pm25: Optional[float] = Field(None, description="PM2.5 konsantrasyonu (μg/m³)")
    pm10: Optional[float] = Field(None, description="PM10 konsantrasyonu (μg/m³)")
    o3: Optional[float] = Field(None, description="Ozon (O3) konsantrasyonu (μg/m³)")
    no2: Optional[float] = Field(None, description="Azot dioksit (NO2) konsantrasyonu (μg/m³)")
    so2: Optional[float] = Field(None, description="Kükürt dioksit (SO2) konsantrasyonu (μg/m³)")
    co: Optional[float] = Field(None, description="Karbon monoksit (CO) konsantrasyonu (mg/m³)")
    aqi: Optional[int] = Field(None, description="Hava Kalitesi İndeksi")

class AirQualityData(BaseModel):
    timestamp: str = Field(..., description="Ölçüm zamanı")
    location: str = Field(..., description="Konum adı")
    coordinates: Coordinates = Field(..., description="Koordinatlar")
    measurements: Measurement = Field(..., description="Ölçüm değerleri")

class ManualMeasurementInput(BaseModel):
    latitude: float = Field(..., description="Enlem değeri")
    longitude: float = Field(..., description="Boylam değeri")
    location: Optional[str] = Field(None, description="Konum adı (opsiyonel)")
    timestamp: Optional[str] = Field(None, description="Ölçüm zamanı (ISO 8601 formatında, opsiyonel)")
    pm25: Optional[float] = Field(None, description="PM2.5 konsantrasyonu (μg/m³)")
    pm10: Optional[float] = Field(None, description="PM10 konsantrasyonu (μg/m³)")
    o3: Optional[float] = Field(None, description="Ozon (O3) konsantrasyonu (μg/m³)")
    no2: Optional[float] = Field(None, description="Azot dioksit (NO2) konsantrasyonu (μg/m³)")
    so2: Optional[float] = Field(None, description="Kükürt dioksit (SO2) konsantrasyonu (μg/m³)")
    co: Optional[float] = Field(None, description="Karbon monoksit (CO) konsantrasyonu (mg/m³)")

# API istemci sınıfını sağlayan dependency
async def get_air_quality_client():
    # WAQI API'sini kullan
    client = AirQualityClient(api_type="waqi")
    try:
        yield client
    finally:
        pass  # Cleanup işlemleri gerekirse burada

@router.get("/by-coordinates", response_model=AirQualityData)
async def get_air_quality_by_coordinates(
    latitude: float = Query(..., description="Enlem değeri"),
    longitude: float = Query(..., description="Boylam değeri"),
    client: AirQualityClient = Depends(get_air_quality_client)
):
    """
    Belirtilen koordinatlar için hava kalitesi verilerini getirir.
    """
    try:
        data = await client.get_latest_by_coordinates(latitude, longitude)
        
        if "error" in data:
            raise HTTPException(status_code=400, detail=data["error"])
        
        return data
    except Exception as e:
        logger.error(f"Koordinat ile hava kalitesi verisi alınırken hata: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Hava kalitesi verisi alınamadı: {str(e)}")

@router.get("/by-city", response_model=AirQualityData)
async def get_air_quality_by_city(
    city: str = Query(..., description="Şehir adı"),
    country: Optional[str] = Query(None, description="Ülke adı (opsiyonel)"),
    client: AirQualityClient = Depends(get_air_quality_client)
):
    """
    Belirtilen şehir için hava kalitesi verilerini getirir.
    """
    try:
        data = await client.get_latest_by_city(city, country)
        
        if "error" in data:
            raise HTTPException(status_code=400, detail=data["error"])
        
        return data
    except Exception as e:
        logger.error(f"Şehir ile hava kalitesi verisi alınırken hata: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Hava kalitesi verisi alınamadı: {str(e)}")

@router.get("/locations", response_model=List[Dict])
async def get_locations(
    limit: int = Query(100, description="Maksimum konum sayısı"),
    page: int = Query(1, description="Sayfa numarası"),
    country: Optional[str] = Query(None, description="Ülke kodu (opsiyonel, örn. 'TR')"),
    client: AirQualityClient = Depends(get_air_quality_client)
):
    """
    Hava kalitesi ölçüm istasyonlarının listesini getirir.
    """
    try:
        data = await client.get_locations(limit=limit, page=page, country=country)
        
        if isinstance(data, dict) and "error" in data:
            raise HTTPException(status_code=400, detail=data["error"])
        
        return data
    except Exception as e:
        logger.error(f"Konum listesi alınırken hata: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Konum listesi alınamadı: {str(e)}")

@router.post("/manual-input", response_model=AirQualityData)
async def add_manual_measurement(
    measurement: ManualMeasurementInput = Body(..., description="Manuel ölçüm verileri")
):
    """
    Belirli bir konum için manuel olarak girilen hava kalitesi verilerini kaydeder.
    Bu endpoint, sistemin test edilmesi veya gerçek sensör verilerinin simüle edilmesi için kullanılabilir.
    """
    try:
        # Şu anki zamanı kullan veya girilen zamanı kullan
        timestamp = measurement.timestamp or datetime.now().isoformat()
        location = measurement.location or f"Manual Location ({measurement.latitude}, {measurement.longitude})"
        
        # AQI hesaplama (basit) - PM2.5 veya PM10 baz alınarak
        aqi = None
        if measurement.pm25 is not None:
            aqi = int(measurement.pm25 * 1.25)  # Basit hesaplama
        elif measurement.pm10 is not None:
            aqi = int(measurement.pm10 * 0.8)  # Basit hesaplama
        
        # Yanıt verisini oluştur
        response_data = {
            "timestamp": timestamp,
            "location": location,
            "coordinates": {
                "latitude": measurement.latitude,
                "longitude": measurement.longitude
            },
            "measurements": {
                "pm25": measurement.pm25,
                "pm10": measurement.pm10,
                "o3": measurement.o3,
                "no2": measurement.no2,
                "so2": measurement.so2,
                "co": measurement.co,
                "aqi": aqi
            }
        }
        
        # Burada veritabanına kaydetme işlemi yapılabilir
        
        return response_data
    except Exception as e:
        logger.error(f"Manuel veri girişi sırasında hata: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Manuel veri işlenemedi: {str(e)}")

@router.get("/health")
async def health_check():
    """
    API sağlık kontrolü
    """
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

@router.get("/forecast", response_model=List[Dict])
async def get_forecast_by_coordinates(
    latitude: float = Query(..., description="Enlem değeri"),
    longitude: float = Query(..., description="Boylam değeri"),
    client: AirQualityClient = Depends(get_air_quality_client)
):
    """
    Belirtilen koordinatlar için önümüzdeki 24 saatin hava kalitesi tahminlerini döndürür.
    """
    try:
        params = {
            "latitude": latitude,
            "longitude": longitude,
            "hourly": "pm10,pm2_5,nitrogen_dioxide,sulphur_dioxide,ozone,european_aqi",
            "timezone": "auto",
            "forecast_days": 1
        }
        raw = await client._make_request(params)
        logger.info(f"[FORECAST] Open-Meteo API yanıtı: {raw}")
        if not raw or not isinstance(raw, dict):
            return []
        if "error" in raw:
            return []
        hourly = raw.get("hourly", {})
        times = hourly.get("time", [])
        # Alan isimlerini esnek kontrol et
        pm25s = hourly.get("pm2_5", hourly.get("pm25", []))
        pm10s = hourly.get("pm10", [])
        no2s = hourly.get("nitrogen_dioxide", hourly.get("no2", []))
        so2s = hourly.get("sulphur_dioxide", hourly.get("so2", []))
        o3s = hourly.get("ozone", [])
        aqis = hourly.get("european_aqi", hourly.get("aqi", []))
        result = []
        for i, t in enumerate(times):
            result.append({
                "timestamp": t,
                "pm25": pm25s[i] if i < len(pm25s) else None,
                "pm10": pm10s[i] if i < len(pm10s) else None,
                "no2": no2s[i] if i < len(no2s) else None,
                "so2": so2s[i] if i < len(so2s) else None,
                "o3": o3s[i] if i < len(o3s) else None,
                "aqi": aqis[i] if i < len(aqis) else None
            })
        return result
    except Exception as e:
        import traceback
        logger.error(f"Forecast alınırken hata: {str(e)}")
        logger.error(traceback.format_exc())
        return [] 