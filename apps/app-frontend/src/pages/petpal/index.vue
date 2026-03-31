<script lang="ts" setup>
import type {
  CaregiverAuditStatus,
  CaregiverQualificationMaterialRecord,
  CaregiverOrderRecord,
  CaregiverProfileRecord,
  CaregiverServiceRecord,
  MatchCaregiverQuery,
  MatchedCaregiverRecord,
  OrderStatus,
  OrderRecord,
  PetGender,
  PetProfileRecord,
  PetServiceType,
  PetSpecies,
  ServiceLogType,
  ServiceRequestRecord,
} from '@rbac/api-common'
import dayjs from 'dayjs'
import { storeToRefs } from 'pinia'
import { computed, reactive, ref, watch } from 'vue'
import AppButton from '@/components/app-button/app-button.vue'
import AppChoiceChips from '@/components/app-choice-chips/app-choice-chips.vue'
import AppInput from '@/components/app-input/app-input.vue'
import AppList from '@/components/app-list/app-list.vue'
import AppListItem from '@/components/app-list-item/app-list-item.vue'
import AppPageShell from '@/components/app-page-shell/app-page-shell.vue'
import AppSection from '@/components/app-section/app-section.vue'
import AppStatus from '@/components/app-status/app-status.vue'
import {
  acceptCaregiverOrder,
  addCaregiverServiceLog,
  checkInCaregiverOrder,
  checkOutCaregiverOrder,
  createCaregiverService,
  createPet,
  createServiceRequest,
  getCaregiverProfile,
  listCaregiverOrders,
  listCaregiverServices,
  listOrders,
  listPets,
  listServiceRequests,
  matchCaregivers,
  updatePet,
  updateCaregiverService,
  upsertCaregiverProfile,
} from '@/api/petpal'
import { useManagedAttachmentUpload } from '@/composables/useManagedAttachmentUpload'
import { LOGIN_PAGE } from '@/router/config'
import { useUserStore } from '@/store'
import { useTokenStore } from '@/store/token'
import { getErrorMessage } from '@/utils/error'

defineOptions({
  name: 'PetPalPage',
})

definePage({
  style: {
    navigationBarTitleText: 'PetPal 工作台',
    enablePullDownRefresh: true,
  },
})

type WorkspaceMode = 'owner' | 'caregiver'
type YesNoChoice = 'YES' | 'NO'
type CaregiverOrderFilterValue = OrderStatus | 'ALL'

const serviceTypeLabels: Record<PetServiceType, string> = {
  BOARDING: '寄养',
  WALKING: '遛宠',
  FEEDING: '喂养',
  DOOR_VISIT: '上门陪伴',
}

const speciesLabels: Record<PetSpecies, string> = {
  DOG: '犬类',
  CAT: '猫咪',
  OTHER: '其他宠物',
}

const genderLabels: Record<PetGender, string> = {
  MALE: '公',
  FEMALE: '母',
  UNKNOWN: '未知',
}

const orderStatusLabels: Record<OrderStatus, string> = {
  PENDING_ACCEPT: '待接单',
  ACCEPTED: '已接单',
  SERVING: '服务中',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
  DISPUTED: '纠纷中',
  PARTIAL_REFUNDED: '部分退款',
  REFUNDED: '已退款',
}

const caregiverAuditLabels: Record<CaregiverAuditStatus, string> = {
  PENDING: '待审核',
  APPROVED: '审核通过',
  REJECTED: '审核驳回',
}

const workspace = ref<WorkspaceMode>('owner')
const loading = ref(false)
const creatingPet = ref(false)
const creatingRequest = ref(false)
const caregiverProfileSaving = ref(false)
const caregiverServiceSaving = ref(false)
const caregiverActionLoadingKey = ref('')
const serviceLogSubmitting = ref(false)

const pets = ref<PetProfileRecord[]>([])
const requests = ref<ServiceRequestRecord[]>([])
const orders = ref<OrderRecord[]>([])
const caregivers = ref<MatchedCaregiverRecord[]>([])
const caregiverProfile = ref<CaregiverProfileRecord | null>(null)
const caregiverServices = ref<CaregiverServiceRecord[]>([])
const caregiverOrders = ref<CaregiverOrderRecord[]>([])

const editingPetId = ref('')
const editingCaregiverServiceId = ref('')
const activeServiceLogOrderId = ref('')
const petTemperamentTagsText = ref('')

const { uploading: qualificationUploading, selectAndUploadAttachments } = useManagedAttachmentUpload({
  maxCount: 3,
  maxSizeMb: 8,
})

const userStore = useUserStore()
const tokenStore = useTokenStore()
const { userInfo } = storeToRefs(userStore)

const petForm = reactive({
  name: '',
  species: 'DOG' as PetSpecies,
  gender: 'UNKNOWN' as PetGender,
  breed: '',
  birthday: '',
  weightKg: '5',
  neutered: 'NO' as YesNoChoice,
  feedingNote: '',
  allergyNote: '',
  medicalNote: '',
  emergencyName: '',
  emergencyPhone: '',
  emergencyRelation: '',
})

const requestForm = reactive({
  petId: '',
  serviceType: 'BOARDING' as PetServiceType,
  startDate: dayjs().add(1, 'day').format('YYYY-MM-DD'),
  startTime: '10:00',
  endDate: dayjs().add(1, 'day').format('YYYY-MM-DD'),
  endTime: '18:00',
  locationText: '',
  budgetAmount: '200',
  demandTagsText: '',
})

const matchQuery = reactive<MatchCaregiverQuery>({
  serviceType: 'BOARDING',
  petSpecies: 'DOG',
  city: '',
  page: 1,
  pageSize: 6,
})

const caregiverProfileForm = reactive({
  intro: '',
  experienceYears: '0',
  serviceRadiusKm: '5',
  serviceCity: '',
  specialtyTagsText: '',
  serviceCommitment: '',
  qualificationMaterials: [] as CaregiverQualificationMaterialRecord[],
})

const caregiverServiceForm = reactive({
  serviceType: 'BOARDING' as PetServiceType,
  petSpecies: 'DOG' as PetSpecies,
  pricePerUnit: '60',
  unitType: '小时',
  minNoticeHours: '2',
  serviceCity: '',
  isActive: 'YES' as YesNoChoice,
})

const caregiverOrderFilter = ref<CaregiverOrderFilterValue>('PENDING_ACCEPT')
const serviceLogForm = reactive({
  logType: 'NOTE' as ServiceLogType,
  textNote: '',
})

const workspaceOptions = [
  { label: '主人工作台', value: 'owner', description: '维护宠物、发布需求、追踪订单' },
  { label: '照料者工作台', value: 'caregiver', description: '管理档案、服务报价和履约动作' },
]

const speciesOptions = [
  { label: '犬类', value: 'DOG', description: '寄养、遛宠最常见' },
  { label: '猫咪', value: 'CAT', description: '更关注环境与应激' },
  { label: '其他', value: 'OTHER', description: '异宠和特殊照料' },
]

const genderOptions = [
  { label: '公', value: 'MALE' },
  { label: '母', value: 'FEMALE' },
  { label: '未知', value: 'UNKNOWN' },
]

const yesNoOptions = [
  { label: '是', value: 'YES' },
  { label: '否', value: 'NO' },
]

const serviceTypeOptions = [
  { label: '寄养', value: 'BOARDING', description: '短住照料与过夜陪护' },
  { label: '遛宠', value: 'WALKING', description: '固定时段外出活动' },
  { label: '喂养', value: 'FEEDING', description: '定时上门喂食换水' },
  { label: '上门陪伴', value: 'DOOR_VISIT', description: '互动安抚与环境巡视' },
]

const caregiverOrderFilterOptions = [
  { label: '待接单', value: 'PENDING_ACCEPT' },
  { label: '已接单', value: 'ACCEPTED' },
  { label: '服务中', value: 'SERVING' },
  { label: '已完成', value: 'COMPLETED' },
  { label: '全部', value: 'ALL' },
]

const serviceLogTypeOptions = [
  { label: '备注', value: 'NOTE', description: '交接与补充说明' },
  { label: '喂养', value: 'FEED', description: '记录饮食和水量' },
  { label: '遛宠', value: 'WALK', description: '记录外出时长和状态' },
  { label: '陪伴', value: 'PLAY', description: '记录互动和玩耍情况' },
  { label: '观察', value: 'HEALTH', description: '记录精神与健康表现' },
]

const displayName = computed(() => userInfo.value.nickname || userInfo.value.username || 'PetPal 用户')
const activeOwnerOrderCount = computed(() => orders.value.filter(item => (
  item.orderStatus === 'PENDING_ACCEPT'
  || item.orderStatus === 'ACCEPTED'
  || item.orderStatus === 'SERVING'
)).length)
const disputeOrderCount = computed(() => orders.value.filter(item => (
  item.orderStatus === 'DISPUTED'
  || item.orderStatus === 'PARTIAL_REFUNDED'
  || item.orderStatus === 'REFUNDED'
)).length)
const caregiverPendingCount = computed(() => caregiverOrders.value.filter(item => item.orderStatus === 'PENDING_ACCEPT').length)
const caregiverServingCount = computed(() => caregiverOrders.value.filter(item => item.orderStatus === 'SERVING').length)
const currentStats = computed(() => (
  workspace.value === 'owner'
    ? [
        { label: '宠物档案', value: String(pets.value.length), hint: pets.value.length ? '已建档，可直接复用下单' : '先补齐宠物资料' },
        { label: '服务需求', value: String(requests.value.length), hint: requests.value.length ? '持续跟踪匹配和确认状态' : '还没有发起过照料需求' },
        { label: '进行中订单', value: String(activeOwnerOrderCount.value), hint: activeOwnerOrderCount.value ? '记得跟进签到、日志和完成确认' : '当前没有进行中的主人订单' },
        { label: '推荐照料者', value: String(caregivers.value.length), hint: caregivers.value.length ? '根据服务类型和宠物种类实时筛选' : '可以调整筛选条件重新匹配' },
      ]
    : [
        { label: '审核状态', value: caregiverProfile.value ? caregiverAuditLabels[caregiverProfile.value.auditStatus] : '待创建', hint: caregiverProfile.value ? '档案审核通过后更容易获得订单' : '先补齐照料者档案' },
        { label: '服务配置', value: String(caregiverServices.value.length), hint: caregiverServices.value.length ? '保持城市、报价和时效信息最新' : '至少配置一个可售服务' },
        { label: '待接单', value: String(caregiverPendingCount.value), hint: caregiverPendingCount.value ? '及时接单，避免需求流失' : '当前没有新的待接单订单' },
        { label: '服务中', value: String(caregiverServingCount.value), hint: caregiverServingCount.value ? '别忘记持续补充服务记录' : '当前没有进行中的履约' },
      ]
))
const pageDescription = computed(() => {
  if (!tokenStore.hasLogin) {
    return '登录后在一页内完成宠物建档、需求发布、照料履约和订单跟进。'
  }

  return workspace.value === 'owner'
    ? '从宠物建档、服务预约到订单追踪，主人侧主流程全部集中在这里。'
    : '从照料者档案、服务报价到接单履约，照料者侧主流程全部集中在这里。'
})
const currentServiceLogOrder = computed(() => caregiverOrders.value.find(item => item.id === activeServiceLogOrderId.value) ?? null)
const petSelectionOptions = computed(() => pets.value.map(item => ({
  label: item.name,
  value: item.id,
  description: `${speciesLabels[item.species]}${item.breed ? ` · ${item.breed}` : ''}`,
})))
const caregiverAuditHint = computed(() => {
  if (!caregiverProfile.value) {
    return '先完善照料介绍、服务城市和半径，平台会据此安排后续审核。'
  }

  if (caregiverProfile.value.auditStatus === 'APPROVED') {
    return '你的照料者档案已通过审核，可以持续优化服务配置和履约反馈。'
  }

  if (caregiverProfile.value.auditStatus === 'REJECTED') {
    return '档案曾被驳回，请补充更完整的介绍、城市和服务范围后再次保存。'
  }

  return '档案已提交，等待平台审核。保持资料完整有助于更快通过。'
})
const requestScheduleSummary = computed(() => {
  const start = dayjs(`${requestForm.startDate} ${requestForm.startTime}`)
  const end = dayjs(`${requestForm.endDate} ${requestForm.endTime}`)
  if (!start.isValid() || !end.isValid()) {
    return '请重新选择服务时间'
  }
  return `${start.format('MM-DD HH:mm')} 至 ${end.format('MM-DD HH:mm')}`
})

function formatAmount(value: number | string | null | undefined) {
  const amount = Number(value ?? 0)
  return Number.isFinite(amount) ? amount.toFixed(2) : '0.00'
}

function formatDateTime(value: string) {
  return dayjs(value).format('MM-DD HH:mm')
}

function formatRange(start: string, end: string) {
  return `${formatDateTime(start)} - ${formatDateTime(end)}`
}

function getOrderStatusLabel(status: OrderStatus) {
  return orderStatusLabels[status] || status
}

function getCaregiverAuditLabel(status: CaregiverAuditStatus) {
  return caregiverAuditLabels[status] || status
}

function getOrderTone(status: OrderStatus) {
  if (status === 'COMPLETED') return 'success'
  if (status === 'SERVING') return 'warning'
  if (status === 'DISPUTED' || status === 'PARTIAL_REFUNDED' || status === 'REFUNDED') return 'danger'
  return 'neutral'
}

function splitTagText(value: string) {
  return [...new Set(
    value
      .split(/[\n,，、]/)
      .map(item => item.trim())
      .filter(Boolean),
  )]
}

function joinTagText(tags?: string[]) {
  return (tags ?? []).join('，')
}

function formatPetTagSummary(tags?: string[]) {
  const normalized = tags ?? []
  return normalized.length ? normalized.join(' / ') : '暂无'
}

function resetPetForm() {
  editingPetId.value = ''
  petForm.name = ''
  petForm.species = 'DOG'
  petForm.gender = 'UNKNOWN'
  petForm.breed = ''
  petForm.birthday = ''
  petForm.weightKg = '5'
  petForm.neutered = 'NO'
  petForm.feedingNote = ''
  petForm.allergyNote = ''
  petForm.medicalNote = ''
  petForm.emergencyName = ''
  petForm.emergencyPhone = ''
  petForm.emergencyRelation = ''
  petTemperamentTagsText.value = ''
}

function startEditPet(pet: PetProfileRecord) {
  editingPetId.value = pet.id
  requestForm.petId = pet.id
  petForm.name = pet.name
  petForm.species = pet.species
  petForm.gender = pet.gender
  petForm.breed = pet.breed || ''
  petForm.birthday = pet.birthday ? pet.birthday.slice(0, 10) : ''
  petForm.weightKg = pet.weightKg ? String(pet.weightKg) : ''
  petForm.neutered = pet.neutered ? 'YES' : 'NO'
  petForm.feedingNote = pet.feedingNote || ''
  petForm.allergyNote = pet.allergyNote || ''
  petForm.medicalNote = pet.medicalNote || ''
  petForm.emergencyName = pet.emergencyContact?.name || ''
  petForm.emergencyPhone = pet.emergencyContact?.phone || ''
  petForm.emergencyRelation = pet.emergencyContact?.relation || ''
  petTemperamentTagsText.value = joinTagText(pet.temperamentTags)
}

function ensurePetSelection() {
  if (!requestForm.petId && pets.value.length > 0) {
    requestForm.petId = pets.value[0].id
  }
}

function syncMatchQueryWithSelection() {
  matchQuery.serviceType = requestForm.serviceType
  const selectedPet = pets.value.find(item => item.id === requestForm.petId)
  if (selectedPet) {
    matchQuery.petSpecies = selectedPet.species
  }
}

function resetCaregiverServiceForm() {
  editingCaregiverServiceId.value = ''
  caregiverServiceForm.serviceType = 'BOARDING'
  caregiverServiceForm.petSpecies = 'DOG'
  caregiverServiceForm.pricePerUnit = '60'
  caregiverServiceForm.unitType = '小时'
  caregiverServiceForm.minNoticeHours = '2'
  caregiverServiceForm.serviceCity = caregiverProfileForm.serviceCity
  caregiverServiceForm.isActive = 'YES'
}

function hydrateCaregiverProfile(profile: CaregiverProfileRecord) {
  caregiverProfile.value = profile
  caregiverProfileForm.intro = profile.intro || ''
  caregiverProfileForm.experienceYears = String(profile.experienceYears)
  caregiverProfileForm.serviceRadiusKm = String(profile.serviceRadiusKm)
  caregiverProfileForm.serviceCity = profile.serviceCity || ''
  caregiverProfileForm.specialtyTagsText = joinTagText(profile.specialtyTags)
  caregiverProfileForm.serviceCommitment = profile.serviceCommitment || ''
  caregiverProfileForm.qualificationMaterials = [...profile.qualificationMaterials]
  if (!editingCaregiverServiceId.value && !caregiverServiceForm.serviceCity.trim()) {
    caregiverServiceForm.serviceCity = profile.serviceCity || ''
  }
}

function removeQualificationMaterial(fileId: string) {
  caregiverProfileForm.qualificationMaterials = caregiverProfileForm.qualificationMaterials
    .filter(item => item.fileId !== fileId)
}

async function uploadQualificationMaterials() {
  if (!caregiverProfile.value) {
    uni.showToast({ title: '请先加载照料者档案', icon: 'none' })
    return
  }

  try {
    const uploaded = await selectAndUploadAttachments({
      tag1: 'petpal-caregiver-qualification',
      tag2: caregiverProfile.value.id,
    })
    caregiverProfileForm.qualificationMaterials = [
      ...caregiverProfileForm.qualificationMaterials,
      ...uploaded,
    ].slice(0, 12)
    uni.showToast({ title: `已上传 ${uploaded.length} 份材料`, icon: 'none' })
  }
  catch (error: unknown) {
    uni.showToast({ title: getErrorMessage(error, '上传资质材料失败'), icon: 'none' })
  }
}

function goToLogin() {
  uni.navigateTo({ url: LOGIN_PAGE })
}

function goToOrderDetail(orderId: string) {
  uni.navigateTo({ url: `/pages/order-detail/index?id=${orderId}` })
}

function updateSchedule(field: 'startDate' | 'startTime' | 'endDate' | 'endTime', value: string) {
  requestForm[field] = value
}

function pickPet(petId: string) {
  requestForm.petId = petId
  syncMatchQueryWithSelection()
}

async function loadMatches(showError = true) {
  try {
    const result = await matchCaregivers({
      ...matchQuery,
      city: matchQuery.city?.trim() || undefined,
    })
    caregivers.value = result.items
  }
  catch (error: unknown) {
    caregivers.value = []
    if (showError) {
      uni.showToast({
        title: getErrorMessage(error, '刷新推荐照料者失败'),
        icon: 'none',
      })
    }
  }
}

async function loadOwnerData(showError = true) {
  try {
    const [petRows, requestRows, orderRows] = await Promise.all([
      listPets(),
      listServiceRequests(),
      listOrders(),
    ])
    pets.value = petRows
    requests.value = requestRows
    orders.value = orderRows
    ensurePetSelection()
    syncMatchQueryWithSelection()
    await loadMatches(showError)
  }
  catch (error: unknown) {
    if (showError) {
      uni.showToast({
        title: getErrorMessage(error, '加载主人工作台失败'),
        icon: 'none',
      })
    }
  }
}

async function loadCaregiverOrders(showError = true) {
  try {
    const response = await listCaregiverOrders({
      page: 1,
      pageSize: 6,
      status: caregiverOrderFilter.value === 'ALL' ? undefined : caregiverOrderFilter.value,
    })
    caregiverOrders.value = response.items
  }
  catch (error: unknown) {
    caregiverOrders.value = []
    if (showError) {
      uni.showToast({
        title: getErrorMessage(error, '加载照料履约订单失败'),
        icon: 'none',
      })
    }
  }
}

async function loadCaregiverData(showError = true) {
  try {
    const [profile, services] = await Promise.all([
      getCaregiverProfile(),
      listCaregiverServices(),
    ])
    hydrateCaregiverProfile(profile)
    caregiverServices.value = services
    await loadCaregiverOrders(showError)
  }
  catch (error: unknown) {
    if (showError) {
      uni.showToast({
        title: getErrorMessage(error, '加载照料者工作台失败'),
        icon: 'none',
      })
    }
  }
}

async function reloadDashboard(showError = true) {
  if (!tokenStore.hasLogin || loading.value) {
    uni.stopPullDownRefresh()
    return
  }

  loading.value = true
  try {
    await Promise.all([
      userStore.fetchUserInfo().catch(() => undefined),
      loadOwnerData(showError),
      loadCaregiverData(showError),
    ])
  }
  finally {
    loading.value = false
    uni.stopPullDownRefresh()
  }
}

async function submitPet() {
  if (!petForm.name.trim()) {
    uni.showToast({ title: '请先填写宠物名称', icon: 'none' })
    return
  }

  creatingPet.value = true
  try {
    const payload = {
      name: petForm.name.trim(),
      species: petForm.species,
      gender: petForm.gender,
      breed: petForm.breed.trim() || undefined,
      birthday: petForm.birthday || undefined,
      weightKg: Number(petForm.weightKg || 0) || undefined,
      neutered: petForm.neutered === 'YES',
      temperamentTags: splitTagText(petTemperamentTagsText.value),
      feedingNote: petForm.feedingNote.trim() || undefined,
      allergyNote: petForm.allergyNote.trim() || undefined,
      medicalNote: petForm.medicalNote.trim() || undefined,
      emergencyContact: petForm.emergencyName.trim() && petForm.emergencyPhone.trim()
        ? {
            name: petForm.emergencyName.trim(),
            phone: petForm.emergencyPhone.trim(),
            relation: petForm.emergencyRelation.trim() || undefined,
          }
        : undefined,
    }

    if (editingPetId.value) {
      await updatePet(editingPetId.value, payload)
      uni.showToast({ title: '宠物档案已更新', icon: 'none' })
    } else {
      await createPet(payload)
      uni.showToast({ title: '宠物档案已保存', icon: 'none' })
    }

    resetPetForm()
    await loadOwnerData(false)
  }
  catch (error: unknown) {
    uni.showToast({ title: getErrorMessage(error, editingPetId.value ? '更新宠物失败' : '保存宠物失败'), icon: 'none' })
  }
  finally {
    creatingPet.value = false
  }
}

async function submitRequest() {
  if (!requestForm.petId) {
    uni.showToast({ title: '请先选择宠物', icon: 'none' })
    return
  }

  if (!requestForm.locationText.trim()) {
    uni.showToast({ title: '请填写服务地点', icon: 'none' })
    return
  }

  const startTime = dayjs(`${requestForm.startDate} ${requestForm.startTime}`)
  const endTime = dayjs(`${requestForm.endDate} ${requestForm.endTime}`)
  if (!startTime.isValid() || !endTime.isValid() || !endTime.isAfter(startTime)) {
    uni.showToast({ title: '请确认服务时间范围', icon: 'none' })
    return
  }

  creatingRequest.value = true
  try {
    await createServiceRequest({
      petId: requestForm.petId,
      serviceType: requestForm.serviceType,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      locationText: requestForm.locationText.trim(),
      budgetAmount: Number(requestForm.budgetAmount || 0) || undefined,
      demandTags: requestForm.demandTagsText
        .split(/[\n,，]/)
        .map(item => item.trim())
        .filter(Boolean),
    })
    requestForm.locationText = ''
    requestForm.demandTagsText = ''
    uni.showToast({ title: '服务需求已发布', icon: 'none' })
    await loadOwnerData(false)
  }
  catch (error: unknown) {
    uni.showToast({ title: getErrorMessage(error, '发布需求失败'), icon: 'none' })
  }
  finally {
    creatingRequest.value = false
  }
}

async function saveCaregiverProfile() {
  caregiverProfileSaving.value = true
  try {
    const profile = await upsertCaregiverProfile({
      intro: caregiverProfileForm.intro.trim() || undefined,
      experienceYears: Number(caregiverProfileForm.experienceYears || 0),
      serviceRadiusKm: Number(caregiverProfileForm.serviceRadiusKm || 0),
      serviceCity: caregiverProfileForm.serviceCity.trim() || undefined,
      specialtyTags: splitTagText(caregiverProfileForm.specialtyTagsText),
      serviceCommitment: caregiverProfileForm.serviceCommitment.trim() || undefined,
      qualificationMaterials: caregiverProfileForm.qualificationMaterials,
    })
    hydrateCaregiverProfile(profile)
    uni.showToast({ title: '照料者档案已保存', icon: 'none' })
  }
  catch (error: unknown) {
    uni.showToast({ title: getErrorMessage(error, '保存照料档案失败'), icon: 'none' })
  }
  finally {
    caregiverProfileSaving.value = false
  }
}

function startEditCaregiverService(service: CaregiverServiceRecord) {
  workspace.value = 'caregiver'
  editingCaregiverServiceId.value = service.id
  caregiverServiceForm.serviceType = service.serviceType
  caregiverServiceForm.petSpecies = service.petSpecies
  caregiverServiceForm.pricePerUnit = String(service.pricePerUnit)
  caregiverServiceForm.unitType = service.unitType
  caregiverServiceForm.minNoticeHours = String(service.minNoticeHours)
  caregiverServiceForm.serviceCity = service.serviceCity || ''
  caregiverServiceForm.isActive = service.isActive ? 'YES' : 'NO'
}

async function saveCaregiverService() {
  if (!caregiverServiceForm.unitType.trim()) {
    uni.showToast({ title: '请填写计价单位', icon: 'none' })
    return
  }

  const price = Number(caregiverServiceForm.pricePerUnit || 0)
  if (!Number.isFinite(price) || price <= 0) {
    uni.showToast({ title: '请填写有效的服务价格', icon: 'none' })
    return
  }

  caregiverServiceSaving.value = true
  try {
    const payload = {
      serviceType: caregiverServiceForm.serviceType,
      petSpecies: caregiverServiceForm.petSpecies,
      pricePerUnit: price,
      unitType: caregiverServiceForm.unitType.trim(),
      minNoticeHours: Number(caregiverServiceForm.minNoticeHours || 0) || 0,
      serviceCity: caregiverServiceForm.serviceCity.trim() || undefined,
      isActive: caregiverServiceForm.isActive === 'YES',
      availableSlots: [],
    }

    if (editingCaregiverServiceId.value) {
      await updateCaregiverService(editingCaregiverServiceId.value, payload)
      uni.showToast({ title: '服务配置已更新', icon: 'none' })
    }
    else {
      await createCaregiverService(payload)
      uni.showToast({ title: '服务配置已创建', icon: 'none' })
    }

    resetCaregiverServiceForm()
    caregiverServices.value = await listCaregiverServices()
    await loadMatches(false)
  }
  catch (error: unknown) {
    uni.showToast({ title: getErrorMessage(error, '保存服务配置失败'), icon: 'none' })
  }
  finally {
    caregiverServiceSaving.value = false
  }
}

async function runCaregiverOrderAction(
  key: string,
  successMessage: string,
  action: () => Promise<void>,
) {
  caregiverActionLoadingKey.value = key
  try {
    await action()
    uni.showToast({ title: successMessage, icon: 'none' })
    await Promise.all([
      loadCaregiverOrders(false),
      listOrders().then(rows => (orders.value = rows)).catch(() => undefined),
    ])
  }
  catch (error: unknown) {
    uni.showToast({ title: getErrorMessage(error, '履约操作失败'), icon: 'none' })
  }
  finally {
    caregiverActionLoadingKey.value = ''
  }
}

async function handleAcceptOrder(orderId: string) {
  await runCaregiverOrderAction(`accept:${orderId}`, '已接单', async () => {
    await acceptCaregiverOrder(orderId)
  })
}

async function handleCheckInOrder(orderId: string) {
  await runCaregiverOrderAction(`checkin:${orderId}`, '签到成功', async () => {
    await checkInCaregiverOrder(orderId, { note: '移动端签到' })
  })
}

async function handleCheckOutOrder(orderId: string) {
  await runCaregiverOrderAction(`checkout:${orderId}`, '签退成功', async () => {
    await checkOutCaregiverOrder(orderId, { note: '移动端签退' })
  })
}

function openServiceLogComposer(orderId: string) {
  activeServiceLogOrderId.value = orderId
  serviceLogForm.logType = 'NOTE'
  serviceLogForm.textNote = ''
}

function closeServiceLogComposer() {
  activeServiceLogOrderId.value = ''
  serviceLogForm.logType = 'NOTE'
  serviceLogForm.textNote = ''
}

async function submitServiceLog() {
  if (!activeServiceLogOrderId.value) {
    return
  }

  const textNote = serviceLogForm.textNote.trim()
  if (!textNote) {
    uni.showToast({ title: '请填写服务记录说明', icon: 'none' })
    return
  }

  serviceLogSubmitting.value = true
  caregiverActionLoadingKey.value = `log:${activeServiceLogOrderId.value}`
  try {
    await addCaregiverServiceLog(activeServiceLogOrderId.value, {
      logType: serviceLogForm.logType,
      textNote,
    })
    uni.showToast({ title: '服务记录已提交', icon: 'none' })
    closeServiceLogComposer()
    await Promise.all([
      loadCaregiverOrders(false),
      listOrders().then(rows => (orders.value = rows)).catch(() => undefined),
    ])
  }
  catch (error: unknown) {
    uni.showToast({ title: getErrorMessage(error, '提交服务记录失败'), icon: 'none' })
  }
  finally {
    serviceLogSubmitting.value = false
    caregiverActionLoadingKey.value = ''
  }
}

watch(() => requestForm.serviceType, () => {
  matchQuery.serviceType = requestForm.serviceType
})

watch(() => requestForm.petId, () => {
  syncMatchQueryWithSelection()
})

watch(caregiverOrderFilter, () => {
  if (tokenStore.hasLogin) {
    void loadCaregiverOrders(false)
  }
})

onShow(() => {
  if (!tokenStore.hasLogin) {
    return
  }
  void reloadDashboard(false)
})

onPullDownRefresh(() => {
  if (!tokenStore.hasLogin) {
    uni.stopPullDownRefresh()
    return
  }
  void reloadDashboard(true)
})
</script>

<template>
  <AppPageShell title="PetPal 工作台" :description="pageDescription">
    <template v-if="tokenStore.hasLogin">
      <AppSection title="今日概览" description="主人与照料者两套主流程都在这里直接完成。">
        <view class="petpal-hero">
          <view class="petpal-hero__badge">
            {{ workspace === 'owner' ? '主人模式' : '照料者模式' }}
          </view>
          <view class="petpal-hero__title">
            {{ displayName }}
          </view>
          <view class="petpal-hero__summary">
            {{
              workspace === 'owner'
                ? `当前有 ${activeOwnerOrderCount} 笔进行中订单，${disputeOrderCount} 笔需要额外关注的售后订单。`
                : `当前有 ${caregiverPendingCount} 笔待接单，${caregiverServingCount} 笔服务中订单需要持续反馈。`
            }}
          </view>
        </view>

        <view class="petpal-stats-grid">
          <view v-for="item in currentStats" :key="item.label" class="petpal-stat-card">
            <text class="petpal-stat-card__label">{{ item.label }}</text>
            <text class="petpal-stat-card__value">{{ item.value }}</text>
            <text class="petpal-stat-card__hint">{{ item.hint }}</text>
          </view>
        </view>
      </AppSection>

      <AppSection title="工作模式" description="在主人下单与照料履约之间快速切换。">
        <AppChoiceChips v-model="workspace" :options="workspaceOptions" />
        <view v-if="loading" class="petpal-status-wrap">
          <AppStatus mode="loading" text="正在同步 PetPal 工作台数据" />
        </view>
      </AppSection>

      <template v-if="workspace === 'owner'">
        <AppSection title="宠物档案" description="完善宠物基础资料，后续下单和匹配会自动复用。">
          <view class="petpal-form-block">
            <AppInput v-model="petForm.name" label="宠物名" placeholder="例如：可乐" />
            <AppInput v-model="petForm.breed" label="品种" placeholder="例如：柴犬 / 英短" />
            <AppInput v-model="petForm.birthday" label="生日" placeholder="例如：2024-05-06" />
            <AppInput v-model="petForm.weightKg" label="体重" placeholder="例如：5" type="digit" />

            <view class="petpal-form-group">
              <text class="petpal-form-group__label">宠物种类</text>
              <AppChoiceChips v-model="petForm.species" :options="speciesOptions" />
            </view>

            <view class="petpal-form-group">
              <text class="petpal-form-group__label">性别</text>
              <AppChoiceChips v-model="petForm.gender" :options="genderOptions" />
            </view>

            <view class="petpal-form-group">
              <text class="petpal-form-group__label">是否绝育</text>
              <AppChoiceChips v-model="petForm.neutered" :options="yesNoOptions" />
            </view>

            <AppInput v-model="petTemperamentTagsText" label="性格标签" placeholder="例如：亲人，胆小，活泼" />
            <textarea
              v-model="petForm.feedingNote"
              class="petpal-textarea"
              :maxlength="180"
              auto-height
              placeholder="喂养备注，例如饮食禁忌、换粮方式和作息"
            />
            <textarea
              v-model="petForm.allergyNote"
              class="petpal-textarea"
              :maxlength="180"
              auto-height
              placeholder="过敏提醒，例如食物或环境过敏"
            />
            <textarea
              v-model="petForm.medicalNote"
              class="petpal-textarea"
              :maxlength="240"
              auto-height
              placeholder="健康备注，例如年度体检、常用药或慢性病观察"
            />
            <AppInput v-model="petForm.emergencyName" label="紧急联系人" placeholder="例如：张三" />
            <AppInput v-model="petForm.emergencyPhone" label="联系电话" placeholder="例如：13800000000" />
            <AppInput v-model="petForm.emergencyRelation" label="关系" placeholder="例如：家人 / 邻居" />

            <view class="petpal-action-row">
              <AppButton :loading="creatingPet" @click="submitPet">
                {{ editingPetId ? '更新宠物档案' : '保存宠物档案' }}
              </AppButton>
              <AppButton v-if="editingPetId" size="medium" type="info" @click="resetPetForm">取消编辑</AppButton>
            </view>
          </view>

          <AppList v-if="pets.length">
            <AppListItem
              v-for="pet in pets"
              :key="pet.id"
              :title="pet.name"
              :label="`${speciesLabels[pet.species]} · ${genderLabels[pet.gender]}${pet.breed ? ` · ${pet.breed}` : ''}${pet.birthday ? ` · ${pet.birthday.slice(0, 10)}` : ''}`"
              :value="`${pet.weightKg || '-'}kg · ${formatPetTagSummary(pet.temperamentTags)}`"
              clickable
              @click="startEditPet(pet)"
            />
          </AppList>
          <view v-if="pets.length" class="petpal-inline-note">
            <text>
              点击宠物卡片可编辑健康档案；发布需求前可再点一次对应宠物，将其设为当前下单对象。
            </text>
          </view>
          <view v-else class="petpal-inline-note">
            <text>还没有宠物档案，先录入一只宠物再发布照料需求。</text>
          </view>
        </AppSection>

        <AppSection title="发布需求" description="直接指定服务类型、时间和地点，系统会同步刷新照料者推荐。">
          <view class="petpal-form-block">
            <view class="petpal-form-group">
              <text class="petpal-form-group__label">选择宠物</text>
              <AppChoiceChips
                v-if="petSelectionOptions.length"
                v-model="requestForm.petId"
                :options="petSelectionOptions"
              />
              <view v-else class="petpal-inline-note">
                <text>当前没有可用宠物档案。</text>
              </view>
            </view>

            <view class="petpal-form-group">
              <text class="petpal-form-group__label">服务类型</text>
              <AppChoiceChips v-model="requestForm.serviceType" :options="serviceTypeOptions" />
            </view>

            <view class="petpal-picker-grid">
              <view class="petpal-picker-cell">
                <text class="petpal-form-group__label">开始日期</text>
                <picker mode="date" :value="requestForm.startDate" @change="updateSchedule('startDate', $event.detail.value)">
                  <view class="petpal-picker">{{ requestForm.startDate }}</view>
                </picker>
              </view>
              <view class="petpal-picker-cell">
                <text class="petpal-form-group__label">开始时间</text>
                <picker mode="time" :value="requestForm.startTime" @change="updateSchedule('startTime', $event.detail.value)">
                  <view class="petpal-picker">{{ requestForm.startTime }}</view>
                </picker>
              </view>
              <view class="petpal-picker-cell">
                <text class="petpal-form-group__label">结束日期</text>
                <picker mode="date" :value="requestForm.endDate" @change="updateSchedule('endDate', $event.detail.value)">
                  <view class="petpal-picker">{{ requestForm.endDate }}</view>
                </picker>
              </view>
              <view class="petpal-picker-cell">
                <text class="petpal-form-group__label">结束时间</text>
                <picker mode="time" :value="requestForm.endTime" @change="updateSchedule('endTime', $event.detail.value)">
                  <view class="petpal-picker">{{ requestForm.endTime }}</view>
                </picker>
              </view>
            </view>

            <view class="petpal-inline-note">
              <text>预约时间：{{ requestScheduleSummary }}</text>
            </view>

            <AppInput v-model="requestForm.locationText" label="地点" placeholder="例如：上海市静安区南京西路" />
            <AppInput v-model="requestForm.budgetAmount" label="预算" placeholder="例如：200" type="digit" />
            <textarea
              v-model="requestForm.demandTagsText"
              class="petpal-textarea"
              :maxlength="120"
              auto-height
              placeholder="补充医嘱、性格、饮食习惯等关键词，使用逗号分隔"
            />
            <AppButton :loading="creatingRequest" @click="submitRequest">发布服务需求</AppButton>
          </view>
        </AppSection>

        <AppSection title="订单跟进" description="重点跟进服务中的订单，必要时进入详情页确认完成或处理售后。">
          <view v-if="orders.length" class="petpal-order-list">
            <view v-for="order in orders" :key="order.id" class="petpal-order-card">
              <view class="petpal-order-card__header">
                <text class="petpal-order-card__title">{{ order.orderNo }}</text>
                <text :class="['petpal-order-card__status', `is-${getOrderTone(order.orderStatus)}`]">
                  {{ getOrderStatusLabel(order.orderStatus) }}
                </text>
              </view>
              <text class="petpal-order-card__meta">
                {{ serviceTypeLabels[order.serviceType] }} · {{ formatRange(order.appointmentStart, order.appointmentEnd) }}
              </text>
              <text class="petpal-order-card__meta">
                实付 ¥{{ formatAmount(order.amountPaid) }} / 已退 ¥{{ formatAmount(order.amountRefunded) }}
              </text>
              <view class="petpal-action-row">
                <AppButton size="medium" type="info" @click="goToOrderDetail(order.id)">查看详情</AppButton>
              </view>
            </view>
          </view>
          <view v-else class="petpal-status-wrap">
            <AppStatus text="当前还没有主人侧订单" />
          </view>
        </AppSection>

        <AppSection title="需求记录" description="查看已发布需求的状态和确认进展。">
          <AppList v-if="requests.length">
            <AppListItem
              v-for="item in requests"
              :key="item.id"
              :title="`${item.pet?.name || '宠物'} · ${serviceTypeLabels[item.serviceType]}`"
              :label="`${item.locationText} · ${item.status}`"
              :value="formatRange(item.startTime, item.endTime)"
            />
          </AppList>
          <view v-else class="petpal-status-wrap">
            <AppStatus text="还没有发布过服务需求" />
          </view>
        </AppSection>

        <AppSection title="照料者推荐" description="根据服务类型、宠物种类和城市快速刷新推荐名单。">
          <view class="petpal-form-block">
            <view class="petpal-form-group">
              <text class="petpal-form-group__label">当前匹配类型</text>
              <AppChoiceChips v-model="matchQuery.serviceType" :options="serviceTypeOptions" />
            </view>
            <view class="petpal-form-group">
              <text class="petpal-form-group__label">宠物种类</text>
              <AppChoiceChips v-model="matchQuery.petSpecies" :options="speciesOptions" />
            </view>
            <AppInput v-model="matchQuery.city" label="城市" placeholder="例如：上海 / 杭州" />
            <AppButton type="info" @click="loadMatches(true)">刷新推荐照料者</AppButton>
          </view>

          <view v-if="caregivers.length" class="petpal-match-grid">
            <view v-for="caregiver in caregivers" :key="caregiver.serviceId" class="petpal-match-card">
              <view class="petpal-match-card__header">
                <text class="petpal-match-card__name">{{ caregiver.caregiverName }}</text>
                <text class="petpal-match-card__price">¥{{ formatAmount(caregiver.pricePerUnit) }}/{{ caregiver.unitType }}</text>
              </view>
              <text class="petpal-match-card__meta">
                {{ caregiver.city || '城市待完善' }} · 评分 {{ formatAmount(caregiver.ratingAvg) }} · {{ serviceTypeLabels[caregiver.serviceType] }}
              </text>
              <text class="petpal-match-card__meta">
                适配 {{ speciesLabels[caregiver.petSpecies] }}{{ caregiver.distanceKm !== null ? ` · 距离 ${formatAmount(caregiver.distanceKm)}km` : '' }}
              </text>
            </view>
          </view>
          <view v-else class="petpal-status-wrap">
            <AppStatus text="当前筛选条件下暂无推荐照料者" />
          </view>
        </AppSection>
      </template>

      <template v-else>
        <AppSection title="照料者档案" description="先补齐照料介绍、服务半径和常驻城市，再继续配置可售服务。">
          <view class="petpal-inline-note">
            <text>
              {{
                caregiverProfile
                  ? `当前审核状态：${getCaregiverAuditLabel(caregiverProfile.auditStatus)}。${caregiverAuditHint}`
                  : caregiverAuditHint
              }}
            </text>
          </view>

          <view class="petpal-form-block">
            <AppInput v-model="caregiverProfileForm.experienceYears" label="经验" placeholder="例如：3" type="digit" />
            <AppInput v-model="caregiverProfileForm.serviceRadiusKm" label="半径" placeholder="例如：8" type="digit" />
            <AppInput v-model="caregiverProfileForm.serviceCity" label="城市" placeholder="例如：杭州" />
            <AppInput v-model="caregiverProfileForm.specialtyTagsText" label="专长标签" placeholder="例如：幼宠，猫咪，异宠" />
            <textarea
              v-model="caregiverProfileForm.intro"
              class="petpal-textarea"
              :maxlength="240"
              auto-height
              placeholder="介绍你的照料经验、擅长宠物类型和服务风格"
            />
            <textarea
              v-model="caregiverProfileForm.serviceCommitment"
              class="petpal-textarea"
              :maxlength="180"
              auto-height
              placeholder="说明你的服务承诺，例如图文反馈频率、紧急响应方式"
            />
            <view class="petpal-inline-panel">
              <view class="petpal-inline-panel__header">
                <text class="petpal-inline-panel__title">资质材料</text>
                <text class="petpal-inline-panel__meta">
                  {{ caregiverProfileForm.qualificationMaterials.length }}/12 份
                </text>
              </view>
              <view class="petpal-action-row">
                <AppButton
                  size="medium"
                  type="info"
                  :loading="qualificationUploading"
                  :disabled="caregiverProfileForm.qualificationMaterials.length >= 12"
                  @click="uploadQualificationMaterials"
                >
                  上传资质图片
                </AppButton>
              </view>
              <AppList v-if="caregiverProfileForm.qualificationMaterials.length">
                <AppListItem
                  v-for="item in caregiverProfileForm.qualificationMaterials"
                  :key="item.fileId"
                  :title="item.name"
                  :label="`${item.mimeType} · ${Math.round(item.size / 1024)}KB`"
                  value="点按移除"
                  clickable
                  @click="removeQualificationMaterial(item.fileId)"
                />
              </AppList>
              <view v-else class="petpal-inline-note">
                <text>至少上传一份身份证明或培训资质图片，后台审核时会直接查看。</text>
              </view>
            </view>
            <AppButton :loading="caregiverProfileSaving" @click="saveCaregiverProfile">保存照料者档案</AppButton>
          </view>
        </AppSection>

        <AppSection title="服务配置" description="报价、服务种类和通知时效会直接影响主人侧的匹配结果。">
          <view class="petpal-form-block">
            <view class="petpal-form-group">
              <text class="petpal-form-group__label">服务类型</text>
              <AppChoiceChips v-model="caregiverServiceForm.serviceType" :options="serviceTypeOptions" />
            </view>

            <view class="petpal-form-group">
              <text class="petpal-form-group__label">适配宠物</text>
              <AppChoiceChips v-model="caregiverServiceForm.petSpecies" :options="speciesOptions" />
            </view>

            <AppInput v-model="caregiverServiceForm.pricePerUnit" label="报价" placeholder="例如：60" type="digit" />
            <AppInput v-model="caregiverServiceForm.unitType" label="单位" placeholder="例如：小时 / 次" />
            <AppInput v-model="caregiverServiceForm.minNoticeHours" label="提前量" placeholder="例如：2" type="digit" />
            <AppInput v-model="caregiverServiceForm.serviceCity" label="城市" placeholder="例如：杭州" />

            <view class="petpal-form-group">
              <text class="petpal-form-group__label">是否上架</text>
              <AppChoiceChips v-model="caregiverServiceForm.isActive" :options="yesNoOptions" />
            </view>

            <view class="petpal-action-row">
              <AppButton :loading="caregiverServiceSaving" @click="saveCaregiverService">
                {{ editingCaregiverServiceId ? '更新服务配置' : '新增服务配置' }}
              </AppButton>
              <AppButton v-if="editingCaregiverServiceId" size="medium" type="info" @click="resetCaregiverServiceForm">
                取消编辑
              </AppButton>
            </view>
          </view>

          <AppList v-if="caregiverServices.length">
            <AppListItem
              v-for="service in caregiverServices"
              :key="service.id"
              :title="`${serviceTypeLabels[service.serviceType]} · ${speciesLabels[service.petSpecies]}`"
              :label="`${service.serviceCity || '城市未设置'} · 提前 ${service.minNoticeHours} 小时 · ${service.isActive ? '已上架' : '已停用'}`"
              :value="`¥${formatAmount(service.pricePerUnit)}/${service.unitType}`"
              clickable
              @click="startEditCaregiverService(service)"
            />
          </AppList>
          <view v-else class="petpal-status-wrap">
            <AppStatus text="还没有配置照料服务" />
          </view>
        </AppSection>

        <AppSection title="履约订单" description="待接单、签到、服务记录和签退都在这里直接完成。">
          <view class="petpal-form-group">
            <text class="petpal-form-group__label">订单筛选</text>
            <AppChoiceChips v-model="caregiverOrderFilter" :options="caregiverOrderFilterOptions" />
          </view>

          <view v-if="currentServiceLogOrder" class="petpal-inline-panel">
            <view class="petpal-inline-panel__header">
              <text class="petpal-inline-panel__title">为 {{ currentServiceLogOrder.orderNo }} 记录服务</text>
              <text class="petpal-inline-panel__meta">{{ currentServiceLogOrder.petName || '宠物待补充' }} · {{ currentServiceLogOrder.ownerNickname }}</text>
            </view>

            <view class="petpal-form-group">
              <text class="petpal-form-group__label">记录类型</text>
              <AppChoiceChips v-model="serviceLogForm.logType" :options="serviceLogTypeOptions" />
            </view>

            <textarea
              v-model="serviceLogForm.textNote"
              class="petpal-textarea"
              :maxlength="240"
              auto-height
              placeholder="记录本次喂养、遛宠、互动或健康观察情况"
            />

            <view class="petpal-action-row">
              <AppButton size="medium" type="info" @click="closeServiceLogComposer">取消</AppButton>
              <AppButton size="medium" :loading="serviceLogSubmitting" @click="submitServiceLog">提交服务记录</AppButton>
            </view>
          </view>

          <view v-if="caregiverOrders.length" class="petpal-order-list">
            <view v-for="order in caregiverOrders" :key="order.id" class="petpal-order-card">
              <view class="petpal-order-card__header">
                <text class="petpal-order-card__title">{{ order.orderNo }}</text>
                <text :class="['petpal-order-card__status', `is-${getOrderTone(order.orderStatus)}`]">
                  {{ getOrderStatusLabel(order.orderStatus) }}
                </text>
              </view>
              <text class="petpal-order-card__meta">
                {{ order.petName || '宠物信息待补充' }} · {{ order.ownerNickname }} · {{ order.locationText || '地点待补充' }}
              </text>
              <text class="petpal-order-card__meta">
                {{ formatRange(order.appointmentStart, order.appointmentEnd) }} · 实收 ¥{{ formatAmount(order.amountPaid) }}
              </text>

              <view class="petpal-action-row">
                <AppButton
                  v-if="order.orderStatus === 'PENDING_ACCEPT'"
                  size="medium"
                  :loading="caregiverActionLoadingKey === `accept:${order.id}`"
                  @click="handleAcceptOrder(order.id)"
                >
                  接单
                </AppButton>
                <AppButton
                  v-if="order.orderStatus === 'ACCEPTED'"
                  size="medium"
                  :loading="caregiverActionLoadingKey === `checkin:${order.id}`"
                  @click="handleCheckInOrder(order.id)"
                >
                  签到
                </AppButton>
                <AppButton
                  v-if="order.orderStatus === 'SERVING'"
                  size="medium"
                  type="info"
                  @click="openServiceLogComposer(order.id)"
                >
                  记录服务
                </AppButton>
                <AppButton
                  v-if="order.orderStatus === 'SERVING'"
                  size="medium"
                  :loading="caregiverActionLoadingKey === `checkout:${order.id}`"
                  @click="handleCheckOutOrder(order.id)"
                >
                  签退
                </AppButton>
              </view>
            </view>
          </view>
          <view v-else class="petpal-status-wrap">
            <AppStatus text="当前筛选下没有照料履约订单" />
          </view>
        </AppSection>
      </template>
    </template>

    <template v-else>
      <AppSection title="开始使用 PetPal" description="登录后即可维护宠物档案、发布需求并接入照料者工作台。">
        <view class="petpal-status-wrap petpal-status-wrap--spacious">
          <AppStatus text="当前尚未登录 PetPal 账号。" />
        </view>
        <AppButton block @click="goToLogin">去登录</AppButton>
      </AppSection>
    </template>
  </AppPageShell>
</template>

<style scoped lang="scss">
.petpal-hero {
  display: grid;
  gap: 12rpx;
  padding: 28rpx;
  border-radius: 28rpx;
  background:
    radial-gradient(circle at top right, rgba(255, 200, 140, 0.38), transparent 36%),
    linear-gradient(135deg, #0f766e 0%, #115e59 48%, #164e63 100%);
  color: #f8fafc;
}

.petpal-hero__badge {
  width: fit-content;
  padding: 8rpx 16rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.16);
  font-size: 22rpx;
}

.petpal-hero__title {
  font-size: 42rpx;
  font-weight: 700;
}

.petpal-hero__summary {
  font-size: 24rpx;
  line-height: 1.7;
  color: rgba(248, 250, 252, 0.88);
}

.petpal-stats-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16rpx;
  margin-top: 20rpx;
}

.petpal-stat-card {
  display: grid;
  gap: 10rpx;
  padding: 22rpx;
  border-radius: 24rpx;
  border: 1rpx solid var(--app-border);
  background: linear-gradient(180deg, #ffffff 0%, #f7faf9 100%);
}

.petpal-stat-card__label {
  color: var(--app-text-muted);
  font-size: 22rpx;
}

.petpal-stat-card__value {
  color: var(--app-text);
  font-size: 40rpx;
  line-height: 1.05;
  font-weight: 700;
}

.petpal-stat-card__hint {
  color: var(--app-text-secondary);
  font-size: 22rpx;
  line-height: 1.6;
}

.petpal-form-block {
  display: grid;
  gap: 18rpx;
}

.petpal-form-group {
  display: grid;
  gap: 12rpx;
}

.petpal-form-group__label {
  color: var(--app-text-secondary);
  font-size: 24rpx;
  line-height: 1.5;
}

.petpal-picker-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16rpx;
}

.petpal-picker-cell {
  display: grid;
  gap: 12rpx;
}

.petpal-picker {
  min-height: 84rpx;
  display: flex;
  align-items: center;
  padding: 0 24rpx;
  border-radius: 20rpx;
  border: 1rpx solid var(--app-border);
  background: var(--app-surface);
  color: var(--app-text);
  box-sizing: border-box;
}

.petpal-textarea {
  width: 100%;
  min-height: 180rpx;
  padding: 24rpx;
  border-radius: 20rpx;
  border: 1rpx solid var(--app-border);
  background: var(--app-surface);
  color: var(--app-text);
  box-sizing: border-box;
  line-height: 1.7;
}

.petpal-inline-note {
  padding: 20rpx 24rpx;
  border-radius: 20rpx;
  background: #eefaf7;
  color: #125a54;
  font-size: 24rpx;
  line-height: 1.7;
}

.petpal-status-wrap {
  padding: 12rpx 0;
}

.petpal-status-wrap--spacious {
  padding-bottom: 28rpx;
}

.petpal-order-list,
.petpal-match-grid {
  display: grid;
  gap: 16rpx;
}

.petpal-order-card,
.petpal-match-card,
.petpal-inline-panel {
  display: grid;
  gap: 12rpx;
  padding: 24rpx;
  border-radius: 24rpx;
  border: 1rpx solid var(--app-border);
  background: linear-gradient(180deg, #ffffff 0%, #fbfcfb 100%);
}

.petpal-order-card__header,
.petpal-match-card__header,
.petpal-inline-panel__header {
  display: flex;
  justify-content: space-between;
  gap: 16rpx;
  align-items: flex-start;
}

.petpal-order-card__title,
.petpal-match-card__name,
.petpal-inline-panel__title {
  color: var(--app-text);
  font-size: 28rpx;
  line-height: 1.5;
  font-weight: 700;
}

.petpal-order-card__meta,
.petpal-match-card__meta,
.petpal-inline-panel__meta {
  color: var(--app-text-secondary);
  font-size: 22rpx;
  line-height: 1.7;
}

.petpal-order-card__status {
  flex-shrink: 0;
  padding: 8rpx 16rpx;
  border-radius: 999rpx;
  font-size: 20rpx;
  line-height: 1.2;
}

.petpal-order-card__status.is-neutral {
  background: #eff3f7;
  color: #4b5563;
}

.petpal-order-card__status.is-warning {
  background: #fff3e6;
  color: #b45309;
}

.petpal-order-card__status.is-success {
  background: #e8faf1;
  color: #15803d;
}

.petpal-order-card__status.is-danger {
  background: #feeceb;
  color: #c2410c;
}

.petpal-match-card__price {
  color: #0f766e;
  font-size: 26rpx;
  font-weight: 700;
}

.petpal-action-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.petpal-action-row .app-button {
  min-width: 176rpx;
}

@media (max-width: 680px) {
  .petpal-stats-grid,
  .petpal-picker-grid {
    grid-template-columns: 1fr;
  }
}
</style>
