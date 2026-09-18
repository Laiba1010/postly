import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { CsrfGuard } from '../src/common/guards/csrf.guard';
import request from 'supertest';
import { User } from './../src/users/schemas/user.schema';

jest.setTimeout(30000);
process.env.NODE_ENV = 'test';
process.env.PORT = process.env.PORT ?? '3001';
process.env.DATABASE_URL =
  process.env.DATABASE_URL ?? 'mongodb://localhost:27017/postly?replicaSet=rs0';
process.env.REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
process.env.SESSION_SECRET =
  process.env.SESSION_SECRET ?? 'test-session-secret-at-least-32-characters';
process.env.TOKEN_ENCRYPTION_KEY =
  process.env.TOKEN_ENCRYPTION_KEY ??
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
process.env.CORS_ORIGIN = process.env.CORS_ORIGIN ?? 'http://localhost:3000';

describe('Authentication (e2e)', () => {
  let app: INestApplication;
  let userModel: any;
  const origin = process.env.CORS_ORIGIN!;
  const email = `phase2-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;

  beforeAll(async () => {
    // AppModule evaluates configuration during module initialization, so import it
    // only after the test environment defaults above have been established.
    const { AppModule } = await import('../src/app.module');

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableCors({ origin, credentials: true });
    app.use(cookieParser());
    const configService = app.get(ConfigService);
    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalGuards(new CsrfGuard(configService));
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    userModel = app.get(getModelToken(User.name));
    await app.init();
  });

  afterAll(async () => {
    if (userModel) await userModel.deleteMany({ email });
    if (app) await app.close();
  });

  it('supports signup → /auth/me → logout → rejected /auth/me', async () => {
    const agent = request.agent(app.getHttpServer());

    await agent
      .post('/api/auth/signup')
      .set('Origin', origin)
      .send({ name: 'Phase Two User', email, password: 'Password123' })
      .expect(201)
      .expect(({ body }) => {
        expect(body.user).toEqual({
          id: expect.any(String),
          name: 'Phase Two User',
          email,
        });
      });

    await agent
      .get('/api/auth/me')
      .expect(200)
      .expect(({ body }) => {
        expect(body.user.email).toBe(email);
      });

    await agent
      .post('/api/auth/logout')
      .set('Origin', origin)
      .expect(200)
      .expect(({ body }) => expect(body).toEqual({ success: true }));

    await agent
      .get('/api/auth/me')
      .expect(401)
      .expect(({ body }) => expect(body.code).toBe('UNAUTHENTICATED'));
  });

  it('returns a conflict when concurrent requests create the same email', async () => {
    const raceEmail = `phase2-race-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
    const [first, second] = await Promise.all([
      request(app.getHttpServer())
        .post('/api/auth/signup')
        .set('Origin', origin)
        .send({ name: 'Race One', email: raceEmail, password: 'Password123' }),
      request(app.getHttpServer())
        .post('/api/auth/signup')
        .set('Origin', origin)
        .send({ name: 'Race Two', email: raceEmail, password: 'Password123' }),
    ]);

    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([201, 409]);
    expect([first.body.code, second.body.code]).toContain(
      'EMAIL_ALREADY_EXISTS',
    );
    await userModel.deleteMany({ email: raceEmail });
  });
});
