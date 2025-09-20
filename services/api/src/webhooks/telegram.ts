import express from 'express';
import { Bot } from 'grammy';
import db from '../database';

const router = express.Router();

// Initialize bot for webhook processing
const bot = new Bot(process.env.BOT_TOKEN!);

// Bot command handlers
bot.command('start', async (ctx) => {
  const userId = ctx.from?.id;
  const username = ctx.from?.username;
  const displayName = ctx.from?.first_name + (ctx.from?.last_name ? ` ${ctx.from.last_name}` : '');
  
  try {
    // Check if user exists in database
    const existingUser = await db('users').where('telegram_id', userId).first();
    
    if (!existingUser) {
      // Create new user
      await db('users').insert({
        telegram_id: userId,
        username: username || null,
        display_name: displayName || null,
        kyc_status: 'none',
        rating: 0
      });
    }
    
    await ctx.reply(
      `🎉 Welcome to Exchango, ${displayName || username || 'trader'}!\n\n` +
      `I'm your personal trading assistant. Here's what you can do:\n\n` +
      `📈 /listings - Browse available trading opportunities\n` +
      `💰 /sell - List your own trading opportunity\n` +
      `📊 /portfolio - View your trading history\n` +
      `⚙️ /settings - Manage your preferences\n\n` +
      `Ready to start trading? Use /listings to see what's available!`
    );
  } catch (error) {
    console.error('Error handling /start command:', error);
    await ctx.reply('Sorry, there was an error processing your request. Please try again later.');
  }
});

bot.command('listings', async (ctx) => {
  try {
    const listings = await db('listings')
      .where('status', 'active')
      .limit(10)
      .orderBy('created_at', 'desc');
    
    if (listings.length === 0) {
      await ctx.reply('📭 No active listings available at the moment. Check back later!');
      return;
    }
    
    let message = '📋 **Active Trading Opportunities:**\n\n';
    
    for (const listing of listings) {
      const seller = await db('users').where('id', listing.seller_id).first();
      message += `🔸 **${listing.title}**\n`;
      message += `💰 Price: $${(listing.price_cents / 100).toFixed(2)} ${listing.currency.toUpperCase()}\n`;
      message += `📦 Type: ${listing.delivery_type}\n`;
      message += `👤 Seller: ${seller?.display_name || seller?.username || 'Anonymous'}\n`;
      message += `📅 Posted: ${new Date(listing.created_at).toLocaleDateString()}\n\n`;
    }
    
    await ctx.reply(message, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Error handling /listings command:', error);
    await ctx.reply('Sorry, there was an error fetching listings. Please try again later.');
  }
});

bot.command('help', async (ctx) => {
  await ctx.reply(
    `🤖 **Exchango Bot Help**\n\n` +
    `**Available Commands:**\n` +
    `/start - Welcome message and setup\n` +
    `/listings - Browse active trading opportunities\n` +
    `/sell - Create a new listing (coming soon)\n` +
    `/portfolio - View your trading history (coming soon)\n` +
    `/settings - Manage your preferences (coming soon)\n` +
    `/help - Show this help message\n\n` +
    `**Getting Started:**\n` +
    `1. Use /start to begin\n` +
    `2. Browse /listings to find opportunities\n` +
    `3. Contact sellers directly through Telegram\n\n` +
    `Need support? Contact @your_admin_username`,
    { parse_mode: 'Markdown' }
  );
});

// Handle any other messages
bot.on('message', async (ctx) => {
  await ctx.reply(
    'Hi! I\'m the Exchango trading bot. Use /start to begin or /help for available commands.'
  );
});

// Initialize the bot
bot.init().catch(console.error);

// Telegram webhook endpoint
router.post('/telegram', async (req, res) => {
  try {
    const update = req.body;
    
    // Process the update
    await bot.handleUpdate(update);
    
    res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

export default router;
