FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package.json ./
COPY services/bot/package.json ./services/bot/
COPY services/api/package.json ./services/api/

# Install dependencies using npm (no lock file needed)
RUN npm install --no-package-lock

# Copy source code
COPY services/bot ./services/bot
COPY services/api ./services/api
COPY infra ./infra

# Build both services
RUN npm run build

# Expose port
EXPOSE 4000

# Start API service
CMD ["npm", "run", "start:api"]
