import { RedisConfig } from '@common/config';

export type RedisModuleAsyncOptions = {
    inject?: any[];
    useFactory?: (...args: any[]) => Promise<RedisConfig> | RedisConfig;
};
