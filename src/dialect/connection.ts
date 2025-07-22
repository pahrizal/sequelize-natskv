import { NatsConnection, KV } from 'nats';

export class NatsKvConnection {
  private closed = false;

  constructor(
    private natsConnection: NatsConnection,
    private kvStore: KV
  ) {}

  public async close(): Promise<void> {
    this.closed = true;
  }

  public isClosed(): boolean {
    return this.closed || this.natsConnection.isClosed();
  }

  public getKvStore(): KV {
    return this.kvStore;
  }

  public getNatsConnection(): NatsConnection {
    return this.natsConnection;
  }

  public async put(key: string, value: Uint8Array): Promise<number> {
    return await this.kvStore.put(key, value);
  }

  public async get(key: string): Promise<any> {
    try {
      const entry = await this.kvStore.get(key);
      return entry;
    } catch (error) {
      if ((error as any).code === '404') {
        return null;
      }
      throw error;
    }
  }

  public async delete(key: string): Promise<void> {
    await this.kvStore.delete(key);
  }

  public async list(prefix?: string): Promise<string[]> {
    const keys: string[] = [];
    const iter = await this.kvStore.keys(prefix);
    for await (const key of iter) {
      keys.push(key);
    }
    return keys;
  }

  public async watch(key: string, callback: (value: any) => void): Promise<void> {
    const watcher = await this.kvStore.watch({ key });
    (async () => {
      for await (const entry of watcher) {
        callback(entry);
      }
    })();
  }
}