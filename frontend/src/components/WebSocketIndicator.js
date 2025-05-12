import React from 'react';
import { Box, Typography, CircularProgress } from '@mui/material';
import WifiIcon from '@mui/icons-material/Wifi';
import WifiOffIcon from '@mui/icons-material/WifiOff';
import RefreshIcon from '@mui/icons-material/Refresh';

const WebSocketIndicator = ({ connected, retryCount, lastUpdated }) => {
  return (
    <Box sx={{ 
      display: 'flex',
      alignItems: 'center',
      padding: '8px 12px',
      borderRadius: '8px',
      backgroundColor: connected ? 'rgba(76, 175, 80, 0.1)' : 'rgba(244, 67, 54, 0.1)',
      border: `1px solid ${connected ? 'rgba(76, 175, 80, 0.3)' : 'rgba(244, 67, 54, 0.3)'}`,
      mb: 2
    }}>
      <Box sx={{ 
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 32,
        height: 32,
        borderRadius: '50%',
        backgroundColor: connected ? 'rgba(76, 175, 80, 0.2)' : 'rgba(244, 67, 54, 0.2)',
        mr: 2
      }}>
        {connected ? (
          <WifiIcon sx={{ color: '#2e7d32' }} />
        ) : retryCount > 0 ? (
          <RefreshIcon sx={{ 
            color: '#d32f2f',
            animation: 'spin 1.5s linear infinite',
            '@keyframes spin': {
              '0%': { transform: 'rotate(0deg)' },
              '100%': { transform: 'rotate(360deg)' }
            }
          }} />
        ) : (
          <WifiOffIcon sx={{ color: '#d32f2f' }} />
        )}
      </Box>
      
      <Box sx={{ flex: 1 }}>
        <Typography variant="subtitle2" sx={{ 
          fontWeight: 600, 
          color: connected ? '#2e7d32' : '#d32f2f',
          mb: 0.5
        }}>
          {connected ? 'Gerçek Zamanlı Veri Bağlantısı Aktif' : retryCount > 0 ? 'Bağlantı Kuruluyor...' : 'Bağlantı Kesildi'}
        </Typography>
        
        <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
          {connected ? (
            lastUpdated ? `Son güncelleme: ${new Date(lastUpdated).toLocaleTimeString('tr-TR')}` : 'Veriler gerçek zamanlı olarak güncelleniyor'
          ) : retryCount > 0 ? (
            `Yeniden bağlanılıyor (${retryCount}/5)...`
          ) : (
            'Gerçek zamanlı veri alınamıyor. Lütfen internet bağlantınızı kontrol edin.'
          )}
        </Typography>
      </Box>
      
      {retryCount > 0 && !connected && (
        <CircularProgress 
          size={24} 
          thickness={5}
          sx={{ ml: 2 }}  
        />
      )}
    </Box>
  );
};

export default WebSocketIndicator; 