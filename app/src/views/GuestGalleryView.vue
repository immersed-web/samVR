<template>
  <div data-theme="dark" class="min-h-screen bg-base-100 text-base-content">
    <header class="navbar bg-base-200 sticky top-0 z-10">
      <div class="max-w-6xl w-full mx-auto px-5 flex items-center justify-between gap-4">
        <RouterLink :to="{ name: 'landing' }" class="btn btn-ghost text-xl" title="Till startsidan">
          <span>Sam<span class="text-primary">VR</span></span>
        </RouterLink>
        <nav class="flex flex-wrap items-center gap-2">
          <RouterLink :to="{ name: 'guestGallery' }" class="btn btn-sm" :class="activeSection === 'municipality' ? 'btn-primary' : 'btn-ghost'">
            Kommuner
          </RouterLink>
          <RouterLink :to="{ name: 'guestCompanies' }" class="btn btn-sm" :class="activeSection === 'company' ? 'btn-primary' : 'btn-ghost'">
            Företag
          </RouterLink>
          <RouterLink :to="{ name: 'guestPersonal' }" class="btn btn-sm" :class="activeSection === 'personal' ? 'btn-primary' : 'btn-ghost'">
            SamVR privat
          </RouterLink>
          <RouterLink :to="{ name: 'login' }" class="btn btn-sm btn-ghost">Logga in</RouterLink>
        </nav>
      </div>
    </header>

    <main class="max-w-6xl mx-auto px-5 py-10">
      <RouterLink v-if="mode === 'organization'" :to="{ name: organizationType === 'municipality' ? 'guestGallery' : 'guestCompanies' }"
        class="link link-hover text-sm">
        ← {{ organizationType === 'municipality' ? 'Alla kommuner' : 'Alla företag' }}
      </RouterLink>

      <h1 class="text-3xl md:text-4xl font-bold mt-2">{{ heading }}</h1>
      <p class="text-base-content/70 mt-2 max-w-2xl">{{ intro }}</p>

      <div v-if="errorMessage" role="alert" class="alert alert-error mt-6 text-sm"><span>{{ errorMessage }}</span></div>
      <div v-if="loading" class="mt-10 flex items-center gap-3"><span class="loading loading-spinner"></span> Laddar…</div>

      <!-- Organization tiles -->
      <div v-else-if="mode === 'organizations'" class="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 mt-8">
        <RouterLink v-for="org in organizations" :key="org.organizationId"
          :to="{ name: 'guestOrganization', params: { organizationId: org.organizationId } }"
          class="card card-bordered bg-base-200 hover:border-primary">
          <figure class="h-28 bg-base-300">
            <img v-if="org.logoVersion" :src="orgLogoUrl(org.organizationId, org.logoVersion)" alt="" class="h-20 max-w-[80%] object-contain">
            <div v-else class="avatar placeholder"><div class="bg-primary text-primary-content w-16 rounded-full text-2xl">{{ org.name.charAt(0).toUpperCase() }}</div></div>
          </figure>
          <div class="card-body p-4">
            <h2 class="card-title text-base break-words">{{ org.name }}</h2>
            <p class="text-sm text-base-content/70">{{ typeLabel(org.type) }} · {{ org.spaceCount }}
              {{ org.spaceCount === 1 ? 'miljö' : 'miljöer' }}</p>
          </div>
        </RouterLink>
        <p v-if="!organizations.length" class="text-base-content/70 col-span-full">
          {{ props.kind === 'company' ? 'Inga företag har öppnat någon miljö för gäster ännu.' : 'Inga kommuner har öppnat någon miljö för gäster ännu.' }}
        </p>
      </div>

      <!-- Space tiles (one organization, or private persons) -->
      <template v-else>
        <div class="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 mt-8">
          <button v-for="space in spaces" :key="space.vrSpaceId" class="card card-bordered bg-base-200 hover:border-primary text-left"
            @click="selectedSpace = space">
            <figure class="h-28 bg-base-300">
              <img v-if="organizationLogo" :src="organizationLogo" alt="" class="h-20 max-w-[80%] object-contain">
              <div v-else class="avatar placeholder"><div class="bg-primary text-primary-content w-16 rounded-full text-2xl">{{ space.name.charAt(0).toUpperCase() }}</div></div>
            </figure>
            <div class="card-body p-4">
              <h2 class="card-title text-base break-words">{{ space.name }}</h2>
              <p class="text-sm text-base-content/70 line-clamp-2">{{ space.description || 'Besök som gäst' }}</p>
            </div>
          </button>
          <p v-if="!spaces.length" class="text-base-content/70 col-span-full">
            {{ mode === 'personal' ? 'Inga privatpersoner har delat någon miljö ännu.' : 'Den här organisationen har inga öppna miljöer.' }}
          </p>
        </div>
        <div v-if="mode === 'personal' && hasMore" class="mt-8 text-center">
          <button class="btn btn-outline" :disabled="loadingMore" @click="loadMore">
            <span v-if="loadingMore" class="loading loading-spinner loading-sm"></span>
            Visa fler
          </button>
        </div>
      </template>
    </main>

    <!-- Continue as guest into the chosen environment -->
    <dialog v-if="selectedSpace" class="modal modal-open" @click.self="selectedSpace = undefined" @keydown.esc="selectedSpace = undefined">
      <div class="modal-box max-w-md text-base-content">
        <p class="text-sm text-base-content/70 mb-1">Du går in i</p>
        <p class="font-bold mb-4">{{ selectedSpace.name }}</p>
        <h2 class="text-lg mb-2">Fortsätt som gäst</h2>
        <GuestBox :vr-space-id="selectedSpace.vrSpaceId" @continue="onContinue" />
        <p v-if="errorMessage" class="text-error text-sm mt-3">{{ errorMessage }}</p>
        <div class="modal-action mt-4">
          <button class="btn btn-ghost btn-sm" @click="selectedSpace = undefined">Avbryt</button>
        </div>
      </div>
    </dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import GuestBox from '@/components/GuestBox.vue';
import { galleryApi, orgErrorMessage, orgLogoUrl, type GalleryOrganization, type GallerySpace, type OrgType } from '@/modules/authClient';

const props = defineProps<{ mode: 'organizations' | 'organization' | 'personal', kind?: 'municipality' | 'company', organizationId?: string }>();
const router = useRouter();

const loading = ref(true);
const loadingMore = ref(false);
const errorMessage = ref('');
const selectedSpace = ref<GallerySpace>();
const organizations = ref<GalleryOrganization[]>([]);
const organizationName = ref('');
const organizationType = ref<OrgType>('municipality');
const organizationLogo = ref<string>();

/** Which top-menu button is lit: the section (or the organization's own section) we are in. */
const activeSection = computed(() => props.mode === 'personal' ? 'personal'
  : props.mode === 'organization' ? (organizationType.value === 'municipality' ? 'municipality' : 'company')
  : props.kind ?? 'municipality');
const spaces = ref<GallerySpace[]>([]);
const hasMore = ref(false);
const PAGE = 24;

const heading = computed(() => ({
  organizations: props.kind === 'company' ? 'Företag' : 'Kommuner',
  organization: organizationName.value || 'Organisation',
  personal: 'SamVR privat',
})[props.mode]);
const intro = computed(() => ({
  organizations: props.kind === 'company'
    ? 'Välj ett företag och kliv in i en av deras öppna miljöer som gäst. Du behöver inget konto.'
    : 'Välj en kommun och kliv in i en av deras öppna miljöer som gäst. Du behöver inget konto.',
  organization: 'Välj en miljö att besöka som gäst. Du kan bara besöka just den miljön.',
  personal: 'Miljöer som privatpersoner har valt att dela. Klicka på en för att besöka den som gäst.',
})[props.mode]);

const typeLabel = (type: OrgType) => ({ municipality: 'Kommun', company: 'Företag', other: 'Organisation' })[type];

async function load() {
  loading.value = true;
  errorMessage.value = '';
  spaces.value = [];
  hasMore.value = false;
  try {
    if (props.mode === 'organizations') {
      organizations.value = await galleryApi.organizations(props.kind);
    } else if (props.mode === 'organization') {
      const result = await galleryApi.organization(props.organizationId!);
      organizationName.value = result.organization.name;
      organizationType.value = result.organization.type;
      organizationLogo.value = orgLogoUrl(props.organizationId!, result.organization.logoVersion);
      spaces.value = result.spaces;
    } else {
      const result = await galleryApi.personal(0, PAGE);
      spaces.value = result.spaces;
      hasMore.value = result.hasMore;
    }
  } catch (e) {
    errorMessage.value = orgErrorMessage(e);
  } finally {
    loading.value = false;
  }
}

// The growing list for private persons: fetch the next page and append it.
async function loadMore() {
  loadingMore.value = true;
  try {
    const result = await galleryApi.personal(spaces.value.length, PAGE);
    const known = new Set(spaces.value.map(s => s.vrSpaceId));
    spaces.value.push(...result.spaces.filter(s => !known.has(s.vrSpaceId)));
    hasMore.value = result.hasMore;
  } catch (e) {
    errorMessage.value = orgErrorMessage(e);
  } finally {
    loadingMore.value = false;
  }
}

// GuestBox has already signed the guest in to this one space; just go there.
async function onContinue() {
  const vrSpaceId = selectedSpace.value?.vrSpaceId;
  selectedSpace.value = undefined;
  if (vrSpaceId) await router.push({ name: 'vrSpace', params: { vrSpaceId } });
}

onMounted(load);
watch(() => [props.mode, props.kind, props.organizationId], load);
</script>
