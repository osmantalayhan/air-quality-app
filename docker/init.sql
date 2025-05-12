-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

-- Create air quality measurements table
CREATE TABLE IF NOT EXISTS air_quality_measurements (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    pm25 DOUBLE PRECISION,
    pm10 DOUBLE PRECISION,
    no2 DOUBLE PRECISION,
    so2 DOUBLE PRECISION,
    o3 DOUBLE PRECISION,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Convert to hypertable
SELECT create_hypertable('air_quality_measurements', 'timestamp');

-- Create index for geospatial queries
CREATE INDEX idx_air_quality_location 
ON air_quality_measurements (latitude, longitude);

-- Create index for timestamp queries
CREATE INDEX idx_air_quality_timestamp 
ON air_quality_measurements (timestamp DESC);

-- Create anomalies table
CREATE TABLE IF NOT EXISTS anomalies (
    id SERIAL PRIMARY KEY,
    measurement_id INTEGER REFERENCES air_quality_measurements(id),
    parameter VARCHAR(10) NOT NULL,
    threshold_value DOUBLE PRECISION NOT NULL,
    actual_value DOUBLE PRECISION NOT NULL,
    detected_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'ACTIVE'
); 