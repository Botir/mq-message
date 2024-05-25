import { Injectable, Logger, OnModuleDestroy, OnModuleInit, Inject } from '@nestjs/common';
import { Queue, Worker, QueueEvents, Job } from 'bullmq';
import { RedisDriver } from '@app/redis/redis.driver';
import { Application } from '@common/tokens';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class BullMQService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(BullMQService.name);
    private queues: Map<string, Queue> = new Map();
    private workers: Map<string, Worker> = new Map();
    private queueEvents: Map<string, QueueEvents> = new Map();

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
    }

    createQueue(name: string) {
        if (this.queues.has(name)) {
            return this.queues.get(name);
        }
        const queue = new Queue(name, { connection: this.redisDriver.client });
        const events = new QueueEvents(name, { connection: this.redisDriver.client });

        events.on('completed', (job: any) => {
            this.logger.log(`Job ${job.jobId} has completed in queue`);
        });
        events.on('failed', (job: any, failedReason) => {
            this.logger.error(`Job ${job.jobId} has failed in queue: ${failedReason}`);
        });
        events.on('stalled', (job: any) => {
            this.logger.error(`Job ${job.jobId} is stalled in queue`);
        });

        this.queues.set(name, queue);
        this.queueEvents.set(name, events);
        this.logger.log(`Queue ${name} created`);
        return queue;
    }

    async sendBullMQMessage(queueName: string, data: any, options = {}) {
        if (this.redisDriver.isConnected() !== 'ready') {
            this.logEvent('error', 'Redis connection is not established.');
            return;
        }
        const queue = this.createQueue(queueName);
        try {
            await queue.add(queueName, data, {
                attempts: 5,
                backoff: {
                    type: 'exponential',
                    delay: 1000
                },
                ...options
            });
            this.logEvent('log', `Message sent to queue ${queueName}: ${JSON.stringify(data)}`);
        } catch (error) {
            this.logEvent('error', `Failed to send message to queue ${queueName}: ${error.message}`);
        }
    }

    subscribeToOrderQueue(queueName: string, callback: (data: any) => void) {
        if (!this.workers.has(queueName)) {
            const worker = new Worker(
                queueName,
                async (job: Job) => {
                    try {
                        await this.processJob(job, callback, queueName);
                    } catch (error) {
                        this.logger.error(`Error processing job ${job.id}: ${error.message}`);
                        await job.moveToFailed(new Error(error.message), job.token);
                    }
                },
                { connection: this.redisDriver.client }
            );

            this.workers.set(queueName, worker);
            worker.on('completed', (job) => this.logger.log(`Job ${job.id} has truly completed`));
            worker.on('failed', (job, err) => this.logger.error(`Job ${job.id} has failed: ${err.message}`));
            this.logger.log(`Worker for queue ${queueName} created`);
        }
    }

    async processJob(job: Job, callback: (data: any) => void, queueName: string) {
        const chatId = job.data.chatId as string;
        const isPrivate = job.data.isPrivate as boolean;
        const personalLimit = isPrivate ? 30 : 20;
        const personalKey = `rate_limit:${queueName}:${chatId}`;

        const globalKey = `rate_limit:global:per_second`;
        const globalCount = await this.redisDriver.client.incr(globalKey);
        if (globalCount === 1) {
            await this.redisDriver.client.expire(globalKey, 1);
        }
        if (globalCount > 30) {
            const delay = 1000;
            this.logger.log(`Global rate limit exceeded, requeuing job ${job.id} with a delay of ${delay}ms.`);
            await this.sendBullMQMessage(queueName, job.data, { delay });
            await job.discard();
            return;
        }

        const currentPersonalCount = await this.redisDriver.client.incr(personalKey);
        if (currentPersonalCount === 1) {
            await this.redisDriver.client.expire(personalKey, 60);
        }
        if (currentPersonalCount > personalLimit) {
            const delay = 1000;
            this.logger.log(`Personal rate limit exceeded for chat ${chatId}, requeuing job ${job.id} with a delay of ${delay}ms.`);
            await this.sendBullMQMessage(queueName, job.data, { delay });
            await job.discard();
            return;
        }
        try {
            await callback(job.data);
            await job.updateProgress(100);
        } catch (error) {
            this.logger.error(`Job ${job.id} processing failed: ${error.message}`);
            await job.moveToFailed(new Error(error.message), job.token);
        }        
    }

    async onModuleDestroy() {
        for (const [name, worker] of this.workers) {
            try {
                await worker.close();
                this.logger.log(`Worker for queue ${name} closed`);
            } catch (error) {
                this.logger.error(`Failed to close worker for queue ${name}: ${error.message}`);
            }
        }
        for (const [name, queue] of this.queues) {
            try {
                await queue.close();
                this.logger.log(`Queue ${name} closed`);
            } catch (error) {
                this.logger.error(`Failed to close queue ${name}: ${error.message}`);
            }
        }
        for (const [name, events] of this.queueEvents) {
            try {
                await events.close();
                this.logger.log(`Events for queue ${name} closed`);
            } catch (error) {
                this.logger.error(`Failed to close events for queue ${name}: ${error.message}`);
            }
        }
        this.logger.log('BullMQ service cleanup completed');
    }

    private logEvent(level: 'log' | 'error', message: string) {
        if (level === 'log') {
            this.logger.log(message);
        } else {
            this.logger.error(message);
        }
    }
    
}
