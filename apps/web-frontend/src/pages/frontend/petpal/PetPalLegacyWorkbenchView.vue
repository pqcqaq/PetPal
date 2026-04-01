<template>
  <div class="frontend-page">
    <section class="frontend-page__hero">
      <p class="frontend-page__eyebrow">PetPal Legacy</p>
      <h1>宠托帮兼容工作台</h1>
      <p>这里保留主人与照料者混合视图，承接尚未完全拆出的导出、资质上传和高级履约操作。</p>
      <div class="frontend-page__hero-actions">
        <el-button type="primary" @click="reloadAll">刷新全部</el-button>
        <RouterLink class="frontend-page__button is-secondary" to="/login">登录后可提交请求</RouterLink>
      </div>
    </section>

    <section class="frontend-page__section-grid">
      <article class="frontend-card petpal-grid-span-4">
        <span class="frontend-card__eyebrow">宠物档案</span>
        <h3>{{ editingPetId ? '编辑宠物' : '新增宠物' }}</h3>
        <el-form :model="petForm" label-position="top" size="small">
          <el-form-item label="宠物名">
            <el-input v-model="petForm.name" placeholder="例如：可乐" />
          </el-form-item>
          <el-form-item label="物种">
            <el-select v-model="petForm.species" style="width: 100%">
              <el-option label="犬" value="DOG" />
              <el-option label="猫" value="CAT" />
              <el-option label="其他" value="OTHER" />
            </el-select>
          </el-form-item>
          <el-form-item label="品种">
            <el-input v-model="petForm.breed" placeholder="可选" />
          </el-form-item>
          <el-form-item label="生日">
            <el-date-picker
              v-model="petForm.birthday"
              type="date"
              value-format="YYYY-MM-DD"
              placeholder="可选"
              style="width: 100%"
            />
          </el-form-item>
          <el-form-item label="性别">
            <el-select v-model="petForm.gender" style="width: 100%">
              <el-option label="公" value="MALE" />
              <el-option label="母" value="FEMALE" />
              <el-option label="未知" value="UNKNOWN" />
            </el-select>
          </el-form-item>
          <el-form-item label="体重(kg)">
            <el-input-number v-model="petForm.weightKg" :min="0.1" :max="120" :precision="1" style="width: 100%" />
          </el-form-item>
          <el-form-item label="是否绝育">
            <el-switch v-model="petForm.neutered" />
          </el-form-item>
          <el-form-item label="性格标签">
            <el-input v-model="petTemperamentTagsText" placeholder="例如：亲人，活泼，胆小" />
          </el-form-item>
          <el-form-item label="喂养备注">
            <el-input v-model="petForm.feedingNote" type="textarea" :rows="2" placeholder="例如：早晚各一次，换粮要慢" />
          </el-form-item>
          <el-form-item label="过敏提醒">
            <el-input v-model="petForm.allergyNote" type="textarea" :rows="2" placeholder="例如：对鸡肉冻干过敏" />
          </el-form-item>
          <el-form-item label="健康备注">
            <el-input v-model="petForm.medicalNote" type="textarea" :rows="3" placeholder="例如：近期体检结果、常用药、就诊史" />
          </el-form-item>
          <el-form-item label="紧急联系人">
            <el-space direction="vertical" fill style="width: 100%">
              <el-input v-model="petForm.emergencyContact.name" placeholder="联系人姓名" />
              <el-input v-model="petForm.emergencyContact.phone" placeholder="联系电话" />
              <el-input v-model="petForm.emergencyContact.relation" placeholder="关系，可选" />
            </el-space>
          </el-form-item>
          <el-form-item>
            <el-space>
              <el-button type="primary" :loading="petSaving" @click="createPet">
                {{ editingPetId ? '更新宠物档案' : '保存宠物' }}
              </el-button>
              <el-button v-if="editingPetId" @click="resetPetForm">取消编辑</el-button>
            </el-space>
          </el-form-item>
        </el-form>
      </article>

      <article class="frontend-card petpal-grid-span-8">
        <span class="frontend-card__eyebrow">宠物列表</span>
        <h3>我的宠物</h3>
        <el-table :data="pets" size="small" v-loading="petsLoading">
          <el-table-column prop="name" label="名称" min-width="120" />
          <el-table-column prop="species" label="物种" min-width="100" />
          <el-table-column prop="breed" label="品种" min-width="120" />
          <el-table-column prop="birthday" label="生日" min-width="120">
            <template #default="scope">
              {{ scope.row.birthday ? scope.row.birthday.slice(0, 10) : '-' }}
            </template>
          </el-table-column>
          <el-table-column prop="weightKg" label="体重" min-width="100">
            <template #default="scope">
              {{ scope.row.weightKg ?? '-' }}
            </template>
          </el-table-column>
          <el-table-column label="性格标签" min-width="180" show-overflow-tooltip>
            <template #default="scope">
              {{ formatPetTagSummary(scope.row.temperamentTags) }}
            </template>
          </el-table-column>
          <el-table-column label="喂养/健康" min-width="260" show-overflow-tooltip>
            <template #default="scope">
              {{ [scope.row.feedingNote, scope.row.allergyNote, scope.row.medicalNote].filter(Boolean).join(' ｜ ') || '-' }}
            </template>
          </el-table-column>
          <el-table-column label="紧急联系人" min-width="220" show-overflow-tooltip>
            <template #default="scope">
              {{ formatEmergencyContact(scope.row.emergencyContact) }}
            </template>
          </el-table-column>
          <el-table-column prop="createdAt" label="创建时间" min-width="170">
            <template #default="scope">
              {{ formatTime(scope.row.createdAt) }}
            </template>
          </el-table-column>
          <el-table-column label="操作" min-width="120" fixed="right">
            <template #default="scope">
              <el-space>
                <el-button link type="primary" size="small" @click="startEditPet(scope.row)">编辑</el-button>
                <el-button link type="success" size="small" @click="requestForm.petId = scope.row.id">选中</el-button>
              </el-space>
            </template>
          </el-table-column>
        </el-table>
      </article>
    </section>

    <section class="frontend-page__section-grid">
      <article class="frontend-card petpal-grid-span-5">
        <span class="frontend-card__eyebrow">服务需求</span>
        <h3>发布需求</h3>
        <el-form :model="requestForm" label-position="top" size="small">
          <el-form-item label="宠物">
            <el-select v-model="requestForm.petId" style="width: 100%" placeholder="先创建宠物后再发布需求">
              <el-option v-for="pet in pets" :key="pet.id" :label="`${pet.name}(${pet.species})`" :value="pet.id" />
            </el-select>
          </el-form-item>
          <el-form-item label="服务类型">
            <el-select v-model="requestForm.serviceType" style="width: 100%">
              <el-option label="寄养" value="BOARDING" />
              <el-option label="遛宠" value="WALKING" />
              <el-option label="喂养" value="FEEDING" />
              <el-option label="上门" value="DOOR_VISIT" />
            </el-select>
          </el-form-item>
          <el-form-item label="开始时间">
            <el-date-picker v-model="requestForm.startTime" type="datetime" style="width: 100%" />
          </el-form-item>
          <el-form-item label="结束时间">
            <el-date-picker v-model="requestForm.endTime" type="datetime" style="width: 100%" />
          </el-form-item>
          <el-form-item label="地点描述">
            <el-input v-model="requestForm.locationText" placeholder="例如：上海市静安区" />
          </el-form-item>
          <el-form-item label="预算(元)">
            <el-input-number v-model="requestForm.budgetAmount" :min="1" :max="20000" style="width: 100%" />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" :loading="requestSaving" @click="createRequest">发布需求</el-button>
          </el-form-item>
        </el-form>
      </article>

      <article class="frontend-card petpal-grid-span-7">
        <span class="frontend-card__eyebrow">需求与订单</span>
        <div class="petpal-section-heading">
          <div class="petpal-section-heading__meta">
            <h3>当前业务进展</h3>
            <p v-if="auth.isAuthenticated" class="petpal-section-heading__hint">
              退款导出默认覆盖最近一年，可按退款日期、退款状态、投诉状态、投诉类型与投诉对象等收窄范围。
            </p>
          </div>
          <div v-if="auth.isAuthenticated" class="petpal-export-toolbar">
            <el-space wrap :size="10">
              <el-date-picker
                v-model="ownerRefundExportDateRange"
                type="daterange"
                unlink-panels
                clearable
                range-separator="至"
                start-placeholder="退款开始日期"
                end-placeholder="退款结束日期"
                size="small"
                style="width: min(100%, 320px)"
              />
              <el-select
                v-model="ownerRefundExportType"
                clearable
                placeholder="退款类型"
                size="small"
                style="width: 140px"
              >
                <el-option
                  v-for="option in refundTypeOptions"
                  :key="option.value"
                  :label="option.label"
                  :value="option.value"
                />
              </el-select>
              <el-select
                v-model="ownerRefundExportStatus"
                clearable
                placeholder="退款状态"
                size="small"
                style="width: 140px"
              >
                <el-option
                  v-for="option in refundStatusOptions"
                  :key="option.value"
                  :label="option.label"
                  :value="option.value"
                />
              </el-select>
              <el-select
                v-model="ownerRefundExportComplaintStatus"
                clearable
                placeholder="投诉状态"
                size="small"
                style="width: 140px"
              >
                <el-option
                  v-for="option in complaintStatusOptions"
                  :key="option.value"
                  :label="option.label"
                  :value="option.value"
                />
              </el-select>
              <el-select
                v-model="ownerRefundExportComplaintType"
                clearable
                placeholder="投诉类型"
                size="small"
                style="width: 140px"
              >
                <el-option
                  v-for="option in complaintTypeOptions"
                  :key="option.value"
                  :label="option.label"
                  :value="option.value"
                />
              </el-select>
              <el-select
                v-model="ownerRefundExportComplaintTargetRole"
                clearable
                placeholder="投诉对象"
                size="small"
                style="width: 140px"
              >
                <el-option
                  v-for="option in complaintTargetRoleOptions"
                  :key="option.value"
                  :label="option.label"
                  :value="option.value"
                />
              </el-select>
              <el-select
                v-model="ownerRefundExportServiceType"
                clearable
                placeholder="服务类型"
                size="small"
                style="width: 140px"
              >
                <el-option
                  v-for="option in refundExportServiceTypeOptions"
                  :key="option.value"
                  :label="option.label"
                  :value="option.value"
                />
              </el-select>
              <el-input
                v-model="ownerRefundExportOrderNoKeyword"
                clearable
                maxlength="64"
                placeholder="订单号关键词"
                size="small"
                style="width: min(100%, 180px)"
              />
            </el-space>
            <el-space wrap>
              <el-select
                v-model="selectedOwnerRefundExportTemplateId"
                clearable
                placeholder="常用筛选模板"
                size="small"
                style="width: 180px"
              >
                <el-option
                  v-for="template in ownerRefundExportTemplates"
                  :key="template.id"
                  :label="template.name"
                  :value="template.id"
                />
              </el-select>
              <el-button
                plain
                size="small"
                :disabled="!selectedOwnerRefundExportTemplateId"
                @click="applySelectedOwnerRefundExportTemplate"
              >
                应用模板
              </el-button>
              <el-button
                plain
                size="small"
                @click="saveCurrentOwnerRefundExportTemplate"
              >
                保存为模板
              </el-button>
              <el-button
                plain
                size="small"
                :disabled="!selectedOwnerRefundExportTemplateId"
                @click="deleteSelectedOwnerRefundExportTemplate"
              >
                删除模板
              </el-button>
              <el-button
                plain
                size="small"
                :disabled="!hasStoredOwnerRefundExportFilters"
                @click="restoreStoredOwnerRefundExportFilters"
              >
                恢复上次筛选
              </el-button>
              <el-button
                plain
                size="small"
                @click="clearOwnerRefundExportFilters"
              >
                清空筛选
              </el-button>
              <ListExportButton
                :request="buildOwnerTransactionExportRequest"
                label="导出近一年交易"
                pending-label="导出中"
                error-message="导出交易记录失败"
              />
              <ListExportButton
                :request="buildOwnerRefundExportRequest"
                label="导出退款明细"
                pending-label="导出中"
                error-message="导出退款明细失败"
              />
            </el-space>
          </div>
        </div>
        <el-space direction="vertical" fill :size="14" style="width: 100%">
          <el-table :data="requests" size="small" v-loading="requestsLoading">
            <el-table-column prop="pet.name" label="宠物" min-width="120" />
            <el-table-column prop="serviceType" label="服务" min-width="100" />
            <el-table-column prop="status" label="状态" min-width="100" />
            <el-table-column prop="locationText" label="地点" min-width="140" />
            <el-table-column prop="startTime" label="开始" min-width="170">
              <template #default="scope">
                {{ formatTime(scope.row.startTime) }}
              </template>
            </el-table-column>
          </el-table>

          <el-table :data="orders" size="small" v-loading="ordersLoading">
            <el-table-column prop="orderNo" label="订单号" min-width="180" />
            <el-table-column prop="orderStatus" label="状态" min-width="120">
              <template #default="scope">
                {{ getOrderStatusLabel(scope.row.orderStatus) }}
              </template>
            </el-table-column>
            <el-table-column prop="amountTotal" label="总额" min-width="100" />
            <el-table-column prop="amountPaid" label="已付" min-width="100" />
            <el-table-column prop="amountRefunded" label="已退" min-width="100" />
            <el-table-column label="订单沟通" min-width="280">
              <template #default="scope">
                <div class="petpal-conversation-cell">
                  <div class="petpal-conversation-cell__copy">
                    <p class="petpal-conversation-cell__preview">
                      {{ formatConversationPreview(scope.row.conversation) }}
                    </p>
                    <p class="petpal-conversation-cell__meta">
                      {{ formatConversationMeta(scope.row.conversation, 'owner') }}
                    </p>
                  </div>
                  <el-tag
                    v-if="getConversationUnreadCount(scope.row.conversation, 'owner') > 0"
                    type="danger"
                    size="small"
                  >
                    待读 {{ getConversationUnreadCount(scope.row.conversation, 'owner') }}
                  </el-tag>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="操作" min-width="180" fixed="right">
              <template #default="scope">
                <el-space>
                  <RouterLink :to="{ name: 'frontend-petpal-order-detail', params: { id: scope.row.id } }">
                    <el-button link type="primary" size="small">查看详情</el-button>
                  </RouterLink>
                  <el-button
                    v-if="scope.row.orderStatus === 'SERVING'"
                    link
                    type="success"
                    size="small"
                    :loading="caregiverActionLoadingKey === `confirm:${scope.row.id}`"
                    @click="confirmOrderComplete(scope.row.id)"
                  >
                    确认完成
                  </el-button>
                </el-space>
              </template>
            </el-table-column>
          </el-table>
        </el-space>
      </article>
    </section>

    <section class="frontend-card">
      <span class="frontend-card__eyebrow">匹配照料者</span>
      <h3>按服务类型和宠物种类快速筛选</h3>
      <el-form :inline="true" :model="matchQuery" size="small" class="petpal-match-form">
        <el-form-item label="服务">
          <el-select v-model="matchQuery.serviceType" style="width: 140px">
            <el-option label="寄养" value="BOARDING" />
            <el-option label="遛宠" value="WALKING" />
            <el-option label="喂养" value="FEEDING" />
            <el-option label="上门" value="DOOR_VISIT" />
          </el-select>
        </el-form-item>
        <el-form-item label="宠物种类">
          <el-select v-model="matchQuery.petSpecies" style="width: 120px">
            <el-option label="犬" value="DOG" />
            <el-option label="猫" value="CAT" />
            <el-option label="其他" value="OTHER" />
          </el-select>
        </el-form-item>
        <el-form-item label="城市">
          <el-input v-model="matchQuery.city" placeholder="可选" style="width: 180px" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="matchLoading" @click="loadMatches">开始匹配</el-button>
        </el-form-item>
      </el-form>

      <el-table :data="matchItems" size="small" v-loading="matchLoading">
        <el-table-column prop="caregiverName" label="照料者" min-width="140" />
        <el-table-column prop="city" label="城市" min-width="120" />
        <el-table-column prop="pricePerUnit" label="价格" min-width="100" />
        <el-table-column prop="unitType" label="计价单位" min-width="120" />
        <el-table-column prop="ratingAvg" label="评分" min-width="100" />
        <el-table-column prop="distanceKm" label="距离(km)" min-width="120">
          <template #default="scope">
            {{ scope.row.distanceKm ?? '-' }}
          </template>
        </el-table-column>
      </el-table>
    </section>

    <section class="frontend-page__section-grid">
      <article class="frontend-card petpal-grid-span-5">
        <span class="frontend-card__eyebrow">照料者入驻</span>
        <h3>照料者档案</h3>
        <el-form :model="caregiverProfileForm" label-position="top" size="small">
          <el-form-item label="简介">
            <el-input v-model="caregiverProfileForm.intro" type="textarea" :rows="3" placeholder="介绍照料经验与服务风格" />
          </el-form-item>
          <el-form-item label="经验年限">
            <el-input-number v-model="caregiverProfileForm.experienceYears" :min="0" :max="60" style="width: 100%" />
          </el-form-item>
          <el-form-item label="服务半径(km)">
            <el-input-number v-model="caregiverProfileForm.serviceRadiusKm" :min="1" :max="100" style="width: 100%" />
          </el-form-item>
          <el-form-item label="服务城市">
            <el-input v-model="caregiverProfileForm.serviceCity" placeholder="例如：杭州" />
          </el-form-item>
          <el-form-item label="专长标签">
            <el-input
              v-model="caregiverProfileForm.specialtyTagsText"
              placeholder="例如：幼宠看护，猫咪喂养，异宠熟悉"
            />
          </el-form-item>
          <el-form-item label="服务承诺">
            <el-input
              v-model="caregiverProfileForm.serviceCommitment"
              type="textarea"
              :rows="3"
              placeholder="例如：支持每日两次图文反馈，紧急情况第一时间联系主人"
            />
          </el-form-item>
          <el-form-item label="资质材料">
            <div class="petpal-qualification-panel">
              <div class="petpal-qualification-panel__actions">
                <input
                  ref="qualificationUploadInput"
                  type="file"
                  multiple
                  class="petpal-hidden-file-input"
                  accept="image/*,.pdf"
                  @change="onQualificationFilesChange"
                >
                <el-button
                  plain
                  :loading="qualificationUploading"
                  :disabled="caregiverProfileForm.qualificationMaterials.length >= 12"
                  @click="openQualificationFilePicker"
                >
                  上传资质材料
                </el-button>
                <span class="petpal-qualification-panel__hint">
                  已上传 {{ caregiverProfileForm.qualificationMaterials.length }}/12 份
                </span>
              </div>

              <el-progress
                v-if="qualificationUploadProgress !== null"
                :percentage="qualificationUploadProgress"
                :status="qualificationUploadProgress >= 100 ? 'success' : undefined"
              />

              <div v-if="caregiverProfileForm.qualificationMaterials.length" class="petpal-qualification-list">
                <div
                  v-for="item in caregiverProfileForm.qualificationMaterials"
                  :key="item.fileId"
                  class="petpal-qualification-item"
                >
                  <div class="petpal-qualification-item__copy">
                    <strong>{{ item.name }}</strong>
                    <span>{{ item.mimeType }} · {{ Math.round(item.size / 1024) }} KB</span>
                  </div>
                  <el-space>
                    <el-button link type="primary" size="small" @click="openExternalLink(item.url)">
                      预览
                    </el-button>
                    <el-button link type="danger" size="small" @click="removeQualificationMaterial(item.fileId)">
                      移除
                    </el-button>
                  </el-space>
                </div>
              </div>
            </div>
          </el-form-item>
          <el-form-item>
            <el-space>
              <el-button type="primary" :loading="caregiverProfileSaving" @click="saveCaregiverProfile">保存档案</el-button>
              <el-tag :type="caregiverProfile?.auditStatus === 'APPROVED' ? 'success' : (caregiverProfile?.auditStatus === 'REJECTED' ? 'danger' : 'warning')">
                审核状态：{{ caregiverProfile?.auditStatus || 'PENDING' }}
              </el-tag>
            </el-space>
          </el-form-item>
        </el-form>
      </article>

      <article class="frontend-card petpal-grid-span-7">
        <span class="frontend-card__eyebrow">服务设置</span>
        <h3>新增照料服务</h3>
        <el-form :model="caregiverServiceForm" label-position="top" size="small">
          <el-row :gutter="12">
            <el-col :span="8">
              <el-form-item label="服务类型">
                <el-select v-model="caregiverServiceForm.serviceType" style="width: 100%">
                  <el-option label="寄养" value="BOARDING" />
                  <el-option label="遛宠" value="WALKING" />
                  <el-option label="喂养" value="FEEDING" />
                  <el-option label="上门" value="DOOR_VISIT" />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="宠物种类">
                <el-select v-model="caregiverServiceForm.petSpecies" style="width: 100%">
                  <el-option label="犬" value="DOG" />
                  <el-option label="猫" value="CAT" />
                  <el-option label="其他" value="OTHER" />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="价格">
                <el-input-number v-model="caregiverServiceForm.pricePerUnit" :min="1" :max="10000" style="width: 100%" />
              </el-form-item>
            </el-col>
          </el-row>
          <el-row :gutter="12">
            <el-col :span="8">
              <el-form-item label="计价单位">
                <el-input v-model="caregiverServiceForm.unitType" placeholder="例如：HOUR" />
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="最短提前小时">
                <el-input-number v-model="caregiverServiceForm.minNoticeHours" :min="0" :max="168" style="width: 100%" />
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="服务城市">
                <el-input v-model="caregiverServiceForm.serviceCity" placeholder="例如：杭州" />
              </el-form-item>
            </el-col>
          </el-row>
          <el-form-item>
            <el-button type="primary" :loading="caregiverServiceSaving" @click="createCaregiverService">新增服务</el-button>
          </el-form-item>
        </el-form>

        <el-table :data="caregiverServices" size="small">
          <el-table-column prop="serviceType" label="服务" min-width="100" />
          <el-table-column prop="petSpecies" label="宠物" min-width="80" />
          <el-table-column prop="pricePerUnit" label="价格" min-width="100" />
          <el-table-column prop="unitType" label="单位" min-width="100" />
          <el-table-column prop="serviceCity" label="城市" min-width="100" />
          <el-table-column prop="isActive" label="启用" min-width="80">
            <template #default="scope">{{ scope.row.isActive ? '是' : '否' }}</template>
          </el-table-column>
        </el-table>
      </article>
    </section>

    <section class="frontend-card">
      <span class="frontend-card__eyebrow">履约工作台</span>
      <h3>照料者订单与动作</h3>
      <el-space wrap style="margin-bottom: 12px">
        <el-select v-model="caregiverOrderQuery.status" style="width: 160px" @change="loadCaregiverOrders">
          <el-option label="全部状态" value="" />
          <el-option label="待接单" value="PENDING_ACCEPT" />
          <el-option label="已接单" value="ACCEPTED" />
          <el-option label="服务中" value="SERVING" />
          <el-option label="已完成" value="COMPLETED" />
        </el-select>
        <el-button @click="loadCaregiverOrders">刷新履约列表</el-button>
      </el-space>

      <el-table :data="caregiverOrders" size="small" v-loading="caregiverOrdersLoading">
        <el-table-column prop="orderNo" label="订单号" min-width="160" />
        <el-table-column prop="ownerNickname" label="主人" min-width="120" />
        <el-table-column prop="petName" label="宠物" min-width="120" />
        <el-table-column prop="locationText" label="地点" min-width="160" />
        <el-table-column prop="appointmentStart" label="预约开始" min-width="170">
          <template #default="scope">
            {{ formatTime(scope.row.appointmentStart) }}
          </template>
        </el-table-column>
        <el-table-column prop="orderStatus" label="状态" min-width="120">
          <template #default="scope">
            {{ getOrderStatusLabel(scope.row.orderStatus) }}
          </template>
        </el-table-column>
        <el-table-column label="订单沟通" min-width="280">
          <template #default="scope">
            <div class="petpal-conversation-cell">
              <div class="petpal-conversation-cell__copy">
                <p class="petpal-conversation-cell__preview">
                  {{ formatConversationPreview(scope.row.conversation) }}
                </p>
                <p class="petpal-conversation-cell__meta">
                  {{ formatConversationMeta(scope.row.conversation, 'caregiver') }}
                </p>
              </div>
              <el-tag
                v-if="getConversationUnreadCount(scope.row.conversation, 'caregiver') > 0"
                type="danger"
                size="small"
              >
                待读 {{ getConversationUnreadCount(scope.row.conversation, 'caregiver') }}
              </el-tag>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="动作" min-width="320" fixed="right">
          <template #default="scope">
            <el-space wrap>
              <el-button
                v-if="scope.row.orderStatus === 'PENDING_ACCEPT'"
                link
                type="primary"
                size="small"
                :loading="caregiverActionLoadingKey === `accept:${scope.row.id}`"
                @click="acceptCaregiverOrder(scope.row.id)"
              >
                接单
              </el-button>
              <el-button
                v-if="scope.row.orderStatus === 'ACCEPTED'"
                link
                type="warning"
                size="small"
                :loading="caregiverActionLoadingKey === `checkin:${scope.row.id}`"
                @click="checkInCaregiverOrder(scope.row.id)"
              >
                签到
              </el-button>
              <el-button
                v-if="scope.row.orderStatus === 'SERVING'"
                link
                type="primary"
                size="small"
                :loading="caregiverActionLoadingKey === `log:${scope.row.id}`"
                @click="openCaregiverServiceLogDialog(scope.row.id)"
              >
                服务记录
              </el-button>
              <el-button
                v-if="scope.row.orderStatus === 'SERVING'"
                link
                type="success"
                size="small"
                :loading="caregiverActionLoadingKey === `checkout:${scope.row.id}`"
                @click="checkOutCaregiverOrder(scope.row.id)"
              >
                签退
              </el-button>
              <RouterLink :to="{ name: 'frontend-petpal-order-detail', params: { id: scope.row.id } }">
                <el-button link type="info" size="small">详情</el-button>
              </RouterLink>
            </el-space>
          </template>
        </el-table-column>
      </el-table>
    </section>

    <el-dialog
      v-model="serviceLogDialogVisible"
      title="新增服务记录"
      width="680px"
      :close-on-click-modal="!serviceLogSubmitting"
      :close-on-press-escape="!serviceLogSubmitting"
      @closed="resetServiceLogDialog"
    >
      <el-form label-position="top">
        <el-form-item label="记录类型">
          <el-select v-model="serviceLogForm.logType" style="width: 100%">
            <el-option
              v-for="option in serviceLogTypeOptions"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="文字说明">
          <el-input
            v-model="serviceLogForm.textNote"
            type="textarea"
            :rows="4"
            maxlength="500"
            show-word-limit
            placeholder="例如：已遛狗 30 分钟，饮水正常，情绪稳定"
          />
        </el-form-item>

        <el-form-item label="服务媒体">
          <div class="petpal-service-log-dialog__upload">
            <template v-if="canUploadServiceLogMedia">
              <input
                ref="serviceLogFileInput"
                type="file"
                multiple
                accept="image/*,video/*"
                class="petpal-service-log-dialog__file-input"
                @change="onServiceLogFilesChange"
              />
              <div class="petpal-service-log-dialog__actions">
                <el-button :disabled="serviceLogSubmitting" @click="openServiceLogFilePicker">选择图片或视频</el-button>
                <el-button
                  v-if="serviceLogForm.files.length > 0"
                  link
                  type="danger"
                  :disabled="serviceLogSubmitting"
                  @click="clearServiceLogFiles"
                >
                  清空媒体
                </el-button>
              </div>
            </template>
            <p v-else class="petpal-service-log-dialog__hint is-warning">
              当前账号暂未开通服务记录媒体上传能力，可先提交纯文字服务记录；如需补充图片或视频，请先完成照料者审核或联系管理员开通。
            </p>

            <ul v-if="serviceLogForm.files.length > 0" class="petpal-service-log-dialog__file-list">
              <li
                v-for="(file, index) in serviceLogForm.files"
                :key="`${file.name}-${file.size}-${index}`"
                class="petpal-service-log-dialog__file-item"
              >
                <div class="petpal-service-log-dialog__file-meta">
                  <strong>{{ file.name }}</strong>
                  <span>{{ file.type || 'application/octet-stream' }} · {{ formatFileSize(file.size) }}</span>
                </div>
                <el-button
                  link
                  type="danger"
                  :disabled="serviceLogSubmitting"
                  @click="removeServiceLogFile(index)"
                >
                  移除
                </el-button>
              </li>
            </ul>
            <div v-else-if="canUploadServiceLogMedia" class="petpal-service-log-dialog__empty">
              可选上传图片或视频，保存后会附加到本次服务记录。
            </div>
          </div>
        </el-form-item>

        <el-form-item v-if="serviceLogUploadProgress !== null" label="上传进度">
          <el-progress
            :percentage="serviceLogUploadProgress"
            :status="serviceLogUploadProgress >= 100 ? 'success' : undefined"
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button :disabled="serviceLogSubmitting" @click="serviceLogDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="serviceLogSubmitting" @click="submitCaregiverServiceLog">
          保存记录
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import type {
  CaregiverQualificationMaterialRecord,
  CaregiverOrderRecord,
  CaregiverProfileRecord,
  CaregiverServiceRecord,
  ComplaintTargetRole,
  ComplaintStatus,
  ComplaintType,
  CreatePetPayload,
  CreateServiceRequestPayload,
  MatchCaregiverQuery,
  MatchedCaregiverRecord,
  OrderRecord,
  OwnerRefundExportQuery,
  OrderStatus,
  PetGender,
  PetProfileRecord,
  PetSpecies,
  RefundType,
  PetServiceType,
  RefundStatus,
  ServiceRequestRecord,
  ServiceLogType,
} from '@rbac/api-common';
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { api } from '@/api/client';
import ListExportButton from '@/components/download/ListExportButton.vue';
import { useAuthStore } from '@/stores/auth';
import { useWorkbenchStore } from '@/stores/workbench';
import { uploadAttachmentFile } from '@/utils/direct-upload';
import { getErrorMessage } from '@/utils/errors';

defineOptions({
  name: 'PetPalLegacyWorkbenchView',
});

type PetFormState = {
  name: string;
  species: PetSpecies;
  gender: PetGender;
  breed: string;
  birthday: string;
  weightKg: number;
  neutered: boolean;
  temperamentTags: string[];
  feedingNote: string;
  allergyNote: string;
  medicalNote: string;
  emergencyContact: {
    name: string;
    phone: string;
    relation: string;
  };
};

type CaregiverProfileFormState = {
  intro: string;
  experienceYears: number;
  serviceRadiusKm: number;
  serviceCity: string;
  specialtyTagsText: string;
  serviceCommitment: string;
  qualificationMaterials: CaregiverQualificationMaterialRecord[];
};

const pets = ref<PetProfileRecord[]>([]);
const requests = ref<ServiceRequestRecord[]>([]);
const orders = ref<OrderRecord[]>([]);
const matchItems = ref<MatchedCaregiverRecord[]>([]);
const caregiverProfile = ref<CaregiverProfileRecord | null>(null);
const caregiverServices = ref<CaregiverServiceRecord[]>([]);
const caregiverOrders = ref<CaregiverOrderRecord[]>([]);
const editingPetId = ref('');
const qualificationUploadInput = ref<HTMLInputElement | null>(null);
const petTemperamentTagsText = ref('');
const auth = useAuthStore();
const workbench = useWorkbenchStore();

const petsLoading = ref(false);
const requestsLoading = ref(false);
const ordersLoading = ref(false);
const matchLoading = ref(false);
const petSaving = ref(false);
const requestSaving = ref(false);
const caregiverProfileSaving = ref(false);
const caregiverServiceSaving = ref(false);
const caregiverOrdersLoading = ref(false);
const caregiverActionLoadingKey = ref('');
const qualificationUploading = ref(false);
const qualificationUploadProgress = ref<number | null>(null);

const petForm = reactive<PetFormState>({
  name: '',
  species: 'DOG',
  gender: 'UNKNOWN',
  breed: '',
  birthday: '',
  weightKg: 5,
  neutered: false,
  temperamentTags: [],
  feedingNote: '',
  allergyNote: '',
  medicalNote: '',
  emergencyContact: {
    name: '',
    phone: '',
    relation: '',
  },
});

const requestForm = reactive<{
  petId: string;
  serviceType: CreateServiceRequestPayload['serviceType'];
  startTime: Date;
  endTime: Date;
  locationText: string;
  budgetAmount: number;
}>({
  petId: '',
  serviceType: 'BOARDING',
  startTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
  endTime: new Date(Date.now() + 48 * 60 * 60 * 1000),
  locationText: '',
  budgetAmount: 200,
});

const matchQuery = reactive<MatchCaregiverQuery>({
  serviceType: 'BOARDING',
  petSpecies: 'DOG',
  city: '',
  page: 1,
  pageSize: 10,
});

const caregiverProfileForm = reactive<CaregiverProfileFormState>({
  intro: '',
  experienceYears: 0,
  serviceRadiusKm: 5,
  serviceCity: '',
  specialtyTagsText: '',
  serviceCommitment: '',
  qualificationMaterials: [],
});

const caregiverServiceForm = reactive({
  serviceType: 'BOARDING' as CreateServiceRequestPayload['serviceType'],
  petSpecies: 'DOG' as 'DOG' | 'CAT' | 'OTHER',
  pricePerUnit: 50,
  unitType: 'HOUR',
  minNoticeHours: 2,
  serviceCity: '',
  serviceLat: undefined as number | undefined,
  serviceLng: undefined as number | undefined,
  isActive: true,
});

const caregiverOrderQuery = reactive<{
  page: number;
  pageSize: number;
  status: OrderStatus | '';
}>({
  page: 1,
  pageSize: 10,
  status: 'PENDING_ACCEPT',
});

const serviceLogTypeOptions: Array<{ label: string; value: ServiceLogType }> = [
  { label: '服务备注', value: 'NOTE' },
  { label: '喂养记录', value: 'FEED' },
  { label: '遛宠记录', value: 'WALK' },
  { label: '陪玩记录', value: 'PLAY' },
  { label: '健康观察', value: 'HEALTH' },
];

const createEmptyServiceLogForm = () => ({
  orderId: '',
  logType: 'NOTE' as ServiceLogType,
  textNote: '',
  files: [] as File[],
});

const serviceLogDialogVisible = ref(false);
const serviceLogSubmitting = ref(false);
const serviceLogUploadProgress = ref<number | null>(null);
const serviceLogFileInput = ref<HTMLInputElement | null>(null);
const serviceLogForm = reactive(createEmptyServiceLogForm());
const canUploadServiceLogMedia = computed(() =>
  auth.hasPermission('file.upload') || caregiverProfile.value?.auditStatus === 'APPROVED',
);

const formatTime = (value: string) => new Date(value).toLocaleString();
const formatFileSize = (size: number) => {
  if (size < 1024) {
    return `${size} B`;
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};
const getOrderStatusLabel = (status: OrderStatus) => ({
  PENDING_ACCEPT: '待接单',
  ACCEPTED: '已接单',
  SERVING: '服务中',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
  DISPUTED: '纠纷中',
  PARTIAL_REFUNDED: '部分退款',
  REFUNDED: '已退款',
}[status] ?? status);

const getConversationUnreadCount = (
  conversation: OrderRecord['conversation'] | null | undefined,
  role: 'owner' | 'caregiver',
) => {
  if (!conversation) {
    return 0;
  }
  return role === 'owner' ? conversation.ownerUnreadCount : conversation.caregiverUnreadCount;
};

const formatConversationPreview = (conversation: OrderRecord['conversation'] | null | undefined) => {
  const preview = conversation?.lastMessagePreview?.trim();
  if (preview) {
    return preview;
  }
  if (conversation?.lastMessageAt) {
    return '最近更新了一条附件或简短消息';
  }
  return '暂未开始订单沟通，可进入详情页发送消息。';
};

const formatConversationMeta = (
  conversation: OrderRecord['conversation'] | null | undefined,
  role: 'owner' | 'caregiver',
) => {
  const unreadCount = getConversationUnreadCount(conversation, role);
  const unreadText = unreadCount > 0 ? `${unreadCount} 条未读` : '已读完';
  if (conversation?.lastMessageAt) {
    return `${formatTime(conversation.lastMessageAt)} · ${unreadText}`;
  }
  return unreadCount > 0 ? unreadText : '暂无沟通记录';
};

const refundStatusOptions: Array<{ label: string; value: RefundStatus }> = [
  { label: '待审核', value: 'PENDING' },
  { label: '已审核', value: 'APPROVED' },
  { label: '已驳回', value: 'REJECTED' },
  { label: '退款成功', value: 'SUCCESS' },
  { label: '退款失败', value: 'FAILED' },
];

const refundTypeOptions: Array<{ label: string; value: RefundType }> = [
  { label: '全额退款', value: 'FULL' },
  { label: '部分退款', value: 'PARTIAL' },
];

const complaintStatusOptions: Array<{ label: string; value: ComplaintStatus }> = [
  { label: '待处理', value: 'OPEN' },
  { label: '处理中', value: 'PROCESSING' },
  { label: '已解决', value: 'RESOLVED' },
  { label: '已驳回', value: 'REJECTED' },
];

const complaintTypeOptions: Array<{ label: string; value: ComplaintType }> = [
  { label: '安全问题', value: 'SAFETY' },
  { label: '费用争议', value: 'FEE' },
  { label: '服务质量', value: 'SERVICE' },
  { label: '欺诈风险', value: 'FRAUD' },
  { label: '其他问题', value: 'OTHER' },
];

const complaintTargetRoleOptions: Array<{ label: string; value: ComplaintTargetRole }> = [
  { label: '照料者', value: 'CAREGIVER' },
  { label: '平台', value: 'PLATFORM' },
];

const refundExportServiceTypeOptions: Array<{ label: string; value: PetServiceType }> = [
  { label: '寄养', value: 'BOARDING' },
  { label: '遛宠', value: 'WALKING' },
  { label: '喂养', value: 'FEEDING' },
  { label: '上门陪伴', value: 'DOOR_VISIT' },
];

const OWNER_REFUND_EXPORT_FILTER_PAGE_STATE_KEY = 'page:petpal:owner-refund-export-filters';
const OWNER_REFUND_EXPORT_FILTER_STORAGE_KEY = 'petpal-owner-refund-export-filters-v2';
const OWNER_REFUND_EXPORT_FILTER_LEGACY_STORAGE_KEY = 'petpal-owner-refund-export-filters-v1';
const OWNER_REFUND_EXPORT_TEMPLATE_LIMIT = 5;

type OwnerRefundExportFilterSnapshot = {
  ownerUserId: string;
  dateRange: [string, string] | null;
  refundType: RefundType | '';
  refundStatus: RefundStatus | '';
  complaintStatus: ComplaintStatus | '';
  complaintType: ComplaintType | '';
  complaintTargetRole: ComplaintTargetRole | '';
  serviceType: PetServiceType | '';
  orderNoKeyword: string;
};

type OwnerRefundExportFilterTemplate = {
  id: string;
  name: string;
  snapshot: OwnerRefundExportFilterSnapshot;
  updatedAt: string;
};

type OwnerRefundExportFilterStorageEntry = {
  lastUsed: OwnerRefundExportFilterSnapshot | null;
  templates: OwnerRefundExportFilterTemplate[];
};

type OwnerRefundExportFilterStorage = {
  version: 2;
  users: Record<string, OwnerRefundExportFilterStorageEntry>;
};

const ownerRefundExportDateRange = ref<[Date, Date] | null>(null);
const ownerRefundExportType = ref<RefundType | ''>('');
const ownerRefundExportStatus = ref<RefundStatus | ''>('');
const ownerRefundExportComplaintStatus = ref<ComplaintStatus | ''>('');
const ownerRefundExportComplaintType = ref<ComplaintType | ''>('');
const ownerRefundExportComplaintTargetRole = ref<ComplaintTargetRole | ''>('');
const ownerRefundExportServiceType = ref<PetServiceType | ''>('');
const ownerRefundExportOrderNoKeyword = ref('');
const hasStoredOwnerRefundExportFilters = ref(false);
const ownerRefundExportTemplates = ref<OwnerRefundExportFilterTemplate[]>([]);
const selectedOwnerRefundExportTemplateId = ref('');

const toDayBoundaryIsoString = (value: Date, boundary: 'start' | 'end') => {
  const next = new Date(value);
  if (boundary === 'start') {
    next.setHours(0, 0, 0, 0);
  } else {
    next.setHours(23, 59, 59, 999);
  }
  return next.toISOString();
};

const resetOwnerRefundExportFilters = () => {
  ownerRefundExportDateRange.value = null;
  ownerRefundExportType.value = '';
  ownerRefundExportStatus.value = '';
  ownerRefundExportComplaintStatus.value = '';
  ownerRefundExportComplaintType.value = '';
  ownerRefundExportComplaintTargetRole.value = '';
  ownerRefundExportServiceType.value = '';
  ownerRefundExportOrderNoKeyword.value = '';
};

const createEmptyOwnerRefundExportFilterStorageEntry = (): OwnerRefundExportFilterStorageEntry => ({
  lastUsed: null,
  templates: [],
});

const createEmptyOwnerRefundExportFilterStorage = (): OwnerRefundExportFilterStorage => ({
  version: 2,
  users: {},
});

const normalizeOwnerRefundExportFilterStorage = (value: unknown): OwnerRefundExportFilterStorage => {
  if (!value || typeof value !== 'object' || !('users' in value) || typeof value.users !== 'object' || !value.users) {
    return createEmptyOwnerRefundExportFilterStorage();
  }

  const parsedUsers = value.users as Record<string, Partial<OwnerRefundExportFilterStorageEntry>>;
  const users = Object.fromEntries(
    Object.entries(parsedUsers).map(([ownerUserId, entry]) => {
      const lastUsed = normalizeOwnerRefundExportFilterSnapshot(entry.lastUsed ?? {});
      const templates = Array.isArray(entry.templates)
        ? entry.templates
          .map(item => normalizeOwnerRefundExportFilterTemplate(item as Partial<OwnerRefundExportFilterTemplate>))
          .filter((item): item is OwnerRefundExportFilterTemplate => Boolean(item))
        : [];

      return [
        ownerUserId,
        {
          lastUsed,
          templates,
        } satisfies OwnerRefundExportFilterStorageEntry,
      ];
    }),
  );

  return {
    version: 2,
    users,
  };
};

const buildOwnerRefundExportFilterSnapshot = (): OwnerRefundExportFilterSnapshot | null => {
  const ownerUserId = auth.user?.id;
  if (!ownerUserId) {
    return null;
  }

  return {
    ownerUserId,
    dateRange: ownerRefundExportDateRange.value
      ? [
          ownerRefundExportDateRange.value[0].toISOString(),
          ownerRefundExportDateRange.value[1].toISOString(),
        ]
      : null,
    refundType: ownerRefundExportType.value,
    refundStatus: ownerRefundExportStatus.value,
    complaintStatus: ownerRefundExportComplaintStatus.value,
    complaintType: ownerRefundExportComplaintType.value,
    complaintTargetRole: ownerRefundExportComplaintTargetRole.value,
    serviceType: ownerRefundExportServiceType.value,
    orderNoKeyword: ownerRefundExportOrderNoKeyword.value.trim(),
  };
};

const normalizeOwnerRefundExportDateRange = (value: unknown): [string, string] | null => {
  if (!Array.isArray(value) || value.length !== 2) {
    return null;
  }

  const [start, end] = value;
  return typeof start === 'string' && typeof end === 'string' ? [start, end] : null;
};

const normalizeOwnerRefundExportFilterSnapshot = (
  value: Partial<OwnerRefundExportFilterSnapshot>,
): OwnerRefundExportFilterSnapshot | null => {
  if (typeof value.ownerUserId !== 'string' || value.ownerUserId.length === 0) {
    return null;
  }

  return {
    ownerUserId: value.ownerUserId,
    dateRange: normalizeOwnerRefundExportDateRange(value.dateRange),
    refundType: value.refundType === 'FULL' || value.refundType === 'PARTIAL' ? value.refundType : '',
    refundStatus: value.refundStatus === 'PENDING'
      || value.refundStatus === 'APPROVED'
      || value.refundStatus === 'REJECTED'
      || value.refundStatus === 'SUCCESS'
      || value.refundStatus === 'FAILED'
      ? value.refundStatus
      : '',
    complaintStatus: value.complaintStatus === 'OPEN'
      || value.complaintStatus === 'PROCESSING'
      || value.complaintStatus === 'RESOLVED'
      || value.complaintStatus === 'REJECTED'
      ? value.complaintStatus
      : '',
    complaintType: value.complaintType === 'SAFETY'
      || value.complaintType === 'FEE'
      || value.complaintType === 'SERVICE'
      || value.complaintType === 'FRAUD'
      || value.complaintType === 'OTHER'
      ? value.complaintType
      : '',
    complaintTargetRole: value.complaintTargetRole === 'CAREGIVER' || value.complaintTargetRole === 'PLATFORM'
      ? value.complaintTargetRole
      : '',
    serviceType: value.serviceType === 'BOARDING'
      || value.serviceType === 'WALKING'
      || value.serviceType === 'FEEDING'
      || value.serviceType === 'DOOR_VISIT'
      ? value.serviceType
      : '',
    orderNoKeyword: typeof value.orderNoKeyword === 'string' ? value.orderNoKeyword.trim() : '',
  };
};

const normalizeOwnerRefundExportFilterTemplate = (
  value: Partial<OwnerRefundExportFilterTemplate>,
): OwnerRefundExportFilterTemplate | null => {
  const snapshot = normalizeOwnerRefundExportFilterSnapshot(value.snapshot ?? {});
  const name = typeof value.name === 'string' ? value.name.trim() : '';
  if (!snapshot || typeof value.id !== 'string' || value.id.length === 0 || name.length === 0) {
    return null;
  }

  return {
    id: value.id,
    name: name.slice(0, 20),
    snapshot,
    updatedAt: typeof value.updatedAt === 'string' && value.updatedAt.length > 0
      ? value.updatedAt
      : new Date().toISOString(),
  };
};

const clearLegacyOwnerRefundExportFilterStorage = () => {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(OWNER_REFUND_EXPORT_FILTER_STORAGE_KEY);
  window.localStorage.removeItem(OWNER_REFUND_EXPORT_FILTER_LEGACY_STORAGE_KEY);
};

const readStoredOwnerRefundExportFilterStorage = (): OwnerRefundExportFilterStorage => {
  const storedPageState = workbench.getPageState<OwnerRefundExportFilterStorage>(OWNER_REFUND_EXPORT_FILTER_PAGE_STATE_KEY);
  if (storedPageState) {
    return normalizeOwnerRefundExportFilterStorage(storedPageState);
  }

  if (typeof window === 'undefined') {
    return createEmptyOwnerRefundExportFilterStorage();
  }

  try {
    const raw = window.localStorage.getItem(OWNER_REFUND_EXPORT_FILTER_STORAGE_KEY);
    if (raw) {
      const storage = normalizeOwnerRefundExportFilterStorage(JSON.parse(raw));
      workbench.setPageState(OWNER_REFUND_EXPORT_FILTER_PAGE_STATE_KEY, storage);
      clearLegacyOwnerRefundExportFilterStorage();
      return storage;
    }

    const legacyRaw = window.localStorage.getItem(OWNER_REFUND_EXPORT_FILTER_LEGACY_STORAGE_KEY);
    if (!legacyRaw) {
      return createEmptyOwnerRefundExportFilterStorage();
    }

    const legacySnapshot = normalizeOwnerRefundExportFilterSnapshot(
      JSON.parse(legacyRaw) as Partial<OwnerRefundExportFilterSnapshot>,
    );
    if (!legacySnapshot) {
      return createEmptyOwnerRefundExportFilterStorage();
    }

    const storage: OwnerRefundExportFilterStorage = {
      version: 2,
      users: {
        [legacySnapshot.ownerUserId]: {
          lastUsed: legacySnapshot,
          templates: [],
        },
      },
    };
    workbench.setPageState(OWNER_REFUND_EXPORT_FILTER_PAGE_STATE_KEY, storage);
    clearLegacyOwnerRefundExportFilterStorage();
    return storage;
  } catch {
    return createEmptyOwnerRefundExportFilterStorage();
  }
};

const writeStoredOwnerRefundExportFilterStorage = (storage: OwnerRefundExportFilterStorage) => {
  workbench.setPageState(OWNER_REFUND_EXPORT_FILTER_PAGE_STATE_KEY, storage);
  clearLegacyOwnerRefundExportFilterStorage();
};

const applyOwnerRefundExportFilterSnapshot = (snapshot: OwnerRefundExportFilterSnapshot) => {
  ownerRefundExportDateRange.value = snapshot.dateRange
    ? [new Date(snapshot.dateRange[0]), new Date(snapshot.dateRange[1])]
    : null;
  ownerRefundExportType.value = snapshot.refundType;
  ownerRefundExportStatus.value = snapshot.refundStatus;
  ownerRefundExportComplaintStatus.value = snapshot.complaintStatus;
  ownerRefundExportComplaintType.value = snapshot.complaintType;
  ownerRefundExportComplaintTargetRole.value = snapshot.complaintTargetRole;
  ownerRefundExportServiceType.value = snapshot.serviceType;
  ownerRefundExportOrderNoKeyword.value = snapshot.orderNoKeyword;
};

const syncOwnerRefundExportFilterState = () => {
  const ownerUserId = auth.user?.id;
  if (!ownerUserId) {
    hasStoredOwnerRefundExportFilters.value = false;
    ownerRefundExportTemplates.value = [];
    selectedOwnerRefundExportTemplateId.value = '';
    return createEmptyOwnerRefundExportFilterStorageEntry();
  }

  const storage = readStoredOwnerRefundExportFilterStorage();
  const entry = storage.users[ownerUserId] ?? createEmptyOwnerRefundExportFilterStorageEntry();
  hasStoredOwnerRefundExportFilters.value = Boolean(entry.lastUsed);
  ownerRefundExportTemplates.value = [...entry.templates].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  if (!ownerRefundExportTemplates.value.some(item => item.id === selectedOwnerRefundExportTemplateId.value)) {
    selectedOwnerRefundExportTemplateId.value = '';
  }
  return entry;
};

const updateCurrentOwnerRefundExportFilterStorage = (
  updater: (entry: OwnerRefundExportFilterStorageEntry) => OwnerRefundExportFilterStorageEntry,
) => {
  const ownerUserId = auth.user?.id;
  if (!ownerUserId) {
    return null;
  }

  const storage = readStoredOwnerRefundExportFilterStorage();
  const currentEntry = storage.users[ownerUserId] ?? createEmptyOwnerRefundExportFilterStorageEntry();
  const nextEntry = updater({
    lastUsed: currentEntry.lastUsed,
    templates: [...currentEntry.templates],
  });
  storage.users[ownerUserId] = nextEntry;
  writeStoredOwnerRefundExportFilterStorage(storage);
  syncOwnerRefundExportFilterState();
  return nextEntry;
};

const persistOwnerRefundExportFilters = () => {
  const snapshot = buildOwnerRefundExportFilterSnapshot();
  if (!snapshot) {
    return;
  }

  updateCurrentOwnerRefundExportFilterStorage(entry => ({
    ...entry,
    lastUsed: snapshot,
  }));
};

const restoreStoredOwnerRefundExportFilters = () => {
  const entry = syncOwnerRefundExportFilterState();
  if (!entry.lastUsed) {
    ElMessage.info('暂无可恢复的上次退款导出筛选');
    return;
  }

  applyOwnerRefundExportFilterSnapshot(entry.lastUsed);
  ElMessage.success('已恢复上次退款导出筛选');
};

const clearOwnerRefundExportFilters = () => {
  resetOwnerRefundExportFilters();
  updateCurrentOwnerRefundExportFilterStorage(entry => ({
    ...entry,
    lastUsed: null,
  }));
  ElMessage.success('已清空退款导出筛选');
};

const findSelectedOwnerRefundExportTemplate = () => ownerRefundExportTemplates.value
  .find(item => item.id === selectedOwnerRefundExportTemplateId.value) ?? null;

const applySelectedOwnerRefundExportTemplate = () => {
  const template = findSelectedOwnerRefundExportTemplate();
  if (!template) {
    ElMessage.info('请先选择要应用的常用模板');
    return;
  }

  applyOwnerRefundExportFilterSnapshot(template.snapshot);
  ElMessage.success(`已应用模板：${template.name}`);
};

const saveCurrentOwnerRefundExportTemplate = async () => {
  const snapshot = buildOwnerRefundExportFilterSnapshot();
  if (!snapshot) {
    ElMessage.info('登录后才可保存常用筛选模板');
    return;
  }

  try {
    const { value } = await ElMessageBox.prompt(
      '输入模板名称，便于后续快速复用当前退款导出筛选',
      '保存常用筛选模板',
      {
        inputPlaceholder: '例如：平台责任退款',
        inputValidator: (inputValue) => {
          const name = inputValue.trim();
          if (!name) {
            return '模板名称不能为空';
          }
          if (name.length > 20) {
            return '模板名称最多 20 个字符';
          }
          return true;
        },
      },
    );

    const templateName = value.trim();
    const existingTemplate = ownerRefundExportTemplates.value.find(item => item.name === templateName) ?? null;
    if (!existingTemplate && ownerRefundExportTemplates.value.length >= OWNER_REFUND_EXPORT_TEMPLATE_LIMIT) {
      ElMessage.warning(`最多保存 ${OWNER_REFUND_EXPORT_TEMPLATE_LIMIT} 个常用模板，请先删除旧模板`);
      return;
    }

    const nextTemplate: OwnerRefundExportFilterTemplate = {
      id: existingTemplate?.id ?? `refund-template-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      name: templateName,
      snapshot,
      updatedAt: new Date().toISOString(),
    };

    updateCurrentOwnerRefundExportFilterStorage(entry => ({
      ...entry,
      templates: existingTemplate
        ? entry.templates.map(item => (item.id === existingTemplate.id ? nextTemplate : item))
        : [nextTemplate, ...entry.templates],
    }));
    selectedOwnerRefundExportTemplateId.value = nextTemplate.id;
    ElMessage.success(existingTemplate ? `已更新模板：${templateName}` : `已保存模板：${templateName}`);
  } catch (error: unknown) {
    if (error === 'cancel' || error === 'close') {
      return;
    }
    throw error;
  }
};

const deleteSelectedOwnerRefundExportTemplate = async () => {
  const template = findSelectedOwnerRefundExportTemplate();
  if (!template) {
    ElMessage.info('请先选择要删除的常用模板');
    return;
  }

  try {
    await ElMessageBox.confirm(`确认删除模板“${template.name}”吗？`, '删除常用筛选模板', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    });
    updateCurrentOwnerRefundExportFilterStorage(entry => ({
      ...entry,
      templates: entry.templates.filter(item => item.id !== template.id),
    }));
    selectedOwnerRefundExportTemplateId.value = '';
    ElMessage.success(`已删除模板：${template.name}`);
  } catch (error: unknown) {
    if (error === 'cancel' || error === 'close') {
      return;
    }
    throw error;
  }
};

const buildOwnerTransactionExportRequest = () => api.petpal.orders.exportTransactions();
const buildOwnerRefundExportQuery = (): OwnerRefundExportQuery => ({
  startDate: ownerRefundExportDateRange.value?.[0]
    ? toDayBoundaryIsoString(ownerRefundExportDateRange.value[0], 'start')
    : undefined,
  endDate: ownerRefundExportDateRange.value?.[1]
    ? toDayBoundaryIsoString(ownerRefundExportDateRange.value[1], 'end')
    : undefined,
  refundType: ownerRefundExportType.value || undefined,
  refundStatus: ownerRefundExportStatus.value || undefined,
  complaintStatus: ownerRefundExportComplaintStatus.value || undefined,
  complaintType: ownerRefundExportComplaintType.value || undefined,
  complaintTargetRole: ownerRefundExportComplaintTargetRole.value || undefined,
  serviceType: ownerRefundExportServiceType.value || undefined,
  orderNoKeyword: ownerRefundExportOrderNoKeyword.value.trim() || undefined,
});
const buildOwnerRefundExportRequest = () => {
  persistOwnerRefundExportFilters();
  return api.petpal.orders.exportRefundDetails(buildOwnerRefundExportQuery());
};

const splitTagText = (value: string) => [...new Set(
  value
    .split(/[\n,，、]/)
    .map(item => item.trim())
    .filter(Boolean),
)];

const joinTagText = (tags?: string[]) => (tags ?? []).join('，');

const formatPetTagSummary = (tags?: string[]) => {
  const normalized = tags ?? [];
  return normalized.length ? normalized.join(' / ') : '-';
};

const formatEmergencyContact = (contact: PetProfileRecord['emergencyContact']) => {
  if (!contact) {
    return '-';
  }

  return [contact.name, contact.phone, contact.relation].filter(Boolean).join(' · ');
};

const formatQualificationSummary = (materials?: CaregiverQualificationMaterialRecord[]) => {
  const normalized = materials ?? [];
  return normalized.length ? `${normalized.length} 份材料` : '未上传';
};

const resetPetForm = () => {
  editingPetId.value = '';
  petForm.name = '';
  petForm.species = 'DOG';
  petForm.gender = 'UNKNOWN';
  petForm.breed = '';
  petForm.birthday = '';
  petForm.weightKg = 5;
  petForm.neutered = false;
  petForm.temperamentTags = [];
  petTemperamentTagsText.value = '';
  petForm.feedingNote = '';
  petForm.allergyNote = '';
  petForm.medicalNote = '';
  petForm.emergencyContact = {
    name: '',
    phone: '',
    relation: '',
  };
};

const startEditPet = (pet: PetProfileRecord) => {
  editingPetId.value = pet.id;
  requestForm.petId = pet.id;
  petForm.name = pet.name;
  petForm.species = pet.species;
  petForm.gender = pet.gender;
  petForm.breed = pet.breed || '';
  petForm.birthday = pet.birthday ? pet.birthday.slice(0, 10) : '';
  petForm.weightKg = Number(pet.weightKg ?? 0) || 0;
  petForm.neutered = pet.neutered;
  petForm.temperamentTags = [...pet.temperamentTags];
  petTemperamentTagsText.value = joinTagText(pet.temperamentTags);
  petForm.feedingNote = pet.feedingNote || '';
  petForm.allergyNote = pet.allergyNote || '';
  petForm.medicalNote = pet.medicalNote || '';
  petForm.emergencyContact = {
    name: pet.emergencyContact?.name || '',
    phone: pet.emergencyContact?.phone || '',
    relation: pet.emergencyContact?.relation || '',
  };
};

const removeQualificationMaterial = (fileId: string) => {
  caregiverProfileForm.qualificationMaterials = caregiverProfileForm.qualificationMaterials
    .filter(item => item.fileId !== fileId);
};

const openQualificationFilePicker = () => {
  qualificationUploadInput.value?.click();
};

const openExternalLink = (url: string) => {
  window.open(url, '_blank', 'noopener');
};

const uploadQualificationFiles = async (files: File[]) => {
  if (!caregiverProfile.value) {
    ElMessage.warning('请先加载照料者档案');
    return;
  }

  if (!files.length) {
    return;
  }

  qualificationUploading.value = true;
  qualificationUploadProgress.value = 0;

  const uploaded: CaregiverQualificationMaterialRecord[] = [];
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  let completedSize = 0;

  try {
    for (const file of files) {
      const result = await uploadAttachmentFile(
        file,
        {
          tag1: 'petpal-caregiver-qualification',
          tag2: caregiverProfile.value.id,
        },
        (percent) => {
          const currentBytes = Math.round((file.size * percent) / 100);
          qualificationUploadProgress.value = Math.min(
            99,
            Math.round(((completedSize + currentBytes) / Math.max(totalSize, 1)) * 100),
          );
        },
      );

      uploaded.push({
        fileId: result.fileId,
        url: result.url,
        name: file.name,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
        uploadedAt: new Date().toISOString(),
      });
      completedSize += file.size;
      qualificationUploadProgress.value = Math.min(
        99,
        Math.round((completedSize / Math.max(totalSize, 1)) * 100),
      );
    }

    caregiverProfileForm.qualificationMaterials = [
      ...caregiverProfileForm.qualificationMaterials,
      ...uploaded,
    ].slice(0, 12);
    qualificationUploadProgress.value = 100;
    ElMessage.success(`已上传 ${uploaded.length} 份资质材料`);
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '上传资质材料失败'));
  } finally {
    qualificationUploading.value = false;
    setTimeout(() => {
      qualificationUploadProgress.value = null;
    }, 600);
  }
};

const onQualificationFilesChange = async (event: Event) => {
  const input = event.target as HTMLInputElement;
  const files = Array.from(input.files ?? []);
  input.value = '';
  await uploadQualificationFiles(files);
};

const loadPets = async () => {
  try {
    petsLoading.value = true;
    pets.value = await api.petpal.pets.list();
    if (!requestForm.petId && pets.value.length > 0) {
      requestForm.petId = pets.value[0].id;
    }
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '加载宠物失败'));
  } finally {
    petsLoading.value = false;
  }
};

const loadRequests = async () => {
  try {
    requestsLoading.value = true;
    requests.value = await api.petpal.requests.list();
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '加载需求失败'));
  } finally {
    requestsLoading.value = false;
  }
};

const loadOrders = async () => {
  try {
    ordersLoading.value = true;
    orders.value = await api.petpal.orders.list();
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '加载订单失败'));
  } finally {
    ordersLoading.value = false;
  }
};

const loadMatches = async () => {
  try {
    matchLoading.value = true;
    const page = await api.petpal.match.caregivers({
      ...matchQuery,
      city: matchQuery.city || undefined,
    });
    matchItems.value = page.items;
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '匹配照料者失败'));
  } finally {
    matchLoading.value = false;
  }
};

const loadCaregiverProfile = async () => {
  try {
    const profile = await api.petpal.caregiver.profile();
    caregiverProfile.value = profile;
    caregiverProfileForm.intro = profile.intro || '';
    caregiverProfileForm.experienceYears = profile.experienceYears;
    caregiverProfileForm.serviceRadiusKm = profile.serviceRadiusKm;
    caregiverProfileForm.serviceCity = profile.serviceCity || '';
    caregiverProfileForm.specialtyTagsText = joinTagText(profile.specialtyTags);
    caregiverProfileForm.serviceCommitment = profile.serviceCommitment || '';
    caregiverProfileForm.qualificationMaterials = [...profile.qualificationMaterials];
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '加载照料者档案失败'));
  }
};

const loadCaregiverServices = async () => {
  try {
    caregiverServices.value = await api.petpal.caregiver.services();
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '加载照料服务失败'));
  }
};

const loadCaregiverOrders = async () => {
  try {
    caregiverOrdersLoading.value = true;
    const response = await api.petpal.caregiver.orders({
      page: caregiverOrderQuery.page,
      pageSize: caregiverOrderQuery.pageSize,
      status: caregiverOrderQuery.status || undefined,
    });
    caregiverOrders.value = response.items;
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '加载履约订单失败'));
  } finally {
    caregiverOrdersLoading.value = false;
  }
};

const withCaregiverOrderAction = async (
  key: string,
  successMessage: string,
  action: () => Promise<void>,
) => {
  try {
    caregiverActionLoadingKey.value = key;
    await action();
    ElMessage.success(successMessage);
    await Promise.all([loadCaregiverOrders(), loadOrders()]);
  } catch (error: unknown) {
    if (error === 'cancel' || error === 'close') {
      return;
    }
    ElMessage.error(getErrorMessage(error, '履约动作执行失败'));
  } finally {
    caregiverActionLoadingKey.value = '';
  }
};

const acceptCaregiverOrder = async (orderId: string) => withCaregiverOrderAction(
  `accept:${orderId}`,
  '已接单',
  async () => {
    await api.petpal.caregiver.acceptOrder(orderId);
  },
);

const checkInCaregiverOrder = async (orderId: string) => withCaregiverOrderAction(
  `checkin:${orderId}`,
  '签到成功',
  async () => {
    await api.petpal.caregiver.checkInOrder(orderId);
  },
);

const resetServiceLogDialog = () => {
  Object.assign(serviceLogForm, createEmptyServiceLogForm());
  serviceLogUploadProgress.value = null;
  if (serviceLogFileInput.value) {
    serviceLogFileInput.value.value = '';
  }
};

const openCaregiverServiceLogDialog = (orderId: string) => {
  resetServiceLogDialog();
  serviceLogForm.orderId = orderId;
  serviceLogDialogVisible.value = true;
};

const openServiceLogFilePicker = () => {
  serviceLogFileInput.value?.click();
};

const clearServiceLogFiles = () => {
  serviceLogForm.files = [];
  if (serviceLogFileInput.value) {
    serviceLogFileInput.value.value = '';
  }
};

const onServiceLogFilesChange = (event: Event) => {
  const input = event.target as HTMLInputElement;
  serviceLogForm.files = Array.from(input.files ?? []);
};

const removeServiceLogFile = (index: number) => {
  serviceLogForm.files.splice(index, 1);
  if (serviceLogFileInput.value) {
    serviceLogFileInput.value.value = '';
  }
};

const uploadServiceLogMediaFiles = async (orderId: string) => {
  if (serviceLogForm.files.length === 0) {
    serviceLogUploadProgress.value = null;
    return [];
  }

  const totalBytes = serviceLogForm.files.reduce((sum, file) => sum + file.size, 0);
  const uploadedUrls: string[] = [];
  let completedBytes = 0;

  for (const file of serviceLogForm.files) {
    const uploaded = await uploadAttachmentFile(
      file,
      { tag1: 'petpal-service-log', tag2: orderId },
      (progress) => {
        const currentBytes = Math.round((file.size * progress) / 100);
        serviceLogUploadProgress.value = Math.min(
          99,
          Math.round(((completedBytes + currentBytes) / totalBytes) * 100),
        );
      },
    );
    uploadedUrls.push(uploaded.url);
    completedBytes += file.size;
    serviceLogUploadProgress.value = Math.min(
      99,
      Math.round((completedBytes / totalBytes) * 100),
    );
  }

  serviceLogUploadProgress.value = 100;
  return uploadedUrls;
};

const submitCaregiverServiceLog = async () => {
  const orderId = serviceLogForm.orderId;
  const textNote = serviceLogForm.textNote.trim();

  if (!orderId) {
    return;
  }

  if (!textNote && serviceLogForm.files.length === 0) {
    ElMessage.warning('请填写服务说明或上传至少一个媒体文件');
    return;
  }

  if (serviceLogForm.files.length > 0 && !canUploadServiceLogMedia.value) {
    ElMessage.warning('当前账号暂未开通媒体上传能力，请移除图片或视频后再提交');
    return;
  }

  try {
    serviceLogSubmitting.value = true;
    caregiverActionLoadingKey.value = `log:${orderId}`;
    const mediaUrls = await uploadServiceLogMediaFiles(orderId);
    await api.petpal.caregiver.addServiceLog(orderId, {
      logType: serviceLogForm.logType,
      textNote: textNote || undefined,
      mediaUrls,
    });
    serviceLogDialogVisible.value = false;
    resetServiceLogDialog();
    ElMessage.success('服务记录已保存');
    await Promise.all([loadCaregiverOrders(), loadOrders()]);
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '保存服务记录失败'));
  } finally {
    serviceLogSubmitting.value = false;
    serviceLogUploadProgress.value = null;
    caregiverActionLoadingKey.value = '';
  }
};

const checkOutCaregiverOrder = async (orderId: string) => withCaregiverOrderAction(
  `checkout:${orderId}`,
  '签退成功',
  async () => {
    await api.petpal.caregiver.checkOutOrder(orderId);
  },
);

const confirmOrderComplete = async (orderId: string) => withCaregiverOrderAction(
  `confirm:${orderId}`,
  '订单已确认完成',
  async () => {
    await api.petpal.orders.confirmComplete(orderId);
  },
);

const saveCaregiverProfile = async () => {
  try {
    caregiverProfileSaving.value = true;
    const profile = await api.petpal.caregiver.upsertProfile({
      intro: caregiverProfileForm.intro.trim() || undefined,
      experienceYears: caregiverProfileForm.experienceYears,
      serviceRadiusKm: caregiverProfileForm.serviceRadiusKm,
      serviceCity: caregiverProfileForm.serviceCity.trim() || undefined,
      specialtyTags: splitTagText(caregiverProfileForm.specialtyTagsText),
      serviceCommitment: caregiverProfileForm.serviceCommitment.trim() || undefined,
      qualificationMaterials: caregiverProfileForm.qualificationMaterials,
    });
    caregiverProfile.value = profile;
    caregiverProfileForm.specialtyTagsText = joinTagText(profile.specialtyTags);
    caregiverProfileForm.serviceCommitment = profile.serviceCommitment || '';
    caregiverProfileForm.qualificationMaterials = [...profile.qualificationMaterials];
    ElMessage.success('照料者档案已更新');
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '保存照料者档案失败'));
  } finally {
    caregiverProfileSaving.value = false;
  }
};

const createCaregiverService = async () => {
  if (!caregiverServiceForm.unitType.trim()) {
    ElMessage.warning('请填写计价单位');
    return;
  }

  try {
    caregiverServiceSaving.value = true;
    await api.petpal.caregiver.createService({
      serviceType: caregiverServiceForm.serviceType,
      petSpecies: caregiverServiceForm.petSpecies,
      pricePerUnit: caregiverServiceForm.pricePerUnit,
      unitType: caregiverServiceForm.unitType.trim(),
      minNoticeHours: caregiverServiceForm.minNoticeHours,
      serviceCity: caregiverServiceForm.serviceCity.trim() || undefined,
      serviceLat: caregiverServiceForm.serviceLat,
      serviceLng: caregiverServiceForm.serviceLng,
      isActive: caregiverServiceForm.isActive,
      availableSlots: [],
    });
    ElMessage.success('照料服务已创建');
    await loadCaregiverServices();
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '创建照料服务失败'));
  } finally {
    caregiverServiceSaving.value = false;
  }
};

const createPet = async () => {
  if (!petForm.name.trim()) {
    ElMessage.warning('请先填写宠物名称');
    return;
  }

  try {
    petSaving.value = true;
    const payload: CreatePetPayload = {
      ...petForm,
      breed: petForm.breed?.trim() || undefined,
      birthday: typeof petForm.birthday === 'string' && petForm.birthday
        ? petForm.birthday
        : undefined,
      weightKg: Number(petForm.weightKg || 0) > 0 ? Number(petForm.weightKg) : undefined,
      temperamentTags: splitTagText(petTemperamentTagsText.value),
      feedingNote: petForm.feedingNote?.trim() || undefined,
      allergyNote: petForm.allergyNote?.trim() || undefined,
      medicalNote: petForm.medicalNote?.trim() || undefined,
      emergencyContact: petForm.emergencyContact?.name?.trim() && petForm.emergencyContact?.phone?.trim()
        ? {
            name: petForm.emergencyContact.name.trim(),
            phone: petForm.emergencyContact.phone.trim(),
            relation: petForm.emergencyContact.relation?.trim() || undefined,
          }
        : undefined,
    };

    if (editingPetId.value) {
      await api.petpal.pets.update(editingPetId.value, payload);
      ElMessage.success('宠物档案已更新');
    } else {
      await api.petpal.pets.create(payload);
      ElMessage.success('宠物已创建');
    }

    resetPetForm();
    await loadPets();
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, editingPetId.value ? '更新宠物失败' : '创建宠物失败'));
  } finally {
    petSaving.value = false;
  }
};

const createRequest = async () => {
  if (!requestForm.petId) {
    ElMessage.warning('请先选择宠物');
    return;
  }
  if (!requestForm.locationText.trim()) {
    ElMessage.warning('请填写服务地点');
    return;
  }

  try {
    requestSaving.value = true;
    await api.petpal.requests.create({
      petId: requestForm.petId,
      serviceType: requestForm.serviceType,
      startTime: requestForm.startTime.toISOString(),
      endTime: requestForm.endTime.toISOString(),
      locationText: requestForm.locationText.trim(),
      budgetAmount: requestForm.budgetAmount,
      demandTags: [],
    });
    ElMessage.success('需求已发布');
    await Promise.all([loadRequests(), loadOrders()]);
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '发布需求失败'));
  } finally {
    requestSaving.value = false;
  }
};

const reloadAll = async () => {
  await Promise.all([
    loadPets(),
    loadRequests(),
    loadOrders(),
    loadMatches(),
    loadCaregiverProfile(),
    loadCaregiverServices(),
    loadCaregiverOrders(),
  ]);
};

watch(() => auth.user?.id, (ownerUserId) => {
  const entry = syncOwnerRefundExportFilterState();
  if (ownerUserId && entry.lastUsed) {
    applyOwnerRefundExportFilterSnapshot(entry.lastUsed);
    return;
  }

  resetOwnerRefundExportFilters();
});

onMounted(async () => {
  const entry = syncOwnerRefundExportFilterState();
  if (entry.lastUsed && entry.lastUsed.ownerUserId === auth.user?.id) {
    applyOwnerRefundExportFilterSnapshot(entry.lastUsed);
  }
  await reloadAll();
});
</script>

<style scoped lang="scss">
.petpal-grid-span-4 {
  grid-column: span 4;
}

.petpal-grid-span-5 {
  grid-column: span 5;
}

.petpal-grid-span-7 {
  grid-column: span 7;
}

.petpal-grid-span-8 {
  grid-column: span 8;
}

.petpal-match-form {
  margin-bottom: 10px;
}

.petpal-section-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.petpal-section-heading__meta {
  display: grid;
  gap: 6px;
}

.petpal-section-heading h3 {
  margin: 0;
}

.petpal-section-heading__hint {
  margin: 0;
  color: #6b7280;
  font-size: 12px;
  line-height: 1.5;
}

.petpal-export-toolbar {
  display: grid;
  gap: 10px;
  justify-items: end;
}

.petpal-conversation-cell {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.petpal-conversation-cell__copy {
  min-width: 0;
  flex: 1;
  display: grid;
  gap: 4px;
}

.petpal-conversation-cell__preview,
.petpal-conversation-cell__meta {
  margin: 0;
  white-space: normal;
  word-break: break-word;
}

.petpal-conversation-cell__preview {
  color: #111827;
  line-height: 1.5;
}

.petpal-conversation-cell__meta {
  color: #6b7280;
  font-size: 12px;
  line-height: 1.5;
}

.petpal-service-log-dialog__upload {
  display: grid;
  gap: 12px;
}

.petpal-service-log-dialog__file-input {
  display: none;
}

.petpal-service-log-dialog__actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.petpal-service-log-dialog__hint,
.petpal-service-log-dialog__empty {
  margin: 0;
  padding: 12px 14px;
  border-radius: 12px;
  background: #f6f8fb;
  color: #5f6b7a;
  line-height: 1.6;
}

.petpal-service-log-dialog__hint.is-warning {
  background: #fff8e6;
  color: #8a6200;
}

.petpal-service-log-dialog__file-list {
  display: grid;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.petpal-service-log-dialog__file-item {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid #e5ebf3;
  border-radius: 12px;
  background: #fff;
}

.petpal-service-log-dialog__file-meta {
  display: grid;
  gap: 4px;
}

.petpal-service-log-dialog__file-meta span {
  font-size: 12px;
  color: #6b7280;
}

.petpal-hidden-file-input {
  display: none;
}

.petpal-qualification-panel {
  display: grid;
  gap: 12px;
  width: 100%;
}

.petpal-qualification-panel__actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.petpal-qualification-panel__hint {
  color: #6b7280;
  font-size: 12px;
}

.petpal-qualification-list {
  display: grid;
  gap: 10px;
}

.petpal-qualification-item {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid #e5ebf3;
  border-radius: 12px;
  background: #fff;
}

.petpal-qualification-item__copy {
  display: grid;
  gap: 4px;
}

.petpal-qualification-item__copy strong,
.petpal-qualification-item__copy span {
  word-break: break-all;
}

.petpal-qualification-item__copy span {
  color: #6b7280;
  font-size: 12px;
}

@media (max-width: 900px) {
  .petpal-grid-span-4,
  .petpal-grid-span-5,
  .petpal-grid-span-7,
  .petpal-grid-span-8 {
    grid-column: span 1;
  }

  .petpal-section-heading {
    flex-direction: column;
    align-items: flex-start;
  }

  .petpal-export-toolbar {
    width: 100%;
    justify-items: start;
  }

  .petpal-service-log-dialog__file-item {
    flex-direction: column;
  }

  .petpal-qualification-item {
    flex-direction: column;
  }
}
</style>
