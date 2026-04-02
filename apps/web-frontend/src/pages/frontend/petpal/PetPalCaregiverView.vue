<!--
UX Blueprint
User: 已登录照料者，需要先判断现在该补资料、管服务还是处理履约
Entry: 前台照料者入口、订单或提醒回流
First screen: 审核状态、服务数量、待接单和服务中数量
Primary action: 去入驻资料、服务清单或履约订单
Secondary actions: 去消息、提醒、主人总览
States: 未登录、加载失败、可继续办事
-->
<template>
  <div class="frontend-page">
    <PetPalWorkspaceHero
      eyebrow="照料者工作区"
      title="照料者任务总览"
      summary="总览页只给出当前最该处理的工作。档案、服务和履约已经拆去独立页面，不再塞进一页大工作台。"
      :nav-items="petPalCaregiverWorkspaceNav"
      active-name="frontend-petpal-caregiver"
      :stats="heroStats"
      :primary-action="heroPrimaryAction"
      :actions="heroActions"
    />

    <template v-if="auth.isAuthenticated">
      <section v-if="pageLoadState === 'error'" class="frontend-card">
        <PetPalStatePanel
          eyebrow="照料者工作区"
          title="照料者总览加载失败"
          :description="pageLoadErrorMessage"
          tone="danger"
        >
          <template #actions>
            <el-button size="small" type="primary" :loading="loading" @click="loadPage">重试加载</el-button>
          </template>
        </PetPalStatePanel>
      </section>

      <template v-else>
        <section class="frontend-page__section-grid">
          <article class="frontend-card petpal-grid-span-6">
            <span class="frontend-card__eyebrow">现在先做这个</span>
            <div class="petpal-focus-card">
              <div class="petpal-focus-card__copy">
                <h3>{{ primaryTask.title }}</h3>
                <p>{{ primaryTask.hint }}</p>
              </div>
              <RouterLink class="frontend-page__button is-primary" :to="primaryTask.to">
                {{ primaryTask.actionLabel }}
              </RouterLink>
            </div>
          </article>

          <article class="frontend-card petpal-grid-span-6">
            <span class="frontend-card__eyebrow">履约状态</span>
            <div class="petpal-queue-list">
              <div class="petpal-queue-item">
                <div>
                  <strong>待接单</strong>
                  <p>{{ pendingAcceptHint }}</p>
                </div>
                <RouterLink :to="{ name: 'frontend-petpal-caregiver-orders' }">去履约队列</RouterLink>
              </div>
              <div class="petpal-queue-item">
                <div>
                  <strong>服务中</strong>
                  <p>{{ servingHint }}</p>
                </div>
                <RouterLink :to="{ name: 'frontend-petpal-caregiver-orders' }">继续履约</RouterLink>
              </div>
              <div class="petpal-queue-item">
                <div>
                  <strong>消息与提醒</strong>
                  <p>沟通和待办都拆成独立页面，不再塞进照料者总览首屏。</p>
                </div>
                <div class="petpal-inline-actions">
                  <RouterLink :to="{ name: 'frontend-petpal-messages' }">消息</RouterLink>
                  <RouterLink :to="{ name: 'frontend-petpal-reminders' }">提醒</RouterLink>
                </div>
              </div>
            </div>
          </article>
        </section>

        <section class="frontend-page__section-grid">
          <article class="frontend-card petpal-grid-span-4">
            <span class="frontend-card__eyebrow">入驻资料</span>
            <div class="petpal-section-head">
              <h3>{{ caregiverProfile ? '审核与资料' : '还没有照料者档案' }}</h3>
              <RouterLink :to="{ name: 'frontend-petpal-caregiver-profile' }">查看详情</RouterLink>
            </div>
            <div v-if="caregiverProfile" class="petpal-card-stack">
              <div class="petpal-compact-card">
                <div class="petpal-compact-card__head">
                  <strong>审核状态</strong>
                  <span>{{ caregiverProfile.auditStatus }}</span>
                </div>
                <p>{{ caregiverProfile.serviceCity || '服务城市待补充' }} · {{ caregiverProfile.experienceYears }} 年经验</p>
                <p>{{ caregiverProfile.specialtyTags.length ? caregiverProfile.specialtyTags.join(' / ') : '专长标签待补充' }}</p>
              </div>
            </div>
            <PetPalStatePanel
              v-else
              eyebrow="入驻资料"
              title="先建立照料者档案"
              description="没有入驻资料时，服务和接单都无法稳定继续。"
            />
          </article>

          <article class="frontend-card petpal-grid-span-4">
            <span class="frontend-card__eyebrow">服务管理</span>
            <div class="petpal-section-head">
              <h3>{{ caregiverServices.length ? `当前 ${caregiverServices.length} 项服务` : '还没有服务' }}</h3>
              <RouterLink :to="{ name: 'frontend-petpal-caregiver-services' }">查看详情</RouterLink>
            </div>
            <div v-if="caregiverServices.length" class="petpal-card-stack">
              <div v-for="service in caregiverServices.slice(0, 3)" :key="service.id" class="petpal-compact-card">
                <div class="petpal-compact-card__head">
                  <strong>{{ service.serviceType }} · {{ service.petSpecies }}</strong>
                  <span>{{ service.isActive ? '在售' : '停用' }}</span>
                </div>
                <p>¥{{ formatPetPalAmount(service.pricePerUnit) }}/{{ service.unitType }}</p>
                <p>{{ service.serviceCity || '城市待补充' }} · 提前 {{ service.minNoticeHours }} 小时</p>
              </div>
            </div>
            <PetPalStatePanel
              v-else
              eyebrow="服务管理"
              title="先建立第一项服务"
              description="服务清单和服务表单已经拆开，先去新建可售服务。"
            />
          </article>

          <article class="frontend-card petpal-grid-span-4">
            <span class="frontend-card__eyebrow">履约队列</span>
            <div class="petpal-section-head">
              <h3>{{ caregiverOrders.length ? `当前 ${caregiverOrders.length} 笔订单` : '当前没有订单' }}</h3>
              <RouterLink :to="{ name: 'frontend-petpal-caregiver-orders' }">查看详情</RouterLink>
            </div>
            <div v-if="caregiverOrders.length" class="petpal-card-stack">
              <div v-for="order in caregiverOrders.slice(0, 3)" :key="order.id" class="petpal-compact-card">
                <div class="petpal-compact-card__head">
                  <strong>{{ order.orderNo }}</strong>
                  <span>{{ order.orderStatus }}</span>
                </div>
                <p>{{ order.ownerNickname }} · {{ order.petName || '宠物待同步' }}</p>
                <p>{{ formatPetPalRange(order.appointmentStart, order.appointmentEnd) }}</p>
              </div>
            </div>
            <PetPalStatePanel
              v-else
              eyebrow="履约队列"
              title="当前没有照料订单"
              description="补好档案和服务后，再回这里处理接单、签到和签退。"
            />
          </article>
        </section>
      </template>
    </template>

    <section v-else class="frontend-card">
      <PetPalStatePanel
        eyebrow="照料者工作区"
        title="登录后继续照料者任务"
        description="登录后从总览页直接进入入驻资料、服务清单和履约队列。"
      >
        <template #actions>
          <RouterLink to="/login">
            <el-button size="small" type="primary">去登录</el-button>
          </RouterLink>
        </template>
      </PetPalStatePanel>
    </section>
  </div>
</template>

<script setup lang="ts">
import type { CaregiverOrderRecord, CaregiverProfileRecord, CaregiverServiceRecord } from '@rbac/api-common';
import { computed, onMounted, ref } from 'vue';
import { ElButton } from 'element-plus';
import { api } from '@/api/client';
import PetPalStatePanel from '@/pages/frontend/petpal/PetPalStatePanel.vue';
import PetPalWorkspaceHero from '@/pages/frontend/petpal/components/PetPalWorkspaceHero.vue';
import { useAuthStore } from '@/stores/auth';
import { getErrorMessage } from '@/utils/errors';
import { formatPetPalAmount, formatPetPalRange, petPalCaregiverWorkspaceNav } from './shared';

const auth = useAuthStore();

const loading = ref(false);
const pageLoadState = ref<'idle' | 'ready' | 'error'>('idle');
const pageLoadErrorMessage = ref('');

const caregiverProfile = ref<CaregiverProfileRecord | null>(null);
const caregiverServices = ref<CaregiverServiceRecord[]>([]);
const caregiverOrders = ref<CaregiverOrderRecord[]>([]);

const pendingAcceptOrders = computed(() => caregiverOrders.value.filter((item) => item.orderStatus === 'PENDING_ACCEPT'));
const servingOrders = computed(() => caregiverOrders.value.filter((item) => item.orderStatus === 'SERVING'));

const heroStats = computed(() => [
  {
    label: '审核状态',
    value: caregiverProfile.value?.auditStatus || '未建档',
    hint: caregiverProfile.value ? '档案和资质已独立成表单页' : '先去入驻资料页',
  },
  {
    label: '上架服务',
    value: String(caregiverServices.value.filter((item) => item.isActive).length),
    hint: caregiverServices.value.length ? '服务清单独立维护' : '先建立第一项服务',
  },
  {
    label: '待接单',
    value: String(pendingAcceptOrders.value.length),
    hint: pendingAcceptOrders.value.length ? '优先进入履约队列' : '当前没有待接单订单',
  },
  {
    label: '服务中',
    value: String(servingOrders.value.length),
    hint: servingOrders.value.length ? '继续签到、记录和签退' : '当前没有服务中订单',
  },
]);

const heroPrimaryAction = computed(() => {
  if (!caregiverProfile.value) {
    return {
      label: '先建入驻资料',
      to: { name: 'frontend-petpal-caregiver-profile' },
    };
  }
  if (!caregiverServices.value.length) {
    return {
      label: '新建服务',
      to: { name: 'frontend-petpal-caregiver-service-create' },
    };
  }
  return {
    label: '去履约队列',
    to: { name: 'frontend-petpal-caregiver-orders' },
  };
});

const heroActions = computed(() => [
  { label: '主人总览', to: { name: 'frontend-petpal' }, tone: 'secondary' as const },
  { label: '消息中心', to: { name: 'frontend-petpal-messages' }, tone: 'secondary' as const },
  { label: '提醒中心', to: { name: 'frontend-petpal-reminders' }, tone: 'secondary' as const },
]);

const primaryTask = computed(() => {
  if (!caregiverProfile.value) {
    return {
      title: '先补齐照料者入驻资料',
      hint: '没有入驻资料时，服务清单和履约队列都不会稳定可用。',
      actionLabel: '去入驻资料',
      to: { name: 'frontend-petpal-caregiver-profile' },
    };
  }
  if (!caregiverServices.value.length) {
    return {
      title: '先建立第一项服务',
      hint: '服务清单已经拆成列表页和表单页，先补一项可售服务。',
      actionLabel: '去新建服务',
      to: { name: 'frontend-petpal-caregiver-service-create' },
    };
  }
  if (pendingAcceptOrders.value.length) {
    return {
      title: '先处理待接单订单',
      hint: `当前有 ${pendingAcceptOrders.value.length} 笔订单待接单，建议直接进履约队列。`,
      actionLabel: '去履约队列',
      to: { name: 'frontend-petpal-caregiver-orders' },
    };
  }
  if (servingOrders.value.length) {
    return {
      title: '继续服务中的订单',
      hint: `当前有 ${servingOrders.value.length} 笔订单在服务中，建议继续签到、记录和签退。`,
      actionLabel: '继续履约',
      to: { name: 'frontend-petpal-caregiver-orders' },
    };
  }
  return {
    title: '继续维护服务组合',
    hint: '当前没有紧急履约任务，可以去服务清单调整价格、城市和上架状态。',
    actionLabel: '去服务清单',
    to: { name: 'frontend-petpal-caregiver-services' },
  };
});

const pendingAcceptHint = computed(() => pendingAcceptOrders.value.length
  ? `${pendingAcceptOrders.value.length} 笔订单等待你接单。`
  : '当前没有待接单订单。');

const servingHint = computed(() => servingOrders.value.length
  ? `${servingOrders.value.length} 笔订单正在服务中。`
  : '当前没有服务中订单。');

async function loadPage() {
  if (!auth.isAuthenticated || loading.value) {
    return;
  }

  loading.value = true;
  pageLoadState.value = 'idle';
  pageLoadErrorMessage.value = '';

  try {
    const [profileResult, servicesResult, ordersResult] = await Promise.all([
      api.petpal.caregiver.profile(),
      api.petpal.caregiver.services(),
      api.petpal.caregiver.orders({ page: 1, pageSize: 20 }),
    ]);
    caregiverProfile.value = profileResult;
    caregiverServices.value = servicesResult;
    caregiverOrders.value = ordersResult.items;
    pageLoadState.value = 'ready';
  } catch (error: unknown) {
    caregiverProfile.value = null;
    caregiverServices.value = [];
    caregiverOrders.value = [];
    pageLoadState.value = 'error';
    pageLoadErrorMessage.value = getErrorMessage(error, '加载照料者总览失败');
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  if (!auth.isAuthenticated) {
    return;
  }
  void loadPage();
});
</script>

<style scoped lang="scss">
.petpal-grid-span-4 {
  grid-column: span 4;
}

.petpal-grid-span-6 {
  grid-column: span 6;
}

.petpal-focus-card,
.petpal-focus-card__copy,
.petpal-card-stack,
.petpal-compact-card,
.petpal-compact-card__head,
.petpal-queue-list,
.petpal-queue-item,
.petpal-section-head,
.petpal-inline-actions {
  display: flex;
  gap: 12px;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
}

.petpal-focus-card__copy,
.petpal-card-stack,
.petpal-compact-card,
.petpal-queue-list {
  display: grid;
}

.petpal-section-head {
  margin-bottom: 4px;
}

.petpal-section-head a,
.petpal-inline-actions a,
.petpal-queue-item a {
  color: #0f766e;
  font-weight: 700;
  text-decoration: none;
}

.petpal-queue-list,
.petpal-card-stack {
  gap: 14px;
}

.petpal-queue-item,
.petpal-compact-card {
  padding: 16px;
  border-radius: 18px;
  border: 1px solid rgba(18, 53, 51, 0.08);
  background: rgba(248, 252, 251, 0.86);
}

.petpal-compact-card__head span {
  color: #6d8683;
  font-size: 12px;
}

@media (max-width: 1080px) {
  .petpal-grid-span-4,
  .petpal-grid-span-6 {
    grid-column: span 12;
  }
}
</style>
