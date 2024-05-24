import Redis from 'ioredis';
import { RedisRepository } from '@domain/redis/repository';

export abstract class BaseCollection<T> implements RedisRepository<T> {
    protected readonly redisClient: Redis;
    protected readonly collectionName: string;

    protected constructor(redisClient: Redis, collectionName: string) {
        this.redisClient = redisClient;
        this.collectionName = collectionName;
    }

    abstract get(key: string | string[]): Promise<T | null>;
    abstract set(key: string, value: T, expire?: number): Promise<string | void>;
}
