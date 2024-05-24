import { DynamicModule, Global, Module, Provider } from '@nestjs/common';
import { RedisDriver } from '@app/redis/redis.driver';
import { BullMQService } from './bullmq.service';
import { Application } from '@common/tokens';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Global()
@Module({})
export class BullMqModule {
    static forRootAsync(): DynamicModule {
        return {
            module: BullMqModule,
            providers: [
                {
                    provide: Application.BullMQ.Driver,
                    useFactory: async (
                        redisDriver: RedisDriver<any>,
                        eventEmitter: EventEmitter2,
                    ): Promise<BullMQService> => {
                        const bullMQService = new BullMQService(redisDriver, eventEmitter);
                        await bullMQService.onModuleInit();
                        return bullMQService;
                    },
                    inject: [Application.Redis.Driver, EventEmitter2],
                },
            ],
            exports: [Application.BullMQ.Driver],
            global: true,
        };
    }
}
