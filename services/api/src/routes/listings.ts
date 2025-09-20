import express from 'express';
import db from '../database';
import axios from 'axios';

const router = express.Router();

// Create listing
router.post('/', async (req, res) => {
  try {
    const { seller_telegram_id, title, description, price_cents, currency, delivery_type, valid_until, proof_s3_key } = req.body;
    
    // Find or create user
    let user = await db('users').where('telegram_id', seller_telegram_id).first();
    if (!user) {
      const [newUser] = await db('users').insert({
        telegram_id: seller_telegram_id,
        username: req.body.username || null,
        display_name: req.body.display_name || null
      }).returning('*');
      user = newUser;
    }
    
    // Create listing
    const [listing] = await db('listings').insert({
      seller_id: user.id,
      title,
      description,
      price_cents,
      currency: currency || 'usd',
      delivery_type,
      valid_until: valid_until ? new Date(valid_until) : null,
      proof_s3_key,
      status: 'pending_verification'
    }).returning('*');
    
    // Notify admins (in production, send to admin Telegram channel)
    await notifyAdmins(`New listing pending: ${title} - $${(price_cents/100).toFixed(2)}`);
    
    res.status(201).json(listing);
  } catch (error) {
    console.error('Error creating listing:', error);
    res.status(500).json({ error: 'Failed to create listing' });
  }
});

// Get listings
router.get('/', async (req, res) => {
  try {
    const { status, category, min_price, max_price, q, page = 1, limit = 20 } = req.query;
    
    let query = db('listings')
      .select('listings.*', 'users.username', 'users.display_name')
      .join('users', 'listings.seller_id', 'users.id')
      .where('listings.status', status || 'active');
    
    if (category) {
      query = query.where('listings.category', category);
    }
    
    if (min_price) {
      query = query.where('listings.price_cents', '>=', parseInt(min_price as string) * 100);
    }
    
    if (max_price) {
      query = query.where('listings.price_cents', '<=', parseInt(max_price as string) * 100);
    }
    
    if (q) {
      query = query.where(function() {
        this.where('listings.title', 'ilike', `%${q}%`)
            .orWhere('listings.description', 'ilike', `%${q}%`);
      });
    }
    
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
    const listings = await query
      .orderBy('listings.created_at', 'desc')
      .limit(parseInt(limit as string))
      .offset(offset);
    
    res.json(listings);
  } catch (error) {
    console.error('Error fetching listings:', error);
    res.status(500).json({ error: 'Failed to fetch listings' });
  }
});

// Get single listing
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const listing = await db('listings')
      .select('listings.*', 'users.username', 'users.display_name')
      .join('users', 'listings.seller_id', 'users.id')
      .where('listings.id', id)
      .first();
    
    if (!listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }
    
    // Don't expose encrypted code unless user is authorized buyer or admin
    const response = { ...listing };
    delete response.code_encrypted;
    
    res.json(response);
  } catch (error) {
    console.error('Error fetching listing:', error);
    res.status(500).json({ error: 'Failed to fetch listing' });
  }
});

// Helper function to notify admins
async function notifyAdmins(message: string) {
  try {
    const adminId = process.env.ADMIN_TELEGRAM_ID;
    if (adminId) {
      await axios.post(`https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`, {
        chat_id: adminId,
        text: message
      });
    }
  } catch (error) {
    console.error('Failed to notify admins:', error);
  }
}

export default router;
