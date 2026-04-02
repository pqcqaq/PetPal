<template>
  <footer class="frontend-footer">
    <div class="frontend-footer__inner">
      <section class="frontend-footer__intro">
        <p class="frontend-footer__eyebrow">PetPal</p>
        <strong>宠托帮</strong>
        <small>入口只做分流，真正的操作放进各自工作台。</small>
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
  navItems: Array<{ label: string; to: string }>;
  adminTarget: string;
  adminLabel: string;
}>();
</script>

<style scoped lang="scss">
.frontend-footer {
  margin-top: 12px;
}

.frontend-footer__inner {
  display: grid;
  grid-template-columns: minmax(220px, 0.8fr) minmax(0, 1fr);
  gap: 18px;
  width: min(1180px, calc(100vw - 32px));
  margin: 0 auto;
  padding: 0 0 28px;
}

.frontend-footer__intro {
  display: grid;
  gap: 8px;
  padding: 18px 0;
  border-top: 1px solid rgba(44, 37, 29, 0.1);
}

.frontend-footer__eyebrow {
  margin: 0;
  color: #8f6c4f;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.22em;
  text-transform: uppercase;
}

.frontend-footer__intro strong {
  color: #2b241f;
  font-size: 20px;
}

.frontend-footer__intro small {
  color: #6b625a;
  line-height: 1.7;
}

.frontend-footer__links {
  display: grid;
  gap: 12px;
}

.frontend-footer__links div {
  display: flex;
  gap: 14px;
  align-items: center;
  flex-wrap: wrap;
  padding: 18px 0;
  border-top: 1px solid rgba(44, 37, 29, 0.1);
}

.frontend-footer__links span {
  color: #8f6c4f;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.frontend-footer__links a {
  color: #2b241f;
  font-weight: 700;
}

@media (max-width: 900px) {
  .frontend-footer__inner {
    grid-template-columns: 1fr;
  }
}
</style>
