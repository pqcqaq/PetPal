<template>
  <PageScaffold :stats="stats">
    <template #actions>
      <el-space>
        <el-button
          v-permission="'petpal.rule.publish'"
          type="primary"
          plain
          @click="openCreateDialog"
        >
          新建规则
        </el-button>
        <el-button @click="loadRows">刷新</el-button>
      </el-space>
    </template>

    <template #toolbar>
      <el-space wrap>
        <el-select v-model="pageState.filters.status" clearable placeholder="全部状态" style="width: 160px">
          <el-option
            v-for="item in platformRuleStatusOptions"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
        <el-input v-model="pageState.filters.keyword" clearable placeholder="编码/名称/版本/内容关键词" style="width: 260px" />
        <el-button type="primary" @click="applyFilters">筛选</el-button>
        <el-button @click="resetFilters">重置</el-button>
      </el-space>
    </template>

    <el-table :data="rows" v-loading="loading" border row-key="id">
      <el-table-column type="expand">
        <template #default="scope">
          <div class="platform-rule-expand">
            <div class="platform-rule-expand__meta">
              <strong>{{ scope.row.ruleCode }}</strong>
              <span>{{ scope.row.ruleVersion }}</span>
              <span>{{ formatDateTime(scope.row.effectiveAt) }}</span>
            </div>
            <pre class="platform-rule-expand__content">{{ scope.row.contentMd }}</pre>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="ruleCode" label="规则编码" min-width="160" />
      <el-table-column label="规则信息" min-width="240">
        <template #default="scope">
          <div class="platform-rule-title">
            <strong>{{ scope.row.ruleName }}</strong>
            <span>版本 {{ scope.row.ruleVersion }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="status" label="状态" min-width="110">
        <template #default="scope">
          <el-tag :type="getStatusTagType(scope.row.status)">{{ getStatusLabel(scope.row.status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="生效时间" min-width="180">
        <template #default="scope">
          <div class="platform-rule-effective">
            <strong>{{ formatDateTime(scope.row.effectiveAt) }}</strong>
            <span>{{ getEffectiveStateLabel(scope.row) }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="内容摘要" min-width="320" show-overflow-tooltip>
        <template #default="scope">{{ getRulePreview(scope.row.contentMd) }}</template>
      </el-table-column>
      <el-table-column label="创建人" min-width="120">
        <template #default="scope">{{ scope.row.creatorNickname || '系统' }}</template>
      </el-table-column>
      <el-table-column label="最近更新" min-width="180">
        <template #default="scope">{{ formatDateTime(scope.row.updatedAt) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="220" fixed="right">
        <template #default="scope">
          <el-space>
            <el-button
              v-if="scope.row.status === 'DRAFT'"
              v-permission="'petpal.rule.publish'"
              link
              type="primary"
              @click="openEditDialog(scope.row)"
            >
              编辑
            </el-button>
            <el-button
              v-if="scope.row.status === 'DRAFT'"
              v-permission="'petpal.rule.publish'"
              link
              type="success"
              @click="publishRule(scope.row)"
            >
              发布
            </el-button>
            <el-button
              v-if="scope.row.status !== 'ARCHIVED'"
              v-permission="'petpal.rule.publish'"
              link
              type="danger"
              @click="archiveRule(scope.row)"
            >
              归档
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
      :title="dialogMode === 'create' ? '新建平台规则' : '编辑平台规则'"
      width="760px"
      :close-on-click-modal="!submitting"
      :close-on-press-escape="!submitting"
      @closed="resetDialog"
    >
      <el-form label-position="top">
        <div class="platform-rule-form-grid">
          <el-form-item label="规则编码">
            <el-input
              v-model="ruleForm.ruleCode"
              maxlength="50"
              placeholder="例如 SERVICE_STANDARD"
              :disabled="dialogMode === 'edit'"
            />
          </el-form-item>
          <el-form-item label="规则版本">
            <el-input v-model="ruleForm.ruleVersion" maxlength="20" placeholder="例如 v1.0.0" />
          </el-form-item>
        </div>
        <el-form-item label="规则名称">
          <el-input v-model="ruleForm.ruleName" maxlength="100" placeholder="例如 服务标准与履约承诺" />
        </el-form-item>
        <el-form-item label="生效时间">
          <el-date-picker
            v-model="ruleForm.effectiveAt"
            type="datetime"
            placeholder="选择规则生效时间"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="规则内容">
          <el-input
            v-model="ruleForm.contentMd"
            type="textarea"
            :rows="12"
            maxlength="20000"
            show-word-limit
            placeholder="使用 Markdown 维护规则正文、处罚说明和适用范围。"
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-space>
          <el-button :disabled="submitting" @click="dialogVisible = false">取消</el-button>
          <el-button type="primary" :loading="submitting" @click="submitRule">
            {{ dialogMode === 'create' ? '保存草稿' : '保存修改' }}
          </el-button>
        </el-space>
      </template>
    </el-dialog>
  </PageScaffold>
</template>

<script setup lang="ts">
import type {
  PlatformRuleAdminQuery,
  PlatformRuleAdminStats,
  PlatformRuleRecord,
  PlatformRuleStatus,
  UpsertPlatformRulePayload,
} from '@rbac/api-common';
import { ElMessage, ElMessageBox } from 'element-plus';
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
  getPlatformRuleStatusLabel,
  getPlatformRuleStatusTagType,
  platformRuleStatusOptions,
} from './platform-rule-options';

defineOptions({ name: 'PetPalPlatformRulesView' });

definePage({
  viewKey: 'petpal-platform-rules',
  keepAlive: true,
});

type Filters = {
  status?: PlatformRuleStatus;
  keyword?: string;
};

type State = {
  page: number;
  filters: Filters;
};

type RuleFormState = {
  ruleCode: string;
  ruleName: string;
  ruleVersion: string;
  effectiveAt: Date | null;
  contentMd: string;
};

const rows = ref<PlatformRuleRecord[]>([]);
const summary = ref<PlatformRuleAdminStats | null>(null);
const loading = ref(false);
const total = ref(0);
const pageSize = 10;
const dialogVisible = ref(false);
const dialogMode = ref<'create' | 'edit'>('create');
const submitting = ref(false);
const editingRule = ref<PlatformRuleRecord | null>(null);
const route = useRoute();
const router = useRouter();

const createEmptyRuleForm = (): RuleFormState => ({
  ruleCode: '',
  ruleName: '',
  ruleVersion: '',
  effectiveAt: null,
  contentMd: '',
});

const ruleForm = reactive<RuleFormState>(createEmptyRuleForm());

const { state: pageState, reset: resetPageState } = usePageState<State>('page:petpal:platform-rules', {
  page: 1,
  filters: {
    status: undefined,
    keyword: undefined,
  },
});

const routeFilterKeys = ['page', 'status', 'keyword'] as const;

const stats = computed(() => {
  const statsSnapshot = summary.value;

  return [
    { label: '草稿', value: statsSnapshot?.byStatus.DRAFT ?? 0 },
    { label: '已发布', value: statsSnapshot?.byStatus.PUBLISHED ?? 0 },
    { label: '已生效', value: statsSnapshot?.currentEffectiveCount ?? 0 },
    { label: '已归档', value: statsSnapshot?.byStatus.ARCHIVED ?? 0 },
  ];
});

const getStatusLabel = getPlatformRuleStatusLabel;
const getStatusTagType = getPlatformRuleStatusTagType;

const formatDateTime = (value: string) => new Date(value).toLocaleString('zh-CN', { hour12: false });

const getEffectiveStateLabel = (rule: PlatformRuleRecord) => {
  if (rule.status === 'ARCHIVED') {
    return '已归档';
  }

  if (rule.status === 'DRAFT') {
    return '待发布';
  }

  return new Date(rule.effectiveAt).getTime() <= Date.now() ? '已生效' : '待生效';
};

const getRulePreview = (contentMd: string) => {
  const normalized = contentMd.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return '暂无规则内容';
  }

  return normalized.length > 96 ? `${normalized.slice(0, 96)}...` : normalized;
};

const buildRouteQuery = () => {
  const query: Record<string, string> = {};

  if (pageState.page > 1) {
    query.page = String(pageState.page);
  }

  if (pageState.filters.status) {
    query.status = pageState.filters.status;
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

  const status = getSingleRouteQueryValue(route.query.status);

  pageState.page = parsePositiveIntegerRouteQuery(route.query.page);
  pageState.filters.status = hasSelectOptionValue(platformRuleStatusOptions, status)
    ? status
    : undefined;
  pageState.filters.keyword = getSingleRouteQueryValue(route.query.keyword) || undefined;
};

const buildQuery = (): PlatformRuleAdminQuery => ({
  page: pageState.page,
  pageSize,
  status: pageState.filters.status,
  keyword: pageState.filters.keyword?.trim() || undefined,
});

const buildStatsQuery = (): PlatformRuleAdminQuery => ({
  status: pageState.filters.status,
  keyword: pageState.filters.keyword?.trim() || undefined,
});

const loadRows = async () => {
  try {
    loading.value = true;
    const [pageResponse, statsResponse] = await Promise.all([
      api.petpal.admin.rules(buildQuery()),
      api.petpal.admin.ruleStats(buildStatsQuery()),
    ]);
    rows.value = pageResponse.items;
    total.value = pageResponse.pagination.total;
    summary.value = statsResponse;
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '加载平台规则失败'));
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

const resetDialog = () => {
  editingRule.value = null;
  Object.assign(ruleForm, createEmptyRuleForm());
};

const openCreateDialog = () => {
  dialogMode.value = 'create';
  resetDialog();
  dialogVisible.value = true;
};

const openEditDialog = (rule: PlatformRuleRecord) => {
  dialogMode.value = 'edit';
  editingRule.value = rule;
  Object.assign(ruleForm, {
    ruleCode: rule.ruleCode,
    ruleName: rule.ruleName,
    ruleVersion: rule.ruleVersion,
    effectiveAt: new Date(rule.effectiveAt),
    contentMd: rule.contentMd,
  } satisfies RuleFormState);
  dialogVisible.value = true;
};

const buildPayload = (): UpsertPlatformRulePayload | null => {
  if (!ruleForm.effectiveAt) {
    ElMessage.warning('请选择规则生效时间');
    return null;
  }

  const payload: UpsertPlatformRulePayload = {
    ruleCode: ruleForm.ruleCode.trim(),
    ruleName: ruleForm.ruleName.trim(),
    ruleVersion: ruleForm.ruleVersion.trim(),
    contentMd: ruleForm.contentMd.trim(),
    effectiveAt: ruleForm.effectiveAt.toISOString(),
  };

  if (!payload.ruleCode || !payload.ruleName || !payload.ruleVersion || !payload.contentMd) {
    ElMessage.warning('请完整填写规则编码、名称、版本和内容');
    return null;
  }

  return payload;
};

const submitRule = async () => {
  const payload = buildPayload();
  if (!payload) {
    return;
  }

  try {
    submitting.value = true;

    if (dialogMode.value === 'create') {
      await api.petpal.admin.createRule(payload);
      ElMessage.success('规则草稿已创建');
    } else if (editingRule.value) {
      await api.petpal.admin.updateRule(editingRule.value.id, payload);
      ElMessage.success('规则草稿已更新');
    }

    dialogVisible.value = false;
    await loadRows();
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '保存平台规则失败'));
  } finally {
    submitting.value = false;
  }
};

const publishRule = async (rule: PlatformRuleRecord) => {
  try {
    await ElMessageBox.confirm(
      `确认发布规则「${rule.ruleName} ${rule.ruleVersion}」吗？发布后该版本会进入已发布状态。`,
      '发布平台规则',
      {
        type: 'warning',
        confirmButtonText: '确认发布',
        cancelButtonText: '取消',
      },
    );

    await api.petpal.admin.publishRule(rule.id);
    ElMessage.success('平台规则已发布');
    await loadRows();
  } catch (error: unknown) {
    if (error === 'cancel') {
      return;
    }
    ElMessage.error(getErrorMessage(error, '发布平台规则失败'));
  }
};

const archiveRule = async (rule: PlatformRuleRecord) => {
  try {
    await ElMessageBox.confirm(
      `确认归档规则「${rule.ruleName} ${rule.ruleVersion}」吗？归档后该版本将只保留追溯用途。`,
      '归档平台规则',
      {
        type: 'warning',
        confirmButtonText: '确认归档',
        cancelButtonText: '取消',
      },
    );

    await api.petpal.admin.archiveRule(rule.id);
    ElMessage.success('平台规则已归档');
    await loadRows();
  } catch (error: unknown) {
    if (error === 'cancel') {
      return;
    }
    ElMessage.error(getErrorMessage(error, '归档平台规则失败'));
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

.platform-rule-title,
.platform-rule-effective {
  display: grid;
  gap: 4px;
}

.platform-rule-title strong,
.platform-rule-effective strong {
  color: #1f2937;
}

.platform-rule-title span,
.platform-rule-effective span,
.platform-rule-expand__meta span {
  color: #6b7280;
  font-size: 12px;
}

.platform-rule-expand {
  display: grid;
  gap: 12px;
  padding: 8px 0;
}

.platform-rule-expand__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.platform-rule-expand__content {
  margin: 0;
  padding: 14px 16px;
  border-radius: 16px;
  background: #f6faf8;
  color: #183e39;
  font-family: 'Cascadia Code', 'Consolas', monospace;
  font-size: 13px;
  line-height: 1.65;
  white-space: pre-wrap;
  word-break: break-word;
}

.platform-rule-form-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

@media (max-width: 768px) {
  .platform-rule-form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
