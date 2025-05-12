# HavaQualityApp - Gerçek Zamanlı Hava Kirliliği İzleme Platformu

Bu proje, Kartaca "Çekirdekten Yetişenler Programı" kapsamında geliştirilen, dünya genelinde hava kirlilik verilerini toplayan, analiz eden ve görselleştiren web tabanlı bir platformdur.

## 📋 Projenin Amacı ve Kapsamı

HavaQualityApp, dünya genelinde ve özellikle Türkiye'deki hava kalitesi verilerini:
- Gerçek zamanlı olarak toplar ve analiz eder
- Kullanıcı dostu bir arayüzle harita üzerinde görselleştirir
- Anomali tespiti yaparak tehlikeli hava kalitesi durumlarında uyarılar oluşturur
- Tarihsel verileri saklayarak trend analizi sağlar

Platform, çeşitli kirletici maddeleri (PM2.5, PM10, NO2, SO2, O3) takip eder ve WHO standartlarına göre tehlikeli seviyeleri belirler.

## 🏗️ Sistem Mimarisi ve Komponentlerin Açıklaması

### Genel Mimari

Proje, mikroservis mimarisini temel alan Docker konteynerlerinde çalışan bileşenlerden oluşur:

![Sistem Mimarisi](https://example.com/architecture.png)

### Ana Bileşenler

1. **Backend Servisi**: 
   - FastAPI ile geliştirilmiş RESTful API
   - Hava kalitesi verilerini sağlar ve anomali tespiti yapar
   - WebSocket üzerinden gerçek zamanlı veri akışı ve bildirimler

2. **Frontend Servisi**:
   - React ve Material UI ile geliştirilmiş kullanıcı arayüzü
   - Mapbox GL ile harita görselleştirme
   - Chart.js ile zaman serisi grafikleri

3. **Data Processor**:
   - Arka planda çalışan veri işleme servisi
   - RabbitMQ'dan gelen mesajları işler
   - Anomali tespiti algoritmaları burada çalışır

4. **Veritabanı**:
   - TimescaleDB (PostgreSQL tabanlı) zaman serisi veritabanı
   - Hava kalitesi verilerini ve anomalileri saklar

5. **Mesaj Kuyruk Sistemi**:
   - RabbitMQ ile servisler arası asenkron iletişim
   - Ölçeklenebilirlik ve güvenilirlik sağlar

6. **Test Araçları**:
   - Manuel veri girişi ve otomatik test scriptleri

## 🛠️ Teknoloji Seçimleri ve Gerekçeleri

### Backend
- **FastAPI**: Hızlı geliştirme, asenkron destek ve otomatik API dokümantasyonu için tercih edildi
- **SQLAlchemy**: Nesne ilişkisel eşleme (ORM) için, veritabanı işlemlerini kolaylaştırır
- **TimescaleDB**: Zaman serisi verileri için optimize edilmiş PostgreSQL uzantısı, hem ilişkisel veritabanı özellikleri hem de zaman serisi performansı sunar
- **RabbitMQ**: Güvenilir mesaj kuyruğu sistemi, servisler arası iletişimi sağlar

### Frontend
- **React**: Komponent tabanlı yapısı ve geniş ekosistemi ile modern UI geliştirme
- **Material-UI**: Hazır, responsive ve modern UI bileşenleri
- **Mapbox GL**: Yüksek performanslı harita görselleştirme ve coğrafi veri analizi
- **Chart.js**: Hafif ve özelleştirilebilir grafik kütüphanesi

### DevOps
- **Docker & Docker Compose**: Kolay dağıtım ve geliştirme ortamı standardizasyonu
- **Nginx**: Frontend için web sunucusu

## 🚀 Kurulum Adımları

### Ön Koşullar
- Docker ve Docker Compose yüklü olmalıdır
- Git

### Kurulum
1. Projeyi klonlayın:
```bash
git clone https://github.com/kullanici/hava-kalitesi-izleme.git
cd hava-kalitesi-izleme
```

2. Docker Compose ile çalıştırın:
```bash
docker-compose up -d
```

3. Servislerin başlamasını bekleyin (yaklaşık 30-60 saniye):
```bash
docker-compose ps
```

4. Tarayıcınızda uygulamayı açın:
```
http://localhost:3000
```

### Manuel Kurulum (Docker olmadan)

#### Backend:
1. Python 3.9+ kurulu olmalıdır
2. Gereksinimleri yükleyin:
```bash
cd backend
pip install -r requirements.txt
```

3. PostgreSQL veritabanı oluşturun:
```bash
# PostgreSQL kurulumuna göre veritabanı oluşturma
createdb -U postgres hava
```

4. `.env` dosyasını oluşturun:
```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/hava
```

5. Uygulamayı başlatın:
```bash
uvicorn main:app --reload
```

#### Frontend:
1. Node.js (14+) kurulu olmalıdır
2. Bağımlılıkları yükleyin:
```bash
cd frontend
npm install
```

3. `.env` dosyasını oluşturun:
```
REACT_APP_API_URL=http://localhost:8000
REACT_APP_WS_URL=ws://localhost:8000/ws/alerts
```

4. Uygulamayı başlatın:
```bash
npm start
```

## 📱 Kullanım Rehberi

### Ana Ekran (Dashboard)
- Harita üzerinde dünya genelinde hava kalitesi değerleri gösterilir
- Renkli noktalar AQI (Hava Kalitesi İndeksi) değerlerini temsil eder
- Grafikler son 24 saatteki eğilimleri gösterir
- Aktif uyarılar sağ panelde listelenir

### Harita Kullanımı
- Yakınlaştırma/Uzaklaştırma için fare tekerleği
- Haritayı kaydırmak için sürükleme
- Sensörlere tıklayarak detaylı bilgi görüntüleme
- Sağ üst köşedeki kontroller ile görünüm değiştirme

### Anomali İzleme
- Anomaliler ekranında tespit edilen tüm anormallikler listelenir
- Filtreler ile şiddet derecesine, tarih aralığına veya konuma göre filtreleme
- Anomali detayları için ilgili satıra tıklayın

### Manuel Veri Girişi
- "Manuel Veri Girişi" sekmesine gidin
- Harita üzerinde konum seçin veya koordinatları manuel girin
- Hava kalitesi parametrelerini doldurun ve "Gönder" butonuna tıklayın

## 📡 API Dokümantasyonu

API dokümantasyonu Swagger UI ile otomatik olarak oluşturulmuştur:
```
http://localhost:8000/docs
```

### Önemli API Endpoint'leri

#### Sensör Verileri
- `GET /sensors` - Tüm sensörlerin listesini alır
- `GET /sensors?location={location}` - Konum bazında filtrelenmiş sensör listesi

#### Hava Kalitesi Verileri
- `GET /air-quality` - Tüm hava kalitesi verilerini döndürür
- `GET /api/v1/air-quality/latest` - En son hava kalitesi verilerini alır
- `GET /api/v1/air-quality/history?hours={hours}` - Belirli bir zaman aralığındaki verileri alır
- `GET /api/v1/air-quality/by-region?latitude={lat}&longitude={lon}&radius={r}` - Bölgesel veriler

#### Anomali API'leri
- `GET /api/v1/anomalies` - Tüm anomalileri listeler
- `GET /api/v1/anomalies/active` - Aktif anomalileri listeler
- `POST /api/v1/anomalies/{id}/resolve` - Bir anomaliyi çözüldü olarak işaretler

#### WebSocket
- `WebSocket /ws/alerts` - Gerçek zamanlı uyarılar için WebSocket bağlantısı

## 📜 Script'lerin Kullanımı ve Parametreleri

### Manuel Veri Girişi Script'i
```bash
./scripts/manual-input.sh <latitude> <longitude> [param1=value1] [param2=value2]...
```

Parametreler:
- `<latitude>`: Enlem değeri (zorunlu)
- `<longitude>`: Boylam değeri (zorunlu)
- `pm25=<value>`: PM2.5 değeri (µg/m³)
- `pm10=<value>`: PM10 değeri (µg/m³)
- `no2=<value>`: NO2 değeri (µg/m³)
- `so2=<value>`: SO2 değeri (µg/m³)
- `o3=<value>`: O3 değeri (µg/m³)

Örnek:
```bash
./scripts/manual-input.sh 41.0082 28.9784 pm25=35.5 pm10=50.2 o3=20.1
```

### Otomatik Test Script'i
```bash
./scripts/auto-test.sh [options]
```

Seçenekler:
- `--duration=<seconds>`: Test süresi (saniye), varsayılan: 300
- `--rate=<requests_per_second>`: Saniyede kaç istek atılacağı, varsayılan: 1
- `--anomaly-chance=<percentage>`: Anomali oluşturma yüzdesi (0-100), varsayılan: 10

Örnek:
```bash
./scripts/auto-test.sh --duration=3600 --rate=5 --anomaly-chance=20
```

## 🔧 Sorun Giderme (Troubleshooting) Rehberi

### Genel Sorunlar

#### Uygulama başlatılamıyor
1. Docker servislerinin çalıştığını kontrol edin:
```bash
docker-compose ps
```
2. Log kayıtlarını inceleyin:
```bash
docker-compose logs
```
3. Belirli bir servisin logları:
```bash
docker-compose logs backend
```

#### Veritabanı bağlantı hatası
1. Veritabanı servisinin çalıştığını kontrol edin:
```bash
docker-compose ps db
```
2. Veritabanı loglarını inceleyin:
```bash
docker-compose logs db
```
3. Veritabanı bağlantı parametrelerini kontrol edin:
```
# .env dosyasında
DATABASE_URL=postgresql://postgres:postgres@db:5432/hava
```

#### Frontend bağlantı sorunu
1. API URL'inin doğru yapılandırıldığını kontrol edin:
```
# frontend/.env dosyasında
REACT_APP_API_URL=http://localhost:8000
```
2. CORS ayarlarını kontrol edin:
```python
# backend/main.py içinde
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    ...
)
```

#### WebSocket bağlantı sorunu
1. WebSocket bağlantı URL'ini kontrol edin:
```
# frontend/.env dosyasında
REACT_APP_WS_URL=ws://localhost:8000/ws/alerts
```
2. Backend'de WebSocket endpoint'inin çalıştığını kontrol edin:
```bash
# Backend loglarını inceleyin
docker-compose logs backend | grep -i websocket
```

### Yaygın Hatalar ve Çözümleri

#### "Port is already allocated" hatası
```bash
# Kullanılan portları kontrol edin
netstat -tulpn | grep 8000
# veya Windows için
netstat -ano | findstr 8000

# Çalışan hizmetleri durdurun
docker-compose down
# veya belirli bir porttaki uygulamayı durdurun (Linux)
kill $(lsof -t -i:8000)
```

#### "No matching distribution found" (pip) hatası
```bash
# Python sürümünüzü kontrol edin (3.9+ gerekli)
python --version

# Pip'i güncelleyin
pip install --upgrade pip
```

#### "Could not resolve host" hatası
```bash
# Docker network ayarlarını kontrol edin
docker network ls
docker network inspect hava-kalitesi-izleme_default
```

## 🔍 Ek Bilgiler

### Veri Kaynakları
Uygulama, Open-Meteo Air Quality API'sini kullanarak gerçek zamanlı hava kalitesi verilerini çekmektedir.

### Anomali Tespiti Kriterleri
1. WHO standartlarına göre eşik değerler:
   - PM2.5 > 35.0 μg/m³
   - PM10 > 50.0 μg/m³
   - NO2 > 200.0 μg/m³
   - SO2 > 20.0 μg/m³
   - O3 > 100.0 μg/m³

2. Son 24 saatlik ortalamaya göre %50'den fazla artış gösteren değerler

3. Aynı bölgedeki (25km yarıçap) diğer sensörlerden önemli ölçüde farklı değerler

## 📝 Lisans
Bu proje MIT lisansı altında lisanslanmıştır.

## 🤝 Katkıda Bulunanlar
- Takım üyeleri ve katkıda bulunanlar

## 📞 İletişim
Sorularınız veya geri bildirimleriniz için: tlyhnosman@gmail.com 