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

  // TODO: Add watch/subscribe feature for row/column changes
} 