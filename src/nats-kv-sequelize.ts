import { connect, NatsConnection, KV } from 'nats';

export interface NatsKVSequelizeOptions {
  servers: string[];
  bucket: string;
  user?: string;
  pass?: string;
}

/**
 * NatsKVSequelize provides a simple ORM-like interface backed by NATS Key-Value storage.
 * It allows you to define models and perform CRUD operations using NATS KV as the backend.
 */
export class NatsKVSequelize {
  private nc: NatsConnection | null = null;
  private kv: KV | null = null;
  private models: Record<string, any> = {};
  private servers: string[];
  private bucket: string;
  private user?: string;
  private pass?: string;

  /**
   * Create a new NatsKVSequelize instance.
   * @param options - NATS connection and bucket options
   */
  constructor(options: NatsKVSequelizeOptions) {
    this.servers = options.servers;
    this.bucket = options.bucket;
    this.user = options.user;
    this.pass = options.pass;
  }

  /**
   * Connects to the NATS server and ensures the KV bucket exists.
   * @returns Promise<void>
   */
  async authenticate() {
    this.nc = await connect({
      servers: this.servers,
      user: this.user,
      pass: this.pass,
    });
    const js = this.nc.jetstream();
    try {
      this.kv = await js.views.kv(this.bucket);
    } catch (error) {
      // Create the KV bucket if it doesn't exist
      this.kv = await js.views.kv(this.bucket, { history: 1 });
    }
  }

  /**
   * Define a new model for this connection.
   * @param modelName - The name of the model
   * @param attributes - The model's attributes/fields
   * @param options - Additional model options (optional)
   * @returns The model class
   */
  define(modelName: string, attributes: any, options: any = {}) {
    // Register a model
    const model = require('./model').createModel(this, modelName, attributes, options);
    this.models[modelName] = model;
    return model;
  }

  /**
   * Get a previously defined model by name.
   * @param modelName - The name of the model
   * @returns The model class or undefined
   */
  getModel(modelName: string) {
    return this.models[modelName];
  }

  /**
   * Get the underlying NATS KV instance.
   * @returns The NATS KV instance
   * @throws Error if not connected
   */
  getKV() {
    if (!this.kv) throw new Error('Not connected to NATS KV');
    return this.kv;
  }

  /**
   * Close the NATS connection.
   * @returns Promise<void>
   */
  async close() {
    if (this.nc) await this.nc.close();
  }

  /**
   * Backup all key-value pairs in the bucket to a JSON file.
   * @param filePath - The file path to write the backup to
   */
  async backup(filePath: string) {
    if (!this.kv) throw new Error('Not connected');
    const keys = [];
    const iter = await this.kv.keys();
    for await (const key of iter) {
      keys.push(key);
    }
    const data: Record<string, any> = {};
    for (const key of keys) {
      const entry = await this.kv.get(key);
      if (entry && entry.value) {
        data[key] = {
          value: Buffer.from(entry.value).toString('base64'),
          revision: entry.revision,
        };
      }
    }
    const fs = await import('fs/promises');
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  /**
   * Restore all key-value pairs from a JSON file into the bucket.
   * @param filePath - The file path to read the backup from
   * @param options - { clear: boolean } If true, clear the bucket before restoring
   */
  async restore(filePath: string, options: { clear?: boolean } = {}) {
    if (!this.kv) throw new Error('Not connected');
    const fs = await import('fs/promises');
    const content = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(content);
    if (options.clear) {
      const keys = [];
      const iter = await this.kv.keys();
      for await (const key of iter) {
        keys.push(key);
      }
      for (const key of keys) {
        await this.kv.delete(key);
      }
    }
    for (const [key, entry] of Object.entries(data) as [string, any][]) {
      const value = Buffer.from(entry.value, 'base64');
      await this.kv.put(key, value);
    }
  }

  // TODO: Add watch/subscribe feature for row/column changes
} 