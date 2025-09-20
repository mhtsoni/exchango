import express from 'express';
import { Bot, InlineKeyboard } from 'grammy';
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

// Helper function to get approver user IDs
function getApproverUserIds(): number[] {
  const approverIds = process.env.APPROVER_USER_IDS;
  if (!approverIds) return [];
  return approverIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
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
      step: 'category',
      listingData: {}
    });
    
    const keyboard = new InlineKeyboard()
      .text('📊 Trading Signals', 'category_trading_signals')
      .text('🤖 Trading Bots', 'category_trading_bots').row()
      .text('📚 Educational Content', 'category_education')
      .text('🔧 Tools & Software', 'category_tools').row()
      .text('📈 Market Analysis', 'category_analysis')
      .text('🎯 Investment Strategies', 'category_strategies').row()
      .text('❌ Cancel', 'cancel_sell');
    
    await ctx.reply(
      `🚀 **Create Your Digital Subscription**\n\n` +
      `Choose the category that best fits your offering:`,
      { 
        parse_mode: 'Markdown',
        reply_markup: keyboard
      }
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

// Handle callback queries for inline keyboards
bot.on('callback_query:data', async (ctx) => {
  try {
    const userId = ctx.from?.id;
    const data = ctx.callbackQuery.data;
    
    if (!userId) return;
    
    // Handle category selection
    if (data.startsWith('category_')) {
      const category = data.replace('category_', '').replace(/_/g, ' ');
      const userState = getUserState(userId);
      
      if (userState) {
        userState.listingData.category = category;
        userState.step = 'pricing';
        setUserState(userId, userState);
        
        const keyboard = new InlineKeyboard()
          .text('$5/month', 'price_500')
          .text('$10/month', 'price_1000').row()
          .text('$25/month', 'price_2500')
          .text('$50/month', 'price_5000').row()
          .text('$100/month', 'price_10000')
          .text('Custom Price', 'price_custom').row()
          .text('❌ Back', 'back_to_category')
          .text('❌ Cancel', 'cancel_sell');
        
        await ctx.editMessageText(
          `💰 **Choose Your Subscription Price**\n\n` +
          `Category: ${category}\n\n` +
          `Select a price tier or choose custom:`,
          {
            parse_mode: 'Markdown',
            reply_markup: keyboard
          }
        );
      }
    }
    
    // Handle pricing selection
    else if (data.startsWith('price_')) {
      const userState = getUserState(userId);
      if (userState) {
        if (data === 'price_custom') {
          userState.step = 'custom_price';
          setUserState(userId, userState);
          
          await ctx.editMessageText(
            `💰 **Enter Custom Price**\n\n` +
            `Please enter your monthly subscription price in USD:\n\n` +
            `*Examples: 15, 75, 150*`,
            { parse_mode: 'Markdown' }
          );
        } else {
          const price = parseInt(data.replace('price_', ''));
          userState.listingData.price_cents = price;
          userState.step = 'delivery';
          setUserState(userId, userState);
          
          const keyboard = new InlineKeyboard()
            .text('📱 Instant Access', 'delivery_instant')
            .text('📧 Email Delivery', 'delivery_email').row()
            .text('🔗 Private Link', 'delivery_link')
            .text('👤 Manual Setup', 'delivery_manual').row()
            .text('❌ Back', 'back_to_pricing')
            .text('❌ Cancel', 'cancel_sell');
          
          await ctx.editMessageText(
            `📦 **How will you deliver your subscription?**\n\n` +
            `Price: $${(price / 100).toFixed(2)}/month\n\n` +
            `Choose delivery method:`,
            {
              parse_mode: 'Markdown',
              reply_markup: keyboard
            }
          );
        }
      }
    }
    
    // Handle delivery selection
    else if (data.startsWith('delivery_')) {
      const userState = getUserState(userId);
      if (userState) {
        const deliveryType = data.replace('delivery_', '');
        userState.listingData.delivery_type = deliveryType;
        userState.step = 'details';
        setUserState(userId, userState);
        
        await ctx.editMessageText(
          `📝 **Final Step: Subscription Details**\n\n` +
          `Category: ${userState.listingData.category}\n` +
          `Price: $${(userState.listingData.price_cents / 100).toFixed(2)}/month\n` +
          `Delivery: ${deliveryType}\n\n` +
          `Please provide:\n` +
          `• **Title**: What's your subscription called?\n` +
          `• **Description**: What do subscribers get?\n\n` +
          `*Format: Title on first line, description on remaining lines*`,
          { parse_mode: 'Markdown' }
        );
      }
    }
    
    // Handle navigation
    else if (data === 'back_to_category') {
      const keyboard = new InlineKeyboard()
        .text('📊 Trading Signals', 'category_trading_signals')
        .text('🤖 Trading Bots', 'category_trading_bots').row()
        .text('📚 Educational Content', 'category_education')
        .text('🔧 Tools & Software', 'category_tools').row()
        .text('📈 Market Analysis', 'category_analysis')
        .text('🎯 Investment Strategies', 'category_strategies').row()
        .text('❌ Cancel', 'cancel_sell');
      
      await ctx.editMessageText(
        `🚀 **Create Your Digital Subscription**\n\n` +
        `Choose the category that best fits your offering:`,
        {
          parse_mode: 'Markdown',
          reply_markup: keyboard
        }
      );
    }
    
    else if (data === 'back_to_pricing') {
      const userState = getUserState(userId);
      if (userState) {
        const keyboard = new InlineKeyboard()
          .text('$5/month', 'price_500')
          .text('$10/month', 'price_1000').row()
          .text('$25/month', 'price_2500')
          .text('$50/month', 'price_5000').row()
          .text('$100/month', 'price_10000')
          .text('Custom Price', 'price_custom').row()
          .text('❌ Back', 'back_to_category')
          .text('❌ Cancel', 'cancel_sell');
        
        await ctx.editMessageText(
          `💰 **Choose Your Subscription Price**\n\n` +
          `Category: ${userState.listingData.category}\n\n` +
          `Select a price tier or choose custom:`,
          {
            parse_mode: 'Markdown',
            reply_markup: keyboard
          }
        );
      }
    }
    
    // Handle cancellation
    else if (data === 'cancel_sell') {
      clearUserState(userId);
      await ctx.editMessageText(
        '❌ **Cancelled**\n\n' +
        'Subscription creation cancelled. Use /sell to start again.',
        { parse_mode: 'Markdown' }
      );
    }
    
    // Handle approval actions
    else if (data.startsWith('approve_') || data.startsWith('deny_')) {
      console.log(`Approval action received: ${data} from user ${userId}`);
      const approverIds = getApproverUserIds();
      console.log(`Approver IDs: ${approverIds}, User ID: ${userId}`);
      
      if (!approverIds.includes(userId)) {
        console.log(`User ${userId} not authorized to approve listings`);
        await ctx.answerCallbackQuery('❌ You are not authorized to approve listings.');
        return;
      }
      
      const listingId = data.replace(/^(approve_|deny_)/, '');
      const isApproved = data.startsWith('approve_');
      console.log(`Processing ${isApproved ? 'approval' : 'rejection'} for listing ${listingId}`);
      
      try {
        // Update listing status in database
        const status = isApproved ? 'active' : 'rejected';
        await db('listings').where('id', listingId).update({ status });
        
        const listing = await db('listings').where('id', listingId).first();
        const seller = await db('users').where('id', listing.seller_id).first();
        
        if (isApproved) {
          // Post to channel
          await postListingToChannel(listing, seller);
          
          // Notify seller of approval
          await bot.api.sendMessage(seller.telegram_id, 
            `🎉 **Your listing has been approved!**\n\n` +
            `📝 **${listing.title}**\n\n` +
            `Your subscription listing is now live on our trading channel!\n\n` +
            `Use /portfolio to view your listings.`,
            { parse_mode: 'Markdown' }
          );
          
          // Update approval message
          await ctx.editMessageText(
            `✅ **Listing Approved and Posted!**\n\n` +
            `📝 **${listing.title}**\n` +
            `👤 **Seller:** ${seller.display_name || seller.username}\n\n` +
            `The listing has been posted to the trading channel.`,
            { parse_mode: 'Markdown' }
          );
          
          await ctx.answerCallbackQuery('✅ Listing approved and posted to channel!');
        } else {
          // Notify seller of rejection
          await bot.api.sendMessage(seller.telegram_id, 
            `❌ **Your listing was not approved**\n\n` +
            `📝 **${listing.title}**\n\n` +
            `Unfortunately, your listing did not meet our quality standards or community guidelines.\n\n` +
            `Please review our guidelines and feel free to submit a new listing.\n\n` +
            `Use /sell to create a new listing.`,
            { parse_mode: 'Markdown' }
          );
          
          // Update approval message
          await ctx.editMessageText(
            `❌ **Listing Rejected**\n\n` +
            `📝 **${listing.title}**\n` +
            `👤 **Seller:** ${seller.display_name || seller.username}\n\n` +
            `The seller has been notified of the rejection.`,
            { parse_mode: 'Markdown' }
          );
          
          await ctx.answerCallbackQuery('❌ Listing rejected');
        }
      } catch (error) {
        console.error('Error processing approval:', error);
        await ctx.answerCallbackQuery('❌ Error processing approval. Please try again.');
      }
    }
    
    await ctx.answerCallbackQuery();
  } catch (error) {
    console.error('Error handling callback query:', error);
    await ctx.answerCallbackQuery('Error occurred. Please try again.');
  }
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
    case 'custom_price':
      const price = parseFloat(messageText.replace(/[$,]/g, ''));
      if (isNaN(price) || price <= 0) {
        await ctx.reply(
          '❌ **Invalid price!**\n\n' +
          'Please enter a valid price in USD (numbers only).\n' +
          '*Examples: 15, 75, 150*',
          { parse_mode: 'Markdown' }
        );
        return;
      }
      
      listingData.price_cents = Math.round(price * 100);
      setUserState(userId, { step: 'delivery', listingData });
      
      const keyboard = new InlineKeyboard()
        .text('📱 Instant Access', 'delivery_instant')
        .text('📧 Email Delivery', 'delivery_email').row()
        .text('🔗 Private Link', 'delivery_link')
        .text('👤 Manual Setup', 'delivery_manual').row()
        .text('❌ Back', 'back_to_pricing')
        .text('❌ Cancel', 'cancel_sell');
      
      await ctx.reply(
        `✅ **Price set to $${price.toFixed(2)}/month**\n\n` +
        `📦 **How will you deliver your subscription?**\n\n` +
        `Choose delivery method:`,
        {
          parse_mode: 'Markdown',
          reply_markup: keyboard
        }
      );
      break;
      
    case 'details':
      const lines = messageText.split('\n');
      if (lines.length < 2) {
        await ctx.reply(
          '❌ **Invalid format!**\n\n' +
          'Please provide both title and description:\n' +
          '• Title on first line\n' +
          '• Description on remaining lines\n\n' +
          '*Example:*\n' +
          'Crypto Trading Signals Pro\n' +
          'Daily market analysis and trading signals for major cryptocurrencies...',
          { parse_mode: 'Markdown' }
        );
        return;
      }
      
      listingData.title = lines[0].trim();
      listingData.description = lines.slice(1).join('\n').trim();
      
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
      status: 'pending_approval'
    }).returning('*');
    
    // Send approval request to admins
    await sendApprovalRequest(listing[0], user);
    
    await ctx.reply(
      `🎉 **Listing Created Successfully!**\n\n` +
      `📝 **Title:** ${listingData.title}\n` +
      `💰 **Price:** $${(listingData.price_cents / 100).toFixed(2)}\n` +
      `📦 **Delivery:** ${listingData.delivery_type}\n` +
      `📊 **Status:** Awaiting Admin Approval\n\n` +
      `Your listing has been submitted and is awaiting admin approval before being posted to our trading channel.\n\n` +
      `You'll be notified once it's approved or if any changes are needed.\n\n` +
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
async function sendApprovalRequest(listing: any, user: any) {
  try {
    const approverIds = getApproverUserIds();
    if (approverIds.length === 0) {
      console.log('No approver user IDs configured, skipping approval request');
      return;
    }

    const price = (listing.price_cents / 100).toFixed(2);
    const deliveryEmojiMap: { [key: string]: string } = {
      'code': '💻',
      'file': '📄',
      'manual': '👤'
    };
    const deliveryEmoji = deliveryEmojiMap[listing.delivery_type] || '📦';

    const message = 
      `🔍 **New Listing Awaiting Approval**\n\n` +
      `📝 **Title:** ${listing.title}\n\n` +
      `📋 **Description:**\n${listing.description}\n\n` +
      `🏷️ **Category:** ${listing.category}\n` +
      `💰 **Price:** $${price} USD\n` +
      `${deliveryEmoji} **Delivery:** ${listing.delivery_type}\n\n` +
      `👤 **Seller:** ${user.display_name || user.username || 'Anonymous'}\n` +
      `🆔 **Seller ID:** ${user.telegram_id}\n` +
      `📅 **Submitted:** ${new Date(listing.created_at).toLocaleDateString()}\n\n` +
      `🆔 **Listing ID:** ${listing.id}\n\n` +
      `Please review this listing and approve or deny it.`;

    const approvalKeyboard = new InlineKeyboard()
      .text('✅ Approve', `approve_${listing.id}`)
      .text('❌ Deny', `deny_${listing.id}`);

    // Send approval request to all approvers
    for (const approverId of approverIds) {
      try {
        await bot.api.sendMessage(approverId, message, {
          parse_mode: 'Markdown',
          reply_markup: approvalKeyboard
        });
      } catch (error) {
        console.error(`Error sending approval request to user ${approverId}:`, error);
      }
    }

    console.log(`Sent approval request for listing ${listing.id} to ${approverIds.length} approvers`);
  } catch (error) {
    console.error('Error sending approval request:', error);
  }
}

async function postListingToChannel(listing: any, user: any) {
  try {
    const channelId = process.env.CHANNEL_ID;
    if (!channelId) {
      console.log('CHANNEL_ID not set, skipping channel post');
      return;
    }
    
    const price = (listing.price_cents / 100).toFixed(2);
    const deliveryEmojiMap: { [key: string]: string } = {
      'code': '💻',
      'file': '📄',
      'manual': '👤'
    };
    const deliveryEmoji = deliveryEmojiMap[listing.delivery_type] || '📦';
    
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
      link_preview_options: { is_disabled: true }
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
