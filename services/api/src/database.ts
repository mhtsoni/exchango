import knex from 'knex';
import config from '../knexfile';

const environment = process.env.NODE_ENV || 'development';
const db = knex(config[environment]);

export async function initializeDatabase() {
  try {
    // Test connection
    await db.raw('SELECT 1');
    console.log('Database connected successfully');
    
    // Run migrations
    await db.migrate.latest();
    console.log('Database migrations completed');
  } catch (error) {
    console.error('Database initialization failed:', error);
    throw error;
  }
}

export default db;
