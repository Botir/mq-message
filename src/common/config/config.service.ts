import { Injectable } from '@nestjs/common';
import * as dotenv from 'dotenv';
import * as process from 'process';
import { RedisConfig, RedisOptions } from '@common/config/config.types';

@Injectable()
export class ConfigService {
    constructor() {
        const result = dotenv.config();

        if (result.error) {
            throw result.error;
        }
    }

    get(key: string) {
        return process.env[key];
    }

    get botToken(): string {
        return this.get('BOT_TOKEN');
    }

    get redisHost() {
        return this.get('REDIS_HOST');
    }

    get redisPort(): number {
        return Number(this.get('REDIS_PORT')) || 6379;
    }

    get redisOptions(): RedisOptions {
        return {
            username: this.get('REDIS_AUTH_USERNAME'),
            password: this.get('REDIS_AUTH_PASSWORD'),
            db: Number(this.get('REDIS_DB')) || 0,
            collections: this.get('REDIS_COLLECTIONS').split(','),
            noDelay: this.get('REDIS_NO_DELAY') == 'true',
            lazyConnect: this.get('REDIS_LAZY_CONNECT') == 'true',
        };
    }
}
