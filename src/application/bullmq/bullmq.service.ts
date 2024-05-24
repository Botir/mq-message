import { Injectable, Logger, OnModuleDestroy, OnModuleInit, Inject } from '@nestjs/common';
import { Queue, Worker } from 'bullmq';
import { RedisDriver } from '@app/redis/redis.driver';
import { Application } from '@common/tokens';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class BullMQService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(BullMQService.name);
    private queues: Map<string, Queue> = new Map();
    private workers: Map<string, Worker> = new Map();

    constructor(
        @Inject(Application.Redis.Driver) private redisDriver: RedisDriver<any>,
        private eventEmitter: EventEmitter2,
    ) {
        this.logger.log('BullMQService constructor');
    }

    async onModuleInit() {
        this.logger.log('BullMQService onModuleInit');
        if (this.redisDriver.isConnected() === 'ready') {
            this.initializeBullMQ();
        } else {
            this.logger.log('Waiting for Redis connection...');
            this.eventEmitter.on('redis.ready', () => {
                this.initializeBullMQ();
            });
        }
    }

    private initializeBullMQ() {
        this.logger.log('Connected to Redis');
        this.eventEmitter.emit('bullmq.ready'); // Emit event when BullMQService is ready
        // Additional initialization logic if needed
    }

    createQueue(name: string) {
        if (this.queues.has(name)) {
            return this.queues.get(name);
        }
        const queue = new Queue(name, { connection: this.redisDriver.client });
        this.queues.set(name, queue);
        this.logger.log(`Queue ${name} created`);
        return queue;
    }

    async sendBullMQMessage(queueName: string, data: any) {
        if (this.redisDriver.isConnected() !== 'ready') {
            this.logger.error('Redis connection is not established.');
            return;
        }
        const queue = this.createQueue(queueName);
        await queue.add(queueName, data);
        this.logger.log(`Message sent to queue ${queueName}: ${JSON.stringify(data)}`);
    }

    subscribeToQueue(queueName: string, callback: (data: any) => void) {
        if (this.workers.has(queueName)) {
            return;
        }
        const worker = new Worker(
            queueName,
            async (job) => {
                callback(job.data);
            },
            { connection: this.redisDriver.client },
        );

        this.workers.set(queueName, worker);

        worker.on('completed', (job) => {
            this.logger.log(`Job ${job.id} has completed`);
        });

        worker.on('failed', (job, err) => {
            this.logger.error(`Job ${job.id} has failed: ${err.message}`);
        });

        this.logger.log(`Worker for queue ${queueName} created`);
    }

    async onModuleDestroy() {
        for (const [name, worker] of this.workers) {
            await worker.close();
            this.logger.log(`Worker for queue ${name} closed`);
        }
        for (const [name, queue] of this.queues) {
            await queue.close();
            this.logger.log(`Queue ${name} closed`);
        }
        this.logger.log('BullMQ service cleanup completed');
    }
}
