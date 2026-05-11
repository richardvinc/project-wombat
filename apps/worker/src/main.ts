import { NestFactory } from '@nestjs/core';
import pino from 'pino';
import { WorkerAppModule } from './worker-app.module';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(WorkerAppModule);
  const logger = pino({
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
        singleLine: true,
      },
    },
  });

  app.enableShutdownHooks();
  logger.info({
    type: 'bootstrap',
    message: 'BullMQ worker is running.',
  });
}

bootstrap();
