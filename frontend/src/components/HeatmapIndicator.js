import React from 'react';
import { Box, Typography, Paper, Chip, Tooltip } from '@mui/material';
import InfoIcon from '@mui/icons-material/Info';
import LocationCityIcon from '@mui/icons-material/LocationCity';

const getAqiColor = (aqi) => {
  if (!aqi || isNaN(aqi)) return '#888';
  if (aqi <= 50) return '#009966';
  if (aqi <= 100) return '#ffde33';
  if (aqi <= 150) return '#ff9933';
  if (aqi <= 200) return '#cc0033';
  if (aqi <= 300) return '#660099';
  return '#7e0023';
};

const getAqiLevelText = (aqi) => {
  if (!aqi || isNaN(aqi)) return 'Veri Yok';
  if (aqi <= 50) return 'İyi';
  if (aqi <= 100) return 'Orta';
  if (aqi <= 150) return 'Hassas';
  if (aqi <= 200) return 'Kötü';
  if (aqi <= 300) return 'Çok Kötü';
  return 'Tehlikeli';
};

const getAqiLevelDesc = (aqi) => {
  if (!aqi || isNaN(aqi)) return 'Veri yok.';
  if (aqi <= 50) return 'Hava kalitesi sağlıklı, risk yok.';
  if (aqi <= 100) return 'Hava kalitesi orta, hassas gruplar için dikkat.';
  if (aqi <= 150) return 'Hassas gruplar için riskli, dışarıda uzun süre kalmayın.';
  if (aqi <= 200) return 'Sağlıksız, özellikle çocuklar ve yaşlılar için riskli.';
  if (aqi <= 300) return 'Çok sağlıksız, mümkünse kapalı alanlarda kalın.';
  return 'Tehlikeli, acil durumlar dışında dışarı çıkmayın.';
};

const HeatmapIndicator = ({ selectedCity }) => {
  if (!selectedCity) {
    return (
      <Paper sx={{ p: 2, borderRadius: '14px', bgcolor: '#f8f8f8', height: '100%' }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1, fontSize: '1.15rem', letterSpacing: '-0.01em' }}>
          Bölgesel Hava Kalitesi Dağılımı
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '170px', color: 'text.secondary' }}>
          <Typography variant="body2">Bölgesel dağılım gösterimi için istasyon seçin</Typography>
        </Box>
      </Paper>
    );
  }

  const aqi = selectedCity.aqi;
  const aqiColor = getAqiColor(aqi);
  const aqiLevel = getAqiLevelText(aqi);
  const aqiDesc = getAqiLevelDesc(aqi);

  return (
    <Paper sx={{ p: 2.5, borderRadius: '14px', bgcolor: '#f8f8f8', height: '100%', boxShadow: '0 4px 24px 0 rgba(0,0,0,0.07)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start' }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1, fontSize: '1.15rem', letterSpacing: '-0.01em' }}>
        Bölgesel Hava Kalitesi Dağılımı
      </Typography>
      <Box sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        minHeight: '220px',
        borderRadius: '12px',
        bgcolor: 'linear-gradient(135deg, #e3f2fd 60%, #fff 100%)',
        border: '1.5px solid #e0e0e0',
        boxShadow: '0 2px 12px 0 rgba(0,0,0,0.06)',
        position: 'relative',
        overflow: 'visible',
        pt: 2,
        pb: 1
      }}>
        {/* SVG ile merkez ve etki halkası, gradient ve gölge ile */}
        <svg width="200" height="200" viewBox="0 0 200 200" style={{ position: 'relative', zIndex: 1 }}>
          <defs>
            <radialGradient id="aqiGradient" cx="50%" cy="50%" r="70%">
              <stop offset="0%" stopColor={aqiColor + '55'} />
              <stop offset="80%" stopColor={aqiColor + '11'} />
              <stop offset="100%" stopColor="#fff0" />
            </radialGradient>
            <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor={aqiColor} floodOpacity="0.18" />
            </filter>
          </defs>
          {/* 24 km çapı temsili etki alanı */}
          <circle cx="100" cy="100" r="75" fill="url(#aqiGradient)" filter="url(#shadow)" />
          {/* Merkez nokta */}
          <circle cx="100" cy="100" r="18" fill={aqiColor} stroke="#fff" strokeWidth="4" filter="url(#shadow)" />
        </svg>
        {/* Merkezde şehir adı ve AQI etiketi, üst üste ve spacing ile */}
        <Box sx={{
          position: 'absolute',
          top: '50%',
          left: 0,
          width: '100%',
          transform: 'translateY(-60%)',
          textAlign: 'center',
          zIndex: 2,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 1.2
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 0.5 }}>
            <LocationCityIcon sx={{ fontSize: 22, color: '#1976d2', mr: 0.5 }} />
            <Typography variant="h6" sx={{ fontWeight: 800, color: '#222', fontSize: '1.18rem', letterSpacing: '-0.01em', background: 'rgba(255,255,255,0.85)', px: 1.5, borderRadius: 2 }}>
              {selectedCity.name}
            </Typography>
          </Box>
          <Tooltip title={aqiDesc} arrow>
            <Chip
              label={`${aqi || 'N/A'} - ${aqiLevel}`}
              sx={{
                bgcolor: aqiColor,
                color: '#fff',
                fontWeight: 700,
                fontSize: '1.08rem',
                px: 2.5,
                py: 1.2,
                boxShadow: '0 2px 8px 0 ' + aqiColor + '33',
                letterSpacing: '0.01em',
                borderRadius: '8px',
                mt: 1
              }}
            />
          </Tooltip>
        </Box>
      </Box>
      {/* Alt bilgi kutusu panelin altında, geniş ve okunur */}
      <Box sx={{
        mt: 2.5,
        bgcolor: 'rgba(25, 118, 210, 0.07)',
        borderRadius: '8px',
        px: 2.5,
        py: 1.5,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 44
      }}>
        <InfoIcon sx={{ fontSize: 18, mr: 1, color: '#1976d2' }} />
        <Typography variant="subtitle2" sx={{ color: '#1976d2', fontWeight: 600, fontSize: '1.04em', letterSpacing: '-0.01em', textAlign: 'center' }}>
          Bu şehirdeki hava kalitesi, <b>24 km çapındaki</b> bölgeyi yukarıdaki etki alanı gibi etkiliyor.
        </Typography>
      </Box>
    </Paper>
  );
};

export default HeatmapIndicator; 