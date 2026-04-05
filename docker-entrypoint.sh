#!/bin/sh
set -e

echo "Waiting for PostgreSQL to be ready..."

max_attempts=30
attempt=0

while [ $attempt -lt $max_attempts ]; do
  if pg_isready -h "$DB_HOST" -U "$DB_USER" > /dev/null 2>&1; then
    echo "PostgreSQL is ready!"
    break
  fi
  attempt=$((attempt + 1))
  echo "Attempt $attempt/$max_attempts: PostgreSQL not ready yet, waiting..."
  sleep 2
done

if [ $attempt -eq $max_attempts ]; then
  echo "Error: PostgreSQL did not become ready in time"
  exit 1
fi

echo "Running database migrations..."
npx prisma migrate deploy

echo "Starting application..."
exec node dist/index.js
