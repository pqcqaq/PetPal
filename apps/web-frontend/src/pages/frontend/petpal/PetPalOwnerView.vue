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
        <div class="petpal-section-heading">
          <div class="petpal-section-heading__meta">
            <h3>当前业务进展</h3>
            <p v-if="auth.isAuthenticated" class="petpal-section-heading__hint">
              退款导出默认覆盖最近一年，可按退款日期和状态收窄范围。
            </p>
          </div>
          <div v-if="auth.isAuthenticated" class="petpal-export-toolbar">
            <el-space wrap :size="10">
              <el-date-picker
                v-model="ownerRefundExportDateRange"
                type="daterange"
                unlink-panels
                clearable
                range-separator="至"
                start-placeholder="退款开始日期"
                end-placeholder="退款结束日期"
                size="small"
                style="width: min(100%, 320px)"
              />
              <el-select
                v-model="ownerRefundExportType"
                clearable
                placeholder="退款类型"
                size="small"
                style="width: 140px"
              >
                <el-option
                  v-for="option in refundTypeOptions"
                  :key="option.value"
                  :label="option.label"
                  :value="option.value"
                />
              </el-select>
              <el-select
                v-model="ownerRefundExportStatus"
                clearable
                placeholder="退款状态"
                size="small"
                style="width: 140px"
              >
                <el-option
                  v-for="option in refundStatusOptions"
                  :key="option.value"
                  :label="option.label"
                  :value="option.value"
                />
              </el-select>
              <el-select
                v-model="ownerRefundExportServiceType"
                clearable
                placeholder="服务类型"
                size="small"
                style="width: 140px"
              >
                <el-option
                  v-for="option in refundExportServiceTypeOptions"
                  :key="option.value"
                  :label="option.label"
                  :value="option.value"
                />
              </el-select>
              <el-input
                v-model="ownerRefundExportOrderNoKeyword"
                clearable
                maxlength="64"
                placeholder="订单号关键词"
                size="small"
                style="width: min(100%, 180px)"
              />
            </el-space>
            <el-space wrap>
              <ListExportButton
                :request="buildOwnerTransactionExportRequest"
                label="导出近一年交易"
                pending-label="导出中"
                error-message="导出交易记录失败"
              />
              <ListExportButton
                :request="buildOwnerRefundExportRequest"
                label="导出退款明细"
                pending-label="导出中"
                error-message="导出退款明细失败"
              />
            </el-space>
          </div>
        </div>
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
                @click="openCaregiverServiceLogDialog(scope.row.id)"
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

    <el-dialog
      v-model="serviceLogDialogVisible"
      title="新增服务记录"
      width="680px"
      :close-on-click-modal="!serviceLogSubmitting"
      :close-on-press-escape="!serviceLogSubmitting"
      @closed="resetServiceLogDialog"
    >
      <el-form label-position="top">
        <el-form-item label="记录类型">
          <el-select v-model="serviceLogForm.logType" style="width: 100%">
            <el-option
              v-for="option in serviceLogTypeOptions"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="文字说明">
          <el-input
            v-model="serviceLogForm.textNote"
            type="textarea"
            :rows="4"
            maxlength="500"
            show-word-limit
            placeholder="例如：已遛狗 30 分钟，饮水正常，情绪稳定"
          />
        </el-form-item>

        <el-form-item label="服务媒体">
          <div class="petpal-service-log-dialog__upload">
            <template v-if="canUploadServiceLogMedia">
              <input
                ref="serviceLogFileInput"
                type="file"
                multiple
                accept="image/*,video/*"
                class="petpal-service-log-dialog__file-input"
                @change="onServiceLogFilesChange"
              />
              <div class="petpal-service-log-dialog__actions">
                <el-button :disabled="serviceLogSubmitting" @click="openServiceLogFilePicker">选择图片或视频</el-button>
                <el-button
                  v-if="serviceLogForm.files.length > 0"
                  link
                  type="danger"
                  :disabled="serviceLogSubmitting"
                  @click="clearServiceLogFiles"
                >
                  清空媒体
                </el-button>
              </div>
            </template>
            <p v-else class="petpal-service-log-dialog__hint is-warning">
              当前账号未满足服务记录媒体上传条件，需要照料者档案审核通过或具备 `file.upload` 权限，仍可提交纯文字服务记录。
            </p>

            <ul v-if="serviceLogForm.files.length > 0" class="petpal-service-log-dialog__file-list">
              <li
                v-for="(file, index) in serviceLogForm.files"
                :key="`${file.name}-${file.size}-${index}`"
                class="petpal-service-log-dialog__file-item"
              >
                <div class="petpal-service-log-dialog__file-meta">
                  <strong>{{ file.name }}</strong>
                  <span>{{ file.type || 'application/octet-stream' }} · {{ formatFileSize(file.size) }}</span>
                </div>
                <el-button
                  link
                  type="danger"
                  :disabled="serviceLogSubmitting"
                  @click="removeServiceLogFile(index)"
                >
                  移除
                </el-button>
              </li>
            </ul>
            <div v-else-if="canUploadServiceLogMedia" class="petpal-service-log-dialog__empty">
              可选上传图片或视频，保存后会附加到本次服务记录。
            </div>
          </div>
        </el-form-item>

        <el-form-item v-if="serviceLogUploadProgress !== null" label="上传进度">
          <el-progress
            :percentage="serviceLogUploadProgress"
            :status="serviceLogUploadProgress >= 100 ? 'success' : undefined"
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button :disabled="serviceLogSubmitting" @click="serviceLogDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="serviceLogSubmitting" @click="submitCaregiverServiceLog">
          保存记录
        </el-button>
      </template>
    </el-dialog>
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
  OwnerRefundExportQuery,
  OrderStatus,
  PetProfileRecord,
  RefundType,
  PetServiceType,
  RefundStatus,
  ServiceRequestRecord,
  ServiceLogType,
} from '@rbac/api-common';
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { api } from '@/api/client';
import ListExportButton from '@/components/download/ListExportButton.vue';
import { useAuthStore } from '@/stores/auth';
import { uploadAttachmentFile } from '@/utils/direct-upload';
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
const auth = useAuthStore();

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

const serviceLogTypeOptions: Array<{ label: string; value: ServiceLogType }> = [
  { label: '服务备注', value: 'NOTE' },
  { label: '喂养记录', value: 'FEED' },
  { label: '遛宠记录', value: 'WALK' },
  { label: '陪玩记录', value: 'PLAY' },
  { label: '健康观察', value: 'HEALTH' },
];

const createEmptyServiceLogForm = () => ({
  orderId: '',
  logType: 'NOTE' as ServiceLogType,
  textNote: '',
  files: [] as File[],
});

const serviceLogDialogVisible = ref(false);
const serviceLogSubmitting = ref(false);
const serviceLogUploadProgress = ref<number | null>(null);
const serviceLogFileInput = ref<HTMLInputElement | null>(null);
const serviceLogForm = reactive(createEmptyServiceLogForm());
const canUploadServiceLogMedia = computed(() =>
  auth.hasPermission('file.upload') || caregiverProfile.value?.auditStatus === 'APPROVED',
);

const formatTime = (value: string) => new Date(value).toLocaleString();
const formatFileSize = (size: number) => {
  if (size < 1024) {
    return `${size} B`;
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};
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

const refundStatusOptions: Array<{ label: string; value: RefundStatus }> = [
  { label: '待审核', value: 'PENDING' },
  { label: '已审核', value: 'APPROVED' },
  { label: '已驳回', value: 'REJECTED' },
  { label: '退款成功', value: 'SUCCESS' },
  { label: '退款失败', value: 'FAILED' },
];

const refundTypeOptions: Array<{ label: string; value: RefundType }> = [
  { label: '全额退款', value: 'FULL' },
  { label: '部分退款', value: 'PARTIAL' },
];

const refundExportServiceTypeOptions: Array<{ label: string; value: PetServiceType }> = [
  { label: '寄养', value: 'BOARDING' },
  { label: '遛宠', value: 'WALKING' },
  { label: '喂养', value: 'FEEDING' },
  { label: '上门陪伴', value: 'DOOR_VISIT' },
];

const ownerRefundExportDateRange = ref<[Date, Date] | null>(null);
const ownerRefundExportType = ref<RefundType | ''>('');
const ownerRefundExportStatus = ref<RefundStatus | ''>('');
const ownerRefundExportServiceType = ref<PetServiceType | ''>('');
const ownerRefundExportOrderNoKeyword = ref('');

const toDayBoundaryIsoString = (value: Date, boundary: 'start' | 'end') => {
  const next = new Date(value);
  if (boundary === 'start') {
    next.setHours(0, 0, 0, 0);
  } else {
    next.setHours(23, 59, 59, 999);
  }
  return next.toISOString();
};

const buildOwnerTransactionExportRequest = () => api.petpal.orders.exportTransactions();
const buildOwnerRefundExportQuery = (): OwnerRefundExportQuery => ({
  startDate: ownerRefundExportDateRange.value?.[0]
    ? toDayBoundaryIsoString(ownerRefundExportDateRange.value[0], 'start')
    : undefined,
  endDate: ownerRefundExportDateRange.value?.[1]
    ? toDayBoundaryIsoString(ownerRefundExportDateRange.value[1], 'end')
    : undefined,
  refundType: ownerRefundExportType.value || undefined,
  refundStatus: ownerRefundExportStatus.value || undefined,
  serviceType: ownerRefundExportServiceType.value || undefined,
  orderNoKeyword: ownerRefundExportOrderNoKeyword.value.trim() || undefined,
});
const buildOwnerRefundExportRequest = () => api.petpal.orders.exportRefundDetails(buildOwnerRefundExportQuery());

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

const resetServiceLogDialog = () => {
  Object.assign(serviceLogForm, createEmptyServiceLogForm());
  serviceLogUploadProgress.value = null;
  if (serviceLogFileInput.value) {
    serviceLogFileInput.value.value = '';
  }
};

const openCaregiverServiceLogDialog = (orderId: string) => {
  resetServiceLogDialog();
  serviceLogForm.orderId = orderId;
  serviceLogDialogVisible.value = true;
};

const openServiceLogFilePicker = () => {
  serviceLogFileInput.value?.click();
};

const clearServiceLogFiles = () => {
  serviceLogForm.files = [];
  if (serviceLogFileInput.value) {
    serviceLogFileInput.value.value = '';
  }
};

const onServiceLogFilesChange = (event: Event) => {
  const input = event.target as HTMLInputElement;
  serviceLogForm.files = Array.from(input.files ?? []);
};

const removeServiceLogFile = (index: number) => {
  serviceLogForm.files.splice(index, 1);
  if (serviceLogFileInput.value) {
    serviceLogFileInput.value.value = '';
  }
};

const uploadServiceLogMediaFiles = async (orderId: string) => {
  if (serviceLogForm.files.length === 0) {
    serviceLogUploadProgress.value = null;
    return [];
  }

  const totalBytes = serviceLogForm.files.reduce((sum, file) => sum + file.size, 0);
  const uploadedUrls: string[] = [];
  let completedBytes = 0;

  for (const file of serviceLogForm.files) {
    const uploaded = await uploadAttachmentFile(
      file,
      { tag1: 'petpal-service-log', tag2: orderId },
      (progress) => {
        const currentBytes = Math.round((file.size * progress) / 100);
        serviceLogUploadProgress.value = Math.min(
          99,
          Math.round(((completedBytes + currentBytes) / totalBytes) * 100),
        );
      },
    );
    uploadedUrls.push(uploaded.url);
    completedBytes += file.size;
    serviceLogUploadProgress.value = Math.min(
      99,
      Math.round((completedBytes / totalBytes) * 100),
    );
  }

  serviceLogUploadProgress.value = 100;
  return uploadedUrls;
};

const submitCaregiverServiceLog = async () => {
  const orderId = serviceLogForm.orderId;
  const textNote = serviceLogForm.textNote.trim();

  if (!orderId) {
    return;
  }

  if (!textNote && serviceLogForm.files.length === 0) {
    ElMessage.warning('请填写服务说明或上传至少一个媒体文件');
    return;
  }

  if (serviceLogForm.files.length > 0 && !canUploadServiceLogMedia.value) {
    ElMessage.warning('当前账号没有文件上传权限，请移除媒体后再提交');
    return;
  }

  try {
    serviceLogSubmitting.value = true;
    caregiverActionLoadingKey.value = `log:${orderId}`;
    const mediaUrls = await uploadServiceLogMediaFiles(orderId);
    await api.petpal.caregiver.addServiceLog(orderId, {
      logType: serviceLogForm.logType,
      textNote: textNote || undefined,
      mediaUrls,
    });
    serviceLogDialogVisible.value = false;
    resetServiceLogDialog();
    ElMessage.success('服务记录已保存');
    await Promise.all([loadCaregiverOrders(), loadOrders()]);
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '保存服务记录失败'));
  } finally {
    serviceLogSubmitting.value = false;
    serviceLogUploadProgress.value = null;
    caregiverActionLoadingKey.value = '';
  }
};

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

.petpal-section-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.petpal-section-heading__meta {
  display: grid;
  gap: 6px;
}

.petpal-section-heading h3 {
  margin: 0;
}

.petpal-section-heading__hint {
  margin: 0;
  color: #6b7280;
  font-size: 12px;
  line-height: 1.5;
}

.petpal-export-toolbar {
  display: grid;
  gap: 10px;
  justify-items: end;
}

.petpal-service-log-dialog__upload {
  display: grid;
  gap: 12px;
}

.petpal-service-log-dialog__file-input {
  display: none;
}

.petpal-service-log-dialog__actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.petpal-service-log-dialog__hint,
.petpal-service-log-dialog__empty {
  margin: 0;
  padding: 12px 14px;
  border-radius: 12px;
  background: #f6f8fb;
  color: #5f6b7a;
  line-height: 1.6;
}

.petpal-service-log-dialog__hint.is-warning {
  background: #fff8e6;
  color: #8a6200;
}

.petpal-service-log-dialog__file-list {
  display: grid;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.petpal-service-log-dialog__file-item {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid #e5ebf3;
  border-radius: 12px;
  background: #fff;
}

.petpal-service-log-dialog__file-meta {
  display: grid;
  gap: 4px;
}

.petpal-service-log-dialog__file-meta span {
  font-size: 12px;
  color: #6b7280;
}

@media (max-width: 900px) {
  .petpal-grid-span-4,
  .petpal-grid-span-5,
  .petpal-grid-span-7,
  .petpal-grid-span-8 {
    grid-column: span 1;
  }

  .petpal-section-heading {
    flex-direction: column;
    align-items: flex-start;
  }

  .petpal-export-toolbar {
    width: 100%;
    justify-items: start;
  }

  .petpal-service-log-dialog__file-item {
    flex-direction: column;
  }
}
</style>
