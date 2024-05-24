import { Inject, Injectable } from '@nestjs/common';
import { Application } from '@common/tokens';

@Injectable()
export class TaskService {
    constructor() {}

    async processTasks(): Promise<void> {
        this.subscribeToMessages();
    }

    private subscribeToMessages() {
        console.log('Message received from BullMQ:');
    }
}
