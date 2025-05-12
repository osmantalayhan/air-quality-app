FROM timescale/timescaledb:latest-pg14

# Copy initialization scripts
COPY docker/init.sql /docker-entrypoint-initdb.d/

# Set default configuration for TimescaleDB
COPY docker/postgresql.conf /etc/postgresql/postgresql.conf

CMD ["postgres", "-c", "config_file=/etc/postgresql/postgresql.conf"] 