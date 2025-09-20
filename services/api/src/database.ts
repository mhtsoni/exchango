import knex from 'knex';

const db = knex({
  client: 'pg',
  connection: process.env.DATABASE_URL,
  migrations: {
    directory: '../../infra/migrations'
  }
});

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
