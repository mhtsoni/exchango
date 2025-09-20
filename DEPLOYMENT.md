# Exchango Deployment Guide

## 🚀 Quick Deploy Options

### Option 1: Railway (Recommended for MVP)

1. **Sign up** at [railway.app](https://railway.app)
2. **Connect GitHub** repository
3. **Add services:**
   - PostgreSQL database
   - Deploy from GitHub
4. **Set environment variables:**
   ```
   BOT_TOKEN=your-bot-token
   WEBHOOK_URL=https://your-app.railway.app/webhooks/telegram
   DATABASE_URL=postgresql://postgres:password@host:port/railway
   STRIPE_SECRET=sk_live_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   AWS_ACCESS_KEY_ID=your-key
   AWS_SECRET_ACCESS_KEY=your-secret
   S3_BUCKET=your-bucket
   AWS_REGION=us-east-1
   KMS_KEY_ID=your-kms-key
   PLATFORM_BASE_URL=https://your-app.railway.app
   ADMIN_TELEGRAM_ID=your-telegram-id
   ```
5. **Deploy** - Railway handles the rest!

### Option 2: Render

1. **Sign up** at [render.com](https://render.com)
2. **Create Web Service** from GitHub
3. **Add PostgreSQL** database
4. **Set environment variables** (same as above)
5. **Deploy**

### Option 3: DigitalOcean App Platform

1. **Sign up** at [digitalocean.com](https://digitalocean.com)
2. **Create App** from GitHub
3. **Add components:**
   - API service
   - Bot worker
   - Managed PostgreSQL
4. **Configure environment variables**
5. **Deploy**

## 🔧 Production Setup Steps

### 1. Environment Configuration

Create production `.env`:

```env
# Telegram
BOT_TOKEN=your-production-bot-token
WEBHOOK_URL=https://yourdomain.com/webhooks/telegram
ADMIN_TELEGRAM_ID=your-telegram-id

# Database
DATABASE_URL=postgresql://user:pass@host:port/db

# AWS
AWS_ACCESS_KEY_ID=your-production-key
AWS_SECRET_ACCESS_KEY=your-production-secret
S3_BUCKET=your-production-bucket
AWS_REGION=us-east-1
KMS_KEY_ID=your-production-kms-key

# Stripe
STRIPE_SECRET=sk_live_your_live_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
STRIPE_PLATFORM_ACCOUNT_ID=acct_your_account

# App
PLATFORM_BASE_URL=https://yourdomain.com
PORT=4000
NODE_ENV=production
```

### 2. Database Setup

```bash
# Run migrations
pnpm migrate

# Or with Docker
docker-compose exec api pnpm migrate
```

### 3. Telegram Bot Setup

1. **Create bot** with [@BotFather](https://t.me/botfather)
2. **Set webhook:**
   ```bash
   curl -X POST "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook" \
        -H "Content-Type: application/json" \
        -d '{"url": "https://yourdomain.com/webhooks/telegram"}'
   ```

### 4. Stripe Setup

1. **Create Stripe account**
2. **Enable Connect** in dashboard
3. **Set webhook endpoint:** `https://yourdomain.com/webhooks/stripe`
4. **Configure webhook events:**
   - `checkout.session.completed`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`

### 5. AWS Setup

1. **Create S3 bucket** for file storage
2. **Create KMS key** for encryption
3. **Set up IAM user** with required permissions:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": [
           "s3:PutObject",
           "s3:GetObject",
           "s3:DeleteObject"
         ],
         "Resource": "arn:aws:s3:::your-bucket/*"
       },
       {
         "Effect": "Allow",
         "Action": [
           "kms:Encrypt",
           "kms:Decrypt",
           "kms:GenerateDataKey"
         ],
         "Resource": "arn:aws:kms:region:account:key/your-key-id"
       }
     ]
   }
   ```

## 🐳 Docker Production Deployment

### Using Docker Compose

```bash
# Production docker-compose.yml
version: '3.8'
services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: exchango
      POSTGRES_USER: exchango
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    restart: unless-stopped

  api:
    build: .
    environment:
      DATABASE_URL: postgres://exchango:${DB_PASSWORD}@postgres:5432/exchango
      NODE_ENV: production
    depends_on:
      - postgres
      - redis
    restart: unless-stopped
    ports:
      - "4000:4000"

  bot:
    build: .
    environment:
      DATABASE_URL: postgres://exchango:${DB_PASSWORD}@postgres:5432/exchango
      NODE_ENV: production
    depends_on:
      - postgres
      - api
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
```

### Deploy Commands

```bash
# Build and start
docker-compose up -d

# View logs
docker-compose logs -f

# Update
git pull
docker-compose down
docker-compose up -d --build
```

## 🔒 Security Checklist

- [ ] Use HTTPS in production
- [ ] Set secure database passwords
- [ ] Configure AWS IAM permissions properly
- [ ] Use production Stripe keys
- [ ] Set up proper CORS policies
- [ ] Enable rate limiting
- [ ] Set up monitoring and logging
- [ ] Configure backup strategy

## 📊 Monitoring

### Health Checks

```bash
# API health
curl https://yourdomain.com/health

# Database connection
curl https://yourdomain.com/api/listings
```

### Logs

```bash
# Docker logs
docker-compose logs -f api
docker-compose logs -f bot

# Application logs
tail -f /var/log/exchango/api.log
tail -f /var/log/exchango/bot.log
```

## 🚨 Troubleshooting

### Common Issues

1. **Bot not responding:**
   - Check BOT_TOKEN
   - Verify webhook URL
   - Check bot logs

2. **Database connection failed:**
   - Verify DATABASE_URL
   - Check database is running
   - Run migrations

3. **Stripe webhook failed:**
   - Verify webhook secret
   - Check webhook URL is accessible
   - Test with Stripe CLI

4. **S3 upload failed:**
   - Check AWS credentials
   - Verify bucket permissions
   - Check region settings

### Debug Commands

```bash
# Test database connection
psql $DATABASE_URL -c "SELECT 1;"

# Test Stripe connection
curl -u sk_test_...: https://api.stripe.com/v1/charges

# Test S3 access
aws s3 ls s3://your-bucket/
```

## 💰 Cost Estimates

| Platform | Monthly Cost | Features |
|----------|-------------|----------|
| Railway | $5-20 | Easy setup, built-in DB |
| Render | $0-15 | Free tier, simple |
| DigitalOcean | $12-25 | Reliable, good support |
| AWS | $20-50 | Enterprise features |
| VPS | $5-20 | Full control |

## 🎯 Next Steps

1. **Choose deployment platform**
2. **Set up production environment**
3. **Configure all services**
4. **Test thoroughly**
5. **Set up monitoring**
6. **Deploy!**

For the easiest start, I recommend **Railway** - it handles most of the complexity for you!
