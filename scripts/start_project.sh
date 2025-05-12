#!/bin/bash

# Renkli çıktı için
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # Rengi sıfırla

echo -e "${BLUE}=== Hava Kalitesi İzleme Sistemi Başlatılıyor ===${NC}"
echo

# Docker kontrol et
if ! command -v docker &> /dev/null || ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}Hata: Docker ve Docker Compose yüklü değil${NC}"
    echo "Lütfen Docker ve Docker Compose'u yükleyin ve tekrar deneyin."
    exit 1
fi

echo -e "${YELLOW}Mevcut servisler durduruluyor...${NC}"
docker-compose down

echo -e "${YELLOW}Servisler başlatılıyor...${NC}"
docker-compose up -d

# Servislerin başlatılmasını bekle
echo -e "${YELLOW}Servislerin başlaması bekleniyor...${NC}"
sleep 10

# Backend'in çalışıp çalışmadığını kontrol et
echo -e "${YELLOW}Backend servisi kontrol ediliyor...${NC}"
if curl -s http://localhost:8000/health | grep -q "healthy"; then
    echo -e "${GREEN}Backend servisi aktif!${NC}"
else
    echo -e "${RED}Backend servisi başlatılamadı.${NC}"
    echo "Logları kontrol etmek için: docker-compose logs backend"
fi

# Frontend'in çalışıp çalışmadığını kontrol et
echo -e "${YELLOW}Frontend servisi kontrol ediliyor...${NC}"
if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 | grep -q "200"; then
    echo -e "${GREEN}Frontend servisi aktif!${NC}"
else
    echo -e "${RED}Frontend servisi başlatılamadı.${NC}"
    echo "Logları kontrol etmek için: docker-compose logs frontend"
fi

# Veritabanı bağlantısını kontrol et
echo -e "${YELLOW}Veritabanı bağlantısı kontrol ediliyor...${NC}"
if docker-compose exec db pg_isready -U postgres; then
    echo -e "${GREEN}Veritabanı aktif!${NC}"
else
    echo -e "${RED}Veritabanı başlatılamadı.${NC}"
    echo "Logları kontrol etmek için: docker-compose logs db"
fi

# RabbitMQ bağlantısını kontrol et
echo -e "${YELLOW}RabbitMQ servisi kontrol ediliyor...${NC}"
if curl -s -u guest:guest -o /dev/null -w "%{http_code}" http://localhost:15672/api/overview | grep -q "200"; then
    echo -e "${GREEN}RabbitMQ servisi aktif!${NC}"
else
    echo -e "${RED}RabbitMQ servisi başlatılamadı.${NC}"
    echo "Logları kontrol etmek için: docker-compose logs rabbitmq"
fi

echo
echo -e "${GREEN}=== Tüm servisler başlatıldı ===${NC}"
echo -e "Frontend: ${BLUE}http://localhost:3000${NC}"
echo -e "Backend API: ${BLUE}http://localhost:8000${NC}"
echo -e "API Dokümantasyonu: ${BLUE}http://localhost:8000/docs${NC}"
echo -e "RabbitMQ Yönetim Paneli: ${BLUE}http://localhost:15672${NC}"
echo
echo -e "${YELLOW}Logları görüntülemek için:${NC} docker-compose logs -f"
echo -e "${YELLOW}Servisleri durdurmak için:${NC} docker-compose down"
echo

exit 0 