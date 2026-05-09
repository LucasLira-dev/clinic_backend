import { Injectable } from '@nestjs/common';
import { Redis } from '@upstash/redis';

@Injectable()
export class RedisService {
    private redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL!,
        token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });

    async get<T>(key: string): Promise<T | null> {
        return await this.redis.get(key);
    }

    async set(key: string, value: any, ttl?: number) {
        if (ttl) {
            await this.redis.set(key, value, { ex: ttl });        
        } else {
            await this.redis.set(key, value);
        }
    }

    async del(key: string) {
        await this.redis.del(key);
    }
}
