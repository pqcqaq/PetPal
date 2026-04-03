export const CONSOLE_NAMESPACE = '/console' as const;
export const PETPAL_ADMIN_NAMESPACE = '/petpal-admin' as const;

export const petpalAdminPermissions = [
  'petpal.complaint.read',
  'petpal.complaint.manage',
  'petpal.penalty.read',
  'petpal.penalty.manage',
  'petpal.caregiver.audit',
  'petpal.callback-audit.read',
  'petpal.callback-alert.read',
  'petpal.rule.read',
  'petpal.rule.publish',
] as const;

export const hasPetPalAdminAccess = (permissions: string[]) => (
  petpalAdminPermissions.some((permission) => permissions.includes(permission))
);

export const canAccessRouteByPermissionMeta = (
  permissions: string[],
  meta: {
    permission?: unknown;
    permissionAny?: unknown;
  },
) => {
  if (typeof meta.permission === 'string' && !permissions.includes(meta.permission)) {
    return false;
  }

  if (
    Array.isArray(meta.permissionAny)
    && meta.permissionAny.length > 0
    && !meta.permissionAny.some((permission) => (
      typeof permission === 'string' && permissions.includes(permission)
    ))
  ) {
    return false;
  }

  return true;
};

export const resolvePreferredAdminEntry = (
  permissions: string[],
  consoleHomePath?: string,
) => (
  hasPetPalAdminAccess(permissions)
    ? PETPAL_ADMIN_NAMESPACE
    : (consoleHomePath || CONSOLE_NAMESPACE)
);
