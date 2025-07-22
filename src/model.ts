import { KV } from 'nats';

/**
 * Base Model class for NATS KV ORM. Provides static CRUD and query methods for models.
 */
export class Model {
  static sequelize: any;
  static modelName: string;
  static attributes: any;
  static options: any;
  static SHARD_COUNT = 16;
  static indexes: string[] = [];

  static _getShard(id: number) {
    return id % this.SHARD_COUNT;
  }

  /**
   * Build a storage key for the record (by primary key, sharded).
   * @param values - The record values
   * @returns The storage key string
   */
  static _buildKey(values: any) {
    const id = values.id;
    const shard = this._getShard(id);
    return `${this.modelName}.shard_${shard}.${id}`;
  }

  static _buildIndexKey(field: string, value: any) {
    // Sanitize value for NATS KV key compliance
    const safeValue = String(value).replace(/[^A-Za-z0-9/_-]/g, '_');
    return `${this.modelName}.index.${field}.${safeValue}`;
  }

  /**
   * Create a new record in the KV store.
   * @param values - The record values
   * @returns The created record
   */
  static async create(values: any) {
    const kv: KV = this.sequelize.getKV();
    const key = this._buildKey(values);
    await kv.put(key, new TextEncoder().encode(JSON.stringify(values)));
    // Maintain indexes (multi-value)
    for (const field of this.indexes) {
      if (values[field] !== undefined) {
        const indexKey = this._buildIndexKey(field, values[field]);
        let ids: number[] = [];
        const indexEntry = await kv.get(indexKey);
        if (indexEntry && indexEntry.value) {
          const raw = new TextDecoder().decode(indexEntry.value);
          if (raw.trim()) {
            ids = JSON.parse(raw);
          }
        }
        if (!ids.includes(values.id)) ids.push(values.id);
        await kv.put(indexKey, new TextEncoder().encode(JSON.stringify(ids)));
      }
    }
    return values;
  }

  /**
   * Find a single record by primary key or any field(s).
   * @param query - { where: { ...fields } }
   * @returns The found record or null
   */
  static async findOne(query: any) {
    const kv: KV = this.sequelize.getKV();
    const where = query.where;
    // If query is on a single indexed field, use the index
    if (where && Object.keys(where).length === 1) {
      const field = Object.keys(where)[0];
      if (this.indexes.includes(field)) {
        const indexKey = this._buildIndexKey(field, where[field]);
        const indexEntry = await kv.get(indexKey);
        if (!indexEntry || !indexEntry.value) return null;
        let ids: number[] = [];
        const raw = new TextDecoder().decode(indexEntry.value);
        if (raw.trim()) {
          ids = JSON.parse(raw);
        }
        for (const id of ids) {
          const key = this._buildKey({ id });
          const entry = await kv.get(key);
          if (entry && entry.value && entry.operation !== 'DEL' && entry.operation !== 'PURGE') {
            return JSON.parse(new TextDecoder().decode(entry.value));
          }
        }
        return null;
      }
    }
    // Fallback to primary key or full scan
    if (where && Object.keys(where).length === 1 && where.id !== undefined) {
      const key = this._buildKey(where);
      const entry = await kv.get(key);
      if (!entry || entry.operation === 'DEL' || entry.operation === 'PURGE') return null;
      return JSON.parse(new TextDecoder().decode(entry.value));
    } else {
      for (let shard = 0; shard < this.SHARD_COUNT; shard++) {
        const prefix = `${this.modelName}.shard_${shard}.`;
        const iter = await kv.keys(prefix + '>');
        for await (const key of iter) {
          const entry = await kv.get(key);
          if (!entry || entry.operation === 'DEL' || entry.operation === 'PURGE') continue;
          const value = JSON.parse(new TextDecoder().decode(entry.value));
          const match = Object.entries(where).every(([k, v]) => value[k] === v);
          if (match) {
            return value;
          }
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
    const where = query.where;
    // If query is on a single indexed field, use the index
    if (where && Object.keys(where).length === 1) {
      const field = Object.keys(where)[0];
      if (this.indexes.includes(field)) {
        const indexKey = this._buildIndexKey(field, where[field]);
        const indexEntry = await kv.get(indexKey);
        if (!indexEntry || !indexEntry.value) return [];
        let ids: number[] = [];
        const raw = new TextDecoder().decode(indexEntry.value);
        if (raw.trim()) {
          ids = JSON.parse(raw);
        }
        const results = [];
        for (const id of ids) {
          const key = this._buildKey({ id });
          const entry = await kv.get(key);
          if (entry && entry.value && entry.operation !== 'DEL' && entry.operation !== 'PURGE') {
            results.push(JSON.parse(new TextDecoder().decode(entry.value)));
          }
        }
        return results;
      }
    }
    // Fallback to primary key or full scan
    let keys: string[] = [];
    if (where && where.id !== undefined) {
      const shard = this._getShard(where.id);
      const prefix = `${this.modelName}.shard_${shard}.`;
      const iter = await kv.keys(prefix + '>');
      for await (const key of iter) keys.push(key);
    } else {
      for (let shard = 0; shard < this.SHARD_COUNT; shard++) {
        const prefix = `${this.modelName}.shard_${shard}.`;
        const iter = await kv.keys(prefix + '>');
        for await (const key of iter) {
          keys.push(key);
        }
      }
    }
    const results = [];
    for (const key of keys) {
      const entry = await kv.get(key);
      if (entry) {
        const value = JSON.parse(new TextDecoder().decode(entry.value));
        if (!where || Object.entries(where).every(([k, v]) => value[k] === v)) {
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
    // Update indexes if indexed fields changed (multi-value)
    for (const field of this.indexes) {
      if (values[field] !== undefined && values[field] !== current[field]) {
        // Remove from old index
        const oldIndexKey = this._buildIndexKey(field, current[field]);
        let oldIds: number[] = [];
        const oldIndexEntry = await kv.get(oldIndexKey);
        if (oldIndexEntry && oldIndexEntry.value) {
          const raw = new TextDecoder().decode(oldIndexEntry.value);
          if (raw.trim()) {
            oldIds = JSON.parse(raw);
          }
        }
        oldIds = oldIds.filter((id: number) => id !== updated.id);
        if (oldIds.length > 0) {
          await kv.put(oldIndexKey, new TextEncoder().encode(JSON.stringify(oldIds)));
        } else {
          await kv.delete(oldIndexKey);
        }
        // Add to new index
        const newIndexKey = this._buildIndexKey(field, values[field]);
        let newIds: number[] = [];
        const newIndexEntry = await kv.get(newIndexKey);
        if (newIndexEntry && newIndexEntry.value) {
          const raw = new TextDecoder().decode(newIndexEntry.value);
          if (raw.trim()) {
            newIds = JSON.parse(raw);
          }
        }
        if (!newIds.includes(updated.id)) newIds.push(updated.id);
        await kv.put(newIndexKey, new TextEncoder().encode(JSON.stringify(newIds)));
      }
    }
    return updated;
  }

  /**
   * Delete a record by primary key or any field(s).
   * @param query - { where: { ...fields } }
   */
  static async destroy(query: any) {
    const kv: KV = this.sequelize.getKV();
    const key = this._buildKey(query.where);
    const entry = await kv.get(key);
    if (entry) {
      const value = JSON.parse(new TextDecoder().decode(entry.value));
      // Remove from all indexes (multi-value)
      for (const field of this.indexes) {
        if (value[field] !== undefined) {
          const indexKey = this._buildIndexKey(field, value[field]);
          let ids: number[] = [];
          const indexEntry = await kv.get(indexKey);
          if (indexEntry && indexEntry.value) {
            const raw = new TextDecoder().decode(indexEntry.value);
            if (raw.trim()) {
              ids = JSON.parse(raw);
            }
          }
          ids = ids.filter((id: number) => id !== value.id);
          if (ids.length > 0) {
            await kv.put(indexKey, new TextEncoder().encode(JSON.stringify(ids)));
          } else {
            await kv.delete(indexKey);
          }
        }
      }
    }
    await kv.delete(key);
  }

  /**
   * Truncate all records and indexes for this model.
   */
  static async truncate() {
    const kv: KV = this.sequelize.getKV();
    // 1. Collect all record values for all shards
    let allRecords = [];
    for (let shard = 0; shard < this.SHARD_COUNT; shard++) {
      const prefix = `${this.modelName}.shard_${shard}.`;
      const iter = await kv.keys(prefix + '>');
      for await (const key of iter) {
        const entry = await kv.get(key);
        if (entry && entry.value) {
          try {
            allRecords.push(JSON.parse(new TextDecoder().decode(entry.value)));
          } catch {}
        }
      }
    }
    // 2. Delete/purge all record keys
    for (let shard = 0; shard < this.SHARD_COUNT; shard++) {
      const prefix = `${this.modelName}.shard_${shard}.`;
      const iter = await kv.keys(prefix + '>');
      for await (const key of iter) {
        if (kv.purge) {
          await kv.purge(key);
        } else {
          await kv.delete(key);
        }
      }
    }
    // 3. Delete/purge all index keys for all values seen
    for (const field of this.indexes) {
      const seen = new Set();
      for (const rec of allRecords) {
        if (rec[field] !== undefined) {
          seen.add(rec[field]);
        }
      }
      for (const value of seen) {
        const indexKey = this._buildIndexKey(field, value);
        if (kv.purge) {
          await kv.purge(indexKey);
        } else {
          await kv.delete(indexKey);
        }
      }
      // 4. Fallback: delete any remaining index keys by prefix
      const indexPrefix = `${this.modelName}.index.${field}.`;
      const iter = await kv.keys(indexPrefix + '>');
      for await (const key of iter) {
        if (kv.purge) {
          await kv.purge(key);
        } else {
          await kv.delete(key);
        }
      }
    }
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