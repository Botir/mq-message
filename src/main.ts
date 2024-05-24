import { NestFactory } from '@nestjs/core';
import { AppModule } from '@app/app.module';
import { BotService } from '@app/bot/bot.service';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);

    // @TODO run on cluster mode
    const bot = app.get(BotService);
    await bot.launch();

    app.enableShutdownHooks();
}
bootstrap();
