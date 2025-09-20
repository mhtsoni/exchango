# Railway Deployment Guide for Exchango

## 🚀 Deploy Exchango to Railway

Railway is the easiest way to deploy your Exchango Telegram MVP. This guide will walk you through the complete setup process.

## 📋 Prerequisites

Before deploying, make sure you have:

- ✅ GitHub repository: https://github.com/mhtsoni/exchango
- ✅ Telegram Bot Token (from @BotFather)
- ✅ Stripe Account (for payments)
- ✅ AWS Account (for S3 and KMS)
- ✅ Railway Account (free at [railway.app](https://railway.app))

## 🎯 Step-by-Step Railway Deployment

### Step 1: Create Railway Account

1. **Go to** [railway.app](https://railway.app)
2. **Sign up** with GitHub (recommended)
3. **Authorize** Railway to access your GitHub repositories

### Step 2: Create New Project

1. **Click** "New Project" on Railway dashboard
2. **Select** "Deploy from GitHub repo"
3. **Find and select** `mhtsoni/exchango` repository
4. **Click** "Deploy Now"

### Step 3: Add PostgreSQL Database

1. **In your project dashboard**, click "New"
2. **Select** "Database" → "PostgreSQL"
3. **Wait** for database to provision
4. **Note** the database connection details

### Step 4: Configure Environment Variables

1. **Click** on your deployed service
2. **Go to** "Variables" tab
3. **Add** the following environment variables:

```env
# Telegram Configuration
BOT_TOKEN=your-telegram-bot-token-here
WEBHOOK_URL=https://your-app-name.railway.app/webhooks/telegram
ADMIN_TELEGRAM_ID=your-telegram-user-id

# Database (Railway will auto-populate this)
DATABASE_URL=postgresql://postgres:password@host:port/railway

# AWS Configuration
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-access-key
S3_BUCKET=your-s3-bucket-name
AWS_REGION=us-east-1
KMS_KEY_ID=your-kms-key-id

# Stripe Configuration
STRIPE_SECRET=sk_live_your-stripe-secret-key
STRIPE_WEBHOOK_SECRET=whsec_your-webhook-secret
STRIPE_PLATFORM_ACCOUNT_ID=acct_your-stripe-account-id

# App Configuration
PLATFORM_BASE_URL=https://your-app-name.railway.app
PORT=4000
NODE_ENV=production
```

### Step 5: Configure Railway Service Settings

1. **In your service settings**, configure:
   - **Build Command**: `pnpm install && pnpm build`
   - **Start Command**: `pnpm --filter api start`
   - **Root Directory**: `/` (leave empty)

### Step 6: Deploy Bot Service

1. **Add another service** for the bot:
   - **Click** "New" → "GitHub Repo"
   - **Select** the same `exchango` repository
   - **Configure**:
     - **Build Command**: `pnpm install && pnpm build`
     - **Start Command**: `pnpm --filter bot start`
     - **Root Directory**: `/` (leave empty)

2. **Set environment variables** for bot service (same as above)

### Step 7: Run Database Migrations

1. **Open Railway CLI** or use the web console
2. **Run migrations**:
   ```bash
   # Install Railway CLI
   npm install -g @railway/cli
   
   # Login to Railway
   railway login
   
   # Connect to your project
   railway link
   
   # Run migrations
   railway run pnpm migrate
   ```

### Step 8: Set Up Telegram Webhook

1. **Get your Railway app URL** from the dashboard
2. **Set webhook** using curl:
   ```bash
   curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
        -H "Content-Type: application/json" \
        -d '{"url": "https://your-app-name.railway.app/webhooks/telegram"}'
   ```

### Step 9: Configure Stripe Webhook

1. **Go to** Stripe Dashboard → Webhooks
2. **Add endpoint**: `https://your-app-name.railway.app/webhooks/stripe`
3. **Select events**:
   - `checkout.session.completed`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
4. **Copy webhook secret** and add to Railway environment variables

## 🔧 Railway-Specific Configuration

### Railway Configuration File

Create `railway.json` in your project root:

```json
{
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "pnpm --filter api start",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

### Update package.json Scripts

Add Railway-specific scripts to your root `package.json`:

```json
{
  "scripts": {
    "railway:deploy": "railway up",
    "railway:migrate": "railway run pnpm migrate",
    "railway:logs": "railway logs",
    "railway:shell": "railway shell"
  }
}
```

## 🐳 Docker Configuration for Railway

Railway supports Docker. Update your `Dockerfile` for Railway:

```dockerfile
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./
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
```

## 📊 Monitoring and Logs

### View Logs
```bash
# Install Railway CLI
npm install -g @railway/cli

# View logs
railway logs

# View logs for specific service
railway logs --service api
railway logs --service bot
```

### Monitor Performance
- **Railway Dashboard** → Your Project → Metrics
- **View** CPU, Memory, Network usage
- **Set up** alerts for high resource usage

## 🔒 Security Best Practices

### Environment Variables
- ✅ Never commit `.env` files
- ✅ Use Railway's environment variable system
- ✅ Rotate secrets regularly
- ✅ Use different keys for staging/production

### Database Security
- ✅ Railway provides encrypted PostgreSQL
- ✅ Use connection pooling
- ✅ Regular backups (Railway handles this)

### API Security
- ✅ Enable HTTPS (Railway provides this)
- ✅ Set up rate limiting
- ✅ Validate all inputs
- ✅ Use proper CORS settings

## 🚨 Troubleshooting

### Common Issues

1. **Build Fails**
   ```bash
   # Check build logs
   railway logs --service api
   
   # Common fixes:
   # - Ensure all dependencies are in package.json
   # - Check Node.js version compatibility
   # - Verify build commands
   ```

2. **Database Connection Issues**
   ```bash
   # Check DATABASE_URL
   railway variables
   
   # Test connection
   railway run psql $DATABASE_URL -c "SELECT 1;"
   ```

3. **Bot Not Responding**
   ```bash
   # Check webhook URL
   curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"
   
   # Check bot logs
   railway logs --service bot
   ```

4. **Stripe Webhook Issues**
   ```bash
   # Check webhook endpoint
   curl -X POST https://your-app.railway.app/webhooks/stripe \
        -H "Content-Type: application/json" \
        -d '{"test": "data"}'
   ```

### Debug Commands

```bash
# Connect to Railway shell
railway shell

# Run commands in Railway environment
railway run pnpm migrate
railway run pnpm test

# View environment variables
railway variables

# Check service status
railway status
```

## 💰 Railway Pricing

### Free Tier
- ✅ $5 credit monthly
- ✅ 512MB RAM
- ✅ 1GB storage
- ✅ Perfect for MVP testing

### Paid Plans
- **Hobby**: $5/month
- **Pro**: $20/month
- **Team**: $99/month

## 🎯 Deployment Checklist

- [ ] Railway account created
- [ ] GitHub repository connected
- [ ] PostgreSQL database added
- [ ] Environment variables configured
- [ ] Both API and Bot services deployed
- [ ] Database migrations run
- [ ] Telegram webhook set
- [ ] Stripe webhook configured
- [ ] Domain configured (optional)
- [ ] Monitoring set up
- [ ] Backup strategy in place

## 🚀 Go Live Steps

1. **Test everything** in Railway staging
2. **Set up production environment variables**
3. **Deploy to production**
4. **Run final migrations**
5. **Set production webhooks**
6. **Test end-to-end flow**
7. **Monitor for 24 hours**
8. **Announce launch!**

## 📞 Support

- **Railway Docs**: [docs.railway.app](https://docs.railway.app)
- **Railway Discord**: [discord.gg/railway](https://discord.gg/railway)
- **Railway Status**: [status.railway.app](https://status.railway.app)

---

**Your Exchango app will be live at**: `https://your-app-name.railway.app`

**Estimated deployment time**: 10-15 minutes
**Cost**: Free tier sufficient for MVP testing
