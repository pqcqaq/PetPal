<template>
  <div v-if="items.length" class="petpal-export-filter-summary">
    <div class="petpal-export-filter-summary__head">
      <span class="petpal-export-filter-summary__label">{{ label }}</span>
      <el-button text size="small" @click="$emit('clear')">
        {{ clearText }}
      </el-button>
    </div>
    <div class="petpal-export-filter-summary__list">
      <el-tag
        v-for="item in items"
        :key="item.key"
        closable
        effect="plain"
        @close="$emit('remove', item.key)"
      >
        {{ item.label }}：{{ item.value }}
      </el-tag>
    </div>
  </div>
  <p v-else-if="emptyText" class="petpal-export-filter-summary__empty">
    {{ emptyText }}
  </p>
</template>

<script setup lang="ts">
import type { PropType } from 'vue';
import type { PetPalExportSummaryItem } from '../export-filter-summary';

defineProps({
  items: {
    type: Array as PropType<PetPalExportSummaryItem[]>,
    default: () => [],
  },
  label: {
    type: String,
    default: '当前导出条件',
  },
  clearText: {
    type: String,
    default: '清空全部',
  },
  emptyText: {
    type: String,
    default: '',
  },
});

defineEmits<{
  remove: [key: string];
  clear: [];
}>();
</script>

<style scoped lang="scss">
.petpal-export-filter-summary {
  display: grid;
  gap: 10px;
}

.petpal-export-filter-summary__head {
  display: flex;
  gap: 12px;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
}

.petpal-export-filter-summary__label {
  color: #6b625a;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.petpal-export-filter-summary__list {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.petpal-export-filter-summary__empty {
  margin: 0;
  color: #6b625a;
  font-size: 13px;
  line-height: 1.6;
}
</style>
