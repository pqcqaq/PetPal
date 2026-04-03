<template>
  <el-form :model="filters" class="search-form" @submit.prevent="onApply">
    <el-row :gutter="16">
      <el-col :xs="24" :sm="12" :md="6">
        <el-form-item label="回调类型">
          <el-select
            v-model="filters.callbackType"
            clearable
            placeholder="选择回调类型"
          >
            <el-option
              v-for="item in callbackAuditTypeOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
      </el-col>

      <el-col :xs="24" :sm="12" :md="6">
        <el-form-item label="回调状态">
          <el-select
            v-model="filters.callbackStatus"
            clearable
            placeholder="选择回调状态"
          >
            <el-option
              v-for="item in callbackAuditStatusOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
      </el-col>

      <el-col :xs="24" :sm="12" :md="6">
        <el-form-item label="验证来源">
          <el-select
            v-model="filters.sourceMode"
            clearable
            placeholder="选择验证来源"
          >
            <el-option
              v-for="item in callbackAuditSourceModeOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
      </el-col>

      <el-col :xs="24" :sm="12" :md="6">
        <el-form-item label="RequestId">
          <el-input
            v-model="filters.requestId"
            clearable
            placeholder="搜索 RequestId"
          />
        </el-form-item>
      </el-col>

      <el-col :xs="24" :sm="12" :md="6">
        <el-form-item label="开始时间">
          <el-date-picker
            v-model="filters.startDate"
            type="datetime"
            placeholder="选择开始时间"
            format="YYYY-MM-DD HH:mm:ss"
            value-format="YYYY-MM-DD HH:mm:ss"
            clearable
          />
        </el-form-item>
      </el-col>

      <el-col :xs="24" :sm="12" :md="6">
        <el-form-item label="结束时间">
          <el-date-picker
            v-model="filters.endDate"
            type="datetime"
            placeholder="选择结束时间"
            format="YYYY-MM-DD HH:mm:ss"
            value-format="YYYY-MM-DD HH:mm:ss"
            clearable
          />
        </el-form-item>
      </el-col>

      <el-col :xs="24">
        <el-form-item>
          <el-space>
            <el-button type="primary" @click="onApply">查询</el-button>
            <el-button @click="onReset">重置</el-button>
          </el-space>
        </el-form-item>
      </el-col>
    </el-row>
  </el-form>
</template>

<script setup lang="ts">
import {
  callbackAuditSourceModeOptions,
  callbackAuditStatusOptions,
  callbackAuditTypeOptions,
  type CallbackAuditFilters,
} from '../callback-audit-display';

defineProps<{
  filters: CallbackAuditFilters;
  loading?: boolean;
}>();

const emits = defineEmits<{
  apply: [];
  reset: [];
}>();

const onApply = () => {
  emits('apply');
};

const onReset = () => {
  emits('reset');
};
</script>

<style scoped>
.search-form {
  padding: 12px 0;
}
</style>
