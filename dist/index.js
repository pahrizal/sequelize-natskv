"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NatsKvQueryInterface = exports.NatsKvQueryGenerator = exports.NatsKvConnection = exports.NatsKvConnectionManager = exports.NatsKvDialect = void 0;
exports.createNatsKvSequelize = createNatsKvSequelize;
const sequelize_1 = require("sequelize");
const nats_kv_dialect_1 = require("./dialect/nats-kv-dialect");
Object.defineProperty(exports, "NatsKvDialect", { enumerable: true, get: function () { return nats_kv_dialect_1.NatsKvDialect; } });
const connection_manager_1 = require("./dialect/connection-manager");
Object.defineProperty(exports, "NatsKvConnectionManager", { enumerable: true, get: function () { return connection_manager_1.NatsKvConnectionManager; } });
// Register the dialect
const dialectName = 'nats-kv';
// Extend Sequelize to support our dialect
class NatsKvSequelize extends sequelize_1.Sequelize {
    constructor(options) {
        super({
            ...options,
            dialect: dialectName,
        });
    }
}
// Factory function to create Sequelize instance with NATS KV dialect
function createNatsKvSequelize(config) {
    // Patch Sequelize to recognize the custom dialect
    // @ts-ignore
    if (typeof sequelize_1.Sequelize.addDialect === 'function') {
        sequelize_1.Sequelize.addDialect('nats-kv', nats_kv_dialect_1.NatsKvDialect);
    }
    else {
        // Fallback for older Sequelize versions
        sequelize_1.Sequelize.Dialect = sequelize_1.Sequelize.Dialect || {};
        sequelize_1.Sequelize.Dialect['nats-kv'] = nats_kv_dialect_1.NatsKvDialect;
    }
    const sequelize = new sequelize_1.Sequelize({
        dialect: dialectName,
        dialectModule: nats_kv_dialect_1.NatsKvDialect,
        dialectOptions: config,
    });
    return sequelize;
}
var connection_1 = require("./dialect/connection");
Object.defineProperty(exports, "NatsKvConnection", { enumerable: true, get: function () { return connection_1.NatsKvConnection; } });
var query_generator_1 = require("./dialect/query-generator");
Object.defineProperty(exports, "NatsKvQueryGenerator", { enumerable: true, get: function () { return query_generator_1.NatsKvQueryGenerator; } });
var query_interface_1 = require("./dialect/query-interface");
Object.defineProperty(exports, "NatsKvQueryInterface", { enumerable: true, get: function () { return query_interface_1.NatsKvQueryInterface; } });
// Default export
exports.default = {
    createNatsKvSequelize,
    NatsKvDialect: nats_kv_dialect_1.NatsKvDialect,
    NatsKvConnectionManager: connection_manager_1.NatsKvConnectionManager,
};
//# sourceMappingURL=index.js.map