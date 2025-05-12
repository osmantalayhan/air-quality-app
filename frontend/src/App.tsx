import React from 'react';
import './App.css';
import { ThemeProvider } from '@mui/material/styles';
import { CssBaseline } from '@mui/material';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import theme from './theme';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Anomalies from './pages/Anomalies';
import AnomalyDetail from './pages/AnomalyDetail';
import Settings from './pages/Settings';
import ManualInput from './pages/ManualInput';
import { SnackbarProvider } from './contexts/SnackbarContext';

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <SnackbarProvider>
        <Router>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="anomalies" element={<Anomalies />} />
              <Route path="anomalies/:id" element={<AnomalyDetail />} />
              <Route path="settings" element={<Settings />} />
              <Route path="manual-input" element={<ManualInput onDataSubmitted={() => {
                // Manuel veri girişi yapıldıktan sonra sayfayı yenileyelim
                // Backend'in veriyi işlemesi için biraz bekleyelim
                console.log("Manuel veri girişi başarılı, sayfa yenilenecek...");
                setTimeout(() => {
                  console.log("Sayfa yenileniyor...");
                  // Tam bir sayfa yenilemesi için location.href kullan
                  window.location.href = window.location.origin;
                }, 1500); // 1.5 saniye bekle
              }} />} />
            </Route>
          </Routes>
        </Router>
      </SnackbarProvider>
    </ThemeProvider>
  );
}

export default App; 