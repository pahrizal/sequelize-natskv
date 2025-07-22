import { connect, NatsConnection, KV, KvOptions } from 'nats';
import { NatsKvConnection } from './connection';

export interface NatsKvConfig {
  servers?: string | string[];
  user?: string;
  pass?: string;
  token?: string;
  timeout?: number;
  kvBucket?: string;
  kvOptions?: Partial<KvOptions>;
}

export class NatsKvConnectionManager {
  private natsConnection: NatsConnection | null = null;
  private kvStore: KV | null = null;
  public readonly lib = { connect };

  constructor(dialect: any, sequelize: any) {
    // No base class to call
  }

  public async connect(config: NatsKvConfig): Promise<NatsKvConnection> {
    try {
      if (!this.natsConnection) {
        const connectionOptions = {
          servers: config.servers || 'localhost:4222',
          user: config.user,
          pass: config.pass,
          token: config.token,
          timeout: config.timeout || 30000,
        };

        this.natsConnection = await connect(connectionOptions);
      }

      if (!this.kvStore) {
        const js = this.natsConnection.jetstream();
        const kvBucketName = config.kvBucket || 'sequelize_kv';
        
        try {
          this.kvStore = await js.views.kv(kvBucketName);
        } catch (error) {
          // Create the KV bucket if it doesn't exist
          this.kvStore = await js.views.kv(kvBucketName, {
            history: 1,
            ...config.kvOptions,
          });
        }
      }

      return new NatsKvConnection(this.natsConnection, this.kvStore);
    } catch (error) {
      throw new Error(`Failed to connect to NATS: ${error instanceof Error ? error.message : error}`);
    }
  }

  public async disconnect(connection: NatsKvConnection): Promise<void> {
    if (connection) {
      await connection.close();
    }
    if (this.natsConnection) {
      await this.natsConnection.close();
      this.natsConnection = null;
      this.kvStore = null;
    }
  }

  public validate(connection: NatsKvConnection): boolean {
    return connection && !connection.isClosed();
  }
}