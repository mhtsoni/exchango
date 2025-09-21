import express, { Router } from 'express';
import db from '../database';

const router: Router = express.Router();

// Mark listing as sold (simplified - no payment processing)
router.post('/:id/sold', async (req, res) => {
  try {
    const { id } = req.params;
    const { seller_telegram_id } = req.body;
    
    // Verify seller owns this listing
    const listing = await db('listings')
      .select('listings.*', 'users.telegram_id')
      .join('users', 'listings.seller_id', 'users.id')
      .where('listings.id', id)
      .where('users.telegram_id', seller_telegram_id)
      .first();
    
    if (!listing) {
      return res.status(404).json({ error: 'Listing not found or you are not the seller' });
    }
    
    if (listing.status !== 'active') {
      return res.status(400).json({ error: 'Listing is not active' });
    }
    
    // Mark listing as sold
    await db('listings')
      .where('id', id)
      .update({ status: 'sold' });
    
    res.json({ message: 'Listing marked as sold successfully' });
  } catch (error) {
    console.error('Error marking listing as sold:', error);
    res.status(500).json({ error: 'Failed to mark listing as sold' });
  }
});

// Get seller contact info for interested buyers
router.get('/:id/contact', async (req, res) => {
  try {
    const { id } = req.params;
    
    const listing = await db('listings')
      .select('listings.*', 'users.username', 'users.display_name', 'users.telegram_id')
      .join('users', 'listings.seller_id', 'users.id')
      .where('listings.id', id)
      .where('listings.status', 'active')
      .first();
    
    if (!listing) {
      return res.status(404).json({ error: 'Listing not found or not available' });
    }
    
    // Return contact info for communication
    res.json({
      seller_username: listing.username,
      seller_display_name: listing.display_name,
      listing_title: listing.title,
      listing_price: listing.price_cents,
      contact_message: `Interested in "${listing.title}" - $${(listing.price_cents/100).toFixed(2)}`
    });
  } catch (error) {
    console.error('Error getting contact info:', error);
    res.status(500).json({ error: 'Failed to get contact info' });
  }
});

export default router;
