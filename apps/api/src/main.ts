import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

const logger = new Logger('Bootstrap');

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  app.setGlobalPrefix('api');
  app.enableCors({
    origin: configService.get<string>('CORS_ORIGIN'),
    credentials: true,
  });

  const connection = app.get<Connection>(getConnectionToken());
  if (connection.readyState === 1) {
    logger.log('MongoDB connected');
  } else {
    connection.once('connected', () => logger.log('MongoDB connected'));
  }
  connection.on('error', (err) =>
    logger.error(`MongoDB connection error: ${err.message}`),
  );

  const port = configService.get<number>('PORT') ?? 4000;
  app.useGlobalFilters(new AllExceptionsFilter());
  await app.listen(port);
  logger.log(`API running on http://localhost:${port}`);
}
bootstrap();
