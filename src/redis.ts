import IORedis from 'ioredis';
import { config } from './config';
import { logger } from './logger';

export function createRedisConnection(): IORedis {
  const connection = new IORedis(config.redis.url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: false,
  });
  connection.on('connect', () => logger.info('Redis connected'));
  connection.on('error', (err) => logger.error({ err }, 'Redis error'));
  return connection;
}
