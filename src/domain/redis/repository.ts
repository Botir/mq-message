export interface RedisRepository<T> {
    get(key: string | string[]): Promise<T | null>;
    set(key: string, value: T, expire: number): Promise<string | void>;
}
