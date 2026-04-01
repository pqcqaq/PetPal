<template>
  <div class="frontend-page">
    <section class="frontend-page__hero">
      <p class="frontend-page__eyebrow">PetPal Owner</p>
      <h1>宠托帮主人服务台</h1>
      <p>把宠物建档、需求发布、照料者匹配和订单跟进收回到主人语义，不再把照料者工作流混在同一页里。</p>
      <div class="frontend-page__hero-actions">
        <el-button type="primary" :loading="pageLoading" @click="reloadAll">刷新主人数据</el-button>
        <RouterLink class="frontend-page__button is-secondary" :to="{ name: 'frontend-petpal-caregiver' }">
          进入照料者工作台
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
            <h3>主人主流程</h3>
            <p>优先围绕宠物、需求、订单和售后推进。照料者入驻、服务配置和履约动作已迁往独立照料者页。</p>
          </div>
          <div class="petpal-switch-links">
            <RouterLink :to="{ name: 'frontend-petpal-caregiver' }">照料者页</RouterLink>
            <RouterLink :to="{ name: 'frontend-petpal-legacy' }">兼容工作台</RouterLink>
          </div>
        </div>

        <div class="petpal-summary-grid">
          <div class="petpal-summary-card">
            <span>宠物档案</span>
            <strong>{{ pets.length }}</strong>
            <p>{{ pets.length ? '已建档宠物可直接复用到需求和订单。' : '先建立第一只宠物档案。' }}</p>
          </div>
          <div class="petpal-summary-card">
            <span>当前需求</span>
            <strong>{{ requests.length }}</strong>
            <p>{{ requests.length ? '继续确认时间、地点和预算。' : '发布一条真实照料需求。' }}</p>
          </div>
          <div class="petpal-summary-card">
            <span>订单跟进</span>
            <strong>{{ orders.length }}</strong>
            <p>{{ orders.length ? '优先看沟通、履约与售后进度。' : '订单将在匹配成功后出现在这里。' }}</p>
          </div>
          <div class="petpal-summary-card">
            <span>待读消息</span>
            <strong>{{ unreadOwnerConversationCount }}</strong>
            <p>{{ unreadOwnerConversationCount ? '建议优先进入订单详情处理沟通。' : '当前没有未读订单沟通。' }}</p>
          </div>
        </div>
      </article>

      <article class="frontend-card petpal-grid-span-4">
        <span class="frontend-card__eyebrow">切换工作流</span>
        <h3>相关入口</h3>
        <div class="petpal-side-actions">
          <RouterLink class="frontend-page__button is-secondary petpal-side-actions__button" :to="{ name: 'frontend-petpal-caregiver' }">
            照料者档案 / 服务 / 履约
          </RouterLink>
          <RouterLink class="frontend-page__button is-secondary petpal-side-actions__button" :to="{ name: 'frontend-petpal-legacy' }">
            兼容混合工作台
          </RouterLink>
          <RouterLink class="frontend-page__button is-secondary petpal-side-actions__button" to="/petpal-admin">
            后台直达工作区
          </RouterLink>
          <RouterLink class="frontend-page__button is-secondary petpal-side-actions__button" to="/login">
            {{ auth.isAuthenticated ? '切换账号' : '登录后提交数据' }}
          </RouterLink>
        </div>
      </article>
    </section>

    <section class="frontend-page__section-grid">
      <article class="frontend-card petpal-grid-span-4">
        <span class="frontend-card__eyebrow">宠物档案</span>
        <h3>{{ editingPetId ? '编辑宠物' : '新增宠物' }}</h3>
        <el-form :model="petForm" label-position="top" size="small">
          <el-form-item label="宠物名">
            <el-input v-model="petForm.name" placeholder="例如：可乐" />
          </el-form-item>
          <el-form-item label="物种">
            <el-select v-model="petForm.species" style="width: 100%">
              <el-option label="犬" value="DOG" />
              <el-option label="猫" value="CAT" />
              <el-option label="其他" value="OTHER" />
            </el-select>
          </el-form-item>
          <el-form-item label="品种">
            <el-input v-model="petForm.breed" placeholder="可选" />
          </el-form-item>
          <el-form-item label="生日">
            <el-date-picker
              v-model="petForm.birthday"
              type="date"
              value-format="YYYY-MM-DD"
              placeholder="可选"
              style="width: 100%"
            />
          </el-form-item>
          <el-form-item label="性别">
            <el-select v-model="petForm.gender" style="width: 100%">
              <el-option label="公" value="MALE" />
              <el-option label="母" value="FEMALE" />
              <el-option label="未知" value="UNKNOWN" />
            </el-select>
          </el-form-item>
          <el-form-item label="体重(kg)">
            <el-input-number v-model="petForm.weightKg" :min="0.1" :max="120" :precision="1" style="width: 100%" />
          </el-form-item>
          <el-form-item label="性格标签">
            <el-input v-model="petTemperamentTagsText" placeholder="例如：亲人，活泼，胆小" />
          </el-form-item>
          <el-form-item label="喂养备注">
            <el-input v-model="petForm.feedingNote" type="textarea" :rows="2" placeholder="例如：早晚各一次，换粮要慢" />
          </el-form-item>
          <el-form-item label="过敏提醒">
            <el-input v-model="petForm.allergyNote" type="textarea" :rows="2" placeholder="例如：对鸡肉冻干过敏" />
          </el-form-item>
          <el-form-item label="健康备注">
            <el-input v-model="petForm.medicalNote" type="textarea" :rows="3" placeholder="例如：近期体检结果、常用药、就诊史" />
          </el-form-item>
          <el-form-item label="紧急联系人">
            <el-space direction="vertical" fill style="width: 100%">
              <el-input v-model="petForm.emergencyContact.name" placeholder="联系人姓名" />
              <el-input v-model="petForm.emergencyContact.phone" placeholder="联系电话" />
              <el-input v-model="petForm.emergencyContact.relation" placeholder="关系，可选" />
            </el-space>
          </el-form-item>
          <el-form-item>
            <el-space>
              <el-button type="primary" :loading="petSaving" @click="createPet">
                {{ editingPetId ? '更新宠物档案' : '保存宠物' }}
              </el-button>
              <el-button v-if="editingPetId" @click="resetPetForm">取消编辑</el-button>
            </el-space>
          </el-form-item>
        </el-form>
      </article>

      <article class="frontend-card petpal-grid-span-8">
        <span class="frontend-card__eyebrow">宠物列表</span>
        <h3>我的宠物</h3>
        <el-table :data="pets" size="small" v-loading="petsLoading">
          <el-table-column prop="name" label="名称" min-width="120" />
          <el-table-column prop="species" label="物种" min-width="100" />
          <el-table-column prop="breed" label="品种" min-width="120" />
          <el-table-column prop="birthday" label="生日" min-width="120">
            <template #default="scope">
              {{ scope.row.birthday ? scope.row.birthday.slice(0, 10) : '-' }}
            </template>
          </el-table-column>
          <el-table-column prop="weightKg" label="体重" min-width="100">
            <template #default="scope">
              {{ scope.row.weightKg ?? '-' }}
            </template>
          </el-table-column>
          <el-table-column label="性格标签" min-width="180" show-overflow-tooltip>
            <template #default="scope">
              {{ formatPetTagSummary(scope.row.temperamentTags) }}
            </template>
          </el-table-column>
          <el-table-column label="喂养/健康" min-width="260" show-overflow-tooltip>
            <template #default="scope">
              {{ [scope.row.feedingNote, scope.row.allergyNote, scope.row.medicalNote].filter(Boolean).join(' ｜ ') || '-' }}
            </template>
          </el-table-column>
          <el-table-column label="紧急联系人" min-width="220" show-overflow-tooltip>
            <template #default="scope">
              {{ formatEmergencyContact(scope.row.emergencyContact) }}
            </template>
          </el-table-column>
          <el-table-column prop="createdAt" label="创建时间" min-width="170">
            <template #default="scope">
              {{ formatTime(scope.row.createdAt) }}
            </template>
          </el-table-column>
          <el-table-column label="操作" min-width="120" fixed="right">
            <template #default="scope">
              <el-space>
                <el-button link type="primary" size="small" @click="startEditPet(scope.row)">编辑</el-button>
                <el-button link type="success" size="small" @click="requestForm.petId = scope.row.id">选中</el-button>
              </el-space>
            </template>
          </el-table-column>
        </el-table>
      </article>
    </section>

    <section class="frontend-page__section-grid">
      <article class="frontend-card petpal-grid-span-5">
        <span class="frontend-card__eyebrow">服务需求</span>
        <h3>发布需求</h3>
        <el-form :model="requestForm" label-position="top" size="small">
          <el-form-item label="宠物">
            <el-select v-model="requestForm.petId" style="width: 100%" placeholder="先创建宠物后再发布需求">
              <el-option v-for="pet in pets" :key="pet.id" :label="`${pet.name}(${pet.species})`" :value="pet.id" />
            </el-select>
          </el-form-item>
          <el-form-item label="服务类型">
            <el-select v-model="requestForm.serviceType" style="width: 100%">
              <el-option label="寄养" value="BOARDING" />
              <el-option label="遛宠" value="WALKING" />
              <el-option label="喂养" value="FEEDING" />
              <el-option label="上门" value="DOOR_VISIT" />
            </el-select>
          </el-form-item>
          <el-form-item label="开始时间">
            <el-date-picker v-model="requestForm.startTime" type="datetime" style="width: 100%" />
          </el-form-item>
          <el-form-item label="结束时间">
            <el-date-picker v-model="requestForm.endTime" type="datetime" style="width: 100%" />
          </el-form-item>
          <el-form-item label="地点描述">
            <el-input v-model="requestForm.locationText" placeholder="例如：上海市静安区" />
          </el-form-item>
          <el-form-item label="预算(元)">
            <el-input-number v-model="requestForm.budgetAmount" :min="1" :max="20000" style="width: 100%" />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" :loading="requestSaving" @click="createRequest">发布需求</el-button>
          </el-form-item>
        </el-form>
      </article>

      <article class="frontend-card petpal-grid-span-7">
        <span class="frontend-card__eyebrow">当前业务进展</span>
        <div class="petpal-section-heading">
          <div class="petpal-section-heading__meta">
            <h3>需求与订单</h3>
            <p>高级退款导出、混合视图和历史兼容逻辑暂时保留在兼容工作台；当前主人页只承载真实主人主流程。</p>
          </div>
          <RouterLink class="frontend-page__button is-secondary" :to="{ name: 'frontend-petpal-legacy' }">
            高级导出 / 兼容视图
          </RouterLink>
        </div>

        <div class="petpal-request-list">
          <div class="petpal-mini-panel">
            <h4>近期需求</h4>
            <el-table :data="requests" size="small" v-loading="requestsLoading">
              <el-table-column label="宠物" min-width="120">
                <template #default="scope">
                  {{ scope.row.pet?.name || '-' }}
                </template>
              </el-table-column>
              <el-table-column prop="serviceType" label="服务" min-width="100" />
              <el-table-column prop="locationText" label="地点" min-width="140" show-overflow-tooltip />
              <el-table-column prop="budgetAmount" label="预算" min-width="100" />
              <el-table-column prop="status" label="状态" min-width="120" />
              <el-table-column prop="startTime" label="开始时间" min-width="170">
                <template #default="scope">
                  {{ formatTime(scope.row.startTime) }}
                </template>
              </el-table-column>
            </el-table>
          </div>

          <div class="petpal-mini-panel">
            <h4>订单跟进</h4>
            <el-table :data="orders" size="small" v-loading="ordersLoading">
              <el-table-column prop="orderNo" label="订单号" min-width="160" />
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
                        {{ formatConversationMeta(scope.row.conversation, 'owner') }}
                      </p>
                    </div>
                    <el-tag
                      v-if="getConversationUnreadCount(scope.row.conversation, 'owner') > 0"
                      type="danger"
                      size="small"
                    >
                      待读 {{ getConversationUnreadCount(scope.row.conversation, 'owner') }}
                    </el-tag>
                  </div>
                </template>
              </el-table-column>
              <el-table-column label="操作" min-width="120" fixed="right">
                <template #default="scope">
                  <RouterLink :to="{ name: 'frontend-petpal-order-detail', params: { id: scope.row.id } }">
                    <el-button link type="primary" size="small">详情</el-button>
                  </RouterLink>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </div>
      </article>
    </section>

    <section class="frontend-card">
      <span class="frontend-card__eyebrow">匹配照料者</span>
      <div class="petpal-section-heading">
        <div class="petpal-section-heading__meta">
          <h3>按服务类型和宠物种类快速筛选</h3>
          <p>如果你要切换为照料者视角维护报价、入驻和履约，请进入独立照料者工作台。</p>
        </div>
        <RouterLink class="frontend-page__button is-secondary" :to="{ name: 'frontend-petpal-caregiver' }">
          切到照料者页
        </RouterLink>
      </div>

      <el-form :inline="true" :model="matchQuery" size="small" class="petpal-match-form">
        <el-form-item label="服务">
          <el-select v-model="matchQuery.serviceType" style="width: 140px">
            <el-option label="寄养" value="BOARDING" />
            <el-option label="遛宠" value="WALKING" />
            <el-option label="喂养" value="FEEDING" />
            <el-option label="上门" value="DOOR_VISIT" />
          </el-select>
        </el-form-item>
        <el-form-item label="宠物种类">
          <el-select v-model="matchQuery.petSpecies" style="width: 120px">
            <el-option label="犬" value="DOG" />
            <el-option label="猫" value="CAT" />
            <el-option label="其他" value="OTHER" />
          </el-select>
        </el-form-item>
        <el-form-item label="城市">
          <el-input v-model="matchQuery.city" placeholder="可选" style="width: 180px" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="matchLoading" @click="loadMatches">开始匹配</el-button>
        </el-form-item>
      </el-form>

      <el-table :data="matchItems" size="small" v-loading="matchLoading">
        <el-table-column prop="caregiverName" label="照料者" min-width="140" />
        <el-table-column prop="city" label="城市" min-width="120" />
        <el-table-column prop="pricePerUnit" label="价格" min-width="100" />
        <el-table-column prop="unitType" label="计价单位" min-width="120" />
        <el-table-column prop="ratingAvg" label="评分" min-width="100" />
        <el-table-column prop="distanceKm" label="距离(km)" min-width="120">
          <template #default="scope">
            {{ scope.row.distanceKm ?? '-' }}
          </template>
        </el-table-column>
      </el-table>
    </section>
  </div>
</template>

<script setup lang="ts">
import type {
  CreatePetPayload,
  CreateServiceRequestPayload,
  MatchCaregiverQuery,
  MatchedCaregiverRecord,
  OrderRecord,
  OrderStatus,
  PetGender,
  PetProfileRecord,
  PetSpecies,
  ServiceRequestRecord,
} from '@rbac/api-common';
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { api } from '@/api/client';
import { useAuthStore } from '@/stores/auth';
import { getErrorMessage } from '@/utils/errors';

defineOptions({
  name: 'PetPalOwnerView',
});

type PetFormState = {
  name: string;
  species: PetSpecies;
  gender: PetGender;
  breed: string;
  birthday: string;
  weightKg: number;
  neutered: boolean;
  temperamentTags: string[];
  feedingNote: string;
  allergyNote: string;
  medicalNote: string;
  emergencyContact: {
    name: string;
    phone: string;
    relation: string;
  };
};

const auth = useAuthStore();

const pets = ref<PetProfileRecord[]>([]);
const requests = ref<ServiceRequestRecord[]>([]);
const orders = ref<OrderRecord[]>([]);
const matchItems = ref<MatchedCaregiverRecord[]>([]);
const editingPetId = ref('');
const petTemperamentTagsText = ref('');

const petsLoading = ref(false);
const requestsLoading = ref(false);
const ordersLoading = ref(false);
const matchLoading = ref(false);
const petSaving = ref(false);
const requestSaving = ref(false);

const petForm = reactive<PetFormState>({
  name: '',
  species: 'DOG',
  gender: 'UNKNOWN',
  breed: '',
  birthday: '',
  weightKg: 5,
  neutered: false,
  temperamentTags: [],
  feedingNote: '',
  allergyNote: '',
  medicalNote: '',
  emergencyContact: {
    name: '',
    phone: '',
    relation: '',
  },
});

const requestForm = reactive<{
  petId: string;
  serviceType: CreateServiceRequestPayload['serviceType'];
  startTime: Date;
  endTime: Date;
  locationText: string;
  budgetAmount: number;
}>({
  petId: '',
  serviceType: 'BOARDING',
  startTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
  endTime: new Date(Date.now() + 48 * 60 * 60 * 1000),
  locationText: '',
  budgetAmount: 200,
});

const matchQuery = reactive<MatchCaregiverQuery>({
  serviceType: 'BOARDING',
  petSpecies: 'DOG',
  city: '',
  page: 1,
  pageSize: 10,
});

const pageLoading = computed(() => (
  petsLoading.value
  || requestsLoading.value
  || ordersLoading.value
  || matchLoading.value
  || petSaving.value
  || requestSaving.value
));

const unreadOwnerConversationCount = computed(() => orders.value.reduce((total, item) => (
  total + getConversationUnreadCount(item.conversation, 'owner')
), 0));

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
  conversation: OrderRecord['conversation'] | null | undefined,
  role: 'owner' | 'caregiver',
) => {
  if (!conversation) {
    return 0;
  }
  return role === 'owner' ? conversation.ownerUnreadCount : conversation.caregiverUnreadCount;
};

const formatConversationPreview = (conversation: OrderRecord['conversation'] | null | undefined) => {
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
  conversation: OrderRecord['conversation'] | null | undefined,
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

const formatPetTagSummary = (tags?: string[]) => {
  const normalized = tags ?? [];
  return normalized.length ? normalized.join(' / ') : '-';
};

const formatEmergencyContact = (contact: PetProfileRecord['emergencyContact']) => {
  if (!contact) {
    return '-';
  }
  return [contact.name, contact.phone, contact.relation].filter(Boolean).join(' · ');
};

const resetPetForm = () => {
  editingPetId.value = '';
  petForm.name = '';
  petForm.species = 'DOG';
  petForm.gender = 'UNKNOWN';
  petForm.breed = '';
  petForm.birthday = '';
  petForm.weightKg = 5;
  petForm.neutered = false;
  petForm.temperamentTags = [];
  petTemperamentTagsText.value = '';
  petForm.feedingNote = '';
  petForm.allergyNote = '';
  petForm.medicalNote = '';
  petForm.emergencyContact = {
    name: '',
    phone: '',
    relation: '',
  };
};

const startEditPet = (pet: PetProfileRecord) => {
  editingPetId.value = pet.id;
  requestForm.petId = pet.id;
  petForm.name = pet.name;
  petForm.species = pet.species;
  petForm.gender = pet.gender;
  petForm.breed = pet.breed || '';
  petForm.birthday = pet.birthday ? pet.birthday.slice(0, 10) : '';
  petForm.weightKg = Number(pet.weightKg ?? 0) || 0;
  petForm.neutered = pet.neutered;
  petTemperamentTagsText.value = joinTagText(pet.temperamentTags);
  petForm.feedingNote = pet.feedingNote || '';
  petForm.allergyNote = pet.allergyNote || '';
  petForm.medicalNote = pet.medicalNote || '';
  petForm.emergencyContact = {
    name: pet.emergencyContact?.name || '',
    phone: pet.emergencyContact?.phone || '',
    relation: pet.emergencyContact?.relation || '',
  };
};

const loadPets = async () => {
  try {
    petsLoading.value = true;
    pets.value = await api.petpal.pets.list();
    if (!requestForm.petId && pets.value.length > 0) {
      requestForm.petId = pets.value[0].id;
    }
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '加载宠物失败'));
  } finally {
    petsLoading.value = false;
  }
};

const loadRequests = async () => {
  try {
    requestsLoading.value = true;
    requests.value = await api.petpal.requests.list();
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '加载需求失败'));
  } finally {
    requestsLoading.value = false;
  }
};

const loadOrders = async () => {
  try {
    ordersLoading.value = true;
    orders.value = await api.petpal.orders.list();
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '加载订单失败'));
  } finally {
    ordersLoading.value = false;
  }
};

const loadMatches = async () => {
  try {
    matchLoading.value = true;
    const page = await api.petpal.match.caregivers({
      ...matchQuery,
      city: matchQuery.city || undefined,
    });
    matchItems.value = page.items;
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '匹配照料者失败'));
  } finally {
    matchLoading.value = false;
  }
};

const reloadAll = async () => {
  if (!auth.isAuthenticated) {
    ElMessage.info('登录后可加载主人业务数据');
    return;
  }

  await Promise.all([
    loadPets(),
    loadRequests(),
    loadOrders(),
    loadMatches(),
  ]);
};

const createPet = async () => {
  if (!petForm.name.trim()) {
    ElMessage.warning('请先填写宠物名称');
    return;
  }

  try {
    petSaving.value = true;
    const payload: CreatePetPayload = {
      ...petForm,
      breed: petForm.breed.trim() || undefined,
      birthday: typeof petForm.birthday === 'string' && petForm.birthday
        ? petForm.birthday
        : undefined,
      weightKg: Number(petForm.weightKg || 0) > 0 ? Number(petForm.weightKg) : undefined,
      temperamentTags: splitTagText(petTemperamentTagsText.value),
      feedingNote: petForm.feedingNote.trim() || undefined,
      allergyNote: petForm.allergyNote.trim() || undefined,
      medicalNote: petForm.medicalNote.trim() || undefined,
      emergencyContact: petForm.emergencyContact?.name?.trim() && petForm.emergencyContact?.phone?.trim()
        ? {
            name: petForm.emergencyContact.name.trim(),
            phone: petForm.emergencyContact.phone.trim(),
            relation: petForm.emergencyContact.relation.trim() || undefined,
          }
        : undefined,
    };

    if (editingPetId.value) {
      await api.petpal.pets.update(editingPetId.value, payload);
      ElMessage.success('宠物档案已更新');
    } else {
      await api.petpal.pets.create(payload);
      ElMessage.success('宠物档案已创建');
    }

    resetPetForm();
    await loadPets();
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, editingPetId.value ? '更新宠物失败' : '创建宠物失败'));
  } finally {
    petSaving.value = false;
  }
};

const createRequest = async () => {
  if (!requestForm.petId) {
    ElMessage.warning('请先选择宠物');
    return;
  }
  if (!requestForm.locationText.trim()) {
    ElMessage.warning('请填写地点描述');
    return;
  }
  if (requestForm.endTime <= requestForm.startTime) {
    ElMessage.warning('结束时间必须晚于开始时间');
    return;
  }

  try {
    requestSaving.value = true;
    await api.petpal.requests.create({
      petId: requestForm.petId,
      serviceType: requestForm.serviceType,
      startTime: requestForm.startTime.toISOString(),
      endTime: requestForm.endTime.toISOString(),
      locationText: requestForm.locationText.trim(),
      budgetAmount: requestForm.budgetAmount,
    });
    ElMessage.success('需求已发布');
    await Promise.all([loadRequests(), loadOrders()]);
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '发布需求失败'));
  } finally {
    requestSaving.value = false;
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

.petpal-request-list {
  display: grid;
  gap: 18px;
}

.petpal-mini-panel {
  display: grid;
  gap: 14px;
}

.petpal-mini-panel h4 {
  margin: 0;
  font-size: 16px;
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

.petpal-match-form {
  margin-bottom: 16px;
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
