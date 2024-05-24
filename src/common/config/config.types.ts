export type RedisConfig = {
    host: string;
    port: number;
    options?: RedisOptions;
};

export type RedisOptions = {
    db?: number;
    collections?: string[];
    username?: string;
    password?: string;
    noDelay?: boolean;
    lazyConnect?: boolean;
};
