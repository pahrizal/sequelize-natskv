import { NatsKVSequelize } from '../src/nats-kv-sequelize';
import dotenv from 'dotenv';
dotenv.config();
import fs from 'fs/promises';
import path from 'path';

describe('NatsKVSequelize backup and restore (model use case)', () => {
  const testBucket = 'test_backup_restore_bucket';
  const backupFile = path.join(__dirname, 'test-backup.json');
  let orm: NatsKVSequelize;
  let User: any;

  beforeAll(async () => {
    orm = new NatsKVSequelize({
      servers: process.env.NATS_SERVERS ? process.env.NATS_SERVERS.split(',') : ['localhost:4222'],
      bucket: testBucket,
      user: process.env.NATS_USER,
      pass: process.env.NATS_PASS,
    });
    await orm.authenticate();
    User = orm.define('User', {
      id: { type: 'number', primaryKey: true },
      name: { type: 'string' },
      email: { type: 'string' },
    }, { indexes: ['email'] });
  });

  afterAll(async () => {
    // Clean up: delete all keys in the test bucket and remove backup file
    if (!orm['kv']) return;
    const iter = await orm['kv'].keys();
    for await (const key of iter) {
      await orm['kv'].delete(key as string);
    }
    try { await fs.unlink(backupFile); } catch {}
    if (orm['nc']) await orm['nc'].close();
  });

  it('should backup and restore all model data with clear option', async () => {
    if (!orm['kv']) return fail('KV store not initialized');
    // Create model data
    await User.create({ id: 1, name: 'Alice', email: 'alice@example.com' });
    await User.create({ id: 2, name: 'Bob', email: 'bob@example.com' });

    // Backup
    await orm.backup(backupFile);
    const backupContent = await fs.readFile(backupFile, 'utf-8');
    const backupData = JSON.parse(backupContent);
    // Should contain User model keys
    const userKeys = Object.keys(backupData).filter(k => k.startsWith('User.'));
    expect(userKeys.length).toBeGreaterThan(0);

    // Clear bucket (double pass)
    if (!orm['kv']) return fail('KV store not initialized');
    const iter = await orm['kv'].keys();
    for await (const key of iter) {
      await orm['kv'].delete(key as string);
    }
    const iter2 = await orm['kv'].keys();
    for await (const key of iter2) {
      await orm['kv'].delete(key as string);
    }
    // Ensure cleared
    const iter3 = await orm['kv'].keys();
    const keysAfterClear: string[] = [];
    for await (const key of iter3) keysAfterClear.push(key as string);
    expect(keysAfterClear.length).toBe(0);

    // Restore with clear option
    await orm.restore(backupFile, { clear: true });
    // Check model data
    const alice = await User.findOne({ where: { id: 1 } });
    const bob = await User.findOne({ where: { id: 2 } });
    expect(alice).not.toBeNull();
    expect(bob).not.toBeNull();
    if (!alice || !bob) return fail('Restored user(s) not found');
    expect(alice.name).toBe('Alice');
    expect(bob.email).toBe('bob@example.com');
  });
}); 