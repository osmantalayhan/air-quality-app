import React, { useState } from 'react';
import { Box, Typography, Paper, Tabs, Tab, Divider, Tooltip } from '@mui/material';
import InfoIcon from '@mui/icons-material/Info';

const ParameterInfo = () => {
  const [selectedTab, setSelectedTab] = useState(0);
  
  const handleTabChange = (event, newValue) => {
    setSelectedTab(newValue);
  };
  
  // Parametre bilgileri
  const parameterData = [
    {
      id: 'pm25',
      label: 'PM2.5',
      fullName: 'Partikül Madde (2.5 mikron)',
      description: 'Havada asılı kalan ve çapı 2.5 mikron veya daha küçük olan parçacıklardır. Bu partiküller akciğerlere nüfuz edebilir ve kan dolaşımına girebilir.',
      sources: 'Araç egzozları, endüstriyel tesisler, biyokütle yakma, orman yangınları, inşaat faaliyetleri.',
      healthEffects: 'Akciğer ve kalp hastalıkları riski, solunum problemleri, astım ataklarını tetikleme, kalp krizi riskini artırma.',
      whoStandard: '5 μg/m³ (yıllık), 15 μg/m³ (24 saatlik)',
      unitInfo: 'Mikrogram/metreküp (μg/m³)'
    },
    {
      id: 'pm10',
      label: 'PM10',
      fullName: 'Partikül Madde (10 mikron)',
      description: 'Çapı 10 mikron veya daha küçük olan havada asılı partiküller. PM2.5\'e göre daha büyük olsalar da solunum yolunda birikirler.',
      sources: 'Toz, polen, küf, araç egzozları, yol tozu, inşaat çalışmaları, tarım faaliyetleri.',
      healthEffects: 'Solunum yolu irritasyonu, astım şikayetlerinde artış, alerjik reaksiyonlar, akciğer fonksiyonlarında azalma.',
      whoStandard: '15 μg/m³ (yıllık), 45 μg/m³ (24 saatlik)',
      unitInfo: 'Mikrogram/metreküp (μg/m³)'
    },
    {
      id: 'o3',
      label: 'O₃',
      fullName: 'Ozon',
      description: 'Üç oksijen atomundan oluşan reaktif bir gazdır. Yeryüzüne yakın ozon (troposferik ozon) zararlı bir hava kirleticisidir.',
      sources: 'Güneş ışığı etkisi altında azot oksitler ve uçucu organik bileşiklerin kimyasal reaksiyonlarından oluşur.',
      healthEffects: 'Akciğer fonksiyonlarında azalma, solunum yolu irritasyonu, öksürük, astım atakları, boğaz ağrısı, göz yanması.',
      whoStandard: '100 μg/m³ (8 saatlik)',
      unitInfo: 'Mikrogram/metreküp (μg/m³)'
    },
    {
      id: 'no2',
      label: 'NO₂',
      fullName: 'Azot Dioksit',
      description: 'Keskin kokulu, kırmızımsı-kahverengi bir gazdır. Fotokimyasal sisin önemli bir bileşenidir.',
      sources: 'Fosil yakıtların yanması, motorlu taşıtlar, elektrik santralleri, endüstriyel prosesler.',
      healthEffects: 'Solunum yollarında inflamasyon, akciğer fonksiyonlarında azalma, astım şikayetlerinde artış, bronşit.',
      whoStandard: '10 μg/m³ (yıllık), 25 μg/m³ (24 saatlik)',
      unitInfo: 'Mikrogram/metreküp (μg/m³)'
    },
    {
      id: 'so2',
      label: 'SO₂',
      fullName: 'Kükürt Dioksit',
      description: 'Keskin kokulu, renksiz bir gazdır. Endüstriyel işlemler ve fosil yakıtların yanması sonucu ortaya çıkar.',
      sources: 'Kömür ve petrol yakıtlı elektrik santralleri, endüstriyel tesisler, volkanik patlamalar.',
      healthEffects: 'Solunum güçlüğü, gözlerde tahriş, bronşit, akciğer iltihabı, astım şikayetlerinde artış.',
      whoStandard: '40 μg/m³ (24 saatlik), 500 μg/m³ (10 dakikalık)',
      unitInfo: 'Mikrogram/metreküp (μg/m³)'
    },
    {
      id: 'aqi',
      label: 'AQI',
      fullName: 'Hava Kalitesi İndeksi',
      description: 'Farklı hava kirleticilerini tek bir ölçek üzerinde ifade eden bir indekstir. Kirleticilerin sağlık üzerindeki potansiyel etkilerini gösterir.',
      sources: 'Diğer parametrelerin (PM2.5, PM10, NO₂, SO₂, O₃) değerlerinden hesaplanır.',
      healthEffects: 'AQI değeri yükseldikçe sağlık riskleri artar. 0-50: İyi, 51-100: Orta, 101-150: Hassas gruplar için kötü, 151-200: Kötü, 201-300: Çok kötü, >300: Tehlikeli.',
      whoStandard: 'Standart yok, ülkelere göre hesaplama metodolojisi değişebilir.',
      unitInfo: 'Birim yok, 0-500 arasında bir değer'
    }
  ];
  
  const selectedParameter = parameterData[selectedTab];
  
  return (
    <Paper sx={{ p: 2, borderRadius: '8px', bgcolor: '#f8f8f8', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
        Parametre Bilgileri
      </Typography>
      
      <Tabs 
        value={selectedTab} 
        onChange={handleTabChange}
        variant="scrollable"
        scrollButtons="auto"
        sx={{ 
          mb: 2,
          '& .MuiTab-root': {
            fontSize: '0.85rem',
            minWidth: 'auto',
            px: 1.5
          }
        }}
      >
        {parameterData.map((param, index) => (
          <Tab key={param.id} label={param.label} />
        ))}
      </Tabs>
      
      <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
            {selectedParameter.fullName}
          </Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            {selectedParameter.description}
          </Typography>
          
          <Divider sx={{ my: 1.5 }} />
          
          <Box sx={{ mb: 1.5 }}>
            <Typography variant="body2" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', mb: 0.5 }}>
              <InfoIcon sx={{ fontSize: 16, mr: 0.5, color: 'primary.main' }} /> Kaynaklar
            </Typography>
            <Typography variant="body2" sx={{ ml: 2.5 }}>
              {selectedParameter.sources}
            </Typography>
          </Box>
          
          <Box sx={{ mb: 1.5 }}>
            <Typography variant="body2" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', mb: 0.5 }}>
              <InfoIcon sx={{ fontSize: 16, mr: 0.5, color: 'error.main' }} /> Sağlık Etkileri
            </Typography>
            <Typography variant="body2" sx={{ ml: 2.5 }}>
              {selectedParameter.healthEffects}
            </Typography>
          </Box>
        </Box>
        
        <Divider sx={{ my: 1.5 }} />
        
        <Box sx={{ 
          p: 1.5, 
          bgcolor: '#e3f2fd', 
          color: '#0d47a1',
          borderRadius: '4px',
          mt: 1
        }}>
          <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
            WHO Standartları
          </Typography>
          <Typography variant="body2">
            {selectedParameter.whoStandard}
          </Typography>
        </Box>
        
        <Tooltip title="Ölçüm birimi hakkında bilgi" arrow>
          <Box sx={{ 
            p: 1, 
            bgcolor: 'background.paper', 
            color: 'text.secondary',
            borderRadius: '4px',
            mt: 1.5,
            border: '1px dashed rgba(0,0,0,0.1)',
            display: 'flex',
            alignItems: 'center'
          }}>
            <InfoIcon sx={{ fontSize: 16, mr: 0.5 }} />
            <Typography variant="caption">
              {selectedParameter.unitInfo}
            </Typography>
          </Box>
        </Tooltip>
      </Box>
    </Paper>
  );
};

export default ParameterInfo; 