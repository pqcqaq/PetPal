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
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@500;600;700&display=swap');

.frontend-shell {
  min-height: 100vh;
  font-family: 'Inter', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  color: #2f2924;
  background:
    radial-gradient(circle at top left, rgba(249, 115, 22, 0.09), transparent 20%),
    radial-gradient(circle at top right, rgba(37, 99, 235, 0.08), transparent 18%),
    linear-gradient(180deg, #f7f2eb 0%, #f6eee5 52%, #f2e8de 100%);
}

.frontend-shell__main {
  width: min(1180px, calc(100vw - 32px));
  margin: 0 auto;
  padding-top: 20px;
  padding-bottom: 28px;
}

:deep(.frontend-page) {
  display: grid;
  gap: 18px;
}

:deep(.frontend-page__hero) {
  display: grid;
  gap: 14px;
  padding: 28px;
  border: 1px solid rgba(44, 37, 29, 0.12);
  background:
    radial-gradient(circle at top right, rgba(37, 99, 235, 0.08), transparent 26%),
    linear-gradient(180deg, rgba(255, 251, 247, 0.96) 0%, rgba(252, 247, 241, 0.94) 100%);
  box-shadow: 0 26px 60px rgba(43, 36, 31, 0.08);
}

:deep(.frontend-page__eyebrow) {
  margin: 0;
  color: #8f6c4f;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.22em;
  text-transform: uppercase;
}

:deep(.frontend-page__hero h1) {
  font-family: 'Playfair Display', 'STSong', serif;
  max-width: 840px;
  margin: 0;
  font-size: clamp(38px, 6vw, 62px);
  line-height: 0.96;
  letter-spacing: -0.03em;
}

:deep(.frontend-page__hero > p:not(.frontend-page__eyebrow)) {
  margin: 0;
  max-width: 760px;
  color: #62584f;
  font-size: 15px;
  line-height: 1.78;
}

:deep(.frontend-page__hero-actions) {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

:deep(.frontend-page__button) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  padding: 0 16px;
  border: 1px solid rgba(44, 37, 29, 0.12);
  font-weight: 700;
  transition: background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease;
}

:deep(.frontend-page__button.is-primary) {
  background: #2563eb;
  border-color: #2563eb;
  color: #fff8ef;
}

:deep(.frontend-page__button.is-secondary) {
  background: rgba(255, 252, 248, 0.92);
  color: #332c26;
}

:deep(.frontend-page__section-grid) {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(12, minmax(0, 1fr));
}

:deep(.frontend-page__section) {
  display: grid;
  gap: 14px;
  padding-top: 6px;
}

:deep(.frontend-page__section + .frontend-page__section) {
  padding-top: 22px;
  border-top: 1px solid rgba(44, 37, 29, 0.1);
}

:deep(.frontend-page__section h2) {
  margin: 0;
  font-family: 'Playfair Display', 'STSong', serif;
  color: #2b241f;
  font-size: clamp(24px, 3vw, 34px);
  line-height: 1.04;
}

:deep(.frontend-page__section > p) {
  margin: 0;
  max-width: 780px;
  color: #62584f;
  font-size: 14px;
  line-height: 1.78;
}

:deep(.frontend-card) {
  display: grid;
  gap: 12px;
  padding: 22px;
  border: 1px solid rgba(44, 37, 29, 0.1);
  background: rgba(255, 252, 248, 0.88);
  box-shadow: 0 18px 40px rgba(43, 36, 31, 0.06);
}

:deep(.frontend-card__eyebrow) {
  color: #927965;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

:deep(.frontend-card h2),
:deep(.frontend-card h3) {
  margin: 0;
  font-family: 'Playfair Display', 'STSong', serif;
  color: #2b241f;
  line-height: 1.04;
}

:deep(.frontend-card p) {
  margin: 0;
  color: #62584f;
  line-height: 1.72;
}

:deep(.frontend-route-list),
:deep(.frontend-summary-strip),
:deep(.frontend-note-list) {
  display: grid;
  gap: 12px;
}

:deep(.frontend-route-row) {
  display: flex;
  gap: 18px;
  justify-content: space-between;
  align-items: flex-start;
  padding: 16px 0;
  border-top: 1px solid rgba(44, 37, 29, 0.1);
}

:deep(.frontend-route-row:first-child) {
  padding-top: 0;
  border-top: 0;
}

:deep(.frontend-route-row__copy) {
  min-width: 0;
  flex: 1;
  display: grid;
  gap: 6px;
}

:deep(.frontend-route-row__eyebrow),
:deep(.frontend-summary-strip span) {
  color: #8f7b69;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

:deep(.frontend-route-row__title) {
  margin: 0;
  color: #2b241f;
  font-size: 18px;
  font-weight: 700;
  line-height: 1.35;
}

:deep(.frontend-route-row__meta),
:deep(.frontend-note-list) {
  margin: 0;
  color: #62584f;
  font-size: 14px;
  line-height: 1.8;
}

:deep(.frontend-route-row__tail) {
  display: grid;
  gap: 8px;
  justify-items: end;
  min-width: 146px;
  text-align: right;
}

:deep(.frontend-route-row__tail a),
:deep(.frontend-route-row__tail button) {
  color: #2563eb;
  font-size: 13px;
  font-weight: 700;
  text-decoration: none;
}

:deep(.frontend-summary-strip) {
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
}

:deep(.frontend-summary-strip > div) {
  display: grid;
  gap: 6px;
  padding-top: 12px;
  border-top: 1px solid rgba(44, 37, 29, 0.08);
}

:deep(.frontend-summary-strip strong) {
  color: #2b241f;
  font-size: 16px;
  line-height: 1.4;
}

:deep(.frontend-summary-strip p) {
  margin: 0;
  color: #62584f;
  font-size: 14px;
  line-height: 1.72;
}

:deep(.frontend-note-list) {
  padding-left: 18px;
}

@media (max-width: 900px) {
  .frontend-shell__main {
    padding-top: 14px;
  }

  :deep(.frontend-page__hero) {
    padding: 20px;
  }

  :deep(.frontend-page__section-grid) {
    grid-template-columns: 1fr;
  }

  :deep(.frontend-route-row) {
    flex-direction: column;
    align-items: flex-start;
  }

  :deep(.frontend-route-row__tail) {
    justify-items: start;
    min-width: 0;
    text-align: left;
  }
}

@media (prefers-reduced-motion: reduce) {
  :deep(.frontend-page__button) {
    transition: none;
  }
}
</style>
