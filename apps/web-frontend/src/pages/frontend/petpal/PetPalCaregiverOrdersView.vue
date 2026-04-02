<!--
UX Blueprint
User: 照料者需要按阶段处理待接单、签到、服务记录和签退
Entry: 照料者总览、提醒回流
First screen: 阶段筛选、待接单和服务中数量、直接执行当前动作
Primary action: 接单、签到、记录服务、签退
Secondary actions: 查看订单详情
States: 未登录、加载失败、空态、动作执行中
-->
<template>
  <div class="frontend-page">
    <PetPalWorkspaceHero
      eyebrow="照料者工作区"
      title="履约队列"
      summary="履约页只负责处理订单阶段动作，入驻资料和服务配置继续留在各自页面。"
      :nav-items="petPalCaregiverWorkspaceNav"
      active-name="frontend-petpal-caregiver-orders"
      :stats="heroStats"
      :primary-action="{ label: '返回照料者总览', to: { name: 'frontend-petpal-caregiver' } }"
      :actions="heroActions"
    />

    <template v-if="auth.isAuthenticated">
      <section v-if="pageLoadState === 'error'" class="frontend-card">
        <PetPalStatePanel
          eyebrow="履约队列"
          title="履约队列加载失败"
          :description="pageLoadErrorMessage"
          tone="danger"
        >
          <template #actions>
            <el-button size="small" type="primary" :loading="loading" @click="loadPage">重试加载</el-button>
          </template>
        </PetPalStatePanel>
      </section>

      <section v-else class="frontend-card">
        <span class="frontend-card__eyebrow">履约筛选</span>
        <div class="petpal-toolbar">
          <el-radio-group v-model="statusFilter" size="small" @change="loadPage">
            <el-radio-button label="">全部</el-radio-button>
            <el-radio-button label="PENDING_ACCEPT">待接单</el-radio-button>
            <el-radio-button label="ACCEPTED">已接单</el-radio-button>
            <el-radio-button label="SERVING">服务中</el-radio-button>
            <el-radio-button label="COMPLETED">已完成</el-radio-button>
          </el-radio-group>
          <RouterLink :to="{ name: 'frontend-petpal-messages' }">去消息中心</RouterLink>
        </div>

        <div v-if="orders.length" class="petpal-order-list">
          <article v-for="order in orders" :key="order.id" class="petpal-order-card">
            <div class="petpal-order-card__head">
              <div>
                <h3>{{ order.orderNo }}</h3>
                <p>{{ order.ownerNickname }} · {{ order.petName || '宠物待同步' }} · {{ formatPetPalRange(order.appointmentStart, order.appointmentEnd) }}</p>
              </div>
              <el-tag size="small" :type="order.orderStatus === 'SERVING' ? 'warning' : order.orderStatus === 'COMPLETED' ? 'success' : 'primary'">
                {{ order.orderStatus }}
              </el-tag>
            </div>

            <div class="petpal-order-card__metrics">
              <div>
                <span>地点</span>
                <strong>{{ order.locationText || '待确认' }}</strong>
              </div>
              <div>
                <span>主人</span>
                <strong>{{ order.ownerNickname }}</strong>
              </div>
              <div>
                <span>最近沟通</span>
                <strong>{{ order.conversation?.lastMessagePreview || '暂无' }}</strong>
              </div>
            </div>

            <div class="petpal-card-actions">
              <el-button
                v-if="order.orderStatus === 'PENDING_ACCEPT'"
                type="primary"
                size="small"
                :loading="actionLoadingKey === `accept:${order.id}`"
                @click="acceptOrder(order.id)"
              >
                接单
              </el-button>
              <el-button
                v-if="order.orderStatus === 'ACCEPTED'"
                type="warning"
                size="small"
                :loading="actionLoadingKey === `checkin:${order.id}`"
                @click="checkInOrder(order.id)"
              >
                签到
              </el-button>
              <el-button
                v-if="order.orderStatus === 'SERVING'"
                type="primary"
                size="small"
                :loading="actionLoadingKey === `log:${order.id}`"
                @click="openLogDialog(order.id)"
              >
                服务记录
              </el-button>
              <el-button
                v-if="order.orderStatus === 'SERVING'"
                type="success"
                size="small"
                :loading="actionLoadingKey === `checkout:${order.id}`"
                @click="checkOutOrder(order.id)"
              >
                签退
              </el-button>
              <RouterLink class="frontend-page__button is-secondary" :to="{ name: 'frontend-petpal-order-detail', params: { id: order.id } }">
                查看详情
              </RouterLink>
            </div>
          </article>
        </div>

        <PetPalStatePanel
          v-else
          eyebrow="履约队列"
          title="当前筛选下没有订单"
          description="先补好入驻资料和服务清单，再回这里处理接单和履约。"
        />
      </section>
    </template>

    <section v-else class="frontend-card">
      <PetPalStatePanel
        eyebrow="履约队列"
        title="登录后查看履约队列"
        description="登录后按阶段处理接单、签到、服务记录和签退。"
      >
        <template #actions>
          <RouterLink to="/login">
            <el-button size="small" type="primary">去登录</el-button>
          </RouterLink>
        </template>
      </PetPalStatePanel>
    </section>

    <el-dialog v-model="serviceLogDialogVisible" title="记录服务" width="420px">
      <el-form label-position="top" size="small">
        <el-form-item label="记录类型">
          <el-select v-model="serviceLogForm.logType" style="width: 100%">
            <el-option label="备注" value="NOTE" />
            <el-option label="喂养" value="FEED" />
            <el-option label="遛宠" value="WALK" />
            <el-option label="陪伴" value="PLAY" />
            <el-option label="观察" value="HEALTH" />
          </el-select>
        </el-form-item>
        <el-form-item label="说明">
          <el-input v-model="serviceLogForm.textNote" type="textarea" :rows="4" placeholder="记录本次照料情况" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="serviceLogDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="actionLoadingKey === `log:${serviceLogForm.orderId}`" @click="submitServiceLog">
          保存记录
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import type { CaregiverOrderRecord, OrderStatus, ServiceLogType } from '@rbac/api-common';
import { computed, onMounted, reactive, ref } from 'vue';
import { ElButton, ElMessage } from 'element-plus';
import { api } from '@/api/client';
import PetPalStatePanel from '@/pages/frontend/petpal/PetPalStatePanel.vue';
import PetPalWorkspaceHero from '@/pages/frontend/petpal/components/PetPalWorkspaceHero.vue';
import { useAuthStore } from '@/stores/auth';
import { getErrorMessage } from '@/utils/errors';
import { formatPetPalRange, petPalCaregiverWorkspaceNav } from './shared';

const auth = useAuthStore();

const loading = ref(false);
const actionLoadingKey = ref('');
const statusFilter = ref<OrderStatus | ''>('');
const pageLoadState = ref<'idle' | 'ready' | 'error'>('idle');
const pageLoadErrorMessage = ref('');
const orders = ref<CaregiverOrderRecord[]>([]);

const serviceLogDialogVisible = ref(false);
const serviceLogForm = reactive({
  orderId: '',
  logType: 'NOTE' as ServiceLogType,
  textNote: '',
});

const heroStats = computed(() => [
  {
    label: '当前筛选',
    value: statusFilter.value || '全部',
    hint: '履约页只看订单阶段',
  },
  {
    label: '待接单',
    value: String(orders.value.filter((item) => item.orderStatus === 'PENDING_ACCEPT').length),
    hint: '优先处理新订单',
  },
  {
    label: '服务中',
    value: String(orders.value.filter((item) => item.orderStatus === 'SERVING').length),
    hint: '继续记录和签退',
  },
  {
    label: '已完成',
    value: String(orders.value.filter((item) => item.orderStatus === 'COMPLETED').length),
    hint: '可回看履约结果',
  },
]);

const heroActions = computed(() => [
  { label: '服务清单', to: { name: 'frontend-petpal-caregiver-services' }, tone: 'secondary' as const },
  { label: '入驻资料', to: { name: 'frontend-petpal-caregiver-profile' }, tone: 'secondary' as const },
]);

async function loadPage() {
  if (!auth.isAuthenticated || loading.value) {
    return;
  }

  loading.value = true;
  pageLoadState.value = 'idle';
  pageLoadErrorMessage.value = '';

  try {
    const page = await api.petpal.caregiver.orders({
      page: 1,
      pageSize: 20,
      status: statusFilter.value || undefined,
    });
    orders.value = page.items;
    pageLoadState.value = 'ready';
  } catch (error: unknown) {
    orders.value = [];
    pageLoadState.value = 'error';
    pageLoadErrorMessage.value = getErrorMessage(error, '加载履约队列失败');
  } finally {
    loading.value = false;
  }
}

async function acceptOrder(orderId: string) {
  actionLoadingKey.value = `accept:${orderId}`;
  try {
    await api.petpal.caregiver.acceptOrder(orderId);
    ElMessage.success('已接单');
    await loadPage();
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '接单失败'));
  } finally {
    actionLoadingKey.value = '';
  }
}

async function checkInOrder(orderId: string) {
  actionLoadingKey.value = `checkin:${orderId}`;
  try {
    await api.petpal.caregiver.checkInOrder(orderId);
    ElMessage.success('签到成功');
    await loadPage();
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '签到失败'));
  } finally {
    actionLoadingKey.value = '';
  }
}

function openLogDialog(orderId: string) {
  serviceLogForm.orderId = orderId;
  serviceLogForm.logType = 'NOTE';
  serviceLogForm.textNote = '';
  serviceLogDialogVisible.value = true;
}

async function submitServiceLog() {
  if (!serviceLogForm.orderId) {
    return;
  }
  if (!serviceLogForm.textNote.trim()) {
    ElMessage.warning('请先填写服务说明');
    return;
  }

  actionLoadingKey.value = `log:${serviceLogForm.orderId}`;
  try {
    await api.petpal.caregiver.addServiceLog(serviceLogForm.orderId, {
      logType: serviceLogForm.logType,
      textNote: serviceLogForm.textNote.trim(),
      mediaUrls: [],
    });
    serviceLogDialogVisible.value = false;
    ElMessage.success('服务记录已保存');
    await loadPage();
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '保存服务记录失败'));
  } finally {
    actionLoadingKey.value = '';
  }
}

async function checkOutOrder(orderId: string) {
  actionLoadingKey.value = `checkout:${orderId}`;
  try {
    await api.petpal.caregiver.checkOutOrder(orderId);
    ElMessage.success('签退成功');
    await loadPage();
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '签退失败'));
  } finally {
    actionLoadingKey.value = '';
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
.petpal-toolbar,
.petpal-order-card__head,
.petpal-card-actions {
  display: flex;
  gap: 12px;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
}

.petpal-order-list,
.petpal-order-card {
  display: grid;
  gap: 14px;
}

.petpal-order-card {
  padding: 18px;
  border-radius: 20px;
  border: 1px solid rgba(18, 53, 51, 0.08);
  background: rgba(248, 252, 251, 0.86);
}

.petpal-order-card__metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.petpal-order-card__metrics div {
  display: grid;
  gap: 6px;
  padding: 14px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.9);
}

.petpal-order-card__metrics span {
  color: #6d8683;
  font-size: 12px;
}

@media (max-width: 720px) {
  .petpal-order-card__metrics {
    grid-template-columns: 1fr;
  }
}
</style>
