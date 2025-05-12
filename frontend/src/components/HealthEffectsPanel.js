import React from 'react';
import { Box, Typography, Paper, Chip, Divider, List, ListItem, ListItemIcon, ListItemText } from '@mui/material';
import WarningIcon from '@mui/icons-material/Warning';
import InfoIcon from '@mui/icons-material/Info';
import MedicalServicesIcon from '@mui/icons-material/MedicalServices';
import DirectionsRunIcon from '@mui/icons-material/DirectionsRun';
import ElderlyIcon from '@mui/icons-material/Elderly';
import ChildCareIcon from '@mui/icons-material/ChildCare';
import AirIcon from '@mui/icons-material/Air';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';

// AQI seviyesine göre renk
const getAqiColor = (aqi) => {
  if (!aqi || isNaN(aqi)) return '#9e9e9e';  // Gri (veri yok)
  
  if (aqi <= 50) return '#4caf50';      // İyi (yeşil)
  if (aqi <= 100) return '#ffeb3b';     // Orta (sarı)
  if (aqi <= 150) return '#ff9800';     // Hassas gruplar için kötü (turuncu)
  if (aqi <= 200) return '#f44336';     // Kötü (kırmızı)
  if (aqi <= 300) return '#9c27b0';     // Çok kötü (mor)
  return '#b71c1c';                     // Tehlikeli (koyu kırmızı)
};

// AQI seviyesine göre metin rengi
const getAqiTextColor = (aqi) => {
  if (!aqi || isNaN(aqi)) return '#ffffff';
  
  if (aqi <= 50) return '#ffffff';     // Yeşil arka plan için beyaz yazı
  if (aqi <= 100) return '#212121';    // Sarı arka plan için siyah yazı
  if (aqi <= 150) return '#ffffff';    // Turuncu arka plan için beyaz yazı
  if (aqi <= 200) return '#ffffff';    // Kırmızı arka plan için beyaz yazı
  if (aqi <= 300) return '#ffffff';    // Mor arka plan için beyaz yazı
  return '#ffffff';                    // Koyu kırmızı arka plan için beyaz yazı
};

// AQI seviyesine göre durum metni
const getAqiLevelText = (aqi) => {
  if (!aqi || isNaN(aqi)) return 'Veri Yok';
  
  if (aqi <= 50) return 'İyi';
  if (aqi <= 100) return 'Orta';
  if (aqi <= 150) return 'Hassas Gruplar İçin Kötü';
  if (aqi <= 200) return 'Kötü';
  if (aqi <= 300) return 'Çok Kötü';
  return 'Tehlikeli';
};

// AQI seviyesine göre sağlık etkileri
const getHealthEffects = (aqi) => {
  if (!aqi || isNaN(aqi)) return 'Bu AQI değeri için sağlık bilgisi bulunmuyor.';
  
  if (aqi <= 50) {
    return 'Hava kalitesi yeterlidir ve hava kirliliği sağlık için çok az risk oluşturur veya hiç risk oluşturmaz.';
  }
  if (aqi <= 100) {
    return 'Hava kalitesi kabul edilebilir; ancak bazı kirleticiler, hava kirliliğine karşı olağandışı derecede hassas çok az sayıda insan için orta düzeyde sağlık endişesi oluşturabilir.';
  }
  if (aqi <= 150) {
    return 'Hassas gruplar sağlık etkileri yaşayabilir. Genel nüfusun etkilenmesi olası değildir. Kalp veya akciğer hastalığı olan kişiler, yaşlılar ve çocuklar, hava kirliliğine maruz kaldıklarında daha yüksek sağlık riski altındadır.';
  }
  if (aqi <= 200) {
    return 'Herkes sağlık etkileri yaşamaya başlayabilir; hassas gruplar daha ciddi sağlık etkileri yaşayabilir. Kalp veya akciğer hastalığı olan kişiler, yaşlılar ve çocuklar için artan risk.';
  }
  if (aqi <= 300) {
    return 'Sağlık uyarıları, acil durumlar; tüm nüfusun etkilenme olasılığı daha yüksektir. Herkes için ciddi sağlık etkileri, özellikle hassas gruplar için tehlikeli durum.';
  }
  return 'Sağlık alarmı: herkes daha ciddi sağlık etkileri yaşayabilir. Tüm fiziksel aktivitelerin dışarıda yapılmaması tavsiye edilir. Herkes için acil sağlık etkisi riski.';
};

// AQI seviyesine göre önlem tavsiyeleri
const getRecommendations = (aqi) => {
  if (!aqi || isNaN(aqi)) return [];
  
  if (aqi <= 50) {
    return [
      { icon: <DirectionsRunIcon />, text: 'Dış mekan aktiviteleri güvenlidir.' },
      { icon: <AirIcon />, text: 'Pencerelerinizi açabilirsiniz.' }
    ];
  }
  if (aqi <= 100) {
    return [
      { icon: <InfoIcon />, text: 'Hassas kişiler uzun süreli dış mekan aktivitelerini sınırlamalıdır.' },
      { icon: <ChildCareIcon />, text: 'Çocukların uzun süre dışarıda kalması izlenmelidir.' }
    ];
  }
  if (aqi <= 150) {
    return [
      { icon: <ElderlyIcon />, text: 'Yaşlılar, çocuklar ve kronik hastalığı olanlar dış aktiviteleri sınırlamalıdır.' },
      { icon: <MedicalServicesIcon />, text: 'Dışarıdayken maske kullanımı hassas gruplar için düşünülebilir.' },
      { icon: <AirIcon />, text: 'Mümkünse hava temizleyicisi kullanın.' }
    ];
  }
  if (aqi <= 200) {
    return [
      { icon: <WarningIcon />, text: 'Herkes dış aktiviteleri sınırlamalıdır.' },
      { icon: <MedicalServicesIcon />, text: 'Dışarıdayken maske kullanımı önerilir.' },
      { icon: <AirIcon />, text: 'Pencereler kapalı tutulmalıdır.' },
      { icon: <DirectionsRunIcon />, text: 'Ağır fiziksel aktivitelerden kaçının.' }
    ];
  }
  if (aqi <= 300) {
    return [
      { icon: <WarningIcon />, text: 'Tüm dış aktivitelerden kaçının.' },
      { icon: <MedicalServicesIcon />, text: 'Dışarı çıkarken N95/FFP2 maske kullanın.' },
      { icon: <AirIcon />, text: 'Evde hava temizleyici kullanın.' },
      { icon: <LocalHospitalIcon />, text: 'Solunum güçlüğü yaşarsanız hemen doktora başvurun.' }
    ];
  }
  return [
    { icon: <WarningIcon />, text: 'Mümkünse evde kalın, dışarı çıkmayın.' },
    { icon: <MedicalServicesIcon />, text: 'Zorunlu değilse dışarı çıkmayın.' },
    { icon: <AirIcon />, text: 'Evde hava temizleyici kullanın.' },
    { icon: <LocalHospitalIcon />, text: 'Solunum güçlüğü belirtileri gözlemlerseniz acil tıbbi yardım alın.' }
  ];
};

const HealthEffectsPanel = ({ aqi }) => {
  const aqiValue = parseInt(aqi);
  const aqiLevel = getAqiLevelText(aqiValue);
  const healthEffects = getHealthEffects(aqiValue);
  const recommendations = getRecommendations(aqiValue);
  const aqiColor = getAqiColor(aqiValue);
  const textColor = getAqiTextColor(aqiValue);
  
  return (
    <Paper sx={{ p: 2, borderRadius: '8px', bgcolor: '#f8f8f8', height: '100%' }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
        Sağlık Etkileri ve Öneriler
      </Typography>
      
      <Box sx={{ mb: 2, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Chip 
          label={`AQI: ${aqiValue || 'N/A'} - ${aqiLevel}`}
          variant="filled"
          sx={{ 
            bgcolor: aqiColor, 
            color: textColor, 
            fontWeight: 'bold', 
            fontSize: '0.9rem',
            py: 2,
            mb: 2
          }}
        />
        
        <Typography variant="body2" sx={{ textAlign: 'center', fontWeight: 500, mb: 1 }}>
          {healthEffects}
        </Typography>
      </Box>
      
      <Divider sx={{ mb: 2 }} />
      
      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
        Öneriler
      </Typography>
      
      <List dense>
        {recommendations.map((recommendation, index) => (
          <ListItem key={index} sx={{ pl: 0 }}>
            <ListItemIcon sx={{ minWidth: 36 }}>
              {recommendation.icon}
            </ListItemIcon>
            <ListItemText 
              primary={recommendation.text} 
              primaryTypographyProps={{ variant: 'body2' }}
            />
          </ListItem>
        ))}
      </List>
      
      <Box sx={{ mt: 2, pt: 1, borderTop: '1px dashed rgba(0,0,0,0.1)' }}>
        <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', color: 'text.secondary' }}>
          <InfoIcon sx={{ fontSize: 16, mr: 0.5 }} />
          Bu öneriler genel bilgi amaçlıdır. Sağlık koşullarınıza göre doktorunuza danışın.
        </Typography>
      </Box>
    </Paper>
  );
};

export default HealthEffectsPanel; 