import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { AllExceptionsFilter } from './../src/common/filters/all-exceptions.filter';
import { PrismaService } from './../src/prisma/prisma.service';
import { MailService } from './../src/mail/mail.service';

/**
 * Full account lifecycle (docs/PLAN.md §6 Phase 1):
 * register -> verify email -> login blocked (PENDING) -> manager approves
 * -> login OK -> refresh (rotation) -> old refresh rejected -> logout.
 */
describe('Auth & Users (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const email = `e2e_${Date.now()}@racehorse.test`;
  const password = 'Secret123!';
  const mail = {
    verifyTokens: [] as string[],
    resetTokens: [] as string[],
    sendVerifyEmail: (_to: string, _name: string, token: string) => {
      mail.verifyTokens.push(token);
      return Promise.resolve();
    },
    sendResetPassword: (_to: string, _name: string, token: string) => {
      mail.resetTokens.push(token);
      return Promise.resolve();
    },
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(MailService)
      .useValue(mail)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();

    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await app.close();
  });

  const api = () => request(app.getHttpServer());

  it('registers a PENDING user and sends a verify email', async () => {
    const res = await api()
      .post('/api/v1/auth/register')
      .send({ name: 'E2E User', email, password });
    expect(res.status).toBe(201);
    expect(mail.verifyTokens).toHaveLength(1);

    const user = await prisma.user.findUnique({ where: { email } });
    expect(user?.status).toBe('PENDING');
    expect(user?.role).toBeNull();
  });

  it('rejects duplicate registration with CONFLICT', async () => {
    const res = await api()
      .post('/api/v1/auth/register')
      .send({ name: 'Dupe', email, password });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('blocks login before email verification', async () => {
    const res = await api()
      .post('/api/v1/auth/login')
      .send({ email, password });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('EMAIL_NOT_VERIFIED');
  });

  it('verifies email with the emailed token', async () => {
    const res = await api()
      .get('/api/v1/auth/verify-email')
      .query({ token: mail.verifyTokens[0] });
    expect(res.status).toBe(200);
    const user = await prisma.user.findUnique({ where: { email } });
    expect(user?.emailVerifiedAt).not.toBeNull();
  });

  it('blocks login while still PENDING approval', async () => {
    const res = await api()
      .post('/api/v1/auth/login')
      .send({ email, password });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ACCOUNT_PENDING');
  });

  it('lets a MANAGER approve the user (role + ACTIVE)', async () => {
    const login = await api()
      .post('/api/v1/auth/login')
      .send({ email: 'manager@racehorse.local', password: 'Manager123!' });
    expect(login.status).toBe(201);
    const managerToken = login.body.accessToken as string;

    const target = await prisma.user.findUnique({ where: { email } });
    const res = await api()
      .patch(`/api/v1/users/${target!.id}`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ role: 'OWNER', status: 'ACTIVE' });
    expect(res.status).toBe(200);
    expect(res.body.role).toBe('OWNER');
    expect(res.body.status).toBe('ACTIVE');
  });

  it('non-manager cannot list users (FORBIDDEN)', async () => {
    const login = await api()
      .post('/api/v1/auth/login')
      .send({ email, password });
    const res = await api()
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${login.body.accessToken}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('logs in, refreshes (rotation), and rejects the reused token', async () => {
    const login = await api()
      .post('/api/v1/auth/login')
      .send({ email, password });
    expect(login.status).toBe(201);
    const firstRefresh = login.body.refreshToken as string;

    const me = await api()
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${login.body.accessToken}`);
    expect(me.body.email).toBe(email);

    const rotated = await api()
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: firstRefresh });
    expect(rotated.status).toBe(201);
    expect(rotated.body.refreshToken).not.toBe(firstRefresh);

    const reused = await api()
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: firstRefresh });
    expect(reused.status).toBe(401);
    expect(reused.body.error.code).toBe('TOKEN_INVALID');

    const logout = await api()
      .post('/api/v1/auth/logout')
      .send({ refreshToken: rotated.body.refreshToken });
    expect(logout.status).toBe(201);

    const afterLogout = await api()
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: rotated.body.refreshToken });
    expect(afterLogout.status).toBe(401);
  });
});
