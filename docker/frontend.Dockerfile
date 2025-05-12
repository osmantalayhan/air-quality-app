FROM node:18-alpine

WORKDIR /app

# Install dependencies first for better caching
COPY frontend/package.json frontend/package-lock.json ./
RUN npm install

# Copy the rest of the application
COPY frontend .

# Start the application in development mode
CMD ["npm", "start"] 