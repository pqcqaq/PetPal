<script setup lang="ts">
import type {
  CaregiverEarningsOrderRecord,
  CaregiverEarningsSummaryRecord,
} from '@rbac/api-common';
import { computed, ref } from 'vue';
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app';
import { getCaregiverEarningsSummary } from '@/api/petpal';
import { useTokenStore } from '@/store';
import PetpalEmpty from './rebuild/petpal-empty.vue';
import PetpalPage from './rebuild/petpal-page.vue';
import PetpalSection from './rebuild/petpal-section.vue';
import {
  getErrorMessage,
  helpers,
  openLoginPage,
  openOrderDetailPage,
  PETPAL_CAREGIVER_HOME_PAGE,
  stopPullDown,
  toast,
} from './rebuild/shared';

const tokenStore = useTokenStore();
const loading = ref(false);
const summary = ref<CaregiverEarningsSummaryRecord | null>(null);

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

const totals = computed(() => summary.value?.totals ?? emptyTotals);
const profile = computed(() => summary.value?.profile ?? null);
const recentCompletedOrders = computed(() => summary.value?.recentCompletedOrders ?? []);
const serviceRevenueMix = computed(() => summary.value?.serviceRevenueMix ?? []);
const latestActiveOrder = computed(() => summary.value?.latestActiveOrder ?? null);
const trendGroups = computed(() =>
  [
    { key: 'daily', label: '近 7 天', items: summary.value?.trends.daily ?? [] },
    { key: 'weekly', label: '近 8 周', items: summary.value?.trends.weekly ?? [] },
    { key: 'monthly', label: '近 6 个月', items: summary.value?.trends.monthly ?? [] },
  ].map((group) => ({
    ...group,
    totalRevenue: group.items.reduce((sum, item) => sum + Number(item.revenue || 0), 0),
    totalOrders: group.items.reduce((sum, item) => sum + item.completedOrderCount, 0),
  })),
);
const hasTrendData = computed(() => totals.value.completedOrderCount > 0);

function formatPercent(value: number | string | null | undefined) {
  const ratio = Number(value ?? 0);
  return `${(Math.max(ratio, 0) * 100).toFixed(ratio > 0 && ratio < 0.1 ? 1 : 0)}%`;
}

function getNetIncome(order: Pick<CaregiverEarningsOrderRecord, 'amountPaid' | 'amountRefunded'>) {
  return Math.max(Number(order.amountPaid || 0) - Number(order.amountRefunded || 0), 0);
}

async function loadPage() {
  if (!tokenStore.hasLogin || loading.value) {
    stopPullDown();
    return;
  }
  loading.value = true;
  try {
    summary.value = await getCaregiverEarningsSummary();
  } catch (error) {
    summary.value = null;
    toast(getErrorMessage(error, '收益数据加载失败'));
  } finally {
    loading.value = false;
    stopPullDown();
  }
}

onShow(() => {
  void loadPage();
});

onPullDownRefresh(() => {
  void loadPage();
});
</script>

<template>
  <PetpalPage
    title="收益表现"
    subtitle="收益页只看经营结果，统一使用后端收益摘要。"
    eyebrow="Earnings"
    back
    :back-url="PETPAL_CAREGIVER_HOME_PAGE"
  >
    <template v-if="!tokenStore.hasLogin">
      <PetpalSection title="需要登录">
        <PetpalEmpty title="登录后查看收益">
          <button class="petpal-btn petpal-btn--primary" hover-class="none" @click="openLoginPage">
            去登录
          </button>
        </PetpalEmpty>
      </PetpalSection>
    </template>

    <template v-else>
      <PetpalSection
        tone="accent"
        title="收益总览"
        :subtitle="
          totals.completedOrderCount
            ? `当前已完成 ${totals.completedOrderCount} 笔订单`
            : profile?.auditStatus === 'APPROVED'
              ? '完成第一笔订单后，这里会开始累计收益'
              : '审核通过后，这里会开始沉淀经营数据'
        "
      >
        <view class="petpal-grid--two">
          <view class="petpal-stat">
            <text class="petpal-stat__label">累计收入</text>
            <text class="petpal-stat__value">{{ helpers.formatMoney(totals.totalIncome) }}</text>
            <text class="petpal-stat__meta"
              >平均每单 {{ helpers.formatMoney(totals.averageTicket) }}</text
            >
          </view>
          <view class="petpal-stat">
            <text class="petpal-stat__label">近 30 天</text>
            <text class="petpal-stat__value">{{
              helpers.formatMoney(totals.recentThirtyDayIncome)
            }}</text>
            <text class="petpal-stat__meta">按预约结束时间统计</text>
          </view>
          <view class="petpal-stat">
            <text class="petpal-stat__label">售后风险</text>
            <text class="petpal-stat__value">{{ formatPercent(totals.aftersalesRiskRate) }}</text>
            <text class="petpal-stat__meta"
              >退款敞口 {{ helpers.formatMoney(totals.refundExposure) }}</text
            >
          </view>
          <view class="petpal-stat">
            <text class="petpal-stat__label">当前履约</text>
            <text class="petpal-stat__value">{{ totals.activeOrderCount }}</text>
            <text class="petpal-stat__meta">{{
              latestActiveOrder ? `优先关注 ${latestActiveOrder.orderNo}` : '当前没有履约积压'
            }}</text>
          </view>
        </view>
      </PetpalSection>

      <PetpalSection title="档案与服务" subtitle="评分、审核和服务容量一起看，判断经营底盘。">
        <view class="petpal-grid--two">
          <view class="petpal-stat">
            <text class="petpal-stat__label">审核状态</text>
            <text class="petpal-stat__value">{{
              helpers.getCaregiverAuditLabel(profile?.auditStatus || 'PENDING')
            }}</text>
            <text class="petpal-stat__meta">{{ profile?.serviceCity || '服务城市待补充' }}</text>
          </view>
          <view class="petpal-stat">
            <text class="petpal-stat__label">评分</text>
            <text class="petpal-stat__value">{{ helpers.formatScore(profile?.ratingAvg) }}</text>
            <text class="petpal-stat__meta">评价数 {{ profile?.ratingCount || 0 }}</text>
          </view>
          <view class="petpal-stat">
            <text class="petpal-stat__label">在售服务</text>
            <text class="petpal-stat__value">{{ totals.activeServiceCount }}</text>
            <text class="petpal-stat__meta">全部服务 {{ totals.totalServiceCount }}</text>
          </view>
          <view class="petpal-stat">
            <text class="petpal-stat__label">经验 / 半径</text>
            <text class="petpal-stat__value">{{ `${profile?.experienceYears || 0} 年` }}</text>
            <text class="petpal-stat__meta">{{
              `${profile?.serviceRadiusKm || 0} km 服务半径`
            }}</text>
          </view>
        </view>
      </PetpalSection>

      <PetpalSection title="服务收入结构" subtitle="按已完成订单归集，帮助判断哪类服务在稳定赚钱。">
        <template v-if="serviceRevenueMix.length">
          <view v-for="item in serviceRevenueMix" :key="item.serviceType" class="petpal-sheet">
            <text class="petpal-banner__eyebrow">{{
              helpers.serviceTypeLabels[item.serviceType]
            }}</text>
            <text class="petpal-banner__title">{{ helpers.formatMoney(item.revenue) }}</text>
            <text class="petpal-banner__meta"
              >{{ item.orderCount }} 笔已完成订单 · 平均每单
              {{ helpers.formatMoney(item.averageTicket) }} · 占比
              {{ formatPercent(item.shareRatio) }}</text
            >
          </view>
        </template>
        <PetpalEmpty
          v-else
          title="还没有形成收入结构"
          description="完成第一笔订单后，这里会开始按服务类型归集收入。"
        />
      </PetpalSection>

      <PetpalSection title="收益趋势" subtitle="按天 / 周 / 月看短期波动和中期稳定性。">
        <template v-if="hasTrendData">
          <view v-for="group in trendGroups" :key="group.key" class="petpal-sheet">
            <text class="petpal-banner__eyebrow">{{ group.label }}</text>
            <text class="petpal-banner__title">{{ helpers.formatMoney(group.totalRevenue) }}</text>
            <text class="petpal-banner__meta"
              >{{ group.totalOrders }} 笔完成单 · 同一口径收益趋势</text
            >
            <text
              v-for="item in group.items"
              :key="`${group.key}-${item.label}`"
              class="petpal-note"
              >{{ item.label }} · {{ item.completedOrderCount }} 笔 ·
              {{ helpers.formatMoney(item.revenue) }}</text
            >
          </view>
        </template>
        <PetpalEmpty
          v-else
          title="还没有可用的收益趋势"
          description="完成订单后，这里会开始沉淀按天、按周、按月的经营变化。"
        />
      </PetpalSection>

      <PetpalSection title="最近完成的订单" subtitle="复盘对象只保留已经形成收益的订单。">
        <template v-if="recentCompletedOrders.length">
          <view v-for="item in recentCompletedOrders" :key="item.id" class="petpal-sheet">
            <text class="petpal-banner__eyebrow">Completed Order</text>
            <text class="petpal-banner__title">{{ item.orderNo }}</text>
            <text class="petpal-banner__meta"
              >{{ helpers.serviceTypeLabels[item.serviceType] }} · {{ item.ownerNickname }} ·
              {{ item.petName || '宠物待同步' }}</text
            >
            <text class="petpal-note"
              >{{ helpers.formatMoney(getNetIncome(item)) }} ·
              {{ helpers.formatRange(item.appointmentStart, item.appointmentEnd) }}</text
            >
            <view class="petpal-action-row">
              <button
                class="petpal-btn petpal-btn--secondary"
                hover-class="none"
                @click="openOrderDetailPage(item.id, 'overview', 'caregiver-earnings')"
              >
                查看订单
              </button>
            </view>
          </view>
        </template>
        <PetpalEmpty
          v-else
          title="还没有完成订单"
          description="完成第一笔订单后，这里会开始累计你的收益表现。"
        />
      </PetpalSection>
    </template>
  </PetpalPage>
</template>
