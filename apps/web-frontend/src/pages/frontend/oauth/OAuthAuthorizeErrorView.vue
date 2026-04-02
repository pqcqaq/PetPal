<template>
  <div class="oauth-error">
    <section class="oauth-error__hero">
      <p class="oauth-error__eyebrow">OAuth 授权结果</p>
      <h1>授权没有完成</h1>
      <p>{{ displayDescription }}</p>

      <div class="oauth-error__actions">
        <RouterLink class="oauth-error__button is-secondary" to="/">回到首页</RouterLink>
        <RouterLink class="oauth-error__button is-primary" :to="nextTarget">{{ nextLabel }}</RouterLink>
      </div>
    </section>

    <section class="oauth-error__detail">
      <div class="oauth-error__detail-item">
        <span>错误代码</span>
        <strong>{{ displayError }}</strong>
      </div>
      <div class="oauth-error__detail-item">
        <span>处理建议</span>
        <p>请返回发起授权的业务应用后重新发起，或确认当前登录账号是否正确。</p>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const route = useRoute();
const auth = useAuthStore();

const displayError = computed(() => {
  const value = typeof route.query.error === 'string' ? route.query.error.trim() : '';
  return value || 'authorization_failed';
});

const displayDescription = computed(() => {
  const value = typeof route.query.error_description === 'string'
    ? route.query.error_description.trim()
    : '';
  return value || '本次接入授权未成功完成。';
});

const nextTarget = computed(() => auth.isAuthenticated ? '/petpal' : '/login');
const nextLabel = computed(() => auth.isAuthenticated ? '返回主人服务台' : '前往登录');
</script>

<style scoped lang="scss">
.oauth-error {
  display: grid;
  gap: 18px;
  max-width: 760px;
  margin: 0 auto;
  padding-bottom: 24px;
}

.oauth-error__hero,
.oauth-error__detail {
  display: grid;
  gap: 18px;
  padding: 28px;
  border: 1px solid rgba(150, 70, 44, 0.16);
  background:
    radial-gradient(circle at top right, rgba(194, 65, 12, 0.08), transparent 28%),
    linear-gradient(180deg, rgba(255, 248, 244, 0.98) 0%, rgba(255, 243, 238, 0.94) 100%);
  box-shadow: 0 24px 56px rgba(43, 36, 31, 0.08);
}

.oauth-error__eyebrow {
  margin: 0;
  color: #a65a42;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.22em;
  text-transform: uppercase;
}

.oauth-error__hero h1 {
  margin: 0;
  font-family: 'Playfair Display', 'STSong', serif;
  color: #2b241f;
  font-size: clamp(34px, 5vw, 48px);
  line-height: 0.98;
}

.oauth-error__hero p:not(.oauth-error__eyebrow),
.oauth-error__detail-item p {
  margin: 0;
  color: #62584f;
  line-height: 1.75;
}

.oauth-error__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.oauth-error__button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 46px;
  padding: 0 18px;
  border: 1px solid rgba(44, 37, 29, 0.12);
  background: #fffdf9;
  color: #332c26;
  font-size: 14px;
  font-weight: 700;
  transition: background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease;
  cursor: pointer;
}

.oauth-error__button.is-primary {
  border-color: #2563eb;
  background: #2563eb;
  color: #fff8ef;
}

.oauth-error__detail {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.oauth-error__detail-item {
  display: grid;
  gap: 8px;
}

.oauth-error__detail-item span {
  color: #a65a42;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.oauth-error__detail-item strong {
  color: #8a3b28;
  font-size: 20px;
  line-height: 1.25;
  word-break: break-word;
}

@media (max-width: 720px) {
  .oauth-error__hero,
  .oauth-error__detail {
    padding: 20px;
  }

  .oauth-error__actions {
    flex-direction: column;
  }

  .oauth-error__button {
    width: 100%;
  }

  .oauth-error__detail {
    grid-template-columns: 1fr;
  }
}

@media (prefers-reduced-motion: reduce) {
  .oauth-error__button {
    transition: none;
  }
}
</style>
