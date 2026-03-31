<template>
  <div class="petpal-admin-shell">
    <header class="petpal-admin-shell__header">
      <div class="petpal-admin-shell__brand">
        <p class="petpal-admin-shell__eyebrow">PetPal Admin</p>
        <h1>{{ currentTitle }}</h1>
        <p>{{ currentDescription }}</p>
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
        <div class="petpal-admin-nav__copy">
          <small>{{ item.caption }}</small>
          <strong>{{ item.title }}</strong>
          <span>{{ item.description }}</span>
        </div>
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
const currentDescription = computed(() => String(
  route.meta.description ?? '从根路径直接进入投诉、审核与回调治理页面，不依赖菜单树配置。',
));

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
  padding: 24px;
  color: #183e39;
  background:
    radial-gradient(circle at top left, rgba(242, 255, 250, 0.78), transparent 26%),
    radial-gradient(circle at bottom right, rgba(221, 238, 231, 0.48), transparent 24%),
    linear-gradient(180deg, #f4faf7 0%, #eef5f1 44%, #e7efea 100%);
}

.petpal-admin-shell__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 20px;
  width: min(1320px, 100%);
  margin: 0 auto 20px;
  padding: 28px;
  border: 1px solid rgba(24, 62, 57, 0.1);
  border-radius: 28px;
  background: rgba(255, 255, 255, 0.78);
  box-shadow: 0 28px 64px rgba(24, 62, 57, 0.08);
}

.petpal-admin-shell__brand {
  display: grid;
  gap: 10px;
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
  font-size: clamp(32px, 4vw, 50px);
  line-height: 0.98;
}

.petpal-admin-shell__brand p {
  max-width: 760px;
  margin: 0;
  color: #5e776f;
  line-height: 1.8;
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
  gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
  width: min(1320px, 100%);
  margin: 0 auto 20px;
}

.petpal-admin-nav {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 14px;
  padding: 18px 20px;
  border: 1px solid rgba(24, 62, 57, 0.08);
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.74);
  box-shadow: 0 20px 48px rgba(24, 62, 57, 0.06);
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
  width: 42px;
  height: 42px;
  border-radius: 14px;
  background: rgba(24, 62, 57, 0.1);
}

.petpal-admin-nav.is-active .petpal-admin-nav__icon {
  background: rgba(255, 255, 255, 0.12);
}

.petpal-admin-nav__copy {
  display: grid;
  gap: 6px;
}

.petpal-admin-nav__copy small {
  color: #6b847c;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.petpal-admin-nav.is-active .petpal-admin-nav__copy small,
.petpal-admin-nav.is-active .petpal-admin-nav__copy span {
  color: rgba(238, 250, 244, 0.8);
}

.petpal-admin-nav__copy strong {
  font-size: 18px;
}

.petpal-admin-nav__copy span {
  color: #5c746c;
  line-height: 1.65;
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
