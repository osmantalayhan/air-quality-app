import React, { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Box } from '@mui/material';

mapboxgl.accessToken = '{mapbox_token}';

const Map: React.FC = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);

  useEffect(() => {
    if (mapContainer.current) {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [35.243322, 38.963745], // Türkiye'nin merkezi
        zoom: 6
      });

      map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
    }

    return () => {
      map.current?.remove();
    };
  }, []);

  return (
    <Box
      ref={mapContainer}
      sx={{
        height: 'calc(100vh - 64px)', // AppBar yüksekliğini çıkarıyoruz
        width: '100%'
      }}
    />
  );
};

export default Map; 
