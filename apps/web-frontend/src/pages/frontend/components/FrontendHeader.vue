<template>
  <header class="frontend-header">
    <div class="frontend-header__inner">
      <RouterLink to="/" class="frontend-brand">
        <span class="frontend-brand__mark">宠托帮</span>
        <span class="frontend-brand__copy">
          <strong>PetPal</strong>
          <small>任务优先 · 直接办事</small>
        </span>
      </RouterLink>

      <nav class="frontend-nav" aria-label="前台导航">
        <RouterLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="frontend-nav__item"
          :class="{ 'is-active': route.path === item.to }"
        >
          <span>{{ item.label }}</span>
        </RouterLink>
      </nav>

      <div class="frontend-header__actions">
        <span v-if="userLabel" class="frontend-user-badge">{{ userLabel }}</span>
        <RouterLink class="frontend-admin-link" :to="adminTarget">
          {{ adminLabel }}
        </RouterLink>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router';

defineProps<{
  navItems: Array<{ label: string; to: string }>;
  adminTarget: string;
  adminLabel: string;
  userLabel: string;
}>();

const route = useRoute();
</script>

<style scoped lang="scss">
.frontend-header {
  position: sticky;
  top: 16px;
  z-index: 40;
}

.frontend-header__inner {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 18px;
  width: min(1180px, calc(100vw - 32px));
  margin: 0 auto;
  padding: 14px 0;
  border-bottom: 1px solid rgba(44, 37, 29, 0.1);
}

.frontend-brand {
  display: inline-flex;
  align-items: center;
  gap: 14px;
  color: #2b241f;
}

.frontend-brand__mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 36px;
  padding: 0 12px;
  border: 1px solid rgba(44, 37, 29, 0.12);
  color: #8f6c4f;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.frontend-brand__copy {
  display: grid;
  gap: 1px;
}

.frontend-brand__copy strong {
  font-size: 18px;
}

.frontend-brand__copy small {
  color: #7f7065;
  font-size: 11px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.frontend-nav {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px;
}

.frontend-nav__item {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 38px;
  padding: 0 12px;
  color: #685c53;
  transition: color 0.18s ease;
}

.frontend-nav__item span {
  font-size: 13px;
  font-weight: 700;
}

.frontend-nav__item:hover,
.frontend-nav__item.is-active {
  color: #2b241f;
}

.frontend-header__actions {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
}

.frontend-user-badge {
  display: inline-flex;
  align-items: center;
  min-height: 34px;
  padding: 0 10px;
  border: 1px solid rgba(44, 37, 29, 0.1);
  color: #6b625a;
  font-size: 12px;
  font-weight: 700;
}

.frontend-admin-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 40px;
  padding: 0 14px;
  border: 1px solid #2563eb;
  background: #2563eb;
  color: #fff8ef;
  font-size: 13px;
  font-weight: 700;
}

@media (max-width: 980px) {
  .frontend-header__inner {
    grid-template-columns: 1fr;
    padding: 12px 0;
  }

  .frontend-nav {
    justify-content: flex-start;
  }

  .frontend-header__actions {
    justify-content: flex-start;
  }
}
</style>
