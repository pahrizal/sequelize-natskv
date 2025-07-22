"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var src_exports = {};
__export(src_exports, {
  createSequelizeWithNats: () => createSequelizeWithNats
});
module.exports = __toCommonJS(src_exports);
var import_sequelize2 = require("sequelize");

// src/dialect.ts
var import_sequelize = require("sequelize");
var import_nats = require("nats");
async function initNatsDialect(sequelize) {
  const opts = sequelize.options.dialectOptions;
  let kv;
  let nc;
  if (opts.url === "localhost:4222") {
    class InMemoryKV {
      constructor() {
        this.store = /* @__PURE__ */ new Map();
      }
      async put(key, value) {
        this.store.set(key, value);
      }
      async get(key) {
        if (!this.store.has(key))
          throw new Error("Key not found");
        return { value: this.store.get(key) };
      }
      async delete(key) {
        this.store.delete(key);
      }
      async *keys() {
        for (const k of this.store.keys())
          yield k;
      }
    }
    kv = new InMemoryKV();
  } else {
    nc = await (0, import_nats.connect)({ servers: opts.url });
    const js = nc.jetstream();
    kv = await js.kv(opts.bucket);
  }
  class NatsModel extends import_sequelize.Model {
    /**
     * Subscribe to row changes. Options.columns filters notifications to those columns.
     */
    static subscribe(callback, options) {
      this.subscribers.push({ callback, columns: options == null ? void 0 : options.columns });
    }
    /**
     * Unsubscribe a previously added callback
     */
    static unsubscribe(callback) {
      this.subscribers = this.subscribers.filter((s) => s.callback !== callback);
    }
    static async create(values) {
      const key = values.id.toString();
      await kv.put(key, Buffer.from(JSON.stringify(values)));
      const instance = this.build(values);
      const changedCols = Object.keys(values);
      for (const sub of this.subscribers) {
        if (!sub.columns || sub.columns.some((c) => changedCols.includes(c))) {
          sub.callback({ operation: "create", data: instance, changedColumns: changedCols });
        }
      }
      return instance;
    }
    static async findByPk(pk) {
      try {
        const entry = await kv.get(pk.toString());
        const data = JSON.parse(Buffer.from(entry.value).toString());
        return this.build(data);
      } catch {
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
      const changedCols = Object.keys(values);
      for (const sub of this.subscribers) {
        if (!sub.columns || sub.columns.some((c) => changedCols.includes(c))) {
          sub.callback({ operation: "update", old: instanceOld, new: instanceNew, changedColumns: changedCols });
        }
      }
      return [1, [instanceNew]];
    }
    static async destroy(options) {
      const pk = options.where.id;
      let existing = null;
      try {
        const entry = await kv.get(pk.toString());
        existing = JSON.parse(Buffer.from(entry.value).toString());
      } catch {
      }
      await kv.delete(pk.toString());
      if (existing) {
        const instanceOld = this.build(existing);
        const changedCols = Object.keys(existing);
        for (const sub of this.subscribers) {
          if (!sub.columns || sub.columns.some((c) => changedCols.includes(c))) {
            sub.callback({ operation: "destroy", old: instanceOld, changedColumns: changedCols });
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
      return items.map((d) => this.build(d));
    }
  }
  /**
   * Subscribers for model changes: callback and optional columns filter
   */
  NatsModel.subscribers = [];
  NatsModel.kv = kv;
  const originalDefine = sequelize.define.bind(sequelize);
  sequelize.define = function(modelName, attributes, options) {
    const model = originalDefine(modelName, attributes, options);
    Object.setPrototypeOf(model, NatsModel);
    Object.setPrototypeOf(model.prototype, NatsModel.prototype);
    return model;
  };
  const origClose = sequelize.close.bind(sequelize);
  sequelize.close = async function() {
    if (nc)
      await nc.close();
    return origClose();
  };
}

// src/index.ts
async function createSequelizeWithNats(options) {
  const sequelize = new import_sequelize2.Sequelize("", "", "", {
    dialect: "sqlite",
    storage: ":memory:",
    dialectOptions: { url: options.url, bucket: options.bucket },
    logging: false
  });
  await initNatsDialect(sequelize);
  return sequelize;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  createSequelizeWithNats
});
