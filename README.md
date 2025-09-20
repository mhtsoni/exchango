# SubSwap Telegram MVP

A Telegram-first marketplace for buying and selling transferable digital subscriptions and event tickets. Built with Node.js, TypeScript, grammY, Express, PostgreSQL, Stripe Connect, and AWS services.

## 🚀 Features

- **Telegram Bot Interface**: Complete marketplace experience within Telegram
- **Secure Payments**: Stripe Connect integration with escrow system
- **Encrypted Storage**: AWS KMS encryption for sensitive data
- **Admin Moderation**: Telegram-based admin commands for listing verification
- **Dispute Resolution**: Built-in dispute handling system
- **File Storage**: AWS S3 integration for proof documents

## 🏗️ Architecture

```
exchango/
├─ services/
│  ├─ bot/                       # grammY Telegram bot
│  └─ api/                       # Express backend (API + webhooks + admin)
├─ infra/
│  ├─ docker/                    # Dockerfile & docker-compose
│  └─ migrations/                # Knex migrations (Postgres)
├─ tooling/
│  ├─ scripts/                   # helpers (seed, ngrok)
├─ README.md
├─ env.example
└─ package.json
```

## 🛠️ Tech Stack

- **Backend**: Node.js 20+, TypeScript, Express
- **Bot**: grammY (Telegram Bot API)
- **Database**: PostgreSQL with Knex migrations
- **Payments**: Stripe Connect
- **Storage**: AWS S3, AWS KMS
- **DevOps**: Docker, Docker Compose

## 📋 Prerequisites

- Node.js 20+
- pnpm
- Docker & Docker Compose
- PostgreSQL
- AWS Account (S3, KMS)
- Stripe Account
- Telegram Bot Token

## 🚀 Quick Start

### 1. Clone and Setup

```bash
git clone <repository-url>
cd subswap-telegram-mvp
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

### Admin Commands
- `/pending` - View pending listings
- `/verify <listingId> <approve|reject>` - Approve or reject listings
- `/refund <transactionId> <reason>` - Process refunds

## 🔧 API Endpoints

### Listings
- `POST /api/listings` - Create listing
- `GET /api/listings` - Get listings (with filters)
- `GET /api/listings/:id` - Get single listing

### Transactions
- `POST /api/transactions` - Create transaction
- `POST /api/transactions/:id/confirm` - Confirm delivery
- `POST /api/transactions/:id/dispute` - Open dispute

### Admin
- `GET /api/admin/listings/pending` - Get pending listings
- `POST /api/admin/listings/:id/verify` - Verify listing
- `POST /api/admin/transactions/:id/refund` - Process refund

### Webhooks
- `POST /webhooks/stripe` - Stripe webhook handler

## 🔐 Security Features

- **Encryption**: All sensitive codes encrypted with AWS KMS
- **Rate Limiting**: API endpoints protected with rate limits
- **Webhook Verification**: Stripe webhook signature verification
- **Input Validation**: All inputs validated and sanitized
- **Secure Headers**: Helmet.js security headers

## 🏦 Payment Flow

1. **Buyer** clicks "Buy" on a listing
2. **System** creates Stripe Checkout Session
3. **Buyer** completes payment
4. **Stripe** sends webhook to confirm payment
5. **System** holds funds in escrow
6. **Seller** delivers item
7. **Buyer** confirms delivery
8. **System** releases funds to seller (minus platform fee)

## 🛡️ Dispute Resolution

1. **User** opens dispute via bot command
2. **Admin** reviews dispute via admin commands
3. **Admin** resolves dispute (refund buyer or release funds)
4. **System** processes resolution automatically

## 🐳 Docker Deployment

### Development
```bash
docker-compose -f infra/docker/docker-compose.yml up
```

### Production
```bash
# Build images
docker build -f infra/docker/Dockerfile.api -t subswap-api .
docker build -f infra/docker/Dockerfile.bot -t subswap-bot .

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
- Stripe account ID (for sellers)

### Listings
- Title, description, price
- Delivery type (code/file/manual)
- Encrypted code storage
- Verification status

### Transactions
- Buyer/seller references
- Payment status, escrow status
- Stripe session ID

### Deliveries
- Transaction reference
- Encrypted delivery data
- Timestamp

### Disputes
- Transaction reference
- Opener, status, resolution

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
3. **Stripe webhook failed**: Verify webhook secret and URL
4. **S3 upload failed**: Check AWS credentials and bucket permissions
5. **KMS encryption failed**: Verify KMS key ID and permissions

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
- **Metrics**: Transaction counts, dispute rates

## 🔄 Background Jobs

- **Auto-release**: Release escrow after X days if no dispute
- **Notifications**: Remind sellers to deliver items
- **Cleanup**: Remove expired listings

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

**Note**: This is an MVP implementation. For production use, consider additional security measures, monitoring, and scalability improvements.
