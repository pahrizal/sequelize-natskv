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

## NATS Requirements & Limitations
- Requires a running [NATS server](https://docs.nats.io/nats-server/installation) with JetStream and KV enabled.
- The specified KV bucket must exist or will be created automatically.
- Only basic CRUD and simple queries are supported (no joins, aggregates, or advanced Sequelize features).
- All data is stored as JSON in NATS KV.

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
