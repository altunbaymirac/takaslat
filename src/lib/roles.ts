const ADMIN_ROLES = ['admin', 'moderator'];

/** Platform yönetim yetkisi (admin veya moderatör) var mı? */
export function isPlatformAdmin(role?: string | null) {
  return ADMIN_ROLES.includes(role?.toLowerCase() ?? '');
}
