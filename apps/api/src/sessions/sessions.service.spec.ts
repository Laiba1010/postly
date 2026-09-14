import { SessionsService } from './sessions.service';

describe('SessionsService', () => {
  function createRedis() {
    const values = new Map<string, string>();
    return {
      values,
      get: jest.fn(async (key: string) => values.get(key) ?? null),
      set: jest.fn(async (key: string, value: string) => {
        values.set(key, value);
        return 'OK';
      }),
      del: jest.fn(async (key: string) => {
        values.delete(key);
        return 1;
      }),
      incr: jest.fn(async (key: string) => {
        const next = Number(values.get(key) ?? '0') + 1;
        values.set(key, String(next));
        return next;
      }),
    };
  }

  it('invalidates existing sessions by user version', async () => {
    const redis = createRedis();
    const service = new SessionsService(redis as any);

    const token = await service.createSession('user-1');
    expect(await service.getSession(token)).not.toBeNull();

    await service.invalidateUserSessions('user-1');

    expect(await service.getSession(token)).toBeNull();
  });

  it('stores the current session version when a new session is created', async () => {
    const redis = createRedis();
    const service = new SessionsService(redis as any);

    await service.invalidateUserSessions('user-1');
    const token = await service.createSession('user-1');
    const fingerprint = service.getFingerprint(token);
    const raw = redis.values.get(`session:${fingerprint}`);

    expect(raw).toBeDefined();
    expect(JSON.parse(raw!).version).toBe(1);
  });
});
