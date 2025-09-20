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

bot.command('sell', async (ctx) => {
  try {
    await ctx.reply(
      `💰 **Create New Listing**\n\n` +
      `To create a new trading opportunity, please provide the following information:\n\n` +
      `📝 **Title**: What are you selling?\n` +
      `📋 **Description**: Details about your offer\n` +
      `🏷️ **Category**: Type of trading opportunity\n` +
      `💰 **Price**: Amount in USD\n` +
      `📦 **Delivery Type**: How will you deliver? (code/file/manual)\n\n` +
      `Please reply with your listing details in this format:\n\n` +
      `**Title:** Your title here\n` +
      `**Description:** Your description here\n` +
      `**Category:** Your category here\n` +
      `**Price:** $XX.XX\n` +
      `**Delivery:** code/file/manual\n\n` +
      `Example:\n` +
      `**Title:** Python Trading Bot\n` +
      `**Description:** Automated trading bot for crypto markets\n` +
      `**Category:** Software\n` +
      `**Price:** $50.00\n` +
      `**Delivery:** code`,
      { parse_mode: 'Markdown' }
    );
    
    // Store user state for listing creation
    // In a full implementation, you'd use a state management system
    await ctx.reply('Send your listing details now, or use /cancel to abort.');
  } catch (error) {
    console.error('Error handling /sell command:', error);
    await ctx.reply('Sorry, there was an error. Please try again later.');
  }
});

bot.command('portfolio', async (ctx) => {
  try {
    const userId = ctx.from?.id;
    
    // Get user's listings
    const user = await db('users').where('telegram_id', userId).first();
    if (!user) {
      await ctx.reply('Please use /start first to create your account.');
      return;
    }
    
    const listings = await db('listings')
      .where('seller_id', user.id)
      .orderBy('created_at', 'desc');
    
    // Get user's transactions as buyer
    const boughtTransactions = await db('transactions')
      .where('buyer_id', user.id)
      .orderBy('created_at', 'desc');
    
    let message = `📊 **Your Portfolio**\n\n`;
    
    // User's listings
    message += `📝 **Your Listings (${listings.length}):**\n`;
    if (listings.length === 0) {
      message += `No listings created yet. Use /sell to create your first one!\n\n`;
    } else {
      for (const listing of listings.slice(0, 5)) {
        message += `🔸 **${listing.title}** - $${(listing.price_cents / 100).toFixed(2)}\n`;
        message += `   Status: ${listing.status}\n`;
        message += `   Created: ${new Date(listing.created_at).toLocaleDateString()}\n\n`;
      }
      if (listings.length > 5) {
        message += `... and ${listings.length - 5} more listings\n\n`;
      }
    }
    
    // Purchases
    message += `🛒 **Your Purchases (${boughtTransactions.length}):**\n`;
    if (boughtTransactions.length === 0) {
      message += `No purchases yet. Use /listings to find opportunities!\n`;
    } else {
      for (const transaction of boughtTransactions.slice(0, 3)) {
        const listing = await db('listings').where('id', transaction.listing_id).first();
        if (listing) {
          message += `🔸 **${listing.title}** - $${(transaction.amount_cents / 100).toFixed(2)}\n`;
          message += `   Status: ${transaction.status}\n`;
          message += `   Date: ${new Date(transaction.created_at).toLocaleDateString()}\n\n`;
        }
      }
    }
    
    await ctx.reply(message, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Error handling /portfolio command:', error);
    await ctx.reply('Sorry, there was an error fetching your portfolio. Please try again later.');
  }
});

bot.command('settings', async (ctx) => {
  try {
    const userId = ctx.from?.id;
    
    const user = await db('users').where('telegram_id', userId).first();
    if (!user) {
      await ctx.reply('Please use /start first to create your account.');
      return;
    }
    
    await ctx.reply(
      `⚙️ **Your Settings**\n\n` +
      `👤 **Profile:**\n` +
      `Name: ${user.display_name || 'Not set'}\n` +
      `Username: ${user.username || 'Not set'}\n` +
      `Telegram ID: ${user.telegram_id}\n\n` +
      `📊 **Account Status:**\n` +
      `KYC Status: ${user.kyc_status}\n` +
      `Rating: ${user.rating}/5 ⭐\n\n` +
      `📅 **Member Since:** ${new Date(user.created_at).toLocaleDateString()}\n\n` +
      `**Available Actions:**\n` +
      `• Update profile information\n` +
      `• Change notification settings\n` +
      `• Privacy preferences\n\n` +
      `*Settings management coming soon! For now, your basic profile is set up and ready to trade.*`,
      { parse_mode: 'Markdown' }
    );
  } catch (error) {
    console.error('Error handling /settings command:', error);
    await ctx.reply('Sorry, there was an error accessing your settings. Please try again later.');
  }
});

bot.command('help', async (ctx) => {
  await ctx.reply(
    `🤖 **Exchango Bot Help**\n\n` +
    `**Available Commands:**\n` +
    `/start - Welcome message and setup\n` +
    `/listings - Browse active trading opportunities\n` +
    `/sell - Create a new listing\n` +
    `/portfolio - View your trading history\n` +
    `/settings - Manage your preferences\n` +
    `/help - Show this help message\n\n` +
    `**Getting Started:**\n` +
    `1. Use /start to begin\n` +
    `2. Browse /listings to find opportunities\n` +
    `3. Use /sell to create your own listings\n` +
    `4. Check /portfolio for your activity\n\n` +
    `Need support? Contact the admin.`,
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
