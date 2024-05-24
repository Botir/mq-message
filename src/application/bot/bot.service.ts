import { Inject, Injectable, Logger } from '@nestjs/common';
import { UseCases } from '@common/tokens';
import { BullMQUsecase } from '@usecases/bullmq/usecase';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class BotService {
    private readonly logger = new Logger(BotService.name);
    private groups = [5947376037]; // Telegram group chat IDs

    constructor(
        @Inject(UseCases.MQ.SendMessageUsecase) private readonly bullMQUsecase: BullMQUsecase,
        private readonly eventEmitter: EventEmitter2,
    ) {}

    async launch(): Promise<void> {
        this.logger.log('Waiting for BullMQ to be ready...');
        this.eventEmitter.on('bullmq.ready', async () => {
            this.logger.log('BullMQ is ready. Starting to send messages to groups');
            await this.sendMessagesToGroups();
        });
    }

    private async sendMessagesToGroups() {
        for (const groupID of this.groups) {
            const messagesCount = 25;
            for (let i = 0; i < messagesCount; i++) {
                const brokerMessage = JSON.stringify({
                    type: 'group',
                    chatId: groupID,
                    message: `${i} Random message`,
                    options: {
                        parse_mode: 'HTML',
                    },
                });

                // Send message to MQ
                await this.bullMQUsecase.sendQueueMessage('message-group', brokerMessage);
            }
        }
    }
}
