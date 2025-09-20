import express from 'express';
import db from '../database';
import Stripe from 'stripe';
import { decryptCode } from '../utils/kms';

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET!, {
  apiVersion: '2023-10-16'
});

// Create transaction
router.post('/', async (req, res) => {
  try {
    const { listing_id, buyer_telegram_id } = req.body;
    
    // Find or create buyer
    let buyer = await db('users').where('telegram_id', buyer_telegram_id).first();
    if (!buyer) {
      const [newBuyer] = await db('users').insert({
        telegram_id: buyer_telegram_id
      }).returning('*');
      buyer = newBuyer;
    }
    
    // Get listing and seller
    const listing = await db('listings')
      .select('listings.*', 'users.id as seller_id')
      .join('users', 'listings.seller_id', 'users.id')
      .where('listings.id', listing_id)
      .first();
    
    if (!listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }
    
    if (listing.status !== 'active') {
      return res.status(400).json({ error: 'Listing is not available' });
    }
    
    // Create transaction
    const [transaction] = await db('transactions').insert({
      listing_id,
      buyer_id: buyer.id,
      seller_id: listing.seller_id,
      amount_cents: listing.price_cents,
      currency: listing.currency,
      status: 'pending_payment'
    }).returning('*');
    
    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: listing.currency,
          product_data: {
            name: listing.title,
            description: listing.description || 'Digital subscription/ticket'
          },
          unit_amount: listing.price_cents
        },
        quantity: 1
      }],
      mode: 'payment',
      success_url: `${process.env.PLATFORM_BASE_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.PLATFORM_BASE_URL}/cancel`,
      metadata: {
        transaction_id: transaction.id,
        listing_id: listing.id,
        buyer_telegram_id: buyer_telegram_id.toString()
      }
    });
    
    // Update transaction with session ID
    await db('transactions')
      .where('id', transaction.id)
      .update({ stripe_session_id: session.id });
    
    res.json({
      transaction_id: transaction.id,
      checkout_url: session.url
    });
  } catch (error) {
    console.error('Error creating transaction:', error);
    res.status(500).json({ error: 'Failed to create transaction' });
  }
});

// Confirm delivery
router.post('/:id/confirm', async (req, res) => {
  try {
    const { id } = req.params;
    const { by_telegram_id } = req.body;
    
    // Verify buyer
    const buyer = await db('users').where('telegram_id', by_telegram_id).first();
    if (!buyer) {
      return res.status(404).json({ error: 'Buyer not found' });
    }
    
    const transaction = await db('transactions')
      .where('id', id)
      .where('buyer_id', buyer.id)
      .first();
    
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    
    if (transaction.status !== 'paid') {
      return res.status(400).json({ error: 'Transaction not paid' });
    }
    
    // Mark transaction as completed
    await db('transactions')
      .where('id', id)
      .update({ 
        status: 'completed',
        escrow_status: 'released'
      });
    
    // Transfer funds to seller (Stripe Connect)
    const listing = await db('listings').where('id', transaction.listing_id).first();
    const seller = await db('users').where('id', transaction.seller_id).first();
    
    if (seller.stripe_account_id) {
      const platformFee = Math.round(transaction.amount_cents * 0.05); // 5% platform fee
      const sellerAmount = transaction.amount_cents - platformFee;
      
      await stripe.transfers.create({
        amount: sellerAmount,
        currency: transaction.currency,
        destination: seller.stripe_account_id,
        transfer_group: transaction.id
      });
    }
    
    // Notify seller
    await notifySeller(seller.telegram_id, `Payment released for ${listing.title}`);
    
    res.json({ message: 'Transaction completed successfully' });
  } catch (error) {
    console.error('Error confirming delivery:', error);
    res.status(500).json({ error: 'Failed to confirm delivery' });
  }
});

// Open dispute
router.post('/:id/dispute', async (req, res) => {
  try {
    const { id } = req.params;
    const { opener_telegram_id, reason } = req.body;
    
    const user = await db('users').where('telegram_id', opener_telegram_id).first();
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const transaction = await db('transactions')
      .where('id', id)
      .where(function() {
        this.where('buyer_id', user.id).orWhere('seller_id', user.id);
      })
      .first();
    
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    
    // Create dispute
    await db('disputes').insert({
      transaction_id: id,
      opener_id: user.id,
      status: 'open',
      resolution: reason
    });
    
    // Update transaction status
    await db('transactions')
      .where('id', id)
      .update({ status: 'disputed' });
    
    // Notify admins
    await notifyAdmins(`Dispute opened for transaction ${id}: ${reason}`);
    
    res.json({ message: 'Dispute opened successfully' });
  } catch (error) {
    console.error('Error opening dispute:', error);
    res.status(500).json({ error: 'Failed to open dispute' });
  }
});

// Helper functions
async function notifySeller(telegramId: number, message: string) {
  try {
    await fetch(`https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: telegramId,
        text: message
      })
    });
  } catch (error) {
    console.error('Failed to notify seller:', error);
  }
}

async function notifyAdmins(message: string) {
  try {
    const adminId = process.env.ADMIN_TELEGRAM_ID;
    if (adminId) {
      await fetch(`https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: adminId,
          text: message
        })
      });
    }
  } catch (error) {
    console.error('Failed to notify admins:', error);
  }
}

export default router;
