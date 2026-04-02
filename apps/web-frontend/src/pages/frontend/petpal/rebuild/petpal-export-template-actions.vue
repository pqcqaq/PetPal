<template>
  <div class="petpal-export-template-actions">
    <span class="petpal-export-template-actions__label">{{ label }}</span>
    <el-select
      :model-value="modelValue"
      clearable
      :placeholder="placeholder"
      class="petpal-export-template-actions__select"
      @update:model-value="emit('update:modelValue', $event)"
    >
      <el-option
        v-for="item in templates"
        :key="item.name"
        :label="item.name"
        :value="item.name"
      />
    </el-select>
    <el-button :disabled="applyDisabled" @click="emit('apply')">
      {{ applyLabel }}
    </el-button>
    <el-button :disabled="saveDisabled" @click="emit('save')">
      {{ saveLabel }}
    </el-button>
    <el-button
      v-if="canRemove"
      text
      @click="emit('remove')"
    >
      {{ removeLabel }}
    </el-button>
  </div>
</template>

<script setup lang="ts">
type PetPalNamedTemplateOption = {
  name: string;
};

withDefaults(defineProps<{
  modelValue: string;
  templates: PetPalNamedTemplateOption[];
  placeholder?: string;
  label?: string;
  applyLabel?: string;
  saveLabel?: string;
  removeLabel?: string;
  applyDisabled?: boolean;
  saveDisabled?: boolean;
  canRemove?: boolean;
}>(), {
  placeholder: '选择常用导出模板',
  label: '常用模板',
  applyLabel: '应用模板',
  saveLabel: '保存为模板',
  removeLabel: '删除模板',
  applyDisabled: false,
  saveDisabled: false,
  canRemove: false,
});

const emit = defineEmits<{
  'update:modelValue': [value: string];
  apply: [];
  save: [];
  remove: [];
}>();
</script>

<style scoped lang="scss">
.petpal-export-template-actions {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
}

.petpal-export-template-actions__label {
  color: #6b625a;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.petpal-export-template-actions__select {
  width: 220px;
}

@media (max-width: 720px) {
  .petpal-export-template-actions {
    align-items: stretch;
  }

  .petpal-export-template-actions__select {
    width: 100%;
  }
}
</style>
