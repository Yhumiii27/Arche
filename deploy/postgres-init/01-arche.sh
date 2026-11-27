#!/bin/sh
# First start of the compose file's own PostgreSQL (an empty volume): the database ARCHE_DATABASE (set by the compose file
# from ATRIUM_PG_DATABASE, default `epc2i`, today's name on the shared server; `atrium` after Matrix's rename), the role
# arche_app and the schema `arche` it owns — the layout of the shared server of the Atrium suite (Matrix's base layer,
# docs/DEMANDES-MATRIX.md M-1/M-2), so that moving to the shared server changes only DATABASE_URL. Runs as the image's
# superuser.
set -eu
: "${ARCHE_APP_PASSWORD:?ARCHE_APP_PASSWORD is required}"
DB="${ARCHE_DATABASE:-epc2i}"
case "$DB" in *[!a-z0-9_]*|'') echo "ARCHE_DATABASE must be a lower-case identifier" >&2; exit 1 ;; esac
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -v pw="$ARCHE_APP_PASSWORD" -v db="$DB" <<'SQL'
CREATE ROLE arche_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD :'pw';
CREATE DATABASE :"db";
REVOKE CREATE ON DATABASE :"db" FROM arche_app;
GRANT CONNECT ON DATABASE :"db" TO arche_app;
ALTER ROLE arche_app IN DATABASE :"db" SET search_path TO arche;
\connect :db
CREATE SCHEMA arche AUTHORIZATION arche_app;
REVOKE ALL ON SCHEMA arche FROM PUBLIC;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
SQL
