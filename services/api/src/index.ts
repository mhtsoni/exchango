import 'dotenv/config';
import express from 'express';
const bodyParser = require('body-parser');
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import listingsRouter from './routes/listings';
import transactionsRouter from './routes/transactions';
import adminRouter from './routes/admin';
import telegramWebhookRouter from './webhooks/telegram';
import { initializeDatabase } from './database';

const app = express();

// Trigger Railway deployment
// Security middleware
app.use(helmet());
app.use(cors());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Body parsing
app.use(bodyParser.json({ limit: '1mb' }));

// Routes
app.use('/api/listings', listingsRouter);
app.use('/api/transactions', transactionsRouter);
app.use('/api/admin', adminRouter);
app.use('/webhooks', telegramWebhookRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Initialize database and start server
async function startServer() {
  try {
    await initializeDatabase();
    const port = process.env.PORT || 4000;
    app.listen(port, () => {
      console.log(`Exchango API server listening on port ${port}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
