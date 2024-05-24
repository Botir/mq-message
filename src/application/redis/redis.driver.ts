import Redis from 'ioredis';
import { Inject, Injectable } from '@nestjs/common';
import { StringCollection } from '@infrastructure/redis';
import { Application } from '@common/tokens';
import { RedisConfig } from '@common/config';

@Injectable()
export class RedisDriver<T> {
    private readonly redisClient: Redis;
    private readonly stringCollections: { [key: string]: StringCollection<T> } = {};

    constructor(@Inject(Application.Redis.Config) private readonly config: RedisConfig) {
        this.redisClient = new Redis(config.port, config.host, config.options);
        config.options.collections.forEach((collection: string) => {
            this.stringCollections[collection] = new StringCollection<T>(this.redisClient, collection);
        });
    }

    get client() {
        return this.redisClient;
    }

    isConnected() {
        return this.redisClient.status;
    }

    getStringCollections(): { [key: string]: StringCollection<T> } {
        return this.stringCollections;
    }

    async getAllSetMembers(key: string): Promise<string[]> {
        return await this.redisClient.smembers(key);
    }

    async scanForKeys(pattern: string): Promise<string[]> {
        let cursor = '0';
        let keys: string[] = [];
        do {
            const reply = await this.redisClient.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
            cursor = reply[0];
            keys = keys.concat(reply[1]);
        } while (cursor !== '0');
        return keys;
    }

    async getValueByKey(key: string): Promise<string> {
        return await this.redisClient.get(key);
    }
}