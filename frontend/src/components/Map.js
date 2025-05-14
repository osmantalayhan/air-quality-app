import React, { useRef, useEffect, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { styled } from '@mui/material/styles';
import { FormControlLabel, Switch, Box, Typography, Select, MenuItem, FormControl, InputLabel } from '@mui/material';

// Mapbox API anahtarı
mapboxgl.accessToken = '{mapbox_token}';

const MapContainer = styled('div')({
  height: '100%',
  width: '100%',
  position: 'relative',
  minHeight: '400px',
  '& .mapboxgl-map': {
    height: '100%',
    width: '100%',
  },
});

const MapControls = styled(Box)(({ theme }) => ({
  position: 'absolute',
  top: 10,
  right: 10,
  zIndex: 1,
  backgroundColor: 'rgba(255, 255, 255, 0.9)',
  padding: theme.spacing(1.5),
  borderRadius: 8,
  boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
  minWidth: '200px',
}));

const Map = ({ sensors = [], onSensorClick }) => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const markersRef = useRef([]);
  const [mapInitialized, setMapInitialized] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showMarkers, setShowMarkers] = useState(true);
  const [mapView, setMapView] = useState('turkey'); // 'turkey', 'istanbul', 'world', 'all'
  const [zoom, setZoom] = useState(5);
  const [center, setCenter] = useState([35.24, 38.95]);

  // Harita görünümünü değiştir
  const changeMapView = (view) => {
    setMapView(view);
    
    if (view === 'turkey') {
      setCenter([35.24, 38.95]);
      setZoom(5);
    } else if (view === 'istanbul') {
      setCenter([29.0, 41.0]);
      setZoom(10);
    } else if (view === 'world') {
      setCenter([0, 30]);
      setZoom(2);
    } else if (view === 'all') {
      setCenter([35.24, 38.95]);
      setZoom(4);
    }
    
    if (map.current && mapInitialized) {
      map.current.flyTo({
        center: center,
        zoom: zoom,
        duration: 2000
      });
    }
  };

  // İlk render'da haritayı oluştur
  useEffect(() => {
    if (map.current) return; // Harita zaten oluşturulmuşsa, yeniden oluşturmaz
    
    // Mapbox haritası oluştur
    if (mapContainer.current) {
      try {
        console.log("Harita oluşturuluyor...");
        
        map.current = new mapboxgl.Map({
          container: mapContainer.current,
          style: 'mapbox://styles/mapbox/dark-v11', // harita temasıı
          center: center,
          zoom: zoom,
          attributionControl: true // Mapbox atıfını göster
        });

        // Navigasyon kontrollerini ekle
        map.current.addControl(new mapboxgl.NavigationControl());
        
        // Harita yüklendiğinde günlüğe yaz ve state'i güncelle
        map.current.on('load', () => {
          console.log("Harita yüklendi!");
          
          // Isı haritası kaynağını ekle
          map.current.addSource('air-quality-heat', {
            'type': 'geojson',
            'data': {
              'type': 'FeatureCollection',
              'features': []
            }
          });
          
          // Isı haritası katmanını ekle
          map.current.addLayer({
            'id': 'air-quality-heat-layer',
            'type': 'heatmap',
            'source': 'air-quality-heat',
            'paint': {
              // Isı yoğunluğu - zoom seviyesinden bağımsız olarak sabit tutuldu
              'heatmap-intensity': [
                'interpolate', ['linear'], ['zoom'],
                0, 0.6, // Uzaktayken daha yüksek yoğunluk
                5, 0.6, // Orta zoom'da sabit
                9, 0.6  // Yakında da sabit yoğunluk
              ],
              'heatmap-color': [
                'interpolate', ['linear'], ['heatmap-density'],
                0, 'rgba(0, 228, 0, 0)',      // Şeffaf (İyi)
                0.2, 'rgba(0, 228, 0, 0.7)',  // Yeşil (İyi)
                0.4, 'rgba(255, 255, 0, 0.7)', // Sarı (Orta)
                0.6, 'rgba(255, 126, 0, 0.7)', // Turuncu (Hassas)
                0.8, 'rgba(255, 0, 0, 0.7)',   // Kırmızı (Sağlıksız)
                1.0, 'rgba(153, 0, 76, 0.7)'   // Mor (Çok sağlıksız)
              ],
              // Isı haritası yarıçapı - zoom'a göre uyarlandı ama daha dengeli
              'heatmap-radius': [
                'interpolate', ['linear'], ['zoom'],
                0, 20,
                5, 30,
                9, 40
              ],
              'heatmap-opacity': 0.8,
              'heatmap-weight': [
                'interpolate', ['linear'], ['get', 'aqi'],
                0, 0,      // 0 AQI = 0 ağırlık
                50, 0.4,   // İyi = hafif ağırlık (yeşil)
                100, 0.6,  // Orta = orta ağırlık (sarı)
                150, 0.8,  // Hassas = yüksek ağırlık (turuncu)  
                200, 1.0,  // Sağlıksız = tam ağırlık (kırmızı)
                300, 1.5   // Çok sağlıksız = ekstra vurgu (mor)
              ]
            },
            'layout': {
              'visibility': 'visible'
            }
          });
          
          setMapInitialized(true);
          
          updateMapData();
          
          startHeatmapAnimation();
        });
        
        map.current.on('error', (e) => {
          console.error("Harita hatası:", e);
        });
      } catch (error) {
        console.error("Harita başlatılırken hata:", error);
      }
    }

    return () => {
      if (markersRef.current) {
        markersRef.current.forEach(marker => marker.remove());
        markersRef.current = [];
      }
      
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [center, zoom]);

  const startHeatmapAnimation = () => {
    let animationFrame;
    let lastTime = 0;
    
    const animate = (currentTime) => {
      if (!map.current || !mapInitialized) {
        return;
      }
      
      if (currentTime - lastTime > 2000) {
        lastTime = currentTime;
        
        const source = map.current.getSource('air-quality-heat');
        if (source) {
          const data = map.current.getSource('air-quality-heat')._data;
          
          if (data && data.features && data.features.length > 0) {
            // Veri noktalarında sadece koordinat değişikliği yap, AQI değerini değiştirme
            const animatedFeatures = data.features.map(feature => {
              // Klon özellik ve koordinatları
              const newFeature = {...feature};
              
              newFeature.properties = {...feature.properties};
              
              // Bu, ısı haritasının hafifçe dalgalanmasını sağlar
              if (feature.geometry && feature.geometry.type === 'Point') {
                const tinyLatVariation = (Math.random() * 0.002) - 0.001;
                const tinyLngVariation = (Math.random() * 0.002) - 0.001;
                
                newFeature.geometry = {
                  ...feature.geometry,
                  coordinates: [
                    feature.geometry.coordinates[0] + tinyLngVariation,
                    feature.geometry.coordinates[1] + tinyLatVariation
                  ]
                };
              }
              
              return newFeature;
            });
            
            source.setData({
              type: 'FeatureCollection',
              features: animatedFeatures
            });
          }
        }
      }
      
      animationFrame = requestAnimationFrame(animate);
    };
    
    animationFrame = requestAnimationFrame(animate);
    
    return () => {
      cancelAnimationFrame(animationFrame);
    };
  };

  useEffect(() => {
    if (!map.current || !mapInitialized) return;
    
    map.current.flyTo({
      center: center,
      zoom: zoom,
      duration: 1500
    });
  }, [center, zoom, mapInitialized]);

  useEffect(() => {
    if (!map.current || !mapInitialized) return;
    
    const visibility = showHeatmap ? 'visible' : 'none';
    
    if (map.current.getLayer('air-quality-heat-layer')) {
      map.current.setLayoutProperty('air-quality-heat-layer', 'visibility', visibility);
    }
  }, [showHeatmap, mapInitialized]);

  // Harita görünümü değiştiğinde veri güncelleme
  useEffect(() => {
    if (!map.current || !mapInitialized) return;
    updateMapData();
  }, [mapView, mapInitialized, sensors]);

  // İşaretçi görünürlüğü değişince uygula
  useEffect(() => {
    if (!mapInitialized) return;
    
    markersRef.current.forEach(marker => {
      const element = marker.getElement();
      if (element) {
        element.style.display = showMarkers ? 'block' : 'none';
      }
    });
  }, [showMarkers, mapInitialized]);

  // Harita için gerekli verileri güncelle
  const updateMapData = () => {
    if (!map.current || !mapInitialized) return;
    
    // Mevcut işaretçileri temizle
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];
    
    // API'den gelen sensör verilerini kullan
    let locationData = [];
    
    // Sensör verilerinin olup olmadığını kontrol et
    if (sensors && sensors.length > 0) {
      // API sensörlerini locationData'ya ekle
      sensors.forEach(sensor => {
        // Koordinat bilgilerini kontrol et
        if (sensor.latitude && sensor.longitude) {
          locationData.push({
            name: sensor.location,
            lat: sensor.latitude,
            lng: sensor.longitude,
            aqi: sensor.aqi,
            pm25: sensor.pm25,
            pm10: sensor.pm10,
            no2: sensor.no2,
            so2: sensor.so2,
            o3: sensor.o3
          });
          console.log(`Sensör verisi eklendi: ${sensor.location}, Lat: ${sensor.latitude}, Lon: ${sensor.longitude}, AQI: ${sensor.aqi}`);
        } else {
          console.warn(`Sensör koordinatları eksik: ${sensor.location}`);
        }
      });
    } else {
      console.log("Uyarı: Sensör verisi bulunamadı.");
      // API'den veri gelmezse, haritayı boş bırak
      return;
    }
    
    // İstanbul'a veya dünyaya zoom yapıldığında sadece filtreleme yap
    if (mapView === 'istanbul') {
      locationData = locationData.filter(location => 
        location.lat > 40.7 && location.lat < 41.3 && 
        location.lng > 28.5 && location.lng < 29.5
      );
    } else if (mapView === 'world') {
      // Dünya görünümünde tüm sensörleri göster, filtreleme yapma
    } else if (mapView === 'turkey') {
      // Türkiye sınırları içindeki sensörleri filtrele
      locationData = locationData.filter(location => 
        location.lat > 36 && location.lat < 42 && 
        location.lng > 26 && location.lng < 45
      );
    } else if (mapView === 'all') {
      // 'Tümü' seçeneğinde hiçbir filtreleme yapma, tüm sensörleri göster
    }
    
    // Isı haritası için veri oluştur
    let heatmapFeatures = [];
    
    locationData.forEach(location => {
      heatmapFeatures.push({
        type: 'Feature',
        properties: {
          id: location.name,
          location: location.name,
          aqi: location.aqi
        },
        geometry: {
          type: 'Point',
          coordinates: [location.lng, location.lat]
        }
      });
      
      // Konum çevresinde farklı AQI değerlerine sahip noktalar oluşturarak ısı haritasını genişlet
      const baseRadius = 0.05;
      
      // İki farklı çember oluştur - biri yakın, diğeri daha uzak
      for (let ring = 0; ring < 2; ring++) {
        const radius = baseRadius * (ring + 1); // İlk halka: 0.05, ikinci halka: 0.1
        const points = ring === 0 ? 12 : 16; // İlk halkada 12, ikinci halkada 16 nokta
      
      for (let i = 0; i < points; i++) {
        const angle = (i / points) * Math.PI * 2;
          
          // Daha doğal görünmesi için hafif rastgelelik ekleyelim
          const variationFactor = 0.7 + Math.random() * 0.6; // 0.7 ile 1.3 arası
          
          const lng_offset = Math.cos(angle) * radius * variationFactor; 
          const lat_offset = Math.sin(angle) * radius * variationFactor;
        
          // İlk halka için daha yüksek değerler, ikinci halka için daha düşük
          let distance_factor;
          if (ring === 0) {
            // İlk halka - merkeze yakın
            distance_factor = 0.7 + Math.random() * 0.2; // 0.7 ile 0.9 arası
          } else {
            // İkinci halka - daha uzak
            distance_factor = 0.4 + Math.random() * 0.3; // 0.4 ile 0.7 arası
          }
          
          const adjusted_aqi = Math.max(20, Math.round(location.aqi * distance_factor));
        
        heatmapFeatures.push({
          type: 'Feature',
          properties: {
              id: `${location.name}-ring${ring}-${i}`,
            aqi: adjusted_aqi
          },
          geometry: {
            type: 'Point',
            coordinates: [location.lng + lng_offset, location.lat + lat_offset]
          }
        });
        }
      }
      
      if (location.aqi > 50) {
        const extraPoints = Math.min(10, Math.floor(location.aqi / 20));
        const extraRadius = baseRadius * 0.7;
        
        for (let i = 0; i < extraPoints; i++) {
          const angle = Math.random() * Math.PI * 2;
          const dist = Math.random() * extraRadius;
          
          const lng_offset = Math.cos(angle) * dist;
          const lat_offset = Math.sin(angle) * dist;
          
          // Bu ekstra noktalar daha yüksek AQI değerine sahip olsun
          const intensity_factor = 0.9 + Math.random() * 0.2;
          const extra_aqi = Math.min(300, Math.round(location.aqi * intensity_factor));
          
          heatmapFeatures.push({
            type: 'Feature',
            properties: {
              id: `${location.name}-extra-${i}`,
              aqi: extra_aqi
            },
            geometry: {
              type: 'Point',
              coordinates: [location.lng + lng_offset, location.lat + lat_offset]
            }
          });
        }
      }
      
      // İşaretçi ekle
      addMarker(location);
    });
    
    // Isı haritası verisi
    const heatmapData = {
      type: 'FeatureCollection',
      features: heatmapFeatures
    };
    
    // Isı haritası kaynağını güncelle
    if (map.current.getSource('air-quality-heat')) {
      map.current.getSource('air-quality-heat').setData(heatmapData);
    }
  };
  
  // İşaretçi ekle
  const addMarker = (location) => {
    if (!map.current || !mapInitialized) return null;
    
    try {
      // Sensör verilerini hazırla - doğru koordinatları al
      const lat = location.lat || 0;
      const lon = location.lng || 0;
      const aqi = Math.round(location.aqi || 0); // AQI değerini yuvarla
      const locationName = location.name || "Bilinmeyen";
      
      // Tüm ölçüm değerlerini al
      const pm25 = location.pm25 || 0;
      const pm10 = location.pm10 || 0;
      const no2 = location.no2 || 0;
      const so2 = location.so2 || 0;
      const o3 = location.o3 || 0;
      
      console.log(`Marker ekleniyor: ${locationName}, Lat: ${lat}, Lon: ${lon}, AQI: ${aqi}`);
      
      // AQI değerine göre renk kodu belirle - Doğru AQI değerini kullan
      const color = getAQIColor(aqi);
      const description = getAQIDescription(aqi);
      
      // Marker içeriğini hazırla - HTML öğesi
      const el = document.createElement('div');
      el.className = 'marker';
      el.style.width = '30px';
      el.style.height = '30px';
      el.style.borderRadius = '50%';
      el.style.background = color;
      el.style.border = '2px solid white';
      el.style.boxShadow = '0 0 10px rgba(0,0,0,0.5)';
      el.style.cursor = 'pointer';
      el.dataset.aqi = aqi; // AQI değerini veri özniteliği olarak ekle
      
      // Element başlık özniteliği ekle (hover olunca görünecek) - Tam AQI değeri göster
      el.title = `${locationName}: AQI ${Math.round(aqi)} (${description})`;
      
      // Popup içeriğini hazırla
      const popupContent = `
        <div style="font-family: Arial, sans-serif; padding: 5px;">
          <h4 style="margin-top: 0; margin-bottom: 8px; color: #333;">${locationName}</h4>
          <div style="display: flex; justify-content: center; margin-bottom: 10px;">
            <div style="text-align: center; padding: 8px 10px; border-radius: 5px; background-color: ${color}; color: white; font-weight: bold; min-width: 80px;">
              <div style="font-size: 20px;">${Math.round(aqi)}</div>
              <div style="font-size: 12px;">${description}</div>
            </div>
          </div>
          
          <div style="margin-top: 10px; border-top: 1px solid #eee; padding-top: 8px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
              <span style="font-weight: bold; color: #666;">PM2.5:</span>
              <span>${pm25.toFixed(1)} μg/m³</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
              <span style="font-weight: bold; color: #666;">PM10:</span>
              <span>${pm10.toFixed(1)} μg/m³</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
              <span style="font-weight: bold; color: #666;">NO₂:</span>
              <span>${no2.toFixed(1)} μg/m³</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
              <span style="font-weight: bold; color: #666;">SO₂:</span>
              <span>${so2.toFixed(1)} μg/m³</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="font-weight: bold; color: #666;">O₃:</span>
              <span>${o3.toFixed(1)} μg/m³</span>
            </div>
          </div>
        </div>
      `;
      
      // Popup oluştur
      const popup = new mapboxgl.Popup({
        offset: 25,
        closeButton: true,
        closeOnClick: true,
        className: 'sensor-popup'
      }).setHTML(popupContent);
      
      // İşaretçi oluştur
      const marker = new mapboxgl.Marker(el)
        .setLngLat([lon, lat])
        .setPopup(popup)
        .addTo(map.current);
      
      // İşaretçiye tıklanınca event'i tetikle
      el.addEventListener('click', () => {
        if (onSensorClick) {
          onSensorClick({
            id: locationName,
            location: locationName,
            latitude: lat,
            longitude: lon,
            aqi: aqi,
            pm25: pm25,
            pm10: pm10,
            no2: no2,
            so2: so2,
            o3: o3
          });
        }
      });
      
      // İşaretçiye hover olunca popup göster
      el.addEventListener('mouseenter', () => {
        marker.getPopup().addTo(map.current);
      });
      
      el.addEventListener('mouseleave', () => {
        setTimeout(() => {
          if (marker.getPopup().isOpen()) {
            marker.getPopup().remove();
          }
        }, 300);
      });
      
      // İşaretçiyi referanslara ekle
      markersRef.current.push(marker);
    } catch (error) {
      console.error("İşaretçi ekleme hatası:", error);
    }
  };

  // AQI değerine göre renk döndür
  const getAQIColor = (aqi) => {
    if (aqi <= 50) return '#00E400'; // İyi (0-50)
    if (aqi <= 100) return '#FFFF00'; // Orta (51-100)
    if (aqi <= 150) return '#FF7E00'; // Hassas gruplar için sağlıksız (101-150)
    if (aqi <= 200) return '#FF0000'; // Sağlıksız (151-200)
    if (aqi <= 300) return '#99004C'; // Çok sağlıksız (201-300)
    return '#7E0023'; // Tehlikeli (301+)
  };

  // AQI değerine göre durum açıklaması
  const getAQIDescription = (aqi) => {
    if (aqi <= 50) return 'İyi';
    if (aqi <= 100) return 'Orta';
    if (aqi <= 150) return 'Hassas Gruplar İçin Sağlıksız';
    if (aqi <= 200) return 'Sağlıksız';
    if (aqi <= 300) return 'Çok Sağlıksız';
    return 'Tehlikeli';
  };

  // Isı haritası gösterme durumunu değiştir
  const handleHeatmapToggle = () => {
    setShowHeatmap(!showHeatmap);
  };
  
  // İşaretçi gösterme durumunu değiştir
  const handleMarkersToggle = () => {
    setShowMarkers(!showMarkers);
  };

  // Harita görünümünü değiştir
  const handleViewChange = (event) => {
    changeMapView(event.target.value);
  };

  return (
    <Box sx={{ position: 'relative', height: '100%' }}>
      <MapContainer ref={mapContainer} />
      
      <MapControls>
        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
          Harita Kontrolleri
        </Typography>
        
        <FormControl fullWidth variant="outlined" size="small" sx={{ mb: 2 }}>
          <InputLabel>Görünüm</InputLabel>
          <Select
            value={mapView}
            onChange={handleViewChange}
            label="Görünüm"
          >
            <MenuItem value="turkey">Türkiye</MenuItem>
            <MenuItem value="istanbul">İstanbul</MenuItem>
            <MenuItem value="world">Dünya</MenuItem>
            <MenuItem value="all">Tümü</MenuItem>
          </Select>
        </FormControl>
        
        <FormControlLabel
          control={<Switch checked={showHeatmap} onChange={handleHeatmapToggle} />}
          label="Isı Haritası"
          sx={{ mb: 1, display: 'block' }}
        />
        
        <FormControlLabel
          control={<Switch checked={showMarkers} onChange={handleMarkersToggle} />}
          label="İşaretçiler"
          sx={{ display: 'block' }}
        />
      </MapControls>
    </Box>
  );
};

export default Map; 
