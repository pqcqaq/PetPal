<!--
UX Blueprint
User: 主人已经决定新增或编辑宠物，只想专注填写档案
Entry: 宠物清单页、新建需求前置建档
First screen: 当前是新增还是编辑、档案会影响哪条主流程
Primary action: 保存宠物档案
Secondary actions: 返回宠物清单
States: 未登录、加载中、找不到宠物、可编辑
-->
<template>
  <div class="frontend-page">
    <PetPalWorkspaceHero
      eyebrow="主人工作区"
      :title="heroTitle"
      summary="表单页只负责填写宠物资料，不再承担宠物切换、需求队列和订单摘要。"
      :nav-items="petPalOwnerWorkspaceNav"
      active-name="frontend-petpal-pets"
      :stats="heroStats"
      :primary-action="null"
      :actions="heroActions"
    />

    <template v-if="auth.isAuthenticated">
      <section v-if="pageState === 'missing'" class="frontend-card">
        <PetPalStatePanel
          eyebrow="宠物表单"
          title="没有找到要编辑的宠物"
          description="这只宠物可能已不可用，请返回宠物清单重新选择。"
          tone="warning"
        >
          <template #actions>
            <RouterLink :to="{ name: 'frontend-petpal-pets' }">
              <el-button size="small" type="primary">返回宠物清单</el-button>
            </RouterLink>
          </template>
        </PetPalStatePanel>
      </section>

      <section v-else class="frontend-page__section-grid">
        <article class="frontend-card petpal-grid-span-8">
          <span class="frontend-card__eyebrow">宠物表单</span>
          <el-form :model="petForm" label-position="top" size="small" class="petpal-form-grid">
            <div class="petpal-form-grid__row">
              <el-form-item label="宠物名">
                <el-input v-model="petForm.name" placeholder="例如：可乐" />
              </el-form-item>
              <el-form-item label="品种">
                <el-input v-model="petForm.breed" placeholder="例如：柴犬 / 英短" />
              </el-form-item>
            </div>

            <div class="petpal-form-grid__row">
              <el-form-item label="物种">
                <el-select v-model="petForm.species" style="width: 100%">
                  <el-option label="犬" value="DOG" />
                  <el-option label="猫" value="CAT" />
                  <el-option label="其他" value="OTHER" />
                </el-select>
              </el-form-item>
              <el-form-item label="性别">
                <el-select v-model="petForm.gender" style="width: 100%">
                  <el-option label="公" value="MALE" />
                  <el-option label="母" value="FEMALE" />
                  <el-option label="未知" value="UNKNOWN" />
                </el-select>
              </el-form-item>
            </div>

            <div class="petpal-form-grid__row">
              <el-form-item label="生日">
                <el-date-picker
                  v-model="petForm.birthday"
                  type="date"
                  value-format="YYYY-MM-DD"
                  placeholder="可选"
                  style="width: 100%"
                />
              </el-form-item>
              <el-form-item label="体重(kg)">
                <el-input-number v-model="petForm.weightKg" :min="0.1" :max="120" :precision="1" style="width: 100%" />
              </el-form-item>
            </div>

            <el-form-item label="性格标签">
              <el-input v-model="tagText" placeholder="例如：亲人，活泼，胆小" />
            </el-form-item>

            <div class="petpal-form-grid__row">
              <el-form-item label="喂养提醒">
                <el-input v-model="petForm.feedingNote" type="textarea" :rows="3" placeholder="记录喂食频率和安抚方式" />
              </el-form-item>
              <el-form-item label="过敏提醒">
                <el-input v-model="petForm.allergyNote" type="textarea" :rows="3" placeholder="记录过敏源和禁忌" />
              </el-form-item>
            </div>

            <el-form-item label="健康观察">
              <el-input v-model="petForm.medicalNote" type="textarea" :rows="4" placeholder="记录疾病史、用药提醒和就医情况" />
            </el-form-item>

            <div class="petpal-form-grid__row">
              <el-form-item label="紧急联系人">
                <el-input v-model="petForm.emergencyContact.name" placeholder="联系人姓名" />
              </el-form-item>
              <el-form-item label="联系电话">
                <el-input v-model="petForm.emergencyContact.phone" placeholder="联系电话" />
              </el-form-item>
            </div>

            <el-form-item label="关系说明">
              <el-input v-model="petForm.emergencyContact.relation" placeholder="例如：家人 / 宠物医院" />
            </el-form-item>
          </el-form>
        </article>

        <aside class="frontend-card petpal-grid-span-4">
          <span class="frontend-card__eyebrow">提交前确认</span>
          <div class="petpal-side-stack">
            <div class="petpal-side-item">
              <strong>这页只做一件事</strong>
              <p>保存宠物档案，回到宠物清单后再决定是否发需求。</p>
            </div>
            <div class="petpal-side-item">
              <strong>建议先补齐</strong>
              <p>喂养提醒、过敏情况和紧急联系人，这三块最影响后续照料沟通。</p>
            </div>
            <div class="petpal-card-actions">
              <el-button type="primary" :loading="saving" @click="submitPet">
                {{ editingPetId ? '保存修改' : '创建宠物' }}
              </el-button>
              <RouterLink :to="{ name: 'frontend-petpal-pets' }">
                <el-button>返回清单</el-button>
              </RouterLink>
            </div>
          </div>
        </aside>
      </section>
    </template>

    <section v-else class="frontend-card">
      <PetPalStatePanel
        eyebrow="宠物表单"
        title="登录后继续编辑宠物档案"
        description="登录后再进入独立表单页新增或编辑宠物。"
      >
        <template #actions>
          <RouterLink to="/login">
            <el-button size="small" type="primary">去登录</el-button>
          </RouterLink>
        </template>
      </PetPalStatePanel>
    </section>
  </div>
</template>

<script setup lang="ts">
import type { PetGender, PetProfileRecord, PetSpecies } from '@rbac/api-common';
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElButton, ElMessage } from 'element-plus';
import { api } from '@/api/client';
import PetPalStatePanel from '@/pages/frontend/petpal/PetPalStatePanel.vue';
import PetPalWorkspaceHero from '@/pages/frontend/petpal/components/PetPalWorkspaceHero.vue';
import { useAuthStore } from '@/stores/auth';
import { getErrorMessage } from '@/utils/errors';
import { petPalOwnerWorkspaceNav } from './shared';

type PetFormModel = {
  name: string;
  species: PetSpecies;
  gender: PetGender;
  breed: string;
  birthday: string;
  weightKg: number;
  feedingNote: string;
  allergyNote: string;
  medicalNote: string;
  emergencyContact: {
    name: string;
    phone: string;
    relation: string;
  };
};

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();

const loading = ref(false);
const saving = ref(false);
const pageState = ref<'ready' | 'missing'>('ready');
const editingPetId = computed(() => typeof route.params.id === 'string' ? route.params.id : '');
const tagText = ref('');

const petForm = reactive<PetFormModel>({
  name: '',
  species: 'DOG',
  gender: 'UNKNOWN',
  breed: '',
  birthday: '',
  weightKg: 5,
  feedingNote: '',
  allergyNote: '',
  medicalNote: '',
  emergencyContact: {
    name: '',
    phone: '',
    relation: '',
  },
});

const heroTitle = computed(() => editingPetId.value ? `编辑 ${petForm.name || '宠物档案'}` : '新建宠物档案');
const heroStats = computed(() => [
  {
    label: '当前模式',
    value: editingPetId.value ? '编辑' : '新建',
    hint: '表单页只负责填写',
  },
  {
    label: '建议优先',
    value: '喂养 / 过敏 / 紧急',
    hint: '这三块最影响后续沟通',
  },
  {
    label: '完成后',
    value: '回清单',
    hint: '再决定是否发需求',
  },
  {
    label: '下一步',
    value: '保存档案',
    hint: '不会留在列表页里混合操作',
  },
]);

const heroActions = computed(() => [
  { label: '返回宠物清单', to: { name: 'frontend-petpal-pets' }, tone: 'secondary' as const },
]);

const splitTagText = (value: string) => [...new Set(
  value
    .split(/[\n,，、]/)
    .map((item) => item.trim())
    .filter(Boolean),
)];

const applyPet = (pet: PetProfileRecord) => {
  petForm.name = pet.name;
  petForm.species = pet.species;
  petForm.gender = pet.gender;
  petForm.breed = pet.breed || '';
  petForm.birthday = pet.birthday ? pet.birthday.slice(0, 10) : '';
  petForm.weightKg = Number(pet.weightKg ?? 5) || 5;
  petForm.feedingNote = pet.feedingNote || '';
  petForm.allergyNote = pet.allergyNote || '';
  petForm.medicalNote = pet.medicalNote || '';
  petForm.emergencyContact.name = pet.emergencyContact?.name || '';
  petForm.emergencyContact.phone = pet.emergencyContact?.phone || '';
  petForm.emergencyContact.relation = pet.emergencyContact?.relation || '';
  tagText.value = (pet.temperamentTags ?? []).join('，');
};

async function loadPet() {
  if (!auth.isAuthenticated || !editingPetId.value || loading.value) {
    return;
  }

  loading.value = true;
  pageState.value = 'ready';

  try {
    const pets = await api.petpal.pets.list();
    const pet = pets.find((item) => item.id === editingPetId.value) ?? null;
    if (!pet) {
      pageState.value = 'missing';
      return;
    }
    applyPet(pet);
  } catch (error: unknown) {
    pageState.value = 'missing';
    ElMessage.error(getErrorMessage(error, '加载宠物表单失败'));
  } finally {
    loading.value = false;
  }
}

async function submitPet() {
  if (!petForm.name.trim()) {
    ElMessage.warning('请先填写宠物名称');
    return;
  }

  saving.value = true;
  try {
    const payload = {
      name: petForm.name.trim(),
      species: petForm.species,
      gender: petForm.gender,
      breed: petForm.breed.trim() || undefined,
      birthday: petForm.birthday || undefined,
      weightKg: Number(petForm.weightKg || 0) || undefined,
      temperamentTags: splitTagText(tagText.value),
      feedingNote: petForm.feedingNote.trim() || undefined,
      allergyNote: petForm.allergyNote.trim() || undefined,
      medicalNote: petForm.medicalNote.trim() || undefined,
      emergencyContact: petForm.emergencyContact.name.trim() && petForm.emergencyContact.phone.trim()
        ? {
            name: petForm.emergencyContact.name.trim(),
            phone: petForm.emergencyContact.phone.trim(),
            relation: petForm.emergencyContact.relation.trim() || undefined,
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
    ElMessage.error(getErrorMessage(error, editingPetId.value ? '更新宠物失败' : '创建宠物失败'));
  } finally {
    saving.value = false;
  }
}

onMounted(() => {
  if (!auth.isAuthenticated || !editingPetId.value) {
    return;
  }
  void loadPet();
});
</script>

<style scoped lang="scss">
.petpal-grid-span-8 {
  grid-column: span 8;
}

.petpal-grid-span-4 {
  grid-column: span 4;
}

.petpal-form-grid,
.petpal-side-stack {
  display: grid;
  gap: 16px;
}

.petpal-form-grid__row,
.petpal-card-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.petpal-side-item {
  padding: 16px;
  border-radius: 18px;
  background: rgba(248, 252, 251, 0.86);
  border: 1px solid rgba(18, 53, 51, 0.08);
}

@media (max-width: 1080px) {
  .petpal-grid-span-8,
  .petpal-grid-span-4 {
    grid-column: span 12;
  }
}

@media (max-width: 720px) {
  .petpal-form-grid__row,
  .petpal-card-actions {
    grid-template-columns: 1fr;
  }
}
</style>
