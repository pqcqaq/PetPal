<template>
  <div class="petpal-admin-shell">
    <header class="petpal-admin-shell__header">
      <div class="petpal-admin-shell__brand">
        <p class="petpal-admin-shell__eyebrow">PetPal Admin</p>
        <h1>{{ currentTitle }}</h1>
      </div>

      <div class="petpal-admin-shell__actions">
        <span class="petpal-admin-shell__user">
          {{ auth.user?.nickname ?? auth.user?.username ?? '已登录用户' }}
        </span>
        <el-button plain @click="router.push('/petpal')">主人端工作台</el-button>
        <el-button plain @click="router.push('/')">公开首页</el-button>
        <el-button type="primary" plain @click="handleLogout">退出登录</el-button>
      </div>
    </header>

    <nav class="petpal-admin-shell__nav">
      <RouterLink
        v-for="item in visibleNavItems"
        :key="item.to"
        :to="item.to"
        class="petpal-admin-nav"
        :class="{ 'is-active': route.path === item.to }"
      >
        <div class="petpal-admin-nav__icon">
          <UnoIcon :name="item.icon" :size="18" />
        </div>
        <strong class="petpal-admin-nav__title">{{ item.title }}</strong>
      </RouterLink>
    </nav>

    <main class="petpal-admin-shell__main">
      <RouterView />
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import UnoIcon from '@/components/common/UnoIcon.vue';
import { useAuthStore } from '@/stores/auth';
import { useMenuStore } from '@/stores/menus';
import { useWorkbenchStore } from '@/stores/workbench';
import { getErrorMessage } from '@/utils/errors';
import { canAccessPetPalAdminNavItem, petpalAdminNavItems } from '@/pages/petpal-admin/navigation';

const auth = useAuthStore();
const menus = useMenuStore();
const route = useRoute();
const router = useRouter();
const workbench = useWorkbenchStore();

const visibleNavItems = computed(() => petpalAdminNavItems.filter((item) => (
  canAccessPetPalAdminNavItem(auth.permissions, item)
)));

const currentTitle = computed(() => String(route.meta.title ?? '宠托帮后台'));

const handleLogout = async () => {
  try {
    await auth.logout();
    menus.reset(router);
    workbench.resetWorkbenchPreferences();
    await router.push('/login');
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '退出登录失败'));
  }
};
</script>

<style scoped lang="scss">
.petpal-admin-shell {
  min-height: 100vh;
  padding: 20px;
  color: #163835;
  background:
    radial-gradient(circle at top left, rgba(15, 118, 110, 0.1), transparent 26%),
    radial-gradient(circle at bottom right, rgba(185, 113, 24, 0.06), transparent 20%),
    linear-gradient(180deg, #f8fcfb 0%, #eef6f3 44%, #e6f0ed 100%);
}

.petpal-admin-shell__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  width: min(1320px, 100%);
  margin: 0 auto 16px;
  padding: 20px 22px;
  border: 1px solid rgba(24, 62, 57, 0.1);
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.86);
  box-shadow: 0 16px 34px rgba(24, 62, 57, 0.08);
}

.petpal-admin-shell__brand {
  display: grid;
  gap: 8px;
}

.petpal-admin-shell__eyebrow {
  margin: 0;
  color: #638077;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.28em;
  text-transform: uppercase;
}

.petpal-admin-shell__brand h1 {
  margin: 0;
  font-size: clamp(26px, 4vw, 38px);
  line-height: 1.04;
}

.petpal-admin-shell__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  align-items: center;
  gap: 10px;
}

.petpal-admin-shell__user {
  display: inline-flex;
  align-items: center;
  min-height: 40px;
  padding: 0 14px;
  border-radius: 999px;
  background: rgba(24, 62, 57, 0.08);
  color: #35534b;
  font-weight: 600;
}

.petpal-admin-shell__nav {
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  width: min(1320px, 100%);
  margin: 0 auto 16px;
}

.petpal-admin-nav {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border: 1px solid rgba(24, 62, 57, 0.08);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.82);
  box-shadow: 0 12px 24px rgba(24, 62, 57, 0.05);
  transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
}

.petpal-admin-nav:hover,
.petpal-admin-nav.is-active {
  transform: translateY(-1px);
  border-color: rgba(24, 62, 57, 0.16);
  box-shadow: 0 24px 52px rgba(24, 62, 57, 0.1);
}

.petpal-admin-nav.is-active {
  background: linear-gradient(135deg, rgba(24, 62, 57, 0.96) 0%, rgba(46, 98, 83, 0.92) 100%);
  color: #eefaf4;
}

.petpal-admin-nav__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border-radius: 12px;
  background: rgba(24, 62, 57, 0.1);
}

.petpal-admin-nav__title {
  font-size: 15px;
  line-height: 1.35;
}

.petpal-admin-shell__main {
  width: min(1320px, 100%);
  margin: 0 auto;
}

@media (max-width: 960px) {
  .petpal-admin-shell {
    padding: 16px;
  }

  .petpal-admin-shell__header {
    flex-direction: column;
    padding: 22px;
  }

  .petpal-admin-shell__actions {
    justify-content: flex-start;
  }
}
</style>
