<template>
  <dialog
    class="modal"
    :class="{ 'modal-open': modelValue }"
    @click.self="onCancel"
  >
  
    <div class="modal-box">
      <button @click="onCancel" class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
      <h2 class="text-lg font-semibold mb-4">Byt lösenord</h2>

      <form @submit.prevent="onSubmit" class="space-y-3">
        <div class="form-control">
          <label class="label">
            <span class="label-text">Nuvarande lösenord</span>
          </label>
          <input
            v-model="passwordForm.currentPassword"
            type="password"
            class="input input-bordered w-full"
            :class="{ 'input-error': !passwordsMatch }"
          />
        </div>

        <div class="form-control">
          <label class="label">
            <span class="label-text">Nytt lösenord</span>
          </label>
          <input
            v-model="passwordForm.newPassword"
            type="password"
            class="input input-bordered w-full"
          />
        </div>

        <div class="form-control">
          <label class="label">
            <span class="label-text">Bekräfta nytt lösenord</span>
          </label>
          <input
            v-model="passwordForm.newPasswordConfirm"
            type="password"
            class="input input-bordered w-full"
            :class="{ 'input-error': !passwordsMatch }"
          />
          <p v-if="!passwordsMatch" class="mt-1 text-sm text-error">
            Lösenorden stämmer inte överens.
          </p>
        </div>

        <div class="modal-action">
          <button
            type="button"
            class="btn btn-ghost"
            @click="onCancel"
          >
            Avbryt
          </button>
          <button type="submit" class="btn btn-primary">
            Spara
          </button>
        </div>
      </form>
    </div>
  </dialog>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue';

const props = defineProps<{
  modelValue: boolean
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'submit', payload: { currentPassword: string; newPassword: string }): void;
}>();

const emptyForm = () => ({
  currentPassword: '',
  newPassword: '',
  newPasswordConfirm: '',
});

const passwordForm = ref(emptyForm());

const passwordsMatch = computed(() =>
    passwordForm.value.newPasswordConfirm === '' ||
    passwordForm.value.newPassword === passwordForm.value.newPasswordConfirm,
);

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      passwordForm.value = emptyForm();
      passwordForm.value.newPasswordConfirm = '';
    }
  },
);

function close() {
  emit('update:modelValue', false);
}

function onCancel() {
  close();
}

function onSubmit() {
  if (!passwordsMatch.value) return;
  emit('submit', { ...passwordForm.value });
  close();
}
</script>