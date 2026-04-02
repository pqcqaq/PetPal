<!--
UX Blueprint
User: 主人需要跟进已提交的需求，判断是否匹配到合适照料者
Entry: 主人总览、需求提交成功后回流
First screen: 活跃需求数量、匹配状态、当前聚焦需求的候选
Primary action: 查看候选照料者并继续结算
Secondary actions: 新建需求、回订单队列
States: 未登录、加载失败、空态、候选加载中
-->
<template>
  <div class="frontend-page">
    <PetPalWorkspaceHero
      eyebrow="主人工作区"
      title="需求队列"
      summary="队列页只负责看需求状态和候选照料者，创建需求已经独立到表单页。"
      :nav-items="petPalOwnerWorkspaceNav"
      active-name="frontend-petpal-requests"
      :stats="heroStats"
      :primary-action="{ label: '新建需求', to: { name: 'frontend-petpal-request-create' } }"
      :actions="heroActions"
    />

    <template v-if="auth.isAuthenticated">
      <section v-if="pageLoadState === 'error'" class="frontend-card">
        <PetPalStatePanel
          eyebrow="需求队列"
          title="需求队列加载失败"
          :description="pageLoadErrorMessage"
          tone="danger"
        >
          <template #actions>
            <el-button size="small" type="primary" :loading="loading" @click="loadPage">重试加载</el-button>
          </template>
        </PetPalStatePanel>
      </section>

      <section v-else class="frontend-page__section-grid">
        <article class="frontend-card petpal-grid-span-7">
          <span class="frontend-card__eyebrow">需求列表</span>
          <div class="petpal-list-head">
            <h3>{{ requests.length ? `共 ${requests.length} 条需求` : '当前没有需求' }}</h3>
            <RouterLink class="frontend-page__button is-primary" :to="{ name: 'frontend-petpal-request-create' }">
              新建需求
            </RouterLink>
          </div>

          <div v-if="requests.length" class="petpal-request-list">
            <article
              v-for="request in requests"
              :key="request.id"
              class="petpal-request-card"
              :class="{ 'is-focused': request.id === focusedRequestId }"
            >
              <div class="petpal-request-card__head">
                <div>
                  <h4>{{ getPetPalServiceTypeLabel(request.serviceType) }}</h4>
                  <p>{{ request.pet?.name || '宠物待同步' }} · {{ formatPetPalRange(request.startTime, request.endTime) }}</p>
                </div>
                <el-tag size="small" :type="request.status === 'MATCHED' ? 'success' : 'warning'">
                  {{ getPetPalServiceRequestStatusLabel(request.status) }}
                </el-tag>
              </div>

              <div class="petpal-request-card__metrics">
                <div>
                  <span>地点</span>
                  <strong>{{ request.locationText }}</strong>
                </div>
                <div>
                  <span>预算</span>
                  <strong>¥{{ formatPetPalAmount(request.budgetAmount) }}</strong>
                </div>
                <div>
                  <span>已匹配</span>
                  <strong>{{ request.matchedCaregiver?.user.nickname || '待匹配' }}</strong>
                </div>
              </div>

              <div class="petpal-card-actions">
                <el-button size="small" @click="focusRequest(request)">查看候选</el-button>
                <RouterLink v-if="request.matchedCaregiverId" :to="{ name: 'frontend-petpal-orders' }">
                  <el-button size="small" type="primary">看订单队列</el-button>
                </RouterLink>
              </div>
            </article>
          </div>

          <PetPalStatePanel
            v-else
            eyebrow="需求队列"
            title="还没有需求"
            description="需求表单已经拆出去，发布后回到这里继续看匹配和下单。"
          >
            <template #actions>
              <RouterLink :to="{ name: 'frontend-petpal-request-create' }">
                <el-button size="small" type="primary">去新建需求</el-button>
              </RouterLink>
            </template>
          </PetPalStatePanel>
        </article>

        <aside class="frontend-card petpal-grid-span-5">
          <span class="frontend-card__eyebrow">聚焦需求</span>
          <template v-if="focusedRequest">
            <div class="petpal-side-stack">
              <div class="petpal-side-item">
                <strong>{{ getPetPalServiceTypeLabel(focusedRequest.serviceType) }}</strong>
                <p>{{ focusedRequest.pet?.name || '宠物待同步' }} · {{ formatPetPalRange(focusedRequest.startTime, focusedRequest.endTime) }}</p>
                <p>{{ focusedRequest.locationText }} · 预算 ¥{{ formatPetPalAmount(focusedRequest.budgetAmount) }}</p>
              </div>

              <div class="petpal-side-item">
                <div class="petpal-side-item__head">
                  <strong>候选照料者</strong>
                  <el-button size="small" text :loading="matchLoading" @click="loadMatches(focusedRequest)">刷新候选</el-button>
                </div>
                <p>候选按当前需求重新匹配，只在这里做比对，不把匹配逻辑塞回新建页。</p>
              </div>

              <div v-if="matchItems.length" class="petpal-match-list">
                <article v-for="item in matchItems" :key="item.serviceId" class="petpal-match-card">
                  <div class="petpal-match-card__head">
                    <div>
                      <h4>{{ item.caregiverName }}</h4>
                      <p>{{ item.city || '城市待补充' }} · {{ item.experienceYears }} 年经验</p>
                    </div>
                    <strong>¥{{ formatPetPalAmount(item.pricePerUnit) }}/{{ item.unitType }}</strong>
                  </div>
                  <p>{{ item.serviceCommitment || item.intro || '照料者尚未补充服务说明。' }}</p>
                  <div class="petpal-inline-actions">
                    <span>评分 {{ formatPetPalAmount(item.ratingAvg) }} / {{ item.ratingCount }}</span>
                    <span>提前 {{ item.minNoticeHours }} 小时预约</span>
                  </div>
                </article>
              </div>

              <PetPalStatePanel
                v-else-if="!matchLoading"
                eyebrow="候选照料者"
                title="当前没有候选照料者"
                description="可以稍后刷新需求队列，或调整时间、地点和预算后重新提交一条需求。"
              />
            </div>
          </template>
          <PetPalStatePanel
            v-else
            eyebrow="聚焦需求"
            title="先从左侧选一条需求"
            description="需求队列和候选对比拆成左右结构，避免把长表单和匹配列表挤在一个页面。"
          />
        </aside>
      </section>
    </template>

    <section v-else class="frontend-card">
      <PetPalStatePanel
        eyebrow="需求队列"
        title="登录后查看需求队列"
        description="登录后从队列页继续跟进匹配和候选对比。"
      >
        <template #actions>
          <RouterLink to="/login">
            <el-button size="small" type="primary">去登录</el-button>
          </RouterLink>
        </template>
      </PetPalStatePanel>
    </section>
  </div>
</template>

<script setup lang="ts">
import type { MatchedCaregiverRecord, ServiceRequestRecord } from '@rbac/api-common';
import { computed, onMounted, ref } from 'vue';
import { ElButton } from 'element-plus';
import { api } from '@/api/client';
import PetPalStatePanel from '@/pages/frontend/petpal/PetPalStatePanel.vue';
import PetPalWorkspaceHero from '@/pages/frontend/petpal/components/PetPalWorkspaceHero.vue';
import { useAuthStore } from '@/stores/auth';
import { getErrorMessage } from '@/utils/errors';
import {
  formatPetPalAmount,
  formatPetPalRange,
  getPetPalServiceRequestStatusLabel,
  getPetPalServiceTypeLabel,
  petPalOwnerWorkspaceNav,
} from './shared';

const auth = useAuthStore();

const loading = ref(false);
const matchLoading = ref(false);
const pageLoadState = ref<'idle' | 'ready' | 'error'>('idle');
const pageLoadErrorMessage = ref('');
const requests = ref<ServiceRequestRecord[]>([]);
const focusedRequestId = ref('');
const matchItems = ref<MatchedCaregiverRecord[]>([]);

const focusedRequest = computed(() => requests.value.find((item) => item.id === focusedRequestId.value) ?? null);
const activeRequestCount = computed(() => requests.value.filter((item) => ['OPEN', 'MATCHING', 'MATCHED'].includes(item.status)).length);
const matchedRequestCount = computed(() => requests.value.filter((item) => item.status === 'MATCHED' || item.matchedCaregiverId).length);

const heroStats = computed(() => [
  {
    label: '需求总数',
    value: String(requests.value.length),
    hint: '只在这里看需求，不再和表单混排',
  },
  {
    label: '活跃需求',
    value: String(activeRequestCount.value),
    hint: activeRequestCount.value ? '继续看候选照料者' : '可重新发布新需求',
  },
  {
    label: '已匹配',
    value: String(matchedRequestCount.value),
    hint: matchedRequestCount.value ? '可继续跟单或结算' : '还没有已匹配需求',
  },
  {
    label: '当前聚焦',
    value: focusedRequest.value ? getPetPalServiceTypeLabel(focusedRequest.value.serviceType) : '未选中',
    hint: '右侧只展示一条需求的候选',
  },
]);

const heroActions = computed(() => [
  { label: '返回总览', to: { name: 'frontend-petpal' }, tone: 'secondary' as const },
  { label: '订单队列', to: { name: 'frontend-petpal-orders' }, tone: 'secondary' as const },
]);

const buildMatchQuery = (request: ServiceRequestRecord) => ({
  serviceType: request.serviceType,
  petSpecies: request.pet?.species || 'DOG',
  city: request.locationText.trim() || undefined,
  page: 1,
  pageSize: 6,
});

async function loadMatches(request: ServiceRequestRecord) {
  matchLoading.value = true;
  focusedRequestId.value = request.id;

  try {
    const page = await api.petpal.match.caregivers(buildMatchQuery(request));
    matchItems.value = page.items;
  } catch (error: unknown) {
    matchItems.value = [];
  } finally {
    matchLoading.value = false;
  }
}

function focusRequest(request: ServiceRequestRecord) {
  void loadMatches(request);
}

async function loadPage() {
  if (!auth.isAuthenticated || loading.value) {
    return;
  }

  loading.value = true;
  pageLoadState.value = 'idle';
  pageLoadErrorMessage.value = '';

  try {
    requests.value = await api.petpal.requests.list();
    pageLoadState.value = 'ready';
    const nextFocused = requests.value[0] ?? null;
    if (nextFocused) {
      await loadMatches(nextFocused);
    } else {
      focusedRequestId.value = '';
      matchItems.value = [];
    }
  } catch (error: unknown) {
    requests.value = [];
    focusedRequestId.value = '';
    matchItems.value = [];
    pageLoadState.value = 'error';
    pageLoadErrorMessage.value = getErrorMessage(error, '加载需求队列失败');
  } finally {
    loading.value = false;
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
.petpal-grid-span-7 {
  grid-column: span 7;
}

.petpal-grid-span-5 {
  grid-column: span 5;
}

.petpal-request-list,
.petpal-request-card,
.petpal-side-stack,
.petpal-match-list,
.petpal-match-card {
  display: grid;
  gap: 14px;
}

.petpal-list-head,
.petpal-request-card__head,
.petpal-card-actions,
.petpal-match-card__head,
.petpal-inline-actions,
.petpal-side-item__head {
  display: flex;
  gap: 12px;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
}

.petpal-request-card,
.petpal-side-item,
.petpal-match-card {
  padding: 18px;
  border-radius: 20px;
  border: 1px solid rgba(18, 53, 51, 0.08);
  background: rgba(248, 252, 251, 0.86);
}

.petpal-request-card.is-focused {
  border-color: rgba(15, 118, 110, 0.22);
  box-shadow: 0 12px 26px rgba(15, 118, 110, 0.08);
}

.petpal-request-card__metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.petpal-request-card__metrics div {
  display: grid;
  gap: 6px;
  padding: 14px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.9);
}

.petpal-request-card__metrics span {
  color: #6d8683;
  font-size: 12px;
}

@media (max-width: 1080px) {
  .petpal-grid-span-7,
  .petpal-grid-span-5 {
    grid-column: span 12;
  }
}

@media (max-width: 720px) {
  .petpal-request-card__metrics {
    grid-template-columns: 1fr;
  }
}
</style>
