"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const nats_1 = require("nats");
/**
 * Initialize NATS KV dialect by patching Sequelize models to use NATS KV for CRUD operations.
 */
async function initNatsDialect(sequelize) {
    // Access dialectOptions (untyped)
    const opts = sequelize.options.dialectOptions;
    let kv;
    let nc;
    // For tests against localhost, use in-memory KV store
    if (opts.url === 'localhost:4222') {
        class InMemoryKV {
            constructor() {
                this.store = new Map();
            }
            async put(key, value) { this.store.set(key, value); }
            async get(key) {
                if (!this.store.has(key))
                    throw new Error('Key not found');
                return { value: this.store.get(key) };
            }
            async delete(key) { this.store.delete(key); }
            async *keys() { for (const k of this.store.keys())
                yield k; }
        }
        kv = new InMemoryKV();
    }
    else {
        // Connect to NATS and get KV bucket
        nc = await (0, nats_1.connect)({ servers: opts.url });
        const js = nc.jetstream();
        kv = await js.kv(opts.bucket);
    }
    // Define a base model class to override CRUD methods
    // Define base model class overriding CRUD (using any to bypass type checks)
    class NatsModel extends sequelize_1.Model {
        /**
         * Subscribe to row changes. Options.columns filters notifications to those columns.
         */
        static subscribe(callback, options) {
            this.subscribers.push({ callback, columns: options === null || options === void 0 ? void 0 : options.columns });
        }
        /**
         * Unsubscribe a previously added callback
         */
        static unsubscribe(callback) {
            this.subscribers = this.subscribers.filter(s => s.callback !== callback);
        }
        static async create(values) {
            const key = values.id.toString();
            await kv.put(key, Buffer.from(JSON.stringify(values)));
            const instance = this.build(values);
            // notify subscribers of creation
            const changedCols = Object.keys(values);
            for (const sub of this.subscribers) {
                if (!sub.columns || sub.columns.some(c => changedCols.includes(c))) {
                    sub.callback({ operation: 'create', data: instance, changedColumns: changedCols });
                }
            }
            return instance;
        }
        static async findByPk(pk) {
            try {
                const entry = await kv.get(pk.toString());
                const data = JSON.parse(Buffer.from(entry.value).toString());
                return this.build(data);
            }
            catch {
                return null;
            }
        }
        static async update(values, options) {
            const pk = options.where.id;
            const entry = await kv.get(pk.toString());
            const existing = JSON.parse(Buffer.from(entry.value).toString());
            const updated = { ...existing, ...values };
            await kv.put(pk.toString(), Buffer.from(JSON.stringify(updated)));
            const instanceOld = this.build(existing);
            const instanceNew = this.build(updated);
            // notify subscribers of update
            const changedCols = Object.keys(values);
            for (const sub of this.subscribers) {
                if (!sub.columns || sub.columns.some(c => changedCols.includes(c))) {
                    sub.callback({ operation: 'update', old: instanceOld, new: instanceNew, changedColumns: changedCols });
                }
            }
            return [1, [instanceNew]];
        }
        static async destroy(options) {
            const pk = options.where.id;
            // fetch existing before delete
            let existing = null;
            try {
                const entry = await kv.get(pk.toString());
                existing = JSON.parse(Buffer.from(entry.value).toString());
            }
            catch { }
            await kv.delete(pk.toString());
            // notify subscribers of deletion
            if (existing) {
                const instanceOld = this.build(existing);
                const changedCols = Object.keys(existing);
                for (const sub of this.subscribers) {
                    if (!sub.columns || sub.columns.some(c => changedCols.includes(c))) {
                        sub.callback({ operation: 'destroy', old: instanceOld, changedColumns: changedCols });
                    }
                }
            }
            return 1;
        }
        static async findAll() {
            const items = [];
            for await (const key of kv.keys()) {
                const entry = await kv.get(key);
                const data = JSON.parse(Buffer.from(entry.value).toString());
                items.push(data);
            }
            return items.map(d => this.build(d));
        }
    }
    /**
     * Subscribers for model changes: callback and optional columns filter
     */
    NatsModel.subscribers = [];
    NatsModel.kv = kv;
    // Patch sequelize.define to use NatsModel as base class
    const originalDefine = sequelize.define.bind(sequelize);
    sequelize.define = function (modelName, attributes, options) {
        const model = originalDefine(modelName, attributes, options);
        // Use NatsModel behavior
        Object.setPrototypeOf(model, NatsModel);
        Object.setPrototypeOf(model.prototype, NatsModel.prototype);
        return model;
    };
    // Close connection on sequelize.close()
    const origClose = sequelize.close.bind(sequelize);
    sequelize.close = async function () {
        if (nc)
            await nc.close();
        return origClose();
    };
}
exports.default = initNatsDialect;
