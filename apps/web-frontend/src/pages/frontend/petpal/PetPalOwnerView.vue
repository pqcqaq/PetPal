<template>
  <div class="frontend-page">
    <section class="frontend-page__hero">
      <p class="frontend-page__eyebrow">PetPal</p>
      <h1>宠托帮业主工作台</h1>
      <p>在一个页面完成宠物档案、照料需求、匹配照料者与订单跟踪。</p>
      <div class="frontend-page__hero-actions">
        <el-button type="primary" @click="reloadAll">刷新全部</el-button>
        <RouterLink class="frontend-page__button is-secondary" to="/login">登录后可提交请求</RouterLink>
      </div>
    </section>

    <section class="frontend-page__section-grid">
      <article class="frontend-card petpal-grid-span-4">
        <span class="frontend-card__eyebrow">宠物档案</span>
        <h3>新增宠物</h3>
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
          <el-form-item label="体重(kg)">
            <el-input-number v-model="petForm.weightKg" :min="0.1" :max="120" :precision="1" style="width: 100%" />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" :loading="petSaving" @click="createPet">保存宠物</el-button>
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
          <el-table-column prop="weightKg" label="体重" min-width="100">
            <template #default="scope">
              {{ scope.row.weightKg ?? '-' }}
            </template>
          </el-table-column>
          <el-table-column prop="createdAt" label="创建时间" min-width="170">
            <template #default="scope">
              {{ formatTime(scope.row.createdAt) }}
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
        <span class="frontend-card__eyebrow">需求与订单</span>
        <h3>当前业务进展</h3>
        <el-space direction="vertical" fill :size="14" style="width: 100%">
          <el-table :data="requests" size="small" v-loading="requestsLoading">
            <el-table-column prop="pet.name" label="宠物" min-width="120" />
            <el-table-column prop="serviceType" label="服务" min-width="100" />
            <el-table-column prop="status" label="状态" min-width="100" />
            <el-table-column prop="locationText" label="地点" min-width="140" />
            <el-table-column prop="startTime" label="开始" min-width="170">
              <template #default="scope">
                {{ formatTime(scope.row.startTime) }}
              </template>
            </el-table-column>
          </el-table>

          <el-table :data="orders" size="small" v-loading="ordersLoading">
            <el-table-column prop="orderNo" label="订单号" min-width="180" />
            <el-table-column prop="orderStatus" label="状态" min-width="120">
              <template #default="scope">
                {{ getOrderStatusLabel(scope.row.orderStatus) }}
              </template>
            </el-table-column>
            <el-table-column prop="amountTotal" label="总额" min-width="100" />
            <el-table-column prop="amountPaid" label="已付" min-width="100" />
            <el-table-column prop="amountRefunded" label="已退" min-width="100" />
            <el-table-column label="操作" min-width="180" fixed="right">
              <template #default="scope">
                <el-space>
                  <RouterLink :to="{ name: 'frontend-petpal-order-detail', params: { id: scope.row.id } }">
                    <el-button link type="primary" size="small">查看详情</el-button>
                  </RouterLink>
                  <el-button
                    v-if="scope.row.orderStatus === 'SERVING'"
                    link
                    type="success"
                    size="small"
                    :loading="caregiverActionLoadingKey === `confirm:${scope.row.id}`"
                    @click="confirmOrderComplete(scope.row.id)"
                  >
                    确认完成
                  </el-button>
                </el-space>
              </template>
            </el-table-column>
          </el-table>
        </el-space>
      </article>
    </section>

    <section class="frontend-card">
      <span class="frontend-card__eyebrow">匹配照料者</span>
      <h3>按服务类型和宠物种类快速筛选</h3>
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
          <el-form-item>
            <el-space>
              <el-button type="primary" :loading="caregiverProfileSaving" @click="saveCaregiverProfile">保存档案</el-button>
              <el-tag :type="caregiverProfile?.auditStatus === 'APPROVED' ? 'success' : (caregiverProfile?.auditStatus === 'REJECTED' ? 'danger' : 'warning')">
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
            <template #default="scope">{{ scope.row.isActive ? '是' : '否' }}</template>
          </el-table-column>
        </el-table>
      </article>
    </section>

    <section class="frontend-card">
      <span class="frontend-card__eyebrow">履约工作台</span>
      <h3>照料者订单与动作</h3>
      <el-space wrap style="margin-bottom: 12px">
        <el-select v-model="caregiverOrderQuery.status" style="width: 160px" @change="loadCaregiverOrders">
          <el-option label="全部状态" value="" />
          <el-option label="待接单" value="PENDING_ACCEPT" />
          <el-option label="已接单" value="ACCEPTED" />
          <el-option label="服务中" value="SERVING" />
          <el-option label="已完成" value="COMPLETED" />
        </el-select>
        <el-button @click="loadCaregiverOrders">刷新履约列表</el-button>
      </el-space>

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
              <el-button
                v-if="scope.row.orderStatus === 'SERVING'"
                link
                type="primary"
                size="small"
                :loading="caregiverActionLoadingKey === `log:${scope.row.id}`"
                @click="addCaregiverServiceLog(scope.row.id)"
              >
                服务记录
              </el-button>
              <el-button
                v-if="scope.row.orderStatus === 'SERVING'"
                link
                type="success"
                size="small"
                :loading="caregiverActionLoadingKey === `checkout:${scope.row.id}`"
                @click="checkOutCaregiverOrder(scope.row.id)"
              >
                签退
              </el-button>
              <RouterLink :to="{ name: 'frontend-petpal-order-detail', params: { id: scope.row.id } }">
                <el-button link type="info" size="small">详情</el-button>
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
  CreatePetPayload,
  CreateServiceRequestPayload,
  MatchCaregiverQuery,
  MatchedCaregiverRecord,
  OrderRecord,
  OrderStatus,
  PetProfileRecord,
  ServiceRequestRecord,
} from '@rbac/api-common';
import { onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { api } from '@/api/client';
import { getErrorMessage } from '@/utils/errors';

defineOptions({
  name: 'PetPalOwnerView',
});

const pets = ref<PetProfileRecord[]>([]);
const requests = ref<ServiceRequestRecord[]>([]);
const orders = ref<OrderRecord[]>([]);
const matchItems = ref<MatchedCaregiverRecord[]>([]);
const caregiverProfile = ref<CaregiverProfileRecord | null>(null);
const caregiverServices = ref<CaregiverServiceRecord[]>([]);
const caregiverOrders = ref<CaregiverOrderRecord[]>([]);

const petsLoading = ref(false);
const requestsLoading = ref(false);
const ordersLoading = ref(false);
const matchLoading = ref(false);
const petSaving = ref(false);
const requestSaving = ref(false);
const caregiverProfileSaving = ref(false);
const caregiverServiceSaving = ref(false);
const caregiverOrdersLoading = ref(false);
const caregiverActionLoadingKey = ref('');

const petForm = reactive<CreatePetPayload>({
  name: '',
  species: 'DOG',
  breed: '',
  weightKg: 5,
  neutered: false,
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

const caregiverProfileForm = reactive({
  intro: '',
  experienceYears: 0,
  serviceRadiusKm: 5,
  serviceCity: '',
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

const loadPets = async () => {
  try {
    petsLoading.value = true;
    pets.value = await api.petpal.pets.list();
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

const loadCaregiverProfile = async () => {
  try {
    const profile = await api.petpal.caregiver.profile();
    caregiverProfile.value = profile;
    caregiverProfileForm.intro = profile.intro || '';
    caregiverProfileForm.experienceYears = profile.experienceYears;
    caregiverProfileForm.serviceRadiusKm = profile.serviceRadiusKm;
    caregiverProfileForm.serviceCity = profile.serviceCity || '';
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

const withCaregiverOrderAction = async (
  key: string,
  successMessage: string,
  action: () => Promise<void>,
) => {
  try {
    caregiverActionLoadingKey.value = key;
    await action();
    ElMessage.success(successMessage);
    await Promise.all([loadCaregiverOrders(), loadOrders()]);
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

const addCaregiverServiceLog = async (orderId: string) => withCaregiverOrderAction(
  `log:${orderId}`,
  '服务记录已保存',
  async () => {
    const { value } = await ElMessageBox.prompt('填写本次服务记录', '新增服务记录', {
      inputType: 'textarea',
      inputPlaceholder: '例如：已遛狗 30 分钟，精神状态正常',
      confirmButtonText: '保存',
      cancelButtonText: '取消',
    });
    await api.petpal.caregiver.addServiceLog(orderId, {
      logType: 'NOTE',
      textNote: value,
    });
  },
);

const checkOutCaregiverOrder = async (orderId: string) => withCaregiverOrderAction(
  `checkout:${orderId}`,
  '签退成功',
  async () => {
    await api.petpal.caregiver.checkOutOrder(orderId);
  },
);

const confirmOrderComplete = async (orderId: string) => withCaregiverOrderAction(
  `confirm:${orderId}`,
  '订单已确认完成',
  async () => {
    await api.petpal.orders.confirmComplete(orderId);
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
    });
    caregiverProfile.value = profile;
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

const createPet = async () => {
  if (!petForm.name.trim()) {
    ElMessage.warning('请先填写宠物名称');
    return;
  }

  try {
    petSaving.value = true;
    await api.petpal.pets.create({
      ...petForm,
      breed: petForm.breed?.trim() || undefined,
    });
    petForm.name = '';
    petForm.breed = '';
    ElMessage.success('宠物已创建');
    await loadPets();
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '创建宠物失败'));
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
    ElMessage.warning('请填写服务地点');
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
      demandTags: [],
    });
    ElMessage.success('需求已发布');
    await Promise.all([loadRequests(), loadOrders()]);
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '发布需求失败'));
  } finally {
    requestSaving.value = false;
  }
};

const reloadAll = async () => {
  await Promise.all([
    loadPets(),
    loadRequests(),
    loadOrders(),
    loadMatches(),
    loadCaregiverProfile(),
    loadCaregiverServices(),
    loadCaregiverOrders(),
  ]);
};

onMounted(async () => {
  await reloadAll();
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

.petpal-match-form {
  margin-bottom: 10px;
}

@media (max-width: 900px) {
  .petpal-grid-span-4,
  .petpal-grid-span-5,
  .petpal-grid-span-7,
  .petpal-grid-span-8 {
    grid-column: span 1;
  }
}
</style>
