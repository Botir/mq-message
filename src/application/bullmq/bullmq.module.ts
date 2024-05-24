import { DynamicModule, Global, Module, Provider } from '@nestjs/common';
import { RedisDriver } from '@app/redis/redis.driver';
import { BullMQService } from './bullmq.service';
import { Application } from '@common/tokens';

@Global()
@Module({})
export class BullMqModule {
    static forRootAsync(): DynamicModule {
        return {
            module: BullMqModule,
            providers: [
                {
                    provide: Application.BullMQ.Driver,
                    useFactory: async (redisDriver: RedisDriver<any>): Promise<BullMQService> => {
                        const bullMQService = new BullMQService(redisDriver);
                        await bullMQService.onModuleInit();
                        return bullMQService;
                    },
                },
            ],
            exports: [Application.BullMQ.Driver],
            global: true,
        };
    }
}
