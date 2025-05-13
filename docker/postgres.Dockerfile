FROM timescale/timescaledb:latest-pg14

COPY docker/init.sql /docker-entrypoint-initdb.d/

COPY docker/postgresql.conf /etc/postgresql/postgresql.conf

CMD ["postgres", "-c", "config_file=/etc/postgresql/postgresql.conf"] 
