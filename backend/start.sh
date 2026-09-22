#!/bin/bash
set -e

echo "===== [1/2] Running Alembic Migrations ====="
alembic upgrade head

echo "===== [2/2] Starting Uvicorn Server ====="
exec uvicorn app.main:get_app \
    --factory \
    --host 0.0.0.0 \
    --port "${PORT:-8000}" \
    --workers 1 \
    --proxy-headers \
    --forwarded-allow-ips="*"
