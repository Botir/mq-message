import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Application } from '@common/tokens';
import { BullMQService } from '@app/bullmq/bullmq.service';

@Injectable()
export class TaskService implements OnModuleInit {
    private readonly logger = new Logger(TaskService.name);

    constructor(
        @Inject(Application.BullMQ.Driver) private readonly bullMQService: BullMQService,
        private readonly eventEmitter: EventEmitter2,
    ) {}

    async onModuleInit(): Promise<void> {
        this.eventEmitter.on('bullmq.ready', () => {
            this.subscribeToMessages();
        });
    }

    private subscribeToMessages() {
        this.logger.log('Subscribing to BullMQ messages...');
        this.bullMQService.subscribeToQueue('groupMessageQueue', async (data: any) => {
            try {
                const { chatId, message, options } = data;
                // Simulate sending message to Telegram
                console.log(`Sending message to chat ${chatId}: ${message}`);
                //this.logger.log(`Sending message to chat ${chatId}: ${message}`);
                // Implement the actual message sending logic here
            } catch (error) {
                this.logger.error('Error processing message:', error);
            }
        });
    }
}
