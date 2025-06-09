/**
 * Authorization helper utilities
 *
 * Provides functions for checking user access to dealership resources.
 */

export interface AuthenticatedUser {
  dealership_id?: number;
  role?: string;
}

/**
 * Determine whether a user is authorized to access the given dealership.
 *
 * A user may access the dealership if they belong to the dealership or have the
 * `super_admin` role.
 *
 * @param user - The currently authenticated user
 * @param dealershipId - ID of the dealership being accessed
 * @returns `true` if the user can access the dealership
 *
 * @example
 * ```ts
 * if (!hasDealershipAccess(req.user, 42)) {
 *   return res.status(403).json({ error: 'Unauthorized' });
 * }
 * ```
 */
export function hasDealershipAccess(
  user: AuthenticatedUser | undefined,
  dealershipId: number,
): boolean {
  return (
    !!user &&
    (user.dealership_id === dealershipId || user.role === "super_admin")
  );
}
