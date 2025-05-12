#!/bin/bash

# Script parametrelerini kontrol et
if [ $# -lt 3 ]; then
    echo "Kullanım: $0 <latitude> <longitude> [<parameter=value> ...]"
    echo "Örnek: $0 41.0082 28.9784 pm25=35.5 pm10=50.2 o3=20.1"
    echo "Desteklenen parametreler: pm25, pm10, o3, no2, so2, co"
    exit 1
fi

# Parametreleri al
LATITUDE=$1
LONGITUDE=$2
shift 2  # İlk iki parametreyi kaldır

# API endpoint'i
API_URL="http://localhost:8000/api/v1/air-quality/manual-input"

# Parametre ve değerleri topla
params=()
for param in "$@"; do
    IFS='=' read -r key value <<< "$param"
    params+=("\"$key\": $value")
done

# JSON verisi oluştur
JSON_DATA=$(cat <<EOF
{
    "latitude": $LATITUDE,
    "longitude": $LONGITUDE,
    $(IFS=, ; echo "${params[*]}"),
    "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
}
EOF
)

echo "Gönderilecek veri:"
echo "$JSON_DATA"

# API'ye istek gönder
echo "API isteği gönderiliyor: $API_URL"
curl -X POST "$API_URL" \
     -H "Content-Type: application/json" \
     -d "$JSON_DATA"

# İstek sonucunu kontrol et
if [ $? -eq 0 ]; then
    echo -e "\nVeri başarıyla gönderildi."
else
    echo -e "\nVeri gönderilirken bir hata oluştu."
fi 