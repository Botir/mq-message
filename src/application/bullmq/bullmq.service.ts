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
        const queue = new Queue(name, {
            connection: this.redisDriver.client,
        });
        const events = new QueueEvents(name, { connection: this.redisDriver.client });
        events.on('completed', (jobId) => {
            this.logger.log(`Job ${jobId} has completed`);
        });
        events.on('failed', (jobId, failedReason) => {
            this.logger.error(`Job ${jobId} has failed: ${failedReason}`);
        });
        this.queues.set(name, queue);
        this.queueEvents.set(name, events);
        this.logger.log(`Queue ${name} created`);
        return queue;
    }

    async sendBullMQMessage(queueName: string, data: any) {
        if (this.redisDriver.isConnected() !== 'ready') {
            this.logger.error('Redis connection is not established.');
            return;
        }
        const queue = this.createQueue(queueName);
        await queue.add(queueName, data, {
            attempts: 5, // Retry up to 5 times
            backoff: {
                type: 'fixed',
                delay: 1000, // Retry after 1 second
            },
        });
        this.logger.log(`Message sent to queue ${queueName}: ${JSON.stringify(data)}`);
    }

    subscribeToQueue(queueName: string, callback: (data: any) => void) {
        if (this.workers.has(queueName)) {
            return;
        }
        const worker = new Worker(
            queueName,
            async (job: Job) => {
                try {
                    await callback(job.data);
                    await job.updateProgress(100); // Update progress to 100%
                    console.log('HELLO');
                    // await job.moveToCompleted('done', job.token, true); // Correct parameters
                } catch (error) {
                    this.logger.error(`Job ${job.id} processing failed: ${error.message}`);
                    await job.moveToFailed(new Error(error.message), job.token);
                }
            },
            {
                connection: this.redisDriver.client,
                limiter: {
                    max: 30, // maximum 30 jobs per second
                    duration: 1000, // per second
                },
            },
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
        for (const [name, events] of this.queueEvents) {
            await events.close();
            this.logger.log(`Events for queue ${name} closed`);
        }
        this.logger.log('BullMQ service cleanup completed');
    }
}
