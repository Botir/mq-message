export const Application = {
    BullMQ: {
        Config: Symbol.for('BullMQ'),
        Driver: Symbol.for('BullMQ'),
    },
    Redis: {
        Config: Symbol.for('RedisConfig'),
        Driver: Symbol.for('RedisDriver'),
    },
};
