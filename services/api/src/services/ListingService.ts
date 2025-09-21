import db from '../database';
import { Bot } from 'grammy';

export interface Listing {
  id: string;
  seller_id: string;
  title: string;
  description: string;
  category: string;
  price_cents: number;
  currency: string;
  delivery_type: string;
  status: string;
  proof_telegram_file_path?: string;
  created_at: Date;
  updated_at: Date;
}

export class ListingService {
  private bot: Bot;

  constructor(bot: Bot) {
    this.bot = bot;
  }

  async createListing(sellerId: string, listingData: any): Promise<Listing> {
    const listing = await db('listings').insert({
      seller_id: sellerId,
      title: listingData.title,
      description: listingData.description,
      category: listingData.category,
      price_cents: listingData.price_cents,
      currency: 'usd',
      delivery_type: listingData.delivery_type,
      status: 'pending_approval'
    }).returning('*');
    
    return listing[0];
  }

  async getListingsBySeller(sellerId: string): Promise<Listing[]> {
    return await db('listings')
      .where('seller_id', sellerId)
      .orderBy('created_at', 'desc');
  }

  async getActiveListings(limit: number = 10): Promise<Listing[]> {
    return await db('listings')
      .where('status', 'active')
      .limit(limit)
      .orderBy('created_at', 'desc');
  }

  async updateListingStatus(listingId: string, status: string): Promise<void> {
    await db('listings').where('id', listingId).update({ 
      status,
      updated_at: new Date()
    });
  }

  async updateListing(listingId: string, updates: Partial<Listing>): Promise<void> {
    updates.updated_at = new Date();
    await db('listings').where('id', listingId).update(updates);
  }

  async getListingById(listingId: string): Promise<Listing | null> {
    return await db('listings').where('id', listingId).first();
  }

  async verifyListingOwnership(listingId: string, sellerId: string): Promise<Listing | null> {
    return await db('listings')
      .where('id', listingId)
      .where('seller_id', sellerId)
      .first();
  }

  async postListingToChannel(listing: Listing, user: any): Promise<void> {
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
        'instant': '📱',
        'email': '📧',
        'link': '🔗',
        'manual': '👤'
      };
      const deliveryEmoji = deliveryEmojiMap[listing.delivery_type] || '📦';
      
      // Escape Markdown special characters in user-provided content
      const escapeMarkdown = (text: string) => text.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
      
      const message = 
        `${user.username ? `@${escapeMarkdown(user.username)}` : 'Someone'} is selling ${escapeMarkdown(listing.title)}\n\n` +
        `💰 $${price} USD\n` +
        `📋 ${escapeMarkdown(listing.description)}\n\n` +
        `Category: ${escapeMarkdown(listing.category)}\n` +
        `${deliveryEmoji} Delivery: ${escapeMarkdown(listing.delivery_type)}\n\n` +
        `List your sharable subscriptions and digital products with @${(process.env.BOT_USERNAME || 'your_bot').replace('@', '')}`;
      
      const result = await this.bot.api.sendMessage(channelId, message, { 
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
}
