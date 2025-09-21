import db from '../database';
import { Bot } from 'grammy';
import { InlineKeyboard } from 'grammy';
import { Listing } from './ListingService';
import { User } from './UserService';
import { ListingService } from './ListingService';

export class ApprovalService {
  private bot: Bot;

  constructor(bot: Bot) {
    this.bot = bot;
  }

  private getApproverUserIds(): number[] {
    const approverIds = process.env.APPROVER_USER_IDS;
    console.log(`Raw APPROVER_USER_IDS: ${approverIds}`);
    if (!approverIds) return [];
    const parsedIds = approverIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
    console.log(`Parsed approver IDs: ${parsedIds}`);
    return parsedIds;
  }

  async sendApprovalRequest(listing: Listing, user: User): Promise<void> {
    try {
      const approverIds = this.getApproverUserIds();
      console.log(`Sending approval request for listing ${listing.id} to approvers:`, approverIds);
      
      if (approverIds.length === 0) {
        console.log('No approver user IDs configured, skipping approval request');
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
        `🔍 **New Listing Awaiting Approval**\n\n` +
        `📝 **Title:** ${escapeMarkdown(listing.title)}\n\n` +
        `📋 **Description:**\n${escapeMarkdown(listing.description)}\n\n` +
        `🏷️ **Category:** ${escapeMarkdown(listing.category)}\n` +
        `💰 **Price:** $${price} USD\n` +
        `${deliveryEmoji} **Delivery:** ${escapeMarkdown(listing.delivery_type)}\n\n` +
        `👤 **Seller:** ${escapeMarkdown(user.display_name || user.username || 'Anonymous')}\n` +
        `💬 **Contact:** ${user.username ? `@${escapeMarkdown(user.username)}` : 'No username set'}\n` +
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
          const result = await this.bot.api.sendMessage(approverId, message, {
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

  async processApproval(listingId: string, isApproved: boolean, approverId: number): Promise<{ success: boolean; message: string }> {
    try {
      console.log(`Processing ${isApproved ? 'approval' : 'rejection'} for listing ${listingId}`);
      
      // Escape Markdown helper function
      const escapeMarkdown = (text: string) => text.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
      
      const approverIds = this.getApproverUserIds();
      if (!approverIds.includes(approverId)) {
        console.log(`User ${approverId} not authorized to approve listings`);
        return { success: false, message: '❌ You are not authorized to approve listings.' };
      }

      // Update listing status in database
      const status = isApproved ? 'active' : 'rejected';
      await db('listings').where('id', listingId).update({ status });
      
      const listing = await db('listings').where('id', listingId).first();
      const seller = await db('users').where('id', listing.seller_id).first();
      
      if (isApproved) {
        // Post to channel using the listing service
        console.log(`Approving listing ${listingId}, posting to channel...`);
        
        const listingService = new ListingService(this.bot);
        await listingService.postListingToChannel(listing, seller);
        
        // Notify seller of approval
        await this.bot.api.sendMessage(seller.telegram_id, 
          `🎉 **Your listing has been approved!**\n\n` +
          `📝 **${escapeMarkdown(listing.title)}**\n\n` +
          `Your subscription listing is now live on our trading channel!\n\n` +
          `Use /portfolio to view your listings.`,
          { parse_mode: 'Markdown' }
        );
        
        return { 
          success: true, 
          message: `✅ **Listing Approved and Posted!**\n\n📝 **${escapeMarkdown(listing.title)}**\n👤 **Seller:** ${escapeMarkdown(seller.display_name || seller.username || 'Anonymous')}\n\nThe listing has been posted to the trading channel.`
        };
      } else {
        // Notify seller of rejection
        await this.bot.api.sendMessage(seller.telegram_id, 
          `❌ **Your listing was not approved**\n\n` +
          `📝 **${escapeMarkdown(listing.title)}**\n\n` +
          `Unfortunately, your listing did not meet our quality standards or community guidelines.\n\n` +
          `Please review our guidelines and feel free to submit a new listing.\n\n` +
          `Use /sell to create a new listing.`,
          { parse_mode: 'Markdown' }
        );
        
        return { 
          success: true, 
          message: `❌ **Listing Rejected**\n\n📝 **${escapeMarkdown(listing.title)}**\n👤 **Seller:** ${escapeMarkdown(seller.display_name || seller.username || 'Anonymous')}\n\nThe seller has been notified of the rejection.`
        };
      }
    } catch (error) {
      console.error('Error processing approval:', error);
      return { success: false, message: '❌ Error processing approval. Please try again.' };
    }
  }
}
