import express from 'express';
import { Bot } from 'grammy';
import db from '../database';

// User state management for form flows
const userStates = new Map<number, any>();

// Helper functions for form flow
function setUserState(userId: number, state: any) {
  userStates.set(userId, state);
}

function getUserState(userId: number) {
  return userStates.get(userId);
}

function clearUserState(userId: number) {
  userStates.delete(userId);
}

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
    const userId = ctx.from?.id;
    if (!userId) return;
    
    // Initialize user state for listing creation
    setUserState(userId, {
      step: 'title',
      listingData: {}
    });
    
    await ctx.reply(
      `💰 **Create New Listing**\n\n` +
      `Let's create your trading opportunity step by step!\n\n` +
      `📝 **Step 1/5: Title**\n` +
      `What are you selling? Please provide a clear, descriptive title.\n\n` +
      `*Example: "Python Trading Bot for Crypto Markets"*`,
      { parse_mode: 'Markdown' }
    );
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

bot.command('cancel', async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;
  
  clearUserState(userId);
  await ctx.reply(
    '❌ **Cancelled**\n\n' +
    'Listing creation has been cancelled. Use /sell to start again or /help for other commands.',
    { parse_mode: 'Markdown' }
  );
});

// Handle form flow messages
bot.on('message', async (ctx) => {
  try {
    const userId = ctx.from?.id;
    const messageText = ctx.message?.text;
    
    if (!userId || !messageText) return;
    
    const userState = getUserState(userId);
    
    // If user is in a form flow, handle the current step
    if (userState && userState.step) {
      await handleFormStep(ctx, userId, messageText, userState);
      return;
    }
    
    // Default message for users not in a form flow
    await ctx.reply(
      'Hi! I\'m the Exchango trading bot. Use /start to begin or /help for available commands.'
    );
  } catch (error) {
    console.error('Error handling message:', error);
    await ctx.reply('Sorry, there was an error. Please try again.');
  }
});

// Handle form flow steps
async function handleFormStep(ctx: any, userId: number, messageText: string, userState: any) {
  const { step, listingData } = userState;
  
  switch (step) {
    case 'title':
      listingData.title = messageText;
      setUserState(userId, { step: 'description', listingData });
      await ctx.reply(
        `✅ **Title saved!**\n\n` +
        `📋 **Step 2/5: Description**\n` +
        `Please provide a detailed description of what you're selling.\n\n` +
        `*Example: "A fully automated trading bot that analyzes market trends and executes trades on your behalf..."*`,
        { parse_mode: 'Markdown' }
      );
      break;
      
    case 'description':
      listingData.description = messageText;
      setUserState(userId, { step: 'category', listingData });
      await ctx.reply(
        `✅ **Description saved!**\n\n` +
        `🏷️ **Step 3/5: Category**\n` +
        `What category does this belong to? Choose from:\n\n` +
        `• Software\n` +
        `• Trading Strategy\n` +
        `• Educational Content\n` +
        `• Tools & Utilities\n` +
        `• Other\n\n` +
        `*Just type the category name*`,
        { parse_mode: 'Markdown' }
      );
      break;
      
    case 'category':
      listingData.category = messageText;
      setUserState(userId, { step: 'price', listingData });
      await ctx.reply(
        `✅ **Category saved!**\n\n` +
        `💰 **Step 4/5: Price**\n` +
        `How much do you want to charge? Enter the amount in USD.\n\n` +
        `*Examples: 25, 50.00, 100*`,
        { parse_mode: 'Markdown' }
      );
      break;
      
    case 'price':
      const price = parseFloat(messageText.replace(/[$,]/g, ''));
      if (isNaN(price) || price <= 0) {
        await ctx.reply(
          '❌ **Invalid price!**\n\n' +
          'Please enter a valid price in USD (numbers only).\n' +
          '*Examples: 25, 50.00, 100*',
          { parse_mode: 'Markdown' }
        );
        return;
      }
      
      listingData.price_cents = Math.round(price * 100);
      setUserState(userId, { step: 'delivery', listingData });
      await ctx.reply(
        `✅ **Price saved!**\n\n` +
        `📦 **Step 5/5: Delivery Method**\n` +
        `How will you deliver this to buyers? Choose one:\n\n` +
        `• **code** - Source code files\n` +
        `• **file** - Documents, PDFs, etc.\n` +
        `• **manual** - Manual delivery/instructions\n\n` +
        `*Just type: code, file, or manual*`,
        { parse_mode: 'Markdown' }
      );
      break;
      
    case 'delivery':
      const deliveryType = messageText.toLowerCase().trim();
      if (!['code', 'file', 'manual'].includes(deliveryType)) {
        await ctx.reply(
          '❌ **Invalid delivery type!**\n\n' +
          'Please choose one of these options:\n' +
          '• code\n• file\n• manual',
          { parse_mode: 'Markdown' }
        );
        return;
      }
      
      listingData.delivery_type = deliveryType;
      
      // Create the listing
      await createListing(ctx, userId, listingData);
      clearUserState(userId);
      break;
      
    default:
      clearUserState(userId);
      await ctx.reply('Something went wrong. Please start over with /sell');
  }
}

// Create listing in database
async function createListing(ctx: any, userId: number, listingData: any) {
  try {
    const user = await db('users').where('telegram_id', userId).first();
    if (!user) {
      await ctx.reply('Please use /start first to create your account.');
      return;
    }
    
    const listing = await db('listings').insert({
      seller_id: user.id,
      title: listingData.title,
      description: listingData.description,
      category: listingData.category,
      price_cents: listingData.price_cents,
      currency: 'usd',
      delivery_type: listingData.delivery_type,
      status: 'pending_verification'
    }).returning('*');
    
    // Post to channel
    await postListingToChannel(listing[0], user);
    
    await ctx.reply(
      `🎉 **Listing Created Successfully!**\n\n` +
      `📝 **Title:** ${listingData.title}\n` +
      `💰 **Price:** $${(listingData.price_cents / 100).toFixed(2)}\n` +
      `📦 **Delivery:** ${listingData.delivery_type}\n` +
      `📊 **Status:** Pending Verification\n\n` +
      `Your listing has been posted to our trading channel and is now under review!\n\n` +
      `Use /portfolio to view your listings or /listings to see other opportunities!`,
      { parse_mode: 'Markdown' }
    );
  } catch (error) {
    console.error('Error creating listing:', error);
    await ctx.reply(
      '❌ **Error creating listing!**\n\n' +
      'There was an error saving your listing. Please try again later or contact support.',
      { parse_mode: 'Markdown' }
    );
  }
}

// Post listing to Telegram channel
async function postListingToChannel(listing: any, user: any) {
  try {
    const channelId = process.env.CHANNEL_ID;
    if (!channelId) {
      console.log('CHANNEL_ID not set, skipping channel post');
      return;
    }
    
    const price = (listing.price_cents / 100).toFixed(2);
    const deliveryEmoji = {
      'code': '💻',
      'file': '📄',
      'manual': '👤'
    }[listing.delivery_type] || '📦';
    
    const message = 
      `🆕 **New Trading Opportunity!**\n\n` +
      `📝 **${listing.title}**\n\n` +
      `📋 **Description:**\n${listing.description}\n\n` +
      `🏷️ **Category:** ${listing.category}\n` +
      `💰 **Price:** $${price} USD\n` +
      `${deliveryEmoji} **Delivery:** ${listing.delivery_type}\n\n` +
      `👤 **Seller:** ${user.display_name || user.username || 'Anonymous'}\n` +
      `📅 **Posted:** ${new Date(listing.created_at).toLocaleDateString()}\n\n` +
      `🔄 **Status:** Pending Verification\n\n` +
      `💬 **Interested?** Contact the seller directly!\n` +
      `📊 **View All Listings:** @${process.env.BOT_USERNAME || 'your_bot'}\n\n` +
      `#Exchango #Trading #${listing.category.replace(/\s+/g, '')}`;
    
    await bot.api.sendMessage(channelId, message, { 
      parse_mode: 'Markdown',
      disable_web_page_preview: true
    });
    
    console.log(`Posted listing ${listing.id} to channel ${channelId}`);
  } catch (error) {
    console.error('Error posting to channel:', error);
    // Don't throw error - listing creation should still succeed even if channel post fails
  }
}

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
