import { createSequelizeWithNats } from '../src/index';
import { DataTypes } from 'sequelize';

describe('Model subscription API', () => {
  let sequelize: any;
  let Item: any;

  beforeAll(async () => {
    sequelize = await createSequelizeWithNats({ url: 'localhost:4222', bucket: 'subtest' });
    Item = sequelize.define('Item', {
      id: { type: DataTypes.STRING, primaryKey: true },
      name: DataTypes.STRING,
    }, { timestamps: false });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  test('create triggers subscriber', async () => {
    const cb = jest.fn();
    Item.subscribe(cb);
    await Item.create({ id: '10', name: 'Test' });
    expect(cb).toHaveBeenCalledTimes(1);
    const ev = cb.mock.calls[0][0];
    expect(ev.operation).toBe('create');
    expect(ev.data.name).toBe('Test');
    expect(ev.changedColumns).toEqual(expect.arrayContaining(['id', 'name']));
    Item.unsubscribe(cb);
  });

  test('update triggers subscribers with filters', async () => {
    const cbAll = jest.fn();
    const cbName = jest.fn();
    const cbFoo = jest.fn();
    Item.subscribe(cbAll);
    Item.subscribe(cbName, { columns: ['name'] });
    Item.subscribe(cbFoo, { columns: ['foo'] });
    // Create initial record
    await Item.create({ id: '11', name: 'OldValue' });
    cbAll.mockClear(); cbName.mockClear(); cbFoo.mockClear();
    // Update name
    await Item.update({ name: 'NewValue' }, { where: { id: '11' } });
    expect(cbAll).toHaveBeenCalledTimes(1);
    expect(cbName).toHaveBeenCalledTimes(1);
    expect(cbFoo).not.toHaveBeenCalled();
    const ev = cbName.mock.calls[0][0];
    expect(ev.operation).toBe('update');
    expect(ev.old.name).toBe('OldValue');
    expect(ev.new.name).toBe('NewValue');
    expect(ev.changedColumns).toEqual(['name']);
    // Clean up
    Item.unsubscribe(cbAll);
    Item.unsubscribe(cbName);
    Item.unsubscribe(cbFoo);
  });

  test('destroy triggers subscriber', async () => {
    const cb = jest.fn();
    Item.subscribe(cb);
    await Item.create({ id: '12', name: 'ToDelete' });
    cb.mockClear();
    await Item.destroy({ where: { id: '12' } });
    expect(cb).toHaveBeenCalledTimes(1);
    const ev = cb.mock.calls[0][0];
    expect(ev.operation).toBe('destroy');
    expect(ev.old.name).toBe('ToDelete');
    expect(ev.changedColumns).toEqual(expect.arrayContaining(['id', 'name']));
    Item.unsubscribe(cb);
  });
});
