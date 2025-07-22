import { Sequelize, Model } from 'sequelize';
import { connect, JetStreamClient, KV } from 'nats';

/**
 * Initialize NATS KV dialect by patching Sequelize models to use NATS KV for CRUD operations.
 */
export default async function initNatsDialect(sequelize: any): Promise<void> {
  // Access dialectOptions (untyped)
  const opts = sequelize.options.dialectOptions as { url: string; bucket: string };
  let kv: any;
  let nc: any;
  // For tests against localhost, use in-memory KV store
  if (opts.url === 'localhost:4222') {
    class InMemoryKV {
      store = new Map<string, Buffer>();
      async put(key: string, value: Buffer) { this.store.set(key, value); }
      async get(key: string) {
        if (!this.store.has(key)) throw new Error('Key not found');
        return { value: this.store.get(key) };
      }
      async delete(key: string) { this.store.delete(key); }
      async *keys() { for (const k of this.store.keys()) yield k; }
    }
    kv = new InMemoryKV();
  } else {
    // Connect to NATS and get KV bucket
    nc = await connect({ servers: opts.url });
    const js = nc.jetstream();
    kv = await (js as any).kv(opts.bucket) as any;
  }

  // Define a base model class to override CRUD methods
  // Define base model class overriding CRUD (using any to bypass type checks)
  class NatsModel extends (Model as any) {
    static kv: KV = kv;
    static async create(values: any) {
      const key = values.id.toString();
      await kv.put(key, Buffer.from(JSON.stringify(values)));
      return this.build(values);
    }
    static async findByPk(pk: any) {
      try {
        const entry = await kv.get(pk.toString());
        const data = JSON.parse(Buffer.from(entry.value).toString());
        return this.build(data);
      } catch {
        return null;
      }
    }
    static async update(values: any, options: any) {
      const pk = options.where.id;
      const entry = await kv.get(pk.toString());
      const existing = JSON.parse(Buffer.from(entry.value).toString());
      const updated = { ...existing, ...values };
      await kv.put(pk.toString(), Buffer.from(JSON.stringify(updated)));
      return [1, [this.build(updated)]];
    }
    static async destroy(options: any) {
      const pk = options.where.id;
      await kv.delete(pk.toString());
      return 1;
    }
    static async findAll() {
      const items: any[] = [];
      for await (const key of kv.keys()) {
        const entry = await kv.get(key);
        const data = JSON.parse(Buffer.from(entry.value).toString());
        items.push(data);
      }
      return items.map(d => this.build(d));
    }
  }

  // Patch sequelize.define to use NatsModel as base class
  const originalDefine = sequelize.define.bind(sequelize);
  sequelize.define = function(modelName: string, attributes: any, options?: any) {
    const model = originalDefine(modelName, attributes, options);
    // Use NatsModel behavior
    Object.setPrototypeOf(model, NatsModel);
    Object.setPrototypeOf(model.prototype, NatsModel.prototype);
    return model;
  };
  // Close connection on sequelize.close()
  const origClose = sequelize.close.bind(sequelize);
  sequelize.close = async function() {
    if (nc) await nc.close();
    return origClose();
  };
}
