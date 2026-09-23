import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { AllExceptionsFilter } from './../src/common/filters/all-exceptions.filter';
import { PrismaService } from './../src/prisma/prisma.service';

/**
 * Phase 8 — Incidents. Covers incident CRUD + ownership, forward-only status,
 * healthRecordId validation, and the auto-lock (HIGH on create) / auto-unlock
 * (RESOLVED while locked) sync with Training Lock (Phase 7).
 * See docs/specs/phase-8-health-injury.md §9.
 */
describe('Incidents (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const tokens: Record<string, string> = {};
  let owner1Id: string;
  let horseId: string; // will be auto-locked by the HIGH incident
  let lowIncidentId: string;
  let highIncidentId: string;

  const api = () => request(app.getHttpServer());
  const auth = (who: string) => ({ Authorization: `Bearer ${tokens[who]}` });

  const login = async (email: string, password: string): Promise<string> => {
    const res = await api()
      .post('/api/v1/auth/login')
      .send({ email, password });
    expect(res.status).toBe(201);
    return res.body.accessToken as string;
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

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

    tokens.manager = await login('manager@racehorse.local', 'Manager123!');
    tokens.groom = await login('groom@racehorse.local', 'Groom123!');
    tokens.vet = await login('vet@racehorse.local', 'Vet123!');
    tokens.trainer = await login('trainer@racehorse.local', 'Trainer123!');
    tokens.owner1 = await login('owner1@racehorse.local', 'Owner123!');
    tokens.owner2 = await login('owner2@racehorse.local', 'Owner123!');

    owner1Id = (
      await prisma.user.findUniqueOrThrow({
        where: { email: 'owner1@racehorse.local' },
      })
    ).id;

    const horse = await api()
      .post('/api/v1/horses')
      .set(auth('manager'))
      .send({ name: 'E2E Incident Horse', ownerId: owner1Id });
    horseId = horse.body.id;
  });

  afterAll(async () => {
    await prisma.incidentReport.deleteMany({ where: { horseId } });
    // Notifications reference no horseId — clean up by message text (covers
    // both owner1's copy and every MANAGER's copy).
    await prisma.notification.deleteMany({
      where: { message: { contains: 'E2E Incident Horse' } },
    });
    await prisma.horse.deleteMany({ where: { id: horseId } });
    await app.close();
  });

  it('GROOM reports a LOW incident (201), horse stays unlocked', async () => {
    const res = await api()
      .post(`/api/v1/horses/${horseId}/incidents`)
      .set(auth('groom'))
      .send({ description: 'Minor scrape', severity: 'LOW' });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('OPEN');
    lowIncidentId = res.body.id;

    const horse = await api()
      .get(`/api/v1/horses/${horseId}`)
      .set(auth('manager'));
    expect(horse.body.locked).toBe(false);
  });

  it('rejects an incident without description (400)', async () => {
    const res = await api()
      .post(`/api/v1/horses/${horseId}/incidents`)
      .set(auth('groom'))
      .send({ severity: 'LOW' });
    expect(res.status).toBe(400);
  });

  it('VET/TRAINER/OWNER cannot report an incident (403)', async () => {
    for (const who of ['vet', 'trainer', 'owner1']) {
      const res = await api()
        .post(`/api/v1/horses/${horseId}/incidents`)
        .set(auth(who))
        .send({ description: 'x', severity: 'LOW' });
      expect(res.status).toBe(403);
    }
  });

  it('reporting on an unknown horse is 404', async () => {
    const res = await api()
      .post('/api/v1/horses/00000000-0000-0000-0000-000000000000/incidents')
      .set(auth('groom'))
      .send({ description: 'x', severity: 'LOW' });
    expect(res.status).toBe(404);
  });

  it('GROOM reports a HIGH incident — auto-locks the horse (201)', async () => {
    const res = await api()
      .post(`/api/v1/horses/${horseId}/incidents`)
      .set(auth('groom'))
      .send({ description: 'Fall during transport', severity: 'HIGH' });
    expect(res.status).toBe(201);
    highIncidentId = res.body.id;

    const horse = await api()
      .get(`/api/v1/horses/${horseId}`)
      .set(auth('manager'));
    expect(horse.body.locked).toBe(true);
    expect(horse.body.lockReason).toContain('Fall during transport');
  });

  it('owner1 sees incidents for their horse; owner2 is forbidden', async () => {
    const mine = await api()
      .get(`/api/v1/horses/${horseId}/incidents`)
      .set(auth('owner1'));
    expect(mine.status).toBe(200);
    expect(mine.body.data.length).toBe(2);

    const notMine = await api()
      .get(`/api/v1/horses/${horseId}/incidents`)
      .set(auth('owner2'));
    expect(notMine.status).toBe(403);
  });

  it('GET /incidents/:id enforces ownership + 404', async () => {
    const ok = await api()
      .get(`/api/v1/incidents/${lowIncidentId}`)
      .set(auth('owner1'));
    expect(ok.status).toBe(200);

    const forbidden = await api()
      .get(`/api/v1/incidents/${lowIncidentId}`)
      .set(auth('owner2'));
    expect(forbidden.status).toBe(403);

    const missing = await api()
      .get('/api/v1/incidents/00000000-0000-0000-0000-000000000000')
      .set(auth('manager'));
    expect(missing.status).toBe(404);
  });

  it('VET moves the HIGH incident to IN_PROGRESS (200)', async () => {
    const res = await api()
      .patch(`/api/v1/incidents/${highIncidentId}`)
      .set(auth('vet'))
      .send({ status: 'IN_PROGRESS' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('IN_PROGRESS');
  });

  it('rejects moving status backward (400)', async () => {
    const res = await api()
      .patch(`/api/v1/incidents/${highIncidentId}`)
      .set(auth('vet'))
      .send({ status: 'OPEN' });
    expect(res.status).toBe(400);
  });

  it('GROOM/TRAINER cannot PATCH an incident (403)', async () => {
    for (const who of ['groom', 'trainer']) {
      const res = await api()
        .patch(`/api/v1/incidents/${highIncidentId}`)
        .set(auth(who))
        .send({ status: 'RESOLVED' });
      expect(res.status).toBe(403);
    }
  });

  it('rejects a healthRecordId for a different horse (400)', async () => {
    const otherRecord = await prisma.healthRecord.findFirst({
      where: { horseId: { not: horseId } },
    });
    expect(otherRecord).toBeTruthy();
    const res = await api()
      .patch(`/api/v1/incidents/${highIncidentId}`)
      .set(auth('vet'))
      .send({ healthRecordId: otherRecord!.id });
    expect(res.status).toBe(400);
  });

  it('VET resolves the HIGH incident — auto-unlocks the horse (200)', async () => {
    const res = await api()
      .patch(`/api/v1/incidents/${highIncidentId}`)
      .set(auth('vet'))
      .send({ status: 'RESOLVED' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('RESOLVED');

    const horse = await api()
      .get(`/api/v1/horses/${horseId}`)
      .set(auth('manager'));
    expect(horse.body.locked).toBe(false);
    expect(horse.body.lockReason).toBeNull();
  });

  it('PATCH on an already-RESOLVED incident is 400', async () => {
    const res = await api()
      .patch(`/api/v1/incidents/${highIncidentId}`)
      .set(auth('vet'))
      .send({ status: 'RESOLVED' });
    expect(res.status).toBe(400);
  });

  it('resolving the LOW incident (never locked) succeeds without error', async () => {
    const res = await api()
      .patch(`/api/v1/incidents/${lowIncidentId}`)
      .set(auth('vet'))
      .send({ status: 'RESOLVED' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('RESOLVED');
  });
});
