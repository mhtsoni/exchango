import express from 'express';
import Stripe from 'stripe';
import db from '../database';

const stripe = new Stripe(process.env.STRIPE_SECRET!, {
  apiVersion: '2023-10-16'
});

const webhook = async (req: express.Request, res: express.Response) => {
  const sig = req.headers['stripe-signature'] as string;
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return res.status(400).send(`Webhook Error: ${err}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      
      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;
      
      case 'payment_intent.payment_failed':
        await handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
        break;
      
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
};

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  console.log('Processing checkout.session.completed:', session.id);
  
  const transactionId = session.metadata?.transaction_id;
  if (!transactionId) {
    console.error('No transaction_id in session metadata');
    return;
  }

  // Update transaction status
  await db('transactions')
    .where('id', transactionId)
    .update({
      status: 'paid',
      escrow_status: 'held'
    });

  // Get transaction details
  const transaction = await db('transactions')
    .select('transactions.*', 'listings.title', 'users.telegram_id as seller_telegram_id')
    .join('listings', 'transactions.listing_id', 'listings.id')
    .join('users', 'transactions.seller_id', 'users.id')
    .where('transactions.id', transactionId)
    .first();

  if (transaction) {
    // Notify seller
    await notifySeller(transaction.seller_telegram_id, 
      `💰 Payment received for "${transaction.title}"!\n\nPlease deliver the item to the buyer.`);
    
    // Notify buyer
    const buyer = await db('users').where('id', transaction.buyer_id).first();
    if (buyer) {
      await notifyBuyer(buyer.telegram_id, 
        `✅ Payment confirmed for "${transaction.title}"!\n\nThe seller has been notified to deliver your item.`);
    }
  }
}

async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  console.log('Payment succeeded:', paymentIntent.id);
  // Additional logic if needed
}

async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
  console.log('Payment failed:', paymentIntent.id);
  
  // Find transaction by payment intent
  const session = await stripe.checkout.sessions.list({
    payment_intent: paymentIntent.id,
    limit: 1
  });

  if (session.data.length > 0) {
    const transactionId = session.data[0].metadata?.transaction_id;
    if (transactionId) {
      await db('transactions')
        .where('id', transactionId)
        .update({ status: 'payment_failed' });
      
      // Notify buyer
      const transaction = await db('transactions')
        .select('transactions.*', 'users.telegram_id')
        .join('users', 'transactions.buyer_id', 'users.id')
        .where('transactions.id', transactionId)
        .first();
      
      if (transaction) {
        await notifyBuyer(transaction.telegram_id, 
          '❌ Payment failed. Please try again or contact support.');
      }
    }
  }
}

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

async function notifyBuyer(telegramId: number, message: string) {
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
    console.error('Failed to notify buyer:', error);
  }
}

export default webhook;
