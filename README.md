# Exchango Telegram MVP

A Telegram-first discovery marketplace for digital subscriptions and event tickets. Users can post listings, browse items, and communicate directly with sellers. Built with Node.js, TypeScript, grammY, Express, PostgreSQL, and Telegram's built-in file storage.

## 🚀 Features

- **Telegram Bot Interface**: Complete marketplace experience within Telegram
- **Direct Communication**: Buyers and sellers communicate directly via Telegram
- **Telegram File Storage**: Uses Telegram's built-in file system for proof documents
- **Admin Moderation**: Telegram-based admin commands for listing verification
- **Simple Discovery**: Browse, contact, and mark items as sold
- **No External Dependencies**: No AWS, Stripe, or complex integrations required

## 🏗️ Architecture

```
exchango/
├─ services/
│  ├─ bot/                       # grammY Telegram bot
│  └─ api/                       # Express backend (API + admin)
├─ infra/
│  ├─ docker/                    # Dockerfile & docker-compose
│  └─ migrations/                # Knex migrations (Postgres)
├─ tooling/
│  ├─ scripts/                   # helpers (setup, ngrok)
├─ README.md
├─ env.example
└─ package.json
```

## 🛠️ Tech Stack

- **Backend**: Node.js 20+, TypeScript, Express
- **Bot**: grammY (Telegram Bot API)
- **Database**: PostgreSQL with Knex migrations
- **File Storage**: Telegram's built-in file system
- **DevOps**: Docker, Docker Compose

## 📋 Prerequisites

- Node.js 20+
- pnpm
- Docker & Docker Compose
- PostgreSQL
- Telegram Bot Token

## 🚀 Quick Start

### 1. Clone and Setup

```bash
git clone https://github.com/mhtsoni/exchango.git
cd exchango
./tooling/scripts/setup.sh
```

### 2. Configure Environment

Copy `env.example` to `.env` and fill in your values:

```bash
cp env.example .env
```

Required environment variables:

```env
# Telegram
BOT_TOKEN=your-telegram-bot-token
WEBHOOK_URL=https://yourdomain.com/telegram/webhook
ADMIN_TELEGRAM_ID=your-telegram-id

# Database
DATABASE_URL=postgres://exchango:exchango@localhost:5432/exchango

# App
PLATFORM_BASE_URL=https://yourdomain.com
PORT=4000
```

### 3. Start Development Environment

```bash
# Start database services
docker-compose -f infra/docker/docker-compose.yml up -d postgres redis

# Run migrations
pnpm migrate

# Start development servers
pnpm dev
```

### 4. Setup Webhook (Local Development)

For local development, use ngrok:

```bash
./tooling/scripts/ngrok.sh
```

Copy the HTTPS URL and update:
1. `WEBHOOK_URL` in your `.env` file
2. Set webhook URL in BotFather: `https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=<NGROK_URL>/webhooks/telegram`

## 📱 Bot Commands

### User Commands
- `/start` - Welcome message and instructions
- `/sell` - Create a new listing
- `/browse` - Browse active listings
- `/mylistings` - View your own listings
- `/help` - Show help message

### Admin Commands
- `/pending` - View pending listings
- `/verify <listingId> <approve|reject>` - Approve or reject listings

## 🔧 API Endpoints

### Listings
- `POST /api/listings` - Create listing
- `GET /api/listings` - Get listings (with filters)
- `GET /api/listings/:id` - Get single listing

### Transactions (Simplified)
- `POST /api/transactions/:id/sold` - Mark listing as sold
- `GET /api/transactions/:id/contact` - Get seller contact info

### Admin
- `GET /api/admin/listings/pending` - Get pending listings
- `POST /api/admin/listings/:id/verify` - Verify listing

## 🔐 Security Features

- **Rate Limiting**: API endpoints protected with rate limits
- **Input Validation**: All inputs validated and sanitized
- **Secure Headers**: Helmet.js security headers
- **Telegram File Access**: Files accessible only via Telegram API

## 🏦 User Flow

1. **Seller** creates listing with `/sell`
2. **Admin** approves listing via `/verify`
3. **Buyer** browses with `/browse`
4. **Buyer** clicks "Contact Seller" to get seller's Telegram info
5. **Buyer** contacts seller directly via Telegram
6. **Seller** marks item as sold with "Mark as Sold" button

## 🐳 Docker Deployment

### Development
```bash
docker-compose -f infra/docker/docker-compose.yml up
```

### Production
```bash
# Build images
docker build -f infra/docker/Dockerfile.api -t exchango-api .
docker build -f infra/docker/Dockerfile.bot -t exchango-bot .

# Run with production environment
docker-compose -f infra/docker/docker-compose.yml -f docker-compose.prod.yml up
```

## 🧪 Testing

```bash
# Run tests
pnpm test

# Run migrations
pnpm migrate

# Rollback migrations
pnpm migrate:rollback
```

## 📊 Database Schema

### Users
- Telegram ID, username, display name
- KYC status, rating

### Listings
- Title, description, price
- Delivery type (code/file/manual)
- Telegram file path for proof
- Verification status

### Transactions (Simplified)
- Listing reference
- Sold status

## 🔧 Development Scripts

```bash
# Development
pnpm dev              # Start both bot and API
pnpm dev:bot          # Start bot only
pnpm dev:api          # Start API only

# Database
pnpm migrate          # Run migrations
pnpm migrate:rollback # Rollback migrations

# Build
pnpm build            # Build all services
pnpm start            # Start production servers
```

## 🚨 Troubleshooting

### Common Issues

1. **Bot not responding**: Check BOT_TOKEN and webhook URL
2. **Database connection failed**: Ensure PostgreSQL is running
3. **File upload failed**: Check Telegram bot permissions
4. **Webhook not working**: Verify webhook URL is accessible

### Logs

```bash
# View API logs
docker-compose logs -f api

# View bot logs
docker-compose logs -f bot

# View database logs
docker-compose logs -f postgres
```

## 📈 Monitoring

- **Health Check**: `GET /health`
- **Structured Logging**: JSON format logs
- **Error Tracking**: Console error logging
- **Metrics**: Transaction counts, listing stats

## 🔄 Background Jobs

- **Auto-cleanup**: Remove expired listings
- **Notifications**: Remind sellers to update listings
- **Cleanup**: Remove old file references

## 📝 License

MIT License - see LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📞 Support

For support, please open an issue or contact the development team.

---

**Note**: This is a simplified discovery app focused on connecting buyers and sellers. No payment processing or complex integrations required.