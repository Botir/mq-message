import { Module } from '@nestjs/common';
import { BotModule } from './bot/bot.module';
import { RedisModule } from '@app/redis/redis.module';
import { BullMqModule } from '@app/bullmq/bullmq.module';
import { SharedModule } from '@common/shared.module';
import { ConfigService } from '@common/config';
import { EventEmitterModule } from '@nestjs/event-emitter';

@Module({
    imports: [
        EventEmitterModule.forRoot(),
        RedisModule.forRootAsync({
            useFactory: (config: ConfigService) => ({
                host: config.redisHost,
                port: config.redisPort,
                options: config.redisOptions,
            }),
            inject: [ConfigService],
        }),
        BotModule,
        SharedModule,
        BullMqModule.forRootAsync(),
    ],
    providers: [],
    controllers: [],
})
export class AppModule {}
