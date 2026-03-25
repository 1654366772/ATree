<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue';
import type { FormInstance, FormRules } from 'element-plus';
import type { VoiceActor } from '../../utils/db';

interface RoleForm {
  id: number;
  name: string;
  intro: string;
  dubber_id?: number;
  remote_path: string;
}

const props = defineProps<{
  visible: boolean;
  type: 'add' | 'edit';
  form: RoleForm;
  rules: FormRules;
  allDubbers: VoiceActor[];
}>();

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void;
  (e: 'save'): void;
}>();

const dialogVisible = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value),
});

const formRef = ref<FormInstance>();

const handleSave = async () => {
  if (!formRef.value) return;
  await formRef.value.validate((valid) => {
    if (!valid) return;
    emit('save');
  });
};

watch(
  () => props.visible,
  (val) => {
    if (val) {
      nextTick(() => {
        formRef.value?.clearValidate();
      });
    }
  },
);

</script>

<template>
  <el-dialog
    v-model="dialogVisible"
    :title="type === 'add' ? '新增角色' : '编辑角色'"
    width="500px"
    append-to-body
  >
    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-position="top"
    >
      <el-form-item label="角色名称" prop="name">
        <el-input v-model="form.name" placeholder="例如：林黛玉 / 旁白" />
      </el-form-item>
      <el-form-item label="角色简介">
        <el-input v-model="form.intro" placeholder="对角色的简单描述" />
      </el-form-item>
      <el-form-item label="绑定配音员">
        <el-select
          v-model="form.dubber_id"
          placeholder="打字搜索配音员"
          filterable
          clearable
          style="width: 100%"
        >
          <el-option
            v-for="d in allDubbers"
            :key="d.id"
            :label="d.name"
            :value="d.id"
          />
        </el-select>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button type="primary" @click="handleSave">保存</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
:deep(.el-button+.el-button) {
  margin-left: 0;
}
</style>
