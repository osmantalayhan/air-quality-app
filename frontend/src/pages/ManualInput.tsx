import React, { useState } from 'react';
import { Box, Typography, Paper, TextField, Button, Grid, MenuItem, Alert, Snackbar, CircularProgress } from '@mui/material';
import axios, { AxiosError } from 'axios';

// API yanıt tipi
interface ApiResponse {
  status: string;
  message: string;
  data: {
    sensor_id: number;
    location: string;
    latitude: number;
    longitude: number;
    timestamp: string;
    pm25: number;
    pm10: number;
    no2: number;
    so2: number;
    o3: number;
    aqi: number;
  };
}

// Alternatif API yanıt tipi (backend'in gerçek dönüş formatı)
interface AlternativeApiResponse {
  timestamp: string;
  location: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  measurements: {
    pm25: number;
    pm10: number;
    no2: number;
    so2: number;
    o3: number;
    aqi: number;
  };
  sensor_id?: number;
}

// Bileşen props tipi
interface ManualInputProps {
  onDataSubmitted?: () => void; // Veri gönderimi başarılı olduğunda çağrılacak callback
}

const pollutantOptions = [
  { value: 'pm25', label: 'PM2.5' },
  { value: 'pm10', label: 'PM10' },
  { value: 'no2', label: 'NO2' },
  { value: 'so2', label: 'SO2' },
  { value: 'o3', label: 'O3' },
  { value: 'aqi', label: 'Hava Kalitesi İndeksi (AQI)' }
];

const calculateAQI = (parameter: string, value: number): number => {
  switch (parameter) {
    case 'pm25':
      return Math.min(500, Math.round(value * 4));
    case 'pm10':
      return Math.min(500, Math.round(value * 2));
    case 'no2':
      return Math.min(500, Math.round(value * 5));
    case 'so2':
      return Math.min(500, Math.round(value * 10));
    case 'o3':
      return Math.min(500, Math.round(value * 3));
    case 'aqi':
      return Math.min(500, Math.round(value));
    default:
      return 50;
  }
};

const ManualInput: React.FC<ManualInputProps> = ({ onDataSubmitted }) => {
  const [location, setLocation] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [parameter, setParameter] = useState('pm25');
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [responseData, setResponseData] = useState<ApiResponse | AlternativeApiResponse | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!location || !latitude || !longitude || !parameter || !value) {
      setError('Lütfen tüm alanları doldurun.');
      return;
    }

    // Değerlerin sayı olup olmadığını kontrol ettim
    const latValue = parseFloat(latitude);
    const lngValue = parseFloat(longitude);
    const pollutantValue = parseFloat(value);

    if (isNaN(latValue) || isNaN(lngValue) || isNaN(pollutantValue)) {
      setError('Enlem, boylam ve değer alanları sayı olmalıdır.');
      return;
    }

    try {
      setLoading(true);
      
      // AQI değerini hesapla
      const aqiValue = calculateAQI(parameter, pollutantValue);
      
      // Sadece seçilen parametreyi ve gerekli bilgileri gönder
      const requestData = {
        location,
        latitude: latValue,
        longitude: lngValue,
        aqi: aqiValue // AQI her zaman gönderilmeli
      };
      
      // Seçilen parametreyi ekle
      if (parameter !== 'aqi') {
        requestData[parameter] = pollutantValue;
      }
      
      console.log('Gönderilen veri:', requestData);
      
      const response = await axios.post<ApiResponse | AlternativeApiResponse>(
        'http://localhost:8000/api/v1/air-quality/manual-input', 
        requestData
      );

      console.log('API yanıtı:', response.data);
      setResponseData(response.data);
      setSuccess(true);
      setError('');
      
      // Formu temizle
      setLocation('');
      setLatitude('');
      setLongitude('');
      setParameter('pm25');
      setValue('');
      
      if (onDataSubmitted) {
        console.log('Veri başarıyla gönderildi, sayfa yenileniyor...');
        
        alert(`${parameter.toUpperCase()} değeri (${value}) başarıyla güncellendi! Sayfa yenileniyor...`);
        
        onDataSubmitted();
      }
    } catch (err) {
      console.error('API hatası:', err);
      const axiosError = err as AxiosError<{message: string}>;
      setError(axiosError.response?.data?.message || 'Veri gönderilemedi. Lütfen tekrar deneyin.');
      setSuccess(false);
    } finally {
      setLoading(false);
    }
  };

  const renderResponseData = () => {
    if (!responseData || !success) return null;
    
    if ('data' in responseData) {
      const data = responseData.data;
      return (
        <Paper sx={{ p: 3, bgcolor: '#e8f5e9', color: '#1b5e20' }}>
          <Typography variant="h6" gutterBottom>Veri başarıyla gönderildi!</Typography>
          <Box sx={{ mt: 2 }}>
            <Typography variant="body1">Konum: {data.location}</Typography>
            <Typography variant="body1">Sensör ID: {data.sensor_id}</Typography>
            <Typography variant="body1">AQI: {data.aqi}</Typography>
            <Typography variant="body1">PM2.5: {data.pm25}</Typography>
            <Typography variant="body1">PM10: {data.pm10}</Typography>
            <Typography variant="body1">NO2: {data.no2}</Typography>
            <Typography variant="body1">SO2: {data.so2}</Typography>
            <Typography variant="body1">O3: {data.o3}</Typography>
            <Typography variant="body1">Zaman: {data.timestamp ? new Date(data.timestamp).toLocaleString() : ''}</Typography>
          </Box>
        </Paper>
      );
    } else {
      return (
        <Paper sx={{ p: 3, bgcolor: '#e8f5e9', color: '#1b5e20' }}>
          <Typography variant="h6" gutterBottom>Veri başarıyla gönderildi!</Typography>
          <Box sx={{ mt: 2 }}>
            <Typography variant="body1">Konum: {responseData.location}</Typography>
            <Typography variant="body1">Sensör ID: {responseData.sensor_id || 'N/A'}</Typography>
            <Typography variant="body1">AQI: {responseData.measurements?.aqi}</Typography>
            <Typography variant="body1">PM2.5: {responseData.measurements?.pm25}</Typography>
            <Typography variant="body1">PM10: {responseData.measurements?.pm10}</Typography>
            <Typography variant="body1">NO2: {responseData.measurements?.no2}</Typography>
            <Typography variant="body1">SO2: {responseData.measurements?.so2}</Typography>
            <Typography variant="body1">O3: {responseData.measurements?.o3}</Typography>
            <Typography variant="body1">Zaman: {responseData.timestamp ? new Date(responseData.timestamp).toLocaleString() : ''}</Typography>
          </Box>
        </Paper>
      );
    }
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Manuel Hava Kalitesi Veri Girişi
      </Typography>
      <Paper sx={{ p: 3, mb: 3 }}>
        <form onSubmit={handleSubmit}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Typography variant="body1" gutterBottom>
                Bu sayfayı kullanarak sisteme manuel hava kalitesi verisi gönderebilirsiniz.
              </Typography>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Konum Adı"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                required
                helperText="Örnek: İstanbul, Ankara, İzmir"
              />
            </Grid>
            
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                label="Enlem"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                required
                helperText="Örnek: 41.0082"
              />
            </Grid>
            
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                label="Boylam"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                required
                helperText="Örnek: 28.9784"
              />
            </Grid>
            
            <Grid item xs={12} md={6}>
              <TextField
                select
                fullWidth
                label="Ölçüm Parametresi"
                value={parameter}
                onChange={(e) => setParameter(e.target.value)}
                required
                helperText="Ölçüm yapmak istediğiniz parametreyi seçin"
              >
                {pollutantOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Ölçüm Değeri"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                required
                helperText="Ölçüm değerini girin"
                type="number"
              />
            </Grid>
            
            <Grid item xs={12}>
              <Button 
                type="submit" 
                variant="contained" 
                color="primary" 
                disabled={loading}
                sx={{ mt: 2 }}
              >
                {loading ? <CircularProgress size={24} /> : 'Veri Gönder'}
              </Button>
            </Grid>
          </Grid>
        </form>
      </Paper>

      {renderResponseData()}

      <Snackbar open={!!error} autoHideDuration={6000} onClose={() => setError('')}>
        <Alert onClose={() => setError('')} severity="error" sx={{ width: '100%' }}>
          {error}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default ManualInput; 
