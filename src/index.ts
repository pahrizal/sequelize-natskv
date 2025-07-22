import { Sequelize } from 'sequelize';
import { NatsKvDialect } from './dialect/nats-kv-dialect';
import { NatsKvConnectionManager, NatsKvConfig } from './dialect/connection-manager';

// Register the dialect
const dialectName = 'nats-kv';

// Extend Sequelize to support our dialect
class NatsKvSequelize extends Sequelize {
  constructor(options: any) {
    super({
      ...options,
      dialect: dialectName,
    });
  }
}

// Factory function to create Sequelize instance with NATS KV dialect
export function createNatsKvSequelize(config: NatsKvConfig): Sequelize {
  // Patch Sequelize to recognize the custom dialect
  // @ts-ignore
  if (typeof (Sequelize as any).addDialect === 'function') {
    (Sequelize as any).addDialect('nats-kv', NatsKvDialect);
  } else {
    // Fallback for older Sequelize versions
    (Sequelize as any).Dialect = (Sequelize as any).Dialect || {};
    (Sequelize as any).Dialect['nats-kv'] = NatsKvDialect;
  }

  const sequelize = new Sequelize({
    dialect: dialectName as any,
    dialectModule: NatsKvDialect,
    dialectOptions: config,
  });

  return sequelize;
}

// Export types and classes
export { NatsKvDialect, NatsKvConnectionManager, NatsKvConfig };
export { NatsKvConnection } from './dialect/connection';
export { NatsKvQueryGenerator } from './dialect/query-generator';
export { NatsKvQueryInterface } from './dialect/query-interface';

// Default export
export default {
  createNatsKvSequelize,
  NatsKvDialect,
  NatsKvConnectionManager,
};