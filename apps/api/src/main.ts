import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import pino from 'pino';
import { AppModule } from './app/app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const httpApp = app.getHttpAdapter().getInstance();
  const configService = app.get(ConfigService);
  const globalPrefix = 'api';
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

  // track request time
  app.use((req, res, next) => {
    const startedAt = Date.now();

    res.on('finish', () => {
      logger.info({
        type: 'http',
        method: req.method,
        path: req.originalUrl,
        statusCode: res.statusCode,
        durationMs: Date.now() - startedAt,
      });
    });

    next();
  });

  app.setGlobalPrefix(globalPrefix);
  const port = configService.get<number>('API_PORT', 3000);
  await app.listen(port);
  logger.info({
    type: 'bootstrap',
    message: `Application is running on: http://localhost:${port}/${globalPrefix}`,
  });
}

bootstrap();
