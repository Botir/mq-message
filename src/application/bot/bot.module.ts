import { Module } from '@nestjs/common';
import { UseCases } from '@common/tokens';
import { BotService } from './bot.service';
import { BullMQUsecase } from '@usecases/bullmq/usecase';

@Module({
    imports: [],
    providers: [
        BotService,
        {
            provide: UseCases.MQ.SendMessageUsecase,
            useClass: BullMQUsecase,
        },
    ],
    exports: [BotService],
})
export class BotModule {}
