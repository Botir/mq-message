import { Module } from '@nestjs/common';
import { UseCases } from '@common/tokens';
import { BotService } from './bot.service';

@Module({
    imports: [],
    providers: [
        BotService,
    ],
    exports: [BotService],
})
export class BotModule {}
