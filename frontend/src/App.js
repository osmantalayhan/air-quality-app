import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Box, Container, Grid, Paper, Snackbar, Alert, Typography, Tabs, Tab, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material';
import Map from './components/Map';
import AirQualityChart from './components/AirQualityChart';
import AlertPanel from './components/AlertPanel';
import ManualInput from './pages/ManualInput';
import { styled } from '@mui/material/styles';
import EnhancedAirQualityCharts from './components/EnhancedAirQualityCharts';
import WebSocketIndicator from './components/WebSocketIndicator';
import HeatmapIndicator from './components/HeatmapIndicator';
import HealthEffectsPanel from './components/HealthEffectsPanel';
import ParameterInfo from './components/ParameterInfo';

const StyledPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(2),
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden'
}));

const MapContainer = styled(StyledPaper)(({ theme }) => ({
  height: '600px',
  [theme.breakpoints.down('md')]: {
    height: '400px',
  },
}));

const AlertContainer = styled(StyledPaper)(({ theme }) => ({
  height: '600px',
  overflowY: 'auto',
  [theme.breakpoints.down('md')]: {
    height: '400px',
  },
}));

const ChartContainer = styled(StyledPaper)(({ theme }) => ({
  height: 'auto',
  minHeight: '650px',
  maxHeight: '1200px',
  overflow: 'auto'
}));

// WebSocket API'nin URL'sini yapılandırma
const WS_URL = 'ws://localhost:8000/ws/alerts';
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';
const MAPBOX_TOKEN = process.env.REACT_APP_MAPBOX_TOKEN || '';
const SIMULATION_MODE_ENABLED = false; // Simülasyon modu devre dışı

function App() {
  const [activeTab, setActiveTab] = useState(0);
  // localStorage'dan uyarıları başlangıçta yükle
  const [alerts, setAlerts] = useState(() => {
    const savedAlerts = localStorage.getItem('havaQualityAlerts');
    return savedAlerts ? JSON.parse(savedAlerts) : [];
  });
  const [airQualityData, setAirQualityData] = useState([]);
  const [sensors, setSensors] = useState([]);
  const [selectedSensor, setSelectedSensor] = useState(null);
  const [notification, setNotification] = useState({ open: false, message: '', severity: 'info' });
  const [wsConnected, setWsConnected] = useState(false);
  const [wsRetryCount, setWsRetryCount] = useState(0);
  const wsRef = useRef(null); // WebSocket referansını tut
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  // Bölgesel veri state'leri
  const [selectedRegionSensors, setSelectedRegionSensors] = useState([]);
  const [selectedRegionData, setSelectedRegionData] = useState([]);
  const [regionalAverages, setRegionalAverages] = useState({});
  const [forecastTable, setForecastTable] = useState([]);
  const [forecastStats, setForecastStats] = useState({ min: 0, max: 0, avg: 0 });

  const handleChangeTab = (event, newValue) => {
    setActiveTab(newValue);
  };

  // Uygulama başladığında WebSocket bağlantısı kur ve verileri yükle
  useEffect(() => {
    // WebSocket bağlantısını kur
    console.log("WebSocket bağlantısı kuruluyor...");
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket bağlantısı başarılı');
      setWsConnected(true);
      setWsRetryCount(0);
      setNotification({
        open: true,
        message: 'Gerçek zamanlı uyarı sistemine bağlandı',
        severity: 'success'
      });
    };

    ws.onmessage = (event) => {
      try {
        console.log('WebSocket mesajı alındı:', event.data);
        const data = JSON.parse(event.data);
        
        // Ping mesajlarını kontrol et
        if (data.type === 'ping') {
          console.log('Ping alındı, bağlantı aktif');
          ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
          return;
        } else if (data.type === 'connection_established') {
          console.log('Bağlantı kuruldu mesajı alındı');
          return;
        }
        
        console.log('Yeni uyarı alındı:', data);
        
        // Uyarı bilgilerini kontrol et
        if (!data.id) {
          console.warn('Gelen mesajda ID bilgisi yok, atlanıyor', data);
          return;
        }
        
        // Aynı ID'li uyarı varsa güncelle, yoksa ekle
        setAlerts(prevAlerts => {
          // Aynı ID'li alert zaten var mı diye kontrol et
          const existingAlertIndex = prevAlerts.findIndex(alert => alert.id === data.id);
          
          // Yeni zaman damgası
          const now = new Date().toISOString();
          
          if (existingAlertIndex > -1) {
            // Varsa güncelle
            const updatedAlerts = [...prevAlerts];
            updatedAlerts[existingAlertIndex] = {
              ...data,
              // Gelmeyen alanlar için varsayılan değerler
              timestamp: data.timestamp || now,
              message: data.message || 'Uyarı detayı yok',
              severity: data.severity || 'medium',
            };
            console.log(`Mevcut uyarı güncellendi, ID: ${data.id}`);
            return updatedAlerts;
          } else {
            // Yoksa ekle
            const newAlert = {
              ...data,
              // Gelmeyen alanlar için varsayılan değerler
              timestamp: data.timestamp || now,
              message: data.message || 'Uyarı detayı yok',
              severity: data.severity || 'medium',
            };
            console.log(`➕ Yeni uyarı eklendi, ID: ${data.id}`);
            
            // Maksimum 100 uyarı sakla, en yeniler önce
            const result = [newAlert, ...prevAlerts].slice(0, 100);
            return result;
          }
        });
        
        // Bildirim göster
        if (data.title) {
          setNotification({
            open: true,
            message: `Yeni uyarı: ${data.title}`,
            severity: data.severity === 'high' ? 'error' : data.severity === 'medium' ? 'warning' : 'info'
          });
        }
      } catch (error) {
        console.error('WebSocket mesajı işlenirken hata:', error);
      }
    };

    ws.onclose = (event) => {
      console.log(`WebSocket bağlantısı kapandı: ${event.code}`, event);
      setWsConnected(false);
      
      // Bağlantı kapandıysa ve maksimum yeniden bağlantı denemesi aşılmadıysa
      if (wsRetryCount < 5) {
        console.log(`Yeniden bağlanılıyor... (${wsRetryCount + 1}/5)`);
        
        // Yeniden bağlanma denemesi sayısını artır
        setWsRetryCount(prev => prev + 1);
      } else {
        console.log('Maksimum yeniden bağlantı denemesi aşıldı');
        setNotification({
          open: true,
          message: 'Gerçek zamanlı uyarı sistemine bağlanılamadı',
          severity: 'error'
        });
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket hatası:', error);
    };
    
    // Sensörleri getir
    fetchSensors();
    
    // Hava kalitesi verilerini getir
    fetchAirQualityData();
    
    // Periyodik olarak hava kalitesi verilerini yenile
    const dataRefreshInterval = setInterval(() => {
      fetchAirQualityData();
    }, 60000 * 5); // Her 5 dakikada bir güncelle
    
    // Temizleme fonksiyonu
    return () => {
      if (wsRef.current) {
        console.log('useEffect cleanup: WebSocket kapatılıyor...');
        wsRef.current.close();
      }
      clearInterval(dataRefreshInterval);
      console.log('useEffect cleanup: Veri yenileme intervali temizlendi.');
    };
  }, []); // Sadece component mount olduğunda çalışacak şekilde boş bağımlılık dizisi

  // Sensörleri API'den çek
  const fetchSensors = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/sensors?limit=100`);
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      const data = await response.json();
      setSensors(data.sensors || []);
      console.log("Sensörler alındı:", data.sensors?.length || 0);
    } catch (error) {
      console.error("Sensör verisi alınırken hata:", error);
      setError("Sensör verileri yüklenemedi. Lütfen daha sonra tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  };

  // Hava kalitesi verilerini API'den çek
  const fetchAirQualityData = async () => {
    try {
      setLoading(true);
      // Eski endpoint: const response = await fetch(`${API_URL}/air-quality`);
      // Yeni endpoint kullan
      const response = await fetch(`${API_URL}/api/v1/air-quality/history?hours=24`);
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      const data = await response.json();
      
      // API'den gelen verileri işle - API yanıtında records veya data alanını kontrol et
      const airQualityRecords = data.records || data.data || [];
      setAirQualityData(airQualityRecords);
      console.log("Hava kalitesi verileri alındı:", airQualityRecords.length, "kayıt");
    } catch (error) {
      console.error("Hava kalitesi verisi alınırken hata:", error);
      setError("Hava kalitesi verileri yüklenemedi. Lütfen daha sonra tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  };

  // Belirli bir bölge için verileri çek
  const fetchRegionalData = async (latitude, longitude, radius = 25) => {
    try {
      // Önceki bölge verilerini temizleyelim
      setSelectedRegionData([]);
      console.log("[DEBUG] Bölgesel veri yüklenmeye başlıyor - önceki veriler temizlendi");
      
      setLoading(true);
      setError(null);
      
      // Bölgesel veriyi almak için API isteği
      const response = await fetch(`${API_URL}/api/v1/air-quality/by-region?latitude=${latitude}&longitude=${longitude}&radius=${radius}`);
      
      if (!response.ok) {
        throw new Error('Bölgesel veri alınamadı. Sunucu hatası.');
      }
      
      const data = await response.json();
      
      // Debug için veri içeriğini kontrol edelim
      console.log(`[DEBUG] Bölgesel API yanıtı: Sensör sayısı=${data.sensors?.length || 0}, Veri sayısı=${(data.air_quality || data.data || []).length}"`);
      
      // Bölgesel sensörleri ayarla
      setSelectedRegionSensors(data.sensors || []);
      
      // Bölgesel verileri ayarla - API'den gelen air_quality veya data alanını kontrol et
      const airQualityData = data.air_quality || data.data || [];
      
      // Verinin önce açık bir şekilde boş olduğunu, sonra yeni değerlerle dolduğunu görmek için loglama
      console.log(`[DEBUG] Yeni bölgesel veri yükleniyor: ${airQualityData.length} kayıt`);
      
      // Veri örneklerini gösterelim 
      if (airQualityData.length > 0) {
        console.log(`[DEBUG] İlk veri örneği:`, airQualityData[0]);
        console.log(`[DEBUG] Son veri örneği:`, airQualityData[airQualityData.length - 1]);
      }
      
      setSelectedRegionData(airQualityData);
      
      // API'den gelen hava kalitesi verisi boşsa kullanıcıya bildir ama sensör verisini göstermek için devam et
      if (airQualityData.length === 0) {
        console.log("API'den bölgesel veri gelmedi, sadece anlık sensör verisi gösteriliyor.");
        setNotification({
          open: true,
          message: "Bu bölge için geçmiş veri bulunamadı, sadece anlık değerler gösteriliyor",
          severity: "warning"
        });
      }
      
      // Bölgesel ortalamaları hesapla
      if (airQualityData && airQualityData.length > 0) {
        const avgData = airQualityData.reduce((acc, curr) => {
          acc.pm25 += curr.pm25 || 0;
          acc.pm10 += curr.pm10 || 0;
          acc.no2 += curr.no2 || 0;
          acc.so2 += curr.so2 || 0;
          acc.o3 += curr.o3 || 0;
          acc.aqi += curr.aqi || 0;
          return acc;
        }, { pm25: 0, pm10: 0, no2: 0, so2: 0, o3: 0, aqi: 0 });
        
        const count = airQualityData.length;
        Object.keys(avgData).forEach(key => {
          avgData[key] = Math.round(avgData[key] / count);
        });
        
        setRegionalAverages(avgData);
      } else if (data.regional_averages) {
        // API'den gelen regional_averages verisini kullan
        setRegionalAverages(data.regional_averages);
      } else if (data.sensors && data.sensors.length > 0) {
        // Bölgesel veri yoksa ve sensör verisi varsa, sensör verilerini ortalama olarak kullan
        const sensorData = data.sensors[0];
        setRegionalAverages({
          pm25: sensorData.pm25 || 0,
          pm10: sensorData.pm10 || 0,
          no2: sensorData.no2 || 0,
          so2: sensorData.so2 || 0,
          o3: sensorData.o3 || 0,
          aqi: sensorData.aqi || 0
        });
      }
      
      console.log("Bölgesel veriler alındı:", airQualityData.length, "kayıt");
    } catch (error) {
      console.error("Bölgesel veri alınırken hata:", error);
      setError("Bölgesel veriler yüklenemedi. Lütfen daha sonra tekrar deneyin.");
      setSelectedRegionData([]);
      setNotification({
        open: true,
        message: "Bölgesel veriler yüklenirken hata oluştu",
        severity: "error"
      });
    } finally {
      setLoading(false);
    }
  };

  // Sensör tıklandığında işleme - seçilen sensör verilerini getir
  const handleSensorClick = (sensor) => {
    console.log("Seçilen sensör:", sensor);
    
    if (sensor) {
      try {
        // Sensör verilerini formatlayıp state'e kaydet
        const selectedSensorData = {
          ...sensor,
          // Doğru veri alanlarını kullan, kesin formatı sağla
          name: sensor.station?.name || sensor.location || 'Bilinmeyen İstasyon',
          lat: sensor.latitude || sensor.lat,
          lon: sensor.longitude || sensor.lon,
          // AQI değerini kesin olarak ayarla, yuvarla
          aqi: Math.round(sensor.aqi || 0),
          // Diğer ölçüm değerlerini orijinal haliyle koru
          pm25: sensor.pm25 || 0,
          pm10: sensor.pm10 || 0,
          no2: sensor.no2 || 0,
          so2: sensor.so2 || 0,
          o3: sensor.o3 || 0
        };
        
        setSelectedSensor(selectedSensorData);
        
        // Enlem ve boylam değerlerini kontrol et
        const latitude = sensor.latitude || sensor.lat;
        const longitude = sensor.longitude || sensor.lon;
        
        if (latitude && longitude) {
          console.log(`Bölgesel veri çağrılıyor: lat=${latitude}, lon=${longitude}`);
          
          // Gerçek verileri API'den çek
          fetchRegionalData(latitude, longitude, 25);
          
          // Kullanıcıya bildirim göster
          setNotification({
            open: true,
            message: `${selectedSensorData.name} bölgesi için veriler getiriliyor`,
            severity: 'info'
          });
        } else {
          console.error("Seçilen sensörde geçerli lat/lon değerleri bulunamadı:", sensor);
          setSelectedRegionData([]);
          setNotification({
            open: true,
            message: `Sensör koordinatları bulunamadı`,
            severity: 'error'
          });
        }
      } catch (error) {
        console.error("Sensör verisi işlenirken hata:", error);
        setSelectedRegionData([]);
        setNotification({
          open: true,
          message: `Sensör verisi işlenirken hata oluştu`,
          severity: 'error'
        });
      }
    } else {
      setSelectedSensor(null);
      setSelectedRegionData([]);
    }
  };

  // Bildirim kapatma işleyicisi
  const handleCloseNotification = () => {
    setNotification({ ...notification, open: false });
  };
  
  // Uyarıyı temizleme işleyicisi
  const handleClearAlert = (alertId) => {
    setAlerts(prev => prev.filter(alert => alert.id !== alertId));
  };

  // Test uyarısı oluşturmak için
  const handleCreateTestAlert = async () => {
    try {
      console.log("Test uyarısı oluşturma isteği gönderiliyor...");
      const response = await fetch(`${API_URL}/test-alert`);
      if (!response.ok) {
        throw new Error(`HTTP hata! Status: ${response.status}`);
      }
      const data = await response.json();
      console.log("Test uyarısı yanıtı:", data);
      
      // Birkaç saniye sonra frontend'i güncelle
      setTimeout(() => {
        fetchSensors();
      }, 1000);
    } catch (error) {
      console.error("Test uyarısı oluşturulurken hata:", error);
      setNotification({
        open: true,
        message: "Test uyarısı oluşturulamadı",
        severity: "error"
      });
    }
  };

  useEffect(() => {
    if (!selectedSensor) {
      setForecastTable([]);
      setForecastStats({ min: 0, max: 0, avg: 0 });
      return;
    }
    // Anlık sensör değerleriyle 24 saatlik tahmin üret (sabit)
    const now = new Date();
    const value = selectedSensor.aqi || 0;
    const forecast = [];
    for (let i = 1; i <= 24; i++) {
      const hour = new Date(now.getTime() + i * 60 * 60 * 1000).getHours().toString().padStart(2, '0') + ':00';
      // ±%5 varyasyon, sabit seed için Math.sin kullan
      const variation = value * (1 + (Math.sin(i * 7 + value) * 0.05));
      forecast.push({ hour, value: Math.round(variation * 10) / 10 });
    }
    const min = Math.min(...forecast.map(f => f.value));
    const max = Math.max(...forecast.map(f => f.value));
    const avg = Math.round(forecast.reduce((a, b) => a + b.value, 0) / forecast.length * 10) / 10;
    setForecastTable(forecast);
    setForecastStats({ min, max, avg });
  }, [selectedSensor]);

  // Uyarılar değiştiğinde localStorage'a kaydet
  useEffect(() => {
    // Alerts 50'den fazlaysa, en eski uyarıları kaldır
    const limitedAlerts = alerts.slice(0, 50);
    localStorage.setItem('havaQualityAlerts', JSON.stringify(limitedAlerts));
    console.log(`${limitedAlerts.length} uyarı localStorage'a kaydedildi`);
  }, [alerts]);

  // WebSocket bağlantısını yeniden başlat
  const reconnectWebSocket = () => {
    if (wsRef.current) {
      console.log('WebSocket bağlantısı kapatılıyor...');
      wsRef.current.close();
    }
    
    console.log("WebSocket bağlantısı yeniden kuruluyor...");
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;
    
    ws.onopen = () => {
      console.log('WebSocket bağlantısı başarılı');
      setWsConnected(true);
      setWsRetryCount(0);
      setNotification({
        open: true,
        message: 'Gerçek zamanlı uyarı sistemine bağlandı',
        severity: 'success'
      });
    };
    
    ws.onmessage = (event) => {
      try {
        console.log('WebSocket mesajı alındı:', event.data);
        const data = JSON.parse(event.data);
        
        // Ping mesajlarını kontrol et
        if (data.type === 'ping') {
          console.log('Ping alındı, bağlantı aktif');
          ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
          return;
        } else if (data.type === 'connection_established') {
          console.log('Bağlantı kuruldu mesajı alındı');
          return;
        }
        
        console.log('Yeni uyarı alındı:', data);
        
        // Uyarı bilgilerini kontrol et
        if (!data.id) {
          console.warn('Gelen mesajda ID bilgisi yok, atlanıyor', data);
          return;
        }
        
        // Aynı ID'li uyarı varsa güncelle, yoksa ekle
        setAlerts(prevAlerts => {
          // Aynı ID'li alert zaten var mı diye kontrol et
          const existingAlertIndex = prevAlerts.findIndex(alert => alert.id === data.id);
          
          // Yeni zaman damgası
          const now = new Date().toISOString();
          
          if (existingAlertIndex > -1) {
            // Varsa güncelle
            const updatedAlerts = [...prevAlerts];
            updatedAlerts[existingAlertIndex] = {
              ...data,
              // Gelmeyen alanlar için varsayılan değerler
              timestamp: data.timestamp || now,
              message: data.message || 'Uyarı detayı yok',
              severity: data.severity || 'medium',
            };
            console.log(`Mevcut uyarı güncellendi, ID: ${data.id}`);
            return updatedAlerts;
          } else {
            // Yoksa ekle
            const newAlert = {
              ...data,
              // Gelmeyen alanlar için varsayılan değerler
              timestamp: data.timestamp || now,
              message: data.message || 'Uyarı detayı yok',
              severity: data.severity || 'medium',
            };
            console.log(`➕ Yeni uyarı eklendi, ID: ${data.id}`);
            
            // Maksimum 100 uyarı sakla, en yeniler önce
            const result = [newAlert, ...prevAlerts].slice(0, 100);
            return result;
          }
        });
        
        // Bildirim göster
        if (data.title) {
          setNotification({
            open: true,
            message: `Yeni uyarı: ${data.title}`,
            severity: data.severity === 'high' ? 'error' : data.severity === 'medium' ? 'warning' : 'info'
          });
        }
        
        // Yeni uyarı geldiğinde sensör verilerini güncelle
        fetchSensors();
      } catch (error) {
        console.error('WebSocket mesajı işlenirken hata:', error);
      }
    };
    
    ws.onclose = (event) => {
      console.log(`WebSocket bağlantısı kapandı: ${event.code}`, event);
      setWsConnected(false);
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket hatası:', error);
    };
  };

  // Dashboard içeriği
  const renderDashboard = () => (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      {/* WebSocket Bağlantı Durumu ve Test Butonu */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <WebSocketIndicator 
          connected={wsConnected} 
          retryCount={wsRetryCount} 
          lastUpdated={selectedSensor?.timestamp ? new Date(selectedSensor.timestamp) : null} 
        />
        <Box sx={{ display: 'flex', gap: 2 }}>
          <button 
            onClick={reconnectWebSocket}
            style={{ 
              padding: '8px 16px',
              backgroundColor: '#4caf50',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            WS Bağlantısını Yenile
          </button>
          <button 
            onClick={handleCreateTestAlert}
            style={{ 
              padding: '8px 16px',
              backgroundColor: '#1976d2',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Uyarı Sistemini Test Et
          </button>
        </Box>
      </Box>
      
      <Grid container spacing={3}>
        {/* Harita ve İstasyon Seçimi */}
        <Grid item xs={12} md={8}>
          <MapContainer>
            <Map 
              sensors={sensors}
              selectedSensor={selectedSensor}
              onSensorClick={handleSensorClick}
              mapboxToken={MAPBOX_TOKEN}
            />
          </MapContainer>
        </Grid>
        
        {/* Uyarılar */}
        <Grid item xs={12} md={4}>
          <AlertContainer>
            <AlertPanel 
              alerts={alerts} 
              selectedSensor={selectedSensor}
              onClear={handleClearAlert}
            />
          </AlertContainer>
        </Grid>
        
        {/* Şehir ve Bölgesel AQI Verileri Satırı */}
        <Grid item xs={12}>
          <Grid container spacing={3}>
            {/* Bölgesel Hava Kalitesi Haritası */}
            <Grid item xs={12} md={6} lg={4}>
              <HeatmapIndicator 
                selectedCity={selectedSensor} 
                selectedRegionSensors={selectedRegionSensors}
              />
            </Grid>
            
            {/* Sağlık Etkileri ve Öneriler */}
            <Grid item xs={12} md={6} lg={4}>
              <HealthEffectsPanel aqi={selectedSensor?.aqi || '0'} />
            </Grid>
            
            {/* Tahmin Analizi */}
            <Grid item xs={12} lg={4}>
              <Paper sx={{ p: 2, borderRadius: '8px', bgcolor: '#f8f8f8', height: '100%' }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                  Seçili İstasyonun 24 Saatlik Tahmini
                </Typography>
                {selectedSensor ? (
                  <>
                    <Box sx={{ mb: 2, display: 'flex', gap: 2 }}>
                      <Box sx={{ flex: 1, p: 1, bgcolor: '#fff', borderRadius: 2, textAlign: 'center', boxShadow: 1 }}>
                        <Typography variant="body2" color="text.secondary">En Düşük</Typography>
                        <Typography variant="h6" color="primary.main">{forecastStats.min}</Typography>
                      </Box>
                      <Box sx={{ flex: 1, p: 1, bgcolor: '#fff', borderRadius: 2, textAlign: 'center', boxShadow: 1 }}>
                        <Typography variant="body2" color="text.secondary">Ortalama</Typography>
                        <Typography variant="h6" color="primary.main">{forecastStats.avg}</Typography>
                      </Box>
                      <Box sx={{ flex: 1, p: 1, bgcolor: '#fff', borderRadius: 2, textAlign: 'center', boxShadow: 1 }}>
                        <Typography variant="body2" color="text.secondary">En Yüksek</Typography>
                        <Typography variant="h6" color="primary.main">{forecastStats.max}</Typography>
                      </Box>
                    </Box>
                    <TableContainer sx={{ maxHeight: 320, bgcolor: '#fff', borderRadius: 2, boxShadow: 1 }}>
                      <Table size="small" stickyHeader>
                        <TableHead>
                          <TableRow>
                            <TableCell>Saat</TableCell>
                            <TableCell>Tahmini AQI</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {forecastTable.map((row, idx) => (
                            <TableRow key={idx}>
                              <TableCell>{row.hour}</TableCell>
                              <TableCell>{row.value}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </>
                ) : (
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '150px', color: 'text.secondary' }}>
                    <span>İstasyon seçin</span>
                  </Box>
                )}
              </Paper>
            </Grid>
          </Grid>
        </Grid>
        
        {/* Parametre Bilgileri */}
        <Grid item xs={12} md={4}>
          <ParameterInfo />
        </Grid>
        
        {/* Detaylı Grafikler */}
        <Grid item xs={12} md={8}>
          <ChartContainer>
            {selectedSensor ? (
              <EnhancedAirQualityCharts 
                airQualityData={airQualityData}
                selectedCity={selectedSensor}
                selectedRegionData={selectedRegionData}
                wsConnected={wsConnected}
                selectedRegionSensors={selectedRegionSensors}
              />
            ) : (
              <Box sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                height: '300px',
                color: 'text.secondary'
              }}>
                <Typography variant="body1">
                  Detaylı grafikler için haritadan bir istasyon seçin
                </Typography>
              </Box>
            )}
          </ChartContainer>
        </Grid>
      </Grid>
    </Container>
  );

  return (
    <Container maxWidth="xl">
      {/* Başlık */}
      <Typography variant="h4" component="h1" gutterBottom sx={{ mt: 3 }}>
        Hava Kalitesi İzleme Sistemi
      </Typography>
      
      {/* Alerts state'ini kontrol et */}
      {console.log("App.js render sırasında alerts:", alerts)}
      {console.log("Alerts state uzunluğu:", alerts.length)}
      
      {/* Tablar */}
      <Paper sx={{ mb: 3 }}>
        <Tabs 
          value={activeTab} 
          onChange={handleChangeTab} 
          variant="fullWidth"
          textColor="primary"
          indicatorColor="primary"
        >
          <Tab label="Ana Sayfa" />
          <Tab label="Manuel Veri Girişi" />
        </Tabs>
      </Paper>
      
      {/* Tab içeriği */}
      {activeTab === 0 ? renderDashboard() : <ManualInput onDataSubmitted={() => {
        // Manuel veri girişi yapıldıktan sonra verileri güncelle
        console.log("Manuel veri girişi yapıldı, veriler güncelleniyor...");
        
        // Önce sensörleri ve verileri güncelleyelim
        fetchSensors();
        fetchAirQualityData();
        
        // WebSocket bağlantısını kontrol et
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          console.log("WebSocket bağlantısı aktif, test uyarısı isteniyor...");
          // Test uyarısı iste - yeni verilerin uyarı oluşturup oluşturmadığını kontrol etmek için
          fetch(`${API_URL}/test-alert`).catch(err => {
            console.error("Test uyarısı alınamadı:", err);
          });
        } else {
          console.log("WebSocket bağlantısı kesilmiş, yeniden bağlanılıyor...");
          reconnectWebSocket();
        }
        
        // Kullanıcıya bildirim göster
        setNotification({
          open: true,
          message: "Veriler güncellendi! Uyarı panelini kontrol edin",
          severity: "success"
        });
      }} />}
      
      {/* Bildirimler */}
      <Snackbar 
        open={notification.open} 
        autoHideDuration={6000} 
        onClose={handleCloseNotification}
      >
        <Alert onClose={handleCloseNotification} severity={notification.severity}>
          {notification.message}
        </Alert>
      </Snackbar>
    </Container>
  );
}

export default App; 
