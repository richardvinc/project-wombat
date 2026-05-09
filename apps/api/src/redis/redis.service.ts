import { Inject, Injectable, OnApplicationShutdown } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.constants';

@Injectable()
export class RedisService implements OnApplicationShutdown {
  constructor(@Inject(REDIS_CLIENT) private readonly client: Redis) {}

  getClient(): Redis {
    return this.client;
  }

  async ping(): Promise<string> {
    return this.client.ping();
  }

  async deleteByPatterns(patterns: string[]): Promise<number> {
    // Use an unprefixed client here because SCAN/UNLINK operate on full stored
    // Redis keys. Reusing the main prefixed client would prepend the key prefix
    // again during UNLINK and miss the intended keys.
    // yeah, I use AI for this.
    const rawClient = this.client.duplicate({
      keyPrefix: '',
      lazyConnect: true,
    });
    let deleted = 0;

    try {
      await rawClient.connect();

      for (const pattern of patterns) {
        let cursor = '0';

        do {
          const [nextCursor, keys] = await rawClient.scan(
            cursor,
            'MATCH',
            pattern,
            'COUNT',
            '100',
          );

          cursor = nextCursor;

          if (keys.length > 0) {
            deleted += Number(await rawClient.unlink(...keys));
          }
        } while (cursor !== '0');
      }
    } finally {
      rawClient.disconnect();
    }

    return deleted;
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.client.status !== 'end') {
      await this.client.quit();
    }
  }
}
