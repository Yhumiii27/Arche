#!/bin/sh
# First start of the compose file's own PostgreSQL (an empty volume): the database `epc2i`, the role arche_app and the
# schema `arche` it owns — the layout of the shared EPC2I server (Matrix's base layer, docs/DEMANDES-MATRIX.md M-1/M-2), so
# that moving to the shared server changes only DATABASE_URL. Runs as the image's superuser.
set -eu
: "${ARCHE_APP_PASSWORD:?ARCHE_APP_PASSWORD is required}"
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -v pw="$ARCHE_APP_PASSWORD" <<'SQL'
CREATE ROLE arche_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD :'pw';
CREATE DATABASE epc2i;
REVOKE CREATE ON DATABASE epc2i FROM arche_app;
GRANT CONNECT ON DATABASE epc2i TO arche_app;
ALTER ROLE arche_app IN DATABASE epc2i SET search_path TO arche;
\connect epc2i
CREATE SCHEMA arche AUTHORIZATION arche_app;
REVOKE ALL ON SCHEMA arche FROM PUBLIC;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
SQL
