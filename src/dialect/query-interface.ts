import { NatsKvConnection } from './connection';

export class NatsKvQueryInterface {
  public sequelize: any;
  public queryGenerator: any;

  constructor(sequelize: any, queryGenerator: any) {
    this.sequelize = sequelize;
    this.queryGenerator = queryGenerator;
  }

  public async rawSelect(
    tableName: string,
    options: any,
    attributeSelector?: any,
    Model?: any
  ): Promise<any[]> {
    const connection = await this.sequelize.connectionManager.getConnection();
    try {
      return await this.executeSelect(connection, tableName, options);
    } finally {
      this.sequelize.connectionManager.releaseConnection(connection);
    }
  }

  private async executeSelect(connection: NatsKvConnection, tableName: string, options: any): Promise<any[]> {
    const prefix = `table:${tableName}:`;
    const keys = await connection.list(prefix);
    const results: any[] = [];

    for (const key of keys) {
      const entry = await connection.get(key);
      if (entry && entry.value) {
        const record = JSON.parse(new TextDecoder().decode(entry.value));
        
        // Apply where conditions
        if (this.matchesWhere(record, options.where)) {
          // Apply attribute selection
          if (options.attributes && Array.isArray(options.attributes)) {
            const filteredRecord: any = {};
            for (const attr of options.attributes) {
              if (typeof attr === 'string' && record[attr] !== undefined) {
                filteredRecord[attr] = record[attr];
              }
            }
            results.push(filteredRecord);
          } else {
            results.push(record);
          }
        }
      }
    }

    // Apply ordering
    if (options.order && Array.isArray(options.order)) {
      results.sort((a, b) => {
        for (const [field, direction] of options.order) {
          const aVal = a[field];
          const bVal = b[field];
          let comparison = 0;
          
          if (aVal < bVal) comparison = -1;
          else if (aVal > bVal) comparison = 1;
          
          if (comparison !== 0) {
            return direction?.toUpperCase() === 'DESC' ? -comparison : comparison;
          }
        }
        return 0;
      });
    }

    // Apply limit and offset
    let start = options.offset || 0;
    let end = options.limit ? start + options.limit : results.length;
    
    return results.slice(start, end);
  }

  private matchesWhere(record: any, where: any): boolean {
    if (!where) return true;
    
    for (const [field, condition] of Object.entries(where)) {
      const recordValue = record[field];
      
      if (typeof condition === 'object' && condition !== null) {
        // Handle operators like $eq, $ne, $gt, etc.
        for (const [op, value] of Object.entries(condition as any)) {
          switch (op) {
            case '$eq':
              if (recordValue !== value) return false;
              break;
            case '$ne':
              if (recordValue === value) return false;
              break;
            case '$gt':
              if (recordValue <= (value as any)) return false;
              break;
            case '$gte':
              if (recordValue < (value as any)) return false;
              break;
            case '$lt':
              if (recordValue >= (value as any)) return false;
              break;
            case '$lte':
              if (recordValue > (value as any)) return false;
              break;
            case '$in':
              if (!Array.isArray(value) || !(value as any[]).includes(recordValue)) return false;
              break;
            case '$notIn':
              if (Array.isArray(value) && (value as any[]).includes(recordValue)) return false;
              break;
            case '$like':
              if (typeof recordValue !== 'string' || !this.matchesLike(recordValue, value as string)) return false;
              break;
            default:
              if (recordValue !== condition) return false;
          }
        }
      } else {
        // Direct equality check
        if (recordValue !== condition) return false;
      }
    }
    
    return true;
  }

  private matchesLike(value: string, pattern: string): boolean {
    // Convert SQL LIKE pattern to regex
    const regexPattern = pattern
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // Escape special regex chars
      .replace(/%/g, '.>') // % matches any characters
      .replace(/_/g, '.'); // _ matches single character
    
    const regex = new RegExp(`^${regexPattern}$`, 'i');
    return regex.test(value);
  }

  public async bulkInsert(
    tableName: string,
    records: any[],
    options: any = {},
    attributes?: any
  ): Promise<any> {
    const connection = await this.sequelize.connectionManager.getConnection();
    try {
      const results = [];
      for (const record of records) {
        const key = this.generateKey(tableName, record, attributes);
        const value = new TextEncoder().encode(JSON.stringify(record));
        await connection.put(key, value);
        results.push(record);
      }
      return results;
    } finally {
      this.sequelize.connectionManager.releaseConnection(connection);
    }
  }

  public async bulkUpdate(
    tableName: string,
    values: any,
    identifier: any,
    options: any = {},
    attributes?: any
  ): Promise<any> {
    const connection = await this.sequelize.connectionManager.getConnection();
    try {
      const prefix = `table:${tableName}:`;
      const keys = await connection.list(prefix);
      let affectedRows = 0;

      for (const key of keys) {
        const entry = await connection.get(key);
        if (entry && entry.value) {
          const record = JSON.parse(new TextDecoder().decode(entry.value));
          
          if (this.matchesWhere(record, identifier)) {
            // Update the record
            const updatedRecord = { ...record, ...values };
            const updatedValue = new TextEncoder().encode(JSON.stringify(updatedRecord));
            await connection.put(key, updatedValue);
            affectedRows++;
          }
        }
      }

      return [affectedRows];
    } finally {
      this.sequelize.connectionManager.releaseConnection(connection);
    }
  }

  public async bulkDelete(
    tableName: string,
    identifier: any,
    options: any = {}
  ): Promise<number> {
    const connection = await this.sequelize.connectionManager.getConnection();
    try {
      const prefix = `table:${tableName}:`;
      const keys = await connection.list(prefix);
      let deletedRows = 0;

      for (const key of keys) {
        const entry = await connection.get(key);
        if (entry && entry.value) {
          const record = JSON.parse(new TextDecoder().decode(entry.value));
          
          if (this.matchesWhere(record, identifier)) {
            await connection.delete(key);
            deletedRows++;
          }
        }
      }

      return deletedRows;
    } finally {
      this.sequelize.connectionManager.releaseConnection(connection);
    }
  }

  public async insert(
    instance: any,
    tableName: string,
    values: any,
    options: any = {}
  ): Promise<any> {
    const connection = await this.sequelize.connectionManager.getConnection();
    try {
      const key = this.generateKey(tableName, values, options.model?.getTableName());
      const value = new TextEncoder().encode(JSON.stringify(values));
      await connection.put(key, value);
      return [values, 1];
    } finally {
      this.sequelize.connectionManager.releaseConnection(connection);
    }
  }

  public async upsert(
    tableName: string,
    values: any,
    updateOnDuplicate: any,
    options: any = {}
  ): Promise<any> {
    const connection = await this.sequelize.connectionManager.getConnection();
    try {
      const key = this.generateKey(tableName, values, options.model?.getTableName());
      const existingEntry = await connection.get(key);
      
      let isCreated = true;
      let record = values;

      if (existingEntry && existingEntry.value) {
        // Update existing record
        const existingRecord = JSON.parse(new TextDecoder().decode(existingEntry.value));
        record = { ...existingRecord, ...values };
        isCreated = false;
      }

      const value = new TextEncoder().encode(JSON.stringify(record));
      await connection.put(key, value);
      
      return [record, isCreated];
    } finally {
      this.sequelize.connectionManager.releaseConnection(connection);
    }
  }

  private generateKey(tableName: string, record: any, modelName?: string): string {
    const prefix = `table:${tableName}:`;
    
    // Try to use primary key if available
    if (record.id !== undefined) {
      return `${prefix}id:${record.id}`;
    }
    
    // Generate a unique key based on record content
    const contentHash = this.hashObject(record);
    return `${prefix}hash:${contentHash}`;
  }

  private hashObject(obj: any): string {
    const str = JSON.stringify(obj, Object.keys(obj).sort());
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }
}