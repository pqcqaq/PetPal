<template>
  <footer class="frontend-footer">
    <div class="frontend-footer__inner">
      <section class="frontend-footer__intro">
        <p class="frontend-footer__eyebrow">PetPal</p>
        <strong>宠托帮</strong>
        <small>主人 · 照料者 · 后台治理</small>
      </section>

      <section class="frontend-footer__links">
        <div>
          <span>页面</span>
          <RouterLink v-for="item in navItems" :key="item.to" :to="item.to">{{ item.label }}</RouterLink>
        </div>

        <div>
          <span>入口</span>
          <RouterLink :to="adminTarget">{{ adminLabel }}</RouterLink>
          <RouterLink to="/login">登录页</RouterLink>
        </div>
      </section>
    </div>
  </footer>
</template>

<script setup lang="ts">
defineProps<{
  navItems: Array<{ label: string; to: string; eyebrow: string }>;
  adminTarget: string;
  adminLabel: string;
}>();
</script>

<style scoped lang="scss">
.frontend-footer {
  margin-top: 32px;
  background: transparent;
}

.frontend-footer__inner {
  display: grid;
  grid-template-columns: minmax(220px, 0.7fr) minmax(0, 1fr);
  gap: 18px;
  width: min(1320px, calc(100vw - 32px));
  margin: 0 auto;
  padding: 0 0 40px;
}

.frontend-footer__intro {
  display: grid;
  gap: 8px;
  padding: 20px 22px;
  border: 1px solid rgba(18, 53, 51, 0.08);
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.78);
}

.frontend-footer__eyebrow {
  margin: 0;
  color: #6d7a80;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.26em;
  text-transform: uppercase;
}

.frontend-footer__intro strong {
  color: #143634;
  font-size: 20px;
}

.frontend-footer__intro small {
  color: #5f7673;
  line-height: 1.7;
}

.frontend-footer__links {
  display: grid;
  gap: 20px;
}

.frontend-footer__links div {
  display: grid;
  gap: 10px;
  padding: 20px 22px;
  border: 1px solid rgba(18, 53, 51, 0.08);
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.78);
}

.frontend-footer__links span {
  color: #6d7a80;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.22em;
  text-transform: uppercase;
}

.frontend-footer__links a {
  color: #17384a;
  font-weight: 700;
}

@media (max-width: 900px) {
  .frontend-footer__inner {
    grid-template-columns: 1fr;
  }
}
</style>
