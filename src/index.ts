import { Sequelize } from 'sequelize';
import initNatsDialect from './dialect';

/**
 * Create a Sequelize instance patched to use NATS KV as the database engine.
 * @param url NATS server URL (e.g., localhost:4222)
 * @param bucket KV bucket name
 */
export async function createSequelizeWithNats(options: { url: string; bucket: string, useMemory?: boolean }): Promise<Sequelize> {
  // Use SQLite dialect to satisfy Sequelize, but bypass storage since we use NATS KV
  const sequelize = new Sequelize('', '', '', {
    dialect: 'sqlite',
    storage: ':memory:',
    dialectOptions: { url: options.url, bucket: options.bucket, useMemory: options.useMemory },
    logging: false,
  });
  await initNatsDialect(sequelize);
  return sequelize;
}
