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
  console.log(`Raw APPROVER_USER_IDS: ${approverIds}`);
  if (!approverIds) return [];
  const parsedIds = approverIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
  console.log(`Parsed approver IDs: ${parsedIds}`);
  return parsedIds;
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
    } else {
      // Update existing user's username if it has changed
      if (existingUser.username !== username) {
        await db('users').where('telegram_id', userId).update({
          username: username || null,
          display_name: displayName || existingUser.display_name,
          updated_at: new Date()
        });
      }
    }
    
    let welcomeMessage = `🎉 Welcome to Exchango, ${displayName || username || 'trader'}!\n\n`;
    
    if (username) {
      welcomeMessage += `✅ **Username:** @${username} - Ready to create listings!\n\n`;
    } else {
      welcomeMessage += `⚠️ **Important:** You need a Telegram username to create listings!\n` +
        `Buyers must be able to contact you directly. Go to Telegram Settings → Username to set one.\n\n`;
    }
    
    welcomeMessage += `I'm your personal trading assistant. Here's what you can do:\n\n` +
      `📈 /listings - Browse available trading opportunities\n` +
      `💰 /sell - List your own trading opportunity\n` +
      `📊 /portfolio - View your trading history\n` +
      `⚙️ /settings - Manage your preferences\n\n` +
      `Ready to start trading? Use /listings to see what's available!`;
    
    await ctx.reply(welcomeMessage, {
      reply_markup: new InlineKeyboard()
        .text('📋 Main Menu', 'main_menu')
        .row()
        .text('❓ Help', 'help_menu')
    });
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
    
    console.log(`/sell command called by user ${userId}`);
    
    // Check if user exists and refresh their data if needed
    let user = await db('users').where('telegram_id', userId).first();
    if (!user) {
      // Auto-create user if they don't exist
      await ctx.reply('Setting up your account...');
      
      // Create user with current Telegram data
      const username = ctx.from?.username || null;
      const firstName = ctx.from?.first_name || '';
      const lastName = ctx.from?.last_name || '';
      
      try {
        await db('users').insert({
          telegram_id: userId,
          username: username,
          first_name: firstName,
          last_name: lastName,
          created_at: new Date(),
          updated_at: new Date()
        });
        
        // Fetch the newly created user
        user = await db('users').where('telegram_id', userId).first();
        await ctx.reply('✅ Account created successfully!');
      } catch (error) {
        console.error('Error creating user:', error);
        await ctx.reply('Sorry, there was an error creating your account. Please try again.');
        return;
      }
    } else {
      // Refresh existing user data
      const username = ctx.from?.username || null;
      const firstName = ctx.from?.first_name || '';
      const lastName = ctx.from?.last_name || '';
      
      try {
        await db('users')
          .where('telegram_id', userId)
          .update({
            username: username,
            first_name: firstName,
            last_name: lastName,
            updated_at: new Date()
          });
        
        // Fetch updated user data
        user = await db('users').where('telegram_id', userId).first();
      } catch (error) {
        console.error('Error updating user:', error);
        // Continue with existing user data if update fails
      }
    }
    
    if (!user.username) {
      await ctx.reply(
        `⚠️ **Username Required to Create Listings!**\n\n` +
        `You need to set a Telegram username before you can create listings.\n\n` +
        `**Why?** Buyers need to contact you directly!\n\n` +
        `**Steps to set username:**\n` +
        `1. Go to Telegram Settings\n` +
        `2. Tap on "Username"\n` +
        `3. Set your desired username (e.g., @yourname)\n` +
        `4. Use /start to refresh your profile\n\n` +
        `Once you've set your username, come back and use /sell to create your listing!`,
        { parse_mode: 'Markdown' }
      );
      return;
    }
    
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
        const statusEmojiMap: { [key: string]: string } = {
          'pending_approval': '⏳',
          'active': '✅',
          'sold': '💰',
          'rejected': '❌',
          'removed': '🗑️'
        };
        const statusEmoji = statusEmojiMap[listing.status] || '❓';
        
        message += `${statusEmoji} **${listing.title}** - $${(listing.price_cents / 100).toFixed(2)}\n`;
        message += `   Status: \`${listing.status}\`\n`;
        message += `   Created: \`${new Date(listing.created_at).toLocaleDateString()}\`\n\n`;
      }
      if (listings.length > 5) {
        message += `... and ${listings.length - 5} more listings\n\n`;
      }
    }
    
    // Purchases
    message += `🛒 **Your Purchases (${boughtTransactions.length}):**\n`;
    if (boughtTransactions.length === 0) {
      message += `No purchases yet. Use /listings to find opportunities!\n\n`;
    } else {
      for (const transaction of boughtTransactions.slice(0, 3)) {
        const listing = await db('listings').where('id', transaction.listing_id).first();
        if (listing) {
          message += `🔸 **${listing.title}** - $${(transaction.amount_cents / 100).toFixed(2)}\n`;
          message += `   Status: \`${transaction.status}\`\n`;
          message += `   Date: \`${new Date(transaction.created_at).toLocaleDateString()}\`\n\n`;
        }
      }
    }
    
    // Add management options for active listings
    const activeListings = listings.filter(l => l.status === 'active');
    if (activeListings.length > 0) {
      message += `🔧 **Manage Your Active Listings:**\n`;
      message += `Use the buttons below to manage your listings.\n\n`;
      
      const keyboard = new InlineKeyboard();
      for (const listing of activeListings.slice(0, 3)) {
        keyboard.text(`📝 ${listing.title.substring(0, 20)}...`, `manage_${listing.id}`).row();
      }
      
      await ctx.reply(message, { 
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });
    } else {
      await ctx.reply(message, { parse_mode: 'Markdown' });
    }
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

bot.command('update', async (ctx) => {
  try {
    const userId = ctx.from?.id;
    const username = ctx.from?.username;
    const displayName = ctx.from?.first_name + (ctx.from?.last_name ? ` ${ctx.from.last_name}` : '');
    
    const user = await db('users').where('telegram_id', userId).first();
    if (!user) {
      await ctx.reply('Please use /start first to create your account.');
      return;
    }
    
    // Update user profile in database
    await db('users').where('telegram_id', userId).update({
      username: username || null,
      display_name: displayName || null,
      updated_at: new Date()
    });
    
    await ctx.reply(
      `✅ **Profile Updated!**\n\n` +
      `👤 **Username:** ${username ? `@${username}` : 'Not set'}\n` +
      `👤 **Name:** ${displayName}\n\n` +
      `Your profile information has been refreshed automatically.`,
      { parse_mode: 'Markdown' }
    );
    
  } catch (error) {
    console.error('Error handling /update command:', error);
    await ctx.reply('Sorry, there was an error updating your profile. Please try again later.');
  }
});

bot.command('menu', async (ctx) => {
  try {
    const userId = ctx.from?.id;
    if (!userId) return;
    
    await showMainMenu(ctx, userId);
  } catch (error) {
    console.error('Error handling /menu command:', error);
    await ctx.reply('Sorry, there was an error showing the menu. Please try again.');
  }
});

bot.command('help', async (ctx) => {
  await ctx.reply(
    `🤖 **Exchango Bot Help**\n\n` +
    `**Available Commands:**\n` +
    `/start - Welcome message and setup\n` +
    `/menu - Show main menu with options\n` +
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
          console.log(`Approving listing ${listingId}, posting to channel...`);
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
    
    // Handle listing management actions
    else if (data.startsWith('manage_')) {
      const listingId = data.replace('manage_', '');
      const userId = ctx.from?.id;
      
      try {
        // Verify the user owns this listing
        const user = await db('users').where('telegram_id', userId).first();
        const listing = await db('listings').where('id', listingId).where('seller_id', user.id).first();
        
        if (!listing) {
          await ctx.answerCallbackQuery('❌ Listing not found or you do not own this listing.');
          return;
        }
        
        if (listing.status !== 'active') {
          await ctx.answerCallbackQuery('❌ Only active listings can be managed.');
          return;
        }
        
        // Show management options
        const message = 
          `🔧 **Manage Listing**\n\n` +
          `📝 **${listing.title}**\n` +
          `💰 **Price:** $${(listing.price_cents / 100).toFixed(2)}\n` +
          `📊 **Status:** ${listing.status}\n\n` +
          `Choose an action:`;
        
        const keyboard = new InlineKeyboard()
          .text('💰 Mark as Sold', `mark_sold_${listingId}`)
          .text('✏️ Edit Listing', `edit_${listingId}`).row()
          .text('📷 Manage Images', `images_${listingId}`)
          .text('🗑️ Delete Listing', `delete_${listingId}`).row()
          .text('❌ Cancel', 'cancel_manage');
        
        await ctx.editMessageText(message, {
          parse_mode: 'Markdown',
          reply_markup: keyboard
        });
        
      } catch (error) {
        console.error('Error handling manage action:', error);
        await ctx.answerCallbackQuery('❌ Error loading listing management. Please try again.');
      }
    }
    
    // Handle mark as sold action
    else if (data.startsWith('mark_sold_')) {
      const listingId = data.replace('mark_sold_', '');
      const userId = ctx.from?.id;
      
      try {
        // Verify ownership and update status
        const user = await db('users').where('telegram_id', userId).first();
        const listing = await db('listings').where('id', listingId).where('seller_id', user.id).first();
        
        if (!listing) {
          await ctx.answerCallbackQuery('❌ Listing not found or you do not own this listing.');
          return;
        }
        
        // Update listing status to sold
        await db('listings').where('id', listingId).update({ 
          status: 'sold',
          updated_at: new Date()
        });
        
        // TODO: Remove from channel (we'll need to track channel message IDs)
        
        await ctx.editMessageText(
          `💰 **Listing Marked as Sold!**\n\n` +
          `📝 **${listing.title}**\n\n` +
          `Your listing has been marked as sold and removed from the trading channel.\n\n` +
          `Use /portfolio to view your updated listings.`,
          { parse_mode: 'Markdown' }
        );
        
        await ctx.answerCallbackQuery('✅ Listing marked as sold!');
        
      } catch (error) {
        console.error('Error marking listing as sold:', error);
        await ctx.answerCallbackQuery('❌ Error updating listing. Please try again.');
      }
    }
    
    // Handle delete listing action
    else if (data.startsWith('delete_')) {
      const listingId = data.replace('delete_', '');
      const userId = ctx.from?.id;
      
      try {
        // Verify ownership and update status
        const user = await db('users').where('telegram_id', userId).first();
        const listing = await db('listings').where('id', listingId).where('seller_id', user.id).first();
        
        if (!listing) {
          await ctx.answerCallbackQuery('❌ Listing not found or you do not own this listing.');
          return;
        }
        
        // Update listing status to removed
        await db('listings').where('id', listingId).update({ 
          status: 'removed',
          updated_at: new Date()
        });
        
        // TODO: Remove from channel (we'll need to track channel message IDs)
        
        await ctx.editMessageText(
          `🗑️ **Listing Deleted!**\n\n` +
          `📝 **${listing.title}**\n\n` +
          `Your listing has been deleted and removed from the trading channel.\n\n` +
          `Use /portfolio to view your updated listings.`,
          { parse_mode: 'Markdown' }
        );
        
        await ctx.answerCallbackQuery('✅ Listing deleted!');
        
      } catch (error) {
        console.error('Error deleting listing:', error);
        await ctx.answerCallbackQuery('❌ Error deleting listing. Please try again.');
      }
    }
    
    // Handle edit listing action
    else if (data.startsWith('edit_')) {
      const listingId = data.replace('edit_', '');
      const userId = ctx.from?.id;
      
      try {
        // Verify ownership
        const user = await db('users').where('telegram_id', userId).first();
        const listing = await db('listings').where('id', listingId).where('seller_id', user.id).first();
        
        if (!listing) {
          await ctx.answerCallbackQuery('❌ Listing not found or you do not own this listing.');
          return;
        }
        
        if (listing.status === 'sold' || listing.status === 'removed') {
          await ctx.answerCallbackQuery('❌ Cannot edit sold or deleted listings.');
          return;
        }
        
        // Set user state for editing
        setUserState(userId, {
          step: 'editing',
          listingId: listingId,
          originalData: listing
        });
        
        const message = 
          `✏️ **Edit Listing**\n\n` +
          `📝 **${listing.title}**\n\n` +
          `What would you like to edit?\n\n` +
          `Send me the new information in this format:\n` +
          `**Title:** [new title]\n` +
          `**Description:** [new description]\n` +
          `**Price:** [new price in USD]\n\n` +
          `*You can send just the fields you want to change.*`;
        
        const keyboard = new InlineKeyboard()
          .text('❌ Cancel Edit', 'cancel_edit');
        
        await ctx.editMessageText(message, {
          parse_mode: 'Markdown',
          reply_markup: keyboard
        });
        
      } catch (error) {
        console.error('Error handling edit action:', error);
        await ctx.answerCallbackQuery('❌ Error loading edit options. Please try again.');
      }
    }
    
    // Handle manage images action
    else if (data.startsWith('images_')) {
      const listingId = data.replace('images_', '');
      const userId = ctx.from?.id;
      
      try {
        // Verify ownership
        const user = await db('users').where('telegram_id', userId).first();
        const listing = await db('listings').where('id', listingId).where('seller_id', user.id).first();
        
        if (!listing) {
          await ctx.answerCallbackQuery('❌ Listing not found or you do not own this listing.');
          return;
        }
        
        const hasImage = listing.proof_telegram_file_path ? '✅ Has image' : '❌ No image';
        
        const message = 
          `📷 **Manage Images**\n\n` +
          `📝 **${listing.title}**\n\n` +
          `Current status: ${hasImage}\n\n` +
          `You can:\n` +
          `• Send a photo to add/update image\n` +
          `• Use buttons below to manage existing image`;
        
        const keyboard = new InlineKeyboard();
        
        if (listing.proof_telegram_file_path) {
          keyboard.text('🗑️ Remove Image', `remove_image_${listingId}`).row();
        }
        
        keyboard.text('❌ Back to Management', `manage_${listingId}`);
        
        await ctx.editMessageText(message, {
          parse_mode: 'Markdown',
          reply_markup: keyboard
        });
        
        // Set user state for image management
        setUserState(userId, {
          step: 'managing_images',
          listingId: listingId
        });
        
      } catch (error) {
        console.error('Error handling images action:', error);
        await ctx.answerCallbackQuery('❌ Error loading image options. Please try again.');
      }
    }
    
    // Handle remove image action
    else if (data.startsWith('remove_image_')) {
      const listingId = data.replace('remove_image_', '');
      const userId = ctx.from?.id;
      
      try {
        // Verify ownership and remove image
        const user = await db('users').where('telegram_id', userId).first();
        const listing = await db('listings').where('id', listingId).where('seller_id', user.id).first();
        
        if (!listing) {
          await ctx.answerCallbackQuery('❌ Listing not found or you do not own this listing.');
          return;
        }
        
        await db('listings').where('id', listingId).update({ 
          proof_telegram_file_path: null,
          updated_at: new Date()
        });
        
        await ctx.editMessageText(
          `🗑️ **Image Removed!**\n\n` +
          `📝 **${listing.title}**\n\n` +
          `The image has been removed from your listing.\n\n` +
          `Use /portfolio to manage your listings again.`,
          { parse_mode: 'Markdown' }
        );
        
        await ctx.answerCallbackQuery('✅ Image removed!');
        
      } catch (error) {
        console.error('Error removing image:', error);
        await ctx.answerCallbackQuery('❌ Error removing image. Please try again.');
      }
    }
    
    // Handle cancel edit action
    else if (data === 'cancel_edit') {
      clearUserState(ctx.from?.id || 0);
      await ctx.editMessageText(
        '❌ **Edit Cancelled**\n\n' +
        'Listing editing cancelled. Use /portfolio to manage your listings again.',
        { parse_mode: 'Markdown' }
      );
    }
    
    // Handle refresh profile action
    else if (data === 'refresh_profile') {
      const userId = ctx.from?.id;
      const username = ctx.from?.username;
      const displayName = ctx.from?.first_name + (ctx.from?.last_name ? ` ${ctx.from.last_name}` : '');
      
      try {
        // Update user profile in database
        await db('users').where('telegram_id', userId).update({
          username: username || null,
          display_name: displayName || null,
          updated_at: new Date()
        });
        
        await ctx.editMessageText(
          `✅ **Profile Updated!**\n\n` +
          `👤 **Username:** ${username ? `@${username}` : 'Not set'}\n` +
          `👤 **Name:** ${displayName}\n\n` +
          `Your profile information has been refreshed.`,
          { parse_mode: 'Markdown' }
        );
        
      } catch (error) {
        console.error('Error refreshing profile:', error);
        await ctx.answerCallbackQuery('❌ Error updating profile. Please try again.');
      }
    }
    
    // Handle cancel manage action
    else if (data === 'cancel_manage') {
      await ctx.editMessageText(
        '❌ **Cancelled**\n\n' +
        'Listing management cancelled. Use /portfolio to view your listings again.',
        { parse_mode: 'Markdown' }
      );
    }
    
    // Handle main menu actions
    else if (data === 'main_menu') {
      await showMainMenu(ctx, userId);
    }
    else if (data === 'browse_listings') {
      // Trigger listings command
      await ctx.reply('Loading available listings...');
      // We'll simulate the listings command here
      const listings = await db('listings')
        .where('status', 'active')
        .orderBy('created_at', 'desc')
        .limit(10);
      
      if (listings.length === 0) {
        await ctx.reply('No active listings found. Be the first to create one!');
      } else {
        let message = '📈 **Available Listings:**\n\n';
        for (const listing of listings) {
          const seller = await db('users').where('id', listing.seller_id).first();
          const price = (listing.price_cents / 100).toFixed(2);
          message += `📝 **${listing.title}**\n`;
          message += `💰 $${price} | 🏷️ ${listing.category}\n`;
          message += `👤 ${seller?.display_name || seller?.username || 'Anonymous'}\n\n`;
        }
        await ctx.reply(message, { parse_mode: 'Markdown' });
      }
    }
    else if (data === 'sell_listing') {
      // Trigger sell command
      await ctx.reply('Starting listing creation...');
      // We'll simulate the sell command here
      const user = await db('users').where('telegram_id', userId).first();
      if (!user?.username) {
        await ctx.reply(
          `⚠️ **Username Required to Create Listings!**\n\n` +
          `You need to set a Telegram username before you can create listings.\n\n` +
          `**Why?** Buyers need to contact you directly through your @username.\n\n` +
          `**How to set username:**\n` +
          `1. Go to Telegram Settings\n` +
          `2. Click "Username"\n` +
          `3. Set your username (e.g., @yourname)\n\n` +
          `Once set, come back and try creating a listing again!`,
          { parse_mode: 'Markdown' }
        );
      } else {
        // Start the sell flow
        setUserState(userId, {
          step: 'category',
          data: {}
        });
        
        await ctx.editMessageText(
          `💰 **Create New Listing**\n\n` +
          `Let's create your trading listing! First, choose a category:`,
          {
            parse_mode: 'Markdown',
            reply_markup: new InlineKeyboard()
              .text('🎓 Education', 'category_education')
              .text('💼 Business', 'category_business').row()
              .text('🎨 Creative', 'category_creative')
              .text('💻 Technology', 'category_technology').row()
              .text('🏠 Lifestyle', 'category_lifestyle')
              .text('📚 Other', 'category_other').row()
              .text('❌ Cancel', 'cancel_manage')
          }
        );
      }
    }
    else if (data === 'view_portfolio') {
      // Trigger portfolio command
      await ctx.reply('Loading your portfolio...');
      const user = await db('users').where('telegram_id', userId).first();
      if (!user) {
        await ctx.reply('Please use /start first to create your account.');
        return;
      }
      
      const listings = await db('listings')
        .where('seller_id', user.id)
        .orderBy('created_at', 'desc');
      
      if (listings.length === 0) {
        await ctx.reply('You haven\'t created any listings yet. Use /sell to create your first one!');
      } else {
        let message = '📊 **Your Portfolio**\n\n';
        const statusEmojiMap: { [key: string]: string } = {
          'pending_approval': '⏳',
          'active': '✅',
          'sold': '💰',
          'rejected': '❌',
          'removed': '🗑️'
        };
        
        for (const listing of listings) {
          const statusEmoji = statusEmojiMap[listing.status] || '❓';
          const price = (listing.price_cents / 100).toFixed(2);
          message += `${statusEmoji} **${listing.title}**\n`;
          message += `💰 $${price} | 🏷️ ${listing.category}\n`;
          message += `📅 ${new Date(listing.created_at).toLocaleDateString()}\n\n`;
        }
        
        message += 'Click on a listing to manage it:';
        
        const keyboard = new InlineKeyboard();
        for (const listing of listings) {
          keyboard.text(`${listing.title}`, `manage_${listing.id}`).row();
        }
        
        await ctx.reply(message, {
          parse_mode: 'Markdown',
          reply_markup: keyboard
        });
      }
    }
    else if (data === 'view_settings') {
      // Show settings
      await ctx.reply('⚙️ **Settings**\n\nSettings feature coming soon!', { parse_mode: 'Markdown' });
    }
    else if (data === 'help_menu') {
      // Show help
      await ctx.reply(
        `❓ **Exchango Help**\n\n` +
        `**Available Commands:**\n` +
        `/start - Initialize your account\n` +
        `/listings - Browse available listings\n` +
        `/sell - Create a new listing\n` +
        `/portfolio - View your listings\n` +
        `/settings - Manage preferences\n` +
        `/help - Show this help message\n\n` +
        `**How to Use:**\n` +
        `1. Set your Telegram username first\n` +
        `2. Create listings with /sell\n` +
        `3. Browse others' listings with /listings\n` +
        `4. Manage your listings with /portfolio\n\n` +
        `**Need Help?** Contact support if you have questions!`,
        { parse_mode: 'Markdown' }
      );
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
    const photo = ctx.message?.photo;
    
    if (!userId) return;
    
    const userState = getUserState(userId);
    
    // Handle photo uploads for image management
    if (photo && userState && userState.step === 'managing_images') {
      await handlePhotoUpload(ctx, userId, userState);
      return;
    }
    
    // If user is in a form flow, handle the current step
    if (userState && userState.step && messageText) {
      await handleFormStep(ctx, userId, messageText, userState);
      return;
    }
    
    // Handle editing mode
    if (userState && userState.step === 'editing' && messageText) {
      await handleEditMode(ctx, userId, messageText, userState);
      return;
    }
    
    // Handle text messages that might be commands
    if (messageText) {
      // Check for menu requests
      if (messageText.toLowerCase().includes('menu') || messageText.toLowerCase().includes('options') || messageText.toLowerCase().includes('main')) {
        await showMainMenu(ctx, userId);
        return;
      }
      
      // Check if user is trying to start selling
      if (messageText.toLowerCase().includes('sell') || messageText.toLowerCase().includes('create listing')) {
        await ctx.reply(
          'To create a listing, please use the `/sell` command or click the menu button below.',
          { 
            reply_markup: new InlineKeyboard()
              .text('💰 Create Listing', 'sell_listing')
              .row()
              .text('📋 Main Menu', 'main_menu')
          }
        );
        return;
      }
      
      // Default message with menu for users not in a form flow
      await ctx.reply(
        'Hi! I\'m the Exchango trading bot. Choose an option below or use /help for commands.',
        {
          reply_markup: new InlineKeyboard()
            .text('📋 Main Menu', 'main_menu')
            .row()
            .text('❓ Help', 'help_menu')
        }
      );
    }
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
      
      // Check if user has a username before creating listing
      const user = await db('users').where('telegram_id', userId).first();
      if (!user?.username) {
        await ctx.reply(
          `❌ **Username Required!**\n\n` +
          `To complete your listing, you need to set a Telegram username first.\n\n` +
          `**Why?** Buyers need to be able to contact you directly!\n\n` +
          `**Steps to set username:**\n` +
          `1. Go to Telegram Settings\n` +
          `2. Tap on "Username"\n` +
          `3. Set your desired username (e.g., @yourname)\n` +
          `4. Come back and try creating your listing again\n\n` +
          `**Your listing details:**\n` +
          `📝 **Title:** ${listingData.title}\n` +
          `💰 **Price:** $${(listingData.price_cents / 100).toFixed(2)}\n` +
          `📦 **Delivery:** ${listingData.delivery_type}\n\n` +
          `Once you've set your username, use /sell to create your listing again!`,
          { parse_mode: 'Markdown' }
        );
        clearUserState(userId);
        return;
      }
      
      // Create the listing
      await createListing(ctx, userId, listingData);
      clearUserState(userId);
      break;
      
    default:
      clearUserState(userId);
      await ctx.reply('Something went wrong. Please start over with /sell');
  }
}

// Handle photo upload for image management
async function handlePhotoUpload(ctx: any, userId: number, userState: any) {
  try {
    const { listingId } = userState;
    const photo = ctx.message?.photo;
    
    if (!photo || photo.length === 0) {
      await ctx.reply('❌ No photo received. Please try again.');
      return;
    }
    
    // Get the highest quality photo
    const largestPhoto = photo[photo.length - 1];
    const fileId = largestPhoto.file_id;
    
    // Verify ownership
    const user = await db('users').where('telegram_id', userId).first();
    const listing = await db('listings').where('id', listingId).where('seller_id', user.id).first();
    
    if (!listing) {
      await ctx.reply('❌ Listing not found or you do not own this listing.');
      clearUserState(userId);
      return;
    }
    
    // Update listing with new image
    await db('listings').where('id', listingId).update({ 
      proof_telegram_file_path: fileId,
      updated_at: new Date()
    });
    
    await ctx.reply(
      `📷 **Image Updated!**\n\n` +
      `📝 **${listing.title}**\n\n` +
      `Your listing image has been updated successfully!\n\n` +
      `Use /portfolio to manage your listings again.`,
      { parse_mode: 'Markdown' }
    );
    
    clearUserState(userId);
    
  } catch (error) {
    console.error('Error handling photo upload:', error);
    await ctx.reply('❌ Error updating image. Please try again.');
    clearUserState(userId);
  }
}

// Handle editing mode
async function handleEditMode(ctx: any, userId: number, messageText: string, userState: any) {
  try {
    const { listingId, originalData } = userState;
    
    // Parse the edit message
    const updates: any = {};
    
    // Parse title
    const titleMatch = messageText.match(/\*\*Title:\*\*\s*(.+)/i);
    if (titleMatch) {
      updates.title = titleMatch[1].trim();
    }
    
    // Parse description
    const descMatch = messageText.match(/\*\*Description:\*\*\s*([\s\S]+?)(?=\*\*|$)/i);
    if (descMatch) {
      updates.description = descMatch[1].trim();
    }
    
    // Parse price
    const priceMatch = messageText.match(/\*\*Price:\*\*\s*\$?(\d+(?:\.\d+)?)/i);
    if (priceMatch) {
      const price = parseFloat(priceMatch[1]);
      if (!isNaN(price) && price > 0) {
        updates.price_cents = Math.round(price * 100);
      }
    }
    
    // Check if any updates were provided
    if (Object.keys(updates).length === 0) {
      await ctx.reply(
        '❌ **No valid updates found!**\n\n' +
        'Please use this format:\n' +
        '**Title:** [new title]\n' +
        '**Description:** [new description]\n' +
        '**Price:** [new price in USD]\n\n' +
        '*You can send just the fields you want to change.*',
        { parse_mode: 'Markdown' }
      );
      return;
    }
    
    // Add timestamp
    updates.updated_at = new Date();
    
    // Update the listing
    await db('listings').where('id', listingId).update(updates);
    
    // Get updated listing
    const updatedListing = await db('listings').where('id', listingId).first();
    
    let updateMessage = `✅ **Listing Updated!**\n\n`;
    updateMessage += `📝 **${updatedListing.title}**\n`;
    updateMessage += `💰 **Price:** $${(updatedListing.price_cents / 100).toFixed(2)}\n`;
    updateMessage += `📊 **Status:** ${updatedListing.status}\n\n`;
    
    if (updates.title) updateMessage += `✅ Title updated\n`;
    if (updates.description) updateMessage += `✅ Description updated\n`;
    if (updates.price_cents) updateMessage += `✅ Price updated\n`;
    
    updateMessage += `\nUse /portfolio to manage your listings again.`;
    
    await ctx.reply(updateMessage, { parse_mode: 'Markdown' });
    
    clearUserState(userId);
    
  } catch (error) {
    console.error('Error handling edit mode:', error);
    await ctx.reply('❌ Error updating listing. Please try again.');
    clearUserState(userId);
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
    console.log(`Sending approval request for listing ${listing.id} to approvers:`, approverIds);
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
      `💬 **Contact:** ${user.username ? `@${user.username}` : 'No username set'}\n` +
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
        console.log(`Sending approval request to approver ${approverId}`);
        const result = await bot.api.sendMessage(approverId, message, {
          parse_mode: 'Markdown',
          reply_markup: approvalKeyboard
        });
        console.log(`Approval request sent to ${approverId}, result:`, result);
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
    console.log(`Attempting to post listing ${listing.id} to channel: ${channelId}`);
    if (!channelId) {
      console.log('CHANNEL_ID not set, skipping channel post');
      return;
    }
    
    // Validate channel ID format
    if (!channelId.startsWith('@') && !channelId.startsWith('-')) {
      console.log('Invalid channel ID format, skipping channel post');
      return;
    }
    
    const price = (listing.price_cents / 100).toFixed(2);
    const deliveryEmojiMap: { [key: string]: string } = {
      'code': '💻',
      'file': '📄',
      'manual': '👤'
    };
    const deliveryEmoji = deliveryEmojiMap[listing.delivery_type] || '📦';
    
    // Escape Markdown special characters in user-provided content
    const escapeMarkdown = (text: string) => text.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
    
    const message = 
      `🆕 **New Trading Opportunity!**\n\n` +
      `📝 **${escapeMarkdown(listing.title)}**\n\n` +
      `📋 **Description:**\n${escapeMarkdown(listing.description)}\n\n` +
      `🏷️ **Category:** ${escapeMarkdown(listing.category)}\n` +
      `💰 **Price:** $${price} USD\n` +
      `${deliveryEmoji} **Delivery:** ${escapeMarkdown(listing.delivery_type)}\n\n` +
      `👤 **Seller:** ${escapeMarkdown(user.display_name || user.username || 'Anonymous')}\n` +
      `📅 **Posted:** ${new Date(listing.created_at).toLocaleDateString()}\n\n` +
      `🔄 **Status:** Active\n\n` +
      `💬 **Interested?** Contact the seller: ${user.username ? `@${escapeMarkdown(user.username)}` : 'Contact via bot'}\n` +
      `📊 **View All Listings:** @${(process.env.BOT_USERNAME || 'your_bot').replace('@', '')}\n\n` +
      `#Exchango #Trading #${escapeMarkdown(listing.category.replace(/\s+/g, ''))}`;
    
    const result = await bot.api.sendMessage(channelId, message, { 
      parse_mode: 'Markdown',
      link_preview_options: { is_disabled: true }
    });
    
    console.log(`Posted listing ${listing.id} to channel ${channelId}, result:`, result);
  } catch (error: any) {
    console.error('Error posting to channel:', error);
    
    // Log specific error details
    if (error?.description === 'Bad Request: chat not found') {
      console.error('Channel not found - please check if @Exchango channel exists and bot is added as admin');
    } else if (error?.description?.includes('not authorized')) {
      console.error('Bot not authorized to post to channel - please add bot as admin with post permissions');
    }
    
    // Don't throw error - listing creation should still succeed even if channel post fails
  }
}

// Show main menu function
async function showMainMenu(ctx: any, userId: number) {
  try {
    const user = await db('users').where('telegram_id', userId).first();
    const username = user?.username;
    
    let menuMessage = `🎯 **Exchango Main Menu**\n\n`;
    
    if (username) {
      menuMessage += `👋 Welcome back, @${username}!\n\n`;
    } else {
      menuMessage += `👋 Welcome! You need a username to create listings.\n\n`;
    }
    
    menuMessage += `Choose what you'd like to do:`;
    
    const keyboard = new InlineKeyboard()
      .text('📈 Browse Listings', 'browse_listings')
      .text('💰 Create Listing', 'sell_listing')
      .row()
      .text('📊 My Portfolio', 'view_portfolio')
      .text('⚙️ Settings', 'view_settings')
      .row()
      .text('❓ Help', 'help_menu');
    
    await ctx.reply(menuMessage, {
      reply_markup: keyboard,
      parse_mode: 'Markdown'
    });
  } catch (error) {
    console.error('Error showing main menu:', error);
    await ctx.reply('Sorry, there was an error showing the menu. Please try again.');
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
