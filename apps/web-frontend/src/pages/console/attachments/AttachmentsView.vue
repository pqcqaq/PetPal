<template>
  <PageScaffold :stats="pageStats">
    <template #actions>
      <el-space v-if="isListMode">
        <el-button @click="loadData">刷新</el-button>
        <ListExportButton :request="buildExportRequest" error-message="导出附件失败" />
        <el-button v-if="canUpload" type="primary" @click="openUpload">上传附件</el-button>
      </el-space>

      <el-space v-else>
        <el-button @click="openList">返回附件清单</el-button>
        <el-button @click="refreshCurrentScreen">刷新当前页</el-button>
        <el-button v-if="isDetailMode && canEdit && activeAttachmentId" type="primary" @click="openEditById">
          编辑标签
        </el-button>
        <el-button v-if="isUploadMode" type="primary" :loading="uploading" @click="submitUpload">
          开始上传
        </el-button>
        <el-button v-if="isEditMode" type="primary" :loading="saving" @click="submitEdit">
          保存修改
        </el-button>
      </el-space>
    </template>

    <template v-if="isListMode" #toolbar>
      <AttachmentToolbar
        :filters="pageState.filters"
        @apply="applyFilters"
        @reset="resetFilters"
      />
    </template>

    <SurfacePanel
      :caption="screenHeader.caption"
      :title="screenHeader.title"
      :description="screenHeader.description"
    >
      <div v-if="screenHeader.meta.length" class="attachments-screen__meta">
        <div v-for="item in screenHeader.meta" :key="item.label" class="attachments-screen__meta-item">
          <span>{{ item.label }}</span>
          <strong>{{ item.value }}</strong>
        </div>
      </div>
    </SurfacePanel>

    <AttachmentsTable
      v-if="isListMode"
      :attachments="attachments"
      :loading="loading"
      :total="total"
      :page="pageState.page"
      :page-size="pageSize"
      :context-menu-items="attachmentContextMenuItems"
      @detail="openDetail"
      @edit="openEdit"
      @delete="removeAttachment"
      @open-link="openAttachmentLink"
      @page-change="changePage"
    />

    <SurfacePanel
      v-else-if="isUploadMode"
      caption="上传附件"
      title="上传任务只在这里完成"
      description="上传页只保留选文件、标签和进度，不再用弹窗阻断列表上下文。"
    >
      <el-form label-position="top" class="page-form-grid">
        <el-form-item label="选择文件" class="page-form-grid__full">
          <input
            ref="fileInput"
            type="file"
            class="attachments-screen__hidden-input"
            @change="onFileChange"
          />
          <div class="attachments-screen__picker">
            <el-button @click="openFilePicker">选择文件</el-button>
            <el-button v-if="uploadForm.file" link type="danger" @click="clearFile">移除</el-button>
          </div>
          <div v-if="uploadForm.file" class="attachments-screen__file-summary">
            <strong>{{ uploadForm.file.name }}</strong>
            <span>{{ uploadForm.file.type || 'application/octet-stream' }}</span>
            <span>{{ formatAttachmentSize(uploadForm.file.size) }}</span>
          </div>
          <div v-else class="attachments-screen__file-summary is-empty">请选择要上传的文件</div>
        </el-form-item>

        <el-form-item label="Tag1">
          <el-input v-model="uploadForm.tag1" maxlength="64" placeholder="业务标签 1" />
        </el-form-item>

        <el-form-item label="Tag2">
          <el-input v-model="uploadForm.tag2" maxlength="64" placeholder="业务标签 2" />
        </el-form-item>

        <el-form-item v-if="uploadProgress !== null" label="上传进度" class="page-form-grid__full">
          <el-progress :percentage="uploadProgress" :status="uploadProgress >= 100 ? 'success' : undefined" />
        </el-form-item>
      </el-form>
    </SurfacePanel>

    <SurfacePanel
      v-else-if="isDetailMode"
      caption="附件详情"
      title="文件属性与访问地址"
      description="详情页展示文件属性、业务引用和访问地址，删除风险在这里一次说清。"
    >
      <div v-loading="panelLoading" class="detail-stack">
        <template v-if="selectedAttachment">
          <section class="detail-section">
            <div class="detail-section__header">
              <div>
                <p class="panel-caption">Attachment</p>
                <h3 class="panel-heading panel-heading--md">{{ selectedAttachment.originalName }}</h3>
                <p class="muted">
                  {{ resolveAttachmentKindLabel(selectedAttachment.kind) }} ·
                  {{ resolveAttachmentStatusLabel(selectedAttachment.uploadStatus) }}
                </p>
              </div>
              <el-space wrap>
                <el-tag :type="resolveAttachmentStatusType(selectedAttachment.uploadStatus)" round>
                  {{ resolveAttachmentStatusLabel(selectedAttachment.uploadStatus) }}
                </el-tag>
                <el-button v-if="selectedAttachment.url" link @click="openAttachmentLink(selectedAttachment)">打开附件</el-button>
                <el-button v-if="selectedAttachment.url" link @click="copyAttachmentLink(selectedAttachment)">复制链接</el-button>
                <el-button v-if="canEdit" link @click="openEditById">编辑标签</el-button>
                <el-button
                  v-if="canDelete"
                  link
                  type="danger"
                  :disabled="selectedAttachment.referenceCount > 0"
                  @click="removeAttachment(selectedAttachment)"
                >
                  删除
                </el-button>
              </el-space>
            </div>

            <div class="detail-kv-grid">
              <div class="detail-kv">
                <span>类型</span>
                <strong>{{ resolveAttachmentKindLabel(selectedAttachment.kind) }}</strong>
              </div>
              <div class="detail-kv">
                <span>大小</span>
                <strong>{{ formatAttachmentSize(selectedAttachment.size) }}</strong>
              </div>
              <div class="detail-kv">
                <span>MIME</span>
                <strong>{{ selectedAttachment.mimeType }}</strong>
              </div>
              <div class="detail-kv">
                <span>存储</span>
                <strong>{{ selectedAttachment.storageProvider.toUpperCase() }}</strong>
              </div>
              <div class="detail-kv">
                <span>Tag1</span>
                <strong>{{ selectedAttachment.tag1 || '未设置' }}</strong>
              </div>
              <div class="detail-kv">
                <span>Tag2</span>
                <strong>{{ selectedAttachment.tag2 || '未设置' }}</strong>
              </div>
              <div class="detail-kv">
                <span>上传人</span>
                <strong>{{ selectedAttachment.owner.nickname }} · {{ selectedAttachment.owner.username }}</strong>
              </div>
              <div class="detail-kv">
                <span>上传时间</span>
                <strong>{{ formatTime(selectedAttachment.createdAt) }}</strong>
              </div>
              <div class="detail-kv">
                <span>完成时间</span>
                <strong>{{ selectedAttachment.completedAt ? formatTime(selectedAttachment.completedAt) : '未完成' }}</strong>
              </div>
              <div class="detail-kv">
                <span>对象键</span>
                <strong>{{ selectedAttachment.objectKey }}</strong>
              </div>
            </div>
          </section>

          <section class="detail-section">
            <div class="detail-section__header">
              <div>
                <p class="panel-caption">References</p>
                <h3 class="panel-heading panel-heading--md">业务引用</h3>
              </div>
            </div>
            <div v-if="selectedAttachment.references.length" class="detail-reference-list">
              <article
                v-for="reference in selectedAttachment.references"
                :key="`${reference.kind}-${reference.entityId}`"
                class="detail-reference-card"
              >
                <div class="detail-reference-card__meta">
                  <el-tag type="danger" effect="light" round>
                    {{ resolveAttachmentReferenceKindLabel(reference.kind) }}
                  </el-tag>
                  <span>{{ reference.entityId }}</span>
                </div>
                <strong>{{ reference.title }}</strong>
                <p>{{ reference.note }}</p>
              </article>
            </div>
            <el-empty v-else description="当前附件暂无业务引用，可按规则删除。" />
          </section>

          <section class="detail-section">
            <div class="detail-section__header">
              <div>
                <p class="panel-caption">Access</p>
                <h3 class="panel-heading panel-heading--md">访问地址</h3>
              </div>
            </div>
            <div class="attachments-screen__link-box">
              {{ selectedAttachment.url || '该附件尚未生成可访问地址' }}
            </div>
          </section>
        </template>

        <el-empty v-else description="没有找到这个附件，可能已经被删除。" />
      </div>
    </SurfacePanel>

    <SurfacePanel
      v-else-if="isEditMode"
      caption="编辑附件"
      title="标签与文件名只在这里修改"
      description="编辑页只处理文件名称和标签，不再和详情或上传逻辑混在一起。"
    >
      <el-form v-loading="panelLoading" label-position="top" class="page-form-grid">
        <el-form-item label="文件名" class="page-form-grid__full">
          <el-input v-model="editorForm.originalName" maxlength="255" />
        </el-form-item>

        <el-form-item label="Tag1">
          <el-input v-model="editorForm.tag1" maxlength="64" placeholder="业务标签 1" />
        </el-form-item>

        <el-form-item label="Tag2">
          <el-input v-model="editorForm.tag2" maxlength="64" placeholder="业务标签 2" />
        </el-form-item>
      </el-form>
    </SurfacePanel>
  </PageScaffold>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import type { MediaAssetRecord } from '@rbac/api-common';
import { useRoute, useRouter } from 'vue-router';
import type { ContextMenuItem } from '@/components/common/context-menu';
import ListExportButton from '@/components/download/ListExportButton.vue';
import PageScaffold from '@/components/workbench/PageScaffold.vue';
import SurfacePanel from '@/components/workbench/SurfacePanel.vue';
import { api } from '@/api/client';
import { usePageState } from '@/composables/use-page-state';
import { useAuthStore } from '@/stores/auth';
import { getErrorMessage } from '@/utils/errors';
import { uploadAttachmentFile } from '@/utils/direct-upload';
import {
  assignAttachmentEditorForm,
  buildAttachmentFilterParams,
  buildAttachmentUpdatePayload,
  createEmptyAttachmentEditorForm,
  createEmptyAttachmentUploadForm,
  formatAttachmentSize,
  formatAttachmentReferenceSummary,
  formatAttachmentTagSummary,
  resolveAttachmentKindLabel,
  resolveAttachmentReferenceKindLabel,
  resolveAttachmentStatusLabel,
  resolveAttachmentStatusType,
  validateAttachmentEditorForm,
  validateAttachmentUploadForm,
  type AttachmentEditorForm,
  type AttachmentFilters,
} from './attachment-management';
import AttachmentsTable from './components/AttachmentsTable.vue';
import AttachmentToolbar from './components/AttachmentToolbar.vue';

defineOptions({ name: 'AttachmentsView' });

definePage({
  viewKey: 'attachments',
  keepAlive: true,
});

type AttachmentsPageState = {
  filters: AttachmentFilters;
  page: number;
};

type AttachmentScreenMode = 'list' | 'upload' | 'detail' | 'edit';

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();
const attachments = ref<MediaAssetRecord[]>([]);
const selectedAttachment = ref<MediaAssetRecord | null>(null);
const loading = ref(false);
const panelLoading = ref(false);
const uploading = ref(false);
const saving = ref(false);
const total = ref(0);
const pageSize = 10;
const fileInput = ref<HTMLInputElement | null>(null);
const uploadProgress = ref<number | null>(null);
const uploadForm = reactive(createEmptyAttachmentUploadForm());
const editorForm = reactive<AttachmentEditorForm>(createEmptyAttachmentEditorForm());

const { state: pageState } = usePageState<AttachmentsPageState>('page:attachments', {
  filters: {
    q: '',
    kind: '',
    uploadStatus: '',
    tag1: '',
    tag2: '',
  },
  page: 1,
});

const allowedModes: AttachmentScreenMode[] = ['list', 'upload', 'detail', 'edit'];
const screenMode = computed<AttachmentScreenMode>(() => {
  const value = typeof route.query.mode === 'string' ? route.query.mode : '';
  return allowedModes.includes(value as AttachmentScreenMode) ? (value as AttachmentScreenMode) : 'list';
});
const activeAttachmentId = computed(() => (typeof route.query.id === 'string' ? route.query.id : ''));
const isListMode = computed(() => screenMode.value === 'list');
const isUploadMode = computed(() => screenMode.value === 'upload');
const isDetailMode = computed(() => screenMode.value === 'detail');
const isEditMode = computed(() => screenMode.value === 'edit');

const canUpload = computed(() => auth.hasPermission('file.upload'));
const canEdit = computed(() => auth.hasPermission('file.update'));
const canDelete = computed(() => auth.hasPermission('file.delete'));

const pageStats = computed(() => {
  if (!isListMode.value) {
    return [];
  }

  const attachmentCount = attachments.value.filter((item) => item.kind === 'attachment').length;
  const avatarCount = attachments.value.filter((item) => item.kind === 'avatar').length;
  const taggedCount = attachments.value.filter((item) => item.tag1 || item.tag2).length;
  const referencedCount = attachments.value.filter((item) => item.referenceCount > 0).length;

  return [
    { label: '附件总数', value: total.value },
    { label: '当前页附件', value: attachmentCount },
    { label: '当前页头像', value: avatarCount },
    { label: '已标记', value: taggedCount },
    { label: '存在引用', value: referencedCount },
  ];
});

const screenHeader = computed(() => {
  if (isListMode.value) {
    return {
      caption: 'Attachments Workspace',
      title: '附件清单只负责筛选和进入下一步',
      description: '列表页只保留检索和进入详情，上传、编辑、删除不再通过多个弹窗叠在一起。',
      meta: [
        { label: '当前页记录', value: String(attachments.value.length) },
        { label: '筛选类型', value: pageState.filters.kind || '全部类型' },
      ],
    };
  }

  if (isDetailMode.value && selectedAttachment.value) {
    return {
      caption: 'Attachment Detail',
      title: selectedAttachment.value.originalName,
      description: '详情页展示文件属性、业务引用和访问地址。',
      meta: [
        { label: '文件状态', value: resolveAttachmentStatusLabel(selectedAttachment.value.uploadStatus) },
        { label: '标签摘要', value: formatAttachmentTagSummary(selectedAttachment.value) },
        { label: '业务引用', value: formatAttachmentReferenceSummary(selectedAttachment.value) },
      ],
    };
  }

  if (isUploadMode.value) {
    return {
      caption: 'Upload Task',
      title: '上传附件',
      description: '上传页只处理文件、标签和进度。',
      meta: [],
    };
  }

  return {
    caption: 'Attachment Form',
    title: '编辑附件',
    description: '编辑页只处理文件名和标签。',
    meta: [],
  };
});

const buildExportRequest = () => api.attachments.export(buildAttachmentFilterParams(pageState.filters));

const formatTime = (value: string) => new Date(value).toLocaleString();

const navigateToMode = async (mode: AttachmentScreenMode, id?: string) => {
  const query: Record<string, string> = {};
  if (mode !== 'list') {
    query.mode = mode;
  }
  if (id) {
    query.id = id;
  }
  await router.replace({ path: route.path, query });
};

const resetUploadForm = () => {
  Object.assign(uploadForm, createEmptyAttachmentUploadForm());
  uploadProgress.value = null;
  if (fileInput.value) {
    fileInput.value.value = '';
  }
};

const resetEditorForm = () => {
  Object.assign(editorForm, createEmptyAttachmentEditorForm());
};

const openList = async () => {
  await navigateToMode('list');
};

const openUpload = async () => {
  resetUploadForm();
  await navigateToMode('upload');
};

const openDetail = async (row: MediaAssetRecord) => {
  await navigateToMode('detail', row.id);
};

const openEdit = async (row: MediaAssetRecord) => {
  await navigateToMode('edit', row.id);
};

const openEditById = async () => {
  if (!activeAttachmentId.value) {
    return;
  }
  await navigateToMode('edit', activeAttachmentId.value);
};

const loadData = async () => {
  try {
    loading.value = true;
    const response = await api.attachments.list({
      page: pageState.page,
      pageSize,
      ...buildAttachmentFilterParams(pageState.filters),
    });

    const totalPages = Math.max(Math.ceil(response.meta.total / pageSize), 1);
    if (pageState.page > totalPages) {
      pageState.page = totalPages;
      await loadData();
      return;
    }

    attachments.value = response.items;
    total.value = response.meta.total;
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '加载附件列表失败'));
  } finally {
    loading.value = false;
  }
};

const loadAttachmentDetail = async (id: string) => {
  try {
    panelLoading.value = true;
    selectedAttachment.value = await api.attachments.detail(id);
  } catch (error: unknown) {
    selectedAttachment.value = null;
    ElMessage.error(getErrorMessage(error, '加载附件详情失败'));
  } finally {
    panelLoading.value = false;
  }
};

const refreshCurrentScreen = async () => {
  if (isListMode.value) {
    await loadData();
    return;
  }

  if (isUploadMode.value) {
    return;
  }

  if (!activeAttachmentId.value) {
    return;
  }

  await loadAttachmentDetail(activeAttachmentId.value);
  if (isEditMode.value && selectedAttachment.value) {
    assignAttachmentEditorForm(editorForm, selectedAttachment.value);
  }
};

const applyFilters = async () => {
  pageState.page = 1;
  await loadData();
};

const resetFilters = async () => {
  pageState.filters.q = '';
  pageState.filters.kind = '';
  pageState.filters.uploadStatus = '';
  pageState.filters.tag1 = '';
  pageState.filters.tag2 = '';
  pageState.page = 1;
  await loadData();
};

const submitEdit = async () => {
  const validationMessage = validateAttachmentEditorForm(editorForm);
  if (validationMessage) {
    ElMessage.warning(validationMessage);
    return;
  }

  if (!activeAttachmentId.value) {
    return;
  }

  try {
    saving.value = true;
    const saved = await api.attachments.update(
      activeAttachmentId.value,
      buildAttachmentUpdatePayload(editorForm),
    );
    selectedAttachment.value = saved;
    ElMessage.success('附件信息已更新');
    await loadData();
    await navigateToMode('detail', saved.id);
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '更新附件失败'));
  } finally {
    saving.value = false;
  }
};

const openFilePicker = () => {
  fileInput.value?.click();
};

const clearFile = () => {
  uploadForm.file = null;
  if (fileInput.value) {
    fileInput.value.value = '';
  }
};

const onFileChange = (event: Event) => {
  const input = event.target as HTMLInputElement;
  uploadForm.file = input.files?.[0] ?? null;
};

const submitUpload = async () => {
  const validationMessage = validateAttachmentUploadForm(uploadForm);
  if (validationMessage) {
    ElMessage.warning(validationMessage);
    return;
  }

  if (!uploadForm.file) {
    return;
  }

  try {
    uploading.value = true;
    const uploaded = await uploadAttachmentFile(
      uploadForm.file,
      {
        tag1: uploadForm.tag1.trim() || null,
        tag2: uploadForm.tag2.trim() || null,
      },
      (progress) => {
        uploadProgress.value = progress;
      },
    );

    ElMessage.success('附件上传成功');
    await loadData();
    resetUploadForm();
    await navigateToMode('detail', uploaded.fileId);
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '上传附件失败'));
  } finally {
    uploading.value = false;
  }
};

const openAttachmentLink = (row: MediaAssetRecord) => {
  if (!row.url) {
    ElMessage.warning('该附件尚未生成可访问地址');
    return;
  }

  window.open(row.url, '_blank', 'noopener,noreferrer');
};

const copyAttachmentLink = async (row: MediaAssetRecord) => {
  if (!row.url) {
    ElMessage.warning('该附件尚未生成可访问地址');
    return;
  }

  try {
    await navigator.clipboard.writeText(row.url);
    ElMessage.success('附件链接已复制');
  } catch {
    ElMessage.warning('当前环境不支持复制');
  }
};

const removeAttachment = async (row: MediaAssetRecord) => {
  if (row.referenceCount > 0) {
    ElMessage.warning(`该附件仍被 ${row.referenceCount} 条业务记录引用，暂不能删除`);
    return;
  }

  try {
    await ElMessageBox.confirm(
      `确定删除附件“${row.originalName}”吗？`,
      '删除附件',
      {
        type: 'warning',
        confirmButtonText: '删除',
        cancelButtonText: '取消',
      },
    );

    await api.attachments.remove(row.id);
    ElMessage.success('附件已删除');
    await loadData();
    if (activeAttachmentId.value === row.id) {
      selectedAttachment.value = null;
      await openList();
    }
  } catch (error: unknown) {
    if (error === 'cancel' || error === 'close') {
      return;
    }
    ElMessage.error(getErrorMessage(error, '删除附件失败'));
  }
};

const attachmentContextMenuItems = [
  {
    key: 'detail',
    label: '查看详情',
    onSelect: (row) => openDetail(row),
  },
  {
    key: 'open',
    label: '打开附件',
    disabled: (row) => !row.url,
    onSelect: (row) => openAttachmentLink(row),
  },
  {
    key: 'copy-link',
    label: '复制链接',
    disabled: (row) => !row.url,
    onSelect: (row) => {
      void copyAttachmentLink(row);
    },
  },
  {
    key: 'divider',
    type: 'divider',
  },
  {
    key: 'edit',
    label: '编辑标签',
    hidden: () => !canEdit.value,
    onSelect: (row) => openEdit(row),
  },
  {
    key: 'delete',
    label: '删除附件',
    hidden: () => !canDelete.value,
    disabled: (row) => row.referenceCount > 0,
    danger: true,
    onSelect: (row) => removeAttachment(row),
  },
  {
    key: 'summary',
    label: '查看摘要',
    onSelect: (row) => {
      ElMessage.info(
        `${resolveAttachmentKindLabel(row.kind)} · ${resolveAttachmentStatusLabel(row.uploadStatus)} · ${formatAttachmentTagSummary(row)} · ${formatAttachmentReferenceSummary(row)}`,
      );
    },
  },
] satisfies ContextMenuItem<MediaAssetRecord>[];

const changePage = async (value: number) => {
  pageState.page = value;
  await loadData();
};

watch(
  () => [screenMode.value, activeAttachmentId.value] as const,
  async ([mode, id]) => {
    if (mode === 'list') {
      selectedAttachment.value = null;
      return;
    }

    if (mode === 'upload') {
      selectedAttachment.value = null;
      resetUploadForm();
      return;
    }

    if (!id) {
      await openList();
      return;
    }

    await loadAttachmentDetail(id);
    if (mode === 'edit' && selectedAttachment.value) {
      assignAttachmentEditorForm(editorForm, selectedAttachment.value);
    }
  },
  { immediate: true },
);

onMounted(async () => {
  await loadData();
});
</script>

<style scoped lang="scss">
.attachments-screen__meta {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
}

.attachments-screen__meta-item {
  display: grid;
  gap: 6px;
  padding-top: 14px;
  border-top: 1px solid var(--line-soft);
}

.attachments-screen__meta-item span {
  color: var(--ink-3);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.attachments-screen__meta-item strong {
  color: var(--ink-1);
  font-size: 20px;
  line-height: 1.2;
}

.attachments-screen__hidden-input {
  display: none;
}

.attachments-screen__picker {
  display: flex;
  align-items: center;
  gap: 12px;
}

.attachments-screen__file-summary {
  display: grid;
  gap: 4px;
  margin-top: 12px;
  padding: 12px 14px;
  border: 1px dashed var(--line-strong);
  border-radius: 12px;
}

.attachments-screen__file-summary span {
  color: var(--ink-3);
  font-size: 12px;
}

.attachments-screen__file-summary.is-empty {
  color: var(--ink-3);
}

.attachments-screen__link-box {
  padding: 14px 16px;
  border: 1px solid var(--line-soft);
  border-radius: 14px;
  background: var(--surface-1);
  word-break: break-all;
  color: var(--ink-2);
}

.detail-reference-list {
  display: grid;
  gap: 12px;
}

.detail-reference-card {
  display: grid;
  gap: 10px;
  padding: 16px;
  border: 1px solid var(--line-soft);
  border-radius: 16px;
  background: var(--surface-1);
}

.detail-reference-card strong {
  color: var(--ink-1);
}

.detail-reference-card p {
  margin: 0;
  color: var(--ink-3);
  line-height: 1.5;
}

.detail-reference-card__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.detail-reference-card__meta span {
  color: var(--ink-3);
  font-size: 12px;
  font-family: var(--font-mono, 'JetBrains Mono', monospace);
}
</style>
