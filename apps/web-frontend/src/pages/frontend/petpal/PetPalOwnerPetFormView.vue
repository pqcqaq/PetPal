<template>
  <PetPalDeskPage
    eyebrow="宠物表单"
    :title="isEditing ? '更新宠物档案' : '新建宠物档案'"
    summary="表单页只负责编辑宠物资料，不再混入需求和订单动作。"
    :nav-items="petPalOwnerWorkspaceNav"
    active-name="frontend-petpal-pets"
    :actions="[{ label: '返回宠物清单', to: { name: 'frontend-petpal-pets' }, tone: 'secondary' }]"
    :stats="heroStats"
  >
    <PetPalDeskSection eyebrow="Form" :title="isEditing ? '编辑资料' : '填写资料'" description="姓名、护理说明和紧急联系人优先填写。">
      <el-form label-position="top" class="petpal-field-grid">
        <el-form-item label="宠物名字">
          <el-input v-model="form.name" maxlength="20" placeholder="例如：团子" />
        </el-form-item>
        <el-form-item label="宠物类型">
          <el-select v-model="form.species" style="width: 100%">
            <el-option v-for="item in petPalSpeciesOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="品种">
          <el-input v-model="form.breed" maxlength="40" placeholder="例如：布偶 / 柯基" />
        </el-form-item>
        <el-form-item label="性别">
          <el-select v-model="form.gender" style="width: 100%">
            <el-option v-for="item in genderOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="生日">
          <el-date-picker v-model="form.birthday" type="date" value-format="YYYY-MM-DD" style="width: 100%" placeholder="选填" />
        </el-form-item>
        <el-form-item label="体重 (kg)">
          <el-input-number v-model="form.weightKg" :min="0" :max="200" :precision="1" style="width: 100%" />
        </el-form-item>
        <el-form-item label="性格标签" class="petpal-span-12">
          <el-input v-model="form.temperamentText" placeholder="用逗号分隔，例如：怕生，护食，亲人" />
        </el-form-item>
        <el-form-item label="喂养说明" class="petpal-span-12">
          <el-input v-model="form.feedingNote" type="textarea" :rows="3" maxlength="200" show-word-limit placeholder="例如：每天两顿，饭后喂药" />
        </el-form-item>
        <el-form-item label="过敏说明" class="petpal-span-12">
          <el-input v-model="form.allergyNote" type="textarea" :rows="3" maxlength="200" show-word-limit placeholder="例如：对鸡肉过敏" />
        </el-form-item>
        <el-form-item label="医疗说明" class="petpal-span-12">
          <el-input v-model="form.medicalNote" type="textarea" :rows="3" maxlength="200" show-word-limit placeholder="例如：近期刚打疫苗" />
        </el-form-item>
        <el-form-item label="已绝育">
          <el-switch v-model="form.neutered" />
        </el-form-item>
      </el-form>
    </PetPalDeskSection>

    <PetPalDeskSection eyebrow="Emergency" title="紧急联系人" description="建议填写真实可联络电话。">
      <div class="petpal-field-grid">
        <el-form-item label="联系人姓名">
          <el-input v-model="form.emergencyName" maxlength="20" placeholder="例如：王女士" />
        </el-form-item>
        <el-form-item label="联系电话">
          <el-input v-model="form.emergencyPhone" maxlength="20" placeholder="例如：13800000000" />
        </el-form-item>
        <el-form-item label="关系">
          <el-input v-model="form.emergencyRelation" maxlength="20" placeholder="例如：家人 / 室友" />
        </el-form-item>
      </div>
      <div class="petpal-actions">
        <el-button type="primary" :loading="submitting" @click="submit">{{ isEditing ? '保存更新' : '创建档案' }}</el-button>
      </div>
    </PetPalDeskSection>
  </PetPalDeskPage>
</template>

<script setup lang="ts">
import type { PetGender, PetProfileRecord } from '@rbac/api-common';
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { api } from '@/api/client';
import { getErrorMessage } from '@/utils/errors';
import PetPalDeskPage from './rebuild/petpal-desk-page.vue';
import PetPalDeskSection from './rebuild/petpal-desk-section.vue';
import { normalizePetPalTagText, petPalOwnerWorkspaceNav, petPalSpeciesOptions } from './shared';

const route = useRoute();
const router = useRouter();

const editingPetId = computed(() => typeof route.params.id === 'string' ? route.params.id : '');
const isEditing = computed(() => Boolean(editingPetId.value));
const submitting = ref(false);

const form = reactive({
  name: '',
  species: 'DOG' as typeof petPalSpeciesOptions[number]['value'],
  breed: '',
  gender: 'UNKNOWN' as PetGender,
  birthday: '',
  weightKg: 0,
  neutered: false,
  temperamentText: '',
  feedingNote: '',
  allergyNote: '',
  medicalNote: '',
  emergencyName: '',
  emergencyPhone: '',
  emergencyRelation: '',
});

const genderOptions: Array<{ label: string; value: PetGender }> = [
  { label: '雄性', value: 'MALE' },
  { label: '雌性', value: 'FEMALE' },
  { label: '未知', value: 'UNKNOWN' },
];

const heroStats = computed(() => [
  { label: '当前模式', value: isEditing.value ? '编辑' : '新建', hint: '表单页只处理一只宠物' },
  { label: '宠物类型', value: form.species, hint: '后续会影响需求匹配' },
  { label: '绝育状态', value: form.neutered ? '已绝育' : '未绝育', hint: '如实填写即可' },
  { label: '紧急联系人', value: form.emergencyPhone || '待填写', hint: '建议保留真实电话' },
]);

function applyPet(pet: PetProfileRecord) {
  form.name = pet.name;
  form.species = pet.species;
  form.breed = pet.breed || '';
  form.gender = pet.gender;
  form.birthday = pet.birthday || '';
  form.weightKg = Number(pet.weightKg || 0);
  form.neutered = pet.neutered;
  form.temperamentText = pet.temperamentTags.join('，');
  form.feedingNote = pet.feedingNote || '';
  form.allergyNote = pet.allergyNote || '';
  form.medicalNote = pet.medicalNote || '';
  form.emergencyName = pet.emergencyContact?.name || '';
  form.emergencyPhone = pet.emergencyContact?.phone || '';
  form.emergencyRelation = pet.emergencyContact?.relation || '';
}

async function loadPage() {
  if (!editingPetId.value) {
    return;
  }
  try {
    const pets = await api.petpal.pets.list();
    const target = pets.find((item) => item.id === editingPetId.value);
    if (!target) {
      ElMessage.warning('没有找到对应宠物档案');
      void router.replace({ name: 'frontend-petpal-pets' });
      return;
    }
    applyPet(target);
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '加载宠物档案失败'));
  }
}

async function submit() {
  if (!form.name.trim()) {
    ElMessage.warning('请先填写宠物名字');
    return;
  }

  submitting.value = true;
  try {
    const payload = {
      name: form.name.trim(),
      species: form.species,
      breed: form.breed.trim() || undefined,
      gender: form.gender,
      birthday: form.birthday || undefined,
      weightKg: form.weightKg > 0 ? Number(form.weightKg) : undefined,
      neutered: form.neutered,
      temperamentTags: normalizePetPalTagText(form.temperamentText),
      feedingNote: form.feedingNote.trim() || undefined,
      allergyNote: form.allergyNote.trim() || undefined,
      medicalNote: form.medicalNote.trim() || undefined,
      emergencyContact: form.emergencyName.trim() && form.emergencyPhone.trim()
        ? {
            name: form.emergencyName.trim(),
            phone: form.emergencyPhone.trim(),
            relation: form.emergencyRelation.trim() || undefined,
          }
        : undefined,
    };

    if (editingPetId.value) {
      await api.petpal.pets.update(editingPetId.value, payload);
      ElMessage.success('宠物档案已更新');
    } else {
      await api.petpal.pets.create(payload);
      ElMessage.success('宠物档案已创建');
    }

    await router.push({ name: 'frontend-petpal-pets' });
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '保存宠物档案失败'));
  } finally {
    submitting.value = false;
  }
}

onMounted(() => {
  void loadPage();
});
</script>
