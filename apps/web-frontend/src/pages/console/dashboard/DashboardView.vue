<template>
  <PageScaffold>
    <template #actions>
      <el-button @click="loadSummary">刷新总览</el-button>
    </template>

    <div class="dashboard-digest" v-loading="loading">
      <SurfacePanel
        caption="治理摘要"
        title="先看今天真正要处理的概况"
        description="总览页不再拆成四五块并列卡片，而是按阅读顺序提供一份连续摘要。"
      >
        <div v-if="summary.metrics.length" class="dashboard-digest__list">
          <div v-for="metric in summary.metrics" :key="metric.label" class="dashboard-digest__metric-row">
            <div class="dashboard-digest__metric-copy">
              <span>{{ metric.label }}</span>
              <strong>{{ metric.value }}</strong>
            </div>
          </div>
        </div>
        <el-empty v-else description="暂无概况数据" />
      </SurfacePanel>

      <SurfacePanel
        caption="访问结构"
        title="角色分布与模块覆盖"
        description="这部分只回答后台当前有哪些角色和权限模块在被使用。"
      >
        <div class="dashboard-digest__section-block">
          <div class="dashboard-digest__subheader">
            <strong>角色分布</strong>
            <span>{{ summary.roleDistribution.length }} 个角色</span>
          </div>
          <div v-if="summary.roleDistribution.length" class="dashboard-digest__list">
            <div v-for="item in summary.roleDistribution" :key="item.roleName" class="dashboard-digest__bar-row">
              <div class="dashboard-digest__row-head">
                <strong>{{ item.roleName }}</strong>
                <span>{{ item.count }}</span>
              </div>
              <div class="dashboard-digest__bar-track">
                <span class="dashboard-digest__bar-fill" :style="{ width: resolveBarWidth(item.count) }" />
              </div>
            </div>
          </div>
          <el-empty v-else description="暂无角色数据" />
        </div>

        <div class="dashboard-digest__section-block">
          <div class="dashboard-digest__subheader">
            <strong>权限模块覆盖</strong>
            <span>{{ summary.moduleCoverage.length }} 个模块</span>
          </div>
          <div v-if="summary.moduleCoverage.length" class="dashboard-digest__list">
            <div v-for="item in summary.moduleCoverage" :key="item.module" class="dashboard-digest__metric-row">
              <div class="dashboard-digest__metric-copy">
                <span>{{ item.module }}</span>
                <strong>{{ item.count }} 项权限</strong>
              </div>
            </div>
          </div>
          <el-empty v-else description="暂无权限模块数据" />
        </div>
      </SurfacePanel>

      <SurfacePanel
        caption="新增用户"
        title="最近加入的账号"
        description="这里只保留最近进入系统的新账号，不再和审计流混排。"
      >
        <div v-if="summary.latestUsers.length" class="dashboard-digest__list">
          <div v-for="user in summary.latestUsers" :key="user.id" class="dashboard-digest__user-row">
            <div class="dashboard-digest__user-main">
              <div class="dashboard-digest__user-avatar">
                <UserAvatar :avatar-url="user.avatarUrl" :name="user.nickname" size="sm" />
              </div>
              <div class="dashboard-digest__user-copy">
                <strong>{{ user.nickname }}</strong>
                <span>{{ user.email || '未设置邮箱' }}</span>
              </div>
            </div>
            <div class="dashboard-digest__role-row">
              <span v-for="role in user.roles" :key="role.id" class="dashboard-digest__role-pill">{{ role.name }}</span>
            </div>
          </div>
        </div>
        <el-empty v-else description="暂无用户数据" />
      </SurfacePanel>

      <SurfacePanel
        caption="最近审计"
        title="最后发生的操作"
        description="按时间顺序浏览操作记录，避免和其它摘要块交叉打断。"
      >
        <div v-if="summary.auditFeed.length" class="dashboard-digest__list">
          <div v-for="log in summary.auditFeed" :key="log.id" class="dashboard-digest__audit-row">
            <div class="dashboard-digest__audit-copy">
              <strong>{{ log.summary }}</strong>
              <span>{{ log.actor }} · {{ log.operationCount }} 次数据库操作</span>
            </div>
            <small>{{ formatTime(log.createdAt) }} · {{ log.statusCode }}</small>
          </div>
        </div>
        <el-empty v-else description="暂无审计数据" />
      </SurfacePanel>
    </div>
  </PageScaffold>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import type { DashboardSummary } from '@rbac/api-common';
import UserAvatar from '@/components/common/UserAvatar.vue';
import PageScaffold from '@/components/workbench/PageScaffold.vue';
import SurfacePanel from '@/components/workbench/SurfacePanel.vue';
import { api } from '@/api/client';

defineOptions({ name: 'DashboardView' });

definePage({
  viewKey: 'dashboard',
  keepAlive: true,
});

const summary = reactive<DashboardSummary>({
  metrics: [],
  roleDistribution: [],
  moduleCoverage: [],
  latestUsers: [],
  auditFeed: [],
});
const loading = ref(false);

const formatTime = (value: string) => new Date(value).toLocaleString();
const maxRoleCount = computed(() => Math.max(...summary.roleDistribution.map((item) => item.count), 1));
const resolveBarWidth = (value: number) => `${Math.max((value / maxRoleCount.value) * 100, 8)}%`;

const loadSummary = async () => {
  loading.value = true;
  try {
    Object.assign(summary, await api.dashboard.summary());
  } finally {
    loading.value = false;
  }
};

onMounted(loadSummary);
</script>

<style scoped lang="scss">
.dashboard-digest {
  display: grid;
  gap: 18px;
}

.dashboard-digest__section-block {
  display: grid;
  gap: 14px;
}

.dashboard-digest__section-block + .dashboard-digest__section-block {
  padding-top: 6px;
  border-top: 1px solid var(--line-soft);
}

.dashboard-digest__subheader,
.dashboard-digest__metric-copy,
.dashboard-digest__audit-copy,
.dashboard-digest__user-copy {
  display: grid;
  gap: 6px;
}

.dashboard-digest__subheader strong,
.dashboard-digest__metric-copy strong,
.dashboard-digest__audit-copy strong,
.dashboard-digest__user-copy strong,
.dashboard-digest__row-head strong {
  color: var(--ink-1);
}

.dashboard-digest__subheader span,
.dashboard-digest__metric-copy span,
.dashboard-digest__audit-copy span,
.dashboard-digest__user-copy span,
.dashboard-digest__row-head span,
.dashboard-digest__audit-row small {
  color: var(--ink-3);
  line-height: 1.7;
}

.dashboard-digest__list {
  display: grid;
  gap: 14px;
}

.dashboard-digest__metric-row,
.dashboard-digest__bar-row,
.dashboard-digest__user-row,
.dashboard-digest__audit-row {
  display: grid;
  gap: 12px;
  padding-top: 14px;
  border-top: 1px solid var(--line-soft);
}

.dashboard-digest__metric-row:first-child,
.dashboard-digest__bar-row:first-child,
.dashboard-digest__user-row:first-child,
.dashboard-digest__audit-row:first-child {
  padding-top: 0;
  border-top: 0;
}

.dashboard-digest__metric-copy strong {
  font-size: 28px;
  line-height: 1.05;
}

.dashboard-digest__row-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.dashboard-digest__bar-track {
  width: 100%;
  height: 8px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--surface-card-soft-bg);
}

.dashboard-digest__bar-fill {
  display: block;
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, var(--accent-strong), color-mix(in srgb, var(--accent-strong) 72%, white));
}

.dashboard-digest__user-row {
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
}

.dashboard-digest__user-main {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.dashboard-digest__user-avatar {
  flex: none;
}

.dashboard-digest__user-copy {
  min-width: 0;
}

.dashboard-digest__role-row {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.dashboard-digest__role-pill {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  background: var(--surface-card-soft-bg);
  color: var(--ink-2);
  font-size: 12px;
  font-weight: 700;
}

.dashboard-digest__audit-row {
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: start;
}

@media (max-width: 900px) {
  .dashboard-digest__user-row,
  .dashboard-digest__audit-row {
    grid-template-columns: 1fr;
  }

  .dashboard-digest__role-row {
    justify-content: flex-start;
  }
}
</style>
