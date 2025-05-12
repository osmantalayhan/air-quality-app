#!/bin/bash

# Varsayılan değerler
DURATION=60
RATE=1
ANOMALY_CHANCE=10

# Parametreleri parse et
for arg in "$@"
do
    case $arg in
        --duration=*)
        DURATION="${arg#*=}"
        shift
        ;;
        --rate=*)
        RATE="${arg#*=}"
        shift
        ;;
        --anomaly-chance=*)
        ANOMALY_CHANCE="${arg#*=}"
        shift
        ;;
    esac
done

# API endpoint'i
API_URL="http://localhost:8000/api/air-quality"

# Rastgele koordinat üret
generate_random_coordinates() {
    # Türkiye sınırları içinde rastgele koordinatlar
    LAT=$(awk -v min=36 -v max=42 'BEGIN{srand(); print min+rand()*(max-min)}')
    LON=$(awk -v min=26 -v max=45 'BEGIN{srand(); print min+rand()*(max-min)}')
    echo "$LAT $LON"
}

# Rastgele parametre ve değer üret
generate_random_data() {
    PARAMETERS=("PM2.5" "PM10" "NO2" "SO2" "O3")
    PARAMETER=${PARAMETERS[$RANDOM % ${#PARAMETERS[@]}]}
    
    # Normal değer aralıkları
    case $PARAMETER in
        "PM2.5") NORMAL_MIN=0; NORMAL_MAX=35 ;;
        "PM10") NORMAL_MIN=0; NORMAL_MAX=50 ;;
        "NO2") NORMAL_MIN=0; NORMAL_MAX=40 ;;
        "SO2") NORMAL_MIN=0; NORMAL_MAX=20 ;;
        "O3") NORMAL_MIN=0; NORMAL_MAX=60 ;;
    esac
    
    # Anomali kontrolü
    if [ $((RANDOM % 100)) -lt $ANOMALY_CHANCE ]; then
        # Anomali değeri (normal değerin 2-5 katı)
        MULTIPLIER=$((2 + RANDOM % 4))
        VALUE=$(awk -v min=$NORMAL_MIN -v max=$NORMAL_MAX -v mult=$MULTIPLIER 'BEGIN{srand(); print (min+rand()*(max-min))*mult}')
    else
        # Normal değer
        VALUE=$(awk -v min=$NORMAL_MIN -v max=$NORMAL_MAX 'BEGIN{srand(); print min+rand()*(max-min)}')
    fi
    
    echo "$PARAMETER $VALUE"
}

# Ana döngü
echo "Test başlatılıyor..."
echo "Süre: $DURATION saniye"
echo "Hız: $RATE istek/saniye"
echo "Anomali olasılığı: %$ANOMALY_CHANCE"

START_TIME=$(date +%s)
END_TIME=$((START_TIME + DURATION))

while [ $(date +%s) -lt $END_TIME ]; do
    # Rastgele veri üret
    read LAT LON <<< $(generate_random_coordinates)
    read PARAMETER VALUE <<< $(generate_random_data)
    
    # JSON verisi oluştur
    JSON_DATA=$(cat <<EOF
    {
        "latitude": $LAT,
        "longitude": $LON,
        "parameter": "$PARAMETER",
        "value": $VALUE,
        "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
    }
EOF
    )
    
    # API'ye istek gönder
    curl -X POST "$API_URL" \
         -H "Content-Type: application/json" \
         -d "$JSON_DATA" \
         -s > /dev/null
    
    # İstek hızını kontrol et
    sleep $(echo "scale=3; 1/$RATE" | bc)
done

echo "Test tamamlandı." 