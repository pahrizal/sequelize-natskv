"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("../src/index");
const sequelize_1 = require("sequelize");
describe('NATS KV dialect CRUD', () => {
    let sequelize;
    let User;
    beforeAll(async () => {
        sequelize = await (0, index_1.createSequelizeWithNats)({ url: 'localhost:4222', bucket: 'test' });
        User = sequelize.define('User', {
            id: {
                type: sequelize_1.DataTypes.STRING,
                primaryKey: true,
            },
            name: sequelize_1.DataTypes.STRING,
        }, { timestamps: false });
    });
    afterAll(async () => {
        await sequelize.close();
    });
    test('create and retrieve', async () => {
        const user = await User.create({ id: '1', name: 'Alice' });
        expect(user.name).toBe('Alice');
        const found = await User.findByPk('1');
        expect(found).not.toBeNull();
        expect(found.name).toBe('Alice');
    });
    test('update', async () => {
        const [count, [updated]] = await User.update({ name: 'Bob' }, { where: { id: '1' } });
        expect(count).toBe(1);
        expect(updated.name).toBe('Bob');
        const found = await User.findByPk('1');
        expect(found.name).toBe('Bob');
    });
    test('findAll', async () => {
        const users = await User.findAll();
        expect(users.length).toBeGreaterThanOrEqual(1);
    });
    test('destroy', async () => {
        const count = await User.destroy({ where: { id: '1' } });
        expect(count).toBe(1);
        const found2 = await User.findByPk('1');
        expect(found2).toBeNull();
    });
});
