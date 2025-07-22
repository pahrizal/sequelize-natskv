import { KV } from 'nats';

/**
 * Base Model class for NATS KV ORM. Provides static CRUD and query methods for models.
 */
export class Model {
  static sequelize: any;
  static modelName: string;
  static attributes: any;
  static options: any;

  /**
   * Create a new record in the KV store.
   * @param values - The record values
   * @returns The created record
   */
  static async create(values: any) {
    const kv: KV = this.sequelize.getKV();
    const key = this._buildKey(values);
    await kv.put(key, new TextEncoder().encode(JSON.stringify(values)));
    return values;
  }

  /**
   * Find a single record by primary key or any field(s).
   * @param query - { where: { ...fields } }
   * @returns The found record or null
   */
  static async findOne(query: any) {
    const kv: KV = this.sequelize.getKV();
    // For simplicity, assume query is { where: { ... } }
    const where = query.where;
    if (where && Object.keys(where).length === 1 && where.id !== undefined) {
      // Fast path: lookup by primary key
      const key = this._buildKey(where);
      const entry = await kv.get(key);
      if (!entry || entry.operation === 'DEL' || entry.operation === 'PURGE') return null;
      return JSON.parse(new TextDecoder().decode(entry.value));
    } else {
      // Slow path: scan all records
      const prefix = this.modelName + '.';
      const iter = await kv.keys(prefix + '*');
      const allKeys = [];
      for await (const key of iter) {
        allKeys.push(key);
      }
      for (const key of allKeys) {
        const entry = await kv.get(key);
        if (!entry || entry.operation === 'DEL' || entry.operation === 'PURGE') continue;
        const value = JSON.parse(new TextDecoder().decode(entry.value));
        const match = Object.entries(where).every(([k, v]) => value[k] === v);
        if (match) {
          return value;
        }
      }
      return null;
    }
  }

  /**
   * Find all records matching the given field(s).
   * @param query - { where: { ...fields } }
   * @returns Array of matching records
   */
  static async findAll(query: any = {}) {
    const kv: KV = this.sequelize.getKV();
    const prefix = this.modelName + '.';
    const keys: string[] = [];
    const iter = await kv.keys(prefix + '*');
    for await (const key of iter) {
      keys.push(key);
    }
    const results = [];
    for (const key of keys) {
      const entry = await kv.get(key);
      if (entry) {
        const value = JSON.parse(new TextDecoder().decode(entry.value));
        // Optionally filter by query.where
        if (!query.where || Object.entries(query.where).every(([k, v]) => value[k] === v)) {
          results.push(value);
        }
      }
    }
    return results;
  }

  /**
   * Update a record by primary key or any field(s).
   * @param values - The values to update
   * @param query - { where: { ...fields } }
   * @returns The updated record or null
   */
  static async update(values: any, query: any) {
    const kv: KV = this.sequelize.getKV();
    const key = this._buildKey(query.where);
    const entry = await kv.get(key);
    if (!entry) return null;
    const current = JSON.parse(new TextDecoder().decode(entry.value));
    const updated = { ...current, ...values };
    await kv.put(key, new TextEncoder().encode(JSON.stringify(updated)));
    return updated;
  }

  /**
   * Delete a record by primary key or any field(s).
   * @param query - { where: { ...fields } }
   */
  static async destroy(query: any) {
    const kv: KV = this.sequelize.getKV();
    const key = this._buildKey(query.where);
    await kv.delete(key);
  }

  /**
   * Watch for changes on a row or columns (experimental).
   * @param options - { where?: any; columns?: string[] }
   * @param callback - Function called on change
   * @returns The watcher object (call watcher.stop() to clean up)
   */
  static async watch(options: { where?: any; columns?: string[] }, callback: (change: any) => void) {
    const kv: KV = this.sequelize.getKV();
    const key = this._buildKey(options.where);
    const watcher = await kv.watch({ key });
    let lastValue: any = null;
    (async () => {
      for await (const entry of watcher) {
        if (!entry) continue;
        const value = JSON.parse(new TextDecoder().decode(entry.value));
        if (options.columns && lastValue) {
          // Only call callback if specified columns changed
          const changed = options.columns.some(col => value[col] !== lastValue[col]);
          if (changed) {
            callback(value);
          }
        } else {
          callback(value);
        }
        lastValue = value;
      }
    })();
    return watcher; // Allow caller to call watcher.stop() to clean up
  }

  /**
   * Build a storage key for the record (by primary key).
   * @param values - The record values
   * @returns The storage key string
   */
  static _buildKey(values: any) {
    // Assume primary key is 'id' for now
    return this.modelName + '.' + values.id;
  }
}

/**
 * Create a new model class bound to a NatsKVSequelize instance.
 * @param sequelize - The NatsKVSequelize instance
 * @param modelName - The model name
 * @param attributes - The model attributes
 * @param options - Additional model options
 * @returns The model class
 */
export function createModel(sequelize: any, modelName: string, attributes: any, options: any) {
  class CustomModel extends Model {}
  CustomModel.sequelize = sequelize;
  CustomModel.modelName = modelName;
  CustomModel.attributes = attributes;
  CustomModel.options = options;
  return CustomModel;
} 