<template>
  <PetPalDeskPage
    eyebrow="收益表现"
    title="收益页只看经营结果，不再把复盘塞回履约队列"
    summary="收益摘要改由后端直接聚合，页面只消费统一口径的收入、风险和服务结构数据。"
    :nav-items="petPalCaregiverWorkspaceNav"
    active-name="frontend-petpal-caregiver-earnings"
    :primary-action="primaryAction"
    :actions="heroActions"
    :stats="heroStats"
  >
    <template v-if="pageNotice" #notice>
      <PetPalDeskNotice
        eyebrow="Handoff"
        :title="pageNotice.title"
        :description="pageNotice.description"
        :tone="pageNotice.tone"
      >
        <template #actions>
          <el-button
            v-if="summaryState === 'error'"
            :loading="sectionReloadingKey === 'summary'"
            @click="retrySummary"
          >
            重试收益摘要
          </el-button>
        </template>
      </PetPalDeskNotice>
    </template>

    <PetPalDeskSection
      eyebrow="Snapshot"
      title="收益总览"
      description="只统计已完成订单收入，把售后敞口单独暴露出来。"
    >
      <template #actions>
        <el-button
          v-if="summaryState === 'error'"
          :loading="sectionReloadingKey === 'summary'"
          @click="retrySummary"
        >
          重试收益摘要
        </el-button>
        <RouterLink
          v-else-if="latestActiveOrder"
          :to="
            buildOrdersRoute(
              '这里已经定位到当前最优先的一笔履约订单，可直接继续接单或签到。',
              latestActiveOrder.id,
            )
          "
        >
          回履约队列
        </RouterLink>
      </template>

      <PetPalDeskEmpty
        v-if="summaryState === 'error'"
        title="收益摘要暂未刷新完成"
        description="可以先重试收益摘要，恢复后再继续查看累计收入和售后风险。"
      />

      <PetPalDeskEmpty
        v-else-if="!totals.completedOrderCount && !totals.aftersalesOrderCount"
        title="还没有可复盘的收益数据"
        description="完成第一笔订单后，这里会开始累计收入、客单价和近 30 天表现。"
      >
        <template #actions>
          <RouterLink
            class="frontend-page__button is-primary"
            :to="
              buildOrdersRoute(
                '这里已经回到履约队列，可先继续接单、签到或签退。',
                latestActiveOrder?.id,
              )
            "
          >
            去履约队列
          </RouterLink>
        </template>
      </PetPalDeskEmpty>

      <div v-else class="petpal-metric-grid">
        <article v-for="item in revenueCards" :key="item.label" class="petpal-metric-card">
          <p>{{ item.label }}</p>
          <strong>{{ item.value }}</strong>
          <span>{{ item.hint }}</span>
        </article>
      </div>
    </PetPalDeskSection>

    <div class="petpal-split-grid">
      <PetPalDeskSection
        class="petpal-span-5"
        eyebrow="Signals"
        title="口碑与服务信号"
        description="评分、审核和在售服务一起看，判断经营底盘是否稳定。"
      >
        <template #actions>
          <el-button
            v-if="summaryState === 'error'"
            :loading="sectionReloadingKey === 'summary'"
            @click="retrySummary"
          >
            重试收益摘要
          </el-button>
          <RouterLink
            v-else
            :to="buildProfileRoute('这里已经定位到照料者资料页，可继续补齐资料和审核信息。')"
          >
            维护资料
          </RouterLink>
          <RouterLink
            v-if="summaryState !== 'error'"
            :to="buildServicesRoute('这里已经定位到服务清单，可继续调整在售服务和价格。')"
          >
            查看服务
          </RouterLink>
        </template>

        <PetPalDeskEmpty
          v-if="summaryState === 'error'"
          title="口碑与服务信号暂未刷新完成"
          description="可以先重试收益摘要，恢复后再继续查看评分、审核和在售服务。"
        />

        <template v-else>
          <div class="petpal-metric-grid petpal-metric-grid--compact">
            <article v-for="item in qualityCards" :key="item.label" class="petpal-metric-card">
              <p>{{ item.label }}</p>
              <strong>{{ item.value }}</strong>
              <span>{{ item.hint }}</span>
            </article>
          </div>

          <div class="petpal-note-list">
            <div class="petpal-note-row">
              <span>服务城市</span>
              <strong>{{ profile?.serviceCity || '待补充' }}</strong>
            </div>
            <div class="petpal-note-row">
              <span>经验 / 半径</span>
              <strong>{{
                profile
                  ? `${profile.experienceYears} 年 / ${profile.serviceRadiusKm} km`
                  : '资料待补充'
              }}</strong>
            </div>
            <div class="petpal-note-row">
              <span>当前履约中</span>
              <strong>{{ totals.activeOrderCount }} 笔</strong>
            </div>
          </div>
        </template>
      </PetPalDeskSection>

      <PetPalDeskSection
        class="petpal-span-7"
        eyebrow="Mix"
        title="服务收入结构"
        description="只看已完成订单，帮助判断哪类服务在稳定赚钱。"
      >
        <template #actions>
          <el-button
            v-if="summaryState === 'error'"
            :loading="sectionReloadingKey === 'summary'"
            @click="retrySummary"
          >
            重试收益摘要
          </el-button>
          <RouterLink
            v-else
            :to="
              buildServicesRoute('这里已经定位到服务清单，可继续根据收入结构调整价格和上架状态。')
            "
          >
            看服务清单
          </RouterLink>
        </template>

        <PetPalDeskEmpty
          v-if="summaryState === 'error'"
          title="收入结构暂未刷新完成"
          description="可以先重试收益摘要，恢复后再继续查看各服务类型的收入占比。"
        />

        <PetPalDeskEmpty
          v-else-if="!serviceRevenueMix.length"
          title="还没有形成收入结构"
          description="完成第一笔订单后，这里会开始按服务类型归集收入和客单价。"
        />

        <div v-else class="petpal-mix-list">
          <div v-for="item in serviceRevenueMix" :key="item.serviceType" class="petpal-mix-row">
            <div class="petpal-mix-row__copy">
              <h3>{{ item.label }}</h3>
              <p>
                {{ item.orderCount }} 笔已完成订单 · 平均每单
                {{ formatPetPalMoney(item.averageTicket) }}
              </p>
            </div>
            <div class="petpal-mix-row__tail">
              <strong>{{ formatPetPalMoney(item.revenue) }}</strong>
              <span>{{ item.shareLabel }}</span>
            </div>
          </div>
        </div>
      </PetPalDeskSection>
    </div>

    <PetPalDeskSection
      eyebrow="Completed"
      title="最近完成的订单"
      description="履约已经结束的订单才会进入这里，方便复盘而不是再回履约动作。"
    >
      <template #actions>
        <el-button
          v-if="summaryState === 'error'"
          :loading="sectionReloadingKey === 'summary'"
          @click="retrySummary"
        >
          重试收益摘要
        </el-button>
      </template>

      <PetPalDeskEmpty
        v-if="summaryState === 'error'"
        title="最近完成订单暂未刷新完成"
        description="可以先重试收益摘要，恢复后再继续查看最近完成的订单复盘。"
      />

      <PetPalDeskEmpty
        v-else-if="!recentCompletedOrders.length"
        title="还没有完成订单"
        description="完成第一笔订单后，这里会开始沉淀复盘对象，不再把你引回履约动作。"
      />

      <div v-else class="petpal-sheet-list">
        <div
          v-for="order in recentCompletedOrders"
          :key="order.id"
          class="petpal-sheet-row"
          :class="{ 'is-focused': order.id === highlightedOrderId }"
        >
          <div class="petpal-sheet-row__copy">
            <h3 class="petpal-sheet-row__title">{{ order.orderNo }}</h3>
            <p class="petpal-sheet-row__desc">
              {{ getPetPalServiceTypeLabel(order.serviceType) }} · {{ order.ownerNickname }} ·
              {{ order.petName || '宠物待同步' }}
            </p>
            <p class="petpal-sheet-row__desc">
              {{ formatPetPalRange(order.appointmentStart, order.appointmentEnd) }}
            </p>
          </div>
          <div class="petpal-sheet-row__tail">
            <span class="petpal-pill is-success">{{
              formatPetPalMoney(getOrderNetIncome(order))
            }}</span>
            <RouterLink :to="buildOrderDetailLink(order.id)">查看订单</RouterLink>
          </div>
        </div>
      </div>
    </PetPalDeskSection>
  </PetPalDeskPage>
</template>

<script setup lang="ts">
import type {
  CaregiverEarningsOrderRecord,
  CaregiverEarningsSummaryRecord,
} from '@rbac/api-common';
import { computed, onMounted, ref } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import { api } from '@/api/client';
import { getErrorMessage } from '@/utils/errors';
import PetPalDeskEmpty from './rebuild/petpal-desk-empty.vue';
import PetPalDeskNotice from './rebuild/petpal-desk-notice.vue';
import PetPalDeskPage from './rebuild/petpal-desk-page.vue';
import PetPalDeskSection from './rebuild/petpal-desk-section.vue';
import {
  buildPetPalPageNotice,
  buildPetPalDeskHandoffQuery,
  getPetPalQueryString,
  runPetPalSectionRetry,
  type PetPalSectionLoadState,
} from './recovery';
import {
  formatPetPalMoney,
  formatPetPalRange,
  getPetPalCaregiverAuditLabel,
  getPetPalServiceTypeLabel,
  petPalCaregiverWorkspaceNav,
} from './shared';

const route = useRoute();
const summary = ref<CaregiverEarningsSummaryRecord | null>(null);
const summaryState = ref<PetPalSectionLoadState>('idle');
const sectionReloadingKey = ref<'' | 'summary'>('');

const emptyTotals: CaregiverEarningsSummaryRecord['totals'] = {
  totalIncome: 0,
  recentThirtyDayIncome: 0,
  averageTicket: 0,
  refundExposure: 0,
  completedOrderCount: 0,
  activeOrderCount: 0,
  aftersalesOrderCount: 0,
  aftersalesRiskRate: 0,
  activeServiceCount: 0,
  totalServiceCount: 0,
};

const toAmount = (value: number | string | null | undefined) => Number(value ?? 0);
const formatPercent = (value: number) =>
  `${(Math.max(value, 0) * 100).toFixed(value > 0 && value < 0.1 ? 1 : 0)}%`;
const getOrderNetIncome = (
  order: Pick<CaregiverEarningsOrderRecord, 'amountPaid' | 'amountRefunded'>,
) => Math.max(toAmount(order.amountPaid) - toAmount(order.amountRefunded), 0);

const profile = computed(() => summary.value?.profile ?? null);
const totals = computed(() => summary.value?.totals ?? emptyTotals);
const auditLabel = computed(() =>
  profile.value ? getPetPalCaregiverAuditLabel(profile.value.auditStatus) : '未建档',
);
const highlightedOrderId = computed(() => getPetPalQueryString(route.query, 'focusOrderId'));
const latestActiveOrder = computed(() => summary.value?.latestActiveOrder ?? null);
const recentCompletedOrders = computed(() => {
  const items = [...(summary.value?.recentCompletedOrders ?? [])];
  if (highlightedOrderId.value) {
    const highlightedIndex = items.findIndex((item) => item.id === highlightedOrderId.value);
    if (highlightedIndex > 0) {
      items.unshift(items.splice(highlightedIndex, 1)[0]);
    }
  }
  return items;
});
const serviceRevenueMix = computed(
  () =>
    summary.value?.serviceRevenueMix.map((item) => ({
      ...item,
      label: getPetPalServiceTypeLabel(item.serviceType),
      shareLabel: formatPercent(item.shareRatio),
    })) ?? [],
);
const revenueCards = computed(() => [
  {
    label: '累计收入',
    value: formatPetPalMoney(totals.value.totalIncome),
    hint: `已完成 ${totals.value.completedOrderCount} 笔订单`,
  },
  {
    label: '近 30 天收入',
    value: formatPetPalMoney(totals.value.recentThirtyDayIncome),
    hint: '按订单预约结束时间统计',
  },
  {
    label: '平均客单价',
    value: formatPetPalMoney(totals.value.averageTicket),
    hint: totals.value.completedOrderCount ? '只统计已完成订单' : '完成首单后开始累计',
  },
  {
    label: '售后风险',
    value: formatPercent(totals.value.aftersalesRiskRate),
    hint: `退款敞口 ${formatPetPalMoney(totals.value.refundExposure)}`,
  },
]);
const qualityCards = computed(() => [
  {
    label: '资料审核',
    value: auditLabel.value,
    hint:
      profile.value?.auditStatus === 'APPROVED' ? '收益页不承接资料编辑' : '先补齐资料和资质材料',
  },
  {
    label: '评分',
    value: profile.value ? Number(profile.value.ratingAvg).toFixed(1) : '--',
    hint: profile.value ? `共 ${profile.value.ratingCount} 条评价` : '资料未建立时暂无评分',
  },
  {
    label: '在售服务',
    value: String(totals.value.activeServiceCount),
    hint: `全部服务 ${totals.value.totalServiceCount} 个`,
  },
  {
    label: '当前履约',
    value: String(totals.value.activeOrderCount),
    hint: totals.value.activeOrderCount ? '有活跃履约任务待处理' : '当前没有履约积压',
  },
]);
const heroStats = computed(() => [
  {
    label: '累计收入',
    value: formatPetPalMoney(totals.value.totalIncome),
    hint: totals.value.completedOrderCount ? '只统计已完成订单' : '完成首单后开始累计',
  },
  {
    label: '近 30 天',
    value: formatPetPalMoney(totals.value.recentThirtyDayIncome),
    hint: '方便判断最近经营节奏',
  },
  {
    label: '完成单量',
    value: String(totals.value.completedOrderCount),
    hint: totals.value.averageTicket
      ? `平均每单 ${formatPetPalMoney(totals.value.averageTicket)}`
      : '暂无稳定客单',
  },
  {
    label: '售后风险',
    value: formatPercent(totals.value.aftersalesRiskRate),
    hint: `风险订单 ${totals.value.aftersalesOrderCount} 笔`,
  },
]);
const pageNotice = computed(() =>
  buildPetPalPageNotice({
    baseNotice: getPetPalQueryString(route.query, 'notice'),
    warnings: [
      summaryState.value === 'error' ? '收益摘要暂未刷新完成，可重试后继续查看经营数据' : '',
    ],
    successTitle: '已进入收益页',
    warningTitle: '收益页摘要仍未刷新完成',
  }),
);

function buildDashboardRoute(notice: string) {
  return {
    name: 'frontend-petpal-caregiver',
    query: buildPetPalDeskHandoffQuery({ notice }),
  };
}

function buildOrdersRoute(notice: string, orderId?: string) {
  return {
    name: 'frontend-petpal-caregiver-orders',
    query: buildPetPalDeskHandoffQuery({
      notice,
      ...(orderId ? { focusOrderId: orderId } : {}),
      focusRole: 'caregiver',
    }),
  };
}

function buildServicesRoute(notice: string, serviceId?: string) {
  return {
    name: 'frontend-petpal-caregiver-services',
    query: buildPetPalDeskHandoffQuery({
      notice,
      ...(serviceId ? { focusServiceId: serviceId } : {}),
    }),
  };
}

function buildProfileRoute(notice: string) {
  return {
    name: 'frontend-petpal-caregiver-profile',
    query: buildPetPalDeskHandoffQuery({ notice }),
  };
}

function buildOrderDetailLink(orderId: string) {
  return {
    name: 'frontend-petpal-order-detail',
    params: { id: orderId },
    query: buildPetPalDeskHandoffQuery({
      notice: '这笔订单已经从收益页进入详情，可继续复盘服务和售后情况。',
      focusOrderId: orderId,
      focusRole: 'caregiver',
      tab: 'summary',
    }),
  };
}

const primaryAction = computed(() => {
  if (latestActiveOrder.value) {
    return {
      label: '先回履约队列',
      to: buildOrdersRoute(
        '这里已经定位到当前最优先的一笔履约订单，可直接继续接单或签到。',
        latestActiveOrder.value.id,
      ),
      tone: 'primary' as const,
    };
  }
  if (recentCompletedOrders.value[0]) {
    return {
      label: '查看最近完成订单',
      to: buildOrderDetailLink(recentCompletedOrders.value[0].id),
      tone: 'primary' as const,
    };
  }
  if (profile.value?.auditStatus !== 'APPROVED') {
    return {
      label: '先补入驻资料',
      to: buildProfileRoute('这里已经定位到照料者资料页，可先补齐城市、经验和审核材料。'),
      tone: 'primary' as const,
    };
  }
  return {
    label: totals.value.totalServiceCount ? '查看服务清单' : '去补服务清单',
    to: buildServicesRoute('这里已经定位到服务清单，可继续调整在售服务和价格。'),
    tone: 'primary' as const,
  };
});

const heroActions = computed(() => [
  {
    label: '返回总览',
    to: buildDashboardRoute(
      latestActiveOrder.value
        ? '这里已经回到照料者总览，可继续先处理履约，再回来看收益复盘。'
        : '这里已经回到照料者总览，可继续查看资料、服务和收益表现。',
    ),
    tone: 'secondary' as const,
  },
  {
    label: latestActiveOrder.value
      ? '履约队列'
      : profile.value?.auditStatus !== 'APPROVED'
        ? '资料管理'
        : '服务管理',
    to: latestActiveOrder.value
      ? buildOrdersRoute(
          '这里已经回到履约队列，可继续处理接单、签到或签退。',
          latestActiveOrder.value.id,
        )
      : profile.value?.auditStatus !== 'APPROVED'
        ? buildProfileRoute('这里已经定位到照料者资料页，可继续补齐资料和审核材料。')
        : buildServicesRoute('这里已经定位到服务清单，可继续调整在售服务和价格。'),
    tone: 'secondary' as const,
  },
]);

async function loadPage() {
  summaryState.value = 'idle';
  try {
    summary.value = await api.petpal.caregiver.earningsSummary();
    summaryState.value = 'ready';
  } catch (error) {
    summary.value = null;
    summaryState.value = 'error';
    ElMessage.error(getErrorMessage(error, '加载收益页失败'));
  }
}

async function retrySummary() {
  await runPetPalSectionRetry({
    key: 'summary',
    sectionReloadingKey,
    reload: async () => {
      summaryState.value = 'idle';
      try {
        summary.value = await api.petpal.caregiver.earningsSummary();
        summaryState.value = 'ready';
      } catch (error) {
        summaryState.value = 'error';
        throw error;
      }
    },
    getState: () => summaryState.value,
    successMessage: '收益摘要已刷新',
    swallowError: true,
  });
}

onMounted(() => {
  void loadPage();
});
</script>

<style scoped lang="scss">
.petpal-metric-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.petpal-metric-grid--compact {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.petpal-metric-card {
  display: grid;
  gap: 6px;
  padding: 16px;
  border-top: 1px solid rgba(39, 55, 42, 0.08);
  background: rgba(255, 255, 255, 0.66);
}

.petpal-metric-card p,
.petpal-metric-card span {
  margin: 0;
  color: #6b625a;
  line-height: 1.65;
}

.petpal-metric-card p {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.petpal-metric-card strong {
  color: #241f1a;
  font-size: 26px;
  line-height: 1.08;
}

.petpal-metric-card span {
  font-size: 13px;
}

.petpal-note-list {
  display: grid;
  gap: 10px;
}

.petpal-note-row {
  display: flex;
  gap: 16px;
  justify-content: space-between;
  align-items: center;
  padding-top: 10px;
  border-top: 1px solid rgba(39, 55, 42, 0.08);
}

.petpal-note-row span {
  color: #8f7b69;
  font-size: 12px;
  font-weight: 700;
}

.petpal-note-row strong {
  color: #2b241f;
  font-size: 14px;
  text-align: right;
}

.petpal-mix-list {
  display: grid;
  gap: 12px;
}

.petpal-mix-row {
  display: flex;
  gap: 16px;
  justify-content: space-between;
  align-items: flex-start;
  padding-top: 12px;
  border-top: 1px solid rgba(39, 55, 42, 0.08);
}

.petpal-mix-row:first-child {
  padding-top: 0;
  border-top: 0;
}

.petpal-mix-row__copy,
.petpal-mix-row__tail {
  display: grid;
  gap: 6px;
}

.petpal-mix-row__copy h3,
.petpal-mix-row__copy p,
.petpal-mix-row__tail strong,
.petpal-mix-row__tail span {
  margin: 0;
}

.petpal-mix-row__copy h3 {
  color: #2b241f;
  font-size: 18px;
}

.petpal-mix-row__copy p,
.petpal-mix-row__tail span {
  color: #6b625a;
  font-size: 13px;
  line-height: 1.65;
}

.petpal-mix-row__tail {
  justify-items: end;
  text-align: right;
}

.petpal-mix-row__tail strong {
  color: #241f1a;
  font-size: 24px;
  line-height: 1.08;
}

.petpal-sheet-row.is-focused {
  margin-inline: -10px;
  padding-inline: 16px;
  background: rgba(244, 248, 255, 0.9);
}

@media (max-width: 1080px) {
  .petpal-metric-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .petpal-metric-grid,
  .petpal-metric-grid--compact {
    grid-template-columns: 1fr;
  }

  .petpal-note-row,
  .petpal-mix-row {
    flex-direction: column;
    align-items: flex-start;
  }

  .petpal-note-row strong,
  .petpal-mix-row__tail {
    text-align: left;
    justify-items: start;
  }
}
</style>
