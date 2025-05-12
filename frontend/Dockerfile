FROM node:18-alpine

WORKDIR /app

# Önce package.json dosyasını kopyala
COPY package*.json ./

# Tüm bağımlılıkları kur (--force ile bağımlılık sorunlarını çöz)
RUN npm install --force

# Tüm kodları kopyala
COPY . .

# Port değerini ve gerekli çevre değişkenlerini ayarla
ENV PORT=3000
ENV HOST=0.0.0.0
ENV WDS_SOCKET_PORT=0
ENV DANGEROUSLY_DISABLE_HOST_CHECK=true

EXPOSE 3000

# Uygulamayı başlat
CMD ["npm", "start"] 