import db from '../database';

export interface User {
  id: string;
  telegram_id: number;
  username?: string;
  display_name?: string;
  email?: string;
  kyc_status: string;
  rating: number;
  created_at: Date;
  updated_at: Date;
}

export class UserService {
  static async findOrCreateUser(telegramId: number, userData: any): Promise<User> {
    let user = await db('users').where('telegram_id', telegramId).first();
    
    if (!user) {
      // Create new user
      const newUser = await db('users').insert({
        telegram_id: telegramId,
        username: userData.username || null,
        display_name: userData.displayName || null,
        kyc_status: 'none',
        rating: 0,
        created_at: new Date(),
        updated_at: new Date()
      }).returning('*');
      
      return newUser[0];
    } else {
      // Update existing user if data has changed
      const updates: any = {};
      if (user.username !== userData.username) updates.username = userData.username || null;
      if (user.display_name !== userData.displayName) updates.display_name = userData.displayName || null;
      
      if (Object.keys(updates).length > 0) {
        updates.updated_at = new Date();
        await db('users').where('telegram_id', telegramId).update(updates);
        user = await db('users').where('telegram_id', telegramId).first();
      }
      
      return user;
    }
  }

  static async getUserByTelegramId(telegramId: number): Promise<User | null> {
    return await db('users').where('telegram_id', telegramId).first();
  }

  static async updateUserProfile(telegramId: number, updates: Partial<User>): Promise<void> {
    updates.updated_at = new Date();
    await db('users').where('telegram_id', telegramId).update(updates);
  }
}
