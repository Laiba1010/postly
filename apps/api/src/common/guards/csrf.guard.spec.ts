import { ExecutionContext } from '@nestjs/common';
import { CsrfGuard } from './csrf.guard';

describe('CsrfGuard', () => {
  const guard = new CsrfGuard({
    get: () => 'https://app.example.com',
  } as any);

  const contextFor = (method: string, headers: Record<string, string>) =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ method, headers }),
      }),
    }) as ExecutionContext;

  it('allows an exact configured origin', () => {
    expect(
      guard.canActivate(
        contextFor('POST', { origin: 'https://app.example.com' }),
      ),
    ).toBe(true);
  });

  it('rejects a malicious origin that only starts with the allowed origin', () => {
    expect(() =>
      guard.canActivate(
        contextFor('POST', {
          origin: 'https://app.example.com.attacker.example',
        }),
      ),
    ).toThrow('Request origin not allowed');
  });

  it('allows a same-origin referer when Origin is absent', () => {
    expect(
      guard.canActivate(
        contextFor('POST', {
          referer: 'https://app.example.com/settings/profile',
        }),
      ),
    ).toBe(true);
  });

  it('rejects unsafe requests with no trustworthy origin information', () => {
    expect(() => guard.canActivate(contextFor('POST', {}))).toThrow(
      'Request origin not allowed',
    );
  });

  it('does not apply origin validation to safe methods', () => {
    expect(guard.canActivate(contextFor('GET', {}))).toBe(true);
  });
});
