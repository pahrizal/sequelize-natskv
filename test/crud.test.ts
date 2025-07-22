import { NatsKVSequelize } from '../src/nats-kv-sequelize';
import { createModel } from '../src/model';

describe('NATS KV ORM CRUD Operations', () => {
  let sequelize: NatsKVSequelize;
  let User: any;

  beforeAll(async () => {
    sequelize = new NatsKVSequelize({
      servers: ['nats://127.0.0.1:4222'],
      bucket: 'unity',
      user: 'aptus-unity',
      pass: 'Ry7mP9kL4vB2x5',
    });
    await sequelize.authenticate();

    User = createModel(sequelize, 'User', {
      id: { type: 'INTEGER', primaryKey: true },
      name: { type: 'STRING' },
      email: { type: 'STRING' },
      age: { type: 'INTEGER' },
    }, {});
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it('should create a user', async () => {
    const user = await User.create({ id: 1, name: 'Alice', email: 'alice@example.com', age: 30 });
    expect(user).toMatchObject({ id: 1, name: 'Alice', email: 'alice@example.com', age: 30 });
  });

  it('should find a user by id', async () => {
    const user = await User.findOne({ where: { id: 1 } });
    expect(user).toMatchObject({ id: 1, name: 'Alice', email: 'alice@example.com', age: 30 });
  });

  it('should find a user by email', async () => {
    const user = await User.findOne({ where: { email: 'alice@example.com' } });
    expect(user).toMatchObject({ id: 1, name: 'Alice', email: 'alice@example.com', age: 30 });
  });

  it('should find all users', async () => {
    await User.create({ id: 2, name: 'Bob', email: 'bob@example.com', age: 25 });
    const users = await User.findAll();
    expect(users.length).toBeGreaterThanOrEqual(2);
    expect(users).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 1, name: 'Alice' }),
        expect.objectContaining({ id: 2, name: 'Bob' }),
      ])
    );
  });

  it('should update a user', async () => {
    const updated = await User.update({ age: 31 }, { where: { id: 1 } });
    expect(updated.age).toBe(31);
    const user = await User.findOne({ where: { id: 1 } });
    expect(user.age).toBe(31);
  });

  it('should delete a user', async () => {
    await User.destroy({ where: { id: 2 } });
    const user = await User.findOne({ where: { id: 2 } });
    expect(user).toBeNull();
  });

  it('should watch for changes on a user row', async () => {
    const changes: any[] = [];
    const watchPromise = new Promise<void>(async (resolve) => {
      await User.watch({ where: { id: 1 } }, (change: any) => {
        changes.push(change);
        if (change && change.age === 32) {
          resolve();
        }
      });
    });

    // Trigger a change
    await User.update({ age: 32 }, { where: { id: 1 } });
    await watchPromise;
    expect(changes.some(c => c.age === 32)).toBe(true);
  });
});

describe('NATS KV ORM Non-Primary Key Edge Cases', () => {
  let sequelize: NatsKVSequelize;
  let User: any;

  beforeAll(async () => {
    sequelize = new NatsKVSequelize({
      servers: ['nats://127.0.0.1:4222'],
      bucket: 'unity-edge',
      user: 'aptus-unity',
      pass: 'Ry7mP9kL4vB2x5',
    });
    await sequelize.authenticate();

    User = createModel(sequelize, 'UserEdge', {
      id: { type: 'INTEGER', primaryKey: true },
      name: { type: 'STRING' },
      email: { type: 'STRING' },
      age: { type: 'INTEGER' },
    }, {});

    // Insert test data
    await User.create({ id: 101, name: 'Eve', email: 'eve@example.com', age: 40 });
    await User.create({ id: 102, name: 'Frank', email: 'frank@example.com', age: 25 });
    await User.create({ id: 103, name: 'Grace', email: 'eve@example.com', age: 25 }); // duplicate email, duplicate age
    await User.create({ id: 104, name: 'Heidi', email: 'heidi@example.com', age: 30 });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it('should find all users with the same email', async () => {
    const users = await User.findAll({ where: { email: 'eve@example.com' } });
    expect(users.length).toBe(2);
    expect(users).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 101, name: 'Eve' }),
        expect.objectContaining({ id: 103, name: 'Grace' }),
      ])
    );
  });

  it('should find all users with the same age', async () => {
    const users = await User.findAll({ where: { age: 25 } });
    expect(users.length).toBe(2);
    expect(users).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 102, name: 'Frank' }),
        expect.objectContaining({ id: 103, name: 'Grace' }),
      ])
    );
  });

  it('should return null for findOne with no match', async () => {
    const user = await User.findOne({ where: { email: 'notfound@example.com' } });
    expect(user).toBeNull();
  });

  it('should return the first match for findOne with non-unique non-primary key', async () => {
    const user = await User.findOne({ where: { email: 'eve@example.com' } });
    expect(['Eve', 'Grace']).toContain(user.name);
  });

  it('should find a user with multiple fields in where', async () => {
    const where = { age: 25, name: 'Frank' };
    const user = await User.findOne({ where });
    expect(user).toMatchObject({ id: 102, name: 'Frank', email: 'frank@example.com', age: 25 });
  });
});