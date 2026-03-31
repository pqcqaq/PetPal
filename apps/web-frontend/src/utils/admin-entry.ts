export const CONSOLE_NAMESPACE = '/console' as const;
export const PETPAL_ADMIN_NAMESPACE = '/petpal-admin' as const;

export const petpalAdminPermissions = [
  'petpal.complaint.read',
  'petpal.complaint.manage',
  'petpal.caregiver.audit',
  'petpal.callback-audit.read',
  'petpal.callback-alert.read',
] as const;

export const hasPetPalAdminAccess = (permissions: string[]) => (
  petpalAdminPermissions.some((permission) => permissions.includes(permission))
);

export const resolvePreferredAdminEntry = (
  permissions: string[],
  consoleHomePath?: string,
) => (
  hasPetPalAdminAccess(permissions)
    ? PETPAL_ADMIN_NAMESPACE
    : (consoleHomePath || CONSOLE_NAMESPACE)
);
