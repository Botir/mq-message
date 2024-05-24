import { NestFactory } from '@nestjs/core';
import { TaskSchedulerModule } from '@app/taskscheduler.module';
import { TaskService } from '@app/taskscheduler/task.service';

async function bootstrap() {
    const app = await NestFactory.create(TaskSchedulerModule);

    // @TODO run on cluster mode
    const taskService = app.get(TaskService);
    await taskService.processTasks();

    app.enableShutdownHooks();
}
bootstrap();
