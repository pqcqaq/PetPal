<template>
  <div class="frontend-page">
    <section class="frontend-page__hero">
      <p class="frontend-page__eyebrow">PetPal Caregiver</p>
      <h1>宠托帮照料者工作台</h1>
      <p>把照料者入驻、服务配置和履约订单从主人工作台里拆出，直接面向照料者的真实工作场景。</p>
      <div class="frontend-page__hero-actions">
        <el-button type="primary" :loading="pageLoading" @click="reloadAll">刷新照料者数据</el-button>
        <RouterLink class="frontend-page__button is-secondary" :to="{ name: 'frontend-petpal' }">
          返回主人工作台
        </RouterLink>
        <RouterLink class="frontend-page__button is-secondary" :to="{ name: 'frontend-petpal-legacy' }">
          打开兼容工作台
        </RouterLink>
      </div>
    </section>

    <section class="frontend-page__section-grid">
      <article class="frontend-card petpal-grid-span-8">
        <span class="frontend-card__eyebrow">当前概览</span>
        <div class="petpal-section-heading">
          <div class="petpal-section-heading__meta">
            <h3>照料者主流程</h3>
            <p>先完成档案，再上架服务，最后集中处理接单和履约。更细的资质上传与高级服务记录暂时保留在兼容工作台。</p>
          </div>
          <div class="petpal-switch-links">
            <RouterLink :to="{ name: 'frontend-petpal' }">主人页</RouterLink>
            <RouterLink :to="{ name: 'frontend-petpal-legacy' }">兼容工作台</RouterLink>
          </div>
        </div>

        <div class="petpal-summary-grid">
          <div class="petpal-summary-card">
            <span>审核状态</span>
            <strong>{{ caregiverProfile?.auditStatus || 'PENDING' }}</strong>
            <p>{{ caregiverProfile ? '继续维护资料，避免审核反复驳回。' : '先建立照料者档案。' }}</p>
          </div>
          <div class="petpal-summary-card">
            <span>上架服务</span>
            <strong>{{ caregiverServices.length }}</strong>
            <p>{{ caregiverServices.length ? '继续优化价格、城市和适配宠物。' : '至少先创建一个可售服务。' }}</p>
          </div>
          <div class="petpal-summary-card">
            <span>履约订单</span>
            <strong>{{ caregiverOrders.length }}</strong>
            <p>{{ caregiverOrders.length ? '优先处理待接单和服务中订单。' : '订单会在接单后出现在这里。' }}</p>
          </div>
          <div class="petpal-summary-card">
            <span>未读沟通</span>
            <strong>{{ unreadConversationCount }}</strong>
            <p>{{ unreadConversationCount ? '建议优先进入订单详情确认交接信息。' : '当前没有未读照料者沟通。' }}</p>
          </div>
        </div>
      </article>

      <article class="frontend-card petpal-grid-span-4">
        <span class="frontend-card__eyebrow">兼容入口</span>
        <h3>高级操作</h3>
        <div class="petpal-side-actions">
          <RouterLink class="frontend-page__button is-secondary petpal-side-actions__button" :to="{ name: 'frontend-petpal-legacy' }">
            资质材料上传 / 高级履约
          </RouterLink>
          <RouterLink class="frontend-page__button is-secondary petpal-side-actions__button" to="/petpal-admin/caregiver-audits">
            后台审核台
          </RouterLink>
          <RouterLink class="frontend-page__button is-secondary petpal-side-actions__button" to="/login">
            {{ auth.isAuthenticated ? '切换账号' : '登录后提交数据' }}
          </RouterLink>
        </div>
      </article>
    </section>

    <section class="frontend-page__section-grid">
      <article class="frontend-card petpal-grid-span-5">
        <span class="frontend-card__eyebrow">照料者入驻</span>
        <h3>照料者档案</h3>
        <el-form :model="caregiverProfileForm" label-position="top" size="small">
          <el-form-item label="简介">
            <el-input v-model="caregiverProfileForm.intro" type="textarea" :rows="3" placeholder="介绍照料经验与服务风格" />
          </el-form-item>
          <el-form-item label="经验年限">
            <el-input-number v-model="caregiverProfileForm.experienceYears" :min="0" :max="60" style="width: 100%" />
          </el-form-item>
          <el-form-item label="服务半径(km)">
            <el-input-number v-model="caregiverProfileForm.serviceRadiusKm" :min="1" :max="100" style="width: 100%" />
          </el-form-item>
          <el-form-item label="服务城市">
            <el-input v-model="caregiverProfileForm.serviceCity" placeholder="例如：杭州" />
          </el-form-item>
          <el-form-item label="专长标签">
            <el-input v-model="caregiverProfileForm.specialtyTagsText" placeholder="例如：幼宠看护，猫咪喂养，异宠熟悉" />
          </el-form-item>
          <el-form-item label="服务承诺">
            <el-input
              v-model="caregiverProfileForm.serviceCommitment"
              type="textarea"
              :rows="3"
              placeholder="例如：支持每日两次图文反馈，紧急情况第一时间联系主人"
            />
          </el-form-item>
          <el-form-item>
            <el-space>
              <el-button type="primary" :loading="caregiverProfileSaving" @click="saveCaregiverProfile">保存档案</el-button>
              <el-tag :type="auditTagType">
                审核状态：{{ caregiverProfile?.auditStatus || 'PENDING' }}
              </el-tag>
            </el-space>
          </el-form-item>
        </el-form>
      </article>

      <article class="frontend-card petpal-grid-span-7">
        <span class="frontend-card__eyebrow">服务设置</span>
        <h3>新增照料服务</h3>
        <el-form :model="caregiverServiceForm" label-position="top" size="small">
          <el-row :gutter="12">
            <el-col :span="8">
              <el-form-item label="服务类型">
                <el-select v-model="caregiverServiceForm.serviceType" style="width: 100%">
                  <el-option label="寄养" value="BOARDING" />
                  <el-option label="遛宠" value="WALKING" />
                  <el-option label="喂养" value="FEEDING" />
                  <el-option label="上门" value="DOOR_VISIT" />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="宠物种类">
                <el-select v-model="caregiverServiceForm.petSpecies" style="width: 100%">
                  <el-option label="犬" value="DOG" />
                  <el-option label="猫" value="CAT" />
                  <el-option label="其他" value="OTHER" />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="价格">
                <el-input-number v-model="caregiverServiceForm.pricePerUnit" :min="1" :max="10000" style="width: 100%" />
              </el-form-item>
            </el-col>
          </el-row>
          <el-row :gutter="12">
            <el-col :span="8">
              <el-form-item label="计价单位">
                <el-input v-model="caregiverServiceForm.unitType" placeholder="例如：HOUR" />
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="最短提前小时">
                <el-input-number v-model="caregiverServiceForm.minNoticeHours" :min="0" :max="168" style="width: 100%" />
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="服务城市">
                <el-input v-model="caregiverServiceForm.serviceCity" placeholder="例如：杭州" />
              </el-form-item>
            </el-col>
          </el-row>
          <el-form-item>
            <el-button type="primary" :loading="caregiverServiceSaving" @click="createCaregiverService">新增服务</el-button>
          </el-form-item>
        </el-form>

        <el-table :data="caregiverServices" size="small">
          <el-table-column prop="serviceType" label="服务" min-width="100" />
          <el-table-column prop="petSpecies" label="宠物" min-width="80" />
          <el-table-column prop="pricePerUnit" label="价格" min-width="100" />
          <el-table-column prop="unitType" label="单位" min-width="100" />
          <el-table-column prop="serviceCity" label="城市" min-width="100" />
          <el-table-column prop="isActive" label="启用" min-width="80">
            <template #default="scope">
              {{ scope.row.isActive ? '是' : '否' }}
            </template>
          </el-table-column>
        </el-table>
      </article>
    </section>

    <section class="frontend-card">
      <span class="frontend-card__eyebrow">履约工作台</span>
      <div class="petpal-section-heading">
        <div class="petpal-section-heading__meta">
          <h3>照料者订单与动作</h3>
          <p>在独立照料者页里统一处理接单、签到和详情查看；更细的服务记录与材料上传保留在兼容页。</p>
        </div>
        <el-space wrap>
          <el-select v-model="caregiverOrderQuery.status" style="width: 160px" @change="loadCaregiverOrders">
            <el-option label="全部状态" value="" />
            <el-option label="待接单" value="PENDING_ACCEPT" />
            <el-option label="已接单" value="ACCEPTED" />
            <el-option label="服务中" value="SERVING" />
            <el-option label="已完成" value="COMPLETED" />
          </el-select>
          <el-button @click="loadCaregiverOrders">刷新履约列表</el-button>
        </el-space>
      </div>

      <el-table :data="caregiverOrders" size="small" v-loading="caregiverOrdersLoading">
        <el-table-column prop="orderNo" label="订单号" min-width="160" />
        <el-table-column prop="ownerNickname" label="主人" min-width="120" />
        <el-table-column prop="petName" label="宠物" min-width="120" />
        <el-table-column prop="locationText" label="地点" min-width="160" />
        <el-table-column prop="appointmentStart" label="预约开始" min-width="170">
          <template #default="scope">
            {{ formatTime(scope.row.appointmentStart) }}
          </template>
        </el-table-column>
        <el-table-column prop="orderStatus" label="状态" min-width="120">
          <template #default="scope">
            {{ getOrderStatusLabel(scope.row.orderStatus) }}
          </template>
        </el-table-column>
        <el-table-column label="订单沟通" min-width="280">
          <template #default="scope">
            <div class="petpal-conversation-cell">
              <div class="petpal-conversation-cell__copy">
                <p class="petpal-conversation-cell__preview">
                  {{ formatConversationPreview(scope.row.conversation) }}
                </p>
                <p class="petpal-conversation-cell__meta">
                  {{ formatConversationMeta(scope.row.conversation, 'caregiver') }}
                </p>
              </div>
              <el-tag
                v-if="getConversationUnreadCount(scope.row.conversation, 'caregiver') > 0"
                type="danger"
                size="small"
              >
                待读 {{ getConversationUnreadCount(scope.row.conversation, 'caregiver') }}
              </el-tag>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="动作" min-width="320" fixed="right">
          <template #default="scope">
            <el-space wrap>
              <el-button
                v-if="scope.row.orderStatus === 'PENDING_ACCEPT'"
                link
                type="primary"
                size="small"
                :loading="caregiverActionLoadingKey === `accept:${scope.row.id}`"
                @click="acceptCaregiverOrder(scope.row.id)"
              >
                接单
              </el-button>
              <el-button
                v-if="scope.row.orderStatus === 'ACCEPTED'"
                link
                type="warning"
                size="small"
                :loading="caregiverActionLoadingKey === `checkin:${scope.row.id}`"
                @click="checkInCaregiverOrder(scope.row.id)"
              >
                签到
              </el-button>
              <RouterLink :to="{ name: 'frontend-petpal-order-detail', params: { id: scope.row.id } }">
                <el-button link type="info" size="small">详情</el-button>
              </RouterLink>
              <RouterLink :to="{ name: 'frontend-petpal-legacy' }">
                <el-button link type="success" size="small">高级履约</el-button>
              </RouterLink>
            </el-space>
          </template>
        </el-table-column>
      </el-table>
    </section>
  </div>
</template>

<script setup lang="ts">
import type {
  CaregiverOrderRecord,
  CaregiverProfileRecord,
  CaregiverServiceRecord,
  CreateServiceRequestPayload,
  OrderStatus,
} from '@rbac/api-common';
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { api } from '@/api/client';
import { useAuthStore } from '@/stores/auth';
import { getErrorMessage } from '@/utils/errors';

defineOptions({
  name: 'PetPalCaregiverView',
});

type CaregiverProfileFormState = {
  intro: string;
  experienceYears: number;
  serviceRadiusKm: number;
  serviceCity: string;
  specialtyTagsText: string;
  serviceCommitment: string;
};

const auth = useAuthStore();

const caregiverProfile = ref<CaregiverProfileRecord | null>(null);
const caregiverServices = ref<CaregiverServiceRecord[]>([]);
const caregiverOrders = ref<CaregiverOrderRecord[]>([]);

const caregiverProfileSaving = ref(false);
const caregiverServiceSaving = ref(false);
const caregiverOrdersLoading = ref(false);
const caregiverActionLoadingKey = ref('');

const caregiverProfileForm = reactive<CaregiverProfileFormState>({
  intro: '',
  experienceYears: 0,
  serviceRadiusKm: 5,
  serviceCity: '',
  specialtyTagsText: '',
  serviceCommitment: '',
});

const caregiverServiceForm = reactive({
  serviceType: 'BOARDING' as CreateServiceRequestPayload['serviceType'],
  petSpecies: 'DOG' as 'DOG' | 'CAT' | 'OTHER',
  pricePerUnit: 50,
  unitType: 'HOUR',
  minNoticeHours: 2,
  serviceCity: '',
  serviceLat: undefined as number | undefined,
  serviceLng: undefined as number | undefined,
  isActive: true,
});

const caregiverOrderQuery = reactive<{
  page: number;
  pageSize: number;
  status: OrderStatus | '';
}>({
  page: 1,
  pageSize: 10,
  status: 'PENDING_ACCEPT',
});

const pageLoading = computed(() => (
  caregiverProfileSaving.value
  || caregiverServiceSaving.value
  || caregiverOrdersLoading.value
));

const unreadConversationCount = computed(() => caregiverOrders.value.reduce((total, item) => (
  total + getConversationUnreadCount(item.conversation, 'caregiver')
), 0));

const auditTagType = computed(() => {
  if (!caregiverProfile.value) {
    return 'warning';
  }
  if (caregiverProfile.value.auditStatus === 'APPROVED') {
    return 'success';
  }
  if (caregiverProfile.value.auditStatus === 'REJECTED') {
    return 'danger';
  }
  return 'warning';
});

const formatTime = (value: string) => new Date(value).toLocaleString();

const getOrderStatusLabel = (status: OrderStatus) => ({
  PENDING_ACCEPT: '待接单',
  ACCEPTED: '已接单',
  SERVING: '服务中',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
  DISPUTED: '纠纷中',
  PARTIAL_REFUNDED: '部分退款',
  REFUNDED: '已退款',
}[status] ?? status);

const getConversationUnreadCount = (
  conversation: CaregiverOrderRecord['conversation'] | null | undefined,
  role: 'owner' | 'caregiver',
) => {
  if (!conversation) {
    return 0;
  }
  return role === 'owner' ? conversation.ownerUnreadCount : conversation.caregiverUnreadCount;
};

const formatConversationPreview = (conversation: CaregiverOrderRecord['conversation'] | null | undefined) => {
  const preview = conversation?.lastMessagePreview?.trim();
  if (preview) {
    return preview;
  }
  if (conversation?.lastMessageAt) {
    return '最近更新了一条附件或简短消息';
  }
  return '暂未开始订单沟通，可进入详情页发送消息。';
};

const formatConversationMeta = (
  conversation: CaregiverOrderRecord['conversation'] | null | undefined,
  role: 'owner' | 'caregiver',
) => {
  const unreadCount = getConversationUnreadCount(conversation, role);
  const unreadText = unreadCount > 0 ? `${unreadCount} 条未读` : '已读完';
  if (conversation?.lastMessageAt) {
    return `${formatTime(conversation.lastMessageAt)} · ${unreadText}`;
  }
  return unreadCount > 0 ? unreadText : '暂无沟通记录';
};

const splitTagText = (value: string) => [...new Set(
  value
    .split(/[\n,，、]/)
    .map(item => item.trim())
    .filter(Boolean),
)];

const joinTagText = (tags?: string[]) => (tags ?? []).join('，');

const loadCaregiverProfile = async () => {
  try {
    const profile = await api.petpal.caregiver.profile();
    caregiverProfile.value = profile;
    caregiverProfileForm.intro = profile.intro || '';
    caregiverProfileForm.experienceYears = profile.experienceYears;
    caregiverProfileForm.serviceRadiusKm = profile.serviceRadiusKm;
    caregiverProfileForm.serviceCity = profile.serviceCity || '';
    caregiverProfileForm.specialtyTagsText = joinTagText(profile.specialtyTags);
    caregiverProfileForm.serviceCommitment = profile.serviceCommitment || '';
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '加载照料者档案失败'));
  }
};

const loadCaregiverServices = async () => {
  try {
    caregiverServices.value = await api.petpal.caregiver.services();
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '加载照料服务失败'));
  }
};

const loadCaregiverOrders = async () => {
  try {
    caregiverOrdersLoading.value = true;
    const response = await api.petpal.caregiver.orders({
      page: caregiverOrderQuery.page,
      pageSize: caregiverOrderQuery.pageSize,
      status: caregiverOrderQuery.status || undefined,
    });
    caregiverOrders.value = response.items;
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '加载履约订单失败'));
  } finally {
    caregiverOrdersLoading.value = false;
  }
};

const reloadAll = async () => {
  if (!auth.isAuthenticated) {
    ElMessage.info('登录后可加载照料者业务数据');
    return;
  }

  await Promise.all([
    loadCaregiverProfile(),
    loadCaregiverServices(),
    loadCaregiverOrders(),
  ]);
};

const withCaregiverOrderAction = async (
  key: string,
  successMessage: string,
  action: () => Promise<void>,
) => {
  try {
    caregiverActionLoadingKey.value = key;
    await action();
    ElMessage.success(successMessage);
    await loadCaregiverOrders();
  } catch (error: unknown) {
    if (error === 'cancel' || error === 'close') {
      return;
    }
    ElMessage.error(getErrorMessage(error, '履约动作执行失败'));
  } finally {
    caregiverActionLoadingKey.value = '';
  }
};

const acceptCaregiverOrder = async (orderId: string) => withCaregiverOrderAction(
  `accept:${orderId}`,
  '已接单',
  async () => {
    await api.petpal.caregiver.acceptOrder(orderId);
  },
);

const checkInCaregiverOrder = async (orderId: string) => withCaregiverOrderAction(
  `checkin:${orderId}`,
  '签到成功',
  async () => {
    await api.petpal.caregiver.checkInOrder(orderId);
  },
);

const saveCaregiverProfile = async () => {
  try {
    caregiverProfileSaving.value = true;
    const profile = await api.petpal.caregiver.upsertProfile({
      intro: caregiverProfileForm.intro.trim() || undefined,
      experienceYears: caregiverProfileForm.experienceYears,
      serviceRadiusKm: caregiverProfileForm.serviceRadiusKm,
      serviceCity: caregiverProfileForm.serviceCity.trim() || undefined,
      specialtyTags: splitTagText(caregiverProfileForm.specialtyTagsText),
      serviceCommitment: caregiverProfileForm.serviceCommitment.trim() || undefined,
      qualificationMaterials: caregiverProfile.value?.qualificationMaterials || [],
    });
    caregiverProfile.value = profile;
    caregiverProfileForm.specialtyTagsText = joinTagText(profile.specialtyTags);
    caregiverProfileForm.serviceCommitment = profile.serviceCommitment || '';
    ElMessage.success('照料者档案已更新');
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '保存照料者档案失败'));
  } finally {
    caregiverProfileSaving.value = false;
  }
};

const createCaregiverService = async () => {
  if (!caregiverServiceForm.unitType.trim()) {
    ElMessage.warning('请填写计价单位');
    return;
  }

  try {
    caregiverServiceSaving.value = true;
    await api.petpal.caregiver.createService({
      serviceType: caregiverServiceForm.serviceType,
      petSpecies: caregiverServiceForm.petSpecies,
      pricePerUnit: caregiverServiceForm.pricePerUnit,
      unitType: caregiverServiceForm.unitType.trim(),
      minNoticeHours: caregiverServiceForm.minNoticeHours,
      serviceCity: caregiverServiceForm.serviceCity.trim() || undefined,
      serviceLat: caregiverServiceForm.serviceLat,
      serviceLng: caregiverServiceForm.serviceLng,
      isActive: caregiverServiceForm.isActive,
      availableSlots: [],
    });
    ElMessage.success('照料服务已创建');
    await loadCaregiverServices();
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '创建照料服务失败'));
  } finally {
    caregiverServiceSaving.value = false;
  }
};

onMounted(() => {
  if (!auth.isAuthenticated) {
    return;
  }
  void reloadAll();
});
</script>

<style scoped lang="scss">
.petpal-grid-span-4 {
  grid-column: span 4;
}

.petpal-grid-span-5 {
  grid-column: span 5;
}

.petpal-grid-span-7 {
  grid-column: span 7;
}

.petpal-grid-span-8 {
  grid-column: span 8;
}

.petpal-section-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

.petpal-section-heading__meta {
  display: grid;
  gap: 8px;
}

.petpal-section-heading h3 {
  margin: 0;
}

.petpal-section-heading__meta p {
  margin: 0;
  color: var(--frontend-color-muted);
  line-height: 1.7;
}

.petpal-switch-links {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.petpal-switch-links a {
  color: var(--frontend-color-primary);
  font-weight: 600;
  text-decoration: none;
}

.petpal-summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.petpal-summary-card {
  display: grid;
  gap: 8px;
  padding: 16px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(15, 23, 42, 0.06);
}

.petpal-summary-card span {
  color: var(--frontend-color-muted);
  font-size: 13px;
}

.petpal-summary-card strong {
  font-size: 30px;
  line-height: 1.1;
}

.petpal-summary-card p {
  margin: 0;
  color: var(--frontend-color-muted);
  line-height: 1.6;
}

.petpal-side-actions {
  display: grid;
  gap: 12px;
}

.petpal-side-actions__button {
  justify-content: center;
}

.petpal-conversation-cell {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  justify-content: space-between;
}

.petpal-conversation-cell__copy {
  min-width: 0;
  display: grid;
  gap: 6px;
}

.petpal-conversation-cell__preview,
.petpal-conversation-cell__meta {
  margin: 0;
  line-height: 1.6;
}

.petpal-conversation-cell__preview {
  color: #0f172a;
}

.petpal-conversation-cell__meta {
  color: var(--frontend-color-muted);
  font-size: 12px;
}

@media (max-width: 1200px) {
  .petpal-grid-span-4,
  .petpal-grid-span-5,
  .petpal-grid-span-7,
  .petpal-grid-span-8 {
    grid-column: span 12;
  }

  .petpal-summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .petpal-section-heading {
    flex-direction: column;
  }

  .petpal-summary-grid {
    grid-template-columns: 1fr;
  }
}
</style>
