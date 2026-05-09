import { Injectable } from '@nestjs/common';
import { Redis } from '@upstash/redis';

@Injectable()
export class RedisService {
  private redis: Redis;

  constructor() {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!url || !token) {
      throw new Error(
        'Missing required environment variables: UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN',
      );
    }

    this.redis = new Redis({ url, token });
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      return await this.redis.get(key);
    } catch (error) {
      console.error(`Redis GET error for key "${key}":`, error);
      return null;
    }
  }

  async set(key: string, value: any, ttl?: number) {
    try {
      if (ttl) {
        await this.redis.set(key, value, { ex: ttl });
      } else {
        await this.redis.set(key, value);
      }
    } catch (error) {
      console.error(`Redis SET error for key "${key}":`, error);
    }
  }

  async del(key: string): Promise<number> {
    try {
      return await this.redis.del(key);
    } catch (error) {
      console.error(`Redis DEL error for key "${key}":`, error);
      return 0;
    }
  }
}
