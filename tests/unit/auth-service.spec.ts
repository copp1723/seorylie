import { describe, it, expect, vi } from 'vitest';

vi.mock('../../server/db', () => ({ db: null }));
vi.mock('bcrypt', () => ({
  default: { compare: vi.fn(), hash: vi.fn() },
}));
vi.mock('../../server/config/config-manager', () => ({
  configManager: {
    getSection: () => ({ jwtSecret: 's', jwtExpiresIn: '1h', bcryptRounds: 1, magicLinkExpiresIn: 60 })
  }
}));

import { AuthService } from '../../server/services/auth-service';

describe('AuthService null db checks', () => {
  it('should throw when db is not initialized', async () => {
    const service = new AuthService({ name: 'AuthServiceTest' });
    await expect(
      service.login({ email: 'test@example.com', password: 'secret' })
    ).rejects.toThrow('Database not initialized');
  });
});
