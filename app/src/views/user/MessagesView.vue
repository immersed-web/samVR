<template>
  <MaxWidth7xl>
    <div class="flex flex-col gap-6 max-w-3xl">
      <div class="flex items-center justify-between gap-4 flex-wrap">
        <h1 class="text-3xl font-bold">Meddelanden</h1>
        <button v-if="unread" class="btn btn-sm btn-outline" @click="markAllRead">
          <span class="material-icons">done_all</span> Markera alla som lästa
        </button>
      </div>

      <div v-if="errorMessage" role="alert" class="alert alert-error"><span>{{ errorMessage }}</span></div>
      <div v-if="loading" class="flex items-center gap-3"><span class="loading loading-spinner"></span> Laddar…</div>
      <p v-else-if="!messages.length" class="text-base-content/60">Du har inga meddelanden.</p>

      <div v-for="m in messages" :key="m.messageId" class="card bg-base-200" :class="{ 'border-l-4 border-primary': !m.readAt }">
        <div class="card-body p-4 gap-2">
          <div class="flex items-start justify-between gap-3">
            <div>
              <h2 class="font-bold text-lg">
                {{ m.subject }}
                <span v-if="!m.readAt" class="badge badge-primary badge-sm ml-1">Ny</span>
              </h2>
              <div class="text-xs text-base-content/60">
                {{ formatDate(m.createdAt) }}<span v-if="m.from"> · från {{ m.from }}</span>
              </div>
            </div>
            <div class="flex gap-1 shrink-0">
              <button v-if="!m.readAt" class="btn btn-ghost btn-xs" title="Markera som läst" @click="markRead(m.messageId)">
                <span class="material-icons text-base">done</span>
              </button>
              <button class="btn btn-ghost btn-xs text-error" title="Radera meddelandet" @click="remove(m.messageId)">
                <span class="material-icons text-base">delete</span>
              </button>
            </div>
          </div>
          <p class="whitespace-pre-line">{{ m.body }}</p>
        </div>
      </div>
    </div>
  </MaxWidth7xl>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import MaxWidth7xl from '@/components/layout/MaxWidth7xl.vue';
import { messagesApi, orgErrorMessage, type InboxMessage } from '@/modules/authClient';

const messages = ref<InboxMessage[]>([]);
const loading = ref(true);
const errorMessage = ref('');
const unread = computed(() => messages.value.filter(m => !m.readAt).length);

// Timestamps come from the server as UTC
const formatDate = (iso: string) => new Date(iso).toLocaleString('sv-SE', { dateStyle: 'medium', timeStyle: 'short' });

async function load() {
  try {
    messages.value = (await messagesApi.list()).messages;
  } catch (e) {
    errorMessage.value = orgErrorMessage(e);
  } finally {
    loading.value = false;
  }
}

async function markRead(messageId: string) {
  await messagesApi.markRead(messageId);
  await load();
}
async function markAllRead() {
  await messagesApi.markRead();
  await load();
}
async function remove(messageId: string) {
  if (!confirm('Radera meddelandet?')) return;
  await messagesApi.remove(messageId);
  await load();
}

onMounted(load);
</script>
