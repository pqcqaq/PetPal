<script setup lang="ts">
import {
  PETPAL_COMPLAINT_ATTACHMENT_MAX_COUNT,
  PETPAL_COMPLAINT_ATTACHMENT_MAX_SIZE_MB,
  PETPAL_ORDER_COMPLAINT_ATTACHMENT_TAG,
  type ComplaintTargetRole,
  type ComplaintType,
  type ManagedAttachmentRecord,
  type OrderDetailRecord,
} from '@rbac/api-common'
import { computed, reactive, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { createOrderComplaint, getOrderDetail } from '@/api/petpal'
import { useManagedAttachmentUpload } from '@/composables/useManagedAttachmentUpload'
import { useTokenStore } from '@/store'
import PetpalPage from '../petpal/rebuild/petpal-page.vue'
import PetpalSection from '../petpal/rebuild/petpal-section.vue'
import { complaintTargetOptions, complaintTypeOptions, getErrorMessage, openLoginPage, PETPAL_COMPLAINT_RESULT_PAGE, toast } from '../petpal/rebuild/shared'

const tokenStore = useTokenStore()
const orderId = ref('')
const loading = ref(false)
const submitting = ref(false)
const order = ref<OrderDetailRecord | null>(null)
const upload = useManagedAttachmentUpload({
  maxCount: PETPAL_COMPLAINT_ATTACHMENT_MAX_COUNT,
  maxSizeMb: PETPAL_COMPLAINT_ATTACHMENT_MAX_SIZE_MB,
})

const form = reactive({
  targetRole: 'CAREGIVER' as ComplaintTargetRole,
  complaintType: 'SERVICE' as ComplaintType,
  description: '',
  evidenceAttachments: [] as ManagedAttachmentRecord[],
})

const pageSubtitle = computed(() => order.value ? `${order.value.orderNo} · 投诉会进入独立结果页` : '提交投诉后将进入投诉结果页。')
const evidenceSlotsLeft = computed(() => Math.max(0, PETPAL_COMPLAINT_ATTACHMENT_MAX_COUNT - form.evidenceAttachments.length))

async function loadPage() {
  if (!tokenStore.hasLogin || loading.value || !orderId.value) {
    return
  }
  loading.value = true
  try {
    order.value = await getOrderDetail(orderId.value)
  }
  catch (error: unknown) {
    toast(getErrorMessage(error, '加载投诉页失败'))
  }
  finally {
    loading.value = false
  }
}

async function uploadEvidence() {
  if (!orderId.value) {
    toast('缺少订单信息，暂时无法上传投诉材料')
    return
  }

  try {
    const files = await upload.selectAndUploadAttachments({
      tag1: PETPAL_ORDER_COMPLAINT_ATTACHMENT_TAG,
      tag2: orderId.value,
      maxCount: evidenceSlotsLeft.value,
    })
    form.evidenceAttachments = [...form.evidenceAttachments, ...files]
    toast('材料已上传', 'success')
  }
  catch (error: unknown) {
    toast(getErrorMessage(error, '上传失败'))
  }
}

async function submitComplaint() {
  if (!tokenStore.hasLogin || submitting.value || !orderId.value) {
    return
  }
  if (!form.description.trim()) {
    toast('请先填写投诉说明')
    return
  }
  submitting.value = true
  try {
    const complaint = await createOrderComplaint(orderId.value, {
      targetRole: form.targetRole,
      complaintType: form.complaintType,
      description: form.description.trim(),
      evidenceUrls: form.evidenceAttachments.map(item => item.url),
    })
    toast('投诉已提交', 'success')
    uni.redirectTo({ url: `${PETPAL_COMPLAINT_RESULT_PAGE}?orderId=${orderId.value}&complaintId=${complaint.id}` })
  }
  catch (error: unknown) {
    toast(getErrorMessage(error, '提交投诉失败'))
  }
  finally {
    submitting.value = false
  }
}

function formatEvidenceSize(size: number) {
  if (!Number.isFinite(size) || size <= 0) {
    return '大小未知'
  }
  if (size >= 1024 * 1024) {
    return `${(size / 1024 / 1024).toFixed(1)} MB`
  }
  return `${Math.max(1, Math.round(size / 1024))} KB`
}

function removeEvidence(fileId: string) {
  form.evidenceAttachments = form.evidenceAttachments.filter(item => item.fileId !== fileId)
}

function previewEvidence(url: string) {
  uni.previewImage({
    urls: form.evidenceAttachments.map(item => item.url),
    current: url,
  })
}

onLoad((options) => {
  orderId.value = options?.id || options?.orderId || ''
  void loadPage()
})
</script>

<template>
  <PetpalPage title="投诉处理" :subtitle="pageSubtitle" eyebrow="Complaint Form" back :back-url="orderId ? `/pages/order-detail/index?id=${orderId}&tab=aftersales` : '/pages/petpal/aftersales'">
    <template v-if="!tokenStore.hasLogin">
      <PetpalSection title="需要登录">
        <button class="petpal-btn petpal-btn--primary" hover-class="none" @click="openLoginPage">去登录</button>
      </PetpalSection>
    </template>

    <template v-else>
      <PetpalSection tone="danger" title="先确认投诉方向" subtitle="先选投诉对象，再确定问题类型，避免说明和诉求写散。">
        <view class="petpal-choice-grid petpal-choice-grid--two">
          <button
            v-for="item in complaintTargetOptions"
            :key="item.value"
            :class="['petpal-choice-tile', form.targetRole === item.value ? 'petpal-choice-tile--active' : '']"
            hover-class="none"
            @click="form.targetRole = item.value"
          >
            <text class="petpal-choice-tile__eyebrow">Target</text>
            <text class="petpal-choice-tile__title">{{ item.label }}</text>
            <text class="petpal-choice-tile__hint">{{ form.targetRole === item.value ? '当前投诉对象' : '切换到该投诉对象' }}</text>
          </button>
        </view>
        <view class="petpal-choice-grid">
          <button
            v-for="item in complaintTypeOptions"
            :key="item.value"
            :class="['petpal-choice-tile', form.complaintType === item.value ? 'petpal-choice-tile--active' : '']"
            hover-class="none"
            @click="form.complaintType = item.value"
          >
            <text class="petpal-choice-tile__eyebrow">Type</text>
            <text class="petpal-choice-tile__title">{{ item.label }}</text>
          </button>
        </view>
      </PetpalSection>

      <PetpalSection title="说明问题经过" subtitle="请按时间顺序描述问题、影响和你的诉求。">
        <textarea v-model="form.description" class="petpal-textarea" :maxlength="360" placeholder="请尽量按时间顺序描述问题、影响和你的诉求" />
      </PetpalSection>

      <PetpalSection title="证据材料" subtitle="最多 3 张图，提交后会直接进入投诉结果页同步查看。">
        <template v-if="form.evidenceAttachments.length">
          <view v-for="(item, index) in form.evidenceAttachments" :key="item.fileId" class="petpal-sheet">
            <text class="petpal-banner__eyebrow">Evidence {{ index + 1 }}</text>
            <text class="petpal-banner__title">{{ item.name }}</text>
            <text class="petpal-note">{{ formatEvidenceSize(item.size) }}</text>
            <view class="petpal-action-row">
              <button class="petpal-btn petpal-btn--secondary" hover-class="none" @click="previewEvidence(item.url)">查看材料</button>
              <button class="petpal-btn petpal-btn--ghost" hover-class="none" @click="removeEvidence(item.fileId)">移除材料</button>
            </view>
          </view>
        </template>
        <button class="petpal-btn petpal-btn--secondary" hover-class="none" :disabled="evidenceSlotsLeft <= 0" @click="uploadEvidence">
          {{ upload.uploading ? '上传中...' : `上传截图或照片${evidenceSlotsLeft > 0 ? `（剩余 ${evidenceSlotsLeft} 张）` : ''}` }}
        </button>
      </PetpalSection>

      <view class="petpal-bottom-bar">
        <text class="petpal-note">投诉提交后会进入独立结果页，后续处理不再和当前表单混在一起。</text>
        <view class="petpal-action-row">
          <button class="petpal-btn petpal-btn--danger" hover-class="none" :disabled="submitting" @click="submitComplaint">
            {{ submitting ? '提交中...' : '提交投诉' }}
          </button>
        </view>
      </view>
    </template>
  </PetpalPage>
</template>
