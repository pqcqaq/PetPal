<template>
  <PageScaffold :stats="stats">
    <template #actions>
      <el-space>
        <el-button
          v-permission="'petpal.complaint.manage'"
          type="primary"
          plain
          :disabled="selectedActionableComplaints.length === 0"
          @click="openBatchAssignDialog"
        >
          批量分配
        </el-button>
        <el-button @click="loadRows">刷新</el-button>
      </el-space>
    </template>

    <template #toolbar>
      <el-space wrap>
        <el-select v-model="pageState.filters.status" clearable placeholder="全部状态" style="width: 150px">
          <el-option label="待处理" value="OPEN" />
          <el-option label="处理中" value="PROCESSING" />
          <el-option label="已解决" value="RESOLVED" />
          <el-option label="已驳回" value="REJECTED" />
        </el-select>
        <el-select v-model="pageState.filters.complaintType" clearable placeholder="全部类型" style="width: 160px">
          <el-option label="安全问题" value="SAFETY" />
          <el-option label="费用争议" value="FEE" />
          <el-option label="服务质量" value="SERVICE" />
          <el-option label="欺诈风险" value="FRAUD" />
          <el-option label="其他问题" value="OTHER" />
        </el-select>
        <el-select v-model="pageState.filters.targetRole" clearable placeholder="投诉对象" style="width: 150px">
          <el-option label="照料者" value="CAREGIVER" />
          <el-option label="平台" value="PLATFORM" />
        </el-select>
        <el-select v-model="pageState.filters.slaStatus" clearable placeholder="SLA状态" style="width: 150px">
          <el-option label="正常" value="NORMAL" />
          <el-option label="即将超时" value="DUE_SOON" />
          <el-option label="已超时" value="OVERDUE" />
        </el-select>
        <el-select
          v-model="pageState.filters.assignedAdminId"
          clearable
          placeholder="负责人"
          style="width: 180px"
          :disabled="pageState.filters.unassignedOnly"
        >
          <el-option
            v-for="admin in adminOptions"
            :key="admin.id"
            :label="admin.nickname"
            :value="admin.id"
          />
        </el-select>
        <el-checkbox v-model="pageState.filters.unassignedOnly">仅未指派</el-checkbox>
        <el-button
          v-if="currentAdminId"
          :type="isMineFilterActive ? 'primary' : 'default'"
          plain
          @click="toggleMineOnly"
        >
          {{ isMineFilterActive ? '查看全部' : '我的工单' }}
        </el-button>
        <el-input v-model="pageState.filters.keyword" clearable placeholder="订单号/昵称/描述" style="width: 220px" />
        <el-button type="primary" @click="applyFilters">筛选</el-button>
        <el-button @click="resetFilters">重置</el-button>
      </el-space>
    </template>

    <el-table
      ref="tableRef"
      :data="rows"
      v-loading="loading"
      border
      row-key="id"
      @selection-change="handleSelectionChange"
    >
      <el-table-column type="selection" width="48" :selectable="isSelectableComplaint" />
      <el-table-column type="expand">
        <template #default="scope">
          <div class="complaint-expand">
            <div class="complaint-expand__section">
              <span class="complaint-expand__label">投诉描述</span>
              <p>{{ scope.row.description }}</p>
            </div>
            <div v-if="scope.row.evidenceUrls.length" class="complaint-expand__section">
              <span class="complaint-expand__label">证据材料</span>
              <div class="complaint-expand__links">
                <a
                  v-for="url in scope.row.evidenceUrls"
                  :key="url"
                  :href="url"
                  target="_blank"
                  rel="noreferrer"
                >
                  {{ url }}
                </a>
              </div>
            </div>
            <div class="complaint-expand__section">
              <span class="complaint-expand__label">处理进度</span>
              <div class="complaint-progress">
                <div
                  v-for="log in scope.row.processLogs"
                  :key="log.id"
                  class="complaint-progress__item"
                >
                  <strong>{{ getActionLabel(log.actionType) }}</strong>
                  <span>{{ formatDateTime(log.createdAt) }} · {{ log.operatorNickname || '系统' }}</span>
                  <p v-if="log.note">{{ log.note }}</p>
                </div>
              </div>
            </div>
            <div v-if="scope.row.resultSummary" class="complaint-expand__section">
              <span class="complaint-expand__label">结案结论</span>
              <p>{{ scope.row.resultSummary }}</p>
            </div>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="orderNo" label="订单号" min-width="170" />
      <el-table-column prop="status" label="状态" min-width="110">
        <template #default="scope">
          <el-tag :type="getStatusType(scope.row.status)">{{ getStatusLabel(scope.row.status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="complaintType" label="投诉类型" min-width="120">
        <template #default="scope">{{ getTypeLabel(scope.row.complaintType) }}</template>
      </el-table-column>
      <el-table-column prop="targetRole" label="投诉对象" min-width="110">
        <template #default="scope">{{ getTargetRoleLabel(scope.row.targetRole) }}</template>
      </el-table-column>
      <el-table-column prop="ownerNickname" label="主人" min-width="120" />
      <el-table-column prop="caregiverNickname" label="照料者" min-width="120" />
      <el-table-column prop="assignedAdminNickname" label="负责人" min-width="120">
        <template #default="scope">{{ scope.row.assignedAdminNickname || '未指派' }}</template>
      </el-table-column>
      <el-table-column prop="createdAt" label="发起时间" min-width="180">
        <template #default="scope">{{ formatDateTime(scope.row.createdAt) }}</template>
      </el-table-column>
      <el-table-column label="SLA" min-width="170">
        <template #default="scope">
          <div class="complaint-sla" v-if="scope.row.slaStatus && scope.row.slaDeadlineAt">
            <el-tag :type="getSlaTagType(scope.row.slaStatus)">{{ getSlaStatusLabel(scope.row.slaStatus) }}</el-tag>
            <span>{{ getSlaDeadlineHint(scope.row.slaDeadlineAt, scope.row.slaStatus) }}</span>
          </div>
          <span v-else class="complaint-sla__closed">已结案</span>
        </template>
      </el-table-column>
      <el-table-column label="摘要" min-width="260" show-overflow-tooltip>
        <template #default="scope">{{ scope.row.description }}</template>
      </el-table-column>
      <el-table-column label="操作" width="220" fixed="right">
        <template #default="scope">
          <el-space>
            <el-button
              v-if="canQuickAssignToMe(scope.row)"
              v-permission="'petpal.complaint.manage'"
              link
              type="warning"
              :loading="quickAssigningId === scope.row.id"
              @click="assignComplaintToMe(scope.row)"
            >
              {{ getQuickAssignLabel(scope.row) }}
            </el-button>
            <el-button
              v-permission="'petpal.complaint.manage'"
              link
              type="primary"
              :disabled="isClosedComplaint(scope.row)"
              @click="openActionDialog(scope.row)"
            >
              处理
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
      v-model="batchAssignDialogVisible"
      title="批量分配投诉工单"
      width="520px"
      :close-on-click-modal="!batchAssignSubmitting"
      :close-on-press-escape="!batchAssignSubmitting"
      @closed="resetBatchAssignDialog"
    >
      <el-form label-position="top">
        <el-form-item label="已选工单">
          <div class="complaint-batch-summary">
            已选择 {{ selectedActionableComplaints.length }} 条可处理工单，将统一指派给同一位负责人。
          </div>
        </el-form-item>
        <el-form-item label="负责人">
          <el-select v-model="batchAssignForm.assigneeId" filterable style="width: 100%">
            <el-option
              v-for="admin in adminOptions"
              :key="admin.id"
              :label="admin.nickname"
              :value="admin.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="统一备注">
          <el-input
            v-model="batchAssignForm.note"
            type="textarea"
            :rows="4"
            maxlength="1000"
            show-word-limit
            placeholder="可选：补充本次批量分配的说明"
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button :disabled="batchAssignSubmitting" @click="batchAssignDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="batchAssignSubmitting" @click="submitBatchAssign">提交</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="actionDialogVisible"
      title="处理投诉工单"
      width="560px"
      :close-on-click-modal="!actionSubmitting"
      :close-on-press-escape="!actionSubmitting"
      @closed="resetActionDialog"
    >
      <template v-if="activeComplaint">
        <div class="complaint-dialog__summary">
          <h3>{{ activeComplaint.orderNo }}</h3>
          <p>{{ activeComplaint.ownerNickname }} · {{ activeComplaint.caregiverNickname }} · {{ getStatusLabel(activeComplaint.status) }}</p>
        </div>

        <el-form label-position="top">
          <el-form-item label="处理动作">
            <el-select v-model="actionForm.actionType" style="width: 100%">
              <el-option label="指派负责人" value="ASSIGN" />
              <el-option label="补充调查" value="INVESTIGATE" />
              <el-option label="联系用户" value="CALL_USER" />
              <el-option label="处罚记录" value="PENALTY" />
              <el-option label="结案" value="CLOSE" />
            </el-select>
          </el-form-item>

          <el-form-item v-if="actionForm.actionType === 'ASSIGN'" label="负责人">
            <el-select v-model="actionForm.assigneeId" filterable style="width: 100%">
              <el-option
                v-for="admin in adminOptions"
                :key="admin.id"
                :label="admin.nickname"
                :value="admin.id"
              />
            </el-select>
          </el-form-item>

          <template v-if="actionForm.actionType === 'CLOSE'">
            <el-form-item label="结案结果">
              <el-radio-group v-model="actionForm.resultStatus">
                <el-radio value="RESOLVED">已解决</el-radio>
                <el-radio value="REJECTED">已驳回</el-radio>
              </el-radio-group>
            </el-form-item>
            <el-form-item label="结案结论">
              <el-input
                v-model="actionForm.resultSummary"
                type="textarea"
                :rows="4"
                maxlength="1000"
                show-word-limit
                placeholder="说明处理结果、责任认定和后续动作"
              />
            </el-form-item>
          </template>

          <el-form-item v-else label="处理备注">
            <el-input
              v-model="actionForm.note"
              type="textarea"
              :rows="4"
              maxlength="1000"
              show-word-limit
              :placeholder="actionForm.actionType === 'ASSIGN' ? '可补充指派说明（选填）' : '记录本次处理动作的关键说明'"
            />
          </el-form-item>
        </el-form>
      </template>

      <template #footer>
        <el-button :disabled="actionSubmitting" @click="actionDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="actionSubmitting" @click="submitAction">提交</el-button>
      </template>
    </el-dialog>
  </PageScaffold>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import type {
  ComplaintAdminQuery,
  ComplaintAdminRecord,
  ComplaintAdminSlaStatus,
  ComplaintStatus,
  ComplaintTargetRole,
  ComplaintType,
  ManageComplaintPayload,
  UserRecord,
} from '@rbac/api-common';
import { ElMessage, type TableInstance } from 'element-plus';
import PageScaffold from '@/components/workbench/PageScaffold.vue';
import { usePageState } from '@/composables/use-page-state';
import { api } from '@/api/client';
import { useAuthStore } from '@/stores/auth';
import { getErrorMessage } from '@/utils/errors';

defineOptions({ name: 'ComplaintAdminView' });

definePage({
  viewKey: 'complaint-admin',
  keepAlive: true,
});

type Filters = {
  status?: ComplaintStatus;
  complaintType?: ComplaintType;
  targetRole?: ComplaintTargetRole;
  slaStatus?: ComplaintAdminSlaStatus;
  assignedAdminId?: string;
  unassignedOnly: boolean;
  keyword?: string;
};

type State = {
  page: number;
  filters: Filters;
};

type ActionForm = {
  actionType: ManageComplaintPayload['actionType'];
  assigneeId: string;
  note: string;
  resultStatus: 'RESOLVED' | 'REJECTED';
  resultSummary: string;
};

const pageSize = 10;
const tableRef = ref<TableInstance>();
const rows = ref<ComplaintAdminRecord[]>([]);
const total = ref(0);
const loading = ref(false);
const selectedComplaints = ref<ComplaintAdminRecord[]>([]);
const batchAssignDialogVisible = ref(false);
const batchAssignSubmitting = ref(false);
const actionDialogVisible = ref(false);
const actionSubmitting = ref(false);
const quickAssigningId = ref('');
const activeComplaint = ref<ComplaintAdminRecord | null>(null);
const adminOptions = ref<UserRecord[]>([]);
const auth = useAuthStore();

const { state: pageState } = usePageState<State>('page:petpal:complaint-admin', {
  page: 1,
  filters: {
    status: undefined,
    complaintType: undefined,
    targetRole: undefined,
    slaStatus: undefined,
    assignedAdminId: undefined,
    unassignedOnly: false,
    keyword: undefined,
  },
});

const createEmptyActionForm = (): ActionForm => ({
  actionType: 'ASSIGN',
  assigneeId: '',
  note: '',
  resultStatus: 'RESOLVED',
  resultSummary: '',
});

const actionForm = reactive<ActionForm>(createEmptyActionForm());
const batchAssignForm = reactive({
  assigneeId: '',
  note: '',
});
const currentAdminId = computed(() => auth.user?.id ?? '');
const currentAdminNickname = computed(() => auth.user?.nickname ?? '当前管理员');
const isMineFilterActive = computed(() =>
  Boolean(currentAdminId.value)
  && !pageState.filters.unassignedOnly
  && pageState.filters.assignedAdminId === currentAdminId.value,
);
const selectedActionableComplaints = computed(() =>
  selectedComplaints.value.filter(item => !isClosedComplaint(item)),
);

const stats = computed(() => {
  const openCount = rows.value.filter(item => item.status === 'OPEN').length;
  const processingCount = rows.value.filter(item => item.status === 'PROCESSING').length;
  const closedCount = rows.value.filter(item => item.status === 'RESOLVED' || item.status === 'REJECTED').length;
  const unassignedCount = rows.value.filter(item => !item.assignedAdminId).length;
  const dueSoonCount = rows.value.filter(item => item.slaStatus === 'DUE_SOON').length;
  const overdueCount = rows.value.filter(item => item.slaStatus === 'OVERDUE').length;

  return [
    { label: '当前页工单', value: rows.value.length },
    { label: '待处理', value: openCount },
    { label: '处理中', value: processingCount },
    { label: '已结案', value: closedCount },
    { label: '即将超时', value: dueSoonCount },
    { label: '已超时', value: overdueCount },
    { label: '未指派', value: unassignedCount },
  ];
});

const isClosedComplaint = (complaint: Pick<ComplaintAdminRecord, 'status'>) => {
  return complaint.status === 'RESOLVED' || complaint.status === 'REJECTED';
};

const isSelectableComplaint = (complaint: ComplaintAdminRecord) => {
  return !isClosedComplaint(complaint);
};

const getStatusLabel = (status: ComplaintStatus) => {
  const labels: Record<ComplaintStatus, string> = {
    OPEN: '待处理',
    PROCESSING: '处理中',
    RESOLVED: '已解决',
    REJECTED: '已驳回',
  };
  return labels[status] ?? status;
};

const getStatusType = (status: ComplaintStatus): 'warning' | 'primary' | 'success' | 'info' => {
  const types: Record<ComplaintStatus, 'warning' | 'primary' | 'success' | 'info'> = {
    OPEN: 'warning',
    PROCESSING: 'primary',
    RESOLVED: 'success',
    REJECTED: 'info',
  };
  return types[status] ?? 'info';
};

const getTypeLabel = (type: ComplaintType) => {
  const labels: Record<ComplaintType, string> = {
    SAFETY: '安全问题',
    FEE: '费用争议',
    SERVICE: '服务质量',
    FRAUD: '欺诈风险',
    OTHER: '其他问题',
  };
  return labels[type] ?? type;
};

const getTargetRoleLabel = (role: ComplaintTargetRole) => {
  const labels: Record<ComplaintTargetRole, string> = {
    CAREGIVER: '照料者',
    PLATFORM: '平台',
  };
  return labels[role] ?? role;
};

const getActionLabel = (actionType: ComplaintAdminRecord['processLogs'][number]['actionType']) => {
  const labels: Record<ComplaintAdminRecord['processLogs'][number]['actionType'], string> = {
    OPEN: '发起投诉',
    ASSIGN: '指派负责人',
    INVESTIGATE: '补充调查',
    CALL_USER: '联系用户',
    PENALTY: '处罚记录',
    CLOSE: '结案',
  };
  return labels[actionType] ?? actionType;
};

const getSlaStatusLabel = (status: ComplaintAdminSlaStatus) => {
  const labels: Record<ComplaintAdminSlaStatus, string> = {
    NORMAL: '正常',
    DUE_SOON: '即将超时',
    OVERDUE: '已超时',
  };
  return labels[status] ?? status;
};

const getSlaTagType = (status: ComplaintAdminSlaStatus): 'success' | 'warning' | 'danger' => {
  const types: Record<ComplaintAdminSlaStatus, 'success' | 'warning' | 'danger'> = {
    NORMAL: 'success',
    DUE_SOON: 'warning',
    OVERDUE: 'danger',
  };
  return types[status] ?? 'success';
};

const formatDateTime = (value?: string | null) => {
  if (!value) {
    return '-';
  }
  return new Date(value).toLocaleString('zh-CN', {
    hour12: false,
  });
};

const getSlaDeadlineHint = (deadlineAt: string, status: ComplaintAdminSlaStatus) => {
  const deadline = new Date(deadlineAt);
  const diffMs = deadline.getTime() - Date.now();
  const diffHours = Math.max(1, Math.ceil(Math.abs(diffMs) / (60 * 60 * 1000)));
  const deadlineText = formatDateTime(deadlineAt);

  if (status === 'OVERDUE') {
    return `已超时 ${diffHours} 小时 · 截止 ${deadlineText}`;
  }

  if (status === 'DUE_SOON') {
    return `剩余 ${diffHours} 小时 · 截止 ${deadlineText}`;
  }

  return `截止 ${deadlineText}`;
};

const getQuickAssignLabel = (complaint: ComplaintAdminRecord) => {
  return complaint.assignedAdminId ? '转给我' : '指派给我';
};

const canQuickAssignToMe = (complaint: ComplaintAdminRecord) => {
  return Boolean(currentAdminId.value)
    && !isClosedComplaint(complaint)
    && complaint.assignedAdminId !== currentAdminId.value;
};

const buildQuery = (): ComplaintAdminQuery => ({
  page: pageState.page,
  pageSize,
  status: pageState.filters.status,
  complaintType: pageState.filters.complaintType,
  targetRole: pageState.filters.targetRole,
  slaStatus: pageState.filters.slaStatus,
  assignedAdminId: pageState.filters.unassignedOnly ? undefined : pageState.filters.assignedAdminId || undefined,
  unassignedOnly: pageState.filters.unassignedOnly || undefined,
  keyword: pageState.filters.keyword?.trim() || undefined,
});

const loadAdminOptions = async () => {
  try {
    const response = await api.users.list({
      page: 1,
      pageSize: 100,
    });

    adminOptions.value = response.items
      .filter(user => user.roles.some(role => role.code === 'super-admin' || role.code === 'ops-manager'))
      .sort((left, right) => left.nickname.localeCompare(right.nickname, 'zh-CN'));
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '加载管理员列表失败'));
  }
};

const loadRows = async () => {
  try {
    loading.value = true;
    const response = await api.petpal.admin.complaints(buildQuery());
    rows.value = response.items;
    total.value = response.pagination.total;
    selectedComplaints.value = [];
    tableRef.value?.clearSelection();
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '加载投诉工单失败'));
  } finally {
    loading.value = false;
  }
};

const handleSelectionChange = (selection: ComplaintAdminRecord[]) => {
  selectedComplaints.value = selection;
};

const applyFilters = async () => {
  pageState.page = 1;
  await loadRows();
};

const toggleMineOnly = async () => {
  if (!currentAdminId.value) {
    return;
  }

  pageState.page = 1;
  if (isMineFilterActive.value) {
    pageState.filters.assignedAdminId = undefined;
  } else {
    pageState.filters.unassignedOnly = false;
    pageState.filters.assignedAdminId = currentAdminId.value;
  }

  await loadRows();
};

const resetFilters = async () => {
  pageState.filters.status = undefined;
  pageState.filters.complaintType = undefined;
  pageState.filters.targetRole = undefined;
  pageState.filters.slaStatus = undefined;
  pageState.filters.assignedAdminId = undefined;
  pageState.filters.unassignedOnly = false;
  pageState.filters.keyword = undefined;
  pageState.page = 1;
  await loadRows();
};

const changePage = async (page: number) => {
  pageState.page = page;
  await loadRows();
};

const resetBatchAssignDialog = () => {
  batchAssignForm.assigneeId = '';
  batchAssignForm.note = '';
};

const resetActionDialog = () => {
  activeComplaint.value = null;
  Object.assign(actionForm, createEmptyActionForm());
};

const openBatchAssignDialog = () => {
  if (selectedActionableComplaints.value.length === 0) {
    ElMessage.warning('请先选择至少一条可处理的投诉工单');
    return;
  }

  resetBatchAssignDialog();
  batchAssignDialogVisible.value = true;
};

const openActionDialog = (complaint: ComplaintAdminRecord) => {
  activeComplaint.value = complaint;
  Object.assign(actionForm, createEmptyActionForm(), {
    assigneeId: complaint.assignedAdminId ?? '',
    actionType: complaint.assignedAdminId ? 'INVESTIGATE' : 'ASSIGN',
  });
  actionDialogVisible.value = true;
};

const assignComplaintToMe = async (complaint: ComplaintAdminRecord) => {
  if (!currentAdminId.value || !canQuickAssignToMe(complaint)) {
    return;
  }

  try {
    quickAssigningId.value = complaint.id;
    await api.petpal.admin.handleComplaint(complaint.id, {
      actionType: 'ASSIGN',
      assigneeId: currentAdminId.value,
      note: complaint.assignedAdminId
        ? `工单已转交给 ${currentAdminNickname.value}`
        : `工单已指派给 ${currentAdminNickname.value}`,
    });
    ElMessage.success(complaint.assignedAdminId ? '投诉工单已转交给你' : '投诉工单已指派给你');
    await loadRows();
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '快捷接手投诉工单失败'));
  } finally {
    quickAssigningId.value = '';
  }
};

const submitBatchAssign = async () => {
  if (selectedActionableComplaints.value.length === 0) {
    ElMessage.warning('请先选择至少一条可处理的投诉工单');
    return;
  }

  const assigneeId = batchAssignForm.assigneeId.trim();
  if (!assigneeId) {
    ElMessage.error('请选择负责人');
    return;
  }

  const note = batchAssignForm.note.trim() || undefined;
  try {
    batchAssignSubmitting.value = true;
    const results = await Promise.allSettled(
      selectedActionableComplaints.value.map(item =>
        api.petpal.admin.handleComplaint(item.id, {
          actionType: 'ASSIGN',
          assigneeId,
          note,
        }),
      ),
    );

    const successCount = results.filter(item => item.status === 'fulfilled').length;
    const failedCount = results.length - successCount;

    if (successCount === 0) {
      throw (results.find(item => item.status === 'rejected') as PromiseRejectedResult | undefined)?.reason
        ?? new Error('批量分配失败');
    }

    batchAssignDialogVisible.value = false;
    if (failedCount === 0) {
      ElMessage.success(`已完成 ${successCount} 条投诉工单分配`);
    } else {
      ElMessage.warning(`已完成 ${successCount} 条投诉工单分配，另有 ${failedCount} 条失败`);
    }
    await loadRows();
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '批量分配投诉工单失败'));
  } finally {
    batchAssignSubmitting.value = false;
  }
};

const submitAction = async () => {
  if (!activeComplaint.value) {
    return;
  }

  const payload: ManageComplaintPayload = {
    actionType: actionForm.actionType,
  };

  if (actionForm.actionType === 'ASSIGN') {
    if (!actionForm.assigneeId) {
      ElMessage.error('请选择负责人');
      return;
    }
    payload.assigneeId = actionForm.assigneeId;
    payload.note = actionForm.note.trim() || undefined;
  } else if (actionForm.actionType === 'CLOSE') {
    const resultSummary = actionForm.resultSummary.trim();
    if (!resultSummary) {
      ElMessage.error('请填写结案结论');
      return;
    }
    payload.resultStatus = actionForm.resultStatus;
    payload.resultSummary = resultSummary;
  } else {
    const note = actionForm.note.trim();
    if (!note) {
      ElMessage.error('请填写处理备注');
      return;
    }
    payload.note = note;
  }

  try {
    actionSubmitting.value = true;
    await api.petpal.admin.handleComplaint(activeComplaint.value.id, payload);
    actionDialogVisible.value = false;
    ElMessage.success('投诉工单已更新');
    await loadRows();
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '更新投诉工单失败'));
  } finally {
    actionSubmitting.value = false;
  }
};

onMounted(async () => {
  await Promise.all([
    loadAdminOptions(),
    loadRows(),
  ]);
});
</script>

<style scoped lang="scss">
.table-footer {
  margin-top: 12px;
  display: flex;
  justify-content: flex-end;
}

.complaint-expand {
  display: grid;
  gap: 14px;
  padding: 6px 8px;
}

.complaint-expand__section {
  display: grid;
  gap: 8px;
}

.complaint-expand__label {
  font-size: 12px;
  font-weight: 600;
  color: #667085;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.complaint-expand__section p {
  margin: 0;
  color: #344054;
  line-height: 1.7;
}

.complaint-expand__links {
  display: grid;
  gap: 6px;
}

.complaint-expand__links a {
  color: #2563eb;
  text-decoration: none;
  word-break: break-all;
}

.complaint-progress {
  display: grid;
  gap: 10px;
}

.complaint-progress__item {
  display: grid;
  gap: 4px;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid #e4e7ec;
  background: #f8fafc;
}

.complaint-progress__item strong {
  color: #1d2939;
}

.complaint-progress__item span {
  color: #667085;
  font-size: 13px;
}

.complaint-dialog__summary {
  margin-bottom: 12px;
  padding: 14px 16px;
  border-radius: 14px;
  background: linear-gradient(180deg, #fffaf0 0%, #f8fbff 100%);
  border: 1px solid #e4e7ec;
}

.complaint-dialog__summary h3 {
  margin: 0;
  color: #101828;
}

.complaint-dialog__summary p {
  margin: 6px 0 0;
  color: #667085;
}

.complaint-batch-summary {
  padding: 12px 14px;
  border-radius: 12px;
  background: #f8fafc;
  border: 1px solid #e4e7ec;
  color: #344054;
  line-height: 1.7;
}

.complaint-sla {
  display: grid;
  gap: 6px;
}

.complaint-sla span,
.complaint-sla__closed {
  color: #667085;
  font-size: 12px;
  line-height: 1.6;
}
</style>
