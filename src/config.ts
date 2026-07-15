import 'dotenv/config';

export const config = {
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  email: {
    user: process.env.GMAIL_USER || '',
    pass: process.env.GMAIL_APP_PASSWORD || '',
    from: process.env.GMAIL_FROM || process.env.GMAIL_USER || 'noreply@selfless.io',
  },
  db: {
    url: process.env.DATABASE_URL || '',
  },
  api: {
    baseUrl: process.env.API_BASE_URL || 'http://localhost:4000',
    serviceToken: process.env.WORKER_SERVICE_TOKEN || '',
  },
  nodeEnv: process.env.NODE_ENV || 'development',
};
