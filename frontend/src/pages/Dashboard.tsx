import React, { useEffect, useState, useRef } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Card,
  CardContent,
  useTheme,
} from '@mui/material';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import axios from 'axios';
import { styled } from '@mui/material/styles';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

mapboxgl.accessToken = 'pk.eyJ1Ijoib3NtYW50YWxheWhhbiIsImEiOiJjbTk4bDhwdDQwM3pvMnJzYnoyN3kwOWZnIn0.AhiHYuOL4GbvJG5mgboDNw';

interface AirQualityData {
  timestamp: string;
  pm25: number;
  pm10: number;
  no2: number;
  so2: number;
  o3: number;
}

const Item = styled(Paper)(({ theme }) => ({
  backgroundColor: theme.palette.mode === 'dark' ? '#1A2027' : '#fff',
  ...theme.typography.body2,
  padding: theme.spacing(2),
  textAlign: 'center',
  color: theme.palette.text.secondary,
  height: '100%',
}));

const Dashboard = () => {
  const theme = useTheme();
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [data, setData] = useState<AirQualityData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (mapContainer.current) {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/light-v10',
        center: [35.5, 39], // Türkiye'nin merkezi
        zoom: 5,
      });

      map.current.on('load', () => {
        // Harita katmanları ve veri noktaları burada eklenecek
      });
    }

    return () => {
      map.current?.remove();
    };
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.get('/api/v1/air-quality/latest');
        setData(response.data);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 60000); // Her dakika güncelle

    return () => clearInterval(interval);
  }, []);

  const chartData = {
    labels: data.map(d => new Date(d.timestamp).toLocaleTimeString()),
    datasets: [
      {
        label: 'PM2.5',
        data: data.map(d => d.pm25),
        borderColor: theme.palette.primary.main,
        tension: 0.4,
      },
      {
        label: 'PM10',
        data: data.map(d => d.pm10),
        borderColor: theme.palette.secondary.main,
        tension: 0.4,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: 'Hava Kalitesi Değişimi',
      },
    },
    scales: {
      y: {
        beginAtZero: true,
      },
    },
  };

  return (
    <Box sx={{ flexGrow: 1 }}>
      <Grid container spacing={3}>
        <Grid item xs={12} md={6} lg={3}>
          <Item>
            <Typography variant="h6" gutterBottom>
              Total Anomalies
            </Typography>
            <Typography variant="h3">24</Typography>
          </Item>
        </Grid>
        <Grid item xs={12} md={6} lg={3}>
          <Item>
            <Typography variant="h6" gutterBottom>
              Active Alerts
            </Typography>
            <Typography variant="h3">5</Typography>
          </Item>
        </Grid>
        <Grid item xs={12} md={6} lg={3}>
          <Item>
            <Typography variant="h6" gutterBottom>
              Resolved Issues
            </Typography>
            <Typography variant="h3">19</Typography>
          </Item>
        </Grid>
        <Grid item xs={12} md={6} lg={3}>
          <Item>
            <Typography variant="h6" gutterBottom>
              System Status
            </Typography>
            <Typography variant="h3" sx={{ color: 'success.main' }}>
              OK
            </Typography>
          </Item>
        </Grid>
        <Grid item xs={12}>
          <Item sx={{ height: 'calc(100vh - 400px)', minHeight: '500px' }}>
            <Typography variant="h6" gutterBottom>
              Hava Kalitesi Haritası
            </Typography>
            <Box
              ref={mapContainer}
              sx={{
                height: 'calc(100% - 40px)',
                width: '100%'
              }}
            />
          </Item>
        </Grid>
        <Grid item xs={12}>
          <Item>
            <Typography variant="h6" gutterBottom>
              Hava Kalitesi Değişimi
            </Typography>
            {!loading && data.length > 0 && (
              <Line options={chartOptions} data={chartData} />
            )}
          </Item>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard; 