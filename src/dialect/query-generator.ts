export class NatsKvQueryGenerator {
  constructor(options: any) {
    // No super call needed
  }

  public createTableQuery(tableName: string, attributes: any, options: any): string {
    // NATS KV doesn't need table creation, but we'll track the schema
    return `CREATE_TABLE:${tableName}:${JSON.stringify({ attributes, options })}`;
  }

  public dropTableQuery(tableName: string): string {
    return `DROP_TABLE:${tableName}`;
  }

  public selectQuery(tableName: string, options: any): string {
    const prefix = this.getTablePrefix(tableName);
    const query = {
      type: 'SELECT',
      table: tableName,
      prefix,
      where: options.where,
      attributes: options.attributes,
      limit: options.limit,
      offset: options.offset,
      order: options.order,
    };
    return JSON.stringify(query);
  }

  public insertQuery(table: string, valueHash: any, modelAttributes: any, options: any): string {
    const prefix = this.getTablePrefix(table);
    const query = {
      type: 'INSERT',
      table,
      prefix,
      values: valueHash,
      attributes: modelAttributes,
      options,
    };
    return JSON.stringify(query);
  }

  public updateQuery(tableName: string, attrValueHash: any, where: any, options: any): string {
    const prefix = this.getTablePrefix(tableName);
    const query = {
      type: 'UPDATE',
      table: tableName,
      prefix,
      values: attrValueHash,
      where,
      options,
    };
    return JSON.stringify(query);
  }

  public deleteQuery(tableName: string, where: any, options: any): string {
    const prefix = this.getTablePrefix(tableName);
    const query = {
      type: 'DELETE',
      table: tableName,
      prefix,
      where,
      options,
    };
    return JSON.stringify(query);
  }

  public upsertQuery(tableName: string, insertValues: any, updateValues: any, where: any, model: any): string {
    const prefix = this.getTablePrefix(tableName);
    const query = {
      type: 'UPSERT',
      table: tableName,
      prefix,
      insertValues,
      updateValues,
      where,
    };
    return JSON.stringify(query);
  }

  public bulkInsertQuery(tableName: string, attrValueHashes: any[], options: any): string {
    const prefix = this.getTablePrefix(tableName);
    const query = {
      type: 'BULK_INSERT',
      table: tableName,
      prefix,
      values: attrValueHashes,
      options,
    };
    return JSON.stringify(query);
  }

  private getTablePrefix(tableName: string): string {
    return `table:${tableName}:`;
  }

  public addColumnQuery(table: string, key: string, dataType: any): string {
    return `ALTER_TABLE:${table}:ADD_COLUMN:${key}:${dataType}`;
  }

  public removeColumnQuery(tableName: string, attributeName: string): string {
    return `ALTER_TABLE:${tableName}:DROP_COLUMN:${attributeName}`;
  }

  public changeColumnQuery(tableName: string, attributes: any): string {
    return `ALTER_TABLE:${tableName}:CHANGE_COLUMN:${JSON.stringify(attributes)}`;
  }

  public renameColumnQuery(tableName: string, attrBefore: string, attributes: any): string {
    return `ALTER_TABLE:${tableName}:RENAME_COLUMN:${attrBefore}:${JSON.stringify(attributes)}`;
  }

  public showTablesQuery(): string {
    return 'SHOW_TABLES';
  }

  public describeTableQuery(tableName: string): string {
    return `DESCRIBE_TABLE:${tableName}`;
  }
}