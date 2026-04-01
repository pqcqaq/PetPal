<template>
  <div class="frontend-page">
    <section class="frontend-page__hero">
      <p class="frontend-page__eyebrow">PetPal Owner</p>
      <h1>宠托帮主人服务台</h1>
      <p>把宠物建档、需求发布、照料者匹配和订单跟进收回到主人语义，不再把照料者工作流混在同一页里。</p>
      <div class="frontend-page__hero-actions">
        <el-button type="primary" :loading="pageLoading" @click="reloadAll">刷新主人数据</el-button>
        <RouterLink class="frontend-page__button is-secondary" :to="{ name: 'frontend-petpal-aftersales' }">
          打开售后中心
        </RouterLink>
        <RouterLink class="frontend-page__button is-secondary" :to="{ name: 'frontend-petpal-reminders' }">
          打开提醒中心
        </RouterLink>
        <RouterLink class="frontend-page__button is-secondary" :to="{ name: 'frontend-petpal-messages' }">
          打开消息中心
        </RouterLink>
        <RouterLink class="frontend-page__button is-secondary" :to="{ name: 'frontend-petpal-caregiver' }">
          进入照料者工作台
        </RouterLink>
        <RouterLink class="frontend-page__button is-secondary" :to="{ name: 'frontend-petpal-legacy' }">
          打开兼容入口
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
            <RouterLink :to="{ name: 'frontend-petpal-legacy' }">兼容入口</RouterLink>
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
          <RouterLink class="frontend-page__button is-secondary petpal-side-actions__button" :to="{ name: 'frontend-petpal-messages' }">
            跨订单消息中心
          </RouterLink>
          <RouterLink class="frontend-page__button is-secondary petpal-side-actions__button" :to="{ name: 'frontend-petpal-reminders' }">
            统一提醒中心
          </RouterLink>
          <RouterLink class="frontend-page__button is-secondary petpal-side-actions__button" :to="{ name: 'frontend-petpal-aftersales' }">
            退款 / 投诉 / 售后中心
          </RouterLink>
          <RouterLink class="frontend-page__button is-secondary petpal-side-actions__button" :to="{ name: 'frontend-petpal-legacy' }">
            旧链接兼容入口
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
            <p>主人页已经直接承接订单导出、退款导出和确认完成动作；`legacy` 只保留旧书签兼容与任务分发。</p>
            <p v-if="auth.isAuthenticated" class="petpal-section-heading__hint">
              退款导出默认覆盖最近一年，可按退款日期、退款状态、投诉状态、投诉类型与投诉对象等收窄范围。
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
                v-model="ownerRefundExportComplaintStatus"
                clearable
                placeholder="投诉状态"
                size="small"
                style="width: 140px"
              >
                <el-option
                  v-for="option in complaintStatusOptions"
                  :key="option.value"
                  :label="option.label"
                  :value="option.value"
                />
              </el-select>
              <el-select
                v-model="ownerRefundExportComplaintType"
                clearable
                placeholder="投诉类型"
                size="small"
                style="width: 140px"
              >
                <el-option
                  v-for="option in complaintTypeOptions"
                  :key="option.value"
                  :label="option.label"
                  :value="option.value"
                />
              </el-select>
              <el-select
                v-model="ownerRefundExportComplaintTargetRole"
                clearable
                placeholder="投诉对象"
                size="small"
                style="width: 140px"
              >
                <el-option
                  v-for="option in complaintTargetRoleOptions"
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
              <el-select
                v-model="selectedOwnerRefundExportTemplateId"
                clearable
                placeholder="常用筛选模板"
                size="small"
                style="width: 180px"
              >
                <el-option
                  v-for="template in ownerRefundExportTemplates"
                  :key="template.id"
                  :label="template.name"
                  :value="template.id"
                />
              </el-select>
              <el-button
                plain
                size="small"
                :disabled="!selectedOwnerRefundExportTemplateId"
                @click="applySelectedOwnerRefundExportTemplate"
              >
                应用模板
              </el-button>
              <el-button
                plain
                size="small"
                @click="saveCurrentOwnerRefundExportTemplate"
              >
                保存为模板
              </el-button>
              <el-button
                plain
                size="small"
                :disabled="!selectedOwnerRefundExportTemplateId"
                @click="deleteSelectedOwnerRefundExportTemplate"
              >
                删除模板
              </el-button>
              <el-button
                plain
                size="small"
                :disabled="!hasStoredOwnerRefundExportFilters"
                @click="restoreStoredOwnerRefundExportFilters"
              >
                恢复上次筛选
              </el-button>
              <el-button
                plain
                size="small"
                @click="clearOwnerRefundExportFilters"
              >
                清空筛选
              </el-button>
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
              <RouterLink class="frontend-page__button is-secondary" :to="{ name: 'frontend-petpal-legacy' }">
                兼容混合视图
              </RouterLink>
            </el-space>
          </div>
          <RouterLink v-else class="frontend-page__button is-secondary" :to="{ name: 'frontend-petpal-legacy' }">
            兼容混合视图
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
              <el-table-column prop="amountTotal" label="总额" min-width="100" />
              <el-table-column prop="amountPaid" label="已付" min-width="100" />
              <el-table-column prop="amountRefunded" label="已退" min-width="100" />
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
              <el-table-column label="操作" min-width="190" fixed="right">
                <template #default="scope">
                  <el-space>
                    <RouterLink :to="{ name: 'frontend-petpal-order-detail', params: { id: scope.row.id } }">
                      <el-button link type="primary" size="small">详情</el-button>
                    </RouterLink>
                    <el-button
                      v-if="scope.row.orderStatus === 'SERVING'"
                      link
                      type="success"
                      size="small"
                      :loading="ownerActionLoadingKey === `confirm:${scope.row.id}`"
                      @click="confirmOrderComplete(scope.row.id)"
                    >
                      确认完成
                    </el-button>
                  </el-space>
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
  ComplaintTargetRole,
  ComplaintStatus,
  ComplaintType,
  CreatePetPayload,
  CreateServiceRequestPayload,
  MatchCaregiverQuery,
  MatchedCaregiverRecord,
  OrderRecord,
  OwnerRefundExportQuery,
  OrderStatus,
  PetGender,
  PetProfileRecord,
  PetServiceType,
  PetSpecies,
  RefundStatus,
  RefundType,
  ServiceRequestRecord,
} from '@rbac/api-common';
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { api } from '@/api/client';
import ListExportButton from '@/components/download/ListExportButton.vue';
import { useAuthStore } from '@/stores/auth';
import { useWorkbenchStore } from '@/stores/workbench';
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
const workbench = useWorkbenchStore();

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
const ownerActionLoadingKey = ref('');

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

const complaintStatusOptions: Array<{ label: string; value: ComplaintStatus }> = [
  { label: '待处理', value: 'OPEN' },
  { label: '处理中', value: 'PROCESSING' },
  { label: '已解决', value: 'RESOLVED' },
  { label: '已驳回', value: 'REJECTED' },
];

const complaintTypeOptions: Array<{ label: string; value: ComplaintType }> = [
  { label: '安全问题', value: 'SAFETY' },
  { label: '费用争议', value: 'FEE' },
  { label: '服务质量', value: 'SERVICE' },
  { label: '欺诈风险', value: 'FRAUD' },
  { label: '其他问题', value: 'OTHER' },
];

const complaintTargetRoleOptions: Array<{ label: string; value: ComplaintTargetRole }> = [
  { label: '照料者', value: 'CAREGIVER' },
  { label: '平台', value: 'PLATFORM' },
];

const refundExportServiceTypeOptions: Array<{ label: string; value: PetServiceType }> = [
  { label: '寄养', value: 'BOARDING' },
  { label: '遛宠', value: 'WALKING' },
  { label: '喂养', value: 'FEEDING' },
  { label: '上门陪伴', value: 'DOOR_VISIT' },
];

const OWNER_REFUND_EXPORT_FILTER_PAGE_STATE_KEY = 'page:petpal:owner-refund-export-filters';
const OWNER_REFUND_EXPORT_FILTER_STORAGE_KEY = 'petpal-owner-refund-export-filters-v2';
const OWNER_REFUND_EXPORT_FILTER_LEGACY_STORAGE_KEY = 'petpal-owner-refund-export-filters-v1';
const OWNER_REFUND_EXPORT_TEMPLATE_LIMIT = 5;

type OwnerRefundExportFilterSnapshot = {
  ownerUserId: string;
  dateRange: [string, string] | null;
  refundType: RefundType | '';
  refundStatus: RefundStatus | '';
  complaintStatus: ComplaintStatus | '';
  complaintType: ComplaintType | '';
  complaintTargetRole: ComplaintTargetRole | '';
  serviceType: PetServiceType | '';
  orderNoKeyword: string;
};

type OwnerRefundExportFilterTemplate = {
  id: string;
  name: string;
  snapshot: OwnerRefundExportFilterSnapshot;
  updatedAt: string;
};

type OwnerRefundExportFilterStorageEntry = {
  lastUsed: OwnerRefundExportFilterSnapshot | null;
  templates: OwnerRefundExportFilterTemplate[];
};

type OwnerRefundExportFilterStorage = {
  version: 2;
  users: Record<string, OwnerRefundExportFilterStorageEntry>;
};

const ownerRefundExportDateRange = ref<[Date, Date] | null>(null);
const ownerRefundExportType = ref<RefundType | ''>('');
const ownerRefundExportStatus = ref<RefundStatus | ''>('');
const ownerRefundExportComplaintStatus = ref<ComplaintStatus | ''>('');
const ownerRefundExportComplaintType = ref<ComplaintType | ''>('');
const ownerRefundExportComplaintTargetRole = ref<ComplaintTargetRole | ''>('');
const ownerRefundExportServiceType = ref<PetServiceType | ''>('');
const ownerRefundExportOrderNoKeyword = ref('');
const hasStoredOwnerRefundExportFilters = ref(false);
const ownerRefundExportTemplates = ref<OwnerRefundExportFilterTemplate[]>([]);
const selectedOwnerRefundExportTemplateId = ref('');

const pageLoading = computed(() => (
  petsLoading.value
  || requestsLoading.value
  || ordersLoading.value
  || matchLoading.value
  || petSaving.value
  || requestSaving.value
  || Boolean(ownerActionLoadingKey.value)
));

const unreadOwnerConversationCount = computed(() => orders.value.reduce((total, item) => (
  total + getConversationUnreadCount(item.conversation, 'owner')
), 0));

const formatTime = (value: string) => new Date(value).toLocaleString();

const toDayBoundaryIsoString = (value: Date, boundary: 'start' | 'end') => {
  const next = new Date(value);
  if (boundary === 'start') {
    next.setHours(0, 0, 0, 0);
  } else {
    next.setHours(23, 59, 59, 999);
  }
  return next.toISOString();
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

const resetOwnerRefundExportFilters = () => {
  ownerRefundExportDateRange.value = null;
  ownerRefundExportType.value = '';
  ownerRefundExportStatus.value = '';
  ownerRefundExportComplaintStatus.value = '';
  ownerRefundExportComplaintType.value = '';
  ownerRefundExportComplaintTargetRole.value = '';
  ownerRefundExportServiceType.value = '';
  ownerRefundExportOrderNoKeyword.value = '';
};

const createEmptyOwnerRefundExportFilterStorageEntry = (): OwnerRefundExportFilterStorageEntry => ({
  lastUsed: null,
  templates: [],
});

const createEmptyOwnerRefundExportFilterStorage = (): OwnerRefundExportFilterStorage => ({
  version: 2,
  users: {},
});

const normalizeOwnerRefundExportDateRange = (value: unknown): [string, string] | null => {
  if (!Array.isArray(value) || value.length !== 2) {
    return null;
  }

  const [start, end] = value;
  return typeof start === 'string' && typeof end === 'string' ? [start, end] : null;
};

const normalizeOwnerRefundExportFilterSnapshot = (
  value: Partial<OwnerRefundExportFilterSnapshot>,
): OwnerRefundExportFilterSnapshot | null => {
  if (typeof value.ownerUserId !== 'string' || value.ownerUserId.length === 0) {
    return null;
  }

  return {
    ownerUserId: value.ownerUserId,
    dateRange: normalizeOwnerRefundExportDateRange(value.dateRange),
    refundType: value.refundType === 'FULL' || value.refundType === 'PARTIAL' ? value.refundType : '',
    refundStatus: value.refundStatus === 'PENDING'
      || value.refundStatus === 'APPROVED'
      || value.refundStatus === 'REJECTED'
      || value.refundStatus === 'SUCCESS'
      || value.refundStatus === 'FAILED'
      ? value.refundStatus
      : '',
    complaintStatus: value.complaintStatus === 'OPEN'
      || value.complaintStatus === 'PROCESSING'
      || value.complaintStatus === 'RESOLVED'
      || value.complaintStatus === 'REJECTED'
      ? value.complaintStatus
      : '',
    complaintType: value.complaintType === 'SAFETY'
      || value.complaintType === 'FEE'
      || value.complaintType === 'SERVICE'
      || value.complaintType === 'FRAUD'
      || value.complaintType === 'OTHER'
      ? value.complaintType
      : '',
    complaintTargetRole: value.complaintTargetRole === 'CAREGIVER' || value.complaintTargetRole === 'PLATFORM'
      ? value.complaintTargetRole
      : '',
    serviceType: value.serviceType === 'BOARDING'
      || value.serviceType === 'WALKING'
      || value.serviceType === 'FEEDING'
      || value.serviceType === 'DOOR_VISIT'
      ? value.serviceType
      : '',
    orderNoKeyword: typeof value.orderNoKeyword === 'string' ? value.orderNoKeyword.trim() : '',
  };
};

const normalizeOwnerRefundExportFilterTemplate = (
  value: Partial<OwnerRefundExportFilterTemplate>,
): OwnerRefundExportFilterTemplate | null => {
  const snapshot = normalizeOwnerRefundExportFilterSnapshot(value.snapshot ?? {});
  const name = typeof value.name === 'string' ? value.name.trim() : '';
  if (!snapshot || typeof value.id !== 'string' || value.id.length === 0 || name.length === 0) {
    return null;
  }

  return {
    id: value.id,
    name: name.slice(0, 20),
    snapshot,
    updatedAt: typeof value.updatedAt === 'string' && value.updatedAt.length > 0
      ? value.updatedAt
      : new Date().toISOString(),
  };
};

const normalizeOwnerRefundExportFilterStorage = (value: unknown): OwnerRefundExportFilterStorage => {
  if (!value || typeof value !== 'object' || !('users' in value) || typeof value.users !== 'object' || !value.users) {
    return createEmptyOwnerRefundExportFilterStorage();
  }

  const parsedUsers = value.users as Record<string, Partial<OwnerRefundExportFilterStorageEntry>>;
  const users = Object.fromEntries(
    Object.entries(parsedUsers).map(([ownerUserId, entry]) => {
      const lastUsed = normalizeOwnerRefundExportFilterSnapshot(entry.lastUsed ?? {});
      const templates = Array.isArray(entry.templates)
        ? entry.templates
          .map(item => normalizeOwnerRefundExportFilterTemplate(item as Partial<OwnerRefundExportFilterTemplate>))
          .filter((item): item is OwnerRefundExportFilterTemplate => Boolean(item))
        : [];

      return [
        ownerUserId,
        {
          lastUsed,
          templates,
        } satisfies OwnerRefundExportFilterStorageEntry,
      ];
    }),
  );

  return {
    version: 2,
    users,
  };
};

const buildOwnerRefundExportFilterSnapshot = (): OwnerRefundExportFilterSnapshot | null => {
  const ownerUserId = auth.user?.id;
  if (!ownerUserId) {
    return null;
  }

  return {
    ownerUserId,
    dateRange: ownerRefundExportDateRange.value
      ? [
          ownerRefundExportDateRange.value[0].toISOString(),
          ownerRefundExportDateRange.value[1].toISOString(),
        ]
      : null,
    refundType: ownerRefundExportType.value,
    refundStatus: ownerRefundExportStatus.value,
    complaintStatus: ownerRefundExportComplaintStatus.value,
    complaintType: ownerRefundExportComplaintType.value,
    complaintTargetRole: ownerRefundExportComplaintTargetRole.value,
    serviceType: ownerRefundExportServiceType.value,
    orderNoKeyword: ownerRefundExportOrderNoKeyword.value.trim(),
  };
};

const clearLegacyOwnerRefundExportFilterStorage = () => {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(OWNER_REFUND_EXPORT_FILTER_STORAGE_KEY);
  window.localStorage.removeItem(OWNER_REFUND_EXPORT_FILTER_LEGACY_STORAGE_KEY);
};

const readStoredOwnerRefundExportFilterStorage = (): OwnerRefundExportFilterStorage => {
  const storedPageState = workbench.getPageState<OwnerRefundExportFilterStorage>(OWNER_REFUND_EXPORT_FILTER_PAGE_STATE_KEY);
  if (storedPageState) {
    return normalizeOwnerRefundExportFilterStorage(storedPageState);
  }

  if (typeof window === 'undefined') {
    return createEmptyOwnerRefundExportFilterStorage();
  }

  try {
    const raw = window.localStorage.getItem(OWNER_REFUND_EXPORT_FILTER_STORAGE_KEY);
    if (raw) {
      const storage = normalizeOwnerRefundExportFilterStorage(JSON.parse(raw));
      workbench.setPageState(OWNER_REFUND_EXPORT_FILTER_PAGE_STATE_KEY, storage);
      clearLegacyOwnerRefundExportFilterStorage();
      return storage;
    }

    const legacyRaw = window.localStorage.getItem(OWNER_REFUND_EXPORT_FILTER_LEGACY_STORAGE_KEY);
    if (!legacyRaw) {
      return createEmptyOwnerRefundExportFilterStorage();
    }

    const legacySnapshot = normalizeOwnerRefundExportFilterSnapshot(
      JSON.parse(legacyRaw) as Partial<OwnerRefundExportFilterSnapshot>,
    );
    if (!legacySnapshot) {
      return createEmptyOwnerRefundExportFilterStorage();
    }

    const storage: OwnerRefundExportFilterStorage = {
      version: 2,
      users: {
        [legacySnapshot.ownerUserId]: {
          lastUsed: legacySnapshot,
          templates: [],
        },
      },
    };
    workbench.setPageState(OWNER_REFUND_EXPORT_FILTER_PAGE_STATE_KEY, storage);
    clearLegacyOwnerRefundExportFilterStorage();
    return storage;
  } catch {
    return createEmptyOwnerRefundExportFilterStorage();
  }
};

const writeStoredOwnerRefundExportFilterStorage = (storage: OwnerRefundExportFilterStorage) => {
  workbench.setPageState(OWNER_REFUND_EXPORT_FILTER_PAGE_STATE_KEY, storage);
  clearLegacyOwnerRefundExportFilterStorage();
};

const applyOwnerRefundExportFilterSnapshot = (snapshot: OwnerRefundExportFilterSnapshot) => {
  ownerRefundExportDateRange.value = snapshot.dateRange
    ? [new Date(snapshot.dateRange[0]), new Date(snapshot.dateRange[1])]
    : null;
  ownerRefundExportType.value = snapshot.refundType;
  ownerRefundExportStatus.value = snapshot.refundStatus;
  ownerRefundExportComplaintStatus.value = snapshot.complaintStatus;
  ownerRefundExportComplaintType.value = snapshot.complaintType;
  ownerRefundExportComplaintTargetRole.value = snapshot.complaintTargetRole;
  ownerRefundExportServiceType.value = snapshot.serviceType;
  ownerRefundExportOrderNoKeyword.value = snapshot.orderNoKeyword;
};

const syncOwnerRefundExportFilterState = () => {
  const ownerUserId = auth.user?.id;
  if (!ownerUserId) {
    hasStoredOwnerRefundExportFilters.value = false;
    ownerRefundExportTemplates.value = [];
    selectedOwnerRefundExportTemplateId.value = '';
    return createEmptyOwnerRefundExportFilterStorageEntry();
  }

  const storage = readStoredOwnerRefundExportFilterStorage();
  const entry = storage.users[ownerUserId] ?? createEmptyOwnerRefundExportFilterStorageEntry();
  hasStoredOwnerRefundExportFilters.value = Boolean(entry.lastUsed);
  ownerRefundExportTemplates.value = [...entry.templates].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  if (!ownerRefundExportTemplates.value.some(item => item.id === selectedOwnerRefundExportTemplateId.value)) {
    selectedOwnerRefundExportTemplateId.value = '';
  }
  return entry;
};

const updateCurrentOwnerRefundExportFilterStorage = (
  updater: (entry: OwnerRefundExportFilterStorageEntry) => OwnerRefundExportFilterStorageEntry,
) => {
  const ownerUserId = auth.user?.id;
  if (!ownerUserId) {
    return null;
  }

  const storage = readStoredOwnerRefundExportFilterStorage();
  const currentEntry = storage.users[ownerUserId] ?? createEmptyOwnerRefundExportFilterStorageEntry();
  const nextEntry = updater({
    lastUsed: currentEntry.lastUsed,
    templates: [...currentEntry.templates],
  });
  storage.users[ownerUserId] = nextEntry;
  writeStoredOwnerRefundExportFilterStorage(storage);
  syncOwnerRefundExportFilterState();
  return nextEntry;
};

const persistOwnerRefundExportFilters = () => {
  const snapshot = buildOwnerRefundExportFilterSnapshot();
  if (!snapshot) {
    return;
  }

  updateCurrentOwnerRefundExportFilterStorage(entry => ({
    ...entry,
    lastUsed: snapshot,
  }));
};

const restoreStoredOwnerRefundExportFilters = () => {
  const entry = syncOwnerRefundExportFilterState();
  if (!entry.lastUsed) {
    ElMessage.info('暂无可恢复的上次退款导出筛选');
    return;
  }

  applyOwnerRefundExportFilterSnapshot(entry.lastUsed);
  ElMessage.success('已恢复上次退款导出筛选');
};

const clearOwnerRefundExportFilters = () => {
  resetOwnerRefundExportFilters();
  updateCurrentOwnerRefundExportFilterStorage(entry => ({
    ...entry,
    lastUsed: null,
  }));
  ElMessage.success('已清空退款导出筛选');
};

const findSelectedOwnerRefundExportTemplate = () => ownerRefundExportTemplates.value
  .find(item => item.id === selectedOwnerRefundExportTemplateId.value) ?? null;

const applySelectedOwnerRefundExportTemplate = () => {
  const template = findSelectedOwnerRefundExportTemplate();
  if (!template) {
    ElMessage.info('请先选择要应用的常用模板');
    return;
  }

  applyOwnerRefundExportFilterSnapshot(template.snapshot);
  ElMessage.success(`已应用模板：${template.name}`);
};

const saveCurrentOwnerRefundExportTemplate = async () => {
  const snapshot = buildOwnerRefundExportFilterSnapshot();
  if (!snapshot) {
    ElMessage.info('登录后才可保存常用筛选模板');
    return;
  }

  try {
    const { value } = await ElMessageBox.prompt(
      '输入模板名称，便于后续快速复用当前退款导出筛选',
      '保存常用筛选模板',
      {
        inputPlaceholder: '例如：平台责任退款',
        inputValidator: (inputValue) => {
          const name = inputValue.trim();
          if (!name) {
            return '模板名称不能为空';
          }
          if (name.length > 20) {
            return '模板名称最多 20 个字符';
          }
          return true;
        },
      },
    );

    const templateName = value.trim();
    const existingTemplate = ownerRefundExportTemplates.value.find(item => item.name === templateName) ?? null;
    if (!existingTemplate && ownerRefundExportTemplates.value.length >= OWNER_REFUND_EXPORT_TEMPLATE_LIMIT) {
      ElMessage.warning(`最多保存 ${OWNER_REFUND_EXPORT_TEMPLATE_LIMIT} 个常用模板，请先删除旧模板`);
      return;
    }

    const nextTemplate: OwnerRefundExportFilterTemplate = {
      id: existingTemplate?.id ?? `refund-template-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      name: templateName,
      snapshot,
      updatedAt: new Date().toISOString(),
    };

    updateCurrentOwnerRefundExportFilterStorage(entry => ({
      ...entry,
      templates: existingTemplate
        ? entry.templates.map(item => (item.id === existingTemplate.id ? nextTemplate : item))
        : [nextTemplate, ...entry.templates],
    }));
    selectedOwnerRefundExportTemplateId.value = nextTemplate.id;
    ElMessage.success(existingTemplate ? `已更新模板：${templateName}` : `已保存模板：${templateName}`);
  } catch (error: unknown) {
    if (error === 'cancel' || error === 'close') {
      return;
    }
    throw error;
  }
};

const deleteSelectedOwnerRefundExportTemplate = async () => {
  const template = findSelectedOwnerRefundExportTemplate();
  if (!template) {
    ElMessage.info('请先选择要删除的常用模板');
    return;
  }

  try {
    await ElMessageBox.confirm(`确认删除模板“${template.name}”吗？`, '删除常用筛选模板', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    });
    updateCurrentOwnerRefundExportFilterStorage(entry => ({
      ...entry,
      templates: entry.templates.filter(item => item.id !== template.id),
    }));
    selectedOwnerRefundExportTemplateId.value = '';
    ElMessage.success(`已删除模板：${template.name}`);
  } catch (error: unknown) {
    if (error === 'cancel' || error === 'close') {
      return;
    }
    throw error;
  }
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
  complaintStatus: ownerRefundExportComplaintStatus.value || undefined,
  complaintType: ownerRefundExportComplaintType.value || undefined,
  complaintTargetRole: ownerRefundExportComplaintTargetRole.value || undefined,
  serviceType: ownerRefundExportServiceType.value || undefined,
  orderNoKeyword: ownerRefundExportOrderNoKeyword.value.trim() || undefined,
});

const buildOwnerRefundExportRequest = () => {
  persistOwnerRefundExportFilters();
  return api.petpal.orders.exportRefundDetails(buildOwnerRefundExportQuery());
};

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

const withOwnerOrderAction = async (
  key: string,
  successMessage: string,
  action: () => Promise<void>,
) => {
  try {
    ownerActionLoadingKey.value = key;
    await action();
    ElMessage.success(successMessage);
    await loadOrders();
  } catch (error: unknown) {
    if (error === 'cancel' || error === 'close') {
      return;
    }
    ElMessage.error(getErrorMessage(error, '订单动作执行失败'));
  } finally {
    ownerActionLoadingKey.value = '';
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

const confirmOrderComplete = async (orderId: string) => withOwnerOrderAction(
  `confirm:${orderId}`,
  '订单已确认完成',
  async () => {
    await api.petpal.orders.confirmComplete(orderId);
  },
);

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

watch(() => auth.user?.id, (ownerUserId) => {
  const entry = syncOwnerRefundExportFilterState();
  if (ownerUserId && entry.lastUsed) {
    applyOwnerRefundExportFilterSnapshot(entry.lastUsed);
    return;
  }

  resetOwnerRefundExportFilters();
});

onMounted(() => {
  const entry = syncOwnerRefundExportFilterState();
  if (entry.lastUsed && entry.lastUsed.ownerUserId === auth.user?.id) {
    applyOwnerRefundExportFilterSnapshot(entry.lastUsed);
  }

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

.petpal-section-heading__hint {
  margin: 0;
  color: #6b7280;
  font-size: 12px;
  line-height: 1.5;
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

.petpal-export-toolbar {
  display: grid;
  gap: 10px;
  justify-items: end;
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

  .petpal-export-toolbar {
    width: 100%;
    justify-items: start;
  }

  .petpal-summary-grid {
    grid-template-columns: 1fr;
  }
}
</style>
