<template>
  <div class="frontend-shell">
    <FrontendHeader
      :nav-items="navItems"
      :admin-target="adminTarget"
      :admin-label="adminLabel"
      :user-label="userLabel"
    />

    <main class="frontend-shell__main">
      <RouterView />
    </main>

    <FrontendFooter
      :nav-items="navItems"
      :admin-target="adminTarget"
      :admin-label="adminLabel"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import FrontendFooter from '@/pages/frontend/components/FrontendFooter.vue';
import FrontendHeader from '@/pages/frontend/components/FrontendHeader.vue';
import { frontendNavItems } from '@/pages/frontend/frontend-content';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
const navItems = frontendNavItems.map((item) => ({ ...item }));
const adminTarget = computed(() => {
  if (!auth.isAuthenticated) {
    return '/login';
  }

  return '/petpal-admin';
});
const adminLabel = computed(() => auth.isAuthenticated ? '进入 PetPal 后台' : '登录 PetPal 后台');
const userLabel = computed(() => auth.isAuthenticated ? `当前用户 · ${auth.user?.nickname ?? auth.user?.username ?? '已登录'}` : '');
</script>

<style scoped lang="scss">
.frontend-shell {
  min-height: 100vh;
  color: #143634;
  background:
    radial-gradient(circle at top left, rgba(15, 118, 110, 0.08), transparent 22%),
    radial-gradient(circle at top right, rgba(185, 113, 24, 0.08), transparent 18%),
    linear-gradient(180deg, #f9fcfb 0%, #f1f7f5 52%, #e7f0ed 100%);
}

.frontend-shell__main {
  width: min(1320px, calc(100vw - 32px));
  margin: 0 auto;
  padding-top: 18px;
}

:deep(.frontend-page) {
  display: grid;
  gap: 18px;
}

:deep(.frontend-page__hero) {
  position: relative;
  overflow: hidden;
  display: grid;
  gap: 12px;
  padding: 20px 22px;
  border: 1px solid rgba(18, 53, 51, 0.1);
  border-radius: 24px;
  background:
    radial-gradient(circle at top right, rgba(15, 118, 110, 0.08), transparent 30%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(246, 251, 250, 0.96) 100%);
  box-shadow: 0 16px 34px rgba(12, 33, 31, 0.08);
}

:deep(.frontend-page__eyebrow) {
  margin: 0;
  color: #6d8683;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

:deep(.frontend-page__hero h1) {
  max-width: 920px;
  margin: 0;
  font-size: clamp(28px, 4vw, 42px);
  line-height: 1.04;
}

:deep(.frontend-page__hero > p:not(.frontend-page__eyebrow)) {
  display: none;
}

:deep(.frontend-page__hero-actions) {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 2px;
}

:deep(.frontend-page__button) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 40px;
  padding: 0 16px;
  border-radius: 999px;
  font-weight: 700;
  transition: background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease, transform 0.2s ease;
}

:deep(.frontend-page__button.is-primary) {
  background: linear-gradient(135deg, #0f766e 0%, #0b5d57 100%);
  color: #f7fffd;
}

:deep(.frontend-page__button.is-secondary) {
  border: 1px solid rgba(18, 53, 51, 0.12);
  background: rgba(255, 255, 255, 0.9);
  color: #143634;
}

:deep(.frontend-page__button:hover) {
  transform: translateY(-1px);
}

:deep(.frontend-page__section-grid) {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(12, minmax(0, 1fr));
}

:deep(.frontend-card) {
  display: grid;
  gap: 10px;
  padding: 20px;
  border: 1px solid rgba(18, 53, 51, 0.08);
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.88);
  box-shadow: 0 14px 28px rgba(12, 33, 31, 0.06);
}

:deep(.frontend-card__eyebrow) {
  color: #728884;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

:deep(.frontend-card h2),
:deep(.frontend-card h3) {
  margin: 0;
  color: #143634;
}

:deep(.frontend-card p) {
  margin: 0;
  color: #5f7673;
  line-height: 1.68;
}

:deep(.petpal-section-heading__meta p) {
  display: none;
}

@media (max-width: 900px) {
  .frontend-shell__main {
    padding-top: 14px;
  }

  :deep(.frontend-page__hero) {
    padding: 18px;
    border-radius: 20px;
  }

  :deep(.frontend-page__section-grid) {
    grid-template-columns: 1fr;
  }
}

@media (prefers-reduced-motion: reduce) {
  :deep(.frontend-page__button) {
    transition: none;
  }
}
</style>
