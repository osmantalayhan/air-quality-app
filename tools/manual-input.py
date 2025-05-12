#!/usr/bin/env python
"""
Manuel hava kalitesi verisi gönderme scripti (Python versiyonu)
"""

import argparse
import json
import math
import requests
import datetime
import sys
import os

def parse_arguments():
    """Komut satırı argümanlarını ayrıştır"""
    parser = argparse.ArgumentParser(description='Manuel hava kalitesi verisi gönderme aracı')
    parser.add_argument('latitude', type=float, help='Enlem (40.9840 gibi)')
    parser.add_argument('longitude', type=float, help='Boylam (29.0250 gibi)')
    parser.add_argument('parameter', choices=['pm25', 'pm10', 'no2', 'so2', 'o3', 'aqi'], 
                        help='Ölçüm parametresi (pm25, pm10, no2, so2, o3, aqi)')
    parser.add_argument('value', type=float, help='Ölçüm değeri (sayısal değer)')
    parser.add_argument('location', nargs='?', default='Custom Location', help='Konum adı (isteğe bağlı)')
    
    return parser.parse_args()

def main():
    """Ana fonksiyon"""
    args = parse_arguments()
    
    # API URL'ini ayarla (ortam değişkeninden veya varsayılan)
    api_url = os.environ.get('API_URL', 'http://localhost:8000')
    
    # Parametreleri al
    latitude = args.latitude
    longitude = args.longitude
    parameter = args.parameter
    value = args.value
    location = args.location
    
    # Veri hazırla
    # Önce tüm değerleri varsayılan değerlerle başlat
    aqi = 0
    pm25 = 0
    pm10 = 0
    no2 = 0
    so2 = 0
    o3 = 0
    
    # Belirtilen parametreye göre değeri ata
    if parameter == 'pm25':
        pm25 = value
        aqi = int(value * 1.25)
    elif parameter == 'pm10':
        pm10 = value
        aqi = int(value * 0.83)
    elif parameter == 'no2':
        no2 = value
        aqi = int(value * 2.5)
    elif parameter == 'so2':
        so2 = value
        aqi = int(value * 5)
    elif parameter == 'o3':
        o3 = value
        aqi = int(value * 1.67)
    elif parameter == 'aqi':
        aqi = int(value)
        pm25 = value * 0.8
        pm10 = value * 1.2
        no2 = value * 0.4
        so2 = value * 0.2
        o3 = value * 0.6
    
    # JSON verisi oluştur
    data = {
        "location": location,
        "latitude": latitude,
        "longitude": longitude,
        "aqi": aqi,
        "pm25": pm25,
        "pm10": pm10,
        "no2": no2,
        "so2": so2,
        "o3": o3
    }
    
    print("Gönderilen veri:")
    print(json.dumps(data, indent=2))
    
    # Veriyi API'ye gönder
    try:
        endpoint = f"{api_url}/api/v1/air-quality/manual-input"
        print(f"API endpoint: {endpoint}")
        
        response = requests.post(
            endpoint,
            json=data,
            headers={"Content-Type": "application/json"}
        )
        
        response.raise_for_status()  # Hata durumunda exception fırlat
        
        print("Veri başarıyla gönderildi")
        print(f"API yanıtı: {response.text}")
        
    except requests.exceptions.RequestException as e:
        print(f"Hata: Veri gönderilemedi - {e}")
        if hasattr(e, 'response') and e.response:
            print(f"API yanıtı: {e.response.text}")
        sys.exit(1)

if __name__ == "__main__":
    main() 