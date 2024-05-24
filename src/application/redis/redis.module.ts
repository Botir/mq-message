import { DynamicModule, Global, Module, Provider } from '@nestjs/common';
import { RedisDriver } from '@app/redis/redis.driver';
import { RedisModuleAsyncOptions } from '@app/redis/types';
import { Application } from '@common/tokens';

@Global()
@Module({})
export class RedisModule {
    static forRootAsync(options: RedisModuleAsyncOptions): DynamicModule {
        const redisOptionsProvider: Provider = {
            provide: Application.Redis.Config,
            useFactory: options.useFactory,
            inject: options.inject || [],
        };
        return {
            module: RedisModule,
            providers: [
                redisOptionsProvider,
                {
                    provide: Application.Redis.Driver,
                    useClass: RedisDriver,
                },
            ],
            exports: [redisOptionsProvider, Application.Redis.Driver],
            global: true,
        };
    }
}
