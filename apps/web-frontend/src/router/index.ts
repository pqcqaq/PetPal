import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useMenuStore } from '@/stores/menus';
import { useWorkbenchStore } from '@/stores/workbench';
import { beginRouteProgress, endRouteProgress } from '@/utils/app-progress';
import {
  CONSOLE_NAMESPACE,
  hasPetPalAdminAccess,
  PETPAL_ADMIN_NAMESPACE,
  resolvePreferredAdminEntry,
} from '@/utils/admin-entry';
import { pinia } from '@/stores';

const routes = [
  {
    path: '/',
    component: () => import('@/layouts/FrontendLayout.vue'),
    children: [
      {
        path: '',
        name: 'frontend-home',
        component: () => import('@/pages/frontend/home/HomeView.vue'),
        meta: { publicPage: true, title: '项目首页' },
      },
      {
        path: 'petpal',
        name: 'frontend-petpal',
        component: () => import('@/pages/frontend/petpal/PetPalOwnerView.vue'),
        meta: { publicPage: true, title: '宠托帮主人服务台' },
      },
      {
        path: 'petpal/pets',
        name: 'frontend-petpal-pets',
        component: () => import('@/pages/frontend/petpal/PetPalOwnerPetsView.vue'),
        meta: { publicPage: true, title: '宠托帮宠物档案' },
      },
      {
        path: 'petpal/pets/new',
        name: 'frontend-petpal-pet-create',
        component: () => import('@/pages/frontend/petpal/PetPalOwnerPetFormView.vue'),
        meta: { publicPage: true, title: '新建宠物档案' },
      },
      {
        path: 'petpal/pets/:id/edit',
        name: 'frontend-petpal-pet-edit',
        component: () => import('@/pages/frontend/petpal/PetPalOwnerPetFormView.vue'),
        meta: { publicPage: true, title: '编辑宠物档案' },
      },
      {
        path: 'petpal/requests',
        name: 'frontend-petpal-requests',
        component: () => import('@/pages/frontend/petpal/PetPalOwnerRequestsView.vue'),
        meta: { publicPage: true, title: '宠托帮需求队列' },
      },
      {
        path: 'petpal/requests/new',
        name: 'frontend-petpal-request-create',
        component: () => import('@/pages/frontend/petpal/PetPalOwnerRequestFormView.vue'),
        meta: { publicPage: true, title: '新建照料需求' },
      },
      {
        path: 'petpal/orders',
        name: 'frontend-petpal-orders',
        component: () => import('@/pages/frontend/petpal/PetPalOwnerOrdersView.vue'),
        meta: { publicPage: true, title: '宠托帮订单队列' },
      },
      {
        path: 'petpal/caregiver',
        name: 'frontend-petpal-caregiver',
        component: () => import('@/pages/frontend/petpal/PetPalCaregiverView.vue'),
        meta: { publicPage: true, title: '宠托帮照料者工作台' },
      },
      {
        path: 'petpal/caregiver/profile',
        name: 'frontend-petpal-caregiver-profile',
        component: () => import('@/pages/frontend/petpal/PetPalCaregiverProfileView.vue'),
        meta: { publicPage: true, title: '照料者入驻资料' },
      },
      {
        path: 'petpal/caregiver/services',
        name: 'frontend-petpal-caregiver-services',
        component: () => import('@/pages/frontend/petpal/PetPalCaregiverServicesView.vue'),
        meta: { publicPage: true, title: '照料者服务清单' },
      },
      {
        path: 'petpal/caregiver/services/new',
        name: 'frontend-petpal-caregiver-service-create',
        component: () => import('@/pages/frontend/petpal/PetPalCaregiverServiceFormView.vue'),
        meta: { publicPage: true, title: '新建照料服务' },
      },
      {
        path: 'petpal/caregiver/services/:id/edit',
        name: 'frontend-petpal-caregiver-service-edit',
        component: () => import('@/pages/frontend/petpal/PetPalCaregiverServiceFormView.vue'),
        meta: { publicPage: true, title: '编辑照料服务' },
      },
      {
        path: 'petpal/caregiver/orders',
        name: 'frontend-petpal-caregiver-orders',
        component: () => import('@/pages/frontend/petpal/PetPalCaregiverOrdersView.vue'),
        meta: { publicPage: true, title: '照料者履约队列' },
      },
      {
        path: 'petpal/reminders',
        name: 'frontend-petpal-reminders',
        component: () => import('@/pages/frontend/petpal/PetPalRemindersView.vue'),
        meta: { publicPage: true, title: '宠托帮提醒中心' },
      },
      {
        path: 'petpal/messages',
        name: 'frontend-petpal-messages',
        component: () => import('@/pages/frontend/petpal/PetPalMessagesView.vue'),
        meta: { publicPage: true, title: '宠托帮消息中心' },
      },
      {
        path: 'petpal/aftersales',
        name: 'frontend-petpal-aftersales',
        component: () => import('@/pages/frontend/petpal/PetPalAftersalesView.vue'),
        meta: { publicPage: true, title: '宠托帮售后中心' },
      },
      {
        path: 'petpal/legacy',
        name: 'frontend-petpal-legacy',
        component: () => import('@/pages/frontend/petpal/PetPalLegacyWorkbenchView.vue'),
        meta: { publicPage: true, title: '宠托帮兼容入口' },
      },
      {
        path: 'petpal/order-detail/:id',
        name: 'frontend-petpal-order-detail',
        component: () => import('@/pages/frontend/petpal/OrderDetailView.vue'),
        meta: { publicPage: true, title: '订单详情' },
      },
      {
        path: 'petpal/orders/:id/payment-result',
        name: 'frontend-petpal-payment-result',
        component: () => import('@/pages/frontend/petpal/PetPalPaymentResultView.vue'),
        meta: { publicPage: true, title: '支付结果' },
      },
      {
        path: 'petpal/orders/:id/refund-result',
        name: 'frontend-petpal-refund-result',
        component: () => import('@/pages/frontend/petpal/PetPalRefundResultView.vue'),
        meta: { publicPage: true, title: '退款结果' },
      },
      {
        path: 'petpal/orders/:id/complaint-result',
        name: 'frontend-petpal-complaint-result',
        component: () => import('@/pages/frontend/petpal/PetPalComplaintResultView.vue'),
        meta: { publicPage: true, title: '投诉结果' },
      },
      {
        path: 'petpal/orders/:id/review-result',
        name: 'frontend-petpal-review-result',
        component: () => import('@/pages/frontend/petpal/PetPalReviewResultView.vue'),
        meta: { publicPage: true, title: '评价结果' },
      },
      {
        path: 'architecture',
        name: 'frontend-architecture',
        component: () => import('@/pages/frontend/architecture/ArchitectureView.vue'),
        meta: { publicPage: true, title: '系统架构' },
      },
      {
        path: 'authentication',
        name: 'frontend-authentication',
        component: () => import('@/pages/frontend/authentication/AuthenticationView.vue'),
        meta: { publicPage: true, title: '认证策略' },
      },
      {
        path: 'oauth/authorize',
        name: 'frontend-oauth-authorize',
        component: () => import('@/pages/frontend/oauth/OAuthAuthorizeView.vue'),
        meta: { publicPage: true, title: 'OAuth 授权确认' },
      },
      {
        path: 'oauth/error',
        name: 'frontend-oauth-error',
        component: () => import('@/pages/frontend/oauth/OAuthAuthorizeErrorView.vue'),
        meta: { publicPage: true, title: 'OAuth 授权失败' },
      },
      {
        path: ':pathMatch(.*)*',
        name: 'frontend-not-found',
        component: () => import('@/pages/frontend/not-found/NotFoundView.vue'),
        meta: { publicPage: true, title: '页面未找到' },
      },
    ],
  },
  {
    path: PETPAL_ADMIN_NAMESPACE,
    component: () => import('@/layouts/PetPalAdminLayout.vue'),
    meta: { requiresAuth: true, title: '宠托帮后台直达工作台' },
    children: [
      {
        path: '',
        name: 'petpal-admin-home',
        component: () => import('@/pages/petpal-admin/PetPalAdminHubView.vue'),
        meta: {
          requiresAuth: true,
          title: '宠托帮后台直达工作台',
          description: '跳过菜单树，直接访问 PetPal 投诉、审核与回调治理工作区。',
        },
      },
      {
        path: 'complaints',
        name: 'petpal-admin-complaints',
        component: () => import('@/pages/petpal-admin/PetPalComplaintAdminRouteView.vue'),
        meta: {
          requiresAuth: true,
          permission: 'petpal.complaint.manage',
          title: '投诉工单',
          description: '集中处理投诉分派、批量结案与 SLA 风险工单。',
        },
      },
      {
        path: 'caregiver-audits',
        name: 'petpal-admin-caregiver-audits',
        component: () => import('@/pages/petpal-admin/PetPalCaregiverAuditRouteView.vue'),
        meta: {
          requiresAuth: true,
          permission: 'petpal.caregiver.audit',
          title: '照料者审核',
          description: '审核照料者资质、查看当前审核状态与操作记录。',
        },
      },
      {
        path: 'callback-audits',
        name: 'petpal-admin-callback-audits',
        component: () => import('@/pages/petpal-admin/PetPalCallbackAuditRouteView.vue'),
        meta: {
          requiresAuth: true,
          permission: 'petpal.callback-audit.read',
          title: '回调审计',
          description: '查看支付与退款回调链路、筛选异常并导出审计记录。',
        },
      },
      {
        path: 'callback-alert-outbox',
        name: 'petpal-admin-callback-alert-outbox',
        component: () => import('@/pages/petpal-admin/PetPalCallbackAlertOutboxRouteView.vue'),
        meta: {
          requiresAuth: true,
          permission: 'petpal.callback-alert.read',
          title: '告警队列',
          description: '跟踪回调告警重放、失败重试与积压处理。',
        },
      },
    ],
  },
  {
    path: '/login',
    name: 'login',
    component: () => import('@/pages/console/auth/LoginView.vue'),
    meta: { guestOnly: true },
  },
  {
    path: CONSOLE_NAMESPACE,
    name: 'console-root',
    component: () => import('@/layouts/ConsoleLayout.vue'),
    meta: { requiresAuth: true },
  },
];

const isOAuthAuthorizeReturnTo = (value: unknown) => {
  if (typeof value !== 'string' || !value.trim()) {
    return false;
  }

  if (value.startsWith('/oauth2/authorize')) {
    return true;
  }

  try {
    return new URL(value).pathname === '/oauth2/authorize';
  } catch {
    return false;
  }
};

let routeProgressActive = false;

const startRouteProgress = () => {
  if (routeProgressActive) {
    return;
  }

  routeProgressActive = true;
  beginRouteProgress();
};

const finishRouteProgress = () => {
  if (!routeProgressActive) {
    return;
  }

  routeProgressActive = false;
  endRouteProgress();
};

export const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach(async (to) => {
  startRouteProgress();
  const auth = useAuthStore(pinia);
  const menus = useMenuStore(pinia);
  const isConsoleTarget = to.path === CONSOLE_NAMESPACE || to.path.startsWith(`${CONSOLE_NAMESPACE}/`);
  const isPetPalAdminTarget = to.path === PETPAL_ADMIN_NAMESPACE || to.path.startsWith(`${PETPAL_ADMIN_NAMESPACE}/`);

  if (!auth.ready) {
    await auth.bootstrap();
  }

  if (!auth.isAuthenticated && (isConsoleTarget || isPetPalAdminTarget)) {
    menus.reset(router);
    return '/login';
  }

  if (auth.isAuthenticated && (isConsoleTarget || to.meta.guestOnly)) {
    await menus.bootstrap(router);
  }

  const preferredAdminEntry = resolvePreferredAdminEntry(auth.permissions, menus.homePath);

  if (auth.isAuthenticated && isConsoleTarget && menus.hasPagePath(to.path) && to.name === 'frontend-not-found') {
    return to.fullPath;
  }

  if (to.meta.guestOnly && auth.isAuthenticated) {
    if (to.path === '/login' && isOAuthAuthorizeReturnTo(to.query.returnTo)) {
      return true;
    }

    return preferredAdminEntry;
  }

  if (auth.isAuthenticated && isPetPalAdminTarget && !hasPetPalAdminAccess(auth.permissions)) {
    return preferredAdminEntry;
  }

  if (auth.isAuthenticated && to.path === CONSOLE_NAMESPACE && preferredAdminEntry !== CONSOLE_NAMESPACE) {
    return preferredAdminEntry;
  }

  if (auth.isAuthenticated && isConsoleTarget && to.path !== CONSOLE_NAMESPACE && !menus.hasPagePath(to.path)) {
    return preferredAdminEntry;
  }

  if (typeof to.meta.permission === 'string' && !auth.hasPermission(to.meta.permission)) {
    return preferredAdminEntry;
  }

  return true;
});

router.afterEach((to) => {
  const menus = useMenuStore(pinia);
  const workbench = useWorkbenchStore(pinia);
  workbench.bootstrap();

  if (menus.ready) {
    workbench.syncWithMenus();
  }

  if (to.matched.some((record) => record.meta.requiresAuth) && menus.hasPagePath(to.path)) {
    workbench.addVisitedTab(to.path);
  }

  finishRouteProgress();
});

router.onError(() => {
  finishRouteProgress();
});
