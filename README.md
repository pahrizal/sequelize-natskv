# sequelize-natskv

A lightweight [Sequelize](https://sequelize.org/) dialect implementation using [NATS Key-Value (KV)](https://docs.nats.io/) as the storage engine. It intercepts standard Sequelize CRUD operations and redirects them to a NATS KV bucket, enabling distributed, event-driven models backed by NATS.

## Features
- Transparent Sequelize `create`, `findByPk`, `update`, `destroy`, and `findAll` operations using NATS KV
- In-memory KV fallback for local testing
- Built-in model change subscriptions (`Model.subscribe`) with optional column filters
- Zero-dependency runtime bundle via [esbuild](https://esbuild.github.io/)

## Installation
```bash
npm install sequelize-natskv sequelize nats sqlite3
```
> If you plan to use PostgreSQL or other dialects alongside NATS KV, install their peer dependencies (e.g., `pg`, `pg-hstore`).

## Usage
```ts
import { createSequelizeWithNats } from 'sequelize-natskv';
import { DataTypes } from 'sequelize';

async function main() {
  // Initialize Sequelize patched with NATS KV
  const sequelize = await createSequelizeWithNats({ url: 'localhost:4222', bucket: 'my-bucket' });
  
  // Define a model as usual
  const User = sequelize.define('User', {
    id: { type: DataTypes.STRING, primaryKey: true },
    name: DataTypes.STRING,
  }, { timestamps: false });
  
  // Subscribe to changes (all columns)
  User.subscribe(event => {
    console.log('User event:', event);
  });

  // Subscribe only on name changes
  User.subscribe(event => {
    console.log('Name changed:', event);
  }, { columns: ['name'] });

  // Perform CRUD operations
  await User.create({ id: '1', name: 'Alice' });
  await User.update({ name: 'Bob' }, { where: { id: '1' } });
  await User.destroy({ where: { id: '1' } });
}
```

## API

### createSequelizeWithNats(options)
- `options.url` _(string)_: NATS server URL (e.g., `'localhost:4222'`)
- `options.bucket` _(string)_: KV bucket name
- **Returns**: `Promise<Sequelize>` – a Sequelize instance patched to use NATS KV

### Model.subscribe(callback, [options])
- `callback(event)` _(function)_: Called on row create/update/destroy. Event object contains:
  - `operation`: `'create' | 'update' | 'destroy'`
  - `data`: instance (for create)
  - `old`, `new`: instances before/after (for update)
  - `old`: instance before delete (for destroy)
  - `changedColumns`: `string[]` of modified columns
- `options.columns` _(string[])_ – filter notifications to events where these columns changed

### Model.unsubscribe(callback)
- Remove a previously added subscription callback

## Development
```bash
# Install dependencies
npm install

# Run tests
npm test

# Build for publishing
npm run build
```

## Contributing
Contributions are welcome! Please open issues or pull requests on the [GitHub repository]. Ensure your changes include tests and update documentation as needed.

## License
MIT © Pahrizal Marup
