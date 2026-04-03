<template>
  <PageScaffold :stats="stats">
    <template #actions>
      <el-space>
        <el-button @click="loadRows">刷新</el-button>
      </el-space>
    </template>

    <template #toolbar>
      <el-space wrap>
        <el-select v-model="pageState.filters.targetRole" clearable placeholder="处罚对象" style="width: 150px">
          <el-option
            v-for="item in penaltyAdminTargetRoleOptions"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
        <el-select v-model="pageState.filters.penaltyType" clearable placeholder="处罚类型" style="width: 160px">
          <el-option
            v-for="item in penaltyTypeOptions"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
        <el-select v-model="pageState.filters.severity" clearable placeholder="严重等级" style="width: 140px">
          <el-option
            v-for="item in penaltySeverityOptions"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
        <el-select
          v-model="pageState.filters.rectifyStatus"
          clearable
          placeholder="整改状态"
          style="width: 150px"
        >
          <el-option
            v-for="item in penaltyRectifyStatusOptions"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
        <el-select
          v-model="pageState.filters.appealStatus"
          clearable
          placeholder="申诉状态"
          style="width: 150px"
        >
          <el-option
            v-for="item in penaltyAppealStatusOptions"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
        <el-checkbox v-model="pageState.filters.overdueOnly">仅逾期整改</el-checkbox>
        <el-input v-model="pageState.filters.keyword" clearable placeholder="订单号/对象/原因关键词" style="width: 240px" />
        <el-button type="primary" @click="applyFilters">筛选</el-button>
        <el-button @click="resetFilters">重置</el-button>
      </el-space>
    </template>

    <el-table :data="rows" v-loading="loading" border row-key="id">
      <el-table-column type="expand">
        <template #default="scope">
          <div class="penalty-expand">
            <div class="penalty-expand__section">
              <span class="penalty-expand__label">处罚原因</span>
              <p>{{ scope.row.reason }}</p>
            </div>
            <div class="penalty-expand__section">
              <span class="penalty-expand__label">处罚措施</span>
              <p>{{ scope.row.actionSummary }}</p>
            </div>
            <div v-if="scope.row.rectifyNote" class="penalty-expand__section">
              <span class="penalty-expand__label">整改说明</span>
              <p>{{ scope.row.rectifyNote }}</p>
            </div>
            <div v-if="scope.row.rectifyEvidenceUrls.length" class="penalty-expand__section">
              <span class="penalty-expand__label">整改材料</span>
              <ul class="penalty-expand__links">
                <li v-for="url in scope.row.rectifyEvidenceUrls" :key="url">
                  <a :href="url" target="_blank" rel="noreferrer">{{ url }}</a>
                </li>
              </ul>
            </div>
            <div v-if="scope.row.appealStatus !== 'NONE'" class="penalty-expand__section">
              <span class="penalty-expand__label">申诉原因</span>
              <p>{{ scope.row.appealReason || '-' }}</p>
              <p class="penalty-expand__meta">
                提交人：{{ scope.row.appealSubmittedByNickname || '未记录' }}
                <template v-if="scope.row.appealSubmittedAt">
                  · {{ formatDateTime(scope.row.appealSubmittedAt) }}
                </template>
              </p>
            </div>
            <div v-if="scope.row.appealStatus === 'APPROVED' || scope.row.appealStatus === 'REJECTED'" class="penalty-expand__section">
              <span class="penalty-expand__label">申诉审核</span>
              <p>{{ scope.row.appealReviewNote || '-' }}</p>
              <p class="penalty-expand__meta">
                审核人：{{ scope.row.appealReviewedByNickname || '未记录' }}
                <template v-if="scope.row.appealReviewedAt">
                  · {{ formatDateTime(scope.row.appealReviewedAt) }}
                </template>
              </p>
            </div>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="orderNo" label="订单号" min-width="170" />
      <el-table-column label="处罚对象" min-width="180">
        <template #default="scope">
          <div class="penalty-target">
            <strong>{{ scope.row.targetNickname || '平台侧对象' }}</strong>
            <span>{{ getTargetRoleLabel(scope.row.targetRole) }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="处罚信息" min-width="220">
        <template #default="scope">
          <div class="penalty-type-cell">
            <el-tag :type="getSeverityTagType(scope.row.severity)">{{ getSeverityLabel(scope.row.severity) }}</el-tag>
            <strong>{{ getTypeLabel(scope.row.penaltyType) }}</strong>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="整改状态" min-width="150">
        <template #default="scope">
          <div class="penalty-rectify">
            <el-tag :type="getRectifyStatusTagType(scope.row.rectifyStatus)">
              {{ getRectifyStatusLabel(scope.row.rectifyStatus) }}
            </el-tag>
            <span>{{ getRectifyHint(scope.row) }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="申诉状态" min-width="150">
        <template #default="scope">
          <div class="penalty-appeal">
            <el-tag :type="getAppealStatusTagType(scope.row.appealStatus)">
              {{ getAppealStatusLabel(scope.row.appealStatus) }}
            </el-tag>
            <span>{{ getAppealHint(scope.row) }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="创建人" min-width="120">
        <template #default="scope">{{ scope.row.creatorNickname || '系统' }}</template>
      </el-table-column>
      <el-table-column label="最近更新" min-width="180">
        <template #default="scope">{{ formatDateTime(scope.row.updatedAt) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="300" fixed="right">
        <template #default="scope">
          <el-space>
            <el-button
              v-if="scope.row.rectifyStatus === 'PENDING' && scope.row.appealStatus === 'NONE'"
              v-permission="'petpal.penalty.manage'"
              link
              type="primary"
              @click="openAppealDialog(scope.row)"
            >
              发起申诉
            </el-button>
            <el-button
              v-if="scope.row.appealStatus === 'PENDING'"
              v-permission="'petpal.penalty.manage'"
              link
              type="primary"
              @click="openReviewDialog(scope.row, 'APPROVED')"
            >
              通过申诉
            </el-button>
            <el-button
              v-if="scope.row.appealStatus === 'PENDING'"
              v-permission="'petpal.penalty.manage'"
              link
              type="danger"
              @click="openReviewDialog(scope.row, 'REJECTED')"
            >
              驳回申诉
            </el-button>
            <el-button
              v-if="scope.row.rectifyStatus === 'PENDING' && scope.row.appealStatus !== 'PENDING'"
              v-permission="'petpal.penalty.manage'"
              link
              type="success"
              @click="openRectifyDialog(scope.row, 'COMPLETED')"
            >
              完成整改
            </el-button>
            <el-button
              v-if="scope.row.rectifyStatus === 'PENDING' && scope.row.appealStatus !== 'PENDING'"
              v-permission="'petpal.penalty.manage'"
              link
              type="warning"
              @click="openRectifyDialog(scope.row, 'WAIVED')"
            >
              整改豁免
            </el-button>
          </el-space>
        </template>
      </el-table-column>
    </el-table>

    <div class="table-footer">
      <el-pagination
        background
        layout="total, prev, pager, next"
        :current-page="pageState.page"
        :page-size="pageSize"
        :total="total"
        @current-change="changePage"
      />
    </div>

    <el-dialog
      v-model="rectifyDialogVisible"
      title="更新整改状态"
      width="560px"
      :close-on-click-modal="!rectifySubmitting"
      :close-on-press-escape="!rectifySubmitting"
      @closed="resetRectifyDialog"
    >
      <template v-if="activePenalty">
        <div class="penalty-dialog__summary">
          <h3>{{ activePenalty.orderNo }}</h3>
          <p>{{ activePenalty.targetNickname || '平台侧对象' }} · {{ getTypeLabel(activePenalty.penaltyType) }}</p>
        </div>

        <el-form label-position="top">
          <el-form-item label="整改结果">
            <el-radio-group v-model="rectifyForm.rectifyStatus">
              <el-radio
                v-for="item in rectifyActionOptions"
                :key="item.value"
                :value="item.value"
              >
                {{ item.label }}
              </el-radio>
            </el-radio-group>
          </el-form-item>
          <el-form-item label="整改说明">
            <el-input
              v-model="rectifyForm.rectifyNote"
              type="textarea"
              :rows="4"
              maxlength="1000"
              show-word-limit
              placeholder="说明整改证据、复核结果或豁免原因"
            />
          </el-form-item>
          <el-form-item label="整改材料链接">
            <el-input
              v-model="rectifyForm.rectifyEvidenceInput"
              type="textarea"
              :rows="4"
              maxlength="4000"
              show-word-limit
              placeholder="每行一个材料链接；完成整改时至少填写 1 个"
            />
            <p class="penalty-dialog__helper">
              支持填写视频、图片、复盘文档等 URL，提交后将按行去重保存，最多 10 条。
            </p>
          </el-form-item>
        </el-form>
      </template>

      <template #footer>
        <el-button :disabled="rectifySubmitting" @click="rectifyDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="rectifySubmitting" @click="submitRectify">提交</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="appealDialogVisible"
      title="发起处罚申诉"
      width="560px"
      :close-on-click-modal="!appealSubmitting"
      :close-on-press-escape="!appealSubmitting"
      @closed="resetAppealDialog"
    >
      <template v-if="activePenalty">
        <div class="penalty-dialog__summary">
          <h3>{{ activePenalty.orderNo }}</h3>
          <p>{{ activePenalty.targetNickname || '平台侧对象' }} · {{ getTypeLabel(activePenalty.penaltyType) }}</p>
        </div>

        <el-form label-position="top">
          <el-form-item label="申诉原因">
            <el-input
              v-model="appealForm.appealReason"
              type="textarea"
              :rows="4"
              maxlength="1000"
              show-word-limit
              placeholder="说明处罚争议点、补充证据或需要复核的事实"
            />
          </el-form-item>
        </el-form>
      </template>

      <template #footer>
        <el-button :disabled="appealSubmitting" @click="appealDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="appealSubmitting" @click="submitAppeal">提交</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="reviewDialogVisible"
      title="审核处罚申诉"
      width="560px"
      :close-on-click-modal="!reviewSubmitting"
      :close-on-press-escape="!reviewSubmitting"
      @closed="resetReviewDialog"
    >
      <template v-if="activePenalty">
        <div class="penalty-dialog__summary">
          <h3>{{ activePenalty.orderNo }}</h3>
          <p>{{ activePenalty.targetNickname || '平台侧对象' }} · {{ getTypeLabel(activePenalty.penaltyType) }}</p>
        </div>

        <el-form label-position="top">
          <el-form-item label="申诉结论">
            <el-radio-group v-model="reviewForm.decision">
              <el-radio
                v-for="item in reviewDecisionOptions"
                :key="item.value"
                :value="item.value"
              >
                {{ item.label }}
              </el-radio>
            </el-radio-group>
          </el-form-item>
          <el-form-item label="审核意见">
            <el-input
              v-model="reviewForm.reviewNote"
              type="textarea"
              :rows="4"
              maxlength="1000"
              show-word-limit
              placeholder="说明通过或驳回申诉的依据"
            />
          </el-form-item>
        </el-form>
      </template>

      <template #footer>
        <el-button :disabled="reviewSubmitting" @click="reviewDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="reviewSubmitting" @click="submitReview">提交</el-button>
      </template>
    </el-dialog>
  </PageScaffold>
</template>

<script setup lang="ts">
import type {
  ComplaintTargetRole,
  PenaltyAppealStatus,
  PenaltyAdminQuery,
  PenaltyAdminRecord,
  PenaltyAdminStats,
  PenaltyRectifyStatus,
  PenaltySeverity,
  PenaltyType,
} from '@rbac/api-common';
import { ElMessage } from 'element-plus';
import { computed, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '@/api/client';
import { usePageState } from '@/composables/use-page-state';
import { getErrorMessage } from '@/utils/errors';
import {
  buildRouteQuerySnapshot,
  getSingleRouteQueryValue,
  hasAnyStringRouteQuery,
  normalizeStringRouteQuery,
  parsePositiveIntegerRouteQuery,
} from '../shared/route-query';
import { hasSelectOptionValue } from '../shared/option-value';
import {
  getPenaltyAppealStatusLabel,
  getPenaltyAppealStatusTagType,
  penaltyAppealStatusOptions,
  getPenaltyRectifyStatusLabel,
  getPenaltyRectifyStatusTagType,
  getPenaltySeverityLabel,
  getPenaltySeverityTagType,
  getPenaltyTargetRoleLabel,
  getPenaltyTypeLabel,
  penaltyAdminTargetRoleOptions,
  penaltyRectifyStatusOptions,
  penaltySeverityOptions,
  penaltyTypeOptions,
} from './penalty-admin-options';

defineOptions({ name: 'PetPalPenaltyAdminView' });

definePage({
  viewKey: 'petpal-penalty-admin',
  keepAlive: true,
});

type Filters = {
  targetRole?: ComplaintTargetRole;
  penaltyType?: PenaltyType;
  severity?: PenaltySeverity;
  rectifyStatus?: PenaltyRectifyStatus;
  appealStatus?: PenaltyAppealStatus;
  overdueOnly: boolean;
  keyword?: string;
};

type State = {
  page: number;
  filters: Filters;
};

type RectifyFormState = {
  rectifyStatus: Extract<PenaltyRectifyStatus, 'COMPLETED' | 'WAIVED'>;
  rectifyNote: string;
  rectifyEvidenceInput: string;
};

type AppealFormState = {
  appealReason: string;
};

type ReviewFormState = {
  decision: Extract<PenaltyAppealStatus, 'APPROVED' | 'REJECTED'>;
  reviewNote: string;
};

const rows = ref<PenaltyAdminRecord[]>([]);
const summary = ref<PenaltyAdminStats | null>(null);
const loading = ref(false);
const total = ref(0);
const pageSize = 10;
const route = useRoute();
const router = useRouter();
const rectifyDialogVisible = ref(false);
const rectifySubmitting = ref(false);
const appealDialogVisible = ref(false);
const appealSubmitting = ref(false);
const reviewDialogVisible = ref(false);
const reviewSubmitting = ref(false);
const activePenalty = ref<PenaltyAdminRecord | null>(null);

const rectifyActionOptions = penaltyRectifyStatusOptions.filter(
  (item): item is { label: string; value: 'COMPLETED' | 'WAIVED' } =>
    item.value === 'COMPLETED' || item.value === 'WAIVED',
);

const reviewDecisionOptions = penaltyAppealStatusOptions.filter(
  (item): item is { label: string; value: 'APPROVED' | 'REJECTED' } =>
    item.value === 'APPROVED' || item.value === 'REJECTED',
);

const { state: pageState, reset: resetPageState } = usePageState<State>('page:petpal:penalty-admin', {
  page: 1,
  filters: {
    targetRole: undefined,
    penaltyType: undefined,
    severity: undefined,
    rectifyStatus: undefined,
    appealStatus: undefined,
    overdueOnly: false,
    keyword: undefined,
  },
});

const createEmptyRectifyForm = (): RectifyFormState => ({
  rectifyStatus: 'COMPLETED',
  rectifyNote: '',
  rectifyEvidenceInput: '',
});

const createEmptyAppealForm = (): AppealFormState => ({
  appealReason: '',
});

const createEmptyReviewForm = (): ReviewFormState => ({
  decision: 'APPROVED',
  reviewNote: '',
});

const rectifyForm = reactive<RectifyFormState>(createEmptyRectifyForm());
const appealForm = reactive<AppealFormState>(createEmptyAppealForm());
const reviewForm = reactive<ReviewFormState>(createEmptyReviewForm());

const routeFilterKeys = ['page', 'targetRole', 'penaltyType', 'severity', 'rectifyStatus', 'appealStatus', 'overdueOnly', 'keyword'] as const;

const getTargetRoleLabel = getPenaltyTargetRoleLabel;
const getTypeLabel = getPenaltyTypeLabel;
const getSeverityLabel = getPenaltySeverityLabel;
const getSeverityTagType = getPenaltySeverityTagType;
const getRectifyStatusLabel = getPenaltyRectifyStatusLabel;
const getRectifyStatusTagType = getPenaltyRectifyStatusTagType;
const getAppealStatusLabel = getPenaltyAppealStatusLabel;
const getAppealStatusTagType = getPenaltyAppealStatusTagType;

const stats = computed(() => [
  { label: '当前筛选总量', value: summary.value?.total ?? 0 },
  { label: '待整改', value: summary.value?.byRectifyStatus.PENDING ?? 0 },
  { label: '已完成', value: summary.value?.byRectifyStatus.COMPLETED ?? 0 },
  { label: '已豁免', value: summary.value?.byRectifyStatus.WAIVED ?? 0 },
  { label: '待审核申诉', value: summary.value?.byAppealStatus.PENDING ?? 0 },
  { label: '申诉通过', value: summary.value?.byAppealStatus.APPROVED ?? 0 },
  { label: '高风险处罚', value: summary.value?.bySeverity.HIGH ?? 0 },
  { label: '即将到期', value: summary.value?.dueSoonCount ?? 0 },
  { label: '已逾期', value: summary.value?.overdueCount ?? 0 },
]);

const formatDateTime = (value?: string | null) => {
  if (!value) {
    return '-';
  }
  return new Date(value).toLocaleString('zh-CN', {
    hour12: false,
  });
};

const getRectifyHint = (record: PenaltyAdminRecord) => {
  if (record.rectifyStatus !== 'PENDING') {
    return record.rectifiedAt
      ? `处理时间 ${formatDateTime(record.rectifiedAt)}`
      : '已完成处理';
  }

  if (!record.rectifyDueAt) {
    return '未设置整改截止时间';
  }

  const deadline = new Date(record.rectifyDueAt);
  const diffMs = deadline.getTime() - Date.now();
  const diffHours = Math.max(1, Math.ceil(Math.abs(diffMs) / (60 * 60 * 1000)));

  if (diffMs < 0) {
    return `已超时 ${diffHours} 小时 · 截止 ${formatDateTime(record.rectifyDueAt)}`;
  }

  return `截止 ${formatDateTime(record.rectifyDueAt)} · 剩余 ${diffHours} 小时`;
};

const getAppealHint = (record: PenaltyAdminRecord) => {
  if (record.appealStatus === 'NONE') {
    return '未提交申诉';
  }

  if (record.appealStatus === 'PENDING') {
    return record.appealSubmittedAt
      ? `提交于 ${formatDateTime(record.appealSubmittedAt)}`
      : '待审核';
  }

  return record.appealReviewedAt
    ? `审核于 ${formatDateTime(record.appealReviewedAt)}`
    : '已完成审核';
};

const parseEvidenceUrls = (input: string) =>
  Array.from(
    new Set(
      input
        .split(/\r?\n/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );

const buildRouteQuery = () => {
  const query: Record<string, string> = {};
  if (pageState.page > 1) {
    query.page = String(pageState.page);
  }
  if (pageState.filters.targetRole) {
    query.targetRole = pageState.filters.targetRole;
  }
  if (pageState.filters.penaltyType) {
    query.penaltyType = pageState.filters.penaltyType;
  }
  if (pageState.filters.severity) {
    query.severity = pageState.filters.severity;
  }
  if (pageState.filters.rectifyStatus) {
    query.rectifyStatus = pageState.filters.rectifyStatus;
  }
  if (pageState.filters.appealStatus) {
    query.appealStatus = pageState.filters.appealStatus;
  }
  if (pageState.filters.overdueOnly) {
    query.overdueOnly = 'true';
  }
  if (pageState.filters.keyword?.trim()) {
    query.keyword = pageState.filters.keyword.trim();
  }
  return query;
};

const hydrateStateFromRoute = () => {
  const hasKnownQuery = hasAnyStringRouteQuery(routeFilterKeys, route.query as Record<string, unknown>);
  if (!hasKnownQuery) {
    return;
  }

  const page = parsePositiveIntegerRouteQuery(route.query.page);
  const targetRole = getSingleRouteQueryValue(route.query.targetRole);
  const penaltyType = getSingleRouteQueryValue(route.query.penaltyType);
  const severity = getSingleRouteQueryValue(route.query.severity);
  const rectifyStatus = getSingleRouteQueryValue(route.query.rectifyStatus);
  const appealStatus = getSingleRouteQueryValue(route.query.appealStatus);
  const overdueOnly = getSingleRouteQueryValue(route.query.overdueOnly);

  pageState.page = page;
  pageState.filters.targetRole = hasSelectOptionValue(penaltyAdminTargetRoleOptions, targetRole)
    ? targetRole
    : undefined;
  pageState.filters.penaltyType = hasSelectOptionValue(penaltyTypeOptions, penaltyType)
    ? penaltyType
    : undefined;
  pageState.filters.severity = hasSelectOptionValue(penaltySeverityOptions, severity)
    ? severity
    : undefined;
  pageState.filters.rectifyStatus = hasSelectOptionValue(penaltyRectifyStatusOptions, rectifyStatus)
    ? rectifyStatus
    : undefined;
  pageState.filters.appealStatus = hasSelectOptionValue(penaltyAppealStatusOptions, appealStatus)
    ? appealStatus
    : undefined;
  pageState.filters.overdueOnly = overdueOnly === 'true';
  pageState.filters.keyword = getSingleRouteQueryValue(route.query.keyword) || undefined;
};

const buildQuery = (): PenaltyAdminQuery => ({
  page: pageState.page,
  pageSize,
  targetRole: pageState.filters.targetRole,
  penaltyType: pageState.filters.penaltyType,
  severity: pageState.filters.severity,
  rectifyStatus: pageState.filters.rectifyStatus,
  appealStatus: pageState.filters.appealStatus,
  overdueOnly: pageState.filters.overdueOnly || undefined,
  keyword: pageState.filters.keyword?.trim() || undefined,
});

const buildStatsQuery = (): PenaltyAdminQuery => ({
  targetRole: pageState.filters.targetRole,
  penaltyType: pageState.filters.penaltyType,
  severity: pageState.filters.severity,
  rectifyStatus: pageState.filters.rectifyStatus,
  appealStatus: pageState.filters.appealStatus,
  overdueOnly: pageState.filters.overdueOnly || undefined,
  keyword: pageState.filters.keyword?.trim() || undefined,
});

const loadRows = async () => {
  try {
    loading.value = true;
    const [response, statsResponse] = await Promise.all([
      api.petpal.admin.penalties(buildQuery()),
      api.petpal.admin.penaltyStats(buildStatsQuery()),
    ]);
    rows.value = response.items;
    total.value = response.pagination.total;
    summary.value = statsResponse;
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '加载处罚记录失败'));
  } finally {
    loading.value = false;
  }
};

const syncRouteAndLoad = async () => {
  const nextQuery = buildRouteQuery();
  const currentQuery = normalizeStringRouteQuery(route.query as Record<string, unknown>);
  const nextSnapshot = buildRouteQuerySnapshot(nextQuery);
  const currentSnapshot = buildRouteQuerySnapshot(currentQuery);

  if (nextSnapshot === currentSnapshot) {
    await loadRows();
    return;
  }

  await router.replace({ query: nextQuery });
};

const applyFilters = async () => {
  pageState.page = 1;
  await syncRouteAndLoad();
};

const resetFilters = async () => {
  resetPageState();
  await syncRouteAndLoad();
};

const changePage = async (page: number) => {
  pageState.page = page;
  await syncRouteAndLoad();
};

const resetRectifyDialog = () => {
  activePenalty.value = null;
  Object.assign(rectifyForm, createEmptyRectifyForm());
};

const resetAppealDialog = () => {
  activePenalty.value = null;
  Object.assign(appealForm, createEmptyAppealForm());
};

const resetReviewDialog = () => {
  activePenalty.value = null;
  Object.assign(reviewForm, createEmptyReviewForm());
};

const openRectifyDialog = (
  penalty: PenaltyAdminRecord,
  rectifyStatus: Extract<PenaltyRectifyStatus, 'COMPLETED' | 'WAIVED'>,
) => {
  activePenalty.value = penalty;
  Object.assign(rectifyForm, createEmptyRectifyForm(), {
    rectifyStatus,
  });
  rectifyDialogVisible.value = true;
};

const openAppealDialog = (penalty: PenaltyAdminRecord) => {
  activePenalty.value = penalty;
  Object.assign(appealForm, createEmptyAppealForm());
  appealDialogVisible.value = true;
};

const openReviewDialog = (
  penalty: PenaltyAdminRecord,
  decision: Extract<PenaltyAppealStatus, 'APPROVED' | 'REJECTED'>,
) => {
  activePenalty.value = penalty;
  Object.assign(reviewForm, createEmptyReviewForm(), {
    decision,
  });
  reviewDialogVisible.value = true;
};

const submitRectify = async () => {
  if (!activePenalty.value) {
    return;
  }

  const rectifyNote = rectifyForm.rectifyNote.trim();
  if (!rectifyNote) {
    ElMessage.error('请填写整改说明');
    return;
  }
  const rectifyEvidenceUrls = parseEvidenceUrls(rectifyForm.rectifyEvidenceInput);
  if (rectifyForm.rectifyStatus === 'COMPLETED' && rectifyEvidenceUrls.length === 0) {
    ElMessage.error('完成整改时至少需要填写 1 个整改材料链接');
    return;
  }

  try {
    rectifySubmitting.value = true;
    await api.petpal.admin.rectifyPenalty(activePenalty.value.id, {
      rectifyStatus: rectifyForm.rectifyStatus,
      rectifyNote,
      rectifyEvidenceUrls,
    });
    rectifyDialogVisible.value = false;
    ElMessage.success('处罚整改状态已更新');
    await loadRows();
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '更新整改状态失败'));
  } finally {
    rectifySubmitting.value = false;
  }
};

const submitAppeal = async () => {
  if (!activePenalty.value) {
    return;
  }

  const appealReason = appealForm.appealReason.trim();
  if (!appealReason) {
    ElMessage.error('请填写申诉原因');
    return;
  }

  try {
    appealSubmitting.value = true;
    await api.petpal.admin.submitPenaltyAppeal(activePenalty.value.id, {
      appealReason,
    });
    appealDialogVisible.value = false;
    ElMessage.success('处罚申诉已提交');
    await loadRows();
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '提交处罚申诉失败'));
  } finally {
    appealSubmitting.value = false;
  }
};

const submitReview = async () => {
  if (!activePenalty.value) {
    return;
  }

  const reviewNote = reviewForm.reviewNote.trim();
  if (!reviewNote) {
    ElMessage.error('请填写审核意见');
    return;
  }

  try {
    reviewSubmitting.value = true;
    await api.petpal.admin.reviewPenaltyAppeal(activePenalty.value.id, {
      decision: reviewForm.decision,
      reviewNote,
    });
    reviewDialogVisible.value = false;
    ElMessage.success('处罚申诉已审核');
    await loadRows();
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '审核处罚申诉失败'));
  } finally {
    reviewSubmitting.value = false;
  }
};

watch(
  () => route.fullPath,
  () => {
    hydrateStateFromRoute();
    void loadRows();
  },
  { immediate: true },
);
</script>

<style scoped lang="scss">
.table-footer {
  margin-top: 12px;
  display: flex;
  justify-content: flex-end;
}

.penalty-target,
.penalty-type-cell,
.penalty-rectify,
.penalty-appeal {
  display: grid;
  gap: 6px;
}

.penalty-target span,
.penalty-type-cell span,
.penalty-rectify span,
.penalty-appeal span {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.penalty-expand {
  display: grid;
  gap: 14px;
  padding: 6px 8px;
}

.penalty-expand__section {
  display: grid;
  gap: 6px;
}

.penalty-expand__label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.penalty-expand__section p {
  margin: 0;
  line-height: 1.6;
  white-space: pre-wrap;
}

.penalty-expand__meta {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.penalty-expand__links {
  margin: 0;
  padding-left: 18px;
}

.penalty-expand__links a {
  color: var(--el-color-primary);
  word-break: break-all;
}

.penalty-dialog__summary {
  margin-bottom: 16px;
  padding: 12px 14px;
  border-radius: 12px;
  background: var(--el-fill-color-light);
}

.penalty-dialog__summary h3,
.penalty-dialog__summary p {
  margin: 0;
}

.penalty-dialog__summary p {
  margin-top: 6px;
  color: var(--el-text-color-secondary);
}

.penalty-dialog__helper {
  margin: 8px 0 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--el-text-color-secondary);
}
</style>
