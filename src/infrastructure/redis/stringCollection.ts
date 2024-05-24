import { BaseCollection } from '@infrastructure/redis/baseCollection';
import Redis from 'ioredis';

export class StringCollection<T = string> extends BaseCollection<T> {
    constructor(redisClient: Redis, collectionName: string) {
        super(redisClient, collectionName);
    }

    async get(identifier: string | string[]): Promise<T | null> {
        const key = this.getKey(identifier as string);
        const result = await this.redisClient.get(key);
        return result ? (JSON.parse(result) as T) : null;
    }

    async set(identifier: string, value: T, expire: number = 86400): Promise<string> {
        const key = this.getKey(identifier);
        return this.redisClient.set(key, JSON.stringify(value), 'EX', expire);
    }

    private getKey(identifier: string): string {
        return this.collectionName + `:${identifier}`;
    }
}
