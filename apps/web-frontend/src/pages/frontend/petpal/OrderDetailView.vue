<template>
  <div class="frontend-page">
    <section class="frontend-page__hero">
      <p class="frontend-page__eyebrow">订单详情</p>
      <h1>订单 {{ orderNo }}</h1>
      <p>查看订单状态、履约时间线、服务记录以及支付退款进度</p>
      <div class="frontend-page__hero-actions">
        <el-button @click="goBack">返回列表</el-button>
        <el-button v-if="order" type="primary" :loading="loading" @click="reload">刷新</el-button>
      </div>
    </section>

    <div v-loading="loading" class="petpal-order-detail">
      <div v-if="order" class="petpal-order-detail__content">
        <!-- 订单基础信息卡片 -->
        <article class="frontend-card petpal-order-detail__header">
          <span class="frontend-card__eyebrow">订单信息</span>
          <h3>{{ orderNo }}</h3>
          <div class="petpal-order-info">
            <div class="petpal-order-info__item">
              <span class="petpal-order-info__label">订单状态</span>
              <span class="petpal-order-info__value">
                <el-tag :type="getOrderStatusType(order.orderStatus)">
                  {{ getOrderStatusLabel(order.orderStatus) }}
                </el-tag>
              </span>
            </div>
            <div class="petpal-order-info__item">
              <span class="petpal-order-info__label">服务类型</span>
              <span class="petpal-order-info__value">{{ getServiceTypeLabel(order.serviceType) }}</span>
            </div>
            <div class="petpal-order-info__item">
              <span class="petpal-order-info__label">服务时间</span>
              <span class="petpal-order-info__value">
                {{ formatDate(order.appointmentStart) }} 至 {{ formatDate(order.appointmentEnd) }}
              </span>
            </div>
            <div class="petpal-order-info__item">
              <span class="petpal-order-info__label">创建时间</span>
              <span class="petpal-order-info__value">{{ formatDateTime(order.createdAt) }}</span>
            </div>
          </div>
        </article>

        <!-- 金额统计卡片 -->
        <article class="frontend-card petpal-order-detail__amounts">
          <span class="frontend-card__eyebrow">金额信息</span>
          <h3>金额统计</h3>
          <div class="petpal-amounts-grid">
            <div class="petpal-amount-item">
              <span class="petpal-amount-item__label">订单总额</span>
              <span class="petpal-amount-item__value">¥{{ formatAmount(order.amountTotal) }}</span>
            </div>
            <div v-if="Number(order.amountAdjusted) !== 0" class="petpal-amount-item">
              <span class="petpal-amount-item__label">调整金额</span>
              <span class="petpal-amount-item__value" :style="{ color: Number(order.amountAdjusted) > 0 ? '#FF6B6B' : '#52C41A' }">
                {{ Number(order.amountAdjusted) > 0 ? '+ ' : '' }}¥{{ formatAmount(Math.abs(Number(order.amountAdjusted))) }}
              </span>
            </div>
            <div class="petpal-amount-item">
              <span class="petpal-amount-item__label">已支付</span>
              <span class="petpal-amount-item__value petpal-amount-item__value--paid">¥{{ formatAmount(order.amountPaid) }}</span>
            </div>
            <div class="petpal-amount-item">
              <span class="petpal-amount-item__label">已退款</span>
              <span class="petpal-amount-item__value">¥{{ formatAmount(order.amountRefunded) }}</span>
            </div>
          </div>
        </article>

        <article class="frontend-card petpal-order-detail__fulfillment">
          <span class="frontend-card__eyebrow">履约时间线</span>
          <h3>{{ order.timeline.length > 0 ? `共 ${order.timeline.length} 条履约事件` : '暂无履约事件' }}</h3>
          <template v-if="order.timeline.length > 0">
            <div class="petpal-timeline">
              <div v-for="event in order.timeline" :key="event.id" class="petpal-timeline__item">
                <div class="petpal-timeline__dot" :class="`is-${getTimelineEventClass(event.eventType)}`" />
                <div class="petpal-timeline__content">
                  <div class="petpal-timeline__header">
                    <h4>{{ getTimelineEventLabel(event.eventType) }}</h4>
                    <span class="petpal-timeline__label">
                      <el-space wrap size="small">
                        <el-tag size="small" effect="plain">
                          {{ getOperatorRoleLabel(event.operatorRole) }}
                        </el-tag>
                      </el-space>
                    </span>
                  </div>
                  <div class="petpal-timeline__meta">
                    <span class="petpal-timeline__meta-item">
                      <strong>记录时间：</strong>{{ formatDateTime(event.createdAt) }}
                    </span>
                    <span v-if="event.operatorId" class="petpal-timeline__meta-item">
                      <strong>操作人：</strong>{{ event.operatorId }}
                    </span>
                  </div>
                  <div
                    v-for="detail in getTimelineDetails(event)"
                    :key="`${event.id}-${detail}`"
                    class="petpal-timeline__detail"
                  >
                    {{ detail }}
                  </div>
                </div>
              </div>
            </div>
          </template>
          <div v-else class="petpal-empty">
            <p>订单尚未产生履约事件</p>
          </div>
        </article>

        <article class="frontend-card petpal-order-detail__service-logs">
          <span class="frontend-card__eyebrow">服务记录</span>
          <h3>{{ order.serviceLogs.length > 0 ? `共 ${order.serviceLogs.length} 条服务记录` : '暂无服务记录' }}</h3>
          <template v-if="order.serviceLogs.length > 0">
            <div class="petpal-timeline">
              <div v-for="log in order.serviceLogs" :key="log.id" class="petpal-timeline__item">
                <div class="petpal-timeline__dot" :class="`is-${getServiceLogClass(log.logType)}`" />
                <div class="petpal-timeline__content">
                  <div class="petpal-timeline__header">
                    <h4>{{ getServiceLogTypeLabel(log.logType) }}</h4>
                    <span class="petpal-timeline__label">
                      <el-tag size="small" :type="getServiceLogTagType(log.logType)">
                        {{ getServiceLogTypeLabel(log.logType) }}
                      </el-tag>
                    </span>
                  </div>
                  <div class="petpal-timeline__meta">
                    <span class="petpal-timeline__meta-item">
                      <strong>服务时间：</strong>{{ formatDateTime(log.happenedAt) }}
                    </span>
                    <span class="petpal-timeline__meta-item">
                      <strong>媒体数量：</strong>{{ log.mediaUrls.length }}
                    </span>
                  </div>
                  <p v-if="log.textNote" class="petpal-timeline__note">{{ log.textNote }}</p>
                  <div
                    v-for="detail in getServiceLogDetails(log)"
                    :key="`${log.id}-${detail}`"
                    class="petpal-timeline__detail"
                  >
                    {{ detail }}
                  </div>
                  <div v-if="log.mediaUrls.length > 0" class="petpal-service-log-media">
                    <a
                      v-for="(url, index) in log.mediaUrls"
                      :key="`${log.id}-${url}`"
                      class="petpal-service-log-media__item"
                      :href="url"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <img
                        v-if="isPreviewableImage(url)"
                        :src="url"
                        :alt="`${getServiceLogTypeLabel(log.logType)}媒体 ${index + 1}`"
                        loading="lazy"
                      />
                      <div v-else class="petpal-service-log-media__file">
                        {{ getMediaLinkLabel(url, index) }}
                      </div>
                      <span class="petpal-service-log-media__meta">
                        {{ isPreviewableImage(url) ? '查看原图' : '打开附件' }}
                      </span>
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </template>
          <div v-else class="petpal-empty">
            <p>照料者尚未上传服务记录</p>
          </div>
        </article>

        <article class="frontend-card petpal-order-detail__messages">
          <span class="frontend-card__eyebrow">订单沟通</span>
          <div class="petpal-message-panel__header">
            <div class="petpal-message-panel__headline">
              <h3>
                {{
                  messageConversation?.messages.length
                    ? `共 ${messageConversation.messages.length} 条沟通消息`
                    : '暂无订单消息'
                }}
              </h3>
              <p>
                {{
                  order.conversation?.lastMessageAt
                    ? `最近更新于 ${formatDateTime(order.conversation.lastMessageAt)}`
                    : '订单内的服务沟通和附件回传都会保留在这里。'
                }}
              </p>
            </div>
            <el-tag v-if="currentConversationUnreadCount > 0" type="danger">
              待读 {{ currentConversationUnreadCount }}
            </el-tag>
          </div>

          <template v-if="messageConversation?.messages.length">
            <div class="petpal-message-list">
              <article
                v-for="message in messageConversation.messages"
                :key="message.id"
                :class="['petpal-message-card', { 'is-self': isOwnMessage(message) }]"
              >
                <div class="petpal-message-card__header">
                  <div>
                    <strong>{{ getConversationSenderLabel(message) }}</strong>
                    <span>{{ formatDateTime(message.createdAt) }}</span>
                  </div>
                  <el-tag size="small" effect="plain">
                    {{ isOwnMessage(message) ? '我发送的' : '对方发送' }}
                  </el-tag>
                </div>
                <p v-if="message.content" class="petpal-message-card__content">{{ message.content }}</p>
                <div v-if="message.mediaUrls.length > 0" class="petpal-service-log-media">
                  <a
                    v-for="(url, index) in message.mediaUrls"
                    :key="`${message.id}-${url}`"
                    class="petpal-service-log-media__item"
                    :href="url"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <img
                      v-if="isPreviewableImage(url)"
                      :src="url"
                      :alt="`消息附件 ${index + 1}`"
                      loading="lazy"
                    />
                    <div v-else class="petpal-service-log-media__file">
                      {{ getMediaLinkLabel(url, index) }}
                    </div>
                    <span class="petpal-service-log-media__meta">
                      {{ isPreviewableImage(url) ? '查看附件' : '打开文件' }}
                    </span>
                  </a>
                </div>
              </article>
            </div>
          </template>
          <div v-else class="petpal-empty">
            <p>当前还没有订单沟通记录，发送第一条消息即可建立会话。</p>
          </div>

          <div class="petpal-message-composer">
            <el-input
              v-model="messageForm.content"
              type="textarea"
              :rows="3"
              maxlength="1000"
              show-word-limit
              placeholder="补充照料安排、交接说明或售后沟通内容"
            />
            <input
              ref="messageFileInput"
              class="petpal-hidden-file-input"
              type="file"
              multiple
              accept="image/*,video/*,.pdf,.doc,.docx,.txt"
              @change="onMessageFilesChange"
            />
            <div class="petpal-message-composer__actions">
              <el-space wrap>
                <el-button plain @click="openMessageFilePicker">选择附件</el-button>
                <el-button
                  v-if="currentConversationUnreadCount > 0"
                  plain
                  type="success"
                  @click="markConversationAsRead"
                >
                  标记已读
                </el-button>
              </el-space>
              <el-button type="primary" :loading="messageSubmitting" @click="submitMessage">
                发送消息
              </el-button>
            </div>
            <ul v-if="messageForm.files.length > 0" class="petpal-message-file-list">
              <li
                v-for="(file, index) in messageForm.files"
                :key="`${file.name}-${file.size}-${index}`"
                class="petpal-message-file-item"
              >
                <div>
                  <strong>{{ file.name }}</strong>
                  <span>{{ Math.max(1, Math.round(file.size / 1024)) }} KB</span>
                </div>
                <el-button link type="danger" @click="removeMessageFile(index)">移除</el-button>
              </li>
            </ul>
            <el-progress
              v-if="messageUploadProgress !== null"
              :percentage="messageUploadProgress"
              :stroke-width="10"
            />
          </div>
        </article>

        <article class="frontend-card petpal-order-detail__review">
          <span class="frontend-card__eyebrow">服务评价</span>
          <div class="petpal-review-card__header">
            <div class="petpal-review-card__headline">
              <h3>
                {{
                  order.review
                    ? '已提交评价'
                    : canCreateReview
                      ? '服务已完成，等待评价'
                      : '暂无评价'
                }}
              </h3>
              <p v-if="order.review">
                评价提交于 {{ formatDateTime(order.review.createdAt) }}
              </p>
              <p v-else-if="canCreateReview">
                评价将用于完善照料者服务画像与后续匹配结果。
              </p>
              <p v-else-if="order.orderStatus === 'COMPLETED'">
                当前订单尚未收到宠物主人的评价。
              </p>
              <p v-else>
                订单完成后才能提交评价。
              </p>
            </div>
            <el-button v-if="canCreateReview" type="primary" @click="openReviewDialog">
              提交评价
            </el-button>
          </div>

          <template v-if="order.review">
            <div class="petpal-review-card__body">
              <el-rate :model-value="order.review.rating" disabled show-score text-color="#c2410c" />
              <div class="petpal-review-card__meta">
                <el-tag size="small" :type="order.review.isAnonymous ? 'info' : 'success'">
                  {{ order.review.isAnonymous ? '匿名评价' : '实名评价' }}
                </el-tag>
                <span>标签数：{{ order.review.tags.length }}</span>
              </div>
              <div v-if="order.review.tags.length > 0" class="petpal-review-card__tags">
                <el-tag
                  v-for="tag in order.review.tags"
                  :key="tag"
                  size="small"
                  effect="plain"
                >
                  {{ tag }}
                </el-tag>
              </div>
              <p v-if="order.review.content" class="petpal-review-card__content">{{ order.review.content }}</p>
              <div v-else class="petpal-review-card__empty-text">
                本次评价未填写文字说明。
              </div>
            </div>
          </template>
          <div v-else class="petpal-empty">
            <p>{{ canCreateReview ? '你可以现在提交本次服务评价' : '当前暂无评价内容' }}</p>
          </div>
        </article>

        <article v-if="isOwnerView" class="frontend-card petpal-order-detail__refund-progress">
          <span class="frontend-card__eyebrow">退款进度</span>
          <div class="petpal-refund-progress__header">
            <div class="petpal-refund-progress__headline">
              <h3>{{ refundProgress ? getRefundProgressStageLabel(refundProgress.stage) : '暂无退款进度' }}</h3>
              <p>{{ refundProgress ? getRefundProgressStageHint(refundProgress.stage) : '当前暂无退款进度可展示' }}</p>
            </div>
            <el-tag v-if="refundProgress" :type="getRefundProgressStageType(refundProgress.stage)">
              {{ getRefundProgressStageLabel(refundProgress.stage) }}
            </el-tag>
          </div>

          <template v-if="refundProgress">
            <div class="petpal-refund-progress__stats">
              <div class="petpal-refund-progress__stat">
                <span>退款申请数</span>
                <strong>{{ refundProgress.totalRefundCount }}</strong>
              </div>
              <div class="petpal-refund-progress__stat">
                <span>处理中</span>
                <strong>{{ refundProgress.pendingCount + refundProgress.approvedCount }}</strong>
              </div>
              <div class="petpal-refund-progress__stat">
                <span>已退款</span>
                <strong>{{ refundProgress.successCount }}</strong>
              </div>
              <div class="petpal-refund-progress__stat">
                <span>可退余额</span>
                <strong>¥{{ formatAmount(refundProgress.refundableBalance) }}</strong>
              </div>
            </div>

            <div v-if="refundProgress.latestRefundNo" class="petpal-refund-progress__latest">
              <div class="petpal-refund-progress__latest-header">
                <h4>{{ refundProgress.latestRefundNo }}</h4>
                <el-tag
                  v-if="refundProgress.latestRefundStatus"
                  size="small"
                  :type="getRefundStatusType(refundProgress.latestRefundStatus)"
                >
                  {{ getRefundStatusLabel(refundProgress.latestRefundStatus) }}
                </el-tag>
              </div>
              <div class="petpal-refund-progress__latest-meta">
                <span><strong>申请金额：</strong>¥{{ formatAmount(refundProgress.latestRefundAmount ?? 0) }}</span>
                <span v-if="refundProgress.latestAppliedAt"><strong>申请时间：</strong>{{ formatDateTime(refundProgress.latestAppliedAt) }}</span>
                <span v-if="refundProgress.latestReviewedAt"><strong>审核时间：</strong>{{ formatDateTime(refundProgress.latestReviewedAt) }}</span>
              </div>
              <p v-if="refundProgress.latestRefundReason" class="petpal-refund-progress__reason">
                <strong>退款原因：</strong>{{ refundProgress.latestRefundReason }}
              </p>
            </div>
          </template>
          <div v-else class="petpal-empty">
            <p>当前没有退款申请，后续售后处理进度会显示在这里。</p>
          </div>
        </article>

        <article v-if="isOwnerView" class="frontend-card petpal-order-detail__complaints">
          <span class="frontend-card__eyebrow">投诉与进度</span>
          <div class="petpal-complaint-panel__header">
            <div class="petpal-complaint-panel__headline">
              <h3>
                {{
                  complaints.length > 0
                    ? `共 ${complaints.length} 条投诉记录`
                    : canCreateComplaint
                      ? '暂无投诉，可发起售后反馈'
                      : '暂无投诉记录'
                }}
              </h3>
              <p v-if="activeComplaint">
                当前存在进行中的投诉，平台处理进度会同步展示在这里。
              </p>
              <p v-else-if="canCreateComplaint">
                若对服务过程、费用或安全存在争议，可在这里发起投诉。
              </p>
              <p v-else>
                当前没有可发起或进行中的投诉。
              </p>
            </div>
            <el-button v-if="canCreateComplaint" type="danger" plain @click="openComplaintDialog">
              发起投诉
            </el-button>
          </div>

          <template v-if="complaints.length > 0">
            <div class="petpal-complaint-list">
              <article
                v-for="complaint in complaints"
                :key="complaint.id"
                class="petpal-complaint-card"
              >
                <div class="petpal-complaint-card__header">
                  <div>
                    <h4>{{ getComplaintTypeLabel(complaint.complaintType) }}</h4>
                    <p>{{ formatDateTime(complaint.createdAt) }} · 投诉对象：{{ getComplaintTargetRoleLabel(complaint.targetRole) }}</p>
                  </div>
                  <el-tag :type="getComplaintStatusType(complaint.status)">
                    {{ getComplaintStatusLabel(complaint.status) }}
                  </el-tag>
                </div>

                <p class="petpal-complaint-card__description">{{ complaint.description }}</p>

                <div v-if="complaint.evidenceUrls.length > 0" class="petpal-service-log-media">
                  <a
                    v-for="(url, index) in complaint.evidenceUrls"
                    :key="`${complaint.id}-${url}`"
                    class="petpal-service-log-media__item"
                    :href="url"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <img
                      v-if="isPreviewableImage(url)"
                      :src="url"
                      :alt="`投诉证据 ${index + 1}`"
                      loading="lazy"
                    />
                    <div v-else class="petpal-service-log-media__file">
                      {{ getMediaLinkLabel(url, index) }}
                    </div>
                    <span class="petpal-service-log-media__meta">
                      {{ isPreviewableImage(url) ? '查看证据' : '打开证据链接' }}
                    </span>
                  </a>
                </div>

                <div v-if="complaint.resultSummary" class="petpal-complaint-card__result">
                  <strong>处理结论：</strong>{{ complaint.resultSummary }}
                </div>

                <div class="petpal-complaint-progress">
                  <div
                    v-for="log in complaint.processLogs"
                    :key="log.id"
                    class="petpal-complaint-progress__item"
                  >
                    <strong>{{ getComplaintActionLabel(log.actionType) }}</strong>
                    <span>{{ formatDateTime(log.createdAt) }}</span>
                    <p v-if="log.note">{{ log.note }}</p>
                  </div>
                </div>
              </article>
            </div>
          </template>
          <div v-else class="petpal-empty">
            <p>{{ canCreateComplaint ? '当前还没有投诉记录' : '暂无投诉进度可展示' }}</p>
          </div>
        </article>

        <article v-if="isOwnerView" class="frontend-card petpal-order-detail__aftersales">
          <span class="frontend-card__eyebrow">售后时间线</span>
          <h3>{{ aftersalesTimeline.length > 0 ? `共 ${aftersalesTimeline.length} 个售后节点` : '暂无售后节点' }}</h3>
          <template v-if="aftersalesTimeline.length > 0">
            <div class="petpal-timeline">
              <div v-for="item in aftersalesTimeline" :key="item.id" class="petpal-timeline__item">
                <div class="petpal-timeline__dot" :class="`is-${item.dotClass}`" />
                <div class="petpal-timeline__content">
                  <div class="petpal-timeline__header">
                    <h4>{{ item.title }}</h4>
                    <span class="petpal-timeline__label">
                      <el-tag size="small" :type="item.statusType">
                        {{ item.statusLabel }}
                      </el-tag>
                    </span>
                  </div>
                  <div class="petpal-timeline__meta">
                    <span class="petpal-timeline__meta-item">
                      <strong>时间：</strong>{{ formatDateTime(item.occurredAt) }}
                    </span>
                    <span class="petpal-timeline__meta-item">
                      <strong>{{ item.referenceLabel }}：</strong>{{ item.referenceValue }}
                    </span>
                  </div>
                  <p v-if="item.note" class="petpal-timeline__note">{{ item.note }}</p>
                  <p
                    v-for="detail in item.details"
                    :key="`${item.id}-${detail}`"
                    class="petpal-timeline__detail"
                  >
                    {{ detail }}
                  </p>
                </div>
              </div>
            </div>
          </template>
          <div v-else class="petpal-empty">
            <p>当前暂无退款申请或投诉处理记录。</p>
          </div>
        </article>

        <!-- 支付时间线 -->
        <article class="frontend-card petpal-order-detail__payments">
          <span class="frontend-card__eyebrow">支付记录</span>
          <h3>{{ order.payments.length > 0 ? `共 ${order.payments.length} 条支付记录` : '暂无支付记录' }}</h3>
          <template v-if="order.payments.length > 0">
            <div class="petpal-timeline">
              <div v-for="(payment, index) in order.payments" :key="payment.id" class="petpal-timeline__item">
                <div class="petpal-timeline__dot" :class="`is-${getPaymentStatusClass(payment.payStatus)}`" />
                <div class="petpal-timeline__content">
                  <div class="petpal-timeline__header">
                    <h4>{{ payment.payNo }}</h4>
                    <span class="petpal-timeline__label">
                      <el-tag size="small" :type="getPaymentStatusType(payment.payStatus)">
                        {{ getPaymentStatusLabel(payment.payStatus) }}
                      </el-tag>
                    </span>
                  </div>
                  <div class="petpal-timeline__meta">
                    <span class="petpal-timeline__meta-item">
                      <strong>金额：</strong>¥{{ formatAmount(payment.payAmount) }}
                    </span>
                    <span class="petpal-timeline__meta-item">
                      <strong>类型：</strong>{{ getPaymentBizTypeLabel(payment.bizType) }}
                    </span>
                  </div>
                  <div class="petpal-timeline__meta">
                    <span class="petpal-timeline__meta-item">
                      
                    </span>
                    <template v-if="payment.paidAt">
                      <span class="petpal-timeline__meta-item">
                        <strong>完成：</strong>{{ formatDateTime(payment.paidAt) }}
                      </span>
                    </template>
                  </div>
                </div>
              </div>
            </div>
          </template>
          <div v-else class="petpal-empty">
            <p>暂无支付记录</p>
          </div>
        </article>

        <!-- 退款时间线 -->
        <article class="frontend-card petpal-order-detail__refunds">
          <span class="frontend-card__eyebrow">退款记录</span>
          <div class="petpal-section-heading">
            <h3>{{ order.refunds.length > 0 ? `共 ${order.refunds.length} 条退款记录` : '暂无退款记录' }}</h3>
            <ListExportButton
              v-if="isOwnerView && order.refunds.length > 0"
              :request="buildOrderRefundExportRequest"
              label="导出退款明细"
              pending-label="导出中"
              error-message="导出退款明细失败"
            />
          </div>
          <template v-if="order.refunds.length > 0">
            <div class="petpal-timeline">
              <div v-for="refund in order.refunds" :key="refund.id" class="petpal-timeline__item">
                <div class="petpal-timeline__dot" :class="`is-${getRefundStatusClass(refund.refundStatus)}`" />
                <div class="petpal-timeline__content">
                  <div class="petpal-timeline__header">
                    <h4>{{ refund.refundNo }}</h4>
                    <span class="petpal-timeline__label">
                      <el-tag size="small" :type="getRefundStatusType(refund.refundStatus)">
                        {{ getRefundStatusLabel(refund.refundStatus) }}
                      </el-tag>
                    </span>
                  </div>
                  <div class="petpal-timeline__meta">
                    <span class="petpal-timeline__meta-item">
                      <strong>金额：</strong>¥{{ formatAmount(refund.refundAmount) }}
                    </span>
                    <span class="petpal-timeline__meta-item">
                      <strong>类型：</strong>{{ getRefundTypeLabel(refund.refundType) }}
                    </span>
                  </div>
                  <div class="petpal-timeline__meta">
                    <span class="petpal-timeline__meta-item">
                      
                    </span>
                    <template v-if="refund.reviewedAt">
                      <span class="petpal-timeline__meta-item">
                        <strong>审核完成：</strong>{{ formatDateTime(refund.reviewedAt) }}
                      </span>
                    </template>
                  </div>
                </div>
              </div>
            </div>
          </template>
          <div v-else class="petpal-empty">
            <p>暂无退款记录</p>
          </div>
        </article>
      </div>
      <div v-else-if="!loading" class="petpal-empty">
        <p>订单未找到</p>
      </div>

      <el-dialog
        v-model="reviewDialogVisible"
        title="提交服务评价"
        width="560px"
        :close-on-click-modal="!reviewSubmitting"
        :close-on-press-escape="!reviewSubmitting"
        @closed="resetReviewDialog"
      >
        <el-form label-position="top">
          <el-form-item label="综合评分" required>
            <el-rate v-model="reviewForm.rating" />
          </el-form-item>

          <el-form-item label="评价标签">
            <el-select
              v-model="reviewForm.tags"
              multiple
              filterable
              allow-create
              default-first-option
              placeholder="可选择预设标签，也可直接输入"
              style="width: 100%"
            >
              <el-option
                v-for="tag in reviewPresetTags"
                :key="tag"
                :label="tag"
                :value="tag"
              />
            </el-select>
          </el-form-item>

          <el-form-item label="文字评价">
            <el-input
              v-model="reviewForm.content"
              type="textarea"
              :rows="4"
              maxlength="1000"
              show-word-limit
              placeholder="可以补充说明服务过程、沟通感受或宠物状态"
            />
          </el-form-item>

          <el-form-item>
            <el-checkbox v-model="reviewForm.isAnonymous">匿名展示本次评价</el-checkbox>
          </el-form-item>
        </el-form>

        <template #footer>
          <el-button :disabled="reviewSubmitting" @click="reviewDialogVisible = false">取消</el-button>
          <el-button type="primary" :loading="reviewSubmitting" @click="submitReview">
            提交评价
          </el-button>
        </template>
      </el-dialog>

      <el-dialog
        v-model="complaintDialogVisible"
        title="发起投诉"
        width="620px"
        :close-on-click-modal="!complaintSubmitting"
        :close-on-press-escape="!complaintSubmitting"
        @closed="resetComplaintDialog"
      >
        <el-form label-position="top">
          <el-form-item label="投诉对象">
            <el-select v-model="complaintForm.targetRole" style="width: 100%">
              <el-option label="照料者" value="CAREGIVER" />
              <el-option label="平台" value="PLATFORM" />
            </el-select>
          </el-form-item>

          <el-form-item label="投诉类型">
            <el-select v-model="complaintForm.complaintType" style="width: 100%">
              <el-option label="服务质量" value="SERVICE" />
              <el-option label="费用争议" value="FEE" />
              <el-option label="安全问题" value="SAFETY" />
              <el-option label="欺诈风险" value="FRAUD" />
              <el-option label="其他问题" value="OTHER" />
            </el-select>
          </el-form-item>

          <el-form-item label="投诉说明" required>
            <el-input
              v-model="complaintForm.description"
              type="textarea"
              :rows="5"
              maxlength="2000"
              show-word-limit
              placeholder="请描述争议事实、发生时间和希望平台协助处理的内容"
            />
          </el-form-item>

          <el-form-item label="证据链接">
            <el-select
              v-model="complaintForm.evidenceUrls"
              multiple
              filterable
              allow-create
              default-first-option
              placeholder="可粘贴图片、视频或文件链接"
              style="width: 100%"
            />
            <div class="petpal-dialog-hint">{{ complaintEvidenceHint }}</div>
          </el-form-item>
        </el-form>

        <template #footer>
          <el-button :disabled="complaintSubmitting" @click="complaintDialogVisible = false">取消</el-button>
          <el-button type="danger" :loading="complaintSubmitting" @click="submitComplaint">
            提交投诉
          </el-button>
        </template>
      </el-dialog>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { api } from '@/api/client';
import ListExportButton from '@/components/download/ListExportButton.vue';
import { useAuthStore } from '@/stores/auth';
import { getErrorMessage } from '@/utils/errors';
import { uploadAttachmentFile } from '@/utils/direct-upload';
import type {
  ComplaintActionType,
  ComplaintRecord,
  ComplaintStatus,
  ComplaintTargetRole,
  ComplaintType,
  CreateComplaintPayload,
  CreateOrderMessagePayload,
  CreateOrderReviewPayload,
  OrderDetailRecord,
  OrderConversationDetailRecord,
  OrderMessageRecord,
  OrderOperatorRole,
  OrderRefundProgressRecord,
  OrderStatus,
  OrderTimelineEventType,
  OrderTimelineRecord,
  PaymentBizType,
  PaymentStatus,
  PetServiceType,
  RefundStatus,
  RefundType,
  ServiceLogRecord,
  ServiceLogType,
} from '@rbac/api-common';

const router = useRouter();
const orderId = router.currentRoute.value.params.id as string;
const auth = useAuthStore();

const order = ref<OrderDetailRecord | null>(null);
const orderNo = ref('');
const complaints = ref<ComplaintRecord[]>([]);
const refundProgress = ref<OrderRefundProgressRecord | null>(null);
const messageConversation = ref<OrderConversationDetailRecord | null>(null);
const loading = ref(false);
const reviewDialogVisible = ref(false);
const reviewSubmitting = ref(false);
const complaintDialogVisible = ref(false);
const complaintSubmitting = ref(false);
const messageSubmitting = ref(false);
const messageUploadProgress = ref<number | null>(null);
const messageFileInput = ref<HTMLInputElement | null>(null);

const reviewPresetTags = ['准时签到', '沟通顺畅', '反馈及时', '服务细致', '宠物状态稳定', '环境整洁'];
const complaintEvidenceHint = '可粘贴已上传附件 URL，后续会补充直接上传证据能力';

const createEmptyReviewForm = () => ({
  rating: 5,
  tags: [] as string[],
  content: '',
  isAnonymous: false,
});

const createEmptyComplaintForm = () => ({
  targetRole: 'CAREGIVER' as ComplaintTargetRole,
  complaintType: 'SERVICE' as ComplaintType,
  description: '',
  evidenceUrls: [] as string[],
});

const reviewForm = reactive(createEmptyReviewForm());
const complaintForm = reactive(createEmptyComplaintForm());
const messageForm = reactive({
  content: '',
  files: [] as File[],
});

type AftersalesTimelineDotClass = 'pending' | 'success' | 'warning' | 'error';

interface AftersalesTimelineItem {
  id: string;
  occurredAt: string;
  title: string;
  statusLabel: string;
  statusType: 'primary' | 'success' | 'warning' | 'info' | 'danger';
  dotClass: AftersalesTimelineDotClass;
  referenceLabel: string;
  referenceValue: string;
  note: string | null;
  details: string[];
}

const isOwnerView = computed(() => Boolean(auth.user?.id && order.value?.ownerId === auth.user.id));
const canCreateReview = computed(() =>
  Boolean(isOwnerView.value && order.value?.orderStatus === 'COMPLETED' && !order.value?.review),
);
const activeComplaint = computed(() =>
  complaints.value.find((item) => item.status === 'OPEN' || item.status === 'PROCESSING') ?? null,
);
const canCreateComplaint = computed(() =>
  Boolean(
    isOwnerView.value
    && order.value
    && ['SERVING', 'COMPLETED', 'PARTIAL_REFUNDED', 'REFUNDED', 'DISPUTED'].includes(order.value.orderStatus)
    && !activeComplaint.value,
  ),
);
const currentConversationUnreadCount = computed(() => {
  if (!messageConversation.value) {
    return 0;
  }

  return isOwnerView.value
    ? messageConversation.value.ownerUnreadCount
    : messageConversation.value.caregiverUnreadCount;
});

const formatAmount = (value: unknown) => {
  if (!value) return '0.00';
  return Number(value).toFixed(2);
};

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString('zh-CN');
};

const formatDateTime = (dateStr: string) => {
  return new Date(dateStr).toLocaleString('zh-CN');
};

const getRecordString = (record: Record<string, unknown> | null | undefined, key: string) => {
  const value = record?.[key];
  return typeof value === 'string' && value.trim() ? value : null;
};

const getRecordNumber = (record: Record<string, unknown> | null | undefined, key: string) => {
  const value = record?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
};

const formatGeoValue = (value: unknown) => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const lat = (value as { lat?: unknown }).lat;
  const lng = (value as { lng?: unknown }).lng;
  if (typeof lat === 'number' && typeof lng === 'number') {
    return `${lat.toFixed(3)}, ${lng.toFixed(3)}`;
  }

  return null;
};

const getOrderStatusLabel = (status: OrderStatus): string => {
  const labels: Record<OrderStatus, string> = {
    PENDING_ACCEPT: '待接单',
    ACCEPTED: '已接单',
    SERVING: '服务中',
    COMPLETED: '已完成',
    CANCELLED: '已取消',
    DISPUTED: '纠纷中',
    PARTIAL_REFUNDED: '部分退款',
    REFUNDED: '全额退款',
  };
  return labels[status] || status;
};

const getOrderStatusType = (status: OrderStatus): 'primary' | 'success' | 'warning' | 'info' | 'danger' => {
  const types: Record<OrderStatus, 'primary' | 'success' | 'warning' | 'info' | 'danger'> = {
    PENDING_ACCEPT: 'info',
    ACCEPTED: 'primary',
    SERVING: 'warning',
    COMPLETED: 'success',
    CANCELLED: 'danger',
    DISPUTED: 'danger',
    PARTIAL_REFUNDED: 'warning',
    REFUNDED: 'info',
  };
  return types[status] || 'info';
};

const getServiceTypeLabel = (type: PetServiceType): string => {
  const labels: Record<PetServiceType, string> = {
    BOARDING: '寄养',
    WALKING: '遛宠',
    FEEDING: '喂养',
    DOOR_VISIT: '上门陪伴',
  };
  return labels[type] || type;
};

const getTimelineEventLabel = (eventType: OrderTimelineEventType): string => {
  const labels: Record<OrderTimelineEventType, string> = {
    CREATED: '订单创建',
    ACCEPTED: '照料者接单',
    CHECKED_IN: '照料者签到',
    SERVICE_LOGGED: '上传服务记录',
    CHECKED_OUT: '照料者签退',
    COMPLETED: '业主确认完成',
    DISPUTED: '发起投诉',
    CANCELLED: '订单取消',
    REFUND_APPLIED: '发起退款',
    REFUND_DONE: '退款完成',
  };
  return labels[eventType] || eventType;
};

const getTimelineEventClass = (eventType: OrderTimelineEventType): string => {
  const classes: Record<OrderTimelineEventType, string> = {
    CREATED: 'pending',
    ACCEPTED: 'success',
    CHECKED_IN: 'warning',
    SERVICE_LOGGED: 'primary',
    CHECKED_OUT: 'success',
    COMPLETED: 'success',
    DISPUTED: 'error',
    CANCELLED: 'error',
    REFUND_APPLIED: 'warning',
    REFUND_DONE: 'info',
  };
  return classes[eventType] || 'info';
};

const getOperatorRoleLabel = (role: OrderOperatorRole): string => {
  const labels: Record<OrderOperatorRole, string> = {
    OWNER: '宠物主人',
    CAREGIVER: '照料者',
    ADMIN: '管理员',
    SYSTEM: '系统',
  };
  return labels[role] || role;
};

const getServiceLogTypeLabel = (type: ServiceLogType): string => {
  const labels: Record<ServiceLogType, string> = {
    CHECK_IN: '签到记录',
    FEED: '喂养记录',
    WALK: '遛宠记录',
    PLAY: '陪玩记录',
    HEALTH: '健康观察',
    CHECK_OUT: '签退记录',
    NOTE: '服务备注',
  };
  return labels[type] || type;
};

const getServiceLogClass = (type: ServiceLogType): string => {
  const classes: Record<ServiceLogType, string> = {
    CHECK_IN: 'warning',
    FEED: 'primary',
    WALK: 'success',
    PLAY: 'primary',
    HEALTH: 'error',
    CHECK_OUT: 'info',
    NOTE: 'pending',
  };
  return classes[type] || 'info';
};

const getServiceLogTagType = (type: ServiceLogType): 'primary' | 'success' | 'warning' | 'info' | 'danger' => {
  const types: Record<ServiceLogType, 'primary' | 'success' | 'warning' | 'info' | 'danger'> = {
    CHECK_IN: 'warning',
    FEED: 'primary',
    WALK: 'success',
    PLAY: 'primary',
    HEALTH: 'danger',
    CHECK_OUT: 'info',
    NOTE: 'info',
  };
  return types[type] || 'info';
};

const getPaymentStatusLabel = (status: PaymentStatus): string => {
  const labels: Record<PaymentStatus, string> = {
    PENDING: '待支付',
    PAID: '已支付',
    FAILED: '支付失败',
    CLOSED: '已关闭',
  };
  return labels[status] || status;
};

const getPaymentStatusType = (status: PaymentStatus): 'primary' | 'success' | 'warning' | 'info' | 'danger' => {
  const types: Record<PaymentStatus, 'primary' | 'success' | 'warning' | 'info' | 'danger'> = {
    PENDING: 'info',
    PAID: 'success',
    FAILED: 'danger',
    CLOSED: 'info',
  };
  return types[status] || 'info';
};

const getPaymentStatusClass = (status: PaymentStatus): string => {
  const classes: Record<PaymentStatus, string> = {
    PENDING: 'pending',
    PAID: 'success',
    FAILED: 'error',
    CLOSED: 'info',
  };
  return classes[status] || 'info';
};

const getPaymentBizTypeLabel = (type: PaymentBizType): string => {
  const labels: Record<PaymentBizType, string> = {
    DEPOSIT: '定金',
    BALANCE: '尾款',
    ADJUSTMENT: '调整',
  };
  return labels[type] || type;
};

const getRefundStatusLabel = (status: RefundStatus): string => {
  const labels: Record<RefundStatus, string> = {
    PENDING: '处理中',
    APPROVED: '已批准',
    REJECTED: '已拒绝',
    SUCCESS: '已退款',
    FAILED: '退款失败',
  };
  return labels[status] || status;
};

const getRefundStatusType = (status: RefundStatus): 'primary' | 'success' | 'warning' | 'info' | 'danger' => {
  const types: Record<RefundStatus, 'primary' | 'success' | 'warning' | 'info' | 'danger'> = {
    PENDING: 'info',
    APPROVED: 'warning',
    REJECTED: 'danger',
    SUCCESS: 'success',
    FAILED: 'danger',
  };
  return types[status] || 'info';
};

const getRefundStatusClass = (status: RefundStatus): string => {
  const classes: Record<RefundStatus, string> = {
    PENDING: 'pending',
    APPROVED: 'warning',
    REJECTED: 'error',
    SUCCESS: 'success',
    FAILED: 'error',
  };
  return classes[status] || 'info';
};

const getRefundTypeLabel = (type: RefundType): string => {
  const labels: Record<RefundType, string> = {
    FULL: '全额退款',
    PARTIAL: '部分退款',
  };
  return labels[type] || type;
};

const getRefundProgressStageLabel = (stage: OrderRefundProgressRecord['stage']) => {
  const labels: Record<OrderRefundProgressRecord['stage'], string> = {
    NONE: '暂无退款',
    PENDING_REVIEW: '待审核',
    APPROVED_WAITING: '待退款',
    PARTIAL_SUCCESS: '部分退款成功',
    FULL_SUCCESS: '退款完成',
    REJECTED: '已驳回',
    FAILED: '退款失败',
  };
  return labels[stage] ?? stage;
};

const getRefundProgressStageType = (
  stage: OrderRefundProgressRecord['stage'],
): 'primary' | 'success' | 'warning' | 'info' | 'danger' => {
  const types: Record<OrderRefundProgressRecord['stage'], 'primary' | 'success' | 'warning' | 'info' | 'danger'> = {
    NONE: 'info',
    PENDING_REVIEW: 'warning',
    APPROVED_WAITING: 'primary',
    PARTIAL_SUCCESS: 'warning',
    FULL_SUCCESS: 'success',
    REJECTED: 'info',
    FAILED: 'danger',
  };
  return types[stage] ?? 'info';
};

const getRefundProgressStageHint = (stage: OrderRefundProgressRecord['stage']) => {
  const hints: Record<OrderRefundProgressRecord['stage'], string> = {
    NONE: '当前暂无退款申请，后续售后进度会在这里同步展示。',
    PENDING_REVIEW: '退款申请已提交，等待平台审核处理。',
    APPROVED_WAITING: '退款申请已审核通过，等待退款渠道回调。',
    PARTIAL_SUCCESS: '订单已完成部分退款，可继续查看剩余可退余额。',
    FULL_SUCCESS: '退款已完成，订单售后金额已经结清。',
    REJECTED: '最近一笔退款申请已被驳回，可根据原因补充说明后再次联系平台。',
    FAILED: '退款处理失败，建议尽快联系平台核查渠道回执。',
  };
  return hints[stage] ?? stage;
};

const getComplaintTargetRoleLabel = (role: ComplaintTargetRole): string => {
  const labels: Record<ComplaintTargetRole, string> = {
    CAREGIVER: '照料者',
    PLATFORM: '平台',
  };
  return labels[role] || role;
};

const getComplaintTypeLabel = (type: ComplaintType): string => {
  const labels: Record<ComplaintType, string> = {
    SAFETY: '安全问题',
    FEE: '费用争议',
    SERVICE: '服务质量',
    FRAUD: '欺诈风险',
    OTHER: '其他问题',
  };
  return labels[type] || type;
};

const getComplaintStatusLabel = (status: ComplaintStatus): string => {
  const labels: Record<ComplaintStatus, string> = {
    OPEN: '待受理',
    PROCESSING: '处理中',
    RESOLVED: '已解决',
    REJECTED: '已驳回',
  };
  return labels[status] || status;
};

const getComplaintStatusType = (status: ComplaintStatus): 'primary' | 'success' | 'warning' | 'info' | 'danger' => {
  const types: Record<ComplaintStatus, 'primary' | 'success' | 'warning' | 'info' | 'danger'> = {
    OPEN: 'warning',
    PROCESSING: 'primary',
    RESOLVED: 'success',
    REJECTED: 'info',
  };
  return types[status] || 'info';
};

const getComplaintActionLabel = (actionType: ComplaintActionType): string => {
  const labels: Record<ComplaintActionType, string> = {
    OPEN: '已提交投诉',
    ASSIGN: '已分配处理人',
    INVESTIGATE: '调查核实',
    CALL_USER: '联系用户',
    PENALTY: '处罚处理',
    CLOSE: '投诉结案',
  };
  return labels[actionType] || actionType;
};

const getRefundAftersalesDotClass = (status: RefundStatus): AftersalesTimelineDotClass => {
  const classes: Record<RefundStatus, AftersalesTimelineDotClass> = {
    PENDING: 'warning',
    APPROVED: 'pending',
    REJECTED: 'error',
    SUCCESS: 'success',
    FAILED: 'error',
  };
  return classes[status] || 'pending';
};

const getComplaintAftersalesDotClass = (status: ComplaintStatus): AftersalesTimelineDotClass => {
  const classes: Record<ComplaintStatus, AftersalesTimelineDotClass> = {
    OPEN: 'warning',
    PROCESSING: 'pending',
    RESOLVED: 'success',
    REJECTED: 'error',
  };
  return classes[status] || 'pending';
};

const buildRefundAftersalesItems = (refund: OrderDetailRecord['refunds'][number]): AftersalesTimelineItem[] => {
  const items: AftersalesTimelineItem[] = [
    {
      id: `${refund.id}-created`,
      occurredAt: refund.createdAt,
      title: '退款申请已提交',
      statusLabel: '退款申请',
      statusType: 'warning',
      dotClass: 'warning',
      referenceLabel: '退款单号',
      referenceValue: refund.refundNo,
      note: `申请退款 ¥${formatAmount(refund.refundAmount)}`,
      details: [
        `退款类型：${getRefundTypeLabel(refund.refundType)}`,
        `当前状态：${getRefundStatusLabel(refund.refundStatus)}`,
        `退款原因：${refund.refundReason}`,
      ],
    },
  ];

  if (refund.reviewedAt) {
    const reviewTitle = refund.refundStatus === 'REJECTED'
      ? '退款申请已驳回'
      : refund.refundStatus === 'APPROVED'
        ? '退款审核已通过'
        : refund.refundStatus === 'SUCCESS'
          ? '退款审核已完成'
          : '退款审核状态已更新';

    items.push({
      id: `${refund.id}-reviewed`,
      occurredAt: refund.reviewedAt,
      title: reviewTitle,
      statusLabel: getRefundStatusLabel(refund.refundStatus),
      statusType: getRefundStatusType(refund.refundStatus),
      dotClass: getRefundAftersalesDotClass(refund.refundStatus),
      referenceLabel: '退款单号',
      referenceValue: refund.refundNo,
      note: refund.refundStatus === 'REJECTED'
        ? '平台已完成审核，本次退款申请未通过。'
        : '平台已完成退款审核，后续结果会继续同步。',
      details: [
        `退款金额：¥${formatAmount(refund.refundAmount)}`,
        `审核人：${refund.reviewedBy || '平台管理员'}`,
        `退款类型：${getRefundTypeLabel(refund.refundType)}`,
      ],
    });
  }

  if (
    ['SUCCESS', 'FAILED'].includes(refund.refundStatus)
    && refund.updatedAt !== refund.reviewedAt
    && refund.updatedAt !== refund.createdAt
  ) {
    items.push({
      id: `${refund.id}-settled`,
      occurredAt: refund.updatedAt,
      title: refund.refundStatus === 'SUCCESS' ? '退款结果已到账' : '退款处理失败',
      statusLabel: getRefundStatusLabel(refund.refundStatus),
      statusType: getRefundStatusType(refund.refundStatus),
      dotClass: getRefundAftersalesDotClass(refund.refundStatus),
      referenceLabel: '退款单号',
      referenceValue: refund.refundNo,
      note: refund.refundStatus === 'SUCCESS'
        ? `退款金额 ¥${formatAmount(refund.refundAmount)} 已完成处理。`
        : '退款渠道返回失败结果，建议尽快联系平台核查。',
      details: [
        `退款类型：${getRefundTypeLabel(refund.refundType)}`,
        `退款原因：${refund.refundReason}`,
      ],
    });
  }

  return items;
};

const buildComplaintAftersalesItems = (complaint: ComplaintRecord): AftersalesTimelineItem[] => {
  const items: AftersalesTimelineItem[] = [];

  if (!complaint.processLogs.some((log) => log.actionType === 'OPEN')) {
    items.push({
      id: `${complaint.id}-created`,
      occurredAt: complaint.createdAt,
      title: '投诉已提交',
      statusLabel: getComplaintStatusLabel(complaint.status),
      statusType: getComplaintStatusType(complaint.status),
      dotClass: getComplaintAftersalesDotClass(complaint.status),
      referenceLabel: '投诉类型',
      referenceValue: getComplaintTypeLabel(complaint.complaintType),
      note: complaint.description,
      details: [
        `投诉对象：${getComplaintTargetRoleLabel(complaint.targetRole)}`,
        `当前状态：${getComplaintStatusLabel(complaint.status)}`,
      ],
    });
  }

  complaint.processLogs.forEach((log) => {
    items.push({
      id: log.id,
      occurredAt: log.createdAt,
      title: getComplaintActionLabel(log.actionType),
      statusLabel: getComplaintStatusLabel(complaint.status),
      statusType: getComplaintStatusType(complaint.status),
      dotClass: getComplaintAftersalesDotClass(complaint.status),
      referenceLabel: '投诉类型',
      referenceValue: getComplaintTypeLabel(complaint.complaintType),
      note: log.note ?? (log.actionType === 'OPEN' ? complaint.description : null),
      details: [
        `投诉对象：${getComplaintTargetRoleLabel(complaint.targetRole)}`,
        `处理人：${log.operatorNickname || complaint.assignedAdminNickname || '平台处理中'}`,
        `当前状态：${getComplaintStatusLabel(complaint.status)}`,
        complaint.resultSummary && log.actionType === 'CLOSE' ? `处理结论：${complaint.resultSummary}` : null,
      ].filter((detail): detail is string => Boolean(detail)),
    });
  });

  return items;
};

const aftersalesTimeline = computed<AftersalesTimelineItem[]>(() => {
  const refundItems = order.value
    ? order.value.refunds.flatMap((refund) => buildRefundAftersalesItems(refund))
    : [];
  const complaintItems = complaints.value.flatMap((complaint) => buildComplaintAftersalesItems(complaint));

  return [...refundItems, ...complaintItems].sort((left, right) => (
    new Date(left.occurredAt).getTime() - new Date(right.occurredAt).getTime()
  ));
});

const getTimelineDetails = (event: OrderTimelineRecord) => {
  const details: string[] = [];
  const previousStatus = getRecordString(event.eventPayload, 'previousStatus');
  const nextStatus = getRecordString(event.eventPayload, 'nextStatus');
  const note = getRecordString(event.eventPayload, 'note');
  const happenedAt = getRecordString(event.eventPayload, 'happenedAt');
  const mediaCount = getRecordNumber(event.eventPayload, 'mediaCount');
  const geoText = formatGeoValue(event.eventPayload?.geo);
  const complaintType = getRecordString(event.eventPayload, 'complaintType');
  const targetRole = getRecordString(event.eventPayload, 'targetRole');

  if (previousStatus && nextStatus) {
    details.push(`状态流转：${getOrderStatusLabel(previousStatus as OrderStatus)} -> ${getOrderStatusLabel(nextStatus as OrderStatus)}`);
  }
  if (complaintType) {
    details.push(`投诉类型：${getComplaintTypeLabel(complaintType as ComplaintType)}`);
  }
  if (targetRole) {
    details.push(`投诉对象：${getComplaintTargetRoleLabel(targetRole as ComplaintTargetRole)}`);
  }
  if (note) {
    details.push(`备注：${note}`);
  }
  if (happenedAt) {
    details.push(`业务时间：${formatDateTime(happenedAt)}`);
  }
  if (mediaCount !== null) {
    details.push(`附带媒体：${mediaCount} 个`);
  }
  if (geoText) {
    details.push(`定位坐标：${geoText}`);
  }

  return details;
};

const getServiceLogDetails = (log: ServiceLogRecord) => {
  const details: string[] = [];
  const geoText = formatGeoValue(log.geo);
  if (geoText) {
    details.push(`定位坐标：${geoText}`);
  }
  if (log.createdAt !== log.happenedAt) {
    details.push(`上传时间：${formatDateTime(log.createdAt)}`);
  }
  return details;
};

const isPreviewableImage = (url: string) => /\.(apng|avif|bmp|gif|jpe?g|png|svg|webp)$/i.test(
  url.split(/[?#]/)[0] ?? '',
);

const getMediaLinkLabel = (url: string, index: number) => {
  const pathSegment = url.split(/[?#]/)[0]?.split('/').pop();
  if (!pathSegment) {
    return `附件 ${index + 1}`;
  }

  try {
    return decodeURIComponent(pathSegment);
  } catch {
    return pathSegment;
  }
};

const buildConversationSummary = (
  conversation: Pick<
    OrderConversationDetailRecord,
    'id' | 'orderId' | 'ownerUnreadCount' | 'caregiverUnreadCount' | 'lastMessageAt' | 'lastMessagePreview' | 'createdAt' | 'updatedAt'
  >,
) => ({
  id: conversation.id,
  orderId: conversation.orderId,
  ownerUnreadCount: conversation.ownerUnreadCount,
  caregiverUnreadCount: conversation.caregiverUnreadCount,
  lastMessageAt: conversation.lastMessageAt,
  lastMessagePreview: conversation.lastMessagePreview,
  createdAt: conversation.createdAt,
  updatedAt: conversation.updatedAt,
});

const applyConversationSummary = (summary: OrderDetailRecord['conversation']) => {
  if (order.value) {
    order.value.conversation = summary ? { ...summary } : null;
  }

  if (messageConversation.value && summary) {
    messageConversation.value.ownerUnreadCount = summary.ownerUnreadCount;
    messageConversation.value.caregiverUnreadCount = summary.caregiverUnreadCount;
    messageConversation.value.lastMessageAt = summary.lastMessageAt;
    messageConversation.value.lastMessagePreview = summary.lastMessagePreview;
    messageConversation.value.updatedAt = summary.updatedAt;
  }
};

const applyConversationDetail = (conversation: OrderConversationDetailRecord | null) => {
  messageConversation.value = conversation
    ? {
        ...conversation,
        messages: [...conversation.messages],
      }
    : null;
  applyConversationSummary(conversation ? buildConversationSummary(conversation) : null);
};

const getCurrentConversationUnreadCount = (conversation: OrderConversationDetailRecord | null) => {
  if (!conversation) {
    return 0;
  }

  return isOwnerView.value ? conversation.ownerUnreadCount : conversation.caregiverUnreadCount;
};

const getConversationSenderLabel = (message: OrderMessageRecord) =>
  message.senderRole === 'OWNER' ? '宠物主人' : '照料者';

const isOwnMessage = (message: OrderMessageRecord) => Boolean(auth.user?.id && message.senderUserId === auth.user.id);

const resetMessageComposer = () => {
  messageForm.content = '';
  messageForm.files = [];
  messageUploadProgress.value = null;
  if (messageFileInput.value) {
    messageFileInput.value.value = '';
  }
};

const openMessageFilePicker = () => {
  messageFileInput.value?.click();
};

const onMessageFilesChange = (event: Event) => {
  const input = event.target as HTMLInputElement;
  messageForm.files = Array.from(input.files ?? []);
};

const removeMessageFile = (index: number) => {
  messageForm.files.splice(index, 1);
  if (messageFileInput.value) {
    messageFileInput.value.value = '';
  }
};

const uploadMessageFiles = async (currentOrderId: string) => {
  if (messageForm.files.length === 0) {
    messageUploadProgress.value = null;
    return [];
  }

  const totalBytes = messageForm.files.reduce((sum, file) => sum + file.size, 0);
  const uploadedUrls: string[] = [];
  let completedBytes = 0;

  for (const file of messageForm.files) {
    const uploaded = await uploadAttachmentFile(
      file,
      {
        tag1: 'petpal-order-message',
        tag2: currentOrderId,
      },
      (progress) => {
        const currentBytes = Math.round((file.size * progress) / 100);
        messageUploadProgress.value = Math.min(
          99,
          Math.round(((completedBytes + currentBytes) / Math.max(totalBytes, 1)) * 100),
        );
      },
    );
    uploadedUrls.push(uploaded.url);
    completedBytes += file.size;
    messageUploadProgress.value = Math.min(
      99,
      Math.round((completedBytes / Math.max(totalBytes, 1)) * 100),
    );
  }

  messageUploadProgress.value = 100;
  return uploadedUrls;
};

const markConversationAsRead = async () => {
  if (!order.value || !messageConversation.value || getCurrentConversationUnreadCount(messageConversation.value) === 0) {
    return;
  }

  try {
    const summary = await api.petpal.orders.markMessagesRead(order.value.id);
    applyConversationSummary(summary);
  } catch (error) {
    ElMessage.error(getErrorMessage(error, '更新消息已读状态失败'));
  }
};

const submitMessage = async () => {
  if (!order.value) {
    return;
  }

  const content = messageForm.content.trim();
  if (!content && messageForm.files.length === 0) {
    ElMessage.error('请先填写消息内容或选择附件');
    return;
  }

  messageSubmitting.value = true;
  try {
    const mediaUrls = await uploadMessageFiles(order.value.id);
    const payload: CreateOrderMessagePayload = {
      content: content || undefined,
      mediaUrls: mediaUrls.length > 0 ? mediaUrls : undefined,
    };
    const conversation = await api.petpal.orders.sendMessage(order.value.id, payload);
    applyConversationDetail(conversation);
    resetMessageComposer();
    ElMessage.success('消息已发送');
  } catch (error) {
    ElMessage.error(getErrorMessage(error, '发送消息失败'));
  } finally {
    messageSubmitting.value = false;
    messageUploadProgress.value = null;
  }
};

const resetReviewDialog = () => {
  Object.assign(reviewForm, createEmptyReviewForm());
};

const openReviewDialog = () => {
  resetReviewDialog();
  reviewDialogVisible.value = true;
};

const resetComplaintDialog = () => {
  Object.assign(complaintForm, createEmptyComplaintForm());
};

const openComplaintDialog = () => {
  resetComplaintDialog();
  complaintDialogVisible.value = true;
};

const submitReview = async () => {
  if (!order.value) {
    return;
  }

  if (!reviewForm.rating) {
    ElMessage.error('请先选择评分');
    return;
  }

  reviewSubmitting.value = true;
  try {
    const payload: CreateOrderReviewPayload = {
      rating: reviewForm.rating,
      tags: reviewForm.tags,
      content: reviewForm.content.trim() || undefined,
      isAnonymous: reviewForm.isAnonymous,
    };
    const detail = await api.petpal.orders.review(order.value.id, payload);
    order.value = detail;
    orderNo.value = detail.orderNo;
    reviewDialogVisible.value = false;
    ElMessage.success('评价已提交');
  } catch (error) {
    ElMessage.error(getErrorMessage(error, '提交评价失败'));
  } finally {
    reviewSubmitting.value = false;
  }
};

const submitComplaint = async () => {
  if (!order.value) {
    return;
  }

  const description = complaintForm.description.trim();
  if (description.length < 5) {
    ElMessage.error('请填写至少 5 个字的投诉说明');
    return;
  }

  complaintSubmitting.value = true;
  try {
    const payload: CreateComplaintPayload = {
      targetRole: complaintForm.targetRole,
      complaintType: complaintForm.complaintType,
      description,
      evidenceUrls: complaintForm.evidenceUrls
        .map((item) => item.trim())
        .filter(Boolean),
    };
    await api.petpal.orders.createComplaint(order.value.id, payload);
    complaintDialogVisible.value = false;
    await reload();
    ElMessage.success('投诉已提交');
  } catch (error) {
    ElMessage.error(getErrorMessage(error, '提交投诉失败'));
  } finally {
    complaintSubmitting.value = false;
  }
};

const buildOrderRefundExportRequest = () => api.petpal.orders.exportRefunds(orderId);

const reload = async () => {
  loading.value = true;
  try {
    const detail = await api.petpal.orders.detail(orderId);
    order.value = detail;
    orderNo.value = detail.orderNo;
    applyConversationSummary(detail.conversation);

    const messagesResult = await Promise.allSettled([
      api.petpal.orders.messages(orderId),
    ]);

    if (messagesResult[0].status === 'fulfilled') {
      applyConversationDetail(messagesResult[0].value);
    } else {
      applyConversationDetail(null);
      ElMessage.error(getErrorMessage(messagesResult[0].reason, '加载订单消息失败'));
    }

    if (auth.user?.id && detail.ownerId === auth.user.id) {
      const [complaintsResult, refundProgressResult] = await Promise.allSettled([
        api.petpal.orders.complaints(orderId),
        api.petpal.orders.refundProgress(orderId),
      ]);

      if (complaintsResult.status === 'fulfilled') {
        complaints.value = complaintsResult.value;
      } else {
        complaints.value = [];
        ElMessage.error(getErrorMessage(complaintsResult.reason, '加载投诉进度失败'));
      }

      if (refundProgressResult.status === 'fulfilled') {
        refundProgress.value = refundProgressResult.value;
      } else {
        refundProgress.value = null;
        ElMessage.error(getErrorMessage(refundProgressResult.reason, '加载退款进度失败'));
      }
    } else {
      complaints.value = [];
      refundProgress.value = null;
    }

    await markConversationAsRead();
  } catch (error) {
    ElMessage.error(getErrorMessage(error, '加载订单详情失败'));
  } finally {
    loading.value = false;
  }
};

const goBack = () => {
  router.back();
};

onMounted(() => {
  reload();
});
</script>

<style scoped>
.petpal-order-detail {
  max-width: 1200px;
  margin: 0 auto;
  display: grid;
  gap: 2rem;
}

.petpal-order-detail__content {
  display: grid;
  gap: 2rem;
}

.petpal-order-info,
.petpal-amounts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
}

.petpal-order-info__item {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.petpal-order-info__label {
  font-size: 0.875rem;
  color: #999;
  font-weight: 500;
}

.petpal-order-info__value {
  font-size: 1rem;
  color: #333;
}

.petpal-section-heading {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: center;
  flex-wrap: wrap;
}

.petpal-section-heading h3 {
  margin: 0;
}

.petpal-amount-item {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 1rem;
  background: #f9f9f9;
  border-radius: 4px;
}

.petpal-amount-item__label {
  font-size: 0.875rem;
  color: #999;
  font-weight: 500;
}

.petpal-amount-item__value {
  font-size: 1.3rem;
  font-weight: 600;
  color: #333;
}

.petpal-amount-item__value--paid {
  color: #52c41a;
}

.petpal-timeline {
  position: relative;
  padding: 1rem 0;
}

.petpal-timeline__item {
  display: flex;
  gap: 1rem;
  padding: 1rem;
  border-left: 2px solid #e4e4e4;
  margin-left: 10px;
  position: relative;
}

.petpal-timeline__dot {
  position: absolute;
  left: -8px;
  top: 18px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #e4e4e4;
  border: 2px solid #fff;
}

.petpal-timeline__dot.is-success {
  background: #52c41a;
}

.petpal-timeline__dot.is-pending {
  background: #1890ff;
}

.petpal-timeline__dot.is-error {
  background: #ff4d4f;
}

.petpal-timeline__dot.is-warning {
  background: #faad14;
}

.petpal-timeline__content {
  flex: 1;
  min-width: 0;
}

.petpal-timeline__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  margin-bottom: 0.5rem;
  flex-wrap: wrap;
}

.petpal-timeline__header h4 {
  margin: 0;
  font-size: 1rem;
  color: #333;
}

.petpal-timeline__label {
  display: flex;
}

.petpal-timeline__meta {
  display: flex;
  gap: 2rem;
  flex-wrap: wrap;
  margin-top: 0.5rem;
}

.petpal-timeline__meta-item {
  font-size: 0.875rem;
  color: #666;
}

.petpal-timeline__detail {
  margin-top: 0.5rem;
  font-size: 0.875rem;
  color: #555;
  line-height: 1.6;
}

.petpal-timeline__note {
  margin: 0.75rem 0 0;
  padding: 0.75rem 0.875rem;
  border-radius: 8px;
  background: #f6f8fb;
  color: #333;
  line-height: 1.6;
}

.petpal-service-log-media {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
  margin-top: 0.875rem;
}

.petpal-service-log-media__item {
  display: grid;
  gap: 8px;
  padding: 10px;
  border: 1px solid #e5ebf3;
  border-radius: 12px;
  background: #fff;
  color: inherit;
  text-decoration: none;
  transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
}

.petpal-service-log-media__item:hover {
  border-color: #91caff;
  box-shadow: 0 10px 24px rgba(24, 144, 255, 0.12);
  transform: translateY(-1px);
}

.petpal-service-log-media__item img,
.petpal-service-log-media__file {
  width: 100%;
  aspect-ratio: 4 / 3;
  border-radius: 10px;
}

.petpal-service-log-media__item img {
  object-fit: cover;
  background: #eef4fb;
}

.petpal-service-log-media__file {
  display: grid;
  place-items: center;
  padding: 12px;
  background: linear-gradient(135deg, #f6f8fb 0%, #edf4ff 100%);
  color: #2f4668;
  font-size: 0.875rem;
  text-align: center;
  word-break: break-word;
}

.petpal-service-log-media__meta {
  font-size: 0.75rem;
  color: #6b7280;
}

.petpal-hidden-file-input {
  display: none;
}

.petpal-message-panel__header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: flex-start;
  flex-wrap: wrap;
}

.petpal-message-panel__headline h3 {
  margin: 0;
  color: #333;
}

.petpal-message-panel__headline p {
  margin: 0.5rem 0 0;
  color: #666;
  line-height: 1.6;
}

.petpal-message-list {
  display: grid;
  gap: 0.875rem;
  margin-top: 1rem;
}

.petpal-message-card {
  display: grid;
  gap: 0.75rem;
  padding: 1rem;
  border-radius: 14px;
  border: 1px solid #e5ebf3;
  background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
}

.petpal-message-card.is-self {
  border-color: #bfd7ff;
  background: linear-gradient(180deg, #f4f8ff 0%, #eef5ff 100%);
}

.petpal-message-card__header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: flex-start;
  flex-wrap: wrap;
}

.petpal-message-card__header strong {
  display: block;
  color: #1f2937;
}

.petpal-message-card__header span {
  display: block;
  margin-top: 0.25rem;
  color: #6b7280;
  font-size: 0.8125rem;
}

.petpal-message-card__content {
  margin: 0;
  padding: 0.875rem 1rem;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.8);
  color: #334155;
  line-height: 1.7;
}

.petpal-message-composer {
  display: grid;
  gap: 0.875rem;
  margin-top: 1rem;
  padding: 1rem;
  border-radius: 14px;
  border: 1px solid #dbe7ff;
  background: linear-gradient(180deg, #ffffff 0%, #f7fbff 100%);
}

.petpal-message-composer__actions {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: center;
  flex-wrap: wrap;
}

.petpal-message-file-list {
  display: grid;
  gap: 0.75rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.petpal-message-file-item {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: flex-start;
  padding: 0.875rem 1rem;
  border-radius: 12px;
  background: #fff;
  border: 1px solid #e5ebf3;
}

.petpal-message-file-item div {
  display: grid;
  gap: 0.25rem;
}

.petpal-message-file-item span {
  color: #6b7280;
  font-size: 0.8125rem;
}

.petpal-review-card__header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: flex-start;
  flex-wrap: wrap;
}

.petpal-review-card__headline h3 {
  margin: 0;
  color: #333;
}

.petpal-review-card__headline p {
  margin: 0.5rem 0 0;
  color: #666;
  line-height: 1.6;
}

.petpal-review-card__body {
  display: grid;
  gap: 1rem;
  margin-top: 1rem;
}

.petpal-review-card__meta {
  display: flex;
  gap: 1rem;
  align-items: center;
  flex-wrap: wrap;
  color: #666;
  font-size: 0.875rem;
}

.petpal-review-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.petpal-review-card__content {
  margin: 0;
  padding: 0.875rem 1rem;
  border-radius: 10px;
  background: #f6f8fb;
  color: #333;
  line-height: 1.7;
}

.petpal-review-card__empty-text {
  padding: 0.875rem 1rem;
  border-radius: 10px;
  background: #fafafa;
  color: #666;
}

.petpal-refund-progress__header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: flex-start;
  flex-wrap: wrap;
}

.petpal-refund-progress__headline h3 {
  margin: 0;
  color: #333;
}

.petpal-refund-progress__headline p {
  margin: 0.5rem 0 0;
  color: #666;
  line-height: 1.6;
}

.petpal-refund-progress__stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 0.875rem;
  margin-top: 1rem;
}

.petpal-refund-progress__stat {
  display: grid;
  gap: 0.375rem;
  padding: 0.875rem 1rem;
  border: 1px solid #e6eef8;
  border-radius: 12px;
  background: linear-gradient(180deg, #fff 0%, #f8fbff 100%);
}

.petpal-refund-progress__stat span {
  font-size: 0.875rem;
  color: #667085;
}

.petpal-refund-progress__stat strong {
  font-size: 1.1rem;
  color: #1f2937;
}

.petpal-refund-progress__latest {
  display: grid;
  gap: 0.75rem;
  margin-top: 1rem;
  padding: 1rem;
  border-radius: 14px;
  background: #f7faff;
  border: 1px solid #dbeafe;
}

.petpal-refund-progress__latest-header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: flex-start;
  flex-wrap: wrap;
}

.petpal-refund-progress__latest-header h4 {
  margin: 0;
  color: #1f2937;
}

.petpal-refund-progress__latest-meta {
  display: flex;
  gap: 0.875rem;
  flex-wrap: wrap;
  color: #475467;
  font-size: 0.875rem;
}

.petpal-refund-progress__reason {
  margin: 0;
  color: #334155;
  line-height: 1.7;
}

.petpal-complaint-panel__header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: flex-start;
  flex-wrap: wrap;
}

.petpal-complaint-panel__headline h3 {
  margin: 0;
  color: #333;
}

.petpal-complaint-panel__headline p {
  margin: 0.5rem 0 0;
  color: #666;
  line-height: 1.6;
}

.petpal-complaint-list {
  display: grid;
  gap: 1rem;
  margin-top: 1rem;
}

.petpal-complaint-card {
  display: grid;
  gap: 0.875rem;
  padding: 1rem;
  border: 1px solid #ebeef5;
  border-radius: 14px;
  background: linear-gradient(180deg, #fff 0%, #fbfcfe 100%);
}

.petpal-complaint-card__header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: flex-start;
  flex-wrap: wrap;
}

.petpal-complaint-card__header h4 {
  margin: 0;
  color: #333;
}

.petpal-complaint-card__header p {
  margin: 0.375rem 0 0;
  color: #666;
  font-size: 0.875rem;
}

.petpal-complaint-card__description,
.petpal-complaint-card__result {
  margin: 0;
  padding: 0.875rem 1rem;
  border-radius: 10px;
  background: #f7f8fb;
  color: #333;
  line-height: 1.7;
}

.petpal-complaint-progress {
  display: grid;
  gap: 0.75rem;
}

.petpal-complaint-progress__item {
  padding: 0.75rem 0.875rem;
  border-left: 3px solid #dbeafe;
  background: #f9fbff;
  border-radius: 0 10px 10px 0;
}

.petpal-complaint-progress__item strong {
  display: block;
  color: #1f2937;
}

.petpal-complaint-progress__item span {
  display: block;
  margin-top: 0.25rem;
  font-size: 0.8125rem;
  color: #6b7280;
}

.petpal-complaint-progress__item p {
  margin: 0.5rem 0 0;
  color: #4b5563;
  line-height: 1.6;
}

.petpal-dialog-hint {
  margin-top: 0.5rem;
  color: #6b7280;
  font-size: 0.8125rem;
  line-height: 1.5;
}

.petpal-empty {
  padding: 2rem;
  text-align: center;
  color: #999;
}
</style>
