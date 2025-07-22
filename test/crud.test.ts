import { createSequelizeWithNats } from '../src/index';
import { DataTypes } from 'sequelize';

describe('NATS KV dialect CRUD', () => {
  let sequelize: any;
  let User: any;

  beforeAll(async () => {
    sequelize = await createSequelizeWithNats({ url: 'localhost:4222', bucket: 'test' });
    User = sequelize.define('User', {
      id: {
        type: DataTypes.STRING,
        primaryKey: true,
      },
      name: DataTypes.STRING,
    }, { timestamps: false });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  test('create and retrieve', async () => {
    const user: any = await User.create({ id: '1', name: 'Alice' });
    expect(user.name).toBe('Alice');

    const found = await User.findByPk('1');
    expect(found).not.toBeNull();
    expect(found!.name).toBe('Alice');
  });

  test('update', async () => {
    const [count, [updated]]: [number, any[]] = await User.update({ name: 'Bob' }, { where: { id: '1' } });
    expect(count).toBe(1);
    expect(updated.name).toBe('Bob');

    const found = await User.findByPk('1');
    expect(found!.name).toBe('Bob');
  });

  test('findAll', async () => {
    const users: any[] = await User.findAll();
    expect(users.length).toBeGreaterThanOrEqual(1);
  });

  test('destroy', async () => {
    const count: number = await User.destroy({ where: { id: '1' } });
    expect(count).toBe(1);
    const found2 = await User.findByPk('1');
    expect(found2).toBeNull();
  });
});
