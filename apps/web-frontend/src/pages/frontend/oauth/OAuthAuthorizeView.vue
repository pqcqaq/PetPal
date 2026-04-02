<template>
  <div class="oauth-gate">
    <section v-if="loading" class="oauth-gate__hero">
      <p class="oauth-gate__eyebrow">OAuth 授权</p>
      <h1>正在准备授权确认</h1>
      <p>系统正在读取应用信息与本次权限申请，通常只需要几秒。</p>
    </section>

    <section v-else-if="loadError" class="oauth-gate__hero is-error">
      <p class="oauth-gate__eyebrow">授权失败</p>
      <h1>这次授权无法继续</h1>
      <p>{{ loadError }}</p>
      <div class="oauth-gate__actions">
        <RouterLink class="oauth-gate__button is-secondary" to="/">回到首页</RouterLink>
        <RouterLink class="oauth-gate__button is-primary" to="/oauth/error?error=invalid_request">查看错误页</RouterLink>
      </div>
    </section>

    <template v-else-if="session">
      <header class="oauth-gate__hero">
        <div class="oauth-gate__hero-copy">
          <p class="oauth-gate__eyebrow">第三方应用授权</p>
          <h1>{{ session.application.name }}</h1>
          <p>
            {{ session.application.description || '该应用希望继续当前流程，需要读取你的 PetPal 账号资料与本次授权范围。' }}
          </p>
        </div>

        <div class="oauth-gate__meta-grid">
          <div class="oauth-gate__meta-item">
            <span>当前账号</span>
            <strong>{{ session.user.nickname }} · {{ session.user.username }}</strong>
          </div>
          <div class="oauth-gate__meta-item">
            <span>会话有效期</span>
            <strong>{{ expiresAtText }}</strong>
          </div>
        </div>
      </header>

      <section class="oauth-gate__panel">
        <div class="oauth-gate__panel-copy">
          <p class="oauth-gate__panel-eyebrow">授权范围</p>
          <h2>只确认这次真正需要的权限</h2>
          <p>同意后会立即跳回发起本次授权的业务应用。</p>
        </div>

        <ol v-if="session.scopes.length" class="oauth-gate__scope-list">
          <li v-for="scope in session.scopes" :key="scope.code" class="oauth-gate__scope-item">
            <div class="oauth-gate__scope-head">
              <strong>{{ scope.name }}</strong>
              <span>{{ scope.code }}</span>
            </div>
            <p>{{ scope.description }}</p>
          </li>
        </ol>

        <p v-else class="oauth-gate__scope-empty">
          当前授权申请没有声明具体权限，建议先拒绝并返回业务应用重新发起。
        </p>
      </section>

      <section class="oauth-gate__decision">
        <div class="oauth-gate__panel-copy">
          <p class="oauth-gate__panel-eyebrow">下一步</p>
          <h2>确认后立刻返回业务应用</h2>
          <p>如果你不认识这个应用，或本次申请范围超出预期，直接拒绝即可。</p>
        </div>

        <div class="oauth-gate__actions">
          <button
            class="oauth-gate__button is-secondary"
            type="button"
            :disabled="submitting"
            @click="submitDecision('deny')"
          >
            拒绝授权
          </button>
          <button
            class="oauth-gate__button is-primary"
            type="button"
            :disabled="submitting"
            @click="submitDecision('approve')"
          >
            {{ submitting ? '处理中...' : '同意并继续' }}
          </button>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { OAuthAuthorizeDecision, OAuthAuthorizeSessionView } from '@rbac/api-common';
import { computed, onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { useRoute, useRouter } from 'vue-router';
import { api } from '@/api/client';
import { getErrorMessage } from '@/utils/errors';

const route = useRoute();
const router = useRouter();
const loading = ref(true);
const submitting = ref(false);
const loadError = ref('');
const session = ref<OAuthAuthorizeSessionView | null>(null);

const sessionState = computed(() =>
  typeof route.query.session_state === 'string' ? route.query.session_state.trim() : '',
);

const expiresAtText = computed(() => {
  if (!session.value?.expiresAt) {
    return '-';
  }

  const date = new Date(session.value.expiresAt);
  if (Number.isNaN(date.getTime())) {
    return session.value.expiresAt;
  }

  return date.toLocaleString('zh-CN', { hour12: false });
});

const navigateToLogin = () => {
  const returnTo = encodeURIComponent(window.location.href);
  window.location.assign(`/login?returnTo=${returnTo}`);
};

const navigateToError = (error: string, description: string) => {
  router.replace({
    name: 'frontend-oauth-error',
    query: {
      error,
      error_description: description,
    },
  });
};

const loadSession = async () => {
  if (!sessionState.value) {
    navigateToError('invalid_request', 'missing session_state');
    return;
  }

  try {
    loading.value = true;
    loadError.value = '';
    session.value = await api.oauth.authorizeSessions.detail(sessionState.value);
  } catch (error: unknown) {
    const status = typeof error === 'object' && error !== null
      ? Reflect.get(error, 'status')
      : undefined;

    if (status === 401) {
      navigateToLogin();
      return;
    }

    loadError.value = getErrorMessage(error, '加载授权会话失败');
    ElMessage.error(loadError.value);
  } finally {
    loading.value = false;
  }
};

const submitDecision = async (decision: OAuthAuthorizeDecision) => {
  if (!sessionState.value) {
    navigateToError('invalid_request', 'missing session_state');
    return;
  }

  try {
    submitting.value = true;
    const result = await api.oauth.authorizeSessions.decide(sessionState.value, decision);
    window.location.assign(result.redirectUrl);
  } catch (error: unknown) {
    const status = typeof error === 'object' && error !== null
      ? Reflect.get(error, 'status')
      : undefined;

    if (status === 401) {
      navigateToLogin();
      return;
    }

    const message = getErrorMessage(error, '提交授权决策失败');
    ElMessage.error(message);
  } finally {
    submitting.value = false;
  }
};

onMounted(async () => {
  await loadSession();
});
</script>

<style scoped lang="scss">
.oauth-gate {
  display: grid;
  gap: 18px;
  max-width: 860px;
  margin: 0 auto;
  padding-bottom: 24px;
}

.oauth-gate__hero,
.oauth-gate__panel,
.oauth-gate__decision {
  display: grid;
  gap: 18px;
  padding: 28px;
  border: 1px solid rgba(44, 37, 29, 0.12);
  background: rgba(255, 252, 248, 0.92);
  box-shadow: 0 24px 56px rgba(43, 36, 31, 0.08);
}

.oauth-gate__hero {
  background:
    radial-gradient(circle at top right, rgba(37, 99, 235, 0.08), transparent 26%),
    linear-gradient(180deg, rgba(255, 251, 247, 0.98) 0%, rgba(252, 247, 241, 0.94) 100%);
}

.oauth-gate__hero.is-error {
  border-color: rgba(160, 74, 48, 0.18);
  background:
    radial-gradient(circle at top right, rgba(194, 65, 12, 0.08), transparent 26%),
    linear-gradient(180deg, rgba(255, 248, 244, 0.98) 0%, rgba(255, 244, 239, 0.94) 100%);
}

.oauth-gate__eyebrow,
.oauth-gate__panel-eyebrow {
  margin: 0;
  color: #8f6c4f;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.22em;
  text-transform: uppercase;
}

.oauth-gate__hero-copy,
.oauth-gate__panel-copy {
  display: grid;
  gap: 10px;
}

.oauth-gate__hero h1,
.oauth-gate__panel h2,
.oauth-gate__decision h2 {
  margin: 0;
  font-family: 'Playfair Display', 'STSong', serif;
  color: #2b241f;
  line-height: 0.98;
}

.oauth-gate__hero h1 {
  font-size: clamp(34px, 5vw, 54px);
}

.oauth-gate__panel h2,
.oauth-gate__decision h2 {
  font-size: clamp(24px, 3vw, 32px);
}

.oauth-gate__hero p:not(.oauth-gate__eyebrow),
.oauth-gate__panel-copy p:not(.oauth-gate__panel-eyebrow),
.oauth-gate__scope-item p,
.oauth-gate__scope-empty {
  margin: 0;
  color: #62584f;
  line-height: 1.75;
}

.oauth-gate__meta-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.oauth-gate__meta-item {
  display: grid;
  gap: 6px;
  padding-top: 14px;
  border-top: 1px solid rgba(44, 37, 29, 0.1);
}

.oauth-gate__meta-item span {
  color: #8f7b69;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.oauth-gate__meta-item strong {
  color: #2b241f;
  font-size: 16px;
  line-height: 1.6;
}

.oauth-gate__scope-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 12px;
}

.oauth-gate__scope-item {
  display: grid;
  gap: 8px;
  padding: 16px 0;
  border-top: 1px solid rgba(44, 37, 29, 0.1);
}

.oauth-gate__scope-head {
  display: flex;
  gap: 12px;
  justify-content: space-between;
  align-items: baseline;
  flex-wrap: wrap;
}

.oauth-gate__scope-head strong {
  color: #2b241f;
  font-size: 16px;
}

.oauth-gate__scope-head span {
  color: #8f6c4f;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.oauth-gate__scope-empty {
  padding-top: 14px;
  border-top: 1px solid rgba(44, 37, 29, 0.1);
}

.oauth-gate__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.oauth-gate__button {
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

.oauth-gate__button.is-primary {
  border-color: #2563eb;
  background: #2563eb;
  color: #fff8ef;
}

.oauth-gate__button:disabled {
  cursor: not-allowed;
  opacity: 0.7;
}

@media (max-width: 720px) {
  .oauth-gate__hero,
  .oauth-gate__panel,
  .oauth-gate__decision {
    padding: 20px;
  }

  .oauth-gate__meta-grid {
    grid-template-columns: 1fr;
  }

  .oauth-gate__actions {
    flex-direction: column;
  }

  .oauth-gate__button {
    width: 100%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .oauth-gate__button {
    transition: none;
  }
}
</style>
