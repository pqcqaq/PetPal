import {
  REALTIME_TOPICS,
  type RbacUpdatedPayload,
  type RealtimeSyncTarget,
} from '@rbac/api-common';
import type { Router } from 'vue-router';
import { watch } from 'vue';
import { wsClient } from '@/api/client';
import { useAuthStore } from '@/stores/auth';
import { useMenuStore } from '@/stores/menus';
import { useWorkbenchStore } from '@/stores/workbench';
import { pinia } from '@/stores';
import {
  canAccessRouteByPermissionMeta,
  CONSOLE_NAMESPACE,
  hasPetPalAdminAccess,
  PETPAL_ADMIN_NAMESPACE,
  resolvePreferredAdminEntry,
} from '@/utils/admin-entry';

const SYNC_DEBOUNCE_MS = 120;

const hasStatus = (error: unknown): error is { status: number } =>
  typeof error === 'object'
  && error !== null
  && typeof Reflect.get(error, 'status') === 'number';

const getDefaultTargets = (): RealtimeSyncTarget[] => ['menus', 'user'];

export const installAdminRealtimeSync = (router: Router) => {
  const auth = useAuthStore(pinia);
  const menus = useMenuStore(pinia);
  const workbench = useWorkbenchStore(pinia);
  const pendingTargets = new Set<RealtimeSyncTarget>();
  let syncTimer: ReturnType<typeof setTimeout> | null = null;
  let syncInFlight = false;
  let rerunRequested = false;
  let stopTopicSubscription: (() => void) | null = null;

  const clearSyncTimer = () => {
    if (!syncTimer) {
      return;
    }

    clearTimeout(syncTimer);
    syncTimer = null;
  };

  const isConsoleTarget = (path: string) =>
    path === CONSOLE_NAMESPACE || path.startsWith(`${CONSOLE_NAMESPACE}/`);

  const isPetPalAdminTarget = (path: string) =>
    path === PETPAL_ADMIN_NAMESPACE || path.startsWith(`${PETPAL_ADMIN_NAMESPACE}/`);

  const reconcileAdminRoute = async () => {
    const currentRoute = router.currentRoute.value;
    if (!auth.isAuthenticated) {
      return;
    }

    const preferredAdminEntry = resolvePreferredAdminEntry(auth.permissions, menus.homePath);

    if (isConsoleTarget(currentRoute.path)) {
      if (currentRoute.path === CONSOLE_NAMESPACE) {
        if (preferredAdminEntry !== CONSOLE_NAMESPACE) {
          await router.replace(preferredAdminEntry);
        }
        return;
      }

      if (!menus.hasPagePath(currentRoute.path)) {
        await router.replace(preferredAdminEntry);
        return;
      }

      if (!canAccessRouteByPermissionMeta(auth.permissions, currentRoute.meta)) {
        await router.replace(preferredAdminEntry);
      }
      return;
    }

    if (!isPetPalAdminTarget(currentRoute.path)) {
      return;
    }

    if (!hasPetPalAdminAccess(auth.permissions)) {
      await router.replace(preferredAdminEntry);
      return;
    }

    if (currentRoute.path === PETPAL_ADMIN_NAMESPACE) {
      return;
    }

    if (!canAccessRouteByPermissionMeta(auth.permissions, currentRoute.meta)) {
      await router.replace(preferredAdminEntry);
    }
  };

  const handleUnauthorizedSync = async () => {
    menus.reset(router);
    await auth.logout().catch(() => {
      auth.clearSession();
    });
    await router.replace('/login');
  };

  const flushSync = async () => {
    clearSyncTimer();

    if (syncInFlight) {
      rerunRequested = true;
      return;
    }

    if (!auth.isAuthenticated || !auth.user?.id) {
      pendingTargets.clear();
      return;
    }

    const targets = pendingTargets.size
      ? [...pendingTargets]
      : getDefaultTargets();
    pendingTargets.clear();
    syncInFlight = true;

    try {
      if (targets.includes('user')) {
        await auth.syncCurrentUser();
      }

      if (targets.includes('menus')) {
        await menus.refresh(router);
        workbench.syncWithMenus();
      }

      await reconcileAdminRoute();
    } catch (error) {
      if (hasStatus(error) && (error.status === 401 || error.status === 403)) {
        await handleUnauthorizedSync();
      }
    } finally {
      syncInFlight = false;

      if (rerunRequested || pendingTargets.size) {
        rerunRequested = false;
        void flushSync();
      }
    }
  };

  const scheduleSync = (targets: RealtimeSyncTarget[] = getDefaultTargets()) => {
    targets.forEach((target) => {
      pendingTargets.add(target);
    });

    clearSyncTimer();
    syncTimer = setTimeout(() => {
      void flushSync();
    }, SYNC_DEBOUNCE_MS);
  };

  watch(
    () => auth.user?.id ?? '',
    (userId) => {
      stopTopicSubscription?.();
      stopTopicSubscription = null;
      pendingTargets.clear();
      clearSyncTimer();
      rerunRequested = false;

      if (!userId) {
        return;
      }

      stopTopicSubscription = wsClient.onTopic<RbacUpdatedPayload>(
        REALTIME_TOPICS.userRbacUpdated(userId),
        ({ payload }) => {
          scheduleSync(payload.targets?.length ? payload.targets : getDefaultTargets());
        },
      );
    },
    {
      immediate: true,
    },
  );
};
