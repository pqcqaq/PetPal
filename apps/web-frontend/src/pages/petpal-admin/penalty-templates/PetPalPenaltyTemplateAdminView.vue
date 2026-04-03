<template>
  <PageScaffold :stats="stats">
    <template #actions>
      <el-space>
        <el-button
          v-permission="'petpal.penalty.manage'"
          type="primary"
          plain
          @click="openCreateDialog"
        >
          新建模板
        </el-button>
        <el-button @click="loadRows">刷新</el-button>
      </el-space>
    </template>

    <template #toolbar>
      <el-space wrap>
        <el-select v-model="pageState.filters.status" clearable placeholder="全部状态" style="width: 140px">
          <el-option
            v-for="item in penaltyTemplateStatusOptions"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
        <el-select v-model="pageState.filters.targetRole" clearable placeholder="全部对象" style="width: 140px">
          <el-option
            v-for="item in penaltyTemplateTargetRoleOptions"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
        <el-select v-model="pageState.filters.penaltyType" clearable placeholder="全部类型" style="width: 160px">
          <el-option
            v-for="item in penaltyTemplateTypeOptions"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
        <el-select v-model="pageState.filters.severity" clearable placeholder="全部等级" style="width: 140px">
          <el-option
            v-for="item in penaltyTemplateSeverityOptions"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
        <el-input
          v-model="pageState.filters.keyword"
          clearable
          placeholder="编码/名称/描述/默认原因关键词"
          style="width: 280px"
        />
        <el-button type="primary" @click="applyFilters">筛选</el-button>
        <el-button @click="resetFilters">重置</el-button>
      </el-space>
    </template>

    <el-table :data="rows" v-loading="loading" border row-key="id">
      <el-table-column type="expand">
        <template #default="scope">
          <div class="template-expand">
            <div class="template-expand__meta">
              <el-tag :type="getStatusTagType(scope.row.isActive)">
                {{ getStatusLabel(scope.row.isActive) }}
              </el-tag>
              <span>{{ getTargetRoleLabel(scope.row.targetRole) }}</span>
              <span>使用 {{ scope.row.usageCount }} 次</span>
              <span>最近使用 {{ formatDateTime(scope.row.lastUsedAt) }}</span>
            </div>
            <div v-if="scope.row.description" class="template-expand__section">
              <span class="template-expand__label">模板说明</span>
              <p>{{ scope.row.description }}</p>
            </div>
            <div class="template-expand__section">
              <span class="template-expand__label">默认处罚原因</span>
              <p>{{ scope.row.defaultReason }}</p>
            </div>
            <div class="template-expand__section">
              <span class="template-expand__label">默认处罚措施</span>
              <p>{{ scope.row.actionSummary }}</p>
            </div>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="templateCode" label="模板编码" min-width="180" />
      <el-table-column label="模板信息" min-width="240">
        <template #default="scope">
          <div class="template-title">
            <strong>{{ scope.row.templateName }}</strong>
            <span>{{ scope.row.description || '无说明' }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="适用对象" min-width="120">
        <template #default="scope">
          {{ getTargetRoleLabel(scope.row.targetRole) }}
        </template>
      </el-table-column>
      <el-table-column label="处罚类型" min-width="190">
        <template #default="scope">
          <div class="template-type">
            <strong>{{ getTypeLabel(scope.row.penaltyType) }}</strong>
            <el-tag :type="getSeverityTagType(scope.row.severity)">
              {{ getSeverityLabel(scope.row.severity) }}
            </el-tag>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="默认整改" min-width="130">
        <template #default="scope">
          {{ scope.row.defaultRectifyDays ? `${scope.row.defaultRectifyDays} 天` : '不预设' }}
        </template>
      </el-table-column>
      <el-table-column label="使用情况" min-width="160">
        <template #default="scope">
          <div class="template-usage">
            <strong>{{ scope.row.usageCount }} 次</strong>
            <span>{{ formatDateTime(scope.row.lastUsedAt) }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="状态" min-width="110">
        <template #default="scope">
          <el-tag :type="getStatusTagType(scope.row.isActive)">
            {{ getStatusLabel(scope.row.isActive) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="最近更新" min-width="180">
        <template #default="scope">
          {{ formatDateTime(scope.row.updatedAt) }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="220" fixed="right">
        <template #default="scope">
          <el-space>
            <el-button
              v-permission="'petpal.penalty.manage'"
              link
              type="primary"
              @click="openEditDialog(scope.row)"
            >
              编辑
            </el-button>
            <el-button
              v-permission="'petpal.penalty.manage'"
              link
              :type="scope.row.isActive ? 'danger' : 'success'"
              @click="toggleTemplateStatus(scope.row)"
            >
              {{ scope.row.isActive ? '停用' : '启用' }}
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
      v-model="dialogVisible"
      :title="dialogMode === 'create' ? '新建处罚模板' : '编辑处罚模板'"
      width="760px"
      :close-on-click-modal="!submitting"
      :close-on-press-escape="!submitting"
      @closed="resetDialog"
    >
      <el-form label-position="top">
        <div class="template-form-grid">
          <el-form-item label="模板编码">
            <el-input
              v-model="templateForm.templateCode"
              maxlength="50"
              placeholder="例如 SERVICE_LOG_MISSING"
            />
          </el-form-item>
          <el-form-item label="模板名称">
            <el-input
              v-model="templateForm.templateName"
              maxlength="100"
              placeholder="例如 缺少服务影像回传"
            />
          </el-form-item>
        </div>
        <div class="template-form-grid">
          <el-form-item label="适用对象">
            <el-select v-model="templateForm.targetRole" clearable placeholder="留空表示通用模板" style="width: 100%">
              <el-option
                v-for="item in penaltyTemplateTargetRoleOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="默认整改天数">
            <el-input-number
              v-model="templateForm.defaultRectifyDays"
              :min="1"
              :max="365"
              :step="1"
              controls-position="right"
              style="width: 100%"
            />
          </el-form-item>
        </div>
        <div class="template-form-grid">
          <el-form-item label="处罚类型">
            <el-select v-model="templateForm.penaltyType" style="width: 100%">
              <el-option
                v-for="item in penaltyTemplateTypeOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="严重等级">
            <el-select v-model="templateForm.severity" style="width: 100%">
              <el-option
                v-for="item in penaltyTemplateSeverityOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
        </div>
        <el-form-item label="模板说明">
          <el-input
            v-model="templateForm.description"
            maxlength="1000"
            placeholder="选填：说明模板适用场景和判断口径"
          />
        </el-form-item>
        <el-form-item label="默认处罚措施">
          <el-input
            v-model="templateForm.actionSummary"
            type="textarea"
            :rows="3"
            maxlength="1000"
            show-word-limit
            placeholder="例如 限制接单 7 天并补交完整服务记录"
          />
        </el-form-item>
        <el-form-item label="默认处罚原因">
          <el-input
            v-model="templateForm.defaultReason"
            type="textarea"
            :rows="4"
            maxlength="1000"
            show-word-limit
            placeholder="说明责任认定依据和触发规则"
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-space>
          <el-button :disabled="submitting" @click="dialogVisible = false">取消</el-button>
          <el-button type="primary" :loading="submitting" @click="submitTemplate">
            {{ dialogMode === 'create' ? '创建模板' : '保存修改' }}
          </el-button>
        </el-space>
      </template>
    </el-dialog>
  </PageScaffold>
</template>

<script setup lang="ts">
import type {
  ComplaintTargetRole,
  PenaltySeverity,
  PenaltyTemplateAdminQuery,
  PenaltyTemplateAdminStats,
  PenaltyTemplateRecord,
  PenaltyType,
  UpsertPenaltyTemplatePayload,
} from '@rbac/api-common';
import { ElMessage, ElMessageBox } from 'element-plus';
import { computed, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import PageScaffold from '@/components/workbench/PageScaffold.vue';
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
  type PenaltyTemplateStatusFilter,
  getPenaltyTemplateSeverityLabel,
  getPenaltyTemplateSeverityTagType,
  getPenaltyTemplateStatusLabel,
  getPenaltyTemplateStatusTagType,
  getPenaltyTemplateTargetRoleLabel,
  getPenaltyTemplateTypeLabel,
  penaltyTemplateSeverityOptions,
  penaltyTemplateStatusOptions,
  penaltyTemplateTargetRoleOptions,
  penaltyTemplateTypeOptions,
} from './penalty-template-options';

defineOptions({ name: 'PetPalPenaltyTemplateAdminView' });

definePage({
  viewKey: 'petpal-penalty-templates',
  keepAlive: true,
});

type Filters = {
  status?: PenaltyTemplateStatusFilter;
  targetRole?: ComplaintTargetRole;
  penaltyType?: PenaltyType;
  severity?: PenaltySeverity;
  keyword?: string;
};

type State = {
  page: number;
  filters: Filters;
};

type DialogForm = {
  templateCode: string;
  templateName: string;
  description: string;
  targetRole?: ComplaintTargetRole;
  penaltyType: PenaltyType;
  severity: PenaltySeverity;
  defaultReason: string;
  actionSummary: string;
  defaultRectifyDays: number | null;
};

const pageSize = 10;
const rows = ref<PenaltyTemplateRecord[]>([]);
const total = ref(0);
const loading = ref(false);
const dialogVisible = ref(false);
const submitting = ref(false);
const dialogMode = ref<'create' | 'edit'>('create');
const editingTemplateId = ref('');
const route = useRoute();
const router = useRouter();
const statsData = ref<PenaltyTemplateAdminStats>({
  total: 0,
  activeCount: 0,
  inactiveCount: 0,
  sharedCount: 0,
  caregiverCount: 0,
  platformCount: 0,
  totalUsageCount: 0,
  recentUsedCount: 0,
});

const { state: pageState } = usePageState<State>('page:petpal:penalty-template-admin', {
  page: 1,
  filters: {
    status: undefined,
    targetRole: undefined,
    penaltyType: undefined,
    severity: undefined,
    keyword: undefined,
  },
});

const createEmptyForm = (): DialogForm => ({
  templateCode: '',
  templateName: '',
  description: '',
  targetRole: undefined,
  penaltyType: 'WARNING',
  severity: 'LOW',
  defaultReason: '',
  actionSummary: '',
  defaultRectifyDays: null,
});

const templateForm = reactive<DialogForm>(createEmptyForm());

const stats = computed(() => ([
  { label: '当前筛选总量', value: statsData.value.total },
  { label: '启用模板', value: statsData.value.activeCount },
  { label: '停用模板', value: statsData.value.inactiveCount },
  { label: '通用模板', value: statsData.value.sharedCount },
  { label: '照料者模板', value: statsData.value.caregiverCount },
  { label: '平台模板', value: statsData.value.platformCount },
  { label: '累计使用次数', value: statsData.value.totalUsageCount },
  { label: '近 30 天被使用', value: statsData.value.recentUsedCount },
]));

const getStatusLabel = getPenaltyTemplateStatusLabel;
const getStatusTagType = getPenaltyTemplateStatusTagType;
const getTargetRoleLabel = getPenaltyTemplateTargetRoleLabel;
const getTypeLabel = getPenaltyTemplateTypeLabel;
const getSeverityLabel = getPenaltyTemplateSeverityLabel;
const getSeverityTagType = getPenaltyTemplateSeverityTagType;

const formatDateTime = (value?: string | null) => {
  if (!value) {
    return '-';
  }
  return new Date(value).toLocaleString('zh-CN', {
    hour12: false,
  });
};

const routeFilterKeys = ['page', 'status', 'targetRole', 'penaltyType', 'severity', 'keyword'] as const;

const buildRouteQuery = () => {
  const query: Record<string, string> = {};
  if (pageState.page > 1) {
    query.page = String(pageState.page);
  }
  if (pageState.filters.status) {
    query.status = pageState.filters.status;
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
  if (pageState.filters.keyword?.trim()) {
    query.keyword = pageState.filters.keyword.trim();
  }
  return query;
};

const hydrateStateFromRoute = () => {
  const hasKnownQuery = hasAnyStringRouteQuery(
    routeFilterKeys,
    route.query as Record<string, unknown>,
  );
  if (!hasKnownQuery) {
    return;
  }

  const page = parsePositiveIntegerRouteQuery(route.query.page);
  const status = getSingleRouteQueryValue(route.query.status);
  const targetRole = getSingleRouteQueryValue(route.query.targetRole);
  const penaltyType = getSingleRouteQueryValue(route.query.penaltyType);
  const severity = getSingleRouteQueryValue(route.query.severity);

  pageState.page = page;
  pageState.filters.status = hasSelectOptionValue(penaltyTemplateStatusOptions, status)
    ? status
    : undefined;
  pageState.filters.targetRole = hasSelectOptionValue(
    penaltyTemplateTargetRoleOptions,
    targetRole,
  )
    ? targetRole
    : undefined;
  pageState.filters.penaltyType = hasSelectOptionValue(
    penaltyTemplateTypeOptions,
    penaltyType,
  )
    ? penaltyType
    : undefined;
  pageState.filters.severity = hasSelectOptionValue(
    penaltyTemplateSeverityOptions,
    severity,
  )
    ? severity
    : undefined;
  pageState.filters.keyword = getSingleRouteQueryValue(route.query.keyword) || undefined;
};

const buildQuery = (): PenaltyTemplateAdminQuery => ({
  page: pageState.page,
  pageSize,
  targetRole: pageState.filters.targetRole,
  penaltyType: pageState.filters.penaltyType,
  severity: pageState.filters.severity,
  isActive: pageState.filters.status === 'ACTIVE'
    ? true
    : pageState.filters.status === 'INACTIVE'
      ? false
      : undefined,
  keyword: pageState.filters.keyword?.trim() || undefined,
});

const buildStatsQuery = (): PenaltyTemplateAdminQuery => ({
  targetRole: pageState.filters.targetRole,
  penaltyType: pageState.filters.penaltyType,
  severity: pageState.filters.severity,
  isActive: pageState.filters.status === 'ACTIVE'
    ? true
    : pageState.filters.status === 'INACTIVE'
      ? false
      : undefined,
  keyword: pageState.filters.keyword?.trim() || undefined,
});

const loadRows = async () => {
  try {
    loading.value = true;
    const [response, statsResponse] = await Promise.all([
      api.petpal.admin.penaltyTemplates(buildQuery()),
      api.petpal.admin.penaltyTemplateStats(buildStatsQuery()),
    ]);
    rows.value = response.items;
    total.value = response.pagination.total;
    statsData.value = statsResponse;
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '加载处罚模板失败'));
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
  pageState.filters.status = undefined;
  pageState.filters.targetRole = undefined;
  pageState.filters.penaltyType = undefined;
  pageState.filters.severity = undefined;
  pageState.filters.keyword = undefined;
  pageState.page = 1;
  await syncRouteAndLoad();
};

const changePage = async (page: number) => {
  pageState.page = page;
  await syncRouteAndLoad();
};

const resetDialog = () => {
  dialogMode.value = 'create';
  editingTemplateId.value = '';
  Object.assign(templateForm, createEmptyForm());
};

const openCreateDialog = () => {
  resetDialog();
  dialogVisible.value = true;
};

const openEditDialog = (template: PenaltyTemplateRecord) => {
  dialogMode.value = 'edit';
  editingTemplateId.value = template.id;
  Object.assign(templateForm, {
    templateCode: template.templateCode,
    templateName: template.templateName,
    description: template.description || '',
    targetRole: template.targetRole ?? undefined,
    penaltyType: template.penaltyType,
    severity: template.severity,
    defaultReason: template.defaultReason,
    actionSummary: template.actionSummary,
    defaultRectifyDays: template.defaultRectifyDays,
  });
  dialogVisible.value = true;
};

const submitTemplate = async () => {
  const templateCode = templateForm.templateCode.trim();
  const templateName = templateForm.templateName.trim();
  const defaultReason = templateForm.defaultReason.trim();
  const actionSummary = templateForm.actionSummary.trim();

  if (!templateCode) {
    ElMessage.error('请填写模板编码');
    return;
  }
  if (!templateName) {
    ElMessage.error('请填写模板名称');
    return;
  }
  if (!defaultReason) {
    ElMessage.error('请填写默认处罚原因');
    return;
  }
  if (!actionSummary) {
    ElMessage.error('请填写默认处罚措施');
    return;
  }

  const payload: UpsertPenaltyTemplatePayload = {
    templateCode,
    templateName,
    description: templateForm.description.trim() || undefined,
    targetRole: templateForm.targetRole,
    penaltyType: templateForm.penaltyType,
    severity: templateForm.severity,
    defaultReason,
    actionSummary,
    defaultRectifyDays: templateForm.defaultRectifyDays ?? undefined,
  };

  try {
    submitting.value = true;
    if (dialogMode.value === 'create') {
      await api.petpal.admin.createPenaltyTemplate(payload);
    } else {
      await api.petpal.admin.updatePenaltyTemplate(editingTemplateId.value, payload);
    }
    dialogVisible.value = false;
    ElMessage.success(dialogMode.value === 'create' ? '处罚模板已创建' : '处罚模板已更新');
    await loadRows();
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, dialogMode.value === 'create' ? '创建处罚模板失败' : '更新处罚模板失败'));
  } finally {
    submitting.value = false;
  }
};

const toggleTemplateStatus = async (template: PenaltyTemplateRecord) => {
  const nextIsActive = !template.isActive;
  try {
    await ElMessageBox.confirm(
      nextIsActive
        ? `确认重新启用模板“${template.templateName}”吗？`
        : `确认停用模板“${template.templateName}”吗？`,
      nextIsActive ? '启用模板' : '停用模板',
      {
        type: nextIsActive ? 'success' : 'warning',
      },
    );

    await api.petpal.admin.togglePenaltyTemplate(template.id, {
      isActive: nextIsActive,
    });
    ElMessage.success(nextIsActive ? '处罚模板已启用' : '处罚模板已停用');
    await loadRows();
  } catch (error: unknown) {
    if (error === 'cancel' || error === 'close') {
      return;
    }
    ElMessage.error(getErrorMessage(error, nextIsActive ? '启用处罚模板失败' : '停用处罚模板失败'));
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
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

.template-title,
.template-type,
.template-usage,
.template-expand__meta {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.template-title span,
.template-usage span,
.template-expand__meta span {
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.template-expand {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.template-expand__section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.template-expand__label {
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.template-expand__section p {
  margin: 0;
  color: var(--el-text-color-primary);
  line-height: 1.6;
  white-space: pre-wrap;
}

.template-form-grid {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

@media (max-width: 768px) {
  .template-form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
