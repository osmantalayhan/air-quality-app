/**
 * AQI seviyesini hesaplar ve renk/etiket bilgisini döndürür
 * @param {number} aqi - AQI değeri
 * @returns {Object} - { label: string, color: string, bgColor: string, textColor: string, description: string }
 */
export const calculateAQILevel = (aqi) => {
  // Geçersiz veya eksik değer kontrolü
  const numAqi = parseFloat(aqi);
  if (isNaN(numAqi) || numAqi === undefined || numAqi === null) {
    return {
      label: 'Bilinmiyor',
      color: 'default',
      bgColor: '#f5f5f5',
      textColor: '#666666',
      description: 'Veri bulunmuyor',
    };
  }
  
  if (numAqi <= 50) {
    return {
      label: 'İyi',
      color: 'success',
      bgColor: 'rgba(76, 175, 80, 0.1)',
      textColor: '#1b5e20',
      description: 'Solunum için uygun hava kalitesi'
    };
  } else if (numAqi <= 100) {
    return {
      label: 'Orta',
      color: 'warning',
      bgColor: 'rgba(255, 235, 59, 0.15)',
      textColor: '#795548',
      description: 'Hassas gruplar için uyarı'
    };
  } else if (numAqi <= 150) {
    return {
      label: 'Hassas Gruplar İçin Sağlıksız',
      color: 'warning',
      bgColor: 'rgba(255, 152, 0, 0.15)',
      textColor: '#e65100',
      description: 'Çocuklar ve yaşlılar etkilenebilir'
    };
  } else if (numAqi <= 200) {
    return {
      label: 'Sağlıksız',
      color: 'error',
      bgColor: 'rgba(244, 67, 54, 0.1)',
      textColor: '#b71c1c',
      description: 'Herkes sağlık etkileri yaşayabilir'
    };
  } else if (numAqi <= 300) {
    return {
      label: 'Çok Sağlıksız',
      color: 'error',
      bgColor: 'rgba(156, 39, 176, 0.1)',
      textColor: '#4a148c',
      description: 'Acil sağlık uyarısı, dışarı çıkmayın'
    };
  } else {
    return {
      label: 'Tehlikeli',
      color: 'error',
      bgColor: 'rgba(121, 85, 72, 0.15)',
      textColor: '#3e2723',
      description: 'Ciddi sağlık riski, tüm aktiviteleri kısıtlayın'
    };
  }
}; 