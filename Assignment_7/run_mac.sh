#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required. Install it from https://nodejs.org/ or run: brew install node"
  exit 1
fi
if ! command -v npm >/dev/null 2>&1; then
  echo "npm is missing. Reinstall Node.js from https://nodejs.org/"
  exit 1
fi
if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env using the demo defaults."
fi
if [ ! -d node_modules ]; then
  echo "Installing Node.js dependencies..."
  npm install
fi

if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  echo "Starting the MySQL database with Docker Compose..."
  docker compose up -d db
else
  echo "Docker Compose was not found. Make sure local MySQL is running and schema.sql has been imported."
fi

npm start
