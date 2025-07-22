import { NatsKVSequelize } from '../src/nats-kv-sequelize';
import { createModel } from '../src/model';
import dotenv from 'dotenv';
dotenv.config();
const { connect } = require('nats');

async function clearBucket(bucket: any) {
  // Connect to NATS and clear all keys in the given bucket
  const nc = await connect({
    servers: process.env.NATS_SERVERS ? process.env.NATS_SERVERS.split(',') : ['nats://127.0.0.1:4222'],
    user: process.env.NATS_USER,
    pass: process.env.NATS_PASS,
  });
  const js = nc.jetstream();
  const kv = await js.views.kv(bucket);
  const iter = await kv.keys('*');
  for await (const key of iter) {
    await kv.delete(key);
  }
  await nc.close();
}

describe('Model.truncate', () => {
  let sequelize: any;
  let User: any;
  const bucket: any = 'unity_truncate';

  beforeAll(async () => {
    await clearBucket(bucket);
    sequelize = new NatsKVSequelize({
      servers: process.env.NATS_SERVERS ? process.env.NATS_SERVERS.split(',') : ['nats://127.0.0.1:4222'],
      bucket,
      user: process.env.NATS_USER,
      pass: process.env.NATS_PASS,
    });
    await sequelize.authenticate();
    User = createModel(sequelize, 'User', {
      id: { type: 'INTEGER', primaryKey: true },
      name: { type: 'STRING' },
      email: { type: 'STRING' },
      age: { type: 'INTEGER' },
    }, {});
    User.indexes = ['email'];
  });

  beforeEach(async () => {
    await clearBucket(bucket);
    await User.create({ id: 1, name: 'Alice', email: 'alice@example.com', age: 30 });
    await User.create({ id: 2, name: 'Bob', email: 'bob@example.com', age: 25 });
  });

  afterAll(async () => {
    await sequelize.close();
    await clearBucket(bucket);
  });

  it('should remove all records and indexes after truncate', async () => {
    // Ensure records exist
    let users = await User.findAll();
    expect(users.length).toBeGreaterThan(0);
    // Truncate
    await User.truncate();
    // Should be empty
    users = await User.findAll();
    expect(users.length).toBe(0);
    // Indexes should be empty too
    const kv = sequelize.getKV();
    const iter = await kv.keys('User.index.email.>');
    let found = false;
    for await (const key of iter) {
      found = true;
      console.log('Found index key:', key);
    }
    expect(found).toBe(false);
  });
}); 