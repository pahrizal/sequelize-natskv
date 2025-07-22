import { ModelStatic, Model } from 'sequelize';

// Augment Sequelize ModelStatic to support subscription API
declare module 'sequelize' {
  interface ModelStatic<M extends Model = any> {
    /**
     * List of subscribers to model changes
     */
    subscribers: Array<{ callback: (event: any) => void; columns?: string[] }>;
    /**
     * Subscribe to row changes. Optionally filter by columns.
     */
    subscribe(callback: (event: any) => void, options?: { columns?: string[] }): void;
    /**
     * Unsubscribe a previously added callback
     */
    unsubscribe(callback: (event: any) => void): void;
  }
}
