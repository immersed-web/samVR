<template>
  <MaxWidth7xl>
    <div class="flex flex-col gap-6">
      <h1 class="text-3xl font-bold">Hantera användare</h1>

      <div v-if="errorMessage" role="alert" class="alert alert-error"><span>{{ errorMessage }}</span></div>
      <p v-if="loaded && !organizations.length" class="text-base-content/60">Du administrerar ingen organisation.</p>

      <!-- Only shown when someone administers several organizations -->
      <div v-if="organizations.length > 1" class="flex flex-wrap gap-2">
        <button v-for="org in organizations" :key="org.organizationId" class="btn"
          :class="org.organizationId === selectedId ? 'btn-primary' : 'btn-outline'" @click="selectedId = org.organizationId">
          {{ org.name }}
        </button>
      </div>

      <OrgUserManager v-if="selected" :key="selected.organizationId" :organization-id="selected.organizationId" :organization-name="selected.name" />
    </div>
  </MaxWidth7xl>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import MaxWidth7xl from '@/components/layout/MaxWidth7xl.vue';
import OrgUserManager from '@/components/admin/OrgUserManager.vue';
import { orgApi, orgErrorMessage, type OrganizationListItem } from '@/modules/authClient';

// The organizations this person administers. The server decides what they may do in each one.
const organizations = ref<OrganizationListItem[]>([]);
const selectedId = ref<string>();
const loaded = ref(false);
const errorMessage = ref('');
const selected = computed(() => organizations.value.find(o => o.organizationId === selectedId.value));

onMounted(async () => {
  try {
    organizations.value = (await orgApi.list()).filter(o => o.myRole === 'org_admin');
    selectedId.value = organizations.value[0]?.organizationId;
  } catch (e) {
    errorMessage.value = orgErrorMessage(e);
  } finally {
    loaded.value = true;
  }
});
</script>
