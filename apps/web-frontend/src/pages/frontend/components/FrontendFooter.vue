<template>
  <footer class="frontend-footer">
    <div class="frontend-footer__inner">
      <div class="frontend-footer__meta">
        <strong>PetPal</strong>
        <small>公开页只做分流。</small>
      </div>

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
  grid-template-columns: minmax(180px, auto) minmax(0, 1fr);
  gap: 18px;
  width: min(1180px, calc(100vw - 32px));
  margin: 0 auto;
  padding: 0 0 28px;
}

.frontend-footer__meta {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 18px 0;
  border-top: 1px solid rgba(44, 37, 29, 0.1);
}

.frontend-footer__meta strong {
  color: #2b241f;
  font-size: 18px;
}

.frontend-footer__meta small {
  color: #6b625a;
  line-height: 1.6;
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

  .frontend-footer__meta {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
