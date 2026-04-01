<template>
  <div class="frontend-page">
    <section class="frontend-page__hero">
      <p class="frontend-page__eyebrow">PetPal Caregiver</p>
      <h1>宠托帮照料者工作台</h1>
      <p>把照料者入驻、服务配置和履约订单从主人工作台里拆出，直接面向照料者的真实工作场景。</p>
      <div class="frontend-page__hero-actions">
        <el-button type="primary" :loading="pageLoading" @click="reloadAll">刷新照料者数据</el-button>
        <RouterLink class="frontend-page__button is-secondary" :to="{ name: 'frontend-petpal-messages' }">
          打开消息中心
        </RouterLink>
        <RouterLink class="frontend-page__button is-secondary" :to="{ name: 'frontend-petpal-reminders' }">
          打开提醒中心
        </RouterLink>
        <RouterLink class="frontend-page__button is-secondary" :to="{ name: 'frontend-petpal' }">
          返回主人工作台
        </RouterLink>
        <RouterLink class="frontend-page__button is-secondary" :to="{ name: 'frontend-petpal-legacy' }">
          打开兼容入口
        </RouterLink>
      </div>
    </section>

    <template v-if="auth.isAuthenticated">
      <section v-if="pageLoadState === 'error'" class="frontend-card">
        <PetPalStatePanel
          eyebrow="照料者工作台"
          title="照料者工作台加载失败"
          :description="pageLoadErrorMessage"
          tone="danger"
        >
          <template #actions>
            <el-button size="small" type="primary" :loading="pageLoading" @click="reloadAll">重试加载</el-button>
            <RouterLink :to="{ name: 'frontend-petpal-legacy' }">
              <el-button size="small">去兼容入口</el-button>
            </RouterLink>
          </template>
        </PetPalStatePanel>
      </section>

      <template v-else>
        <section v-if="partialLoadNotice" class="frontend-card">
          <PetPalStatePanel
            eyebrow="加载提示"
            title="照料者工作台部分数据未完整加载"
            :description="partialLoadNotice"
            tone="warning"
          >
            <template #actions>
              <el-button size="small" type="primary" :loading="pageLoading" @click="reloadAll">重新加载</el-button>
              <RouterLink :to="{ name: 'frontend-petpal-reminders' }">
                <el-button size="small">先看提醒中心</el-button>
              </RouterLink>
            </template>
          </PetPalStatePanel>
        </section>

        <section class="frontend-page__section-grid">
      <article class="frontend-card petpal-grid-span-8">
        <span class="frontend-card__eyebrow">当前概览</span>
        <div class="petpal-section-heading">
          <div class="petpal-section-heading__meta">
            <h3>照料者主流程</h3>
            <p>先完成档案，再上架服务，最后集中处理接单和履约。资质材料上传、服务记录和签退动作已经收回当前页面，兼容页只保留旧链接兼容与分发概览。</p>
          </div>
          <div class="petpal-switch-links">
            <RouterLink :to="{ name: 'frontend-petpal' }">主人页</RouterLink>
            <RouterLink :to="{ name: 'frontend-petpal-legacy' }">兼容入口</RouterLink>
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
          <RouterLink class="frontend-page__button is-secondary petpal-side-actions__button" :to="{ name: 'frontend-petpal-messages' }">
            跨订单消息中心
          </RouterLink>
          <RouterLink class="frontend-page__button is-secondary petpal-side-actions__button" :to="{ name: 'frontend-petpal-reminders' }">
            统一提醒中心
          </RouterLink>
          <RouterLink class="frontend-page__button is-secondary petpal-side-actions__button" :to="{ name: 'frontend-petpal-legacy' }">
            打开旧链接兼容入口
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
          <el-form-item label="资质材料">
            <div class="petpal-qualification-panel">
              <div class="petpal-qualification-panel__actions">
                <input
                  ref="qualificationUploadInput"
                  type="file"
                  multiple
                  class="petpal-hidden-file-input"
                  accept="image/*,.pdf"
                  @change="onQualificationFilesChange"
                >
                <el-button
                  plain
                  :loading="qualificationUploading"
                  :disabled="caregiverProfileForm.qualificationMaterials.length >= 12"
                  @click="openQualificationFilePicker"
                >
                  上传资质材料
                </el-button>
                <span class="petpal-qualification-panel__hint">
                  已上传 {{ caregiverProfileForm.qualificationMaterials.length }}/12 份
                </span>
              </div>

              <el-progress
                v-if="qualificationUploadProgress !== null"
                :percentage="qualificationUploadProgress"
                :status="qualificationUploadProgress >= 100 ? 'success' : undefined"
              />

              <div v-if="caregiverProfileForm.qualificationMaterials.length" class="petpal-qualification-list">
                <div
                  v-for="item in caregiverProfileForm.qualificationMaterials"
                  :key="item.fileId"
                  class="petpal-qualification-item"
                >
                  <div class="petpal-qualification-item__copy">
                    <strong>{{ item.name }}</strong>
                    <span>{{ item.mimeType }} · {{ Math.round(item.size / 1024) }} KB</span>
                  </div>
                  <el-space>
                    <el-button link type="primary" size="small" @click="openExternalLink(item.url)">
                      预览
                    </el-button>
                    <el-button link type="danger" size="small" @click="removeQualificationMaterial(item.fileId)">
                      移除
                    </el-button>
                  </el-space>
                </div>
              </div>
            </div>
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

        <PetPalStatePanel
          v-if="caregiverServices.length === 0"
          eyebrow="服务设置"
          title="还没有可售照料服务"
          description="照料者档案保存后，建议至少创建一条可上架服务，主人侧才能更稳定地看到你的报价和能力。"
        >
          <template #actions>
            <el-button size="small" type="primary" :loading="caregiverServiceSaving" @click="createCaregiverService">新增首个服务</el-button>
            <RouterLink :to="{ name: 'frontend-petpal-reminders' }">
              <el-button size="small">看提醒中心</el-button>
            </RouterLink>
          </template>
        </PetPalStatePanel>
      </article>
        </section>

        <section class="frontend-card">
      <span class="frontend-card__eyebrow">履约工作台</span>
      <div class="petpal-section-heading">
        <div class="petpal-section-heading__meta">
          <h3>照料者订单与动作</h3>
          <p>在独立照料者页里统一处理接单、签到、服务记录和签退；兼容页只保留少量仍未迁出的混合操作。</p>
        </div>
        <el-space wrap>
          <el-select v-model="caregiverOrderQuery.status" style="width: 160px" @change="refreshCaregiverOrders">
            <el-option label="全部状态" value="" />
            <el-option label="待接单" value="PENDING_ACCEPT" />
            <el-option label="已接单" value="ACCEPTED" />
            <el-option label="服务中" value="SERVING" />
            <el-option label="已完成" value="COMPLETED" />
          </el-select>
          <el-button @click="refreshCaregiverOrders">刷新履约列表</el-button>
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

      <PetPalStatePanel
        v-if="!caregiverOrdersLoading && caregiverOrders.length === 0"
        eyebrow="履约工作台"
        title="当前筛选下没有照料者订单"
        description="可以先完成照料者档案和服务设置，等待主人下单后再回来处理接单、签到、服务记录和签退动作。"
      >
        <template #actions>
          <el-button size="small" type="primary" :loading="pageLoading" @click="reloadAll">刷新工作台</el-button>
          <RouterLink :to="{ name: 'frontend-petpal-messages' }">
            <el-button size="small">去消息中心</el-button>
          </RouterLink>
        </template>
      </PetPalStatePanel>
        </section>
      </template>
    </template>

    <section v-else class="frontend-card">
      <PetPalStatePanel
        eyebrow="开始使用"
        title="登录后进入照料者工作台"
        description="照料者工作台会集中展示入驻档案、服务设置、履约订单和跨订单沟通相关能力。未登录时不加载任何照料者业务数据。"
      >
        <template #actions>
          <RouterLink to="/login">
            <el-button size="small" type="primary">去登录</el-button>
          </RouterLink>
          <RouterLink :to="{ name: 'frontend-petpal' }">
            <el-button size="small">先看主人服务台</el-button>
          </RouterLink>
        </template>
      </PetPalStatePanel>
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
              当前账号暂未开通服务记录媒体上传能力，可先提交纯文字服务记录；如需补充图片或视频，请先完成照料者审核或联系管理员开通。
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
  CaregiverQualificationMaterialRecord,
  CaregiverOrderRecord,
  CaregiverProfileRecord,
  CaregiverServiceRecord,
  CreateServiceRequestPayload,
  OrderStatus,
  ServiceLogType,
} from '@rbac/api-common';
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { api } from '@/api/client';
import { useAuthStore } from '@/stores/auth';
import { uploadAttachmentFile } from '@/utils/direct-upload';
import { getErrorMessage } from '@/utils/errors';
import PetPalStatePanel from './PetPalStatePanel.vue';

defineOptions({
  name: 'PetPalCaregiverView',
});

type PageLoadState = 'idle' | 'ready' | 'error';

type CaregiverProfileFormState = {
  intro: string;
  experienceYears: number;
  serviceRadiusKm: number;
  serviceCity: string;
  specialtyTagsText: string;
  serviceCommitment: string;
  qualificationMaterials: CaregiverQualificationMaterialRecord[];
};

const auth = useAuthStore();

const caregiverProfile = ref<CaregiverProfileRecord | null>(null);
const caregiverServices = ref<CaregiverServiceRecord[]>([]);
const caregiverOrders = ref<CaregiverOrderRecord[]>([]);
const qualificationUploadInput = ref<HTMLInputElement | null>(null);

const pageLoadState = ref<PageLoadState>('idle');
const pageLoadErrorMessage = ref('');
const partialLoadNotice = ref('');
const pageReloading = ref(false);
const caregiverProfileSaving = ref(false);
const caregiverServiceSaving = ref(false);
const caregiverOrdersLoading = ref(false);
const caregiverActionLoadingKey = ref('');
const qualificationUploading = ref(false);
const qualificationUploadProgress = ref<number | null>(null);

const caregiverProfileForm = reactive<CaregiverProfileFormState>({
  intro: '',
  experienceYears: 0,
  serviceRadiusKm: 5,
  serviceCity: '',
  specialtyTagsText: '',
  serviceCommitment: '',
  qualificationMaterials: [],
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

const pageLoading = computed(() => (
  pageReloading.value
  || caregiverProfileSaving.value
  || caregiverServiceSaving.value
  || caregiverOrdersLoading.value
  || qualificationUploading.value
  || serviceLogSubmitting.value
));

const hasStatusCode = (error: unknown): error is { status: number } => (
  typeof error === 'object'
  && error !== null
  && typeof Reflect.get(error, 'status') === 'number'
);

const isMissingResourceError = (error: unknown) => hasStatusCode(error) && error.status === 404;

const unreadConversationCount = computed(() => caregiverOrders.value.reduce((total, item) => (
  total + getConversationUnreadCount(item.conversation, 'caregiver')
), 0));

const mergePageNotice = (items: string[]) => {
  const normalized = items
    .map(item => item.trim().replace(/[。.]$/, ''))
    .filter(Boolean);
  return normalized.length ? `${normalized.join('；')}。` : '';
};

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

const removeQualificationMaterial = (fileId: string) => {
  caregiverProfileForm.qualificationMaterials = caregiverProfileForm.qualificationMaterials
    .filter(item => item.fileId !== fileId);
};

const openQualificationFilePicker = () => {
  qualificationUploadInput.value?.click();
};

const openExternalLink = (url: string) => {
  window.open(url, '_blank', 'noopener');
};

const uploadQualificationFiles = async (files: File[]) => {
  if (!caregiverProfile.value) {
    ElMessage.warning('请先加载照料者档案');
    return;
  }

  if (!files.length) {
    return;
  }

  qualificationUploading.value = true;
  qualificationUploadProgress.value = 0;

  const uploaded: CaregiverQualificationMaterialRecord[] = [];
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  let completedSize = 0;

  try {
    for (const file of files) {
      const result = await uploadAttachmentFile(
        file,
        {
          tag1: 'petpal-caregiver-qualification',
          tag2: caregiverProfile.value.id,
        },
        (percent) => {
          const currentBytes = Math.round((file.size * percent) / 100);
          qualificationUploadProgress.value = Math.min(
            99,
            Math.round(((completedSize + currentBytes) / Math.max(totalSize, 1)) * 100),
          );
        },
      );

      uploaded.push({
        fileId: result.fileId,
        url: result.url,
        name: file.name,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
        uploadedAt: new Date().toISOString(),
      });
      completedSize += file.size;
      qualificationUploadProgress.value = Math.min(
        99,
        Math.round((completedSize / Math.max(totalSize, 1)) * 100),
      );
    }

    caregiverProfileForm.qualificationMaterials = [
      ...caregiverProfileForm.qualificationMaterials,
      ...uploaded,
    ].slice(0, 12);
    qualificationUploadProgress.value = 100;
    ElMessage.success(`已上传 ${uploaded.length} 份资质材料`);
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '上传资质材料失败'));
  } finally {
    qualificationUploading.value = false;
    setTimeout(() => {
      qualificationUploadProgress.value = null;
    }, 600);
  }
};

const onQualificationFilesChange = async (event: Event) => {
  const input = event.target as HTMLInputElement;
  const files = Array.from(input.files ?? []);
  input.value = '';
  await uploadQualificationFiles(files);
};

const loadCaregiverProfile = async ({ showFeedback = true }: { showFeedback?: boolean } = {}) => {
  try {
    const profile = await api.petpal.caregiver.profile();
    caregiverProfile.value = profile;
    caregiverProfileForm.intro = profile.intro || '';
    caregiverProfileForm.experienceYears = profile.experienceYears;
    caregiverProfileForm.serviceRadiusKm = profile.serviceRadiusKm;
    caregiverProfileForm.serviceCity = profile.serviceCity || '';
    caregiverProfileForm.specialtyTagsText = joinTagText(profile.specialtyTags);
    caregiverProfileForm.serviceCommitment = profile.serviceCommitment || '';
    caregiverProfileForm.qualificationMaterials = [...profile.qualificationMaterials];
    return null;
  } catch (error: unknown) {
    caregiverProfile.value = null;
    caregiverProfileForm.intro = '';
    caregiverProfileForm.experienceYears = 0;
    caregiverProfileForm.serviceRadiusKm = 5;
    caregiverProfileForm.serviceCity = '';
    caregiverProfileForm.specialtyTagsText = '';
    caregiverProfileForm.serviceCommitment = '';
    caregiverProfileForm.qualificationMaterials = [];
    if (isMissingResourceError(error)) {
      return null;
    }
    const message = getErrorMessage(error, '加载照料者档案失败');
    if (showFeedback) {
      ElMessage.error(message);
    }
    return message;
  }
};

const loadCaregiverServices = async ({ showFeedback = true }: { showFeedback?: boolean } = {}) => {
  try {
    caregiverServices.value = await api.petpal.caregiver.services();
    return null;
  } catch (error: unknown) {
    caregiverServices.value = [];
    if (isMissingResourceError(error)) {
      return null;
    }
    const message = getErrorMessage(error, '加载照料服务失败');
    if (showFeedback) {
      ElMessage.error(message);
    }
    return message;
  }
};

const loadCaregiverOrders = async ({ showFeedback = true }: { showFeedback?: boolean } = {}) => {
  try {
    caregiverOrdersLoading.value = true;
    const response = await api.petpal.caregiver.orders({
      page: caregiverOrderQuery.page,
      pageSize: caregiverOrderQuery.pageSize,
      status: caregiverOrderQuery.status || undefined,
    });
    caregiverOrders.value = response.items;
    return null;
  } catch (error: unknown) {
    caregiverOrders.value = [];
    if (isMissingResourceError(error)) {
      return null;
    }
    const message = getErrorMessage(error, '加载履约订单失败');
    if (showFeedback) {
      ElMessage.error(message);
    }
    return message;
  } finally {
    caregiverOrdersLoading.value = false;
  }
};

const refreshCaregiverOrders = () => {
  void loadCaregiverOrders();
};

const reloadAll = async () => {
  if (!auth.isAuthenticated) {
    ElMessage.info('登录后可加载照料者业务数据');
    return;
  }

  pageLoadState.value = 'idle';
  pageLoadErrorMessage.value = '';
  partialLoadNotice.value = '';
  pageReloading.value = true;

  try {
    const notices = (await Promise.all([
      loadCaregiverProfile({ showFeedback: false }),
      loadCaregiverServices({ showFeedback: false }),
      loadCaregiverOrders({ showFeedback: false }),
    ])).filter((item): item is string => Boolean(item));

    if (notices.length === 3) {
      pageLoadState.value = 'error';
      pageLoadErrorMessage.value = mergePageNotice(notices) || '照料者工作台暂时不可用，请稍后重试。';
      return;
    }

    pageLoadState.value = 'ready';
    partialLoadNotice.value = mergePageNotice(notices);
  } finally {
    pageReloading.value = false;
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
    ElMessage.warning('当前账号暂未开通媒体上传能力，请移除图片或视频后再提交');
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
    await loadCaregiverOrders();
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
      qualificationMaterials: caregiverProfileForm.qualificationMaterials,
    });
    caregiverProfile.value = profile;
    caregiverProfileForm.specialtyTagsText = joinTagText(profile.specialtyTags);
    caregiverProfileForm.serviceCommitment = profile.serviceCommitment || '';
    caregiverProfileForm.qualificationMaterials = [...profile.qualificationMaterials];
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

.petpal-hidden-file-input {
  display: none;
}

.petpal-qualification-panel {
  display: grid;
  gap: 12px;
  width: 100%;
}

.petpal-qualification-panel__actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.petpal-qualification-panel__hint {
  color: #6b7280;
  font-size: 12px;
}

.petpal-qualification-list {
  display: grid;
  gap: 10px;
}

.petpal-qualification-item {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid #e5ebf3;
  border-radius: 12px;
  background: #fff;
}

.petpal-qualification-item__copy {
  display: grid;
  gap: 4px;
}

.petpal-qualification-item__copy strong,
.petpal-qualification-item__copy span {
  word-break: break-all;
}

.petpal-qualification-item__copy span {
  color: #6b7280;
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

  .petpal-service-log-dialog__file-item,
  .petpal-qualification-item {
    flex-direction: column;
  }
}
</style>
