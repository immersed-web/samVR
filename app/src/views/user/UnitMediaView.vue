<template>
  <MaxWidth7xl>
    <div class="flex flex-col gap-6">
      <div>
        <h1 class="text-3xl font-bold">Min enhet</h1>
        <p class="text-sm text-base-content/60">Mediabiblioteket för de enheter du administrerar. Du kan se och öppna filerna, men inte radera dem.</p>
      </div>

      <div v-if="errorMessage" role="alert" class="alert alert-error"><span>{{ errorMessage }}</span></div>
      <p v-if="loaded && !units.length" class="text-base-content/60">Du administrerar ingen enhet.</p>

      <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div v-for="u in units" :key="u.unitId" class="card bg-base-200">
          <div class="card-body p-4 gap-2">
            <div class="text-xs uppercase tracking-wide text-base-content/60">{{ u.organizationName }}</div>
            <h2 class="text-xl font-bold">{{ u.unitName }}</h2>
            <button class="btn btn-sm btn-primary justify-start" @click="open(u)">
              <span class="material-icons">perm_media</span> Mediabibliotek
            </button>
          </div>
        </div>
      </div>

      <!-- Read only: the units of the same organization that this person administers -->
      <OrgMediaLibrary v-if="opened" :key="opened.organizationId" :organization-id="opened.organizationId" :organization-name="opened.organizationName"
        :units="unitsOfOrganization(opened.organizationId)" :initial-unit="opened.unitId" read-only @close="opened = undefined" />
    </div>
  </MaxWidth7xl>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import MaxWidth7xl from '@/components/layout/MaxWidth7xl.vue';
import OrgMediaLibrary from '@/components/admin/OrgMediaLibrary.vue';
import { orgApi, orgErrorMessage, type AdministeredUnit } from '@/modules/authClient';

const units = ref<AdministeredUnit[]>([]);
const opened = ref<AdministeredUnit>();
const loaded = ref(false);
const errorMessage = ref('');
const unitsOfOrganization = (organizationId: string) => units.value.filter(u => u.organizationId === organizationId).map(u => ({ unitId: u.unitId, name: u.unitName }));

function open(u: AdministeredUnit) { opened.value = u; }

onMounted(async () => {
  try {
    units.value = await orgApi.myUnits();
  } catch (e) {
    errorMessage.value = orgErrorMessage(e);
  } finally {
    loaded.value = true;
  }
});
</script>
