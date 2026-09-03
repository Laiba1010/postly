import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { Logger, ValidationPipe } from '@nestjs/common';
import * as cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { CsrfGuard } from './common/guards/csrf.guard';

const logger = new Logger('Bootstrap');

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  app.setGlobalPrefix('api');
  app.enableCors({
    origin: configService.get<string>('CORS_ORIGIN'),
    credentials: true,
  });

  // Global Middleware & Pipes
  app.use(cookieParser());
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalGuards(new CsrfGuard(configService));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Database Connection
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
  await app.listen(port);
  logger.log(`API running on http://localhost:${port}/api`);
}

bootstrap();
