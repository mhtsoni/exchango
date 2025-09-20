# Exchango Telegram MVP

## Local Development Setup

### Prerequisites
- Node.js 20+
- pnpm
- Docker & Docker Compose
- PostgreSQL
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
# Telegram (Required)
BOT_TOKEN=your-telegram-bot-token
WEBHOOK_URL=https://yourdomain.com/telegram/webhook
ADMIN_TELEGRAM_ID=your-telegram-id

# Database (Required)
DATABASE_URL=postgres://exchango:exchango@localhost:5432/exchango

# App (Required)
PLATFORM_BASE_URL=https://yourdomain.com
PORT=4000
NODE_ENV=development
```

### Bot Commands

**User Commands:**
- `/start` - Welcome message
- `/sell` - Create listing
- `/browse` - Browse listings
- `/mylistings` - View your listings
- `/help` - Show help

**Admin Commands:**
- `/pending` - View pending listings
- `/verify <id> <approve|reject>` - Verify listings

### API Endpoints

- `POST /api/listings` - Create listing
- `GET /api/listings` - Get listings
- `POST /api/transactions/:id/sold` - Mark as sold
- `GET /api/transactions/:id/contact` - Get contact info

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

### Key Features

✅ **Simple Discovery App** - No payment processing  
✅ **Direct Communication** - Buyers contact sellers via Telegram  
✅ **Telegram File Storage** - Uses Telegram's built-in file system  
✅ **Admin Moderation** - Telegram-based listing verification  
✅ **Minimal Dependencies** - Only 6 environment variables needed  

### User Flow

1. **Seller** creates listing with `/sell`
2. **Admin** approves listing via `/verify`
3. **Buyer** browses with `/browse`
4. **Buyer** contacts seller directly via Telegram
5. **Seller** marks item as sold

### Next Steps

1. Create Telegram bot token via @BotFather
2. Deploy to Railway or your preferred platform
3. Set up webhook URL
4. Start using!

**No AWS, Stripe, or complex integrations required!** 🎉