import db from '../database';

export interface User {
  id: number;
  telegram_id: number;
  username?: string;
  display_name?: string;
  first_name?: string;
  last_name?: string;
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
        first_name: userData.firstName || null,
        last_name: userData.lastName || null,
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
      if (user.first_name !== userData.firstName) updates.first_name = userData.firstName || null;
      if (user.last_name !== userData.lastName) updates.last_name = userData.lastName || null;
      
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
