import { Bot, InlineKeyboard } from 'grammy';
import { UserService } from '../services/UserService';
import { ListingService } from '../services/ListingService';
import { UserStateService } from '../services/UserStateService';
import { ApprovalService } from '../services/ApprovalService';

export class FormHandler {
  private bot: Bot;
  private listingService: ListingService;
  private approvalService: ApprovalService;

  constructor(bot: Bot) {
    this.bot = bot;
    this.listingService = new ListingService(bot);
    this.approvalService = new ApprovalService(bot);
  }

  async handleFormStep(ctx: any, userId: number, messageText: string, userState: any): Promise<void> {
    const { step, listingData } = userState;
    
    switch (step) {
      case 'custom_price':
        await this.handleCustomPrice(ctx, userId, messageText, listingData);
        break;
      case 'details':
        await this.handleDetails(ctx, userId, messageText, listingData);
        break;
      default:
        UserStateService.clearUserState(userId);
        await ctx.reply('Something went wrong. Please start over with /sell');
    }
  }

  private async handleCustomPrice(ctx: any, userId: number, messageText: string, listingData: any): Promise<void> {
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
    UserStateService.setUserState(userId, { step: 'delivery', listingData });
    
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
  }

  private async handleDetails(ctx: any, userId: number, messageText: string, listingData: any): Promise<void> {
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
    const user = await UserService.getUserByTelegramId(userId);
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
      UserStateService.clearUserState(userId);
      return;
    }
    
    // Create the listing
    await this.createListing(ctx, userId, listingData);
    UserStateService.clearUserState(userId);
  }

  private async createListing(ctx: any, userId: number, listingData: any): Promise<void> {
    try {
      const user = await UserService.getUserByTelegramId(userId);
      if (!user) {
        await ctx.reply('Please use /start first to create your account.');
        return;
      }
      
      const listing = await this.listingService.createListing(user.id, listingData);
      
      // Send approval request to admins
      await this.approvalService.sendApprovalRequest(listing, user);
      
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
}
