import React, { useEffect, useState } from 'react';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import { Box, Paper, Typography, FormControl, InputLabel, Select, MenuItem, CircularProgress } from '@mui/material';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  TimeScale
} from 'chart.js';
import 'chartjs-adapter-date-fns';
import { tr } from 'date-fns/locale';

// Chart.js bileşenlerini kaydet
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  TimeScale
);

// Parametre gösterimi için etiketler
const parameterLabels = {
  pm25: 'PM2.5 (μg/m³)',
  pm10: 'PM10 (μg/m³)',
  no2: 'NO₂ (μg/m³)',
  so2: 'SO₂ (μg/m³)',
  o3: 'O₃ (μg/m³)',
  aqi: 'AQI',
};

// Parametre renkleri
const parameterColors = {
  pm25: 'rgba(255, 99, 132, 0.8)',    // Kırmızı
  pm10: 'rgba(255, 159, 64, 0.8)',    // Turuncu
  no2: 'rgba(75, 192, 192, 0.8)',     // Turkuaz
  so2: 'rgba(153, 102, 255, 0.8)',    // Mor
  o3: 'rgba(255, 206, 86, 0.8)',      // Sarı
  aqi: 'rgba(54, 162, 235, 0.8)',     // Mavi
};

const AirQualityChart = ({ 
  airQualityData, 
  selectedRegionData, 
  title = "Hava Kalitesi Grafiği",
  defaultParameter = 'aqi',
  showMultipleParameters = null,
  showTopCities = null,
  showAllParameters = false,
  includeWHOStandards = false,
  whoStandards = {},
  isForecast = false
}) => {
  const [selectedParameter, setSelectedParameter] = useState(defaultParameter);
  const [chartData, setChartData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [chartKey, setChartKey] = useState(Date.now());
  
  // Seçili şehir/bölge değiştiğinde veriyi sıfırlar
  useEffect(() => {
    // Veriyi temizler ve grafiklerin yeniden oluşturulmasını sağlar
    setChartData(null);
    setIsLoading(true);
    setChartKey(Date.now()); // Her istasyon değişiminde benzersiz anahtar oluşturur
    
    console.log(`[DEBUG] AirQualityChart - "${title}" için veri temizlendi, yeniden çizilecek`);
    console.log(`[DEBUG] AirQualityChart - İstasyon değişimi tetiklendi, selectedRegionData: ${selectedRegionData?.length || 0} kayıt`);
  }, [selectedRegionData, title]);
  
  useEffect(() => {
    try {
      console.log(`[DEBUG] AirQualityChart - "${title}" için veri güncelleniyor.`);
      
      let sourceData = selectedRegionData?.length > 0 ? selectedRegionData : airQualityData;
      console.log(`[DEBUG] Veri kaynağı: ${selectedRegionData?.length > 0 ? "selectedRegionData" : "airQualityData"}`);
      console.log(`[DEBUG] Veri sayısı: ${sourceData?.length || 0}`);
      
      if (!sourceData || sourceData.length === 0) {
        console.log("Grafik için veri kaynağı bulunamadı");
        setChartData(null);
        setIsLoading(false);
        return;
      }
      
      // Verileri tarihe göre sırala ve son 24 saati al
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      
      // JSON'dan veri güvenlik kontrolü ve bozuk veri temizliği
      let validData = Array.isArray(sourceData) ? sourceData.filter(item => 
        item && typeof item === 'object' && 
        (item.pm25 !== undefined || item.pm10 !== undefined || 
         item.no2 !== undefined || item.so2 !== undefined || 
         item.o3 !== undefined || item.aqi !== undefined)
      ) : [];
      
      // Geçerli timestamp formatına sahip verileri filtrele
      let filteredData = [...validData]
        .filter(d => {
          if (!d || !d.timestamp) {
            // Timestamp yoksa veriyi kullanma
            return false;
          }
          
          // Timestamp formatını kontrol et ve düzelt
          let timestamp;
          try {
            // ISO formatı kontrolü
            if (typeof d.timestamp === 'string' && d.timestamp.includes('T')) {
              timestamp = new Date(d.timestamp);
            } else if (typeof d.timestamp === 'string' && !isNaN(Date.parse(d.timestamp))) {
              // Standart tarih string'i
              timestamp = new Date(d.timestamp);
            } else if (typeof d.timestamp === 'number' || !isNaN(parseInt(d.timestamp))) {
              // Unix timestamp kontrolü (sayı ise)
              timestamp = new Date(parseInt(d.timestamp));
            } else {
              // Bilinmeyen format, bu veriyi atla
              return false;
            }
            
            // Geçerli tarih kontrolü
            return !isNaN(timestamp.getTime()) && timestamp >= oneDayAgo;
          } catch (err) {
            console.warn("Geçersiz timestamp formatı:", d.timestamp);
            return false;
          }
        });
        
      // Veri yoksa işlemi sonlandır
      if (filteredData.length === 0) {
        console.log("Filtrelenmiş veri bulunamadı");
        setChartData(null);
        setIsLoading(false);
      return;
    }
    
      // Verileri sırala
      filteredData.sort((a, b) => {
        let dateA, dateB;
        
        try {
          if (typeof a.timestamp === 'string' && a.timestamp.includes('T')) {
            dateA = new Date(a.timestamp);
          } else if (typeof a.timestamp === 'number' || !isNaN(parseInt(a.timestamp))) {
            dateA = new Date(parseInt(a.timestamp));
          } else {
            dateA = new Date(a.timestamp);
          }
          
          if (typeof b.timestamp === 'string' && b.timestamp.includes('T')) {
            dateB = new Date(b.timestamp);
          } else if (typeof b.timestamp === 'number' || !isNaN(parseInt(b.timestamp))) {
            dateB = new Date(parseInt(b.timestamp));
          } else {
            dateB = new Date(b.timestamp);
          }
        } catch (err) {
          console.warn("Tarih sıralama hatası:", err);
          return 0;
        }
        
        return dateA - dateB;
      });
      
      if (filteredData.length > 20) {
        const every = Math.ceil(filteredData.length / 20);
        filteredData = filteredData.filter((_, index) => index % every === 0);
      }
      
      // Tüm parametre değerlerini normalize et
      filteredData = filteredData.map(dataPoint => {
        const cleanedPoint = { ...dataPoint };
    
        // Tüm parametreleri kontrol et
        Object.keys(parameterLabels).forEach(param => {
          let value;
          
          // Değeri güvenli bir şekilde parse et
          if (dataPoint[param] !== undefined) {
            if (typeof dataPoint[param] === 'string') {
              value = parseFloat(dataPoint[param]);
            } else {
              value = dataPoint[param];
            }
          } else {
            // Değer yoksa - o parametre için ortalama değer
            value = param === 'aqi' ? 50 : (
              param === 'pm25' ? 15 : (
                param === 'pm10' ? 30 : (
                  param === 'no2' ? 25 : (
                    param === 'so2' ? 10 : 40
                  )
                )
              )
            );
          }
          
          // NaN veya negatif değerleri temizle
          cleanedPoint[param] = isNaN(value) || value < 0 ? 0 : value;
        });
        
        return cleanedPoint;
      });
      
      // İlk ve son veri noktalarının değerlerini göster
      const paramToCheck = showMultipleParameters ? showMultipleParameters[0] : selectedParameter;
      if (filteredData.length > 0) {
        console.log(`[DEBUG] İlk veri noktası (${paramToCheck}): ${filteredData[0][paramToCheck]}`);
        console.log(`[DEBUG] Son veri noktası (${paramToCheck}): ${filteredData[filteredData.length-1][paramToCheck]}`);
      }
      
      // Tarihleri düzgün formatta hazırla
      const labels = filteredData.map(d => {
        let date;
        try {
          if (d.timestamp instanceof Date) {
            date = d.timestamp;
          } else if (typeof d.timestamp === 'string' && d.timestamp.includes('T')) {
            date = new Date(d.timestamp);
          } else if (typeof d.timestamp === 'number' || !isNaN(parseInt(d.timestamp))) {
            date = new Date(parseInt(d.timestamp));
          } else {
            date = new Date(d.timestamp);
          }
          
          if (isNaN(date.getTime())) {
            console.warn("Geçersiz tarih:", d.timestamp);
            return null;
          }
          
          return date;
        } catch (err) {
          console.warn("Tarih dönüşüm hatası:", err);
          return null;
        }
      }).filter(Boolean);
      
      // Anomali tespiti - Son 24 saatlik ortalamaya göre %50'den fazla artış gösteren değerler
      let anomalyPoints = {};
      if (filteredData.length > 2) {
        // Her bir parametre için anomali tespiti yap
        const parametersToCheck = showMultipleParameters || [selectedParameter];
        
        parametersToCheck.forEach(param => {
          // Belirli parametre için ortalama değer hesapla
          const paramValues = filteredData.map(d => parseFloat(d[param] || 0));
          const avgValue = paramValues.reduce((a, b) => a + b, 0) / paramValues.length;
          
          // Ortalamadan %50 fazla olan noktaları tespit et
          anomalyPoints[param] = [];
          filteredData.forEach((d, index) => {
            const value = parseFloat(d[param] || 0);
            // %50'den fazla sapma varsa
            if (value > avgValue * 1.5) {
              anomalyPoints[param].push(index);
            }
          });
        });
      }
      
      // Tahmin algoritması: Son 24 saatin verisiyle lineer regresyon, 24 saatlik tahmin
      function generateForecast24h(filteredData, param) {
        if (!filteredData || filteredData.length < 2) return [];
        const data = filteredData.slice(-24); // Son 24 saat
        const xs = data.map((d, i) => i);
        const ys = data.map(d => parseFloat(d[param] || 0));
        const n = xs.length;
        const sumX = xs.reduce((a, b) => a + b, 0);
        const sumY = ys.reduce((a, b) => a + b, 0);
        const sumXY = xs.reduce((a, b, i) => a + b * ys[i], 0);
        const sumX2 = xs.reduce((a, b) => a + b * b, 0);
        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX || 1);
        const intercept = (sumY - slope * sumX) / n;
        const lastTimestamp = new Date(data[data.length - 1].timestamp);
        const forecast = [];
        for (let i = 1; i <= 24; i++) {
          const futureTime = new Date(lastTimestamp.getTime() + i * 60 * 60 * 1000);
          let predicted = intercept + slope * (xs.length + i - 1);
          if (isNaN(predicted) || predicted < 0) predicted = 0;
          if (predicted > 500) predicted = 500;
          forecast.push({
            timestamp: futureTime,
            [param]: Math.round(predicted * 10) / 10
          });
        }
        return forecast;
      }
      
      // Tahmin verileri oluştur
      const forecastData = generateForecastData(filteredData, paramToCheck);
      
      let datasets = [];
    
    if (showMultipleParameters) {
      showMultipleParameters.forEach(param => {
          if (filteredData[0][param] !== undefined) {
        datasets.push({
          label: parameterLabels[param] || param,
              data: filteredData.map(d => d[param] || 0),
          fill: false,
          backgroundColor: parameterColors[param],
          borderColor: parameterColors[param],
              borderWidth: 2,
              tension: 0.4,
          pointRadius: 3,
              pointHoverRadius: 5,
              pointBackgroundColor: parameterColors[param],
        });
        
            // Anomali noktaları için ayrı bir veri seti
            if (anomalyPoints[param] && anomalyPoints[param].length > 0) {
              const anomalyData = filteredData.map((d, idx) => 
                anomalyPoints[param].includes(idx) ? d[param] : null
              );
              
              datasets.push({
                label: `${parameterLabels[param] || param} Anomalileri`,
                data: anomalyData,
                fill: false,
                backgroundColor: 'rgba(255, 0, 0, 0.8)',
                borderColor: 'rgba(255, 0, 0, 0)',
                pointRadius: 6,
                pointStyle: 'triangle',
                pointRotation: 180,
                pointHoverRadius: 8,
                pointBackgroundColor: 'rgba(255, 0, 0, 0.8)',
                showLine: false // Sadece noktaları göster
              });
            }
          }
        });
        
        // Tahmin verilerini ekle
        if (forecastData && forecastData.length > 0) {
          // Tahmin verilerini her parametre için ekle
          showMultipleParameters.forEach(param => {
            // Tahmin veri seti oluştur
          datasets.push({
              label: `${parameterLabels[param] || param} Tahmini`,
              data: forecastData.map(d => d[param] || null),
            fill: false,
              backgroundColor: 'rgba(0, 0, 0, 0)',
              borderColor: parameterColors[param],
              borderWidth: 1,
              borderDash: [3, 3],
              pointRadius: 2,
              pointStyle: 'circle',
              pointHoverRadius: 3,
              pointBackgroundColor: parameterColors[param],
              pointBorderColor: 'white',
              pointBorderWidth: 1,
              tension: 0.4 // Yumuşak eğri için
            });
          });
        }
    } else if (showAllParameters) {
      // Tüm parametreleri göster
      Object.keys(parameterLabels).forEach(param => {
          if (filteredData[0][param] !== undefined) {
            datasets.push({
              label: parameterLabels[param] || param,
              data: filteredData.map(d => d[param] || 0),
              fill: false,
              backgroundColor: parameterColors[param],
              borderColor: parameterColors[param],
              borderWidth: 2,
              tension: 0.4,
              pointRadius: 3,
              pointHoverRadius: 5
            });
          }
        });
      } else {
        if (filteredData.length === 1) {
          // Sabit tahmin üret
          const lastPoint = filteredData[0];
          const param = showMultipleParameters ? showMultipleParameters[0] : selectedParameter;
          const value = lastPoint[param] || 0;
          const forecast = [];
          const lastTimestamp = new Date(lastPoint.timestamp || Date.now());
          for (let i = 1; i <= 24; i++) {
            forecast.push({
              timestamp: new Date(lastTimestamp.getTime() + i * 60 * 60 * 1000),
              [param]: value
            });
          }
          labels.push(...forecast.map(d => d.timestamp));
          datasets.push({
            label: parameterLabels[param] || param,
            data: [value],
            fill: false,
            backgroundColor: parameterColors[param],
            borderColor: parameterColors[param],
            borderWidth: 2,
            tension: 0.4,
            pointRadius: 3,
            pointHoverRadius: 5
          });
          datasets.push({
            label: 'Tahmin',
            data: [value, ...forecast.map(d => d[param])],
            fill: false,
            backgroundColor: 'rgba(100, 100, 100, 0.1)',
            borderColor: 'rgba(54, 162, 235, 0.5)',
            borderWidth: 2,
            borderDash: [6, 4],
            pointRadius: 2,
            pointHoverRadius: 4,
            borderCapStyle: 'round',
            spanGaps: true
          });
          setChartData({
            type: 'line',
            data: {
              labels: labels,
              datasets: datasets
            },
            options: {
              ...options,
              plugins: {
                ...options.plugins,
                annotation: {
                  annotations: {
                    note: {
                      type: 'label',
                      xValue: labels[labels.length - 1],
                      yValue: value,
                      backgroundColor: 'rgba(255,255,255,0.8)',
                      content: ['Yeterli geçmiş veri yok, son değere göre sabit tahmin gösteriliyor'],
                      font: { size: 12 },
                      color: '#333',
                      position: 'end'
                    }
                  }
                }
              }
            }
          });
          setIsLoading(false);
          return;
        }
        // Tahmin algoritması: Son 24 saatin verisiyle lineer regresyon, 24 saatlik tahmin
        function generateForecast24h(filteredData, param) {
          if (!filteredData || filteredData.length < 2) return [];
          const data = filteredData.slice(-24); // Son 24 saat
          const xs = data.map((d, i) => i);
          const ys = data.map(d => parseFloat(d[param] || 0));
          const n = xs.length;
          const sumX = xs.reduce((a, b) => a + b, 0);
          const sumY = ys.reduce((a, b) => a + b, 0);
          const sumXY = xs.reduce((a, b, i) => a + b * ys[i], 0);
          const sumX2 = xs.reduce((a, b) => a + b * b, 0);
          const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX || 1);
          const intercept = (sumY - slope * sumX) / n;
          const lastTimestamp = new Date(data[data.length - 1].timestamp);
          const forecast = [];
          for (let i = 1; i <= 24; i++) {
            const futureTime = new Date(lastTimestamp.getTime() + i * 60 * 60 * 1000);
            let predicted = intercept + slope * (xs.length + i - 1);
            if (isNaN(predicted) || predicted < 0) predicted = 0;
            if (predicted > 500) predicted = 500;
            forecast.push({
              timestamp: futureTime,
              [param]: Math.round(predicted * 10) / 10
            });
          }
          return forecast;
        }
        // Tahmin verisi ekle
        let forecastData = [];
        if (filteredData.length > 1) {
          forecastData = generateForecast24h(filteredData, selectedParameter);
        }
        // Geçmiş veri seti
        datasets.push({
          label: parameterLabels[selectedParameter] || selectedParameter,
          data: filteredData.map(d => d[selectedParameter] || 0),
          fill: false,
          backgroundColor: parameterColors[selectedParameter],
          borderColor: parameterColors[selectedParameter],
          borderWidth: 2,
          tension: 0.4,
          pointRadius: 3,
          pointHoverRadius: 5
        });
        // Tahmin veri seti
        if (forecastData.length > 0) {
      datasets.push({
            label: 'Tahmin',
            data: [
              ...Array(filteredData.length - 1).fill(null),
              filteredData[filteredData.length - 1][selectedParameter] || 0,
              ...forecastData.map(d => d[selectedParameter])
            ],
        fill: false,
            backgroundColor: 'rgba(100, 100, 100, 0.1)',
            borderColor: 'rgba(54, 162, 235, 0.5)',
            borderWidth: 2,
            borderDash: [6, 4],
            pointRadius: 2,
            pointHoverRadius: 4,
            borderCapStyle: 'round',
            spanGaps: true
          });
          // X ekseni için label'ları uzat
          labels.push(...forecastData.map(d => d.timestamp));
        }
      }
      
      setChartData({
        type: 'line',
        data: {
          labels: labels,
          datasets: datasets
        },
        options: options
      });
      
      setIsLoading(false);
    } catch (error) {
      console.error("Grafik için veri hazırlanırken bir hata oluştu:", error);
      setChartData(null);
      setIsLoading(false);
    }
  }, [airQualityData, selectedRegionData, selectedParameter, showMultipleParameters, includeWHOStandards, whoStandards]);
  
  // Parametre seçim işleyicisi
  const handleParameterChange = (event) => {
    setSelectedParameter(event.target.value);
  };
  
  const generateForecastData = (filteredData, param) => {
    if (!filteredData || filteredData.length < 2) return [];
    
    try {
      const lastPoints = filteredData.slice(-5);
      
      let sumX = 0;
      let sumY = 0;
      let sumXY = 0;
      let sumX2 = 0;
      
      for (let i = 0; i < lastPoints.length; i++) {
        const x = i;
        const y = parseFloat(lastPoints[i][param] || 0);
        
        sumX += x;
        sumY += y;
        sumXY += x * y;
        sumX2 += x * x;
      }
      
      const n = lastPoints.length;
      const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
      const intercept = (sumY - slope * sumX) / n;
      
      console.log(`[FORECAST] ${param} için trend: slope=${slope.toFixed(2)}, intercept=${intercept.toFixed(2)}`);
      
      // Son veri noktasının zamanı
      const lastTimestamp = new Date(lastPoints[lastPoints.length - 1].timestamp);
      
      // Gelecek 8 saatin tahminini yap (3 saat aralıklarla)
      const forecast = [];
      for (let i = 1; i <= 8; i++) {
        // 3 saat aralıklarla
        const futureTime = new Date(lastTimestamp.getTime() + i * 3 * 60 * 60 * 1000);
        
        // Tahmin değerini hesapla
        const predictedValue = intercept + slope * (lastPoints.length + i - 1);
        
        // Değeri makul bir aralıkta tut
        const lastValue = parseFloat(lastPoints[lastPoints.length - 1][param] || 0);
        let finalValue = predictedValue;
        
        // Değer değişimini sınırla (maksimum %20 artış/azalış olabilir)
        const maxChange = lastValue * 0.2;
        if (predictedValue > lastValue + maxChange) {
          finalValue = lastValue + maxChange;
        } else if (predictedValue < lastValue - maxChange) {
          finalValue = lastValue - maxChange;
        }
        
        // Değer her zaman 0'dan büyük olsun
        finalValue = Math.max(0, finalValue);
        
        // Yeni veri noktası oluştur
        const forecastPoint = { timestamp: futureTime };
        forecastPoint[param] = finalValue;
        
        // Çoklu parametre gösterimi için diğer parametreleri de ekle
        if (showMultipleParameters) {
          showMultipleParameters.forEach(p => {
            if (p !== param) {
              const paramLastValue = parseFloat(lastPoints[lastPoints.length - 1][p] || 0);
              forecastPoint[p] = paramLastValue * (1 + (Math.random() * 0.1 - 0.05)); // ±%5 rastgele değişim
            }
          });
        }
        
        forecast.push(forecastPoint);
      }
      
      return forecast;
    } catch (err) {
      console.error("Tahmin hesaplanırken hata:", err);
      return [];
    }
  };
  
  // Chart opsiyonları
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          boxWidth: 15,
          usePointStyle: true,
          font: {
            size: 11,
            family: "'Inter', sans-serif"
          },
          padding: 15
        }
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        titleFont: {
          size: 12,
          family: "'Inter', sans-serif"
        },
        bodyFont: {
          size: 11,
          family: "'Inter', sans-serif"
        },
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        padding: 10,
        cornerRadius: 6,
        caretSize: 6,
        callbacks: {
          title: (tooltipItems) => {
            try {
              if (tooltipItems.length > 0) {
                const rawDate = tooltipItems[0].label;
                // Eğer tarih ise doğru formatla
                if (rawDate && rawDate instanceof Date) {
                  return new Intl.DateTimeFormat('tr-TR', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                  }).format(rawDate);
                }
                return 'Geçersiz tarih';
              }
              return '';
            } catch (err) {
              console.error("Tooltip tarih hatası:", err);
              return 'Geçersiz tarih';
            }
          },
          label: (context) => {
            const label = context.dataset.label || '';
            let value = context.parsed.y;
            if (!isNaN(value)) {
              value = value.toFixed(1);
              return `${label}: ${value}`;
            }
            return `${label}: N/A`;
          }
        }
      }
    },
    scales: {
      x: {
        type: 'time',
        time: {
          unit: 'hour',
          tooltipFormat: 'dd.MM HH:mm',
          displayFormats: {
            hour: 'HH:mm'
          }
        },
        adapters: {
          date: {
            locale: tr
          }
        },
        grid: {
          display: true,
          drawBorder: true,
          color: 'rgba(0, 0, 0, 0.05)'
        },
        ticks: {
          maxRotation: 45,
          font: {
            size: 10,
            family: "'Inter', sans-serif"
          },
          color: '#666'
        },
        border: {
          display: true,
          color: 'rgba(0, 0, 0, 0.1)'
        }
      },
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(0, 0, 0, 0.05)'
        },
        ticks: {
          font: {
            size: 10,
            family: "'Inter', sans-serif"
          },
          color: '#666',
          padding: 8,
          callback: function(value) {
            return value % 1 === 0 ? value : '';
          }
        },
        border: {
          display: true,
          color: 'rgba(0, 0, 0, 0.1)'
        }
      }
    },
    elements: {
      line: {
        tension: 0.3,
        borderWidth: 2
      },
      point: {
        radius: 3,
        hoverRadius: 5,
        hitRadius: 10
      }
    },
    animation: {
      duration: 1000,
      easing: 'easeOutQuart'
    },
    hover: {
      mode: 'index',
      intersect: false
    },
    interaction: {
      mode: 'nearest',
      axis: 'x',
      intersect: false
    }
  };
  
  // Grafik yükleme durumunu izle
  useEffect(() => {
    let timeout;
    if (isLoading) {
      timeout = setTimeout(() => {
        setIsLoading(false);
      }, 1500);
    }
    
    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [isLoading]);
  
  // Forecast modunda sadece airQualityData ve seçili parametreyi kullan
  const forecastData = isForecast
    ? airQualityData.map(d => ({
        time: d.timestamp,
        value: d[selectedParameter] ?? null
      }))
    : selectedRegionData.map(d => ({
        time: d.timestamp,
        value: d[selectedParameter] ?? null
      }));

  if (isForecast) {
    return (
      <div style={{ width: '100%', height: 260 }}>
        <svg width="100%" height="100%" viewBox="0 0 400 200">
          {/* Ekseni çiz */}
          <line x1="40" y1="180" x2="380" y2="180" stroke="#bbb" strokeWidth="1" />
          <line x1="40" y1="20" x2="40" y2="180" stroke="#bbb" strokeWidth="1" />
          {/* Noktaları ve çizgiyi çiz */}
          {forecastData.length > 1 && (
            <polyline
              fill="none"
              stroke="#222"
              strokeWidth="2"
              points={forecastData.map((d, i) => {
                const x = 40 + (i * (340 / (forecastData.length - 1)));
                // Y ekseni: min/max'a göre normalize
                const values = forecastData.map(c => c.value).filter(v => v !== null);
                const minY = Math.min(...values);
                const maxY = Math.max(...values);
                const y = 180 - ((d.value - minY) / (maxY - minY || 1)) * 160;
                return `${x},${y}`;
              }).join(' ')}
            />
          )}
          {/* Noktaları çiz */}
          {forecastData.map((d, i) => {
            const x = 40 + (i * (340 / (forecastData.length - 1)));
            const values = forecastData.map(c => c.value).filter(v => v !== null);
            const minY = Math.min(...values);
            const maxY = Math.max(...values);
            const y = 180 - ((d.value - minY) / (maxY - minY || 1)) * 160;
            return (
              <circle key={i} cx={x} cy={y} r={2.5} fill="#1976d2" />
            );
          })}
          {/* X ekseni saat etiketleri */}
          {forecastData.length > 0 && (
            <>
              <text x="40" y="195" fontSize="10" fill="#888">Şimdi</text>
              <text x="380" y="195" fontSize="10" fill="#888">+24s</text>
            </>
          )}
          {/* Y ekseni min/max */}
          {forecastData.length > 0 && (
            <>
              <text x="10" y="185" fontSize="10" fill="#888">{Math.min(...forecastData.map(d => d.value).filter(v => v !== null))}</text>
              <text x="10" y="30" fontSize="10" fill="#888">{Math.max(...forecastData.map(d => d.value).filter(v => v !== null))}</text>
            </>
          )}
        </svg>
      </div>
    );
  }
  
  return (
    <Box>
      {/* Parametre seçimi */}
      {(!showTopCities && !showMultipleParameters && !showAllParameters) && (
        <FormControl size="small" fullWidth sx={{ mb: 2 }}>
          <InputLabel id={`parameter-select-label-${title.replace(/\s+/g, '')}`}>Parametre</InputLabel>
              <Select
            labelId={`parameter-select-label-${title.replace(/\s+/g, '')}`}
            id={`parameter-select-${title.replace(/\s+/g, '')}`}
                value={selectedParameter}
                label="Parametre"
                onChange={handleParameterChange}
              >
                {Object.entries(parameterLabels).map(([value, label]) => (
                  <MenuItem key={value} value={value}>{label}</MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
      
      {/* Grafik içeriği */}
      <Box sx={{ 
        height: showTopCities ? '340px' : showAllParameters ? '450px' : '270px',
        position: 'relative',
        transition: 'opacity 0.3s ease'
      }}>
        {/* Yükleniyor göstergesi */}
        {isLoading && (
          <Box sx={{
            position: 'absolute',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(255, 255, 255, 0.7)',
            zIndex: 5,
            borderRadius: '4px'
          }}>
            <CircularProgress size={40} />
        </Box>
        )}
        
        {/* Veri yoksa bilgi mesajı */}
        {!chartData && !isLoading && (
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
            height: '100%',
            flexDirection: 'column',
            color: 'text.secondary',
            textAlign: 'center',
            p: 3
            }}>
            <Typography variant="body1" sx={{ mb: 1, fontWeight: 500 }}>
              Bu istasyon için veri bulunamadı.
            </Typography>
            <Typography variant="body2">
              Lütfen başka bir istasyon veya ölçüm parametresi seçin.
              </Typography>
            </Box>
          )}
        
        {/* Grafik çizimi - her tür için ayrı kontrol */}
        {chartData && chartData.type === 'line' && (
          <Line 
            data={chartData.data} 
            options={chartData.options} 
            key={`line-${chartKey}`} 
          />
        )}
        
        {chartData && chartData.type === 'bar' && (
          <Bar 
            data={chartData.data} 
            options={chartData.options} 
            key={`bar-${chartKey}`} 
          />
        )}
        
        {chartData && chartData.type === 'doughnut' && (
          <Doughnut 
            data={chartData.data} 
            options={chartData.options} 
            key={`doughnut-${chartKey}`} 
          />
          )}
        </Box>
    </Box>
  );
};

export default React.memo(AirQualityChart); 
