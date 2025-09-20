import 'dotenv/config';
import { Bot, InlineKeyboard } from 'grammy';
import axios from 'axios';
import { saveTelegramFileToS3 } from './s3';
import fetch from 'node-fetch';

const bot = new Bot(process.env.BOT_TOKEN!);

// Simple session storage (in production, use Redis or database)
const sessions = new Map<number, any>();

// start command
bot.command('start', ctx => ctx.reply('Welcome to Exchango! 🚀\n\nUse /sell to list items or /browse to find listings.'));

// SELL flow
bot.command('sell', async ctx => {
  sessions.set(ctx.from!.id, { step: 'title' });
  await ctx.reply('What are you selling? Please provide a clear title:');
});

// Handle messages during sell flow
bot.on('message', async ctx => {
  const id = ctx.from!.id;
  const session = sessions.get(id);
  if (!session) return;

  try {
    if (session.step === 'title' && ctx.message!.text) {
      session.title = ctx.message.text;
      session.step = 'price';
      sessions.set(id, session);
      return ctx.reply('What\'s the price in USD? (e.g., 9.99)');
    }

    if (session.step === 'price' && ctx.message!.text) {
      const price = Math.round(parseFloat(ctx.message.text) * 100);
      if (isNaN(price) || price <= 0) {
        return ctx.reply('Please enter a valid price (e.g., 9.99)');
      }
      session.price_cents = price;
      session.step = 'delivery';
      sessions.set(id, session);
      return ctx.reply('How will you deliver this item?\n\nType: code | file | manual');
    }

    if (session.step === 'delivery' && ctx.message!.text) {
      const deliveryType = ctx.message.text.toLowerCase();
      if (!['code', 'file', 'manual'].includes(deliveryType)) {
        return ctx.reply('Please choose one of: code | file | manual');
      }
      session.delivery_type = deliveryType;
      session.step = 'proof';
      sessions.set(id, session);
      return ctx.reply('Please upload proof of your item (photo or document):');
    }

    // Handle file upload for proof
    if (session.step === 'proof') {
      const doc = ctx.message!.document || ctx.message!.photo?.slice(-1)[0];
      if (!doc) {
        return ctx.reply('Please upload a photo or document as proof.');
      }
      
      const fileId = doc.file_id;
      const s3Key = await saveTelegramFileToS3(ctx, fileId);
      session.proof_s3_key = s3Key;
      
      // Send to backend API
      const response = await axios.post(`${process.env.PLATFORM_BASE_URL}/api/listings`, {
        seller_telegram_id: ctx.from!.id,
        title: session.title,
        price_cents: session.price_cents,
        delivery_type: session.delivery_type,
        proof_s3_key: s3Key
      }, {
        headers: {
          'X-Telegram-Id': ctx.from!.id.toString()
        }
      });
      
      sessions.delete(id);
      return ctx.reply('✅ Listing created and queued for verification!\n\nYou will be notified when it\'s approved and goes live.');
    }
  } catch (error) {
    console.error('Error in sell flow:', error);
    sessions.delete(id);
    return ctx.reply('❌ Something went wrong. Please try again with /sell');
  }
});

// Browse listings
bot.command('browse', async ctx => {
  try {
    const res = await fetch(`${process.env.PLATFORM_BASE_URL}/api/listings?status=active`);
    const listings = await res.json();
    
    if (!listings.length) {
      return ctx.reply('No active listings right now. Check back later!');
    }
    
    for (const listing of listings.slice(0, 10)) { // Limit to 10 listings
      const text = `🛍️ ${listing.title}\n💰 $${(listing.price_cents/100).toFixed(2)}\n📝 ${listing.description || 'No description'}\n📦 Delivery: ${listing.delivery_type}`;
      const keyboard = new InlineKeyboard()
        .text('🛒 Buy', `buy:${listing.id}`)
        .text('🔍 View Proof', `proof:${listing.id}`);
      
      await ctx.reply(text, { reply_markup: keyboard });
    }
  } catch (error) {
    console.error('Error browsing listings:', error);
    return ctx.reply('❌ Failed to load listings. Please try again.');
  }
});

// Callback query handlers
bot.callbackQuery(/buy:(.+)/, async ctx => {
  try {
    const listingId = ctx.callbackQuery.data!.split(':')[1];
    
    // Create transaction
    const resp = await axios.post(`${process.env.PLATFORM_BASE_URL}/api/transactions`, {
      listing_id: listingId,
      buyer_telegram_id: ctx.from!.id
    }, {
      headers: {
        'X-Telegram-Id': ctx.from!.id.toString()
      }
    });
    
    await ctx.reply(`💳 Complete your purchase:\n${resp.data.checkout_url}`);
    return ctx.api.answerCallbackQuery(ctx.callbackQuery.id, { text: 'Checkout link sent!' });
  } catch (error) {
    console.error('Error creating transaction:', error);
    await ctx.reply('❌ Failed to create transaction. Please try again.');
    return ctx.api.answerCallbackQuery(ctx.callbackQuery.id, { text: 'Error occurred' });
  }
});

bot.callbackQuery(/proof:(.+)/, async ctx => {
  try {
    const listingId = ctx.callbackQuery.data!.split(':')[1];
    
    // Get listing details
    const resp = await axios.get(`${process.env.PLATFORM_BASE_URL}/api/listings/${listingId}`);
    const listing = resp.data;
    
    if (listing.proof_s3_key) {
      // In a real implementation, you'd generate a signed URL for the S3 object
      await ctx.reply('📎 Proof document is available. Contact support if you need access.');
    } else {
      await ctx.reply('No proof document available for this listing.');
    }
    
    return ctx.api.answerCallbackQuery(ctx.callbackQuery.id, { text: 'Proof info sent' });
  } catch (error) {
    console.error('Error viewing proof:', error);
    return ctx.api.answerCallbackQuery(ctx.callbackQuery.id, { text: 'Error occurred' });
  }
});

// Admin commands
bot.command('pending', async ctx => {
  // Check if user is admin (in production, check against admin list)
  if (ctx.from!.id !== parseInt(process.env.ADMIN_TELEGRAM_ID || '0')) {
    return ctx.reply('❌ Admin access required');
  }
  
  try {
    const resp = await axios.get(`${process.env.PLATFORM_BASE_URL}/api/admin/listings/pending`);
    const listings = resp.data;
    
    if (!listings.length) {
      return ctx.reply('No pending listings');
    }
    
    for (const listing of listings) {
      const text = `⏳ Pending: ${listing.title}\n💰 $${(listing.price_cents/100).toFixed(2)}\n👤 Seller: ${listing.seller_id}\n\nUse /verify ${listing.id} approve|reject`;
      await ctx.reply(text);
    }
  } catch (error) {
    console.error('Error fetching pending listings:', error);
    return ctx.reply('❌ Failed to fetch pending listings');
  }
});

bot.command(/verify (.+) (.+)/, async ctx => {
  if (ctx.from!.id !== parseInt(process.env.ADMIN_TELEGRAM_ID || '0')) {
    return ctx.reply('❌ Admin access required');
  }
  
  try {
    const match = ctx.message!.text!.match(/verify (.+) (.+)/);
    if (!match) return ctx.reply('Usage: /verify <listingId> <approve|reject>');
    
    const [, listingId, action] = match;
    const isApproved = action.toLowerCase() === 'approve';
    
    await axios.post(`${process.env.PLATFORM_BASE_URL}/api/admin/listings/${listingId}/verify`, {
      approved: isApproved
    });
    
    const status = isApproved ? '✅ approved' : '❌ rejected';
    return ctx.reply(`Listing ${listingId} ${status}`);
  } catch (error) {
    console.error('Error verifying listing:', error);
    return ctx.reply('❌ Failed to verify listing');
  }
});

// Error handling
bot.catch((err) => {
  console.error('Bot error:', err);
});

// Start bot
bot.start();
console.log('Bot started successfully!');
