import { Injectable, Logger, OnModuleDestroy, OnModuleInit, Inject } from '@nestjs/common';
import { Queue, Worker, QueueEvents, Job, WorkerOptions } from 'bullmq';
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
        private eventEmitter: EventEmitter2
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

    createQueue(queueName: string): Queue {
        if (this.queues.has(queueName)) {
            return this.queues.get(queueName);
        }

        const queue = new Queue(queueName, {
            connection: this.redisDriver.client,
        });
        const events = new QueueEvents(queueName, { connection: this.redisDriver.client });

        events.on('completed', (jobId) => {
            this.logger.log(`Job ${jobId} has completed in queue ${queueName}`);
        });
        events.on('failed', (jobId, failedReason) => {
            this.logger.error(`Job ${jobId} has failed in queue ${queueName}: ${failedReason}`);
        });
        events.on('stalled', (jobId) => {
            this.logger.error(`Job ${jobId} is stalled in queue ${queueName}`);
        });

        this.queues.set(queueName, queue);
        this.queueEvents.set(queueName, events);
        this.logger.log(`Queue ${queueName} created`);
        return queue;
    }

    createWorker(queueName: string, callback: (job: Job) => Promise<void>): Worker {
        if (this.workers.has(queueName)) {
            return this.workers.get(queueName);
        }
        const workerOptions: WorkerOptions = {
            connection: this.redisDriver.client,
            lockDuration: 60000, // Extend lock duration as needed
            concurrency: 5 // Adjust based on load testing
        };
        const worker = new Worker(
            queueName,
            async (job: Job) => {
                try {
                    await this.processJobWithRateLimit(queueName, job, callback);
                } catch (error) {
                    this.logger.error(`Job ${job.id} processing failed in queue ${queueName}: ${error.message}`);
                }
            },
            workerOptions,
        );

        worker.on('completed', (job) => {
            this.logger.log(`Job ${job.id} has completed in queue ${queueName}`);
        });

        worker.on('failed', (job, err) => {
            this.logger.error(`Job ${job.id} has failed in queue ${queueName}: ${err.message}`);
        });

        worker.on('stalled', (job) => {
            this.logger.error(`Job ${job} is stalled in queue ${queueName}`);
        });

        this.workers.set(queueName, worker);
        this.logger.log(`Worker for queue ${queueName} created`);
        return worker;
    }

    private async processJobWithRateLimit(queueName: string, job: Job, callback: (job: Job) => Promise<void>) {
        const { chatId } = job.data;
        const now = Date.now();
        const jobKey = `chat:${chatId}:lastSendTime`;
        const countKey = `chat:${chatId}:messageCount`;
    
        const lastSendTime = await this.redisDriver.client.get(jobKey);
        const messageCount = await this.redisDriver.client.get(countKey);
        const timeElapsed = lastSendTime ? now - parseInt(lastSendTime) : 60000;
    
        this.logger.log(`Chat ${chatId} - Last send time: ${lastSendTime}, Message count: ${messageCount}, Time elapsed: ${timeElapsed}ms`);
    
        if (messageCount && parseInt(messageCount) >= 20 && timeElapsed < 60000) {
            const delay = 60000 - timeElapsed;
            this.logger.log(`Rate limit exceeded for chat ${chatId}. Rescheduling job ${job.id} for ${delay}ms`);
            await this.rescheduleJobWithDelay(queueName, job, delay);
        } else {
            await callback(job);
            if (timeElapsed >= 60000 || !lastSendTime) {
                await this.redisDriver.client.set(jobKey, now.toString());
                await this.redisDriver.client.set(countKey, '1');
                this.logger.log(`Reset rate limit for chat ${chatId}`);
            } else {
                await this.redisDriver.client.incr(countKey);
                this.logger.log(`Incremented message count for chat ${chatId}: ${await this.redisDriver.client.get(countKey)}`);
            }
        }
    }
    
    
    private async rescheduleJobWithDelay(queueName: string, job: Job, delay: number) {
        this.logger.log(`Rescheduling job ${job.id} with delay ${delay}ms`);
        const jobId: string = String(job.id);
        this.logger.log(`Type of job ID: ${typeof job.id}`);
        this.logger.log(`Type of job ID: ${typeof jobId}`);

        const queue = this.createQueue(queueName);
        await queue.add(job.name, job.data, {
            jobId: jobId, // Ensure the job ID is a string
            delay: delay,
            attempts: job.opts.attempts,
            backoff: {
                type: 'fixed',
                delay: delay
            }
        });
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
