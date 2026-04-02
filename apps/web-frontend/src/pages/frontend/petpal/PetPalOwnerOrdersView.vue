<template>
  <PetPalDeskPage
    eyebrow="订单队列"
    title="订单只在这里按状态整理，不再回总览里翻找"
    summary="待支付、履约中、已完成和售后中的订单都统一在这里切换查看。"
    :nav-items="petPalOwnerWorkspaceNav"
    active-name="frontend-petpal-orders"
    :primary-action="primaryAction"
    :actions="pageActions"
    :stats="heroStats"
  >
    <template v-if="pageNotice" #notice>
      <PetPalDeskNotice eyebrow="Handoff" :title="pageNotice.title" :description="pageNotice.description" :tone="pageNotice.tone">
        <template #actions>
          <el-button
            v-if="loadState === 'error'"
            :loading="sectionReloadingKey === 'orders'"
            @click="retryOrders"
          >
            重试订单队列
          </el-button>
          <RouterLink
            v-else-if="highlightedOrder"
            :to="buildOrderDetailLink(highlightedOrder)"
          >
            直接看这笔订单
          </RouterLink>
        </template>
      </PetPalDeskNotice>
    </template>

    <PetPalDeskSection eyebrow="Filter" title="按状态筛选订单" description="支付、履约和售后已拆开，但都能从订单详情继续进入。">
      <div class="petpal-toolbar">
        <el-radio-group v-model="filter" size="small">
          <el-radio-button label="all">全部</el-radio-button>
          <el-radio-button label="needs_payment">待支付</el-radio-button>
          <el-radio-button label="active">进行中</el-radio-button>
          <el-radio-button label="aftersales">售后</el-radio-button>
          <el-radio-button label="done">已完成</el-radio-button>
        </el-radio-group>
      </div>

      <div class="petpal-export-toolbar">
        <PetPalExportTemplateActions
          v-model="selectedExportTemplateName"
          :templates="exportTemplates"
          placeholder="选择交易导出模板"
          :apply-disabled="!selectedExportTemplate"
          :save-disabled="!hasExportFilters"
          :can-remove="!!selectedExportTemplate"
          @apply="applySelectedExportTemplate"
          @save="saveCurrentExportTemplate"
          @remove="deleteSelectedExportTemplate"
        />

        <div class="petpal-export-toolbar__filters">
          <el-date-picker
            v-model="exportDateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="交易开始日期"
            end-placeholder="交易结束日期"
            clearable
          />
          <el-select
            v-model="exportServiceType"
            clearable
            placeholder="全部服务类型"
            class="petpal-export-toolbar__control"
          >
            <el-option
              v-for="item in petPalServiceTypeOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
          <el-select
            v-model="exportOrderStatus"
            clearable
            placeholder="全部订单状态"
            class="petpal-export-toolbar__control"
          >
            <el-option
              v-for="item in petPalOrderStatusOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
          <el-input
            v-model="exportOrderNoKeyword"
            clearable
            placeholder="订单号关键词"
            class="petpal-export-toolbar__control"
          />
          <el-button v-if="hasExportFilters" text @click="clearExportFilters">
            清空导出筛选
          </el-button>
          <ListExportButton
            :request="buildTransactionExportRequest"
            label="导出交易记录"
            pending-label="导出中"
          />
        </div>

        <p class="petpal-export-toolbar__hint">
          交易导出只影响当前导出文件，不改变订单队列顶部状态切换；系统会记住最近一次交易导出条件，并可保存最多 5 套常用模板。
        </p>
      </div>

      <PetPalDeskEmpty
        v-if="!filteredOrders.length"
        title="当前筛选下没有订单"
        description="切换筛选，或先回需求队列创建新的订单。"
      />

        <div v-else class="petpal-sheet-list">
          <div v-for="order in filteredOrders" :key="order.id" class="petpal-sheet-row" :class="{ 'is-focused': order.id === highlightedOrderId }">
            <div class="petpal-sheet-row__copy">
              <h3 class="petpal-sheet-row__title">{{ order.orderNo }}</h3>
              <p class="petpal-sheet-row__desc">{{ getPetPalOrderStatusLabel(order.orderStatus) }} · {{ getPetPalServiceTypeLabel(order.serviceType) }}</p>
            <p class="petpal-sheet-row__desc">{{ formatPetPalRange(order.appointmentStart, order.appointmentEnd) }}</p>
            <div class="petpal-pill-row">
              <span class="petpal-pill">总额 {{ formatPetPalMoney(Number(order.amountTotal) + Number(order.amountAdjusted)) }}</span>
              <span class="petpal-pill">已付 {{ formatPetPalMoney(order.amountPaid) }}</span>
              <span class="petpal-pill" :class="unreadCount(order) ? 'is-danger' : ''">未读 {{ unreadCount(order) }}</span>
            </div>
          </div>
          <div class="petpal-sheet-row__tail">
            <RouterLink :to="buildOrderDetailLink(order)">查看详情</RouterLink>
            <RouterLink
              v-if="isPetPalOutstandingOrder(order)"
              :to="buildPaymentResultLink(order)"
            >
              继续支付
            </RouterLink>
          </div>
        </div>
      </div>
    </PetPalDeskSection>
  </PetPalDeskPage>
</template>

<script setup lang="ts">
import type { OrderRecord, OrderStatus } from '@rbac/api-common';
import { computed, onMounted, ref, watch } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { api } from '@/api/client';
import ListExportButton from '@/components/download/ListExportButton.vue';
import { usePetPalExportTemplates } from '@/composables/use-petpal-export-templates';
import { usePageState } from '@/composables/use-page-state';
import { getErrorMessage } from '@/utils/errors';
import PetPalDeskEmpty from './rebuild/petpal-desk-empty.vue';
import PetPalDeskNotice from './rebuild/petpal-desk-notice.vue';
import PetPalDeskPage from './rebuild/petpal-desk-page.vue';
import PetPalExportTemplateActions from './rebuild/petpal-export-template-actions.vue';
import PetPalDeskSection from './rebuild/petpal-desk-section.vue';
import {
  PETPAL_EXPORT_TEMPLATE_LIMIT,
  validatePetPalExportTemplateName,
} from './export-template-state';
import {
  applyOwnerTransactionExportFilterSnapshot,
  buildOwnerTransactionExportQuery,
  cloneOwnerTransactionExportFilterSnapshot,
  createEmptyOwnerTransactionExportFilterSnapshot,
  hasOwnerTransactionExportFilters,
  parseOwnerTransactionExportDateRange,
  type OwnerTransactionExportFilterSnapshot,
  type OwnerTransactionExportTemplate,
  withOwnerTransactionExportDateRange,
} from './owner-transaction-export-state';
import {
  buildPetPalPageNotice,
  buildPetPalDeskHandoffQuery,
  getPetPalDeskOrderFilter,
  getPetPalQueryString,
  runPetPalSectionRetry,
  type PetPalDeskOrderFilter,
  type PetPalSectionLoadState,
} from './recovery';
import {
  formatPetPalMoney,
  formatPetPalRange,
  getPetPalConversationUnreadCount,
  getPetPalOrderStatusLabel,
  getPetPalServiceTypeLabel,
  isPetPalAftersalesStatus,
  isPetPalOutstandingOrder,
  petPalOrderStatusOptions,
  petPalOwnerWorkspaceNav,
  petPalServiceTypeOptions,
} from './shared';

const route = useRoute();
const orders = ref<OrderRecord[]>([]);
const filter = ref<'all' | 'needs_payment' | 'active' | 'aftersales' | 'done'>('all');
const loadState = ref<PetPalSectionLoadState>('idle');
const sectionReloadingKey = ref<'' | 'orders'>('');

type OwnerTransactionExportPageState = OwnerTransactionExportFilterSnapshot & {
  templates: OwnerTransactionExportTemplate[];
};

const { state: exportPageState } = usePageState<OwnerTransactionExportPageState>(
  'page:petpal:owner-transaction-export-filters',
  {
    ...createEmptyOwnerTransactionExportFilterSnapshot(),
    templates: [],
  },
);
const exportTemplateState = computed<OwnerTransactionExportTemplate[]>({
  get: () => exportPageState.templates,
  set: (value) => {
    exportPageState.templates = value;
  },
});
const {
  selectedTemplateName: selectedExportTemplateName,
  selectedTemplate: selectedExportTemplate,
  applySelectedTemplate: applyNamedExportTemplate,
  saveTemplate: saveNamedExportTemplate,
  removeSelectedTemplate: removeNamedExportTemplate,
} = usePetPalExportTemplates(exportTemplateState);

const filteredOrders = computed(() => orders.value.filter((item) => {
  if (filter.value === 'needs_payment') {
    return isPetPalOutstandingOrder(item);
  }
  if (filter.value === 'active') {
    return ['PENDING_ACCEPT', 'ACCEPTED', 'SERVING'].includes(item.orderStatus);
  }
  if (filter.value === 'aftersales') {
    return isPetPalAftersalesStatus(item.orderStatus);
  }
  if (filter.value === 'done') {
    return item.orderStatus === 'COMPLETED';
  }
  return true;
}));
const highlightedOrderId = computed(() => getPetPalQueryString(route.query, 'focusOrderId'));
const highlightedOrder = computed(() => orders.value.find((item) => item.id === highlightedOrderId.value) ?? null);
const activeAftersalesOrder = computed(() => (
  highlightedOrder.value && isPetPalAftersalesStatus(highlightedOrder.value.orderStatus)
    ? highlightedOrder.value
    : orders.value.find((item) => isPetPalAftersalesStatus(item.orderStatus)) ?? null
));
const primaryAction = computed(() => ({
  label: '回主人总览',
  to: buildOwnerDashboardRoute(
    orders.value.length
      ? '这里已经回到主人总览，可继续决定先处理订单、售后还是宠物任务。'
      : '这里已经回到主人总览，可继续从宠物建档和需求开始主人主流程。',
  ),
  tone: 'secondary' as const,
}));
const pageActions = computed(() => [
  {
    label: '售后中心',
    to: buildAftersalesRoute(
      activeAftersalesOrder.value
        ? '这里已经定位到当前最急的一笔售后订单，可直接继续跟进退款或投诉。'
        : '这里已经回到售后中心，可继续查看退款和投诉摘要。',
      activeAftersalesOrder.value?.id,
    ),
    tone: 'secondary' as const,
  },
]);

const heroStats = computed(() => [
  { label: '订单总数', value: String(orders.value.length), hint: '主人全部交易记录' },
  { label: '待支付', value: String(orders.value.filter((item) => isPetPalOutstandingOrder(item)).length), hint: '优先处理金额未结清订单' },
  { label: '进行中', value: String(orders.value.filter((item) => ['PENDING_ACCEPT', 'ACCEPTED', 'SERVING'].includes(item.orderStatus)).length), hint: '需要持续跟进履约' },
  { label: '售后中', value: String(orders.value.filter((item) => isPetPalAftersalesStatus(item.orderStatus)).length), hint: '退款投诉去售后中心' },
]);
const pageNotice = computed(() => buildPetPalPageNotice({
  baseNotice: getPetPalQueryString(route.query, 'notice'),
  warnings: [
    loadState.value === 'error' ? '订单队列刷新失败，可直接重试当前页' : '',
  ],
  successTitle: '已回到订单队列',
  warningTitle: '订单队列暂未刷新完整',
}));

const exportDateRange = computed<[Date, Date] | null>({
  get: () => parseOwnerTransactionExportDateRange(exportPageState),
  set: (value) => {
    applyOwnerTransactionExportFilterSnapshot(
      exportPageState,
      withOwnerTransactionExportDateRange(exportPageState, value),
    );
  },
});
const exportServiceType = computed<OwnerTransactionExportFilterSnapshot['serviceType']>({
  get: () => exportPageState.serviceType,
  set: (value) => {
    exportPageState.serviceType = value || '';
  },
});
const exportOrderStatus = computed<OrderStatus | ''>({
  get: () => exportPageState.orderStatus,
  set: (value) => {
    exportPageState.orderStatus = value || '';
  },
});
const exportOrderNoKeyword = computed<string>({
  get: () => exportPageState.orderNoKeyword,
  set: (value) => {
    exportPageState.orderNoKeyword = value.trimStart();
  },
});
const exportTemplates = computed(() => exportPageState.templates);
const hasExportFilters = computed(() => hasOwnerTransactionExportFilters(exportPageState));

const unreadCount = (order: OrderRecord) => getPetPalConversationUnreadCount(order.conversation, 'owner');

const resolveOrderFilter = (order: OrderRecord): PetPalDeskOrderFilter => {
  if (isPetPalOutstandingOrder(order)) {
    return 'needs_payment';
  }
  if (isPetPalAftersalesStatus(order.orderStatus)) {
    return 'aftersales';
  }
  if (['PENDING_ACCEPT', 'ACCEPTED', 'SERVING'].includes(order.orderStatus)) {
    return 'active';
  }
  if (order.orderStatus === 'COMPLETED') {
    return 'done';
  }
  return 'all';
};

function buildOwnerDashboardRoute(notice: string) {
  return {
    name: 'frontend-petpal',
    query: buildPetPalDeskHandoffQuery({ notice }),
  };
}

function buildAftersalesRoute(notice: string, orderId?: string) {
  return {
    name: 'frontend-petpal-aftersales',
    query: buildPetPalDeskHandoffQuery({
      notice,
      ...(orderId ? { focusOrderId: orderId } : {}),
    }),
  };
}

function buildOrderDetailLink(order: OrderRecord) {
  return {
    name: 'frontend-petpal-order-detail',
    params: { id: order.id },
    query: buildPetPalDeskHandoffQuery({
      notice: '这里已经定位到这笔订单，可直接继续查看状态、沟通或履约留痕。',
      focusOrderId: order.id,
      focusFilter: resolveOrderFilter(order),
      tab: 'summary',
    }),
  };
}

function buildPaymentResultLink(order: OrderRecord) {
  return {
    name: 'frontend-petpal-payment-result',
    params: { id: order.id },
    query: buildPetPalDeskHandoffQuery({
      notice: '这里已经定位到这笔待支付订单的结果页，可直接继续付款。',
      focusOrderId: order.id,
    }),
  };
}

function clearExportFilters() {
  applyOwnerTransactionExportFilterSnapshot(
    exportPageState,
    createEmptyOwnerTransactionExportFilterSnapshot(),
  );
}

function applySelectedExportTemplate() {
  const appliedTemplate = applyNamedExportTemplate((template) => {
    applyOwnerTransactionExportFilterSnapshot(exportPageState, template);
  });

  if (!appliedTemplate) {
    return;
  }
  ElMessage.success(`已应用模板「${appliedTemplate.name}」`);
}

async function saveCurrentExportTemplate() {
  if (!hasExportFilters.value) {
    ElMessage.warning('请先选择至少一个交易导出筛选条件');
    return;
  }

  try {
    const { value } = await ElMessageBox.prompt(
      '为当前交易导出条件取一个名字，便于后续快速套用。',
      '保存交易导出模板',
      {
        confirmButtonText: '保存',
        cancelButtonText: '取消',
        inputValue: selectedExportTemplateName.value,
        inputValidator: validatePetPalExportTemplateName,
      },
    );

    const name = value.trim();
    const nextTemplate: OwnerTransactionExportTemplate = {
      name,
      ...cloneOwnerTransactionExportFilterSnapshot(exportPageState),
    };
    const result = saveNamedExportTemplate(nextTemplate);

    if (result.status === 'limit_exceeded') {
      ElMessage.warning(`最多只能保存 ${PETPAL_EXPORT_TEMPLATE_LIMIT} 个导出模板`);
      return;
    }

    ElMessage.success(result.status === 'updated' ? `模板「${name}」已更新` : `模板「${name}」已保存`);
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(getErrorMessage(error, '保存交易导出模板失败'));
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
      `删除后将不再保留模板「${templateName}」的交易导出条件。`,
      '删除交易导出模板',
      {
        type: 'warning',
        confirmButtonText: '删除',
        cancelButtonText: '取消',
      },
    );

    const removedTemplateName = removeNamedExportTemplate();
    if (!removedTemplateName) {
      return;
    }
    ElMessage.success(`模板「${removedTemplateName}」已删除`);
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(getErrorMessage(error, '删除交易导出模板失败'));
    }
  }
}

function buildTransactionExportRequest() {
  return api.petpal.orders.exportTransactions(buildOwnerTransactionExportQuery(exportPageState));
}

function applyRouteContext() {
  const routeFilter = getPetPalDeskOrderFilter(route.query);
  if (routeFilter) {
    filter.value = routeFilter;
    return;
  }
  if (highlightedOrder.value) {
    filter.value = resolveOrderFilter(highlightedOrder.value);
  }
}

async function loadPage() {
  try {
    loadState.value = 'idle';
    orders.value = await api.petpal.orders.list();
    loadState.value = 'ready';
    applyRouteContext();
  } catch (error: unknown) {
    loadState.value = 'error';
    ElMessage.error(getErrorMessage(error, '加载订单队列失败'));
  }
}

async function retryOrders() {
  await runPetPalSectionRetry({
    key: 'orders',
    sectionReloadingKey,
    reload: loadPage,
    getState: () => loadState.value,
    successMessage: '订单队列已刷新',
    swallowError: true,
  });
}

watch(
  () => [route.query.focusOrderId, route.query.focusFilter],
  () => {
    applyRouteContext();
  },
  { immediate: true },
);

onMounted(() => {
  void loadPage();
});
</script>

<style scoped lang="scss">
.petpal-export-toolbar {
  display: grid;
  gap: 12px;
  margin-top: 12px;
}

.petpal-export-toolbar__filters {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
}

.petpal-export-toolbar__control {
  width: 220px;
}

.petpal-export-toolbar__hint {
  margin: 0;
  color: #6b625a;
  font-size: 13px;
  line-height: 1.6;
}

.petpal-sheet-row.is-focused {
  margin-inline: -10px;
  padding-inline: 10px;
  background: rgba(244, 248, 255, 0.9);
}

@media (max-width: 720px) {
  .petpal-export-toolbar__filters {
    align-items: stretch;
  }

  .petpal-export-toolbar__control {
    width: 100%;
  }
}
</style>
