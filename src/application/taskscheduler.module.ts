import { Module } from '@nestjs/common';
import { SharedModule } from '@common/shared.module';
import { TaskModule } from './taskscheduler/task.module';
import { RedisModule } from '@app/redis/redis.module';
import { ConfigService } from '@common/config';

@Module({
    imports: [
        TaskModule,
        SharedModule,
        RedisModule.forRootAsync({
            useFactory: (config: ConfigService) => ({
                host: config.redisHost,
                port: config.redisPort,
                options: config.redisOptions,
            }),
            inject: [ConfigService],
        }),
    ],
    providers: [],
    controllers: [],
})
export class TaskSchedulerModule {}
