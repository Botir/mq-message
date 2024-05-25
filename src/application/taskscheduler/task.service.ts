import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Bot } from 'grammy';
import { ConfigService } from '@common/config';
import { Application } from '@common/tokens';
import { BullMQService } from '@app/bullmq/bullmq.service';

@Injectable()
export class TaskService implements OnModuleInit {
    private readonly logger = new Logger(TaskService.name);
    private readonly token: string;
    private bot: Bot;

    constructor(
        private readonly config: ConfigService,
        @Inject(Application.BullMQ.Driver) private readonly bullMQService: BullMQService,
        private readonly eventEmitter: EventEmitter2,
    ) {
        this.token = config.botToken || '';
        this.bot = new Bot(this.token);
    }

    async onModuleInit(): Promise<void> {
        this.eventEmitter.on('bullmq.ready', () => {
            this.subscribeToMessages();
        });
    }

    private subscribeToMessages() {
        this.logger.log('Subscribing to BullMQ messages...');
        this.bullMQService.subscribeToOrderQueue('message-group', async (data: any) => {
            try {
                const { message } = data;
                // Simulate sending message to Telegram
                console.log(message);
                await this.sendMessage(data).catch((error) => {
                    console.error('Error parsing data or sending message:', error);
                });
            } catch (error) {
                this.logger.error('Error processing message:', error);
            }
        });

        this.logger.log('Subscribing to BullMQ tasks...');
        this.bullMQService.subscribeToTask('new-task', async (data: any) => {
            try {
                const { taskType } = data;
                if (taskType === 'getChatMemberCount') {
                    const { chatId } = data;
                    const memberCount = await this.getChatMemberCount(chatId).catch((error) => {
                        console.error('Error parsing data:', error);
                    });
                    console.log(`getChatMemberCount: ${memberCount}`);
                }
            } catch (error) {
                this.logger.error('Error processing task:', error);
            }
        });
    }

    async sendMessage(data: any): Promise<void> {
        try {
            const { chatId, message, options } = data;
            console.log(`Sending message to chat ID ${chatId}`);
            await this.bot.api.sendMessage(chatId, message, options);
            console.log('Message sent successfully');
        } catch (error) {
            console.error('Error sending message:', error);
        }
    }

    public async getChatMemberCount(chatId: number): Promise<number> {
        try {
            const members = await this.bot.api.getChatMemberCount(chatId);
            return members;
        } catch (error) {
            console.error('Error getting chat member count:', error.response.data);
            throw error;
        }
        return 0;
    }
}
