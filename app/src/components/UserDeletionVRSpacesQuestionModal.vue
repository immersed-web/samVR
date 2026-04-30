<template>
  <dialog
    class="modal"
    :class="{ 'modal-open': modelValue }"
    @click.self="onCancel"
  >
    <div class="modal-box">
      <button @click="onCancel" class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
      <h2 class="text-lg font-semibold mb-4">
        {{ ownershipStep === 1 ? 'Ta bort användare' : 'Välj ny ägare' }}
      </h2>

      <div v-if="ownershipStep === 1" class="space-y-4">
        <p class="text-sm text-error">
          Användaren äger VR-miljöer. Välj vad som ska hända med dessa miljöer:
        </p>

        <div class="form-control">
          <label class="label cursor-pointer justify-start gap-3">
            <input
              type="radio"
              name="ownership-action"
              class="radio radio-primary"
              :value="'take-over'"
              v-model="selectedAction"
            />
            <span class="label-text">Ta över ägandet själv</span>
          </label>
        </div>

        <div class="form-control">
          <label class="label cursor-pointer justify-start gap-3">
            <input
              type="radio"
              name="ownership-action"
              class="radio radio-primary"
              :value="'transfer'"
              v-model="selectedAction"
            />
            <span class="label-text">Överför ägandet till en annan användare eller admin</span>
          </label>
        </div>

        <div class="modal-action">
          <button type="button" class="btn btn-ghost" @click="onCancel">Avbryt</button>
          <button
            type="button"
            class="btn btn-primary"
            :disabled="!selectedAction"
            @click="goToStep2"
          >
            Nästa
          </button>
        </div>
      </div>

      <div v-else-if="ownershipStep === 2" class="space-y-4">
        <p class="text-sm">
          Välj vem som ska ta över ägandet av {{ targetUserName }}s VR-miljöer:
        </p>

        <div class="form-control">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Sök användarnamn..."
            class="input input-bordered w-full"
          />
        </div>

        <div class="max-h-60 overflow-y-auto space-y-2">
          <label
            v-for="user in filteredUsers"
            :key="user.userId"
            class="label cursor-pointer justify-start gap-3 p-2 hover:bg-base-200 rounded"
          >
            <input
              type="radio"
              name="target-user"
              class="radio radio-primary"
              :value="user.userId"
              v-model="selectedUserId"
            />
            <span>{{ user.username }} ({{ translateUserRole(user.role) }})</span>
          </label>
          <p v-if="filteredUsers.length === 0" class="text-sm text-warning p-4 text-center">
            Inga användare matchar sökningen.
          </p>
        </div>

        <div class="modal-action">
          <button type="button" class="btn btn-ghost" @click="goBackToStep1">Tillbaka</button>
          <button
            type="button"
            class="btn btn-primary"
            :disabled="!selectedUserId"
            @click="onConfirmDelete"
          >
            Bekräfta borttagning och överföring
          </button>
        </div>
      </div>
    </div>
  </dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { translateUserRole} from 'schemas';
import { type getUsers } from '@/modules/authClient'

type FetchedUser = Awaited<ReturnType<typeof getUsers>>[number];

const props = defineProps<{
  modelValue: boolean;
  targetUserName: string;
  users: Array<FetchedUser>;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'confirm', payload: {
    action: 'take-over' | 'transfer';
    targetUserId?: string;
  }): void;
}>();

const ownershipStep = ref(1);
const selectedAction = ref<'take-over' | 'transfer' | ''>('');
const selectedUserId = ref('');
const searchQuery = ref('');

const filteredUsers = computed(() =>
  props.users.filter(user =>
    user.username.toLowerCase().includes(searchQuery.value.toLowerCase())
  )
);

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      resetForm();
    }
  },
);

const resetForm = () => {
  ownershipStep.value = 1;
  selectedAction.value = '';
  selectedUserId.value = '';
  searchQuery.value = '';
};

function close() {
  emit('update:modelValue', false);
}

function onCancel() {
  close();
}

function goToStep2() {
  if (selectedAction.value === 'take-over') {
    // Immediate confirm for take-over (no step 2 needed)
    emit('confirm', { action: 'take-over' });
    close();
    return;
  }
  ownershipStep.value = 2;
}

function goBackToStep1() {
  ownershipStep.value = 1;
}

function onConfirmDelete() {
  emit('confirm', {
    action: 'transfer',
    targetUserId: selectedUserId.value,
  });
  close();
}
</script>