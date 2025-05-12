import React from 'react';
import { Grid, Paper, Typography, Box, CircularProgress, Chip } from '@mui/material';
import AirQualityChart from './AirQualityChart';
import { calculateAQILevel } from '../utils/aqi';
import WifiIcon from '@mui/icons-material/Wifi';
import WifiOffIcon from '@mui/icons-material/WifiOff';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import WarningIcon from '@mui/icons-material/Warning';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import HeatmapIndicator from './HeatmapIndicator';

const EnhancedAirQualityCharts = ({ 
  airQualityData, 
  selectedCity, 
  selectedRegionData,
  wsConnected = false,
  selectedRegionSensors = []
}) => {
  // İstasyon değişimini takip etmek için, seçilen şehrin adını loglayalım
  console.log(`[DEBUG] EnhancedAirQualityCharts - Seçili şehir: ${selectedCity?.name || 'Seçili şehir yok'}`);
  console.log(`[DEBUG] EnhancedAirQualityCharts - Bölgesel veri sayısı: ${selectedRegionData?.length || 0}`);
  
  // Veri değiştiğinde son güncelleme zamanını API'den gelen veriye göre ayarla
  const [lastUpdateTime, setLastUpdateTime] = React.useState(null);
  
  // Güncelleme durumunu göstermek için state
  const [dataStatus, setDataStatus] = React.useState({
    isUpdating: false,
    lastUpdateResult: null // 'success', 'error', null
  });
  
  // Şehir değiştiğinde tüm grafikler için yeniden render tetiklensin
  const chartResetKey = React.useMemo(() => {
    return selectedCity ? `city-${selectedCity.name || selectedCity.id || Date.now()}` : 'no-city';
  }, [selectedCity]);
  
  // Veri değiştiğinde son güncelleme zamanını ayarla
  React.useEffect(() => {
    // Son güncellenme zamanını API verisi üzerinden al
    if (selectedRegionData?.length > 0) {
      const lastDataPoint = selectedRegionData[selectedRegionData.length - 1];
      if (lastDataPoint && lastDataPoint.timestamp) {
        try {
          let timestamp;
          // ISO formatı kontrolü
          if (typeof lastDataPoint.timestamp === 'string' && lastDataPoint.timestamp.includes('T')) {
            timestamp = new Date(lastDataPoint.timestamp);
          } else if (typeof lastDataPoint.timestamp === 'number' || !isNaN(parseInt(lastDataPoint.timestamp))) {
            // Unix timestamp kontrolü (sayı ise)
            timestamp = new Date(parseInt(lastDataPoint.timestamp));
          } else {
            // Standart tarih string'i
            timestamp = new Date(lastDataPoint.timestamp);
          }
          
          if (!isNaN(timestamp.getTime())) {
            setLastUpdateTime(timestamp);
          } else {
            setLastUpdateTime(new Date()); // Geçersiz tarih durumunda şu anki zamanı kullan
          }
        } catch (err) {
          console.warn("Geçersiz timestamp formatı:", lastDataPoint.timestamp);
          setLastUpdateTime(new Date()); // Fallback olarak şu anki zamanı kullan
        }
      } else {
        setLastUpdateTime(new Date());
      }
    } else if (selectedCity) {
      // İstasyon seçili ama veri yok, şu anki zamanı kullan
      setLastUpdateTime(new Date());
    }
    
    setDataStatus({
      isUpdating: false,
      lastUpdateResult: 'success'
    });
    
    // 3 saniye sonra güncelleme durumunu temizle
    const timer = setTimeout(() => {
      setDataStatus(prev => ({
        ...prev,
        lastUpdateResult: null
      }));
    }, 3000);
    
    return () => clearTimeout(timer);
  }, [airQualityData, selectedRegionData, selectedCity]);

  // WHO standartları
  const whoStandards = {
    pm25: 10, // μg/m³ (24-saat ortalama)
    pm10: 20, // μg/m³ (24-saat ortalama)
    no2: 25,  // μg/m³ (24-saat ortalama)
    so2: 40,  // μg/m³ (24-saat ortalama)
    o3: 100   // μg/m³ (8-saat ortalama)
  };

  // Parametre etiketleri
  const parameterLabels = {
    pm25: 'PM2.5 (μg/m³)',
    pm10: 'PM10 (μg/m³)',
    no2: 'NO₂ (μg/m³)',
    so2: 'SO₂ (μg/m³)',
    o3: 'O₃ (μg/m³)',
    aqi: 'AQI'
  };

  // Seçili şehrin son verisini al
  const currentCityData = React.useMemo(() => {
    if (selectedCity && selectedRegionData?.length > 0) {
      return selectedRegionData[selectedRegionData.length - 1];
    } else if (selectedCity) {
      // Sensör verisi olarak direk şehir verilerini kullan
      return selectedCity;
    }
    return null;
  }, [selectedCity, selectedRegionData]);

  // AQI seviyesini hesapla
  const aqiLevel = React.useMemo(() => {
    if (currentCityData) {
      return calculateAQILevel(currentCityData.aqi || 0);
    }
    return null;
  }, [currentCityData]);

  // Veri yükleme durumunu kontrol et
  const isLoading = !airQualityData || (selectedCity && !selectedRegionData);
  
  // Bölgesel veri yoksa bile sensör verisi varsa veri var olarak kabul et
  const hasData = selectedCity 
    ? (selectedRegionData?.length > 0 || Object.keys(selectedCity).length > 0) 
    : airQualityData?.length > 0;

  // Güncel ölçüm verilerini göstermek için debug amaçlı log 
  if (currentCityData) {
    console.log("Şehir verisi:", currentCityData);
    console.log("Ölçümler - PM2.5:", currentCityData.pm25, "PM10:", currentCityData.pm10, "NO2:", currentCityData.no2, "SO2:", currentCityData.so2, "O3:", currentCityData.o3);
  } else if (selectedCity) {
    console.log("Bölgesel veri yok, sensör verisi kullanılıyor:", selectedCity);
  }

  // Veri durumunu da görelim
  console.log("Veri Durum Kontrolü:", { 
    isLoading, 
    hasData, 
    selectedCity: !!selectedCity, 
    selectedRegionDataLength: selectedRegionData?.length || 0,
    airQualityDataLength: airQualityData?.length || 0,
    sensorHasData: selectedCity ? Object.keys(selectedCity).length > 0 : false
  });
  
  // WHO Standartları bileşenimizi ayrı bir fonksiyon olarak tanımlayalım
  const renderWHOStandards = () => {
    if (!selectedCity && !currentCityData) return null;

    return (
      <Paper sx={{ p: 3, borderRadius: '12px', boxShadow: '0 2px 6px rgba(0, 0, 0, 0.04)', border: '1px solid #f0f0f0', mb: 2, mt: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" sx={{ 
            fontWeight: 600, 
            fontSize: '1.125rem',
            fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif',
            color: '#000',
            letterSpacing: '-0.01rem'
          }}>
            WHO Standartları Karşılaştırması
          </Typography>
          <Chip 
            icon={<WarningIcon />} 
            label="Sağlık Durumu" 
            color="primary" 
            size="small"
            sx={{ fontWeight: 500 }}
          />
        </Box>
        
        <Grid container spacing={2}>
          {Object.entries(whoStandards).map(([param, standardValue]) => {
            // Değeri güvenli bir şekilde al ve sayıya dönüştür
            let currentValue = 0;
            if (currentCityData && currentCityData[param] !== undefined) {
              currentValue = parseFloat(currentCityData[param]);
              if (isNaN(currentValue)) currentValue = 0;
            }
            
            const ratio = standardValue > 0 ? currentValue / standardValue : 0;
            const isExceeded = ratio > 1;
            
            // Tehlike seviyesini belirle
            let dangerLevel = "safe"; // Güvenli
            let barColor = '#4caf50'; // Yeşil
            let statusText = "Güvenli";
            let barWidth = `${Math.min(ratio * 100, 100)}%`;
            
            if (ratio > 3) {
              dangerLevel = "very-dangerous"; // Çok tehlikeli
              barColor = '#d32f2f'; // Koyu kırmızı
              statusText = "Çok Tehlikeli";
            } else if (ratio > 2) {
              dangerLevel = "dangerous"; // Tehlikeli
              barColor = '#f44336'; // Kırmızı
              statusText = "Tehlikeli";
            } else if (ratio > 1.5) {
              dangerLevel = "warning"; // Uyarı
              barColor = '#ff5722'; // Turuncu kırmızı
              statusText = "Yüksek Risk";
            } else if (ratio > 1) {
              dangerLevel = "alert"; // Alarm
              barColor = '#ff9800'; // Turuncu
              statusText = "Risk";
            }
            
            // Trend ikonu - basit tahmin
            const TrendIcon = ratio > 1.2 ? TrendingUpIcon : TrendingDownIcon;
            
            return (
              <Grid item xs={12} key={param}>
                <Box sx={{ mb: 1 }}>
                  <Box sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    mb: 0.5
                  }}>
                    <Typography variant="body2" sx={{ 
                      fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif',
                      fontSize: '0.875rem',
                      fontWeight: 500
                    }}>
                      {parameterLabels[param] || param}
                    </Typography>
                    <Box sx={{
                      display: 'flex',
                      alignItems: 'center'
                    }}>
                      <Typography variant="body2" sx={{ 
                        fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif',
                        fontSize: '0.875rem',
                        mr: 1
                      }}>
                        <strong>{currentValue.toFixed(1)}</strong> / {standardValue} μg/m³
                      </Typography>
                      {isExceeded && (
                        <Box sx={{
                          backgroundColor: barColor,
                          color: 'white',
                          borderRadius: '4px',
                          px: 1,
                          py: 0.3,
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          {statusText}
                          <TrendIcon fontSize="small" />
                        </Box>
                      )}
                    </Box>
                  </Box>
                  <Box sx={{ 
                    width: '100%', 
                    bgcolor: '#f5f5f5', 
                    height: 10, 
                    borderRadius: '5px',
                    overflow: 'hidden'
                  }}>
                    <Box 
                      sx={{ 
                        width: barWidth,
                        bgcolor: barColor, 
                        height: '100%', 
                        borderRadius: '5px',
                        transition: 'width 1s ease-in-out'
                      }} 
                    />
                  </Box>
      </Box>
              </Grid>
            );
          })}
        </Grid>
      </Paper>
    );
  };

  // İçerik renderlanması
  const renderContent = () => {
  if (!hasData) {
    return (
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          height: '300px',
          color: 'text.secondary'
        }}>
          <Typography variant="body1">
            Veri bulunamadı. Lütfen başka bir istasyon seçin veya daha sonra tekrar deneyin.
        </Typography>
      </Box>
    );
  }

  return (
      <>
        {/* Üst Bilgi Panosu */}
        <Box sx={{ 
          mb: 3, 
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          alignItems: 'flex-start',
          gap: 2,
          p: 2,
          borderRadius: '10px',
          bgcolor: 'background.paper',
          border: '1px solid',
          borderColor: 'divider',
          boxShadow: '0 2px 4px rgba(0,0,0,0.04)'
        }}>
          {/* Şehir ve AQI Bilgisi */}
          <Box sx={{ flex: 1 }}>
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between' 
            }}>
              <Typography variant="h5" sx={{ 
                fontWeight: 700, 
                fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif',
                fontSize: '1.35rem',
                letterSpacing: '-0.01rem'
              }}>
                {selectedCity?.name || 'İstasyon'}
              </Typography>
              <Chip 
                label={`AQI: ${currentCityData?.aqi || 'N/A'}`}
                variant="filled"
                sx={{ 
                  fontWeight: 600, 
                  fontSize: '0.875rem',
                  height: 28,
                  bgcolor: aqiLevel?.bgColor || '#f5f5f5',
                  color: aqiLevel?.textColor || '#666666',
                  '& .MuiChip-label': {
                    px: 1.5
                  }
                }}
              />
            </Box>
            
            <Typography variant="body2" sx={{ 
              color: 'text.secondary', 
              display: 'flex', 
              alignItems: 'center',
              gap: 0.5,
              mt: 0.5
            }}>
              <AccessTimeIcon sx={{ fontSize: 14 }} />
              Son Güncelleme: {lastUpdateTime ? `${lastUpdateTime.toLocaleTimeString('tr-TR')}` : 'Bilinmiyor'}
              {wsConnected && <WifiIcon sx={{ fontSize: 14, ml: 1, color: 'success.main' }} />}
              {!wsConnected && <WifiOffIcon sx={{ fontSize: 14, ml: 1, color: 'error.main' }} />}
                  </Typography>
            
            <Box sx={{ display: 'flex', flexWrap: 'wrap', mt: 1.5, gap: 1 }}>
              {Object.entries({
                pm25: 'PM2.5',
                pm10: 'PM10',
                no2: 'NO₂',
                so2: 'SO₂',
                o3: 'O₃'
              }).map(([key, label]) => {
                let value = currentCityData ? currentCityData[key] : undefined;
                if (value !== undefined) {
                  value = parseFloat(value);
                  if (isNaN(value)) value = 0;
                }
                
                const isHighValue = whoStandards[key] && value > whoStandards[key];
                
                return (
                  <Chip
                    key={key}
                    size="small"
                    variant="outlined"
                    label={`${label}: ${value !== undefined ? `${Math.round(value)} μg/m³` : 'N/A'}`}
                    sx={{
                      borderColor: isHighValue ? 'error.light' : 'divider',
                      color: isHighValue ? 'error.dark' : 'text.primary',
                      '& .MuiChip-label': {
                        px: 1,
                        fontSize: '0.75rem'
                      }
                    }}
                  />
                );
              })}
            </Box>
          </Box>
          
          {/* Seviye bilgisi */}
          {aqiLevel && (
            <Box sx={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center',
              px: 2,
              py: 1,
              borderRadius: '8px',
              bgcolor: aqiLevel.bgColor || '#f5f5f5',
              minWidth: '160px'
            }}>
              <Typography variant="subtitle2" sx={{ 
                fontWeight: 700, 
                color: aqiLevel.textColor || 'text.primary',
                mb: 0.5
              }}>
                {aqiLevel.label}
                  </Typography>
              <Typography variant="caption" sx={{ 
                textAlign: 'center',
                color: aqiLevel.textColor || 'text.secondary' 
              }}>
                {aqiLevel.description}
                  </Typography>
            </Box>
          )}
        </Box>
        
        {/* WHO Standartları Karşılaştırması */}
        {renderWHOStandards()}
        
        {/* Ana Grafikler */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" sx={{ 
            fontWeight: 600, 
            fontSize: '1.1rem',
            mb: 2
          }}>
            24 Saatlik Hava Kalitesi Değişimi
                  </Typography>
          
          <Paper sx={{ 
            p: 0,
            borderRadius: '12px', 
            overflow: 'hidden', 
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)', 
            border: '1px solid #f0f0f0',
            height: '400px'
          }}>
            <AirQualityChart
              airQualityData={airQualityData}
              selectedRegionData={selectedRegionData}
              title="Zaman Bazlı Değişim"
              showMultipleParameters={['pm25', 'pm10', 'no2', 'so2', 'o3']}
              key={`multi-param-${chartResetKey}`}
            />
          </Paper>
        </Box>
        
        {/* Alt Grafikler */}
        <Grid container spacing={3}>
          {/* AQI Grafiği */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ 
              p: 2,
              borderRadius: '12px', 
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)', 
              border: '1px solid #f5f5f5'
            }}>
              <Typography variant="subtitle1" sx={{ 
                fontWeight: 600, 
                mb: 1
              }}>
                Hava Kalitesi İndeksi (AQI)
              </Typography>
              
              <AirQualityChart
                airQualityData={airQualityData}
                selectedRegionData={selectedRegionData}
              defaultParameter="aqi"
                key={`aqi-${chartResetKey}`}
            />
            </Paper>
          </Grid>
          
          {/* Partikül Madde Grafiği */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ 
              p: 2,
              borderRadius: '12px', 
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)', 
              border: '1px solid #f5f5f5'
            }}>
              <Typography variant="subtitle1" sx={{ 
                fontWeight: 600, 
                mb: 1
              }}>
                Partikül Madde (PM)
              </Typography>
              
            <AirQualityChart
              airQualityData={airQualityData}
              selectedRegionData={selectedRegionData}
              showMultipleParameters={['pm25', 'pm10']}
              includeWHOStandards={true}
                whoStandards={{
                  pm25: 15, // 24 saatlik WHO standardı
                  pm10: 45  // 24 saatlik WHO standardı
                }}
                key={`pm-${chartResetKey}`}
            />
            </Paper>
          </Grid>
          
          {/* Gaz Kirleticiler Grafiği */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ 
              p: 2,
              borderRadius: '12px', 
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)', 
              border: '1px solid #f5f5f5'
            }}>
              <Typography variant="subtitle1" sx={{ 
                fontWeight: 600, 
                mb: 1
              }}>
                Gaz Kirleticiler (NO₂, SO₂)
              </Typography>
              
            <AirQualityChart
              airQualityData={airQualityData}
              selectedRegionData={selectedRegionData}
                showMultipleParameters={['no2', 'so2']}
              includeWHOStandards={true}
                whoStandards={{
                  no2: 25, // 24 saatlik WHO standardı
                  so2: 40  // 24 saatlik WHO standardı
                }}
                key={`gas-${chartResetKey}`}
              />
            </Paper>
          </Grid>
          
          {/* Ozon Grafiği */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ 
              p: 2, 
              borderRadius: '12px', 
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)', 
              border: '1px solid #f5f5f5'
            }}>
              <Typography variant="subtitle1" sx={{ 
                fontWeight: 600, 
                mb: 1
              }}>
                Ozon (O₃)
              </Typography>
              
            <AirQualityChart
              airQualityData={airQualityData}
                selectedRegionData={selectedRegionData}
                defaultParameter="o3"
                includeWHOStandards={true}
                whoStandards={{
                  o3: 100 // 8 saatlik WHO standardı
                }}
                key={`ozone-${chartResetKey}`}
            />
            </Paper>
          </Grid>
          </Grid>
        </>
    );
  };

  return (
    <div>
      {isLoading ? (
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          minHeight: '300px'
        }}>
          <CircularProgress />
        </Box>
      ) : (
        renderContent()
      )}
    </div>
  );
};

export default React.memo(EnhancedAirQualityCharts); 