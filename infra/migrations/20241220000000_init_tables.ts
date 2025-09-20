import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // users
  await knex.schema.createTable('users', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.bigInteger('telegram_id').unique();
    table.text('username');
    table.text('display_name');
    table.text('email');
    table.text('kyc_status').defaultTo('none');
    table.integer('rating').defaultTo(0);
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  // listings
  await knex.schema.createTable('listings', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('seller_id').references('id').inTable('users').onDelete('CASCADE');
    table.text('title').notNullable();
    table.text('description');
    table.text('category');
    table.integer('price_cents').notNullable();
    table.text('currency').defaultTo('usd');
    table.text('delivery_type').notNullable(); // code | file | manual
    table.text('proof_telegram_file_path'); // Changed from S3 to Telegram file path
    table.binary('code_encrypted'); // encrypted code blob (nullable)
    table.timestamp('valid_from', { useTz: true });
    table.timestamp('valid_until', { useTz: true });
    table.text('status').defaultTo('pending_verification'); // pending_verification | active | sold | removed
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  // transactions (simplified for discovery app)
  await knex.schema.createTable('transactions', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('listing_id').references('id').inTable('listings').onDelete('SET NULL');
    table.uuid('buyer_id').references('id').inTable('users').onDelete('SET NULL');
    table.uuid('seller_id').references('id').inTable('users').onDelete('SET NULL');
    table.integer('amount_cents').notNullable();
    table.text('currency').defaultTo('usd');
    table.text('status').defaultTo('sold'); // sold | completed
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  // deliveries (simplified)
  await knex.schema.createTable('deliveries', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('transaction_id').references('id').inTable('transactions').onDelete('CASCADE');
    table.timestamp('delivered_at', { useTz: true });
    table.text('delivery_telegram_file_path'); // Changed from S3 to Telegram file path
    table.binary('delivery_data_encrypted'); // encrypted code if needed
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  // disputes (simplified)
  await knex.schema.createTable('disputes', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('transaction_id').references('id').inTable('transactions').onDelete('CASCADE');
    table.uuid('opener_id').references('id').inTable('users');
    table.text('status').defaultTo('open'); // open | resolved | rejected
    table.text('resolution');
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('disputes');
  await knex.schema.dropTable('deliveries');
  await knex.schema.dropTable('transactions');
  await knex.schema.dropTable('listings');
  await knex.schema.dropTable('users');
}
