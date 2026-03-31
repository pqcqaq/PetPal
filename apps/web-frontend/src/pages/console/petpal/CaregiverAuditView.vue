<template>
  <PageScaffold :stats="stats">
    <template #actions>
      <el-space>
        <el-button @click="loadRows">刷新</el-button>
      </el-space>
    </template>

    <template #toolbar>
      <el-space wrap>
        <el-select v-model="pageState.filters.auditStatus" clearable placeholder="全部状态" style="width: 180px">
          <el-option label="待审核" value="PENDING" />
          <el-option label="已通过" value="APPROVED" />
          <el-option label="已拒绝" value="REJECTED" />
        </el-select>
        <el-input v-model="pageState.filters.city" clearable placeholder="服务城市" style="width: 180px" />
        <el-input v-model="pageState.filters.keyword" clearable placeholder="昵称/简介关键字" style="width: 220px" />
        <el-button type="primary" @click="applyFilters">筛选</el-button>
      </el-space>
    </template>

    <el-table :data="rows" v-loading="loading" border>
      <el-table-column prop="nickname" label="照料者" min-width="140" />
      <el-table-column prop="serviceCity" label="城市" min-width="100">
        <template #default="scope">{{ scope.row.serviceCity || '-' }}</template>
      </el-table-column>
      <el-table-column prop="experienceYears" label="经验(年)" min-width="100" />
      <el-table-column prop="serviceRadiusKm" label="半径(km)" min-width="100" />
      <el-table-column prop="serviceCount" label="服务项" min-width="80" />
      <el-table-column prop="auditStatus" label="审核状态" min-width="120">
        <template #default="scope">
          <el-tag :type="statusTagType(scope.row.auditStatus)">{{ scope.row.auditStatus }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="intro" label="简介" min-width="240" show-overflow-tooltip>
        <template #default="scope">{{ scope.row.intro || '-' }}</template>
      </el-table-column>
      <el-table-column label="操作" width="220" fixed="right">
        <template #default="scope">
          <el-space>
            <el-button link type="success" @click="audit(scope.row.id, 'APPROVED')">通过</el-button>
            <el-button link type="danger" @click="audit(scope.row.id, 'REJECTED')">拒绝</el-button>
            <el-button link type="warning" @click="audit(scope.row.id, 'PENDING')">重置</el-button>
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
  </PageScaffold>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { CaregiverAuditListItem, CaregiverAuditQuery, CaregiverAuditStatus } from '@rbac/api-common';
import { ElMessage } from 'element-plus';
import { useRoute, useRouter } from 'vue-router';
import PageScaffold from '@/components/workbench/PageScaffold.vue';
import { usePageState } from '@/composables/use-page-state';
import { api } from '@/api/client';
import { getErrorMessage } from '@/utils/errors';

defineOptions({ name: 'CaregiverAuditView' });

definePage({
  viewKey: 'caregiver-audit',
  keepAlive: true,
});

type Filters = {
  auditStatus?: CaregiverAuditStatus;
  city?: string;
  keyword?: string;
};

type State = {
  page: number;
  filters: Filters;
};

const rows = ref<CaregiverAuditListItem[]>([]);
const loading = ref(false);
const total = ref(0);
const pageSize = 10;
const route = useRoute();
const router = useRouter();

const { state: pageState } = usePageState<State>('page:petpal:caregiver-audit', {
  page: 1,
  filters: {
    auditStatus: undefined,
    city: undefined,
    keyword: undefined,
  },
});

const stats = computed(() => {
  const pending = rows.value.filter(item => item.auditStatus === 'PENDING').length;
  const approved = rows.value.filter(item => item.auditStatus === 'APPROVED').length;
  const rejected = rows.value.filter(item => item.auditStatus === 'REJECTED').length;

  return [
    { label: '当前页总数', value: rows.value.length },
    { label: '待审核', value: pending },
    { label: '已通过', value: approved },
    { label: '已拒绝', value: rejected },
  ];
});

const statusTagType = (status: CaregiverAuditStatus) => {
  if (status === 'APPROVED') {
    return 'success';
  }
  if (status === 'REJECTED') {
    return 'danger';
  }
  return 'warning';
};

const routeFilterKeys = ['page', 'auditStatus', 'city', 'keyword'] as const;

const getSingleQueryValue = (value: unknown) => {
  if (typeof value === 'string') {
    return value.trim();
  }
  return '';
};

const normalizeRouteQuery = (query: Record<string, unknown>) => Object.entries(query)
  .reduce<Record<string, string>>((acc, [key, value]) => {
    if (typeof value === 'string' && value.trim()) {
      acc[key] = value.trim();
    }
    return acc;
  }, {});

const buildRouteQuery = () => {
  const query: Record<string, string> = {};
  if (pageState.page > 1) {
    query.page = String(pageState.page);
  }
  if (pageState.filters.auditStatus) {
    query.auditStatus = pageState.filters.auditStatus;
  }
  if (pageState.filters.city?.trim()) {
    query.city = pageState.filters.city.trim();
  }
  if (pageState.filters.keyword?.trim()) {
    query.keyword = pageState.filters.keyword.trim();
  }
  return query;
};

const hydrateStateFromRoute = () => {
  const hasKnownQuery = routeFilterKeys.some((key) => typeof route.query[key] === 'string');
  if (!hasKnownQuery) {
    return;
  }

  const auditStatus = getSingleQueryValue(route.query.auditStatus);
  const page = Number.parseInt(getSingleQueryValue(route.query.page), 10);

  pageState.page = Number.isFinite(page) && page > 0 ? page : 1;
  pageState.filters.auditStatus = ['PENDING', 'APPROVED', 'REJECTED'].includes(auditStatus)
    ? auditStatus as CaregiverAuditStatus
    : undefined;
  pageState.filters.city = getSingleQueryValue(route.query.city) || undefined;
  pageState.filters.keyword = getSingleQueryValue(route.query.keyword) || undefined;
};

const buildQuery = (): CaregiverAuditQuery => ({
  page: pageState.page,
  pageSize,
  auditStatus: pageState.filters.auditStatus,
  city: pageState.filters.city?.trim() || undefined,
  keyword: pageState.filters.keyword?.trim() || undefined,
});

const loadRows = async () => {
  try {
    loading.value = true;
    const response = await api.petpal.admin.caregiverAudits(buildQuery());
    rows.value = response.items;
    total.value = response.pagination.total;
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '加载照料者审核列表失败'));
  } finally {
    loading.value = false;
  }
};

const audit = async (caregiverId: string, status: CaregiverAuditStatus) => {
  try {
    await api.petpal.admin.auditCaregiver(caregiverId, { status });
    ElMessage.success('审核状态已更新');
    await loadRows();
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '更新审核状态失败'));
  }
};

const syncRouteAndLoad = async () => {
  const nextQuery = buildRouteQuery();
  const currentQuery = normalizeRouteQuery(route.query as Record<string, unknown>);
  const nextSnapshot = JSON.stringify(Object.entries(nextQuery).sort(([left], [right]) => left.localeCompare(right)));
  const currentSnapshot = JSON.stringify(Object.entries(currentQuery).sort(([left], [right]) => left.localeCompare(right)));

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

const changePage = async (page: number) => {
  pageState.page = page;
  await syncRouteAndLoad();
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
</style>
