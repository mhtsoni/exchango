# Exchango Telegram MVP

## Local Development Setup

### Prerequisites
- Node.js 20+
- pnpm
- Docker & Docker Compose
- PostgreSQL
- AWS Account (S3, KMS)
- Stripe Account
- Telegram Bot Token

### Quick Start

1. **Setup Environment**
   ```bash
   cp env.example .env
   # Edit .env with your configuration
   ```

2. **Start Database**
   ```bash
   docker-compose -f infra/docker/docker-compose.yml up -d postgres redis
   ```

3. **Install Dependencies**
   ```bash
   pnpm install
   ```

4. **Run Migrations**
   ```bash
   pnpm migrate
   ```

5. **Start Development Servers**
   ```bash
   pnpm dev
   ```

6. **Setup Webhook (Local)**
   ```bash
   ./tooling/scripts/ngrok.sh
   # Update WEBHOOK_URL in .env
   # Set webhook in BotFather
   ```

### Environment Variables

Required configuration in `.env`:

```env
# Telegram
BOT_TOKEN=your-telegram-bot-token
WEBHOOK_URL=https://yourdomain.com/telegram/webhook
ADMIN_TELEGRAM_ID=your-telegram-id

# Database
DATABASE_URL=postgres://exchango:exchango@localhost:5432/exchango

# AWS
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
S3_BUCKET=your-s3-bucket
AWS_REGION=us-east-1
KMS_KEY_ID=your-kms-key-id

# Stripe
STRIPE_SECRET=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PLATFORM_ACCOUNT_ID=acct_...

# App
PLATFORM_BASE_URL=https://yourdomain.com
PORT=4000
```

### Bot Commands

**User Commands:**
- `/start` - Welcome message
- `/sell` - Create listing
- `/browse` - Browse listings

**Admin Commands:**
- `/pending` - View pending listings
- `/verify <id> <approve|reject>` - Verify listings
- `/refund <id> <reason>` - Process refunds

### API Endpoints

- `POST /api/listings` - Create listing
- `GET /api/listings` - Get listings
- `POST /api/transactions` - Create transaction
- `POST /webhooks/stripe` - Stripe webhook

### Development Commands

```bash
pnpm dev              # Start both services
pnpm dev:bot          # Bot only
pnpm dev:api          # API only
pnpm migrate          # Run migrations
pnpm build            # Build for production
```

### Docker

```bash
# Development
docker-compose -f infra/docker/docker-compose.yml up

# Production
docker-compose -f infra/docker/docker-compose.yml -f docker-compose.prod.yml up
```

### Tasks Completed

✅ Monorepo structure with services/bot and services/api  
✅ Root package.json with workspaces and scripts  
✅ Environment configuration template  
✅ Database migrations and schema  
✅ Telegram bot with grammY (sell/browse/admin commands)  
✅ Express API with routes and webhooks  
✅ Stripe Checkout integration and webhook handling  
✅ AWS KMS encryption for sensitive data  
✅ Admin endpoints and Telegram moderation  
✅ Docker setup for local development  
✅ Comprehensive README with setup instructions  

### Next Steps

1. Create Stripe account and connect platform
2. Configure AWS S3 & KMS
3. Setup Telegram bot token via @BotFather
4. Deploy to production environment
5. Add monitoring and logging
6. Implement additional security measures
