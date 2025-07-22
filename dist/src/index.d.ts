import { Sequelize } from 'sequelize';
/**
 * Create a Sequelize instance patched to use NATS KV as the database engine.
 * @param url NATS server URL (e.g., localhost:4222)
 * @param bucket KV bucket name
 */
export declare function createSequelizeWithNats(options: {
    url: string;
    bucket: string;
}): Promise<Sequelize>;
