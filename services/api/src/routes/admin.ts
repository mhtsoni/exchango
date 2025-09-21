import express, { Router } from 'express';
import db from '../database';

const router: Router = express.Router();

// Get pending listings
router.get('/listings/pending', async (req, res) => {
  try {
    const listings = await db('listings')
      .select('listings.*', 'users.username', 'users.display_name')
      .join('users', 'listings.seller_id', 'users.id')
      .where('listings.status', 'pending_verification')
      .orderBy('listings.created_at', 'desc');
    
    res.json(listings);
  } catch (error) {
    console.error('Error fetching pending listings:', error);
    res.status(500).json({ error: 'Failed to fetch pending listings' });
  }
});

// Verify listing
router.post('/listings/:id/verify', async (req, res) => {
  try {
    const { id } = req.params;
    const { approved } = req.body;
    
    const status = approved ? 'active' : 'removed';
    
    await db('listings')
      .where('id', id)
      .update({ status });
    
    // Notify seller
    const listing = await db('listings')
      .select('listings.*', 'users.telegram_id')
      .join('users', 'listings.seller_id', 'users.id')
      .where('listings.id', id)
      .first();
    
    if (listing) {
      const message = approved 
        ? `✅ Your listing "${listing.title}" has been approved and is now live!`
        : `❌ Your listing "${listing.title}" was rejected. Please contact support for details.`;
      
      await notifyUser(listing.telegram_id, message);
    }
    
    res.json({ message: `Listing ${approved ? 'approved' : 'rejected'}` });
  } catch (error) {
    console.error('Error verifying listing:', error);
    res.status(500).json({ error: 'Failed to verify listing' });
  }
});

// Refund transaction
router.post('/transactions/:id/refund', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    const transaction = await db('transactions').where('id', id).first();
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    
    // Update transaction status
    await db('transactions')
      .where('id', id)
      .update({ 
        status: 'refunded',
        escrow_status: 'refunded'
      });
    
    // Process Stripe refund
    if (transaction.stripe_session_id) {
      const stripe = require('stripe')(process.env.STRIPE_SECRET);
      const session = await stripe.checkout.sessions.retrieve(transaction.stripe_session_id);
      
      if (session.payment_intent) {
        await stripe.refunds.create({
          payment_intent: session.payment_intent,
          reason: 'requested_by_customer'
        });
      }
    }
    
    // Notify buyer
    const buyer = await db('users').where('id', transaction.buyer_id).first();
    if (buyer) {
      await notifyUser(buyer.telegram_id, `Refund processed for transaction ${id}. Reason: ${reason}`);
    }
    
    res.json({ message: 'Refund processed successfully' });
  } catch (error) {
    console.error('Error processing refund:', error);
    res.status(500).json({ error: 'Failed to process refund' });
  }
});

// Get disputes
router.get('/disputes', async (req, res) => {
  try {
    const disputes = await db('disputes')
      .select('disputes.*', 'transactions.listing_id', 'listings.title')
      .join('transactions', 'disputes.transaction_id', 'transactions.id')
      .join('listings', 'transactions.listing_id', 'listings.id')
      .where('disputes.status', 'open')
      .orderBy('disputes.created_at', 'desc');
    
    res.json(disputes);
  } catch (error) {
    console.error('Error fetching disputes:', error);
    res.status(500).json({ error: 'Failed to fetch disputes' });
  }
});

// Resolve dispute
router.post('/disputes/:id/resolve', async (req, res) => {
  try {
    const { id } = req.params;
    const { resolution, refund_buyer } = req.body;
    
    const dispute = await db('disputes').where('id', id).first();
    if (!dispute) {
      return res.status(404).json({ error: 'Dispute not found' });
    }
    
    // Update dispute
    await db('disputes')
      .where('id', id)
      .update({ 
        status: 'resolved',
        resolution
      });
    
    // Handle refund if needed
    if (refund_buyer) {
      await db('transactions')
        .where('id', dispute.transaction_id)
        .update({ 
          status: 'refunded',
          escrow_status: 'refunded'
        });
    } else {
      await db('transactions')
        .where('id', dispute.transaction_id)
        .update({ 
          status: 'completed',
          escrow_status: 'released'
        });
    }
    
    res.json({ message: 'Dispute resolved successfully' });
  } catch (error) {
    console.error('Error resolving dispute:', error);
    res.status(500).json({ error: 'Failed to resolve dispute' });
  }
});

// Helper function
async function notifyUser(telegramId: number, message: string) {
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
    console.error('Failed to notify user:', error);
  }
}

export default router;
