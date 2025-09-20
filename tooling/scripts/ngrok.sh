#!/bin/bash

# Ngrok setup script for local development
echo "Setting up ngrok for local development..."

# Check if ngrok is installed
if ! command -v ngrok &> /dev/null; then
    echo "Please install ngrok first:"
    echo "1. Go to https://ngrok.com/"
    echo "2. Sign up and download ngrok"
    echo "3. Add to your PATH"
    exit 1
fi

# Start ngrok tunnel
echo "Starting ngrok tunnel on port 4000..."
ngrok http 4000

echo "Copy the HTTPS URL and update your WEBHOOK_URL in .env file"
echo "Also update your Telegram bot webhook URL in BotFather"
