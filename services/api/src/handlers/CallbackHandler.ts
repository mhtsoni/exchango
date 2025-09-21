import { Bot, InlineKeyboard } from 'grammy';
import { UserService } from '../services/UserService';
import { ListingService } from '../services/ListingService';
import { UserStateService } from '../services/UserStateService';
import { ApprovalService } from '../services/ApprovalService';

export class CallbackHandler {
  private bot: Bot;
  private listingService: ListingService;
  private approvalService: ApprovalService;

  constructor(bot: Bot) {
    this.bot = bot;
    this.listingService = new ListingService(bot);
    this.approvalService = new ApprovalService(bot);
  }

  async handleCallbackQuery(ctx: any): Promise<void> {
    try {
      const userId = ctx.from?.id;
      const data = ctx.callbackQuery.data;
      
      if (!userId) return;
      
      // Handle category selection
      if (data.startsWith('category_')) {
        await this.handleCategorySelection(ctx, userId, data);
      }
      // Handle pricing selection
      else if (data.startsWith('price_')) {
        await this.handlePriceSelection(ctx, userId, data);
      }
      // Handle delivery selection
      else if (data.startsWith('delivery_')) {
        await this.handleDeliverySelection(ctx, userId, data);
      }
      // Handle navigation
      else if (data === 'back_to_category') {
        await this.handleBackToCategory(ctx);
      }
      else if (data === 'back_to_pricing') {
        await this.handleBackToPricing(ctx, userId);
      }
      // Handle cancellation
      else if (data === 'cancel_sell') {
        await this.handleCancelSell(ctx, userId);
      }
      // Handle approval actions
      else if (data.startsWith('approve_') || data.startsWith('deny_')) {
        await this.handleApprovalAction(ctx, userId, data);
      }
      // Handle listing management actions
      else if (data.startsWith('manage_')) {
        await this.handleManageAction(ctx, userId, data);
      }
      else if (data.startsWith('mark_sold_')) {
        await this.handleMarkSoldAction(ctx, userId, data);
      }
      else if (data.startsWith('delete_')) {
        await this.handleDeleteAction(ctx, userId, data);
      }
      else if (data.startsWith('edit_')) {
        await this.handleEditAction(ctx, userId, data);
      }
      else if (data.startsWith('images_')) {
        await this.handleImagesAction(ctx, userId, data);
      }
      else if (data.startsWith('remove_image_')) {
        await this.handleRemoveImageAction(ctx, userId, data);
      }
      else if (data === 'cancel_edit') {
        await this.handleCancelEdit(ctx, userId);
      }
      else if (data === 'cancel_manage') {
        await this.handleCancelManage(ctx);
      }
      // Handle main menu actions
      else if (data === 'main_menu') {
        await this.handleMainMenu(ctx, userId);
      }
      else if (data === 'sell_listing') {
        await this.handleSellListing(ctx, userId);
      }
      else if (data === 'view_portfolio') {
        await this.handleViewPortfolio(ctx, userId);
      }
      else if (data === 'view_settings') {
        await this.handleViewSettings(ctx);
      }
      else if (data === 'help_menu') {
        await this.handleHelpMenu(ctx);
      }
      
      await ctx.answerCallbackQuery();
    } catch (error) {
      console.error('Error handling callback query:', error);
      await ctx.answerCallbackQuery('Error occurred. Please try again.');
    }
  }

  private async handleCategorySelection(ctx: any, userId: number, data: string): Promise<void> {
    const category = data.replace('category_', '').replace(/_/g, ' ');
    let userState = UserStateService.getUserState(userId);
    
    console.log(`Category selection for user ${userId}, current state:`, userState);
    
    // If userState is undefined, initialize it
    if (!userState) {
      console.log(`Initializing user state for user ${userId}`);
      userState = {
        step: 'category',
        listingData: {}
      };
    }
    
    // Ensure listingData exists
    if (!userState.listingData) {
      userState.listingData = {};
    }
    
    userState.listingData.category = category;
    userState.step = 'pricing';
    UserStateService.setUserState(userId, userState);
      
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

  private async handlePriceSelection(ctx: any, userId: number, data: string): Promise<void> {
    const userState = UserStateService.getUserState(userId);
    if (!userState) return;

    if (data === 'price_custom') {
      userState.step = 'custom_price';
      UserStateService.setUserState(userId, userState);
      
      await ctx.editMessageText(
        `💰 **Enter Custom Price**\n\n` +
        `Please enter your monthly subscription price in USD:\n\n` +
        `*Examples: 15, 75, 150*`,
        { parse_mode: 'Markdown' }
      );
    } else {
      const price = parseInt(data.replace('price_', ''));
      
      // Ensure userState and listingData exist
      if (!userState.listingData) {
        userState.listingData = {};
      }
      
      userState.listingData.price_cents = price;
      userState.step = 'delivery';
      UserStateService.setUserState(userId, userState);
      
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

  private async handleDeliverySelection(ctx: any, userId: number, data: string): Promise<void> {
    const userState = UserStateService.getUserState(userId);
    if (!userState) return;

    const deliveryType = data.replace('delivery_', '');
    
    // Ensure listingData exists
    if (!userState.listingData) {
      userState.listingData = {};
    }
    
    userState.listingData.delivery_type = deliveryType;
    userState.step = 'details';
    UserStateService.setUserState(userId, userState);
    
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

  private async handleBackToCategory(ctx: any): Promise<void> {
    const keyboard = new InlineKeyboard()
      .text('🎬 Streaming Services', 'category_streaming')
      .text('🎵 Music & Audio', 'category_music').row()
      .text('💑 Dating Apps', 'category_dating')
      .text('📱 Software & Apps', 'category_software').row()
      .text('🎫 Events & Tickets', 'category_events')
      .text('☁️ Cloud Storage', 'category_storage').row()
      .text('📚 Education', 'category_education')
      .text('🎮 Gaming', 'category_gaming').row()
      .text('❌ Cancel', 'cancel_sell');
    
    await ctx.editMessageText(
      `🚀 **Share Your Subscription or Sell Tickets**\n\n` +
      `Choose the category that best fits what you're sharing:`,
      {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      }
    );
  }

  private async handleBackToPricing(ctx: any, userId: number): Promise<void> {
    const userState = UserStateService.getUserState(userId);
    if (!userState) return;

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
      `Category: ${userState.listingData?.category || 'Unknown'}\n\n` +
      `Select a price tier or choose custom:`,
      {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      }
    );
  }

  private async handleCancelSell(ctx: any, userId: number): Promise<void> {
    UserStateService.clearUserState(userId);
    await ctx.editMessageText(
      '❌ **Cancelled**\n\n' +
      'Subscription creation cancelled. Use /sell to start again.',
      { parse_mode: 'Markdown' }
    );
  }

  private async handleApprovalAction(ctx: any, userId: number, data: string): Promise<void> {
    const listingId = data.replace(/^(approve_|deny_)/, '');
    const isApproved = data.startsWith('approve_');
    
    const result = await this.approvalService.processApproval(listingId, isApproved, userId);
    
    if (result.success) {
      await ctx.editMessageText(result.message, { parse_mode: 'Markdown' });
      await ctx.answerCallbackQuery(isApproved ? '✅ Listing approved and posted to channel!' : '❌ Listing rejected');
    } else {
      await ctx.answerCallbackQuery(result.message);
    }
  }

  private async handleManageAction(ctx: any, userId: number, data: string): Promise<void> {
    const listingId = data.replace('manage_', '');
    
    try {
      // Verify the user owns this listing
      const user = await UserService.getUserByTelegramId(userId);
      if (!user) return;
      
      const listing = await this.listingService.verifyListingOwnership(listingId, user.id);
      
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

  private async handleMarkSoldAction(ctx: any, userId: number, data: string): Promise<void> {
    const listingId = data.replace('mark_sold_', '');
    
    try {
      // Verify ownership and update status
      const user = await UserService.getUserByTelegramId(userId);
      if (!user) return;
      
      const listing = await this.listingService.verifyListingOwnership(listingId, user.id);
      
      if (!listing) {
        await ctx.answerCallbackQuery('❌ Listing not found or you do not own this listing.');
        return;
      }
      
      // Update listing status to sold
      await this.listingService.updateListingStatus(listingId, 'sold');
      
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

  private async handleDeleteAction(ctx: any, userId: number, data: string): Promise<void> {
    const listingId = data.replace('delete_', '');
    
    try {
      // Verify ownership and update status
      const user = await UserService.getUserByTelegramId(userId);
      if (!user) return;
      
      const listing = await this.listingService.verifyListingOwnership(listingId, user.id);
      
      if (!listing) {
        await ctx.answerCallbackQuery('❌ Listing not found or you do not own this listing.');
        return;
      }
      
      // Update listing status to removed
      await this.listingService.updateListingStatus(listingId, 'removed');
      
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

  private async handleEditAction(ctx: any, userId: number, data: string): Promise<void> {
    const listingId = data.replace('edit_', '');
    
    try {
      // Verify ownership
      const user = await UserService.getUserByTelegramId(userId);
      if (!user) return;
      
      const listing = await this.listingService.verifyListingOwnership(listingId, user.id);
      
      if (!listing) {
        await ctx.answerCallbackQuery('❌ Listing not found or you do not own this listing.');
        return;
      }
      
      if (listing.status === 'sold' || listing.status === 'removed') {
        await ctx.answerCallbackQuery('❌ Cannot edit sold or deleted listings.');
        return;
      }
      
      // Set user state for editing
      UserStateService.setUserState(userId, {
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

  private async handleImagesAction(ctx: any, userId: number, data: string): Promise<void> {
    const listingId = data.replace('images_', '');
    
    try {
      // Verify ownership
      const user = await UserService.getUserByTelegramId(userId);
      if (!user) return;
      
      const listing = await this.listingService.verifyListingOwnership(listingId, user.id);
      
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
      UserStateService.setUserState(userId, {
        step: 'managing_images',
        listingId: listingId
      });
      
    } catch (error) {
      console.error('Error handling images action:', error);
      await ctx.answerCallbackQuery('❌ Error loading image options. Please try again.');
    }
  }

  private async handleRemoveImageAction(ctx: any, userId: number, data: string): Promise<void> {
    const listingId = data.replace('remove_image_', '');
    
    try {
      // Verify ownership and remove image
      const user = await UserService.getUserByTelegramId(userId);
      if (!user) return;
      
      const listing = await this.listingService.verifyListingOwnership(listingId, user.id);
      
      if (!listing) {
        await ctx.answerCallbackQuery('❌ Listing not found or you do not own this listing.');
        return;
      }
      
      await this.listingService.updateListing(listingId, { 
        proof_telegram_file_path: undefined
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

  private async handleCancelEdit(ctx: any, userId: number): Promise<void> {
    UserStateService.clearUserState(userId);
    await ctx.editMessageText(
      '❌ **Edit Cancelled**\n\n' +
      'Listing editing cancelled. Use /portfolio to manage your listings again.',
      { parse_mode: 'Markdown' }
    );
  }

  private async handleCancelManage(ctx: any): Promise<void> {
    await ctx.editMessageText(
      '❌ **Cancelled**\n\n' +
      'Listing management cancelled. Use /portfolio to view your listings again.',
      { parse_mode: 'Markdown' }
    );
  }

  private async handleMainMenu(ctx: any, userId: number): Promise<void> {
    try {
      const user = await UserService.getUserByTelegramId(userId);
      const username = user?.username;
      
      let menuMessage = `🎯 **SubShare Main Menu**\n\n`;
      
      if (username) {
        // Escape the @ symbol for Markdown
        menuMessage += `👋 Welcome back, @${username.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&')}!\n\n`;
      } else {
        menuMessage += `👋 Welcome! You need a username to share subscriptions.\n\n`;
      }
      
      menuMessage += `**Choose what you'd like to do:**`;
      
      const keyboard = new InlineKeyboard()
        .text('💰 Share Subscription', 'sell_listing')
        .text('📊 My Shares', 'view_portfolio').row()
        .text('⚙️ Settings', 'view_settings')
        .text('❓ Help', 'help_menu');
      
      await ctx.editMessageText(menuMessage, {
        reply_markup: keyboard,
        parse_mode: 'Markdown'
      });
    } catch (error) {
      console.error('Error showing main menu:', error);
      await ctx.editMessageText('Sorry, there was an error showing the menu. Please try again.');
    }
  }

  private async handleSellListing(ctx: any, userId: number): Promise<void> {
    // Check if user has a username before starting the sell flow
    const user = await UserService.getUserByTelegramId(userId);
    if (!user?.username) {
      await ctx.editMessageText(
        `⚠️ **Username Required to Share Subscriptions!**\n\n` +
        `You need to set a Telegram username before you can share subscriptions.\n\n` +
        `**Why?** Buyers need to contact you directly!\n\n` +
        `**Steps to set username:**\n` +
        `1. Go to Telegram Settings\n` +
        `2. Tap on "Username"\n` +
        `3. Set your desired username (e.g., @yourname)\n` +
        `4. Use /start to refresh your profile\n\n` +
        `Once you've set your username, come back and try sharing again!`,
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
      .text('🎬 Streaming Services', 'category_streaming')
      .text('🎵 Music & Audio', 'category_music').row()
      .text('💑 Dating Apps', 'category_dating')
      .text('📱 Software & Apps', 'category_software').row()
      .text('🎫 Events & Tickets', 'category_events')
      .text('☁️ Cloud Storage', 'category_storage').row()
      .text('📚 Education', 'category_education')
      .text('🎮 Gaming', 'category_gaming').row()
      .text('❌ Cancel', 'cancel_sell');
    
    await ctx.editMessageText(
      `🚀 **Share Your Subscription or Sell Tickets**\n\n` +
      `Choose the category that best fits what you're sharing:`,
      { 
        parse_mode: 'Markdown',
        reply_markup: keyboard
      }
    );
  }

  private async handleViewPortfolio(ctx: any, userId: number): Promise<void> {
    try {
      const user = await UserService.getUserByTelegramId(userId);
      if (!user) {
        await ctx.editMessageText('Please use /start first to create your account.');
        return;
      }
      
      const listings = await this.listingService.getListingsBySeller(user.id);
      
      if (listings.length === 0) {
        await ctx.editMessageText('📊 Your Shared Subscriptions', {
          reply_markup: new InlineKeyboard()
            .text('💰 Share Subscription', 'sell_listing')
            .row()
            .text('🏠 Back to Menu', 'main_menu')
        });
      } else {
        const keyboard = new InlineKeyboard();
        for (const listing of listings) {
          const statusEmojiMap: { [key: string]: string } = {
            'pending_approval': '⏳',
            'active': '✅',
            'sold': '💰',
            'rejected': '❌',
            'removed': '🗑️'
          };
          const statusEmoji = statusEmojiMap[listing.status] || '❓';
          const price = (listing.price_cents / 100).toFixed(2);
          keyboard.text(`${statusEmoji} ${listing.title} - $${price}`, `manage_${listing.id}`).row();
        }
        
        keyboard.text('💰 Share New Subscription', 'sell_listing');
        
        await ctx.editMessageText('📊 Your Shared Subscriptions', {
          reply_markup: keyboard
        });
      }
    } catch (error) {
      console.error('Error handling view portfolio:', error);
      await ctx.editMessageText('Sorry, there was an error loading your portfolio. Please try again.');
    }
  }

  private async handleViewSettings(ctx: any): Promise<void> {
    await ctx.reply('⚙️ **Settings**\n\nSettings feature coming soon!', { 
      parse_mode: 'Markdown',
      reply_markup: new InlineKeyboard()
        .text('🏠 Back to Menu', 'main_menu')
    });
  }

  private async handleHelpMenu(ctx: any): Promise<void> {
    await ctx.reply(
      `❓ **Exchango Help**\n\n` +
      `**Available Commands:**\n` +
      `/start - Initialize your account\n` +
      `/sell - Create a new listing\n` +
      `/portfolio - View your listings\n` +
      `/settings - Manage preferences\n` +
      `/help - Show this help message\n\n` +
      `**How to Use:**\n` +
      `1. Set your Telegram username first\n` +
      `2. Create listings with /sell\n` +
      `3. Browse others' listings on our trading channel\n` +
      `4. Manage your listings with /portfolio\n\n` +
      `**Need Help?** Contact support if you have questions!`,
      { 
        parse_mode: 'Markdown',
        reply_markup: new InlineKeyboard()
          .text('🏠 Back to Menu', 'main_menu')
      }
    );
  }
}
