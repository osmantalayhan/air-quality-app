"""
Hava Kalitesi API İstemcisi
Open-Meteo API'sini kullanarak hava kalitesi verilerini çeker
"""
import os
import json
import logging
import asyncio
import aiohttp
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Union
import time

# Loglama yapılandırması
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("api_client")

class AirQualityClient:
    """
    Open-Meteo hava kalitesi verilerini çekmek için API istemci sınıfı.
    """
    
    def __init__(self):
        """
        Open-Meteo API için istemci başlatır
        """
        # API endpoint
        self.base_url = "https://air-quality-api.open-meteo.com/v1/air-quality"
        
        # Rate limitleme için zamanlayıcı
        self._last_request_time = 0
        self._request_count = 0
        self._request_times = []
        
        # Önbellek (cache)
        self._cache = {}
        self._cache_expire = 120  # 2 dakika
        
        # Şehir ve ilçe listesi
        self.tr_cities = [
            {"name": "İstanbul", "lat": 41.0082, "lon": 28.9784},
            {"name": "Ankara", "lat": 39.9334, "lon": 32.8597},
            {"name": "İzmir", "lat": 38.4237, "lon": 27.1428},
            {"name": "Bursa", "lat": 40.1885, "lon": 29.0610},
            {"name": "Antalya", "lat": 36.8969, "lon": 30.7133},
            {"name": "Adana", "lat": 37.0000, "lon": 35.3213},
            {"name": "Konya", "lat": 37.8715, "lon": 32.4845},
            {"name": "Gaziantep", "lat": 37.0662, "lon": 37.3833},
            {"name": "Şanlıurfa", "lat": 37.1674, "lon": 38.7955},
            {"name": "Kocaeli", "lat": 40.7654, "lon": 29.9408},
            {"name": "Mersin", "lat": 36.8121, "lon": 34.6292},
            {"name": "Diyarbakır", "lat": 37.9141, "lon": 40.2306},
            {"name": "Hatay", "lat": 36.2022, "lon": 36.1613},
            {"name": "Manisa", "lat": 38.6191, "lon": 27.4289},
            {"name": "Kayseri", "lat": 38.7205, "lon": 35.4894},
            {"name": "Samsun", "lat": 41.2867, "lon": 36.3300},
            {"name": "Balıkesir", "lat": 39.6484, "lon": 27.8826},
            {"name": "Kahramanmaraş", "lat": 37.5753, "lon": 36.9228},
            {"name": "Van", "lat": 38.5012, "lon": 43.3830},
            {"name": "Aydın", "lat": 37.8560, "lon": 27.8416}
        ]
        
        # İstanbul ilçeleri
        self.istanbul_districts = [
            {"name": "Kadıköy", "lat": 40.9830, "lon": 29.0291},
            {"name": "Beşiktaş", "lat": 41.0420, "lon": 29.0089},
            {"name": "Üsküdar", "lat": 41.0236, "lon": 29.0156},
            {"name": "Şişli", "lat": 41.0636, "lon": 28.9874},
            {"name": "Bakırköy", "lat": 40.9821, "lon": 28.8728}
        ]
        
        # Dünya şehirleri
        self.world_cities = [
            {"name": "New York", "lat": 40.7128, "lon": -74.0060},
            {"name": "London", "lat": 51.5074, "lon": -0.1278},
            {"name": "Paris", "lat": 48.8566, "lon": 2.3522},
            {"name": "Tokyo", "lat": 35.6762, "lon": 139.6503},
            {"name": "Beijing", "lat": 39.9042, "lon": 116.4074},
            {"name": "Delhi", "lat": 28.6139, "lon": 77.2090},
            {"name": "Moscow", "lat": 55.7558, "lon": 37.6173},
            {"name": "Berlin", "lat": 52.5200, "lon": 13.4050},
            {"name": "Madrid", "lat": 40.4168, "lon": -3.7038},
            {"name": "Rome", "lat": 41.9028, "lon": 12.4964},
            {"name": "Cairo", "lat": 30.0444, "lon": 31.2357},
            {"name": "Sydney", "lat": -33.8688, "lon": 151.2093},
            {"name": "Dubai", "lat": 25.2048, "lon": 55.2708},
            {"name": "Singapore", "lat": 1.3521, "lon": 103.8198},
            {"name": "Los Angeles", "lat": 34.0522, "lon": -118.2437}
        ]
        
        # Tüm lokasyonları birleştir
        self.all_locations = self.tr_cities + self.istanbul_districts + self.world_cities
        
        logger.info("Open-Meteo Air Quality API istemcisi başlatıldı")
    
    async def _make_request(self, params: Dict) -> Dict:
      
        # Rate limiting kontrolü
        await self._respect_rate_limit()
        
        url = self.base_url
        timeout = aiohttp.ClientTimeout(total=30)
        
        try:
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.get(url, params=params) as response:
                    # İstek zamanını kaydet
                    self._update_request_time()
                    
                    if response.status == 200:
                        result = await response.json()
                        return result
                    else:
                        error_text = await response.text()
                        logger.error(f"API isteği başarısız: {response.status} - {error_text}")
                        await asyncio.sleep(0.5)  # Hata durumunda bekle
                        return {"error": f"API isteği başarısız: {response.status}", "details": error_text}
        except aiohttp.ClientError as e:
            logger.error(f"API bağlantı hatası: {str(e)}")
            await asyncio.sleep(1)  # Hata durumunda bekle
            return {"error": f"API bağlantı hatası: {str(e)}"}
        except asyncio.TimeoutError:
            logger.error("API isteği zaman aşımına uğradı")
            await asyncio.sleep(1)  # Hata durumunda bekle
            return {"error": "API isteği zaman aşımına uğradı"}
        except Exception as e:
            logger.error(f"API isteği sırasında beklenmeyen hata: {str(e)}")
            await asyncio.sleep(1)  # Hata durumunda bekle
            return {"error": f"API isteği sırasında beklenmeyen hata: {str(e)}"}
    
    async def _respect_rate_limit(self):
        """API rate limitlerini aşmamak için bekler"""
        current_time = time.time()
        self._request_times = [t for t in self._request_times if current_time - t <= 60.0]
        
        # Open-Meteo dakikada maksimum 60 istek öneriyor (güvenli limit)
        if len(self._request_times) >= 50:  # 60'tan az tutarak marj bırakalım
            oldest_request = min(self._request_times)
            sleep_time = 60.0 - (current_time - oldest_request) + 0.1
            
            if sleep_time > 0:
                logger.warning(f"API rate limiti aşılmak üzere, {sleep_time:.2f} saniye bekleniyor...")
                await asyncio.sleep(sleep_time)
        
        # İstekler arasında en az 100ms bekle
        elapsed = current_time - self._last_request_time
        if elapsed < 0.1 and self._request_count > 0:
            await asyncio.sleep(0.1 - elapsed)
            
        self._last_request_time = time.time()
        self._request_count += 1
    
    def _update_request_time(self):
        """İstek zamanını günceller"""
        self._request_times.append(time.time())
    
    def _get_from_cache(self, key: str) -> Optional[Dict]:
        """Önbellekten veri al"""
        if key in self._cache:
            timestamp, data = self._cache[key]
            if time.time() - timestamp < self._cache_expire:
                logger.debug(f"Cache hit: {key}")
                return data
            else:
                logger.debug(f"Cache expired: {key}")
                del self._cache[key]
        return None
    
    def _add_to_cache(self, key: str, data: Dict):
        """Veriyi önbelleğe ekle"""
        self._cache[key] = (time.time(), data)
        logger.debug(f"Cache added: {key}")
    
    def _normalize_air_quality_data(self, data: Dict, location_name: str) -> Dict:
       
        try:
            if "error" in data:
                return data
                
            # Şu anki saat için veriyi al
            current_hour_index = 0  # İlk saat verisi (şu an)
                
            result = {
                "timestamp": datetime.now().isoformat(),
                "location": location_name,
                "coordinates": {
                    "latitude": data.get("latitude", 0),
                    "longitude": data.get("longitude", 0)
                },
                "measurements": {
                    "pm25": 0,
                    "pm10": 0,
                    "o3": 0,
                    "no2": 0,
                    "so2": 0,
                    "aqi": 0
                }
            }
            
            # Saatlik verileri kontrol et
            if "hourly" in data:
                hourly = data["hourly"]
                
                if "pm2_5" in hourly and len(hourly["pm2_5"]) > current_hour_index:
                    result["measurements"]["pm25"] = hourly["pm2_5"][current_hour_index]
                
                if "pm10" in hourly and len(hourly["pm10"]) > current_hour_index:
                    result["measurements"]["pm10"] = hourly["pm10"][current_hour_index]
                
                if "nitrogen_dioxide" in hourly and len(hourly["nitrogen_dioxide"]) > current_hour_index:
                    result["measurements"]["no2"] = hourly["nitrogen_dioxide"][current_hour_index]
                
                if "sulphur_dioxide" in hourly and len(hourly["sulphur_dioxide"]) > current_hour_index:
                    result["measurements"]["so2"] = hourly["sulphur_dioxide"][current_hour_index]
                
                if "ozone" in hourly and len(hourly["ozone"]) > current_hour_index:
                    result["measurements"]["o3"] = hourly["ozone"][current_hour_index]
                
                if "european_aqi" in hourly and len(hourly["european_aqi"]) > current_hour_index:
                    result["measurements"]["aqi"] = hourly["european_aqi"][current_hour_index]
            
            if result["measurements"]["aqi"] == 0:
                if result["measurements"]["pm25"] > 0:
                    result["measurements"]["aqi"] = int(result["measurements"]["pm25"] * 1.25)
                elif result["measurements"]["pm10"] > 0:
                    result["measurements"]["aqi"] = int(result["measurements"]["pm10"] * 0.8)
            
            return result
            
        except Exception as e:
            logger.error(f"Veri normalleştirme hatası: {str(e)}")
            logger.error(f"Ham veri: {data}")
            return {"error": f"Veri normalleştirme hatası: {str(e)}"}
    
    async def get_latest_by_coordinates(self, latitude: float, longitude: float, location_name: str = "Unknown") -> Dict:
        
        # Önbellek anahtarı oluşturma
        cache_key = f"latest_{latitude:.6f}_{longitude:.6f}"
        
        # Önbellekte varsa döndürme
        cached_data = self._get_from_cache(cache_key)
        if cached_data:
            return cached_data
        
        # API parametreleri
        params = {
            "latitude": latitude,
            "longitude": longitude,
            "hourly": "pm10,pm2_5,nitrogen_dioxide,sulphur_dioxide,ozone,european_aqi",
            "timezone": "auto",
            "forecast_days": 1  # Sadece bugünün verilerini getir
        }
        
        # API isteği yapma
        response = await self._make_request(params)
        
        # Verileri normalize etme
        normalized_data = self._normalize_air_quality_data(response, location_name)
        
        # Önbelleğe ekle
        self._add_to_cache(cache_key, normalized_data)
        
        return normalized_data
    
    async def get_locations(self, limit: int = 40) -> List:
        
        # Önbellek anahtarı oluştur
        cache_key = f"locations_limit{limit}"
        
        # Önbellekte varsa döndür
        cached_data = self._get_from_cache(cache_key)
        if cached_data:
            return cached_data
        
        results = []
        
        locations_to_check = self.all_locations[:limit]
        
        for location in locations_to_check:
            try:
                # Her lokasyon için veri çek
                air_quality = await self.get_latest_by_coordinates(
                    latitude=location["lat"],
                    longitude=location["lon"],
                    location_name=location["name"]
                )
                
                # Standart istasyon formatına dönüştür
                if "error" not in air_quality:
                    station = {
                        "name": location["name"],
                        "station": {
                            "name": location["name"],
                            "geo": [location["lat"], location["lon"]]
                        },
                        "aqi": air_quality.get("measurements", {}).get("aqi", 0)
                    }
                    results.append(station)
            except Exception as e:
                logger.error(f"{location['name']} verileri çekilirken hata: {str(e)}")
        
        # Önbelleğe ekle
        self._add_to_cache(cache_key, results)
        
        return results 