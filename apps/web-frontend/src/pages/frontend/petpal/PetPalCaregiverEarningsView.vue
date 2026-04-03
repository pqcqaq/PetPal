<template>
  <PetPalDeskPage
    eyebrow="收益表现"
    title="收益页只看经营结果，不再把复盘塞回履约队列"
    summary="收益摘要改由后端直接聚合，页面只消费统一口径的收入、风险和服务结构数据。"
    :nav-items="petPalCaregiverWorkspaceNav"
    active-name="frontend-petpal-caregiver-earnings"
    :primary-action="primaryAction"
    :actions="heroActions"
    :stats="heroStats"
  >
    <template v-if="pageNotice" #notice>
      <PetPalDeskNotice
        eyebrow="Handoff"
        :title="pageNotice.title"
        :description="pageNotice.description"
        :tone="pageNotice.tone"
      >
        <template #actions>
          <el-button
            v-if="summaryState === 'error'"
            :loading="sectionReloadingKey === 'summary'"
            @click="retrySummary"
          >
            重试收益摘要
          </el-button>
        </template>
      </PetPalDeskNotice>
    </template>

    <PetPalDeskSection
      eyebrow="Snapshot"
      title="收益总览"
      description="只统计已完成订单收入，把售后敞口单独暴露出来。"
    >
      <template #actions>
        <div class="petpal-section-actions">
          <el-button
            v-if="summaryState === 'error'"
            :loading="sectionReloadingKey === 'summary'"
            @click="retrySummary"
          >
            重试收益摘要
          </el-button>
          <ListExportButton
            v-else
            :request="buildEarningsExportRequest"
            label="导出经营明细"
            pending-label="导出中"
            error-message="导出收益明细失败"
          />
          <RouterLink
            v-if="summaryState !== 'error' && latestActiveOrder"
            :to="
              buildOrdersRoute(
                '这里已经定位到当前最优先的一笔履约订单，可直接继续接单或签到。',
                latestActiveOrder.id,
              )
            "
          >
            回履约队列
          </RouterLink>
        </div>
      </template>

      <PetPalDeskEmpty
        v-if="summaryState === 'error'"
        title="收益摘要暂未刷新完成"
        description="可以先重试收益摘要，恢复后再继续查看累计收入和售后风险。"
      />

      <PetPalDeskEmpty
        v-else-if="!totals.completedOrderCount && !totals.aftersalesOrderCount"
        title="还没有可复盘的收益数据"
        description="完成第一笔订单后，这里会开始累计收入、客单价和近 30 天表现。"
      >
        <template #actions>
          <RouterLink
            class="frontend-page__button is-primary"
            :to="
              buildOrdersRoute(
                '这里已经回到履约队列，可先继续接单、签到或签退。',
                latestActiveOrder?.id,
              )
            "
          >
            去履约队列
          </RouterLink>
        </template>
      </PetPalDeskEmpty>

      <template v-else>
        <PetPalExportToolbar
          class="petpal-export-toolbar"
          hint="导出筛选只影响经营明细，不改变当前摘要和趋势口径；可额外按订单号关键词、退款金额门槛、最少投诉数、退款类型、退款状态、退款原因关键词、退款风险单、投诉状态、投诉类型、投诉摘要关键词或责任角色导出经营明细，系统会按当前账号记住最近一次导出条件，并可保存最多 5 套常用模板。"
        >
          <template #presets>
            <div class="petpal-export-toolbar__presets">
              <span class="petpal-export-toolbar__label">快捷时间窗</span>
              <el-button
                v-for="preset in exportPresetOptions"
                :key="preset.value"
                size="small"
                :type="activeExportPreset === preset.value ? 'primary' : 'default'"
                @click="applyExportPreset(preset.value)"
              >
                {{ preset.label }}
              </el-button>
            </div>
          </template>
          <template #template-actions>
            <PetPalExportTemplateActions
              v-model="selectedExportTemplateName"
              :templates="exportTemplates"
              placeholder="选择常用导出模板"
              :apply-disabled="!selectedExportTemplate"
              :save-disabled="!hasExportFilters"
              :can-remove="!!selectedExportTemplate"
              @apply="applySelectedExportTemplate"
              @save="saveCurrentExportTemplate"
              @remove="deleteSelectedExportTemplate"
            />
          </template>
          <template #filters>
            <el-date-picker
              v-model="exportDateRange"
              type="daterange"
              range-separator="至"
              start-placeholder="导出开始日期"
              end-placeholder="导出结束日期"
              clearable
            />
            <el-select
              v-model="exportServiceType"
              clearable
              placeholder="导出全部服务类型"
              class="petpal-export-toolbar__service"
            >
              <el-option
                v-for="item in petPalServiceTypeOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
            <el-input
              v-model="exportOrderNoKeyword"
              clearable
              placeholder="订单号关键词"
              class="petpal-export-toolbar__service"
            />
            <el-select
              v-model="exportMinRefundAmount"
              clearable
              placeholder="退款金额门槛"
              class="petpal-export-toolbar__service"
            >
              <el-option
                v-for="item in refundExposureAmountOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
            <el-select
              v-model="exportMinComplaintCount"
              clearable
              placeholder="最少投诉数"
              class="petpal-export-toolbar__service"
            >
              <el-option
                v-for="item in complaintCountOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
            <el-select
              v-model="exportRefundType"
              clearable
              placeholder="导出全部退款类型"
              class="petpal-export-toolbar__service"
            >
              <el-option
                v-for="item in petPalRefundTypeOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
            <el-select
              v-model="exportRefundStatus"
              clearable
              placeholder="导出全部退款状态"
              class="petpal-export-toolbar__service"
            >
              <el-option
                v-for="item in petPalRefundStatusOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
            <el-input
              v-model="exportRefundReasonKeyword"
              clearable
              placeholder="退款原因关键词"
              class="petpal-export-toolbar__service"
            />
            <el-select
              v-model="exportComplaintStatus"
              clearable
              placeholder="导出全部投诉状态"
              class="petpal-export-toolbar__service"
            >
              <el-option
                v-for="item in petPalComplaintStatusOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
            <el-select
              v-model="exportComplaintType"
              clearable
              placeholder="导出全部投诉类型"
              class="petpal-export-toolbar__service"
            >
              <el-option
                v-for="item in petPalComplaintTypeOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
            <el-input
              v-model="exportComplaintKeyword"
              clearable
              placeholder="投诉摘要关键词"
              class="petpal-export-toolbar__service"
            />
            <el-select
              v-model="exportComplaintTargetRole"
              clearable
              placeholder="导出全部责任角色"
              class="petpal-export-toolbar__service"
            >
              <el-option
                v-for="item in petPalComplaintTargetOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
            <el-checkbox v-model="exportRiskOnly">
              仅导出退款风险单
            </el-checkbox>
            <el-button v-if="hasExportFilters" text @click="clearExportFilters">
              清空导出筛选
            </el-button>
          </template>
          <template #summary>
            <PetPalExportFilterSummary
              :items="exportSummaryItems"
              empty-text="当前没有附加经营导出条件，导出时会带出全部已完成订单经营明细。"
              @remove="clearExportSummaryItem"
              @clear="clearExportFilters"
            />
          </template>
        </PetPalExportToolbar>

        <div class="petpal-metric-grid">
          <article v-for="item in revenueCards" :key="item.label" class="petpal-metric-card">
            <p>{{ item.label }}</p>
            <strong>{{ item.value }}</strong>
            <span>{{ item.hint }}</span>
          </article>
        </div>
      </template>
    </PetPalDeskSection>

    <div class="petpal-split-grid">
      <PetPalDeskSection
        class="petpal-span-5"
        eyebrow="Signals"
        title="口碑与服务信号"
        description="评分、审核和在售服务一起看，判断经营底盘是否稳定。"
      >
        <template #actions>
          <el-button
            v-if="summaryState === 'error'"
            :loading="sectionReloadingKey === 'summary'"
            @click="retrySummary"
          >
            重试收益摘要
          </el-button>
          <RouterLink
            v-else
            :to="buildProfileRoute('这里已经定位到照料者资料页，可继续补齐资料和审核信息。')"
          >
            维护资料
          </RouterLink>
          <RouterLink
            v-if="summaryState !== 'error'"
            :to="buildServicesRoute('这里已经定位到服务清单，可继续调整在售服务和价格。')"
          >
            查看服务
          </RouterLink>
        </template>

        <PetPalDeskEmpty
          v-if="summaryState === 'error'"
          title="口碑与服务信号暂未刷新完成"
          description="可以先重试收益摘要，恢复后再继续查看评分、审核和在售服务。"
        />

        <template v-else>
          <div class="petpal-metric-grid petpal-metric-grid--compact">
            <article v-for="item in qualityCards" :key="item.label" class="petpal-metric-card">
              <p>{{ item.label }}</p>
              <strong>{{ item.value }}</strong>
              <span>{{ item.hint }}</span>
            </article>
          </div>

          <div class="petpal-note-list">
            <div class="petpal-note-row">
              <span>服务城市</span>
              <strong>{{ profile?.serviceCity || '待补充' }}</strong>
            </div>
            <div class="petpal-note-row">
              <span>经验 / 半径</span>
              <strong>{{
                profile
                  ? `${profile.experienceYears} 年 / ${profile.serviceRadiusKm} km`
                  : '资料待补充'
              }}</strong>
            </div>
            <div class="petpal-note-row">
              <span>当前履约中</span>
              <strong>{{ totals.activeOrderCount }} 笔</strong>
            </div>
          </div>
        </template>
      </PetPalDeskSection>

      <PetPalDeskSection
        class="petpal-span-7"
        eyebrow="Mix"
        title="服务收入结构"
        description="只看已完成订单，帮助判断哪类服务在稳定赚钱。"
      >
        <template #actions>
          <el-button
            v-if="summaryState === 'error'"
            :loading="sectionReloadingKey === 'summary'"
            @click="retrySummary"
          >
            重试收益摘要
          </el-button>
          <RouterLink
            v-else
            :to="
              buildServicesRoute('这里已经定位到服务清单，可继续根据收入结构调整价格和上架状态。')
            "
          >
            看服务清单
          </RouterLink>
        </template>

        <PetPalDeskEmpty
          v-if="summaryState === 'error'"
          title="收入结构暂未刷新完成"
          description="可以先重试收益摘要，恢复后再继续查看各服务类型的收入占比。"
        />

        <PetPalDeskEmpty
          v-else-if="!serviceRevenueMix.length"
          title="还没有形成收入结构"
          description="完成第一笔订单后，这里会开始按服务类型归集收入和客单价。"
        />

        <div v-else class="petpal-mix-list">
          <div v-for="item in serviceRevenueMix" :key="item.serviceType" class="petpal-mix-row">
            <div class="petpal-mix-row__copy">
              <h3>{{ item.label }}</h3>
              <p>
                {{ item.orderCount }} 笔已完成订单 · 平均每单
                {{ formatPetPalMoney(item.averageTicket) }}
              </p>
            </div>
            <div class="petpal-mix-row__tail">
              <strong>{{ formatPetPalMoney(item.revenue) }}</strong>
              <span>{{ item.shareLabel }}</span>
            </div>
          </div>
        </div>
      </PetPalDeskSection>
    </div>

    <PetPalDeskSection
      eyebrow="Trend"
      title="日 / 周 / 月趋势"
      description="按同一口径看最近 7 天、8 周和 6 个月的完成单收入变化。"
    >
      <template #actions>
        <el-button
          v-if="summaryState === 'error'"
          :loading="sectionReloadingKey === 'summary'"
          @click="retrySummary"
        >
          重试收益摘要
        </el-button>
      </template>

      <PetPalDeskEmpty
        v-if="summaryState === 'error'"
        title="收益趋势暂未刷新完成"
        description="可以先重试收益摘要，恢复后再继续查看日、周、月维度的经营变化。"
      />

      <PetPalDeskEmpty
        v-else-if="!hasTrendData"
        title="还没有可用的收益趋势"
        description="完成订单后，这里会开始沉淀按天、按周、按月的收益变化。"
      />

      <div v-else class="petpal-trend-grid">
        <article v-for="group in trendGroups" :key="group.key" class="petpal-trend-card">
          <div class="petpal-trend-card__head">
            <div>
              <p>{{ group.label }}</p>
              <strong>{{ formatPetPalMoney(group.totalRevenue) }}</strong>
            </div>
            <span>{{ group.totalOrders }} 笔完成单</span>
          </div>
          <div class="petpal-trend-list">
            <div
              v-for="item in group.items"
              :key="`${group.key}-${item.label}`"
              class="petpal-trend-row"
            >
              <div class="petpal-trend-row__copy">
                <strong>{{ item.label }}</strong>
                <span>{{ item.completedOrderCount }} 笔</span>
              </div>
              <div class="petpal-trend-row__tail">
                <span>{{ formatPetPalMoney(item.revenue) }}</span>
                <i :style="{ width: getTrendBarWidth(item.revenue, group.maxRevenue) }" />
              </div>
            </div>
          </div>
        </article>
      </div>
    </PetPalDeskSection>

    <PetPalDeskSection
      eyebrow="Risk"
      title="售后风险订单"
      description="风险比例只告诉你结果，这里按争议状态、未结案投诉、退款阶段和退款金额排出最近需要复盘的队列。"
    >
      <template #actions>
        <el-button
          v-if="summaryState === 'error'"
          :loading="sectionReloadingKey === 'summary'"
          @click="retrySummary"
        >
          重试收益摘要
        </el-button>
        <el-button
          v-else
          :type="exportRiskOnly ? 'primary' : 'default'"
          @click="toggleRiskOnlyExport"
        >
          {{ exportRiskOnly ? '当前仅导出风险单' : '仅导出风险单' }}
        </el-button>
        <RouterLink
          v-if="summaryState !== 'error' && recentAftersalesOrders[0]"
          :to="buildAftersalesOrderDetailLink(recentAftersalesOrders[0].id)"
        >
          看最近风险订单
        </RouterLink>
      </template>

      <PetPalDeskEmpty
        v-if="summaryState === 'error'"
        title="售后风险订单暂未刷新完成"
        description="可以先重试收益摘要，恢复后再继续定位争议和退款风险订单。"
      />

      <PetPalDeskEmpty
        v-else-if="!recentAftersalesOrders.length"
        title="当前没有售后风险订单"
        description="当订单进入退款或争议链路后，这里会列出需要优先复盘的对象。"
      />

      <div v-else>
        <div class="petpal-note-row petpal-risk-shortcuts">
          <span>快捷导出</span>
          <div class="petpal-risk-shortcuts__actions">
            <el-button
              link
              :type="isAllRiskQueueExportView ? 'success' : 'primary'"
              class="petpal-risk-shortcuts__button"
              :class="{ 'is-active': isAllRiskQueueExportView }"
              @click="applyAllRiskQueueExportPreset"
            >
              全部风险 {{ recentAftersalesOrders.length }} 笔
            </el-button>
            <el-button
              v-for="action in riskQueueExportActions"
              :key="action.preset"
              link
              :type="activeRiskQueueExportPreset === action.preset ? 'success' : 'primary'"
              class="petpal-risk-shortcuts__button"
              :class="{ 'is-active': activeRiskQueueExportPreset === action.preset }"
              @click="applyRiskQueueExportPreset(action.preset)"
            >
              {{ action.label }} {{ action.count }} 笔
            </el-button>
          </div>
        </div>

        <div v-if="currentRiskQueueExportView" class="petpal-note-row petpal-risk-current-view">
          <span>当前风险视角</span>
          <div class="petpal-risk-current-view__body">
            <strong>
              {{ currentRiskQueueExportView.label }} {{ currentRiskQueueExportView.count }} 笔
            </strong>
            <p>{{ currentRiskQueueExportView.description }}</p>
          </div>
          <el-button
            v-if="!isAllRiskQueueExportView"
            link
            type="primary"
            @click="applyAllRiskQueueExportPreset"
          >
            查看全部风险
          </el-button>
        </div>

        <div class="petpal-sheet-list">
          <div
            v-for="order in recentAftersalesOrders"
            :key="order.id"
            class="petpal-sheet-row"
            :class="{ 'is-focused': order.id === highlightedOrderId }"
          >
            <div class="petpal-sheet-row__copy">
              <h3 class="petpal-sheet-row__title">{{ order.orderNo }}</h3>
              <p class="petpal-sheet-row__desc">
                {{ getPetPalOrderStatusLabel(order.orderStatus) }} ·
                {{ getPetPalServiceTypeLabel(order.serviceType) }} · {{ order.ownerNickname }}
              </p>
              <p class="petpal-sheet-row__desc">
                {{ getAftersalesRiskSummary(order) }}
              </p>
              <div
                v-if="order.complaintCount || order.latestRefundStatus"
                class="petpal-pill-row petpal-sheet-row__signals"
              >
                <span
                  v-for="pill in getAftersalesRiskPills(order)"
                  :key="`${order.id}-${pill.label}`"
                  class="petpal-pill"
                  :class="pill.tone"
                >
                  {{ pill.label }}
                </span>
              </div>
              <p class="petpal-sheet-row__desc">
                已退 {{ formatPetPalMoney(order.amountRefunded) }}
                <template v-if="order.latestRefundAmount != null">
                  · 最近退款 {{ formatPetPalMoney(order.latestRefundAmount) }}
                </template>
                · 剩余净收入
                {{ formatPetPalMoney(getOrderNetIncome(order)) }}
              </p>
              <p class="petpal-sheet-row__desc">
                {{ formatPetPalRange(order.appointmentStart, order.appointmentEnd) }}
              </p>
            </div>
            <div class="petpal-sheet-row__tail">
              <span class="petpal-pill" :class="getAftersalesStatusPillTone(order.orderStatus)">
                {{ getPetPalOrderStatusLabel(order.orderStatus) }}
              </span>
              <el-button link type="primary" @click="applyRiskOrderExportPreset(order)">
                导出同类风险
              </el-button>
              <RouterLink :to="buildAftersalesOrderDetailLink(order.id)">查看售后</RouterLink>
            </div>
          </div>
        </div>
      </div>
    </PetPalDeskSection>

    <PetPalDeskSection
      eyebrow="Completed"
      title="最近完成的订单"
      description="履约已经结束的订单才会进入这里，方便复盘而不是再回履约动作。"
    >
      <template #actions>
        <el-button
          v-if="summaryState === 'error'"
          :loading="sectionReloadingKey === 'summary'"
          @click="retrySummary"
        >
          重试收益摘要
        </el-button>
      </template>

      <PetPalDeskEmpty
        v-if="summaryState === 'error'"
        title="最近完成订单暂未刷新完成"
        description="可以先重试收益摘要，恢复后再继续查看最近完成的订单复盘。"
      />

      <PetPalDeskEmpty
        v-else-if="!recentCompletedOrders.length"
        title="还没有完成订单"
        description="完成第一笔订单后，这里会开始沉淀复盘对象，不再把你引回履约动作。"
      />

      <div v-else class="petpal-sheet-list">
        <div
          v-for="order in recentCompletedOrders"
          :key="order.id"
          class="petpal-sheet-row"
          :class="{ 'is-focused': order.id === highlightedOrderId }"
        >
          <div class="petpal-sheet-row__copy">
            <h3 class="petpal-sheet-row__title">{{ order.orderNo }}</h3>
            <p class="petpal-sheet-row__desc">
              {{ getPetPalServiceTypeLabel(order.serviceType) }} · {{ order.ownerNickname }} ·
              {{ order.petName || '宠物待同步' }}
            </p>
            <p class="petpal-sheet-row__desc">
              {{ formatPetPalRange(order.appointmentStart, order.appointmentEnd) }}
            </p>
          </div>
          <div class="petpal-sheet-row__tail">
            <span class="petpal-pill is-success">{{
              formatPetPalMoney(getOrderNetIncome(order))
            }}</span>
            <RouterLink :to="buildOrderDetailLink(order.id)">查看订单</RouterLink>
          </div>
        </div>
      </div>
    </PetPalDeskSection>
  </PetPalDeskPage>
</template>

<script setup lang="ts">
import type {
  ComplaintTargetRole,
  ComplaintType,
  PetServiceType,
  ComplaintStatus,
  RefundType,
  RefundStatus,
  CaregiverAftersalesRiskOrderRecord,
  CaregiverEarningsOrderRecord,
  CaregiverEarningsSummaryRecord,
} from '@rbac/api-common';
import { computed, onMounted, ref } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { api } from '@/api/client';
import ListExportButton from '@/components/download/ListExportButton.vue';
import { usePetPalExportTemplates } from '@/composables/use-petpal-export-templates';
import { usePageState } from '@/composables/use-page-state';
import { getErrorMessage } from '@/utils/errors';
import PetPalDeskEmpty from './rebuild/petpal-desk-empty.vue';
import PetPalDeskNotice from './rebuild/petpal-desk-notice.vue';
import PetPalDeskPage from './rebuild/petpal-desk-page.vue';
import PetPalExportFilterSummary from './rebuild/petpal-export-filter-summary.vue';
import PetPalExportTemplateActions from './rebuild/petpal-export-template-actions.vue';
import PetPalExportToolbar from './rebuild/petpal-export-toolbar.vue';
import PetPalDeskSection from './rebuild/petpal-desk-section.vue';
import {
  buildPetPalPageNotice,
  buildPetPalDeskHandoffQuery,
  getPetPalQueryString,
  runPetPalSectionRetry,
  type PetPalSectionLoadState,
} from './recovery';
import {
  PETPAL_EXPORT_TEMPLATE_LIMIT,
  validatePetPalExportTemplateName,
} from './export-template-state';
import {
  createPetPalClearableFieldBinding,
  createPetPalFieldBinding,
  createPetPalTrimmedTextFieldBinding,
} from './export-field-bindings';
import {
  buildCaregiverEarningsExportSummaryItems,
  clearCaregiverEarningsExportSummaryItem,
  type CaregiverEarningsExportSummaryItemKey,
} from './export-filter-summary';
import {
  applyCaregiverEarningsExportFilterSnapshot,
  CAREGIVER_HIGH_REFUND_EXPOSURE_AMOUNT,
  CAREGIVER_REPEAT_COMPLAINT_COUNT,
  buildCaregiverAllRiskExportSnapshot,
  buildCaregiverRiskOrderExportSnapshot,
  buildCaregiverRiskQueueExportSnapshot,
  buildCaregiverEarningsExportQuery,
  cloneCaregiverEarningsExportFilterSnapshot,
  createEmptyCaregiverEarningsExportFilterSnapshot,
  isCaregiverAllRiskExportSnapshot,
  resolveCaregiverRiskQueueExportPreset,
  type CaregiverRiskQueueExportPreset,
  type CaregiverEarningsExportFilterSnapshot,
  type CaregiverEarningsExportTemplate,
  type EarningsExportDatePreset,
  hasCaregiverEarningsExportFilters,
  parseCaregiverEarningsExportDateRange,
  withCaregiverEarningsExportDateRange,
} from './caregiver-earnings-export-state';
import {
  buildCaregiverRiskQueueExportActions,
  getCaregiverRiskQueueExportPresetLabel,
} from './caregiver-risk-queue-export';
import {
  formatPetPalMoney,
  formatPetPalRange,
  getPetPalCaregiverAuditLabel,
  getPetPalComplaintStatusLabel,
  getPetPalComplaintTargetRoleLabel,
  getPetPalComplaintTypeLabel,
  getPetPalOrderStatusLabel,
  getPetPalRefundStatusLabel,
  getPetPalRefundStatusType,
  petPalComplaintTargetOptions,
  getPetPalServiceTypeLabel,
  petPalComplaintStatusOptions,
  petPalComplaintTypeOptions,
  petPalCaregiverWorkspaceNav,
  petPalRefundStatusOptions,
  petPalRefundTypeOptions,
  petPalServiceTypeOptions,
} from './shared';

const route = useRoute();
const summary = ref<CaregiverEarningsSummaryRecord | null>(null);
const summaryState = ref<PetPalSectionLoadState>('idle');
const sectionReloadingKey = ref<'' | 'summary'>('');

type CaregiverEarningsExportPageState = CaregiverEarningsExportFilterSnapshot & {
  templates: CaregiverEarningsExportTemplate[];
};

const exportPresetOptions: Array<{ label: string; value: Exclude<EarningsExportDatePreset, ''> }> = [
  { label: '近 7 天', value: 'last7days' },
  { label: '近 30 天', value: 'last30days' },
  { label: '本月', value: 'thisMonth' },
  { label: '上月', value: 'lastMonth' },
];
const refundExposureAmountOptions = [
  { label: '退款 >= ¥50', value: 50 },
  {
    label: `退款 >= ¥${CAREGIVER_HIGH_REFUND_EXPOSURE_AMOUNT}`,
    value: CAREGIVER_HIGH_REFUND_EXPOSURE_AMOUNT,
  },
  { label: '退款 >= ¥200', value: 200 },
] as const;
const complaintCountOptions = [
  { label: `投诉 >= ${CAREGIVER_REPEAT_COMPLAINT_COUNT} 条`, value: CAREGIVER_REPEAT_COMPLAINT_COUNT },
  { label: '投诉 >= 3 条', value: 3 },
] as const;

const { state: exportPageState } = usePageState<CaregiverEarningsExportPageState>(
  'page:petpal:caregiver-earnings-export-filters',
  {
    ...createEmptyCaregiverEarningsExportFilterSnapshot(),
    templates: [],
  },
);
const exportTemplateState = createPetPalFieldBinding<CaregiverEarningsExportTemplate[]>({
  get: () => exportPageState.templates,
  set: (value) => {
    exportPageState.templates = value;
  },
});
const {
  selectedTemplateName: selectedExportTemplateName,
  selectedTemplate: selectedExportTemplate,
  applySelectedTemplate: applyNamedExportTemplate,
  saveTemplate: saveNamedExportTemplate,
  removeSelectedTemplate: removeNamedExportTemplate,
} = usePetPalExportTemplates(exportTemplateState);

const emptyTotals: CaregiverEarningsSummaryRecord['totals'] = {
  totalIncome: 0,
  recentThirtyDayIncome: 0,
  averageTicket: 0,
  refundExposure: 0,
  completedOrderCount: 0,
  activeOrderCount: 0,
  aftersalesOrderCount: 0,
  aftersalesRiskRate: 0,
  activeServiceCount: 0,
  totalServiceCount: 0,
};

const toAmount = (value: number | string | null | undefined) => Number(value ?? 0);
const formatPercent = (value: number) =>
  `${(Math.max(value, 0) * 100).toFixed(value > 0 && value < 0.1 ? 1 : 0)}%`;
const getOrderNetIncome = (
  order: Pick<CaregiverEarningsOrderRecord, 'amountPaid' | 'amountRefunded'>,
) => Math.max(toAmount(order.amountPaid) - toAmount(order.amountRefunded), 0);
type PetPalSignalPillTone = '' | 'is-accent' | 'is-success' | 'is-warning' | 'is-danger';

const mapSignalTypeToPillTone = (
  tone: 'primary' | 'success' | 'warning' | 'info' | 'danger',
): PetPalSignalPillTone => {
  if (tone === 'primary') {
    return 'is-accent';
  }
  if (tone === 'success') {
    return 'is-success';
  }
  if (tone === 'warning') {
    return 'is-warning';
  }
  if (tone === 'danger') {
    return 'is-danger';
  }
  return '';
};
const getAftersalesStatusPillTone = (
  status: CaregiverAftersalesRiskOrderRecord['orderStatus'],
): PetPalSignalPillTone => {
  if (status === 'DISPUTED') {
    return 'is-danger';
  }
  if (status === 'REFUNDED') {
    return 'is-success';
  }
  return 'is-warning';
};
const getAftersalesRiskPills = (order: CaregiverAftersalesRiskOrderRecord) => {
  const pills: Array<{ label: string; tone: PetPalSignalPillTone }> = [];

  if (order.primaryComplaintStatus) {
    pills.push({
      label: `投诉${getPetPalComplaintStatusLabel(order.primaryComplaintStatus)}`,
      tone: mapSignalTypeToPillTone(
        order.primaryComplaintStatus === 'OPEN'
          ? 'danger'
          : order.primaryComplaintStatus === 'PROCESSING'
            ? 'warning'
            : 'info',
      ),
    });
  }
  if (order.primaryComplaintType) {
    pills.push({
      label: getPetPalComplaintTypeLabel(order.primaryComplaintType),
      tone: '',
    });
  }
  if (order.primaryComplaintTargetRole) {
    pills.push({
      label: `责任${getPetPalComplaintTargetRoleLabel(order.primaryComplaintTargetRole)}`,
      tone: order.primaryComplaintTargetRole === 'CAREGIVER' ? 'is-danger' : 'is-accent',
    });
  }
  if (order.complaintCount) {
    pills.push({
      label: `投诉 ${order.complaintCount} 条`,
      tone: order.complaintCount > 1 ? 'is-warning' : '',
    });
  }
  if (order.latestRefundStatus) {
    pills.push({
      label: getPetPalRefundStatusLabel(order.latestRefundStatus),
      tone: mapSignalTypeToPillTone(getPetPalRefundStatusType(order.latestRefundStatus)),
    });
  }

  return pills;
};
const getAftersalesRiskSummary = (order: CaregiverAftersalesRiskOrderRecord) => {
  const parts: string[] = [];

  if (order.primaryComplaintStatus) {
    parts.push(`主要投诉：${getPetPalComplaintStatusLabel(order.primaryComplaintStatus)}`);
  }
  if (order.primaryComplaintType) {
    parts.push(getPetPalComplaintTypeLabel(order.primaryComplaintType));
  }
  if (order.primaryComplaintTargetRole) {
    parts.push(`责任 ${getPetPalComplaintTargetRoleLabel(order.primaryComplaintTargetRole)}`);
  }
  if (order.latestRefundStatus) {
    const refundSummary =
      order.latestRefundAmount != null
        ? `最近退款：${getPetPalRefundStatusLabel(order.latestRefundStatus)} ${formatPetPalMoney(order.latestRefundAmount)}`
        : `最近退款：${getPetPalRefundStatusLabel(order.latestRefundStatus)}`;
    parts.push(refundSummary);
  }

  return parts.join(' · ') || '订单已进入售后链路，建议尽快复盘退款和投诉进度。';
};
const getTrendBarWidth = (value: number | string, maxRevenue: number) => {
  const revenue = toAmount(value);
  if (!maxRevenue || revenue <= 0) {
    return '0%';
  }
  return `${Math.max((revenue / maxRevenue) * 100, 12)}%`;
};
const cloneDate = (value: Date) => new Date(value.getTime());
const getStartOfDay = (value: Date) => new Date(
  value.getFullYear(),
  value.getMonth(),
  value.getDate(),
  0,
  0,
  0,
  0,
);
const getEndOfDay = (value: Date) => new Date(
  value.getFullYear(),
  value.getMonth(),
  value.getDate(),
  23,
  59,
  59,
  999,
);
const addDays = (value: Date, amount: number) => {
  const next = cloneDate(value);
  next.setDate(next.getDate() + amount);
  return next;
};
const setExportDateRange = (value: [Date, Date] | null, datePreset: EarningsExportDatePreset = '') => {
  applyCaregiverEarningsExportFilterSnapshot(exportPageState, {
    ...withCaregiverEarningsExportDateRange(
      cloneCaregiverEarningsExportFilterSnapshot(exportPageState),
      value,
    ),
    datePreset: value ? datePreset : '',
  });
};
const resolveExportPresetRange = (
  preset: Exclude<EarningsExportDatePreset, ''>,
): [Date, Date] => {
  const now = new Date();
  const todayStart = getStartOfDay(now);

  switch (preset) {
    case 'last7days':
      return [addDays(todayStart, -6), getEndOfDay(now)];
    case 'last30days':
      return [addDays(todayStart, -29), getEndOfDay(now)];
    case 'thisMonth':
      return [
        new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0),
        getEndOfDay(now),
      ];
    case 'lastMonth':
      return [
        new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0),
        new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999),
      ];
  }
};

const profile = computed(() => summary.value?.profile ?? null);
const totals = computed(() => summary.value?.totals ?? emptyTotals);
const auditLabel = computed(() =>
  profile.value ? getPetPalCaregiverAuditLabel(profile.value.auditStatus) : '未建档',
);
const exportDateRange = createPetPalFieldBinding<[Date, Date] | null>({
  get: () => parseCaregiverEarningsExportDateRange(exportPageState),
  set: (value: [Date, Date] | null) => {
    setExportDateRange(value);
  },
});
const exportServiceType = createPetPalClearableFieldBinding<PetServiceType | ''>({
  get: () => exportPageState.serviceType,
  set: (value) => {
    exportPageState.serviceType = value;
  },
});
const exportOrderNoKeyword = createPetPalTrimmedTextFieldBinding<string>({
  get: () => exportPageState.orderNoKeyword || '',
  set: (value) => {
    exportPageState.orderNoKeyword = value;
  },
});
const exportMinRefundAmount = createPetPalFieldBinding<number | null>({
  get: () => exportPageState.minRefundAmount,
  set: (value) => {
    exportPageState.minRefundAmount = value;
  },
});
const exportMinComplaintCount = createPetPalFieldBinding<number | null>({
  get: () => exportPageState.minComplaintCount,
  set: (value) => {
    exportPageState.minComplaintCount = value;
  },
});
const exportRefundType = createPetPalClearableFieldBinding<RefundType | ''>({
  get: () => exportPageState.refundType,
  set: (value) => {
    exportPageState.refundType = value;
  },
});
const exportRefundStatus = createPetPalClearableFieldBinding<RefundStatus | ''>({
  get: () => exportPageState.refundStatus,
  set: (value) => {
    exportPageState.refundStatus = value;
  },
});
const exportRefundReasonKeyword = createPetPalTrimmedTextFieldBinding<string>({
  get: () => exportPageState.refundReasonKeyword,
  set: (value) => {
    exportPageState.refundReasonKeyword = value;
  },
});
const exportComplaintStatus = createPetPalClearableFieldBinding<ComplaintStatus | ''>({
  get: () => exportPageState.complaintStatus,
  set: (value) => {
    exportPageState.complaintStatus = value;
  },
});
const exportComplaintType = createPetPalClearableFieldBinding<ComplaintType | ''>({
  get: () => exportPageState.complaintType,
  set: (value) => {
    exportPageState.complaintType = value;
  },
});
const exportComplaintKeyword = createPetPalTrimmedTextFieldBinding<string>({
  get: () => exportPageState.complaintKeyword || '',
  set: (value) => {
    exportPageState.complaintKeyword = value;
  },
});
const exportComplaintTargetRole = createPetPalClearableFieldBinding<ComplaintTargetRole | ''>({
  get: () => exportPageState.complaintTargetRole,
  set: (value) => {
    exportPageState.complaintTargetRole = value;
  },
});
const exportRiskOnly = createPetPalFieldBinding<boolean>({
  get: () => exportPageState.riskOnly,
  set: (value) => {
    exportPageState.riskOnly = value;
  },
});
const exportTemplates = computed(() => exportPageState.templates);
const highlightedOrderId = computed(() => getPetPalQueryString(route.query, 'focusOrderId'));
const latestActiveOrder = computed(() => summary.value?.latestActiveOrder ?? null);
const recentAftersalesOrders = computed(() => {
  const items = [...(summary.value?.recentAftersalesOrders ?? [])];
  if (highlightedOrderId.value) {
    const highlightedIndex = items.findIndex((item) => item.id === highlightedOrderId.value);
    if (highlightedIndex > 0) {
      items.unshift(items.splice(highlightedIndex, 1)[0]);
    }
  }
  return items;
});
const recentCompletedOrders = computed(() => {
  const items = [...(summary.value?.recentCompletedOrders ?? [])];
  if (highlightedOrderId.value) {
    const highlightedIndex = items.findIndex((item) => item.id === highlightedOrderId.value);
    if (highlightedIndex > 0) {
      items.unshift(items.splice(highlightedIndex, 1)[0]);
    }
  }
  return items;
});
const riskQueueExportActions = computed(() =>
  buildCaregiverRiskQueueExportActions(recentAftersalesOrders.value),
);
const activeRiskQueueExportPreset = computed(() => resolveCaregiverRiskQueueExportPreset(exportPageState));
const isAllRiskQueueExportView = computed(() => isCaregiverAllRiskExportSnapshot(exportPageState));
const currentRiskQueueExportView = computed<{
  label: string;
  count: number;
  description: string;
} | null>(() => {
  if (activeRiskQueueExportPreset.value) {
    const action = riskQueueExportActions.value.find(
      (item) => item.preset === activeRiskQueueExportPreset.value,
    );
    const label =
      action?.label ?? getCaregiverRiskQueueExportPresetLabel(activeRiskQueueExportPreset.value);
    return {
      label,
      count: action?.count ?? 0,
      description: `当前经营导出已对齐到${label}队列，可直接导出这一批同类风险明细。`,
    };
  }

  if (isAllRiskQueueExportView.value) {
    return {
      label: '全部风险',
      count: recentAftersalesOrders.value.length,
      description: '当前经营导出已覆盖整个风险队列，可直接导出当前周期内的全部风险明细。',
    };
  }

  return null;
});
const serviceRevenueMix = computed(
  () =>
    summary.value?.serviceRevenueMix.map((item) => ({
      ...item,
      label: getPetPalServiceTypeLabel(item.serviceType),
      shareLabel: formatPercent(item.shareRatio),
    })) ?? [],
);
const trendGroups = computed(() =>
  [
    { key: 'daily', label: '近 7 天', items: summary.value?.trends.daily ?? [] },
    { key: 'weekly', label: '近 8 周', items: summary.value?.trends.weekly ?? [] },
    { key: 'monthly', label: '近 6 个月', items: summary.value?.trends.monthly ?? [] },
  ].map((group) => ({
    ...group,
    maxRevenue: group.items.reduce((max, item) => Math.max(max, toAmount(item.revenue)), 0),
    totalRevenue: group.items.reduce((sum, item) => sum + toAmount(item.revenue), 0),
    totalOrders: group.items.reduce((sum, item) => sum + item.completedOrderCount, 0),
  })),
);
const hasTrendData = computed(() => totals.value.completedOrderCount > 0);
const activeExportPreset = computed(() => exportPageState.datePreset);
const hasExportFilters = computed(() => hasCaregiverEarningsExportFilters(exportPageState));
const exportSummaryItems = computed(() => buildCaregiverEarningsExportSummaryItems(exportPageState));
const revenueCards = computed(() => [
  {
    label: '累计收入',
    value: formatPetPalMoney(totals.value.totalIncome),
    hint: `已完成 ${totals.value.completedOrderCount} 笔订单`,
  },
  {
    label: '近 30 天收入',
    value: formatPetPalMoney(totals.value.recentThirtyDayIncome),
    hint: '按订单预约结束时间统计',
  },
  {
    label: '平均客单价',
    value: formatPetPalMoney(totals.value.averageTicket),
    hint: totals.value.completedOrderCount ? '只统计已完成订单' : '完成首单后开始累计',
  },
  {
    label: '售后风险',
    value: formatPercent(totals.value.aftersalesRiskRate),
    hint: `退款敞口 ${formatPetPalMoney(totals.value.refundExposure)}`,
  },
]);
const qualityCards = computed(() => [
  {
    label: '资料审核',
    value: auditLabel.value,
    hint:
      profile.value?.auditStatus === 'APPROVED' ? '收益页不承接资料编辑' : '先补齐资料和资质材料',
  },
  {
    label: '评分',
    value: profile.value ? Number(profile.value.ratingAvg).toFixed(1) : '--',
    hint: profile.value ? `共 ${profile.value.ratingCount} 条评价` : '资料未建立时暂无评分',
  },
  {
    label: '在售服务',
    value: String(totals.value.activeServiceCount),
    hint: `全部服务 ${totals.value.totalServiceCount} 个`,
  },
  {
    label: '当前履约',
    value: String(totals.value.activeOrderCount),
    hint: totals.value.activeOrderCount ? '有活跃履约任务待处理' : '当前没有履约积压',
  },
]);
const heroStats = computed(() => [
  {
    label: '累计收入',
    value: formatPetPalMoney(totals.value.totalIncome),
    hint: totals.value.completedOrderCount ? '只统计已完成订单' : '完成首单后开始累计',
  },
  {
    label: '近 30 天',
    value: formatPetPalMoney(totals.value.recentThirtyDayIncome),
    hint: '方便判断最近经营节奏',
  },
  {
    label: '完成单量',
    value: String(totals.value.completedOrderCount),
    hint: totals.value.averageTicket
      ? `平均每单 ${formatPetPalMoney(totals.value.averageTicket)}`
      : '暂无稳定客单',
  },
  {
    label: '售后风险',
    value: formatPercent(totals.value.aftersalesRiskRate),
    hint: `风险订单 ${totals.value.aftersalesOrderCount} 笔`,
  },
]);
const pageNotice = computed(() =>
  buildPetPalPageNotice({
    baseNotice: getPetPalQueryString(route.query, 'notice'),
    warnings: [
      summaryState.value === 'error' ? '收益摘要暂未刷新完成，可重试后继续查看经营数据' : '',
    ],
    successTitle: '已进入收益页',
    warningTitle: '收益页摘要仍未刷新完成',
  }),
);

function buildDashboardRoute(notice: string) {
  return {
    name: 'frontend-petpal-caregiver',
    query: buildPetPalDeskHandoffQuery({ notice }),
  };
}

function buildOrdersRoute(notice: string, orderId?: string) {
  return {
    name: 'frontend-petpal-caregiver-orders',
    query: buildPetPalDeskHandoffQuery({
      notice,
      ...(orderId ? { focusOrderId: orderId } : {}),
      focusRole: 'caregiver',
    }),
  };
}

function buildServicesRoute(notice: string, serviceId?: string) {
  return {
    name: 'frontend-petpal-caregiver-services',
    query: buildPetPalDeskHandoffQuery({
      notice,
      ...(serviceId ? { focusServiceId: serviceId } : {}),
    }),
  };
}

function buildProfileRoute(notice: string) {
  return {
    name: 'frontend-petpal-caregiver-profile',
    query: buildPetPalDeskHandoffQuery({ notice }),
  };
}

function applyExportPreset(preset: Exclude<EarningsExportDatePreset, ''>) {
  setExportDateRange(resolveExportPresetRange(preset), preset);
}

function clearExportFilters() {
  applyCaregiverEarningsExportFilterSnapshot(
    exportPageState,
    createEmptyCaregiverEarningsExportFilterSnapshot(),
  );
}

function clearExportSummaryItem(key: string) {
  clearCaregiverEarningsExportSummaryItem(
    exportPageState,
    key as CaregiverEarningsExportSummaryItemKey,
  );
}

function applySelectedExportTemplate() {
  const appliedTemplate = applyNamedExportTemplate((template) => {
    applyCaregiverEarningsExportFilterSnapshot(exportPageState, template);
  });

  if (!appliedTemplate) {
    return;
  }
  ElMessage.success(`已应用模板「${appliedTemplate.name}」`);
}

async function saveCurrentExportTemplate() {
  if (!hasExportFilters.value) {
    ElMessage.warning('请先选择至少一个导出筛选条件');
    return;
  }

  try {
    const { value } = await ElMessageBox.prompt(
      '为当前导出条件取一个名字，便于后续快速套用。',
      '保存经营导出模板',
      {
        confirmButtonText: '保存',
        cancelButtonText: '取消',
        inputValue: selectedExportTemplateName.value,
        inputValidator: validatePetPalExportTemplateName,
      },
    );

    const name = value.trim();
    const nextTemplate: CaregiverEarningsExportTemplate = {
      name,
      ...cloneCaregiverEarningsExportFilterSnapshot(exportPageState),
    };
    const result = saveNamedExportTemplate(nextTemplate);

    if (result.status === 'limit_exceeded') {
      ElMessage.warning(`最多只能保存 ${PETPAL_EXPORT_TEMPLATE_LIMIT} 个导出模板`);
      return;
    }

    ElMessage.success(result.status === 'updated' ? `模板「${name}」已更新` : `模板「${name}」已保存`);
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(getErrorMessage(error, '保存经营导出模板失败'));
    }
  }
}

async function deleteSelectedExportTemplate() {
  if (!selectedExportTemplate.value) {
    return;
  }

  const templateName = selectedExportTemplate.value.name;

  try {
    await ElMessageBox.confirm(
      `删除后将不再保留模板「${templateName}」的导出条件。`,
      '删除经营导出模板',
      {
        type: 'warning',
        confirmButtonText: '删除',
        cancelButtonText: '取消',
      },
    );

    const removedTemplateName = removeNamedExportTemplate();
    if (!removedTemplateName) {
      return;
    }
    ElMessage.success(`模板「${removedTemplateName}」已删除`);
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(getErrorMessage(error, '删除经营导出模板失败'));
    }
  }
}

function buildEarningsExportRequest() {
  return api.petpal.caregiver.exportEarnings(buildCaregiverEarningsExportQuery(exportPageState));
}

function buildOrderDetailLink(orderId: string) {
  return {
    name: 'frontend-petpal-order-detail',
    params: { id: orderId },
    query: buildPetPalDeskHandoffQuery({
      notice: '这笔订单已经从收益页进入详情，可继续复盘服务和售后情况。',
      focusOrderId: orderId,
      focusRole: 'caregiver',
      tab: 'summary',
    }),
  };
}

function buildAftersalesOrderDetailLink(orderId: string) {
  return {
    name: 'frontend-petpal-order-detail',
    params: { id: orderId },
    query: buildPetPalDeskHandoffQuery({
      notice: '这笔订单已经从收益页进入售后区，可直接继续复盘退款和争议风险。',
      focusOrderId: orderId,
      focusRole: 'caregiver',
      tab: 'aftersales',
    }),
  };
}

function toggleRiskOnlyExport() {
  exportRiskOnly.value = !exportRiskOnly.value;
}

function applyRiskOrderExportPreset(order: CaregiverAftersalesRiskOrderRecord) {
  applyCaregiverEarningsExportFilterSnapshot(
    exportPageState,
    buildCaregiverRiskOrderExportSnapshot(exportPageState, order),
  );

  const reasons = [
    getPetPalServiceTypeLabel(order.serviceType),
    order.primaryComplaintStatus ? getPetPalComplaintStatusLabel(order.primaryComplaintStatus) : '',
    order.primaryComplaintTargetRole
      ? getPetPalComplaintTargetRoleLabel(order.primaryComplaintTargetRole)
      : '',
    order.latestRefundStatus ? getPetPalRefundStatusLabel(order.latestRefundStatus) : '',
  ].filter(Boolean);

  ElMessage.success(
    `已切到${reasons.join(' / ') || '该风险订单'}导出条件，可直接导出同类风险明细。`,
  );
}

function applyRiskQueueExportPreset(preset: CaregiverRiskQueueExportPreset) {
  applyCaregiverEarningsExportFilterSnapshot(
    exportPageState,
    buildCaregiverRiskQueueExportSnapshot(exportPageState, preset),
  );

  const label = getCaregiverRiskQueueExportPresetLabel(preset);
  ElMessage.success(`已切到${label}导出条件，可直接导出当前队列里的同类风险明细。`);
}

function applyAllRiskQueueExportPreset() {
  applyCaregiverEarningsExportFilterSnapshot(
    exportPageState,
    buildCaregiverAllRiskExportSnapshot(exportPageState),
  );
  ElMessage.success('已切到全部风险导出条件，可直接导出当前周期内的全部风险明细。');
}

const primaryAction = computed(() => {
  if (latestActiveOrder.value) {
    return {
      label: '先回履约队列',
      to: buildOrdersRoute(
        '这里已经定位到当前最优先的一笔履约订单，可直接继续接单或签到。',
        latestActiveOrder.value.id,
      ),
      tone: 'primary' as const,
    };
  }
  if (recentAftersalesOrders.value[0]) {
    return {
      label: '先看售后风险订单',
      to: buildAftersalesOrderDetailLink(recentAftersalesOrders.value[0].id),
      tone: 'primary' as const,
    };
  }
  if (recentCompletedOrders.value[0]) {
    return {
      label: '查看最近完成订单',
      to: buildOrderDetailLink(recentCompletedOrders.value[0].id),
      tone: 'primary' as const,
    };
  }
  if (profile.value?.auditStatus !== 'APPROVED') {
    return {
      label: '先补入驻资料',
      to: buildProfileRoute('这里已经定位到照料者资料页，可先补齐城市、经验和审核材料。'),
      tone: 'primary' as const,
    };
  }
  return {
    label: totals.value.totalServiceCount ? '查看服务清单' : '去补服务清单',
    to: buildServicesRoute('这里已经定位到服务清单，可继续调整在售服务和价格。'),
    tone: 'primary' as const,
  };
});

const heroActions = computed(() => [
  {
    label: '返回总览',
    to: buildDashboardRoute(
      latestActiveOrder.value
        ? '这里已经回到照料者总览，可继续先处理履约，再回来看收益复盘。'
        : '这里已经回到照料者总览，可继续查看资料、服务和收益表现。',
    ),
    tone: 'secondary' as const,
  },
  {
    label: latestActiveOrder.value
      ? '履约队列'
      : recentAftersalesOrders.value[0]
        ? '风险订单'
      : profile.value?.auditStatus !== 'APPROVED'
        ? '资料管理'
        : '服务管理',
    to: latestActiveOrder.value
      ? buildOrdersRoute(
          '这里已经回到履约队列，可继续处理接单、签到或签退。',
          latestActiveOrder.value.id,
        )
      : recentAftersalesOrders.value[0]
        ? buildAftersalesOrderDetailLink(recentAftersalesOrders.value[0].id)
      : profile.value?.auditStatus !== 'APPROVED'
        ? buildProfileRoute('这里已经定位到照料者资料页，可继续补齐资料和审核材料。')
        : buildServicesRoute('这里已经定位到服务清单，可继续调整在售服务和价格。'),
    tone: 'secondary' as const,
  },
]);

async function loadPage() {
  summaryState.value = 'idle';
  try {
    summary.value = await api.petpal.caregiver.earningsSummary();
    summaryState.value = 'ready';
  } catch (error) {
    summary.value = null;
    summaryState.value = 'error';
    ElMessage.error(getErrorMessage(error, '加载收益页失败'));
  }
}

async function retrySummary() {
  await runPetPalSectionRetry({
    key: 'summary',
    sectionReloadingKey,
    reload: async () => {
      summaryState.value = 'idle';
      try {
        summary.value = await api.petpal.caregiver.earningsSummary();
        summaryState.value = 'ready';
      } catch (error) {
        summaryState.value = 'error';
        throw error;
      }
    },
    getState: () => summaryState.value,
    successMessage: '收益摘要已刷新',
    swallowError: true,
  });
}

onMounted(() => {
  void loadPage();
});
</script>

<style scoped lang="scss">
.petpal-metric-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.petpal-section-actions {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
}

.petpal-export-toolbar {
  margin-bottom: 16px;
}

.petpal-export-toolbar__presets {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
}

.petpal-export-toolbar__label {
  color: #6b625a;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.petpal-export-toolbar__service {
  width: 220px;
}

.petpal-metric-grid--compact {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.petpal-metric-card {
  display: grid;
  gap: 6px;
  padding: 16px;
  border-top: 1px solid rgba(39, 55, 42, 0.08);
  background: rgba(255, 255, 255, 0.66);
}

.petpal-metric-card p,
.petpal-metric-card span {
  margin: 0;
  color: #6b625a;
  line-height: 1.65;
}

.petpal-metric-card p {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.petpal-metric-card strong {
  color: #241f1a;
  font-size: 26px;
  line-height: 1.08;
}

.petpal-metric-card span {
  font-size: 13px;
}

.petpal-note-list {
  display: grid;
  gap: 10px;
}

.petpal-note-row {
  display: flex;
  gap: 16px;
  justify-content: space-between;
  align-items: center;
  padding-top: 10px;
  border-top: 1px solid rgba(39, 55, 42, 0.08);
}

.petpal-note-row span {
  color: #8f7b69;
  font-size: 12px;
  font-weight: 700;
}

.petpal-note-row strong {
  color: #2b241f;
  font-size: 14px;
  text-align: right;
}

.petpal-mix-list {
  display: grid;
  gap: 12px;
}

.petpal-mix-row {
  display: flex;
  gap: 16px;
  justify-content: space-between;
  align-items: flex-start;
  padding-top: 12px;
  border-top: 1px solid rgba(39, 55, 42, 0.08);
}

.petpal-mix-row:first-child {
  padding-top: 0;
  border-top: 0;
}

.petpal-mix-row__copy,
.petpal-mix-row__tail {
  display: grid;
  gap: 6px;
}

.petpal-mix-row__copy h3,
.petpal-mix-row__copy p,
.petpal-mix-row__tail strong,
.petpal-mix-row__tail span {
  margin: 0;
}

.petpal-mix-row__copy h3 {
  color: #2b241f;
  font-size: 18px;
}

.petpal-mix-row__copy p,
.petpal-mix-row__tail span {
  color: #6b625a;
  font-size: 13px;
  line-height: 1.65;
}

.petpal-mix-row__tail {
  justify-items: end;
  text-align: right;
}

.petpal-mix-row__tail strong {
  color: #241f1a;
  font-size: 24px;
  line-height: 1.08;
}

.petpal-trend-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.petpal-trend-card {
  display: grid;
  gap: 14px;
  padding: 16px;
  background: rgba(255, 255, 255, 0.72);
  border-top: 1px solid rgba(39, 55, 42, 0.08);
}

.petpal-trend-card__head {
  display: flex;
  gap: 16px;
  justify-content: space-between;
  align-items: flex-end;
}

.petpal-trend-card__head p,
.petpal-trend-card__head strong,
.petpal-trend-card__head span {
  margin: 0;
}

.petpal-trend-card__head p,
.petpal-trend-card__head span,
.petpal-trend-row__copy span,
.petpal-trend-row__tail span {
  color: #6b625a;
  font-size: 12px;
  line-height: 1.5;
}

.petpal-trend-card__head p {
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.petpal-trend-card__head strong {
  color: #241f1a;
  font-size: 24px;
  line-height: 1.08;
}

.petpal-trend-list {
  display: grid;
  gap: 10px;
}

.petpal-trend-row {
  display: grid;
  gap: 8px;
}

.petpal-trend-row__copy,
.petpal-trend-row__tail {
  display: flex;
  gap: 12px;
  justify-content: space-between;
  align-items: center;
}

.petpal-trend-row__copy strong,
.petpal-trend-row__tail span {
  color: #2b241f;
  font-size: 13px;
}

.petpal-trend-row__tail {
  position: relative;
  min-height: 6px;
  padding-bottom: 10px;
}

.petpal-trend-row__tail i {
  position: absolute;
  left: 0;
  bottom: 0;
  display: block;
  height: 6px;
  border-radius: 999px;
  background: linear-gradient(90deg, #dfa65b 0%, #8ab071 100%);
}

.petpal-sheet-row__signals {
  margin-top: -2px;
}

.petpal-risk-shortcuts {
  align-items: flex-start;
}

.petpal-risk-shortcuts__actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.petpal-risk-shortcuts__button.is-active {
  font-weight: 700;
}

.petpal-risk-current-view {
  align-items: flex-start;
}

.petpal-risk-current-view__body {
  display: grid;
  gap: 4px;
  justify-items: end;
  text-align: right;
}

.petpal-risk-current-view__body p {
  margin: 0;
  color: #6b625a;
  font-size: 12px;
  line-height: 1.6;
}

.petpal-sheet-row.is-focused {
  margin-inline: -10px;
  padding-inline: 16px;
  background: rgba(244, 248, 255, 0.9);
}

@media (max-width: 1080px) {
  .petpal-metric-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .petpal-trend-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .petpal-section-actions {
    align-items: stretch;
  }

  .petpal-export-toolbar__presets {
    align-items: stretch;
  }

  .petpal-export-toolbar__service {
    width: 100%;
  }

  .petpal-metric-grid,
  .petpal-metric-grid--compact {
    grid-template-columns: 1fr;
  }

  .petpal-note-row,
  .petpal-mix-row {
    flex-direction: column;
    align-items: flex-start;
  }

  .petpal-risk-shortcuts__actions {
    justify-content: flex-start;
  }

  .petpal-risk-current-view__body {
    justify-items: start;
    text-align: left;
  }

  .petpal-note-row strong,
  .petpal-mix-row__tail {
    text-align: left;
    justify-items: start;
  }
}
</style>
