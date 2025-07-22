import { NatsKvConnectionManager } from "./connection-manager";
import { NatsKvQueryGenerator } from "./query-generator";
import { NatsKvQueryInterface } from "./query-interface";

export class NatsKvDialect {
  public readonly connectionManager: NatsKvConnectionManager;
  public readonly queryGenerator: NatsKvQueryGenerator;
  public readonly queryInterface: NatsKvQueryInterface;

  public static readonly supports = {
    DEFAULT: false,
    "DEFAULT VALUES": false,
    "VALUES ()": false,
    "LIMIT ON UPDATE": false,
    "ON DUPLICATE KEY": false,
    "ORDER NULLS": false,
    UNION: false,
    "UNION ALL": false,
    "RIGHT JOIN": false,
    "FULL OUTER JOIN": false,
    "CROSS JOIN": false,
    "NATURAL JOIN": false,
    autoIncrement: {
      identityInsert: false,
      defaultValue: false,
      update: false,
    },
    bulkDefault: false,
    constraints: {
      restrict: false,
      default: false,
      check: false,
      foreignKey: false,
      primaryKey: false,
      unique: false,
    },
    returnValues: false,
    lock: false,
    lockKey: false,
    lockOuterJoinFailure: false,
    forShare: false,
    index: {
      collate: false,
      length: false,
      parser: false,
      concurrently: false,
      type: false,
      using: false,
      functionBased: false,
    },
    NUMERIC: false,
    ARRAY: false,
    RANGE: false,
    GEOMETRY: false,
    REGEXP: false,
    JSON: true,
    JSONB: false,
    virtual: false,
    deferrableConstraints: false,
    searchPath: false,
    escapeStringConstants: false,
    dataTypes: {
      COLLATE_BINARY: false,
    },
    EXCEPTION: false,
    tmpTableTrigger: false,
    groupedLimit: false,
    offsetFetch: false,
    upserts: true,
  };

  constructor(sequelize: any) {
    this.connectionManager = new NatsKvConnectionManager(this, sequelize);
    this.queryGenerator = new NatsKvQueryGenerator({
      dialect: this,
      sequelize,
    });
    this.queryInterface = new NatsKvQueryInterface(
      sequelize,
      this.queryGenerator
    );
  }

  public canBackupTable(): boolean {
    return false;
  }

  public getDefaultSchema(): string {
    return "default";
  }

  public static getDefaultPort(): number {
    return 4222;
  }
}
