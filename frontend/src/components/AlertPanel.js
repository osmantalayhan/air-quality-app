import React from 'react';
import { Box, Typography, List, ListItem, ListItemText, Chip, IconButton, Divider, Alert } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

// Uyarı şiddetine göre renk belirleme
const getSeverityColor = (severity) => {
  switch (severity) {
    case 'high':
      return 'error';
    case 'medium':
      return 'warning';
    case 'low':
      return 'info';
    default:
      return 'default';
  }
};

const AlertPanel = ({ alerts = [], onClear }) => {
  console.log("AlertPanel'e gelen uyarılar:", alerts);
  console.log("Uyarı sayısı:", alerts.length);
  
  // Uyarı detayları için bir debug log ekleyelim
  if (alerts && alerts.length > 0) {
    console.log("Uyarı detayları:", JSON.stringify(alerts.slice(0, 3), null, 2));
  }
  
  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" component="h2">
          <Box component="span" sx={{ display: 'flex', alignItems: 'center' }}>
            <span>Uyarılar</span>
            {alerts.length > 0 && (
              <Chip 
                label={alerts.length} 
                color="error" 
                size="small" 
                sx={{ ml: 1 }} 
              />
            )}
          </Box>
        </Typography>
      </Box>
      
      {alerts.length > 0 ? (
        <List sx={{ width: '100%', bgcolor: 'background.paper', borderRadius: 1 }}>
          {alerts.map((alert, index) => {
            // Zaman formatını düzgün şekilde ayarla
            let formattedTime;
            try {
              const alertDate = new Date(alert.timestamp);
              formattedTime = format(alertDate, 'dd MMM yyyy HH:mm', { locale: tr });
            } catch (e) {
              formattedTime = 'Bilinmeyen zaman';
              console.error('Tarih formatı hatası:', e);
            }
            
            return (
              <React.Fragment key={alert.id || index}>
                <ListItem 
                  alignItems="flex-start"
                  secondaryAction={
                    <IconButton edge="end" aria-label="delete" onClick={() => onClear(alert.id)}>
                      <DeleteIcon />
                    </IconButton>
                  }
                  sx={{ 
                    bgcolor: index % 2 === 0 ? 'rgba(0,0,0,0.02)' : 'transparent',
                    borderLeft: `4px solid ${getSeverityColor(alert.severity) === 'error' ? '#f44336' : 
                                          getSeverityColor(alert.severity) === 'warning' ? '#ff9800' : 
                                          getSeverityColor(alert.severity) === 'info' ? '#2196f3' : '#9e9e9e'}`
                  }}
                >
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                        <Typography component="span" variant="subtitle1" fontWeight="bold">
                          {alert.title || 'Uyarı'}
                        </Typography>
                        <Chip 
                          label={alert.location || 'Bilinmeyen Konum'} 
                          size="small" 
                          color="primary" 
                          variant="outlined" 
                        />
                        <Chip 
                          label={alert.severity === 'high' ? 'Yüksek' : 
                                alert.severity === 'medium' ? 'Orta' : 'Düşük'} 
                          size="small" 
                          color={getSeverityColor(alert.severity)}
                        />
                      </Box>
                    }
                    secondary={
                      <>
                        <Typography component="span" variant="body2" color="text.primary">
                          {alert.message || 'Detay bilgisi yok'}
                        </Typography>
                        <Typography component="div" variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                          {formattedTime}
                        </Typography>
                      </>
                    }
                  />
                </ListItem>
                {index < alerts.length - 1 && <Divider variant="inset" component="li" />}
              </React.Fragment>
            );
          })}
        </List>
      ) : (
        <Alert severity="info">
          Aktif uyarı bulunmamaktadır. Yüksek AQI değeri girildiğinde burada uyarılar görünecektir.
        </Alert>
      )}
    </Box>
  );
};

export default AlertPanel; 