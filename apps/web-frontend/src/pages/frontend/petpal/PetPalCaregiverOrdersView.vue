<template>
  <PetPalDeskPage
    eyebrow="履约队列"
    title="接单、签到、服务记录和签退都收口到这一页"
    summary="履约页只服务当前订单动作，资料和服务配置都回各自页面维护。"
    :nav-items="petPalCaregiverWorkspaceNav"
    active-name="frontend-petpal-caregiver-orders"
    :actions="[{ label: '返回照料者总览', to: { name: 'frontend-petpal-caregiver' }, tone: 'secondary' }]"
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
            重试履约队列
          </el-button>
          <RouterLink v-else-if="activeOrder" :to="buildOrderDetailLink(activeOrder.id)">进入当前订单</RouterLink>
        </template>
      </PetPalDeskNotice>
    </template>

    <div class="petpal-split-grid">
      <PetPalDeskSection class="petpal-span-5" eyebrow="Orders" title="履约订单" description="先选中一笔订单，再看右侧当前可执行动作。">
        <PetPalDeskEmpty
          v-if="!orders.length"
          title="当前没有履约订单"
          description="当主人创建订单并由你接单后，这里会持续显示履约任务。"
        />

        <div v-else class="petpal-sheet-list">
          <button
            v-for="order in orders"
            :key="order.id"
            type="button"
            class="petpal-order-row"
            :class="{ 'is-active': order.id === selectedOrderId, 'is-focused': order.id === highlightedOrderId }"
            @click="selectedOrderId = order.id"
          >
            <div class="petpal-sheet-row__copy">
              <h3 class="petpal-sheet-row__title">{{ order.orderNo }}</h3>
              <p class="petpal-sheet-row__desc">{{ getPetPalOrderStatusLabel(order.orderStatus) }} · {{ order.ownerNickname }} · {{ order.petName || '宠物待同步' }}</p>
              <p class="petpal-sheet-row__desc">{{ formatPetPalRange(order.appointmentStart, order.appointmentEnd) }}</p>
            </div>
            <div class="petpal-sheet-row__tail">
              <span class="petpal-pill" :class="statusTone(order.orderStatus)">{{ getPetPalOrderStatusLabel(order.orderStatus) }}</span>
            </div>
          </button>
        </div>
      </PetPalDeskSection>

      <PetPalDeskSection class="petpal-span-7" eyebrow="Actions" title="当前履约动作" description="右侧只处理当前订单的履约动作，复杂沟通继续回订单详情。">
        <PetPalDeskEmpty
          v-if="!activeOrder"
          title="先选择左侧订单"
          description="选中订单后，这里会显示当前状态和下一步动作。"
        />

        <template v-else>
          <div class="petpal-summary-strip">
            <div>
              <span>订单状态</span>
              <strong>{{ getPetPalOrderStatusLabel(activeOrder.orderStatus) }}</strong>
            </div>
            <div>
              <span>宠物 / 主人</span>
              <strong>{{ activeOrder.petName || '宠物待同步' }} / {{ activeOrder.ownerNickname }}</strong>
            </div>
            <div>
              <span>服务时间</span>
              <strong>{{ formatPetPalRange(activeOrder.appointmentStart, activeOrder.appointmentEnd) }}</strong>
            </div>
          </div>

          <div class="petpal-actions">
            <el-button
              v-if="activeOrder.orderStatus === 'PENDING_ACCEPT'"
              type="primary"
              :loading="loadingKey === `accept:${activeOrder.id}`"
              @click="acceptOrder(activeOrder.id)"
            >
              接单
            </el-button>
            <el-button
              v-if="activeOrder.orderStatus === 'ACCEPTED'"
              type="primary"
              :loading="loadingKey === `checkin:${activeOrder.id}`"
              @click="checkInOrder(activeOrder.id)"
            >
              签到
            </el-button>
            <el-button
              v-if="activeOrder.orderStatus === 'SERVING'"
              type="primary"
              :loading="loadingKey === `checkout:${activeOrder.id}`"
              @click="checkOutOrder(activeOrder.id)"
            >
              签退
            </el-button>
            <RouterLink :to="buildOrderDetailLink(activeOrder.id)">查看完整订单详情</RouterLink>
          </div>

          <div v-if="activeOrder.orderStatus === 'SERVING'" class="petpal-side-stack">
            <h3 class="petpal-sheet-row__title">补充一条服务记录</h3>
            <div class="petpal-field-grid">
              <el-form-item label="记录类型">
                <el-select v-model="serviceLogForm.logType" style="width: 100%">
                  <el-option v-for="item in petPalServiceLogOptions" :key="item.value" :label="item.label" :value="item.value" />
                </el-select>
              </el-form-item>
              <el-form-item label="记录内容">
                <el-input v-model="serviceLogForm.textNote" type="textarea" :rows="4" maxlength="200" show-word-limit placeholder="记录这次照料情况" />
              </el-form-item>
            </div>
            <div class="petpal-actions">
              <el-button type="primary" :loading="loadingKey === `log:${activeOrder.id}`" @click="submitServiceLog(activeOrder.id)">提交服务记录</el-button>
            </div>
          </div>
        </template>
      </PetPalDeskSection>
    </div>
  </PetPalDeskPage>
</template>

<script setup lang="ts">
import type { CaregiverOrderRecord } from '@rbac/api-common';
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import { api } from '@/api/client';
import { getErrorMessage } from '@/utils/errors';
import PetPalDeskEmpty from './rebuild/petpal-desk-empty.vue';
import PetPalDeskNotice from './rebuild/petpal-desk-notice.vue';
import PetPalDeskPage from './rebuild/petpal-desk-page.vue';
import PetPalDeskSection from './rebuild/petpal-desk-section.vue';
import {
  buildPetPalDeskHandoffQuery,
  getPetPalQueryString,
  mergePetPalPageNotice,
  runPetPalSectionRetry,
  type PetPalSectionLoadState,
} from './recovery';
import {
  formatPetPalRange,
  getPetPalOrderStatusLabel,
  petPalCaregiverWorkspaceNav,
  petPalServiceLogOptions,
} from './shared';

const route = useRoute();
const orders = ref<CaregiverOrderRecord[]>([]);
const selectedOrderId = ref('');
const loadingKey = ref('');
const loadState = ref<PetPalSectionLoadState>('idle');
const sectionReloadingKey = ref<'' | 'orders'>('');
const serviceLogForm = reactive({
  logType: 'NOTE' as typeof petPalServiceLogOptions[number]['value'],
  textNote: '',
});

const activeOrder = computed(() => orders.value.find((item) => item.id === selectedOrderId.value) ?? null);
const highlightedOrderId = computed(() => getPetPalQueryString(route.query, 'focusOrderId'));
const heroStats = computed(() => [
  { label: '订单总数', value: String(orders.value.length), hint: '照料者全部履约订单' },
  { label: '待接单', value: String(orders.value.filter((item) => item.orderStatus === 'PENDING_ACCEPT').length), hint: '优先处理新订单' },
  { label: '服务中', value: String(orders.value.filter((item) => item.orderStatus === 'SERVING').length), hint: '签到后记得持续留痕' },
  { label: '已接单', value: String(orders.value.filter((item) => item.orderStatus === 'ACCEPTED').length), hint: '到达现场后再签到' },
]);
const pageNotice = computed(() => {
  const description = mergePetPalPageNotice([
    getPetPalQueryString(route.query, 'notice'),
    loadState.value === 'error' ? '履约订单刷新失败，可直接重试当前页' : '',
  ]);
  if (!description) {
    return null;
  }
  return {
    title: loadState.value === 'error' ? '履约队列暂未刷新完整' : '已回到履约队列',
    description,
    tone: loadState.value === 'error' ? 'warning' as const : 'accent' as const,
  };
});

const statusTone = (status: CaregiverOrderRecord['orderStatus']) => {
  if (status === 'SERVING') return 'is-success';
  if (status === 'PENDING_ACCEPT' || status === 'ACCEPTED') return 'is-warning';
  return '';
};

function buildOrderDetailLink(orderId: string) {
  return {
    name: 'frontend-petpal-order-detail',
    params: { id: orderId },
    query: buildPetPalDeskHandoffQuery({
      notice: '这笔订单需要继续履约，可直接回履约留痕区处理。',
      focusOrderId: orderId,
      focusRole: 'caregiver',
      tab: 'service',
    }),
  };
}

function applyRouteContext() {
  if (highlightedOrderId.value && orders.value.some((item) => item.id === highlightedOrderId.value)) {
    selectedOrderId.value = highlightedOrderId.value;
    return;
  }
  if (!orders.value.some((item) => item.id === selectedOrderId.value)) {
    selectedOrderId.value = orders.value[0]?.id || '';
  }
}

async function loadPage() {
  try {
    loadState.value = 'idle';
    const page = await api.petpal.caregiver.orders({ page: 1, pageSize: 50 });
    orders.value = page.items;
    loadState.value = 'ready';
    applyRouteContext();
  } catch (error: unknown) {
    loadState.value = 'error';
    ElMessage.error(getErrorMessage(error, '加载履约订单失败'));
  }
}

async function retryOrders() {
  await runPetPalSectionRetry({
    key: 'orders',
    sectionReloadingKey,
    reload: loadPage,
    getState: () => loadState.value,
    successMessage: '履约队列已刷新',
    swallowError: true,
  });
}

async function acceptOrder(orderId: string) {
  loadingKey.value = `accept:${orderId}`;
  try {
    await api.petpal.caregiver.acceptOrder(orderId);
    ElMessage.success('已接单');
    await loadPage();
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '接单失败'));
  } finally {
    loadingKey.value = '';
  }
}

async function checkInOrder(orderId: string) {
  loadingKey.value = `checkin:${orderId}`;
  try {
    await api.petpal.caregiver.checkInOrder(orderId);
    ElMessage.success('签到成功');
    await loadPage();
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '签到失败'));
  } finally {
    loadingKey.value = '';
  }
}

async function checkOutOrder(orderId: string) {
  loadingKey.value = `checkout:${orderId}`;
  try {
    await api.petpal.caregiver.checkOutOrder(orderId);
    ElMessage.success('签退成功');
    await loadPage();
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '签退失败'));
  } finally {
    loadingKey.value = '';
  }
}

async function submitServiceLog(orderId: string) {
  if (!serviceLogForm.textNote.trim()) {
    ElMessage.warning('请先填写服务记录内容');
    return;
  }
  loadingKey.value = `log:${orderId}`;
  try {
    await api.petpal.caregiver.addServiceLog(orderId, {
      logType: serviceLogForm.logType,
      textNote: serviceLogForm.textNote.trim(),
    });
    serviceLogForm.textNote = '';
    ElMessage.success('服务记录已提交');
    await loadPage();
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '提交服务记录失败'));
  } finally {
    loadingKey.value = '';
  }
}

onMounted(() => {
  void loadPage();
});

watch(
  () => route.query.focusOrderId,
  () => {
    applyRouteContext();
  },
  { immediate: true },
);
</script>

<style scoped lang="scss">
.petpal-order-row {
  width: 100%;
  display: flex;
  gap: 14px;
  justify-content: space-between;
  align-items: flex-start;
  padding: 16px 0;
  border: 0;
  border-top: 1px solid rgba(44, 37, 29, 0.1);
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.petpal-order-row:first-child {
  padding-top: 0;
  border-top: 0;
}

.petpal-order-row.is-active {
  color: #2563eb;
}

.petpal-order-row.is-focused {
  margin-inline: -10px;
  padding-inline: 16px;
  background: rgba(244, 248, 255, 0.9);
}
</style>
