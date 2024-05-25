import { Inject, Injectable } from '@nestjs/common';
import { Application } from '@common/tokens';
import { BullMQService } from '@app/bullmq/bullmq.service';

@Injectable()
export class BullMQUsecase {
    constructor(@Inject(Application.BullMQ.Driver) private bullMQ: BullMQService) {}

    async sendQueueMessage(subject: string, message: string): Promise<void> {
        try {
            await this.bullMQ.sendBullMQMessage(subject, JSON.parse(message));
            //console.log(`Queued message to ${subject}`);
        } catch (error) {
            console.error('Failed to queue message:', error);
            throw error;
        }
    }
}
