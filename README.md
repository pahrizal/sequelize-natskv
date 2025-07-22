# sequelize-natskv

A lightweight [Sequelize](https://sequelize.org/) dialect-like ORM using [NATS Key-Value (KV)](https://docs.nats.io/) as the storage engine. It provides simple CRUD and query operations on distributed, event-driven models backed by NATS.

---

## Features
- Transparent `create`, `findOne`, `findAll`, `update`, and `destroy` operations using NATS KV
- Supports querying by any field (not just primary key)
- Model change subscriptions (watch for row/column changes)
- TypeScript support
- Simple, dependency-light design

---

## Installation
```bash
npm install sequelize-natskv nats
```

---

## Quick Start
```ts
import { NatsKVSequelize } from 'sequelize-natskv';

async function main() {
  // Connect to NATS KV
  const sequelize = new NatsKVSequelize({
    servers: ['nats://localhost:4222'],
    bucket: 'my-bucket',
    // user, pass if needed
  });
  await sequelize.authenticate();

  // Define a model
  const User = sequelize.define('User', {
    id: { type: 'INTEGER', primaryKey: true },
    name: { type: 'STRING' },
    email: { type: 'STRING' },
    age: { type: 'INTEGER' },
  });

  // Create
  await User.create({ id: 1, name: 'Alice', email: 'alice@example.com', age: 30 });

  // Find by primary key
  const alice = await User.findOne({ where: { id: 1 } });

  // Find by non-primary key
  const byEmail = await User.findOne({ where: { email: 'alice@example.com' } });

  // Find all users with age 30
  const users = await User.findAll({ where: { age: 30 } });

  // Update
  await User.update({ age: 31 }, { where: { id: 1 } });

  // Delete
  await User.destroy({ where: { id: 1 } });

  // Watch for changes (remember to stop the watcher to prevent memory leaks)
  const watcher = await User.watch({ where: { id: 1 } }, (change) => {
    console.log('User changed:', change);
  });
  // ... later, when done watching:
  watcher.stop();

  await sequelize.close();
}
```

---

## Key Naming, Sharding, and Partitioning

- All records are sharded by primary key for efficient partitioning and scanning.
- Keys use `.` as a separator and are NATS KV compliant (alphanumeric, `_`, `-`, `/`, and `.` only).
- **Primary key format:**
  - `ModelName.shard_N.ID` (e.g., `User.shard_1.123`)
- **Secondary index key format:**
  - `ModelName.index.FIELD.VALUE` (e.g., `User.index.email.alice_example_com`)
- Sharding is automatic and uses 16 shards by default (configurable in the model).

---

## Automatic Secondary Indexes (Multi-Value/Non-Unique)

- You can specify which fields to index by setting `Model.indexes = ['field1', 'field2', ...]`.
- Indexes are automatically maintained on create, update, and delete.
- Indexes support non-unique (multi-value) lookups: each index key stores an array of IDs.
- **Example:**
  ```ts
  User.indexes = ['email', 'name'];
  await User.create({ id: 1, name: 'Alice', email: 'alice@example.com', age: 30 });
  await User.create({ id: 2, name: 'Bob', email: 'alice@example.com', age: 25 });
  // Both users will be indexed under User.index.email.alice_example_com
  const users = await User.findAll({ where: { email: 'alice@example.com' } }); // returns both Alice and Bob
  ```
- Index values are sanitized to be NATS KV compliant (e.g., `@` and `.` replaced with `_`).

---

## Querying and Partitioning Best Practices

- **Primary key and indexed field queries are fast.**
- **Non-indexed or multi-field queries** fall back to a full scan of all shards (can be slow for large datasets).
- For best performance, always index fields you plan to query frequently.
- Partitioning is handled automatically by sharding, but you can tune the shard count in the model if needed.

---

## Usage Example: Sharding and Indexes
```ts
// Define a model and specify indexed fields
const User = sequelize.define('User', {
  id: { type: 'INTEGER', primaryKey: true },
  name: { type: 'STRING' },
  email: { type: 'STRING' },
  age: { type: 'INTEGER' },
});
User.indexes = ['email', 'name'];

// Create users
await User.create({ id: 1, name: 'Alice', email: 'alice@example.com', age: 30 });
await User.create({ id: 2, name: 'Bob', email: 'alice@example.com', age: 25 });

// Query by indexed field (multi-value index)
const users = await User.findAll({ where: { email: 'alice@example.com' } }); // returns both Alice and Bob

// Query by primary key
const alice = await User.findOne({ where: { id: 1 } });

// Query by non-indexed field (full scan)
const age25 = await User.findAll({ where: { age: 25 } });
```

---

## NATS Requirements & Limitations
- Requires a running [NATS server](https://docs.nats.io/nats-server/installation) with JetStream and KV enabled.
- The specified KV bucket must exist or will be created automatically.
- Only basic CRUD and simple queries are supported (no joins, aggregates, or advanced Sequelize features).
- All data is stored as JSON in NATS KV.
- **Key format:** Only alphanumeric, `_`, `-`, `/`, and `.` are allowed. Index values are sanitized automatically.
- **Sharding and partitioning:** Handled automatically, but you can tune the shard count if needed.
- **Secondary indexes:** Support multi-value (non-unique) lookups and are maintained automatically.

---

## API Reference

### `NatsKVSequelize(options)`
- `options.servers` (string[]): Array of NATS server URLs
- `options.bucket` (string): KV bucket name
- `options.user`, `options.pass` (string, optional): NATS credentials

#### Methods
- `authenticate()`: Connects to NATS and ensures the KV bucket exists.
- `define(modelName, attributes, options?)`: Defines a model (returns a Model class).
- `getModel(modelName)`: Returns a previously defined model.
- `getKV()`: Returns the underlying NATS KV instance.
- `close()`: Closes the NATS connection.

### Model Methods
- `create(values)`: Insert a new record.
- `findOne({ where })`: Find a single record by any field(s).
- `findAll({ where })`: Find all records matching any field(s).
- `update(values, { where })`: Update a record by primary key or other fields.
- `destroy({ where })`: Delete a record by primary key or other fields.
- `watch({ where, columns }, callback)`: Subscribe to changes on a row or columns (experimental). **Returns a watcher object; call `watcher.stop()` to clean up and prevent memory leaks.**

---

## Development
```bash
# Install dependencies
npm install

# Run tests
npm test

# Build for publishing
npm run build
```

---

## Contributing
Contributions are welcome! Please open issues or pull requests on the [GitHub repository](https://github.com/pahrizal/sequelize-natskv). Ensure your changes include tests and update documentation as needed.

---

## License
MIT © Pahrizal Marup
