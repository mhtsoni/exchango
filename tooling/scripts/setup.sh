#!/bin/bash

# Development setup script
echo "Setting up SubSwap Telegram MVP..."

# Check if pnpm is installed
if ! command -v pnpm &> /dev/null; then
    echo "Installing pnpm..."
    npm install -g pnpm
fi

# Install dependencies
echo "Installing dependencies..."
pnpm install

# Copy environment file
if [ ! -f .env ]; then
    echo "Creating .env file from template..."
    cp env.example .env
    echo "Please edit .env file with your configuration"
fi

# Start database
echo "Starting PostgreSQL and Redis..."
docker-compose -f infra/docker/docker-compose.yml up -d postgres redis

# Wait for database to be ready
echo "Waiting for database to be ready..."
sleep 10

# Run migrations
echo "Running database migrations..."
pnpm migrate

echo "Setup complete! Run 'pnpm dev' to start development servers."
