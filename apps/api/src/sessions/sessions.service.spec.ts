import { SessionsService } from './sessions.service';

describe('SessionsService', () => {
  function createRedis(options?: { conflictOnFirstExec?: boolean }) {
    const values = new Map<string, string>();
    let execCount = 0;

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
      watch: jest.fn(async () => 'OK'),
      unwatch: jest.fn(async () => 'OK'),
      multi: jest.fn(() => {
        const commands: Array<[string, string, string, string, number]> = [];

        const transaction = {
          set: jest.fn(
            (
              key: string,
              value: string,
              mode: string,
              ttlMode: string,
              ttl: number,
            ) => {
              commands.push(['set', key, value, `${mode}:${ttlMode}`, ttl]);
              return transaction;
            },
          ),
          exec: jest.fn(async () => {
            execCount += 1;

            if (options?.conflictOnFirstExec && execCount === 1) {
              values.set('session-version:user-1', '1');
              return null;
            }

            for (const [command, key, value] of commands) {
              if (command === 'set') {
                values.set(key, value);
              }
            }

            return commands.map(() => ['OK']);
          }),
        };

        return transaction;
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

  it('retries session creation when user-session invalidation wins the race', async () => {
    const redis = createRedis({ conflictOnFirstExec: true });
    const service = new SessionsService(redis as any);

    const token = await service.createSession('user-1');
    const fingerprint = service.getFingerprint(token);
    const raw = redis.values.get(`session:${fingerprint}`);

    expect(raw).toBeDefined();
    expect(JSON.parse(raw!).version).toBe(1);
    expect(redis.multi).toHaveBeenCalledTimes(2);
  });
});
