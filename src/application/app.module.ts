import { Module } from '@nestjs/common';
import { BotModule } from './bot/bot.module';
import { SharedModule } from '@common/shared.module';

@Module({
    imports: [BotModule, SharedModule],
    providers: [],
    controllers: [],
})
export class AppModule {}
