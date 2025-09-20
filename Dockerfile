FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package.json ./
COPY pnpm-lock.yaml ./
COPY services/bot/package.json ./services/bot/
COPY services/api/package.json ./services/api/

# Install pnpm and dependencies
RUN npm install -g pnpm
RUN pnpm install

# Copy source code
COPY services/bot ./services/bot
COPY services/api ./services/api
COPY infra ./infra

# Build both services
RUN pnpm build

# Expose port
EXPOSE 4000

# Start API service
CMD ["pnpm", "--filter", "api", "start"]
