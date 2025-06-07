import { hasDealershipAccess } from '../../server/utils/helpers/permissions';

describe('hasDealershipAccess', () => {
  test('returns false when user is undefined', () => {
    expect(hasDealershipAccess(undefined, 1)).toBe(false);
  });

  test('returns true for matching dealership', () => {
    const user = { dealership_id: 5, role: 'manager' };
    expect(hasDealershipAccess(user, 5)).toBe(true);
  });

  test('returns true for super admin', () => {
    const user = { dealership_id: 2, role: 'super_admin' };
    expect(hasDealershipAccess(user, 5)).toBe(true);
  });

  test('returns false for mismatched dealership', () => {
    const user = { dealership_id: 3, role: 'manager' };
    expect(hasDealershipAccess(user, 5)).toBe(false);
  });
});
