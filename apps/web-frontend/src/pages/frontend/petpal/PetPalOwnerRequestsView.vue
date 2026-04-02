<template>
  <PetPalDeskPage
    eyebrow="需求队列"
    title="查看匹配中的需求，并在这里完成下单"
    summary="创建需求和支付已经分走，队列页只保留需求状态、匹配结果和建单动作。"
    :nav-items="petPalOwnerWorkspaceNav"
    active-name="frontend-petpal-requests"
    :primary-action="{ label: '新建需求', to: { name: 'frontend-petpal-request-create' }, tone: 'primary' }"
    :actions="[{ label: '返回主人总览', to: { name: 'frontend-petpal' }, tone: 'secondary' }]"
    :stats="heroStats"
  >
    <div class="petpal-split-grid">
      <PetPalDeskSection class="petpal-span-5" eyebrow="Requests" title="需求清单" description="先选中一条需求，再看右侧匹配结果。">
        <PetPalDeskEmpty
          v-if="!requests.length"
          title="当前没有需求"
          description="先创建一条新需求，再回到这里查看匹配结果和下单入口。"
        >
          <template #actions>
            <RouterLink class="frontend-page__button is-primary" :to="{ name: 'frontend-petpal-request-create' }">去新建需求</RouterLink>
          </template>
        </PetPalDeskEmpty>

        <div v-else class="petpal-sheet-list">
          <button
            v-for="request in requests"
            :key="request.id"
            type="button"
            class="petpal-request-row"
            :class="{ 'is-active': request.id === selectedRequestId }"
            @click="selectRequest(request.id)"
          >
            <div class="petpal-sheet-row__copy">
              <h3 class="petpal-sheet-row__title">{{ getPetPalServiceTypeLabel(request.serviceType) }}</h3>
              <p class="petpal-sheet-row__desc">{{ getPetPalServiceRequestStatusLabel(request.status) }} · {{ request.pet?.name || '宠物待同步' }}</p>
              <p class="petpal-sheet-row__desc">{{ formatPetPalRange(request.startTime, request.endTime) }} · {{ request.locationText }}</p>
            </div>
            <div class="petpal-sheet-row__tail">
              <span class="petpal-pill" :class="request.matchedCaregiverId ? 'is-success' : 'is-warning'">
                {{ request.matchedCaregiverId ? '已匹配' : '待匹配' }}
              </span>
            </div>
          </button>
        </div>
      </PetPalDeskSection>

      <PetPalDeskSection class="petpal-span-7" eyebrow="Matches" title="匹配结果与下单" description="右侧只负责查看这条需求的匹配照料者，并创建订单。">
        <PetPalDeskEmpty
          v-if="!selectedRequest"
          title="先选择左侧需求"
          description="选中需求后，这里会展示匹配照料者和建单入口。"
        />

        <template v-else>
          <div class="petpal-summary-strip">
            <div>
              <span>宠物</span>
              <strong>{{ selectedRequest.pet?.name || '待同步' }}</strong>
            </div>
            <div>
              <span>服务窗口</span>
              <strong>{{ formatPetPalRange(selectedRequest.startTime, selectedRequest.endTime) }}</strong>
            </div>
            <div>
              <span>预算</span>
              <strong>{{ selectedRequest.budgetAmount ? formatPetPalMoney(selectedRequest.budgetAmount) : '未设置' }}</strong>
            </div>
          </div>

          <div class="petpal-actions">
            <el-button :loading="matching" @click="loadMatches(selectedRequest)">刷新匹配结果</el-button>
          </div>

          <PetPalDeskEmpty
            v-if="!matches.length"
            title="还没有可用匹配结果"
            description="可能是当前需求仍在等待匹配，或者筛选条件较严格。"
          />

          <div v-else class="petpal-sheet-list">
            <div v-for="match in matches" :key="match.serviceId" class="petpal-sheet-row">
              <div class="petpal-sheet-row__copy">
                <h3 class="petpal-sheet-row__title">{{ match.caregiverName }}</h3>
                <p class="petpal-sheet-row__desc">{{ match.city || '城市待确认' }} · 评分 {{ match.ratingAvg }} · {{ match.experienceYears }} 年经验</p>
                <p class="petpal-sheet-row__desc">{{ formatPetPalMoney(match.pricePerUnit) }}/{{ match.unitType }} · 提前 {{ match.minNoticeHours }} 小时预约</p>
                <div class="petpal-pill-row">
                  <span v-for="tag in match.specialtyTags.slice(0, 3)" :key="tag" class="petpal-pill">{{ tag }}</span>
                </div>
              </div>
              <div class="petpal-sheet-row__tail">
                <el-button
                  type="primary"
                  :loading="creatingOrderId === match.serviceId"
                  @click="createOrder(match.serviceId)"
                >
                  创建订单
                </el-button>
              </div>
            </div>
          </div>
        </template>
      </PetPalDeskSection>
    </div>
  </PetPalDeskPage>
</template>

<script setup lang="ts">
import type { MatchedCaregiverRecord, MatchCaregiverQuery, ServiceRequestRecord } from '@rbac/api-common';
import { computed, onMounted, ref } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { api } from '@/api/client';
import { getErrorMessage } from '@/utils/errors';
import PetPalDeskEmpty from './rebuild/petpal-desk-empty.vue';
import PetPalDeskPage from './rebuild/petpal-desk-page.vue';
import PetPalDeskSection from './rebuild/petpal-desk-section.vue';
import {
  formatPetPalMoney,
  formatPetPalRange,
  getPetPalServiceRequestStatusLabel,
  getPetPalServiceTypeLabel,
  petPalOwnerWorkspaceNav,
} from './shared';

const router = useRouter();

const requests = ref<ServiceRequestRecord[]>([]);
const matches = ref<MatchedCaregiverRecord[]>([]);
const selectedRequestId = ref('');
const matching = ref(false);
const creatingOrderId = ref('');

const selectedRequest = computed(() => requests.value.find((item) => item.id === selectedRequestId.value) ?? null);
const heroStats = computed(() => [
  { label: '需求总数', value: String(requests.value.length), hint: '只在这里看需求状态' },
  { label: '活跃需求', value: String(requests.value.filter((item) => ['OPEN', 'MATCHED', 'MATCHING', 'CONFIRMED'].includes(item.status)).length), hint: '建议优先处理活跃条目' },
  { label: '当前匹配数', value: String(matches.value.length), hint: selectedRequest.value ? '按右侧选中需求展示' : '先选择一条需求' },
  { label: '下一步', value: '查看匹配', hint: '确认合适照料者后再创建订单' },
]);

function buildMatchQuery(request: ServiceRequestRecord): MatchCaregiverQuery {
  return {
    serviceType: request.serviceType,
    petSpecies: request.pet?.species || 'DOG',
    page: 1,
    pageSize: 12,
  };
}

async function loadPage() {
  try {
    requests.value = await api.petpal.requests.list();
    if (requests.value.length) {
      selectedRequestId.value = requests.value[0].id;
      await loadMatches(requests.value[0]);
    }
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '加载需求队列失败'));
  }
}

async function loadMatches(request: ServiceRequestRecord) {
  matching.value = true;
  try {
    const result = await api.petpal.match.caregivers(buildMatchQuery(request));
    matches.value = result.items;
  } catch (error: unknown) {
    matches.value = [];
    ElMessage.error(getErrorMessage(error, '加载匹配结果失败'));
  } finally {
    matching.value = false;
  }
}

async function selectRequest(requestId: string) {
  selectedRequestId.value = requestId;
  const target = requests.value.find((item) => item.id === requestId);
  if (target) {
    await loadMatches(target);
  }
}

async function createOrder(caregiverServiceId: string) {
  if (!selectedRequest.value) {
    return;
  }
  creatingOrderId.value = caregiverServiceId;
  try {
    const detail = await api.petpal.orders.create({
      requestId: selectedRequest.value.id,
      caregiverServiceId,
    });
    ElMessage.success('订单已创建，继续完成支付');
    await router.push({ name: 'frontend-petpal-payment-result', params: { id: detail.id } });
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '创建订单失败'));
  } finally {
    creatingOrderId.value = '';
  }
}

onMounted(() => {
  void loadPage();
});
</script>

<style scoped lang="scss">
.petpal-request-row {
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

.petpal-request-row:first-child {
  padding-top: 0;
  border-top: 0;
}

.petpal-request-row.is-active {
  color: #2563eb;
}
</style>
