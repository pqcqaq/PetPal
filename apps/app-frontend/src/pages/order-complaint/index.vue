<script setup lang="ts">
import type { ComplaintTargetRole, ComplaintType, OrderDetailRecord } from '@rbac/api-common'
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
const upload = useManagedAttachmentUpload({ maxCount: 3, maxSizeMb: 8 })

const form = reactive({
  targetRole: 'CAREGIVER' as ComplaintTargetRole,
  complaintType: 'SERVICE' as ComplaintType,
  description: '',
  evidenceUrls: [] as string[],
})

const pageSubtitle = computed(() => order.value ? `${order.value.orderNo} · 投诉会进入独立结果页` : '提交投诉后将进入投诉结果页。')

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
  try {
    const files = await upload.selectAndUploadAttachments({ tag1: 'petpal', tag2: 'complaint' })
    form.evidenceUrls = [...form.evidenceUrls, ...files.map(item => item.url)]
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
      evidenceUrls: form.evidenceUrls,
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
      <PetpalSection title="投诉对象">
        <view class="petpal-chip-row">
          <button
            v-for="item in complaintTargetOptions"
            :key="item.value"
            :class="['petpal-chip', form.targetRole === item.value ? 'petpal-chip--active' : '']"
            hover-class="none"
            @click="form.targetRole = item.value"
          >
            {{ item.label }}
          </button>
        </view>
      </PetpalSection>

      <PetpalSection title="问题类型">
        <view class="petpal-chip-row">
          <button
            v-for="item in complaintTypeOptions"
            :key="item.value"
            :class="['petpal-chip', form.complaintType === item.value ? 'petpal-chip--active' : '']"
            hover-class="none"
            @click="form.complaintType = item.value"
          >
            {{ item.label }}
          </button>
        </view>
      </PetpalSection>

      <PetpalSection title="详细说明">
        <textarea v-model="form.description" class="petpal-textarea" :maxlength="360" placeholder="请尽量按时间顺序描述问题、影响和你的诉求" />
      </PetpalSection>

      <PetpalSection title="证据材料" subtitle="最多 3 张图，直接进入投诉结果页同步查看。">
        <template v-if="form.evidenceUrls.length">
          <button
            v-for="(item, index) in form.evidenceUrls"
            :key="item"
            class="petpal-row-btn"
            hover-class="none"
            @click="form.evidenceUrls = form.evidenceUrls.filter((_, currentIndex) => currentIndex !== index)"
          >
            <view class="petpal-row__copy">
              <text class="petpal-row__title">证据 {{ index + 1 }}</text>
              <text class="petpal-row__hint">{{ item }}</text>
            </view>
            <text class="petpal-row__value">移除</text>
          </button>
        </template>
        <button class="petpal-btn petpal-btn--secondary" hover-class="none" @click="uploadEvidence">
          {{ upload.uploading ? '上传中...' : '上传截图或照片' }}
        </button>
      </PetpalSection>

      <view class="petpal-bottom-bar">
        <view class="petpal-action-row">
          <button class="petpal-btn petpal-btn--danger" hover-class="none" :disabled="submitting" @click="submitComplaint">
            {{ submitting ? '提交中...' : '提交投诉' }}
          </button>
        </view>
      </view>
    </template>
  </PetpalPage>
</template>
