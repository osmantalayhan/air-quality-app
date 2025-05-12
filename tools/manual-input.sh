#!/bin/bash
# Manuel hava kalitesi verisi gönderme scripti

# Kullanım bilgisi
usage() {
  echo "Kullanım: $0 <latitude> <longitude> <parameter> <value> [location]"
  echo
  echo "Parametreler:"
  echo "  <latitude>   : Enlem (40.9840 gibi)"
  echo "  <longitude>  : Boylam (29.0250 gibi)"
  echo "  <parameter>  : Ölçüm parametresi (pm25, pm10, no2, so2, o3, aqi)"
  echo "  <value>      : Ölçüm değeri (sayısal değer)"
  echo "  [location]   : Konum adı (isteğe bağlı, varsayılan: 'Custom Location')"
  echo
  echo "Örnek:"
  echo "  $0 40.9840 29.0250 pm25 75 Kadıköy"
  exit 1
}

# Komut satırı argümanlarını kontrol et
if [ $# -lt 4 ]; then
  usage
fi

LATITUDE=$1
LONGITUDE=$2
PARAMETER=$3
VALUE=$4
LOCATION=${5:-"Custom Location"}
API_URL=${API_URL:-"http://localhost:8000"}

# Zaman damgası oluştur
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Veri hazırla
# Önce tüm değerleri varsayılan değerlerle başlat
AQI=0
PM25=0
PM10=0
NO2=0
SO2=0
O3=0

# Belirtilen parametreye göre değeri ata
case "$PARAMETER" in
  "pm25")
    PM25=$VALUE
    AQI=$(echo "$VALUE * 1.25" | bc | xargs printf "%.0f")
    ;;
  "pm10")
    PM10=$VALUE
    AQI=$(echo "$VALUE * 0.83" | bc | xargs printf "%.0f")
    ;;
  "no2")
    NO2=$VALUE
    AQI=$(echo "$VALUE * 2.5" | bc | xargs printf "%.0f")
    ;;
  "so2")
    SO2=$VALUE
    AQI=$(echo "$VALUE * 5" | bc | xargs printf "%.0f")
    ;;
  "o3")
    O3=$VALUE
    AQI=$(echo "$VALUE * 1.67" | bc | xargs printf "%.0f")
    ;;
  "aqi")
    AQI=$VALUE
    PM25=$(echo "$VALUE * 0.8" | bc | xargs printf "%.0f")
    PM10=$(echo "$VALUE * 1.2" | bc | xargs printf "%.0f")
    NO2=$(echo "$VALUE * 0.4" | bc | xargs printf "%.0f")
    SO2=$(echo "$VALUE * 0.2" | bc | xargs printf "%.0f")
    O3=$(echo "$VALUE * 0.6" | bc | xargs printf "%.0f")
    ;;
  *)
    echo "Hata: Geçersiz parametre '$PARAMETER'. Geçerli değerler: pm25, pm10, no2, so2, o3, aqi"
    exit 1
    ;;
esac

# JSON verisi oluştur - backend API modelindeki ManualAirQualityInput class'ına uygun şekilde
JSON_DATA="{
  \"location\": \"$LOCATION\",
  \"latitude\": $LATITUDE,
  \"longitude\": $LONGITUDE,
  \"aqi\": $AQI,
  \"pm25\": $PM25,
  \"pm10\": $PM10,
  \"no2\": $NO2,
  \"so2\": $SO2,
  \"o3\": $O3
}"

echo "Gönderilen veri:"
echo "$JSON_DATA"

# Veriyi API'ye gönder - doğru endpoint'i kullan
RESPONSE=$(curl -s -X POST \
  -H "Content-Type: application/json" \
  -d "$JSON_DATA" \
  $API_URL/api/v1/air-quality/manual-input)

# Yanıtı kontrol et
if [ $? -eq 0 ]; then
  echo "Veri başarıyla gönderildi"
  echo "API yanıtı: $RESPONSE"
else
  echo "Hata: Veri gönderilemedi"
  echo "API yanıtı: $RESPONSE"
  exit 1
fi 