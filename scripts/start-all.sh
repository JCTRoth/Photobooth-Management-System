#!/usr/bin/env bash
set -euo pipefail

echo "Starting Photobooth Management System..."
echo ""

# Start PostgreSQL database
echo "Starting PostgreSQL database..."
docker compose up db -d

# Wait for database to be ready
echo "Waiting for database to be ready..."
sleep 5

# Check if database is ready
echo "Checking database connection..."
until docker compose exec -T db pg_isready -U photobooth -d photobooth > /dev/null 2>&1; do
  echo "Database not ready, waiting..."
  sleep 2
done
echo "Database is ready!"

# Apply database migrations
echo "Applying database migrations..."
npm run api:db-update
echo "Migrations applied!"

# Start API and web services
echo "Starting API and web services..."
echo "   - API will be available at: http://localhost:5000"
echo "   - Web interface will be available at: http://localhost:5173"
echo "   - Database is available at: localhost:5433"
echo ""
npm run dev