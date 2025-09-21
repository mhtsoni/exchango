import express, { Router } from 'express';
import { Bot, InlineKeyboard } from 'grammy';
import { UserService } from '../services/UserService';
import { ListingService } from '../services/ListingService';
import { UserStateService } from '../services/UserStateService';
import { FormHandler } from '../handlers/FormHandler';
import { CallbackHandler } from '../handlers/CallbackHandler';

const router: Router = express.Router();

// Initialize bot for webhook processing
const bot = new Bot(process.env.BOT_TOKEN!);

// Initialize handlers
const formHandler = new FormHandler(bot);
const callbackHandler = new CallbackHandler(bot);

// Bot command handlers
bot.command('start', async (ctx) => {
  const userId = ctx.from?.id;
  const username = ctx.from?.username;
  const displayName = ctx.from?.first_name + (ctx.from?.last_name ? ` ${ctx.from.last_name}` : '');
  
  try {
    // Create or update user
    const user = await UserService.findOrCreateUser(userId!, {
      username,
      displayName,
      firstName: ctx.from?.first_name,
      lastName: ctx.from?.last_name
    });
    
    let welcomeMessage = `🎉 Welcome to Exchango, ${displayName || username || 'trader'}!\n\n`;
    
    if (username) {
      welcomeMessage += `✅ Ready to create listings!\n\n`;
    } else {
      welcomeMessage += `⚠️ **Important:** You need a Telegram username to create listings!\n` +
        `Buyers must be able to contact you directly. Go to Telegram Settings → Username to set one.\n\n`;
    }
    
    welcomeMessage += `I'm your personal trading assistant. Here's what you can do:\n\n` +
      `💰 /sell - List your own trading opportunity\n` +
      `📊 /portfolio - View your trading history\n` +
      `⚙️ /settings - Manage your preferences\n\n` +
      `Ready to start trading? Browse listings on our channel!`;
    
    await ctx.reply(welcomeMessage, {
      reply_markup: new InlineKeyboard()
        .text('📋 Main Menu', 'main_menu')
        .row()
        .text('❓ Help', 'help_menu'),
      reply_to_message_id: ctx.message?.message_id
    });
  } catch (error) {
    console.error('Error handling /start command:', error);
    await ctx.reply('Sorry, there was an error processing your request. Please try again later.');
  }
});

bot.command('sell', async (ctx) => {
  try {
    const userId = ctx.from?.id;
    if (!userId) return;
    
    console.log(`/sell command called by user ${userId}`);
    
    // Check if user exists and refresh their data if needed
    let user = await UserService.findOrCreateUser(userId, {
      username: ctx.from?.username,
      displayName: `${ctx.from?.first_name} ${ctx.from?.last_name || ''}`.trim(),
      firstName: ctx.from?.first_name,
      lastName: ctx.from?.last_name
    });
    
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
    UserStateService.setUserState(userId, {
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
    if (!userId) return;
    
    const user = await UserService.getUserByTelegramId(userId);
    if (!user) {
      await ctx.reply('Please use /start first to create your account.');
      return;
    }
    
    const listingService = new ListingService(bot);
    const listings = await listingService.getListingsBySeller(user.id);
    
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
    if (!userId) return;
    
    const user = await UserService.getUserByTelegramId(userId);
    if (!user) {
      await ctx.reply('Please use /start first to create your account.');
      return;
    }
    
    await ctx.reply(
      `⚙️ **Your Settings**\n\n` +
      `👤 **Profile:**\n` +
      `Name: ${user.display_name || 'Not set'}\n` +
      `Username: ${user.username ? `@${user.username.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&')}` : 'Not set'}\n` +
      `Telegram ID: ${user.telegram_id}\n\n` +
      `📊 **Account Status:**\n` +
      `KYC Status: ${user.kyc_status}\n` +
      `Rating: ${user.rating}/5 ⭐\n\n` +
      `📅 **Member Since:** ${new Date(user.created_at).toLocaleDateString()}\n\n` +
      `**Available Actions:**\n` +
      `• Update profile information\n` +
      `• Change notification settings\n` +
      `• Privacy preferences\n\n` +
      `Settings management coming soon! For now, your basic profile is set up and ready to trade.`,
      { parse_mode: 'Markdown' }
    );
  } catch (error) {
    console.error('Error handling /settings command:', error);
    await ctx.reply('Sorry, there was an error accessing your settings. Please try again later.');
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
    `/sell - Create a new listing\n` +
    `/portfolio - View your trading history\n` +
    `/settings - Manage your preferences\n` +
    `/help - Show this help message\n\n` +
    `**Getting Started:**\n` +
    `1. Use /start to begin\n` +
    `2. Browse listings on our trading channel\n` +
    `3. Use /sell to create your own listings\n` +
    `4. Check /portfolio for your activity\n\n` +
    `Need support? Contact the admin.`,
    { parse_mode: 'Markdown' }
  );
});

bot.command('cancel', async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;
  
  UserStateService.clearUserState(userId);
  await ctx.reply(
    '❌ **Cancelled**\n\n' +
    'Listing creation has been cancelled. Use /sell to start again or /help for other commands.',
    { parse_mode: 'Markdown' }
  );
});

// Handle callback queries for inline keyboards
bot.on('callback_query:data', async (ctx) => {
  await callbackHandler.handleCallbackQuery(ctx);
});

// Handle form flow messages
bot.on('message', async (ctx) => {
  try {
    const userId = ctx.from?.id;
    const messageText = ctx.message?.text;
    const photo = ctx.message?.photo;
    
    if (!userId) return;
    
    const userState = UserStateService.getUserState(userId);
    
    // Handle photo uploads for image management
    if (photo && userState && userState.step === 'managing_images') {
      await handlePhotoUpload(ctx, userId, userState);
      return;
    }
    
    // If user is in a form flow, handle the current step
    if (userState && userState.step && messageText) {
      await formHandler.handleFormStep(ctx, userId, messageText, userState);
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
        'Hi! I\'m the Exchango trading bot. Choose an option below:',
        {
          reply_markup: new InlineKeyboard()
            .text('📋 Main Menu', 'main_menu')
            .text('💰 Sell', 'sell_listing')
            .row()
            .text('📊 Portfolio', 'view_portfolio')
            .text('⚙️ Settings', 'view_settings')
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
    const user = await UserService.getUserByTelegramId(userId);
    if (!user) return;
    
    const listingService = new ListingService(bot);
    const listing = await listingService.verifyListingOwnership(listingId, user.id);
    
    if (!listing) {
      await ctx.reply('❌ Listing not found or you do not own this listing.');
      UserStateService.clearUserState(userId);
      return;
    }
    
    // Update listing with new image
    await listingService.updateListing(listingId, { 
      proof_telegram_file_path: fileId
    });
    
    await ctx.reply(
      `📷 **Image Updated!**\n\n` +
      `📝 **${listing.title}**\n\n` +
      `Your listing image has been updated successfully!\n\n` +
      `Use /portfolio to manage your listings again.`,
      { parse_mode: 'Markdown' }
    );
    
    UserStateService.clearUserState(userId);
    
  } catch (error) {
    console.error('Error handling photo upload:', error);
    await ctx.reply('❌ Error updating image. Please try again.');
    UserStateService.clearUserState(userId);
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
    
    // Update the listing
    const listingService = new ListingService(bot);
    await listingService.updateListing(listingId, updates);
    
    // Get updated listing
    const updatedListing = await listingService.getListingById(listingId);
    
    let updateMessage = `✅ **Listing Updated!**\n\n`;
    updateMessage += `📝 **${updatedListing?.title}**\n`;
    updateMessage += `💰 **Price:** $${(updatedListing?.price_cents! / 100).toFixed(2)}\n`;
    updateMessage += `📊 **Status:** ${updatedListing?.status}\n\n`;
    
    if (updates.title) updateMessage += `✅ Title updated\n`;
    if (updates.description) updateMessage += `✅ Description updated\n`;
    if (updates.price_cents) updateMessage += `✅ Price updated\n`;
    
    updateMessage += `\nUse /portfolio to manage your listings again.`;
    
    await ctx.reply(updateMessage, { parse_mode: 'Markdown' });
    
    UserStateService.clearUserState(userId);
    
  } catch (error) {
    console.error('Error handling edit mode:', error);
    await ctx.reply('❌ Error updating listing. Please try again.');
    UserStateService.clearUserState(userId);
  }
}

// Show main menu function
async function showMainMenu(ctx: any, userId: number) {
  try {
    const user = await UserService.getUserByTelegramId(userId);
    const username = user?.username;
    
    let menuMessage = `🎯 **Exchango Main Menu**\n\n`;
    
    if (username) {
      // Escape the @ symbol for Markdown
      menuMessage += `👋 Welcome back, @${username.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&')}!\n\n`;
    } else {
      menuMessage += `👋 Welcome! You need a username to create listings.\n\n`;
    }
    
    menuMessage += `Choose what you'd like to do:`;
    
    const keyboard = new InlineKeyboard()
      .text('💰 Create Listing', 'sell_listing')
      .text('📊 My Portfolio', 'view_portfolio')
      .row()
      .text('⚙️ Settings', 'view_settings')
      .text('❓ Help', 'help_menu')
      .row()
      .text('🏠 Home', 'main_menu');
    
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
