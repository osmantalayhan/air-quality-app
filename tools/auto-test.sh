#!/bin/bash
# Otomatik hava kalitesi veri üretme ve test script'i

# Kullanım bilgisi
usage() {
  echo "Kullanım: $0 [options]"
  echo
  echo "Seçenekler:"
  echo "  --duration=<seconds>       : Script'in çalışma süresi (saniye cinsinden, varsayılan: 3600)"
  echo "  --rate=<requests_per_min>  : Dakikadaki istek sayısı (varsayılan: 10)"
  echo "  --anomaly-chance=<percent> : Anomali oluşturma olasılığı (yüzde, varsayılan: 20)"
  echo "  --locations=<number>       : Rastgele oluşturulacak konum sayısı (varsayılan: 5)"
  echo
  echo "Örnek:"
  echo "  $0 --duration=1800 --rate=30 --anomaly-chance=25 --locations=10"
  exit 1
}

# Varsayılan değerler
DURATION=3600    # 1 saat
RATE=10          # Dakikada 10 istek
ANOMALY_CHANCE=20 # %20 anomali şansı
LOCATIONS=5      # 5 rastgele konum
API_URL=${API_URL:-"http://localhost:8000"}

# Komut satırı parametrelerini işle
for i in "$@"; do
  case $i in
    --duration=*)
      DURATION="${i#*=}"
      shift
      ;;
    --rate=*)
      RATE="${i#*=}"
      shift
      ;;
    --anomaly-chance=*)
      ANOMALY_CHANCE="${i#*=}"
      shift
      ;;
    --locations=*)
      LOCATIONS="${i#*=}"
      shift
      ;;
    --help)
      usage
      ;;
    *)
      echo "Bilinmeyen parametre: $i"
      usage
      ;;
  esac
done

# Parametreleri görüntüle
echo "Otomatik test başlatılıyor..."
echo "Süre: $DURATION saniye"
echo "İstek hızı: $RATE istek/dakika"
echo "Anomali şansı: %$ANOMALY_CHANCE"
echo "Rastgele konum sayısı: $LOCATIONS"
echo "API URL: $API_URL"
echo

# Rastgele konumları oluştur
CITIES=("Istanbul" "Ankara" "Izmir" "Antalya" "Bursa" "Adana" "Konya" "Gaziantep" "Kayseri" "Mersin" "Samsun" "Diyarbakir" "Denizli" "Eskisehir" "Trabzon")

# İstek aralığını hesapla (saniye)
INTERVAL=$(echo "scale=2; 60 / $RATE" | bc)

# Başlangıç zamanını kaydet
START_TIME=$(date +%s)
END_TIME=$((START_TIME + DURATION))

# İstek sayacı
REQUEST_COUNT=0

# Ctrl+C ile kesintiye uğrama durumunda temizlik yap
trap 'echo -e "\nTest durduruldu. Toplam $REQUEST_COUNT istek gönderildi."; exit 0' INT

echo "İstekler gönderiliyor... (durdurmak için Ctrl+C)"
echo "----------------------------------------------"

while [ $(date +%s) -lt $END_TIME ]; do
  # Rastgele bir konum seç veya yeni bir konum oluştur
  if [ $((RANDOM % 2)) -eq 0 ] && [ ${#CITIES[@]} -gt 0 ]; then
    RANDOM_INDEX=$((RANDOM % ${#CITIES[@]}))
    LOCATION="${CITIES[$RANDOM_INDEX]}"
    # Türkiye'nin yaklaşık sınırları içinde bir konum
    LAT=$(echo "scale=6; 36 + (42 - 36) * $RANDOM / 32768" | bc)
    LNG=$(echo "scale=6; 26 + (45 - 26) * $RANDOM / 32768" | bc)
  else
    # Tamamen rastgele bir dünya konumu
    LAT=$(echo "scale=6; -90 + 180 * $RANDOM / 32768" | bc)
    LNG=$(echo "scale=6; -180 + 360 * $RANDOM / 32768" | bc)
    LOCATION="Location-$((RANDOM % 1000))"
  fi

  # Rastgele parametre değerleri oluştur
  AQI=$((RANDOM % 300 + 1))
  
  # Anomali oluşturma şansı
  if [ $((RANDOM % 100)) -lt $ANOMALY_CHANCE ]; then
    # Anomali değerleri (yüksek)
    AQI=$((AQI * 2))
    if [ $AQI -gt 500 ]; then
      AQI=500
    fi
    IS_ANOMALY="true"
  else
    IS_ANOMALY="false"
  fi
  
  # Diğer değerleri AQI'ye göre oluştur
  PM25=$(echo "$AQI * 0.8" | bc | xargs printf "%.0f")
  PM10=$(echo "$AQI * 1.2" | bc | xargs printf "%.0f")
  NO2=$(echo "$AQI * 0.4" | bc | xargs printf "%.0f")
  SO2=$(echo "$AQI * 0.2" | bc | xargs printf "%.0f")
  O3=$(echo "$AQI * 0.6" | bc | xargs printf "%.0f")
  
  # Zaman damgası oluştur
  TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  
  # JSON verisi oluştur
  JSON_DATA="{
    \"sensor_id\": $((RANDOM % 1000 + 1000)),
    \"location\": \"$LOCATION\",
    \"latitude\": $LAT,
    \"longitude\": $LNG,
    \"timestamp\": \"$TIMESTAMP\",
    \"aqi\": $AQI,
    \"pm25\": $PM25,
    \"pm10\": $PM10,
    \"no2\": $NO2,
    \"so2\": $SO2,
    \"o3\": $O3,
    \"is_anomaly\": $IS_ANOMALY
  }"
  
  # Veriyi API'ye gönder
  RESPONSE=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    -d "$JSON_DATA" \
    $API_URL/api/v1/air-quality)
  
  # İstek sayacını artır
  REQUEST_COUNT=$((REQUEST_COUNT + 1))
  
  # Durumu göster
  if [ $IS_ANOMALY == "true" ]; then
    ANOMALY_STATUS="[ANOMALİ]"
  else
    ANOMALY_STATUS=""
  fi
  
  echo "[$REQUEST_COUNT] $LOCATION - AQI: $AQI $ANOMALY_STATUS"
  
  # İstek aralığı kadar bekle
  sleep $INTERVAL
done

echo "----------------------------------------------"
echo "Test tamamlandı. Toplam $REQUEST_COUNT istek gönderildi." 