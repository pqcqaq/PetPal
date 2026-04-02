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
        <div class="petpal-section-actions">
          <el-button
            v-if="summaryState === 'error'"
            :loading="sectionReloadingKey === 'summary'"
            @click="retrySummary"
          >
            重试收益摘要
          </el-button>
          <ListExportButton
            v-else
            :request="buildEarningsExportRequest"
            label="导出经营明细"
            pending-label="导出中"
            error-message="导出收益明细失败"
          />
          <RouterLink
            v-if="summaryState !== 'error' && latestActiveOrder"
            :to="
              buildOrdersRoute(
                '这里已经定位到当前最优先的一笔履约订单，可直接继续接单或签到。',
                latestActiveOrder.id,
              )
            "
          >
            回履约队列
          </RouterLink>
        </div>
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

      <template v-else>
        <div class="petpal-export-toolbar">
          <div class="petpal-export-toolbar__presets">
            <span class="petpal-export-toolbar__label">快捷时间窗</span>
            <el-button
              v-for="preset in exportPresetOptions"
              :key="preset.value"
              size="small"
              :type="activeExportPreset === preset.value ? 'primary' : 'default'"
              @click="applyExportPreset(preset.value)"
            >
              {{ preset.label }}
            </el-button>
          </div>
          <div class="petpal-export-toolbar__templates">
            <span class="petpal-export-toolbar__label">常用模板</span>
            <el-select
              v-model="selectedExportTemplateName"
              clearable
              placeholder="选择常用导出模板"
              class="petpal-export-toolbar__template"
            >
              <el-option
                v-for="item in exportTemplates"
                :key="item.name"
                :label="item.name"
                :value="item.name"
              />
            </el-select>
            <el-button :disabled="!selectedExportTemplate" @click="applySelectedExportTemplate">
              应用模板
            </el-button>
            <el-button :disabled="!hasExportFilters" @click="saveCurrentExportTemplate">
              保存为模板
            </el-button>
            <el-button
              v-if="selectedExportTemplate"
              text
              @click="deleteSelectedExportTemplate"
            >
              删除模板
            </el-button>
          </div>
          <div class="petpal-export-toolbar__filters">
            <el-date-picker
              v-model="exportDateRange"
              type="daterange"
              range-separator="至"
              start-placeholder="导出开始日期"
              end-placeholder="导出结束日期"
              clearable
            />
            <el-select
              v-model="exportServiceType"
              clearable
              placeholder="导出全部服务类型"
              class="petpal-export-toolbar__service"
            >
              <el-option
                v-for="item in petPalServiceTypeOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
            <el-select
              v-model="exportRefundType"
              clearable
              placeholder="导出全部退款类型"
              class="petpal-export-toolbar__service"
            >
              <el-option
                v-for="item in petPalRefundTypeOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
            <el-select
              v-model="exportRefundStatus"
              clearable
              placeholder="导出全部退款状态"
              class="petpal-export-toolbar__service"
            >
              <el-option
                v-for="item in petPalRefundStatusOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
            <el-input
              v-model="exportRefundReasonKeyword"
              clearable
              placeholder="退款原因关键词"
              class="petpal-export-toolbar__service"
            />
            <el-select
              v-model="exportComplaintStatus"
              clearable
              placeholder="导出全部投诉状态"
              class="petpal-export-toolbar__service"
            >
              <el-option
                v-for="item in petPalComplaintStatusOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
            <el-select
              v-model="exportComplaintType"
              clearable
              placeholder="导出全部投诉类型"
              class="petpal-export-toolbar__service"
            >
              <el-option
                v-for="item in petPalComplaintTypeOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
            <el-input
              v-model="exportComplaintKeyword"
              clearable
              placeholder="投诉摘要关键词"
              class="petpal-export-toolbar__service"
            />
            <el-select
              v-model="exportComplaintTargetRole"
              clearable
              placeholder="导出全部责任角色"
              class="petpal-export-toolbar__service"
            >
              <el-option
                v-for="item in petPalComplaintTargetOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
            <el-checkbox v-model="exportRiskOnly">
              仅导出退款风险单
            </el-checkbox>
            <el-button v-if="hasExportFilters" text @click="clearExportFilters">
              清空导出筛选
            </el-button>
          </div>
          <p class="petpal-export-toolbar__hint">
            导出筛选只影响经营明细，不改变当前摘要和趋势口径；可额外按退款类型、退款状态、退款原因关键词、退款风险单、投诉状态、投诉类型、投诉摘要关键词或责任角色导出经营明细，系统会按当前账号记住最近一次导出条件，并可保存最多 5 套常用模板。
          </p>
        </div>

        <div class="petpal-metric-grid">
          <article v-for="item in revenueCards" :key="item.label" class="petpal-metric-card">
            <p>{{ item.label }}</p>
            <strong>{{ item.value }}</strong>
            <span>{{ item.hint }}</span>
          </article>
        </div>
      </template>
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
      eyebrow="Trend"
      title="日 / 周 / 月趋势"
      description="按同一口径看最近 7 天、8 周和 6 个月的完成单收入变化。"
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
        title="收益趋势暂未刷新完成"
        description="可以先重试收益摘要，恢复后再继续查看日、周、月维度的经营变化。"
      />

      <PetPalDeskEmpty
        v-else-if="!hasTrendData"
        title="还没有可用的收益趋势"
        description="完成订单后，这里会开始沉淀按天、按周、按月的收益变化。"
      />

      <div v-else class="petpal-trend-grid">
        <article v-for="group in trendGroups" :key="group.key" class="petpal-trend-card">
          <div class="petpal-trend-card__head">
            <div>
              <p>{{ group.label }}</p>
              <strong>{{ formatPetPalMoney(group.totalRevenue) }}</strong>
            </div>
            <span>{{ group.totalOrders }} 笔完成单</span>
          </div>
          <div class="petpal-trend-list">
            <div
              v-for="item in group.items"
              :key="`${group.key}-${item.label}`"
              class="petpal-trend-row"
            >
              <div class="petpal-trend-row__copy">
                <strong>{{ item.label }}</strong>
                <span>{{ item.completedOrderCount }} 笔</span>
              </div>
              <div class="petpal-trend-row__tail">
                <span>{{ formatPetPalMoney(item.revenue) }}</span>
                <i :style="{ width: getTrendBarWidth(item.revenue, group.maxRevenue) }" />
              </div>
            </div>
          </div>
        </article>
      </div>
    </PetPalDeskSection>

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
  ComplaintTargetRole,
  ComplaintType,
  PetServiceType,
  ComplaintStatus,
  RefundType,
  RefundStatus,
  CaregiverEarningsOrderRecord,
  CaregiverEarningsSummaryRecord,
} from '@rbac/api-common';
import { computed, onMounted, ref } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { api } from '@/api/client';
import ListExportButton from '@/components/download/ListExportButton.vue';
import { usePageState } from '@/composables/use-page-state';
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
  petPalComplaintTargetOptions,
  getPetPalServiceTypeLabel,
  petPalComplaintStatusOptions,
  petPalComplaintTypeOptions,
  petPalCaregiverWorkspaceNav,
  petPalRefundStatusOptions,
  petPalRefundTypeOptions,
  petPalServiceTypeOptions,
} from './shared';

const route = useRoute();
const summary = ref<CaregiverEarningsSummaryRecord | null>(null);
const summaryState = ref<PetPalSectionLoadState>('idle');
const sectionReloadingKey = ref<'' | 'summary'>('');

type EarningsExportDatePreset = '' | 'last7days' | 'last30days' | 'thisMonth' | 'lastMonth';
type CaregiverEarningsExportFilterSnapshot = {
  startDate: string;
  endDate: string;
  serviceType: PetServiceType | '';
  refundType: RefundType | '';
  refundStatus: RefundStatus | '';
  refundReasonKeyword: string;
  complaintStatus: ComplaintStatus | '';
  complaintType: ComplaintType | '';
  complaintKeyword: string;
  complaintTargetRole: ComplaintTargetRole | '';
  datePreset: EarningsExportDatePreset;
  riskOnly: boolean;
};
type CaregiverEarningsExportTemplate = CaregiverEarningsExportFilterSnapshot & {
  name: string;
};
type CaregiverEarningsExportPageState = CaregiverEarningsExportFilterSnapshot & {
  templates: CaregiverEarningsExportTemplate[];
};

const MAX_EARNINGS_EXPORT_TEMPLATE_COUNT = 5;

const exportPresetOptions: Array<{ label: string; value: Exclude<EarningsExportDatePreset, ''> }> = [
  { label: '近 7 天', value: 'last7days' },
  { label: '近 30 天', value: 'last30days' },
  { label: '本月', value: 'thisMonth' },
  { label: '上月', value: 'lastMonth' },
];

const { state: exportPageState } = usePageState<CaregiverEarningsExportPageState>(
  'page:petpal:caregiver-earnings-export-filters',
  {
    startDate: '',
    endDate: '',
    serviceType: '',
    refundType: '',
    refundStatus: '',
    refundReasonKeyword: '',
    complaintStatus: '',
    complaintType: '',
    complaintKeyword: '',
    complaintTargetRole: '',
    datePreset: '',
    riskOnly: false,
    templates: [],
  },
);
const selectedExportTemplateName = ref('');

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
const getTrendBarWidth = (value: number | string, maxRevenue: number) => {
  const revenue = toAmount(value);
  if (!maxRevenue || revenue <= 0) {
    return '0%';
  }
  return `${Math.max((revenue / maxRevenue) * 100, 12)}%`;
};
const parseDate = (value: string) => {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};
const cloneDate = (value: Date) => new Date(value.getTime());
const getStartOfDay = (value: Date) => new Date(
  value.getFullYear(),
  value.getMonth(),
  value.getDate(),
  0,
  0,
  0,
  0,
);
const getEndOfDay = (value: Date) => new Date(
  value.getFullYear(),
  value.getMonth(),
  value.getDate(),
  23,
  59,
  59,
  999,
);
const addDays = (value: Date, amount: number) => {
  const next = cloneDate(value);
  next.setDate(next.getDate() + amount);
  return next;
};
const applyExportFilterSnapshot = (snapshot: CaregiverEarningsExportFilterSnapshot) => {
  exportPageState.startDate = snapshot.startDate;
  exportPageState.endDate = snapshot.endDate;
  exportPageState.serviceType = snapshot.serviceType;
  exportPageState.refundType = snapshot.refundType;
  exportPageState.refundStatus = snapshot.refundStatus;
  exportPageState.refundReasonKeyword = snapshot.refundReasonKeyword;
  exportPageState.complaintStatus = snapshot.complaintStatus;
  exportPageState.complaintType = snapshot.complaintType;
  exportPageState.complaintKeyword = snapshot.complaintKeyword ?? '';
  exportPageState.complaintTargetRole = snapshot.complaintTargetRole ?? '';
  exportPageState.datePreset = snapshot.datePreset;
  exportPageState.riskOnly = snapshot.riskOnly;
};
const buildCurrentExportFilterSnapshot = (): CaregiverEarningsExportFilterSnapshot => ({
  startDate: exportPageState.startDate,
  endDate: exportPageState.endDate,
  serviceType: exportPageState.serviceType,
  refundType: exportPageState.refundType,
  refundStatus: exportPageState.refundStatus,
  refundReasonKeyword: exportPageState.refundReasonKeyword,
  complaintStatus: exportPageState.complaintStatus,
  complaintType: exportPageState.complaintType,
  complaintKeyword: exportPageState.complaintKeyword,
  complaintTargetRole: exportPageState.complaintTargetRole,
  datePreset: exportPageState.datePreset,
  riskOnly: exportPageState.riskOnly,
});
const clearCurrentExportFilters = () => {
  applyExportFilterSnapshot({
    startDate: '',
    endDate: '',
    serviceType: '',
    refundType: '',
    refundStatus: '',
    refundReasonKeyword: '',
    complaintStatus: '',
    complaintType: '',
    complaintKeyword: '',
    complaintTargetRole: '',
    datePreset: '',
    riskOnly: false,
  });
};
const setExportDateRange = (value: [Date, Date] | null, datePreset: EarningsExportDatePreset = '') => {
  applyExportFilterSnapshot({
    ...buildCurrentExportFilterSnapshot(),
    startDate: value?.[0]?.toISOString() ?? '',
    endDate: value?.[1]?.toISOString() ?? '',
    datePreset: value ? datePreset : '',
  });
};
const resolveExportPresetRange = (
  preset: Exclude<EarningsExportDatePreset, ''>,
): [Date, Date] => {
  const now = new Date();
  const todayStart = getStartOfDay(now);

  switch (preset) {
    case 'last7days':
      return [addDays(todayStart, -6), getEndOfDay(now)];
    case 'last30days':
      return [addDays(todayStart, -29), getEndOfDay(now)];
    case 'thisMonth':
      return [
        new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0),
        getEndOfDay(now),
      ];
    case 'lastMonth':
      return [
        new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0),
        new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999),
      ];
  }
};

const profile = computed(() => summary.value?.profile ?? null);
const totals = computed(() => summary.value?.totals ?? emptyTotals);
const auditLabel = computed(() =>
  profile.value ? getPetPalCaregiverAuditLabel(profile.value.auditStatus) : '未建档',
);
const exportDateRange = computed<[Date, Date] | null>({
  get: () => {
    const startDate = parseDate(exportPageState.startDate);
    const endDate = parseDate(exportPageState.endDate);
    return startDate && endDate ? [startDate, endDate] as [Date, Date] : null;
  },
  set: (value: [Date, Date] | null) => {
    setExportDateRange(value);
  },
});
const exportServiceType = computed<PetServiceType | ''>({
  get: () => exportPageState.serviceType,
  set: (value) => {
    exportPageState.serviceType = value || '';
  },
});
const exportRefundType = computed<RefundType | ''>({
  get: () => exportPageState.refundType,
  set: (value) => {
    exportPageState.refundType = value || '';
  },
});
const exportRefundStatus = computed<RefundStatus | ''>({
  get: () => exportPageState.refundStatus,
  set: (value) => {
    exportPageState.refundStatus = value || '';
  },
});
const exportRefundReasonKeyword = computed<string>({
  get: () => exportPageState.refundReasonKeyword,
  set: (value) => {
    exportPageState.refundReasonKeyword = value.trimStart();
  },
});
const exportComplaintStatus = computed<ComplaintStatus | ''>({
  get: () => exportPageState.complaintStatus,
  set: (value) => {
    exportPageState.complaintStatus = value || '';
  },
});
const exportComplaintType = computed<ComplaintType | ''>({
  get: () => exportPageState.complaintType,
  set: (value) => {
    exportPageState.complaintType = value || '';
  },
});
const exportComplaintKeyword = computed<string>({
  get: () => exportPageState.complaintKeyword || '',
  set: (value) => {
    exportPageState.complaintKeyword = value.trimStart();
  },
});
const exportComplaintTargetRole = computed<ComplaintTargetRole | ''>({
  get: () => exportPageState.complaintTargetRole,
  set: (value) => {
    exportPageState.complaintTargetRole = value || '';
  },
});
const exportRiskOnly = computed<boolean>({
  get: () => exportPageState.riskOnly,
  set: (value) => {
    exportPageState.riskOnly = value;
  },
});
const exportTemplates = computed(() => exportPageState.templates);
const selectedExportTemplate = computed(
  () => exportTemplates.value.find((item) => item.name === selectedExportTemplateName.value) ?? null,
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
const trendGroups = computed(() =>
  [
    { key: 'daily', label: '近 7 天', items: summary.value?.trends.daily ?? [] },
    { key: 'weekly', label: '近 8 周', items: summary.value?.trends.weekly ?? [] },
    { key: 'monthly', label: '近 6 个月', items: summary.value?.trends.monthly ?? [] },
  ].map((group) => ({
    ...group,
    maxRevenue: group.items.reduce((max, item) => Math.max(max, toAmount(item.revenue)), 0),
    totalRevenue: group.items.reduce((sum, item) => sum + toAmount(item.revenue), 0),
    totalOrders: group.items.reduce((sum, item) => sum + item.completedOrderCount, 0),
  })),
);
const hasTrendData = computed(() => totals.value.completedOrderCount > 0);
const activeExportPreset = computed(() => exportPageState.datePreset);
const hasExportFilters = computed(() => Boolean(
  exportDateRange.value
  || exportServiceType.value
  || exportRefundType.value
  || exportRefundStatus.value
  || exportRefundReasonKeyword.value.trim()
  || exportComplaintStatus.value
  || exportComplaintType.value
  || exportComplaintKeyword.value.trim()
  || exportComplaintTargetRole.value
  || exportRiskOnly.value,
));
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

function applyExportPreset(preset: Exclude<EarningsExportDatePreset, ''>) {
  setExportDateRange(resolveExportPresetRange(preset), preset);
}

function clearExportFilters() {
  clearCurrentExportFilters();
}

function applySelectedExportTemplate() {
  if (!selectedExportTemplate.value) {
    return;
  }

  applyExportFilterSnapshot(selectedExportTemplate.value);
  ElMessage.success(`已应用模板「${selectedExportTemplate.value.name}」`);
}

async function saveCurrentExportTemplate() {
  if (!hasExportFilters.value) {
    ElMessage.warning('请先选择至少一个导出筛选条件');
    return;
  }

  try {
    const { value } = await ElMessageBox.prompt(
      '为当前导出条件取一个名字，便于后续快速套用。',
      '保存经营导出模板',
      {
        confirmButtonText: '保存',
        cancelButtonText: '取消',
        inputValue: selectedExportTemplateName.value,
        inputValidator: (inputValue) => {
          const name = inputValue.trim();
          if (!name) {
            return '模板名称不能为空';
          }
          if (name.length > 20) {
            return '模板名称请控制在 20 个字符以内';
          }
          return true;
        },
      },
    );

    const name = value.trim();
    const nextTemplate: CaregiverEarningsExportTemplate = {
      name,
      ...buildCurrentExportFilterSnapshot(),
    };
    const existingIndex = exportPageState.templates.findIndex((item) => item.name === name);

    if (existingIndex === -1 && exportPageState.templates.length >= MAX_EARNINGS_EXPORT_TEMPLATE_COUNT) {
      ElMessage.warning(`最多只能保存 ${MAX_EARNINGS_EXPORT_TEMPLATE_COUNT} 个导出模板`);
      return;
    }

    const nextTemplates = [...exportPageState.templates];
    if (existingIndex >= 0) {
      nextTemplates.splice(existingIndex, 1);
    }
    nextTemplates.unshift(nextTemplate);
    exportPageState.templates = nextTemplates;
    selectedExportTemplateName.value = name;
    ElMessage.success(existingIndex >= 0 ? `模板「${name}」已更新` : `模板「${name}」已保存`);
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(getErrorMessage(error, '保存经营导出模板失败'));
    }
  }
}

async function deleteSelectedExportTemplate() {
  if (!selectedExportTemplate.value) {
    return;
  }

  const templateName = selectedExportTemplate.value.name;

  try {
    await ElMessageBox.confirm(
      `删除后将不再保留模板「${templateName}」的导出条件。`,
      '删除经营导出模板',
      {
        type: 'warning',
        confirmButtonText: '删除',
        cancelButtonText: '取消',
      },
    );

    exportPageState.templates = exportPageState.templates.filter((item) => item.name !== templateName);
    selectedExportTemplateName.value = '';
    ElMessage.success(`模板「${templateName}」已删除`);
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(getErrorMessage(error, '删除经营导出模板失败'));
    }
  }
}

function buildEarningsExportRequest() {
  return api.petpal.caregiver.exportEarnings({
    startDate: exportDateRange.value?.[0]?.toISOString(),
    endDate: exportDateRange.value?.[1]?.toISOString(),
    serviceType: exportServiceType.value || undefined,
    refundType: exportRefundType.value || undefined,
    refundStatus: exportRefundStatus.value || undefined,
    refundReasonKeyword: exportRefundReasonKeyword.value.trim() || undefined,
    complaintStatus: exportComplaintStatus.value || undefined,
    complaintType: exportComplaintType.value || undefined,
    complaintKeyword: exportComplaintKeyword.value.trim() || undefined,
    complaintTargetRole: exportComplaintTargetRole.value || undefined,
    riskOnly: exportRiskOnly.value || undefined,
  });
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

.petpal-section-actions {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
}

.petpal-export-toolbar {
  display: grid;
  gap: 12px;
  margin-bottom: 16px;
}

.petpal-export-toolbar__presets,
.petpal-export-toolbar__templates,
.petpal-export-toolbar__filters {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
}

.petpal-export-toolbar__label {
  color: #6b625a;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.petpal-export-toolbar__template,
.petpal-export-toolbar__service {
  width: 220px;
}

.petpal-export-toolbar__hint {
  margin: 0;
  color: #6b625a;
  font-size: 13px;
  line-height: 1.6;
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

.petpal-trend-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.petpal-trend-card {
  display: grid;
  gap: 14px;
  padding: 16px;
  background: rgba(255, 255, 255, 0.72);
  border-top: 1px solid rgba(39, 55, 42, 0.08);
}

.petpal-trend-card__head {
  display: flex;
  gap: 16px;
  justify-content: space-between;
  align-items: flex-end;
}

.petpal-trend-card__head p,
.petpal-trend-card__head strong,
.petpal-trend-card__head span {
  margin: 0;
}

.petpal-trend-card__head p,
.petpal-trend-card__head span,
.petpal-trend-row__copy span,
.petpal-trend-row__tail span {
  color: #6b625a;
  font-size: 12px;
  line-height: 1.5;
}

.petpal-trend-card__head p {
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.petpal-trend-card__head strong {
  color: #241f1a;
  font-size: 24px;
  line-height: 1.08;
}

.petpal-trend-list {
  display: grid;
  gap: 10px;
}

.petpal-trend-row {
  display: grid;
  gap: 8px;
}

.petpal-trend-row__copy,
.petpal-trend-row__tail {
  display: flex;
  gap: 12px;
  justify-content: space-between;
  align-items: center;
}

.petpal-trend-row__copy strong,
.petpal-trend-row__tail span {
  color: #2b241f;
  font-size: 13px;
}

.petpal-trend-row__tail {
  position: relative;
  min-height: 6px;
  padding-bottom: 10px;
}

.petpal-trend-row__tail i {
  position: absolute;
  left: 0;
  bottom: 0;
  display: block;
  height: 6px;
  border-radius: 999px;
  background: linear-gradient(90deg, #dfa65b 0%, #8ab071 100%);
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

  .petpal-trend-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .petpal-section-actions {
    align-items: stretch;
  }

  .petpal-export-toolbar__presets,
  .petpal-export-toolbar__templates,
  .petpal-export-toolbar__filters {
    align-items: stretch;
  }

  .petpal-export-toolbar__template,
  .petpal-export-toolbar__service {
    width: 100%;
  }

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
