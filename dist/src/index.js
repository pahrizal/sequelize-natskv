"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSequelizeWithNats = void 0;
const sequelize_1 = require("sequelize");
const dialect_1 = __importDefault(require("./dialect"));
/**
 * Create a Sequelize instance patched to use NATS KV as the database engine.
 * @param url NATS server URL (e.g., localhost:4222)
 * @param bucket KV bucket name
 */
async function createSequelizeWithNats(options) {
    // Use SQLite dialect to satisfy Sequelize, but bypass storage since we use NATS KV
    const sequelize = new sequelize_1.Sequelize('', '', '', {
        dialect: 'sqlite',
        storage: ':memory:',
        dialectOptions: { url: options.url, bucket: options.bucket },
        logging: false,
    });
    await (0, dialect_1.default)(sequelize);
    return sequelize;
}
exports.createSequelizeWithNats = createSequelizeWithNats;
