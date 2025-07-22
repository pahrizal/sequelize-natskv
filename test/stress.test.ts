import { NatsKVSequelize } from '../src/nats-kv-sequelize';
import { createModel } from '../src/model';

describe('NATS KV ORM Stress Test', () => {
  const USER_COUNT = 1000;
  let sequelize: NatsKVSequelize;
  let User: any;

  function logUsage(label: string, startMem: NodeJS.MemoryUsage, endMem: NodeJS.MemoryUsage, startCPU: NodeJS.CpuUsage, endCPU: NodeJS.CpuUsage) {
    const memDiff = {
      rss: (endMem.rss - startMem.rss) / 1024 / 1024,
      heapTotal: (endMem.heapTotal - startMem.heapTotal) / 1024 / 1024,
      heapUsed: (endMem.heapUsed - startMem.heapUsed) / 1024 / 1024,
      external: (endMem.external - startMem.external) / 1024 / 1024,
    };
    const cpuDiff = {
      user: (endCPU.user - startCPU.user) / 1000, // ms
      system: (endCPU.system - startCPU.system) / 1000, // ms
    };
    console.log(`${label} - Memory Δ: rss ${memDiff.rss.toFixed(2)}MB, heapUsed ${memDiff.heapUsed.toFixed(2)}MB, CPU Δ: user ${cpuDiff.user}ms, system ${cpuDiff.system}ms`);
  }

  beforeAll(async () => {
    sequelize = new NatsKVSequelize({
      servers: ['nats://127.0.0.1:4222'],
      bucket: 'unity-stress',
      user: 'aptus-unity',
      pass: 'Ry7mP9kL4vB2x5',
    });
    await sequelize.authenticate();
    User = createModel(sequelize, 'UserStress', {
      id: { type: 'INTEGER', primaryKey: true },
      name: { type: 'STRING' },
      email: { type: 'STRING' },
      age: { type: 'INTEGER' },
    }, {});
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it(`should handle bulk create, read, update, and delete for ${USER_COUNT} users`, async () => {
    // Bulk create
    const users = Array.from({ length: USER_COUNT }, (_, i) => ({
      id: i + 1,
      name: `User${i + 1}`,
      email: `user${i + 1}@example.com`,
      age: 20 + (i % 30),
    }));
    const mem0 = process.memoryUsage();
    const cpu0 = process.cpuUsage();
    const t0 = Date.now();
    await Promise.all(users.map(user => User.create(user)));
    const t1 = Date.now();
    const mem1 = process.memoryUsage();
    const cpu1 = process.cpuUsage();
    console.log(`Created ${USER_COUNT} users in ${t1 - t0}ms`);
    logUsage('Create', mem0, mem1, cpu0, cpu1);

    // Bulk read (findAll)
    const mem2 = process.memoryUsage();
    const cpu2 = process.cpuUsage();
    const t2 = Date.now();
    const allUsers = await User.findAll();
    const t3 = Date.now();
    const mem3 = process.memoryUsage();
    const cpu3 = process.cpuUsage();
    console.log(`Read all ${allUsers.length} users in ${t3 - t2}ms`);
    logUsage('ReadAll', mem2, mem3, cpu2, cpu3);
    expect(allUsers.length).toBe(USER_COUNT);

    // Random access (findOne)
    const mem4 = process.memoryUsage();
    const cpu4 = process.cpuUsage();
    const t4 = Date.now();
    for (let i = 0; i < 100; i++) {
      const idx = Math.floor(Math.random() * USER_COUNT) + 1;
      const user = await User.findOne({ where: { id: idx } });
      expect(user).toBeTruthy();
      expect(user.id).toBe(idx);
    }
    const t5 = Date.now();
    const mem5 = process.memoryUsage();
    const cpu5 = process.cpuUsage();
    console.log(`Performed 100 random findOne queries in ${t5 - t4}ms`);
    logUsage('RandomFindOne', mem4, mem5, cpu4, cpu5);

    // Bulk update
    const mem6 = process.memoryUsage();
    const cpu6 = process.cpuUsage();
    const t6 = Date.now();
    await Promise.all(users.map(user => User.update({ age: 99 }, { where: { id: user.id } })));
    const t7 = Date.now();
    const mem7 = process.memoryUsage();
    const cpu7 = process.cpuUsage();
    console.log(`Updated ${USER_COUNT} users in ${t7 - t6}ms`);
    logUsage('Update', mem6, mem7, cpu6, cpu7);

    // Verify updates
    const updatedUsers = await User.findAll({ where: { age: 99 } });
    expect(updatedUsers.length).toBe(USER_COUNT);

    // Bulk delete
    const mem8 = process.memoryUsage();
    const cpu8 = process.cpuUsage();
    const t8 = Date.now();
    await Promise.all(users.map(user => User.destroy({ where: { id: user.id } })));
    const t9 = Date.now();
    const mem9 = process.memoryUsage();
    const cpu9 = process.cpuUsage();
    console.log(`Deleted ${USER_COUNT} users in ${t9 - t8}ms`);
    logUsage('Delete', mem8, mem9, cpu8, cpu9);

    // Verify deletes
    const afterDelete = await User.findAll();
    expect(afterDelete.length).toBe(0);
  }, 300_000); // 5 minute timeout for stress test
}); 