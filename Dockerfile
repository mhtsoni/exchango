FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package.json ./
COPY services/bot/package.json ./services/bot/
COPY services/api/package.json ./services/api/
COPY services/api/tsconfig.json ./services/api/

# Install dependencies using npm (no lock file needed)
RUN npm install --no-package-lock

# Install TypeScript globally for building
RUN npm install -g typescript

# Copy source code
COPY services/bot ./services/bot
COPY services/api ./services/api
COPY infra ./infra

# Build API service specifically
RUN cd services/api && npm run build
RUN ls -la /app/services/api/dist/

# Expose port
EXPOSE 4000

# Start API service
CMD ["npm", "run", "start:api"]
