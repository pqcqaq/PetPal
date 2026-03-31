<template>
  <section class="petpal-admin-hub">
    <div class="petpal-admin-hub__hero">
      <p class="petpal-admin-hub__eyebrow">PetPal Admin</p>
      <h1>宠托帮后台直达工作台</h1>
      <p>
        这套入口专门给 PetPal 后台使用，不再依赖菜单树组织路径。投诉、资质审核、回调审计和告警队列都可以直接进入。
      </p>
      <div class="petpal-admin-hub__signals">
        <article>
          <span>可访问工作区</span>
          <strong>{{ accessibleItems.length }}</strong>
        </article>
        <article>
          <span>当前账号</span>
          <strong>{{ auth.user?.nickname ?? auth.user?.username ?? '未知用户' }}</strong>
        </article>
      </div>
    </div>

    <div class="petpal-admin-hub__grid">
      <RouterLink
        v-for="item in accessibleItems"
        :key="item.to"
        :to="item.to"
        class="petpal-admin-card"
      >
        <div class="petpal-admin-card__icon">
          <UnoIcon :name="item.icon" :size="22" />
        </div>
        <div class="petpal-admin-card__copy">
          <small>{{ item.caption }}</small>
          <h2>{{ item.title }}</h2>
          <p>{{ item.description }}</p>
        </div>
      </RouterLink>
    </div>

    <el-empty
      v-if="accessibleItems.length === 0"
      description="当前账号还没有可用的 PetPal 后台权限，请先分配后台角色或业务权限。"
    />
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import UnoIcon from '@/components/common/UnoIcon.vue';
import { useAuthStore } from '@/stores/auth';
import { canAccessPetPalAdminNavItem, petpalAdminNavItems } from './navigation';

const auth = useAuthStore();
const accessibleItems = computed(() => petpalAdminNavItems.filter((item) => (
  item.to !== '/petpal-admin' && canAccessPetPalAdminNavItem(auth.permissions, item)
)));
</script>

<style scoped lang="scss">
.petpal-admin-hub {
  display: grid;
  gap: 20px;
}

.petpal-admin-hub__hero {
  display: grid;
  gap: 14px;
  padding: 28px;
  border: 1px solid rgba(32, 72, 67, 0.12);
  border-radius: 28px;
  background:
    radial-gradient(circle at top right, rgba(232, 251, 246, 0.9), transparent 28%),
    linear-gradient(135deg, rgba(248, 253, 250, 0.94) 0%, rgba(235, 245, 240, 0.92) 100%);
  box-shadow: 0 24px 52px rgba(24, 62, 57, 0.08);
}

.petpal-admin-hub__eyebrow {
  margin: 0;
  color: #5a6f67;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.24em;
  text-transform: uppercase;
}

.petpal-admin-hub__hero h1 {
  margin: 0;
  color: #183e39;
  font-size: clamp(30px, 4vw, 44px);
  line-height: 1.02;
}

.petpal-admin-hub__hero p {
  max-width: 760px;
  margin: 0;
  color: #556a62;
  line-height: 1.8;
}

.petpal-admin-hub__signals {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
}

.petpal-admin-hub__signals article {
  display: grid;
  gap: 6px;
  padding: 16px 18px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(32, 72, 67, 0.08);
}

.petpal-admin-hub__signals span {
  color: #698077;
  font-size: 12px;
}

.petpal-admin-hub__signals strong {
  color: #183e39;
  font-size: 20px;
}

.petpal-admin-hub__grid {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
}

.petpal-admin-card {
  display: grid;
  gap: 14px;
  padding: 20px;
  border: 1px solid rgba(32, 72, 67, 0.08);
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.78);
  box-shadow: 0 18px 42px rgba(24, 62, 57, 0.06);
  transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
}

.petpal-admin-card:hover {
  transform: translateY(-2px);
  border-color: rgba(24, 62, 57, 0.16);
  box-shadow: 0 24px 52px rgba(24, 62, 57, 0.1);
}

.petpal-admin-card__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 14px;
  background: #183e39;
  color: #f4fbf8;
}

.petpal-admin-card__copy {
  display: grid;
  gap: 8px;
}

.petpal-admin-card__copy small {
  color: #6d847c;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.petpal-admin-card__copy h2 {
  margin: 0;
  color: #183e39;
  font-size: 20px;
}

.petpal-admin-card__copy p {
  margin: 0;
  color: #5a6f67;
  line-height: 1.7;
}

@media (max-width: 900px) {
  .petpal-admin-hub__hero {
    padding: 22px;
  }
}
</style>
