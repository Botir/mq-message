import Redis from 'ioredis';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { StringCollection } from '@infrastructure/redis';
import { Application } from '@common/tokens';
import { RedisConfig } from '@common/config';

@Injectable()
export class RedisDriver<T> {
    private readonly redisClient: Redis;
    private readonly stringCollections: { [key: string]: StringCollection<T> } = {};
    private readonly logger = new Logger(RedisDriver.name);

    constructor(
        @Inject(Application.Redis.Config) private readonly config: RedisConfig,
        private eventEmitter: EventEmitter2,
    ) {
        this.redisClient = new Redis(config.port, config.host, config.options);

        this.redisClient.on('connect', () => {
            this.logger.log('Redis client connected');
        });

        this.redisClient.on('ready', () => {
            this.logger.log('Redis client ready');
            this.eventEmitter.emit('redis.ready');
        });

        this.redisClient.on('error', (err) => {
            this.logger.error(`Redis client error: ${err.message}`);
        });

        this.redisClient.on('close', () => {
            this.logger.log('Redis client connection closed');
        });

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
