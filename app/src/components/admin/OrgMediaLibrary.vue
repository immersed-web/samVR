<template>
  <dialog class="modal modal-open" @click.self="emit('close')" @keydown.esc="onEscape">
    <div class="modal-box w-[96vw] max-w-7xl h-[92vh] max-h-[92vh] p-0 flex flex-col overflow-hidden">
      <!-- Header -->
      <div class="flex flex-wrap items-center gap-3 px-5 py-3 border-b border-base-300">
        <div class="grow min-w-[12rem]">
          <h2 class="text-xl font-bold leading-tight">Mediabibliotek</h2>
          <p class="text-sm text-base-content/60">{{ organizationName }}<span v-if="scopeLabel"> › {{ scopeLabel }}</span></p>
        </div>
        <label class="flex items-center gap-2 text-sm">Enhet
          <select v-model="unit" class="select select-bordered select-sm max-w-[14rem]">
            <option v-if="!readOnly" value="all">Hela organisationen</option>
            <option v-for="u in units" :key="u.unitId" :value="u.unitId">{{ u.name }}</option>
            <option v-if="!readOnly" value="none">Utan enhet</option>
          </select>
        </label>
        <button class="btn btn-ghost btn-sm btn-circle" aria-label="Stäng" @click="emit('close')"><span class="material-icons">close</span></button>
      </div>

      <!-- Viewer -->
      <div v-if="current" class="grow min-h-0 flex flex-col lg:flex-row">
        <div class="grow min-h-[16rem] bg-neutral-900 relative flex items-center justify-center overflow-hidden">
          <button v-if="prevFile" class="btn btn-circle btn-sm btn-neutral absolute left-2 top-1/2 z-10" aria-label="Föregående" @click="current = prevFile"><span class="material-icons">chevron_left</span></button>
          <button v-if="nextFile" class="btn btn-circle btn-sm btn-neutral absolute right-2 top-1/2 z-10" aria-label="Nästa" @click="current = nextFile"><span class="material-icons">chevron_right</span></button>

          <img v-if="current.assetType === 'image'" :key="current.assetId" :src="fileUrl(current)" :alt="current.originalFileName" class="max-w-full max-h-full object-contain">
          <video v-else-if="current.assetType === 'video'" :key="current.assetId" :src="fileUrl(current)" controls autoplay class="max-w-full max-h-full" />
          <ModelViewer v-else-if="current.assetType === 'model'" :key="current.assetId" :src="fileUrl(current)" />
          <iframe v-else :key="current.assetId" :src="fileUrl(current)" :title="current.originalFileName" class="w-full h-full bg-base-100" />
        </div>

        <aside class="lg:w-80 shrink-0 border-t lg:border-t-0 lg:border-l border-base-300 p-4 overflow-y-auto space-y-4">
          <button class="btn btn-sm btn-outline" @click="current = undefined"><span class="material-icons">arrow_back</span> Till biblioteket</button>
          <div>
            <h3 class="font-bold break-words">{{ current.originalFileName }}</h3>
            <span class="badge badge-sm mt-1">{{ typeLabel(current.assetType) }}</span>
          </div>
          <dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            <dt class="text-base-content/60">Uppladdad av</dt><dd class="font-semibold">{{ current.uploader ?? 'Okänd (kontot är raderat)' }}</dd>
            <dt class="text-base-content/60">Datum</dt><dd>{{ formatDate(current.createdAt) }}</dd>
            <dt class="text-base-content/60">Storlek</dt><dd>{{ current.size ? humanFileSize(current.size) : '–' }}</dd>
            <dt class="text-base-content/60">Enhet</dt><dd>{{ current.unitName ?? 'Ingen enhet' }}</dd>
            <dt class="text-base-content/60">Används</dt><dd>{{ current.usedIn ? `i ${current.usedIn} ${current.usedIn === 1 ? 'miljö' : 'miljöer'}` : 'Inte i någon miljö' }}</dd>
          </dl>

          <div class="flex flex-wrap gap-2">
            <a class="btn btn-sm" :href="fileUrl(current)" target="_blank" rel="noopener"><span class="material-icons">open_in_new</span> Öppna</a>
            <a class="btn btn-sm" :href="fileUrl(current)" :download="current.originalFileName"><span class="material-icons">download</span> Ladda ned</a>
          </div>

          <div v-if="!readOnly" class="space-y-1">
            <div class="text-sm font-semibold">Flytta till enhet</div>
            <div class="flex gap-2">
              <select v-model="moveTarget" class="select select-bordered select-sm grow">
                <option value="">Ingen enhet</option>
                <option v-for="u in units" :key="u.unitId" :value="u.unitId">{{ u.name }}</option>
              </select>
              <button class="btn btn-sm" :disabled="busy || moveTarget === (current.unitId ?? '')" @click="moveFile">Flytta</button>
            </div>
          </div>

          <div v-if="!readOnly" class="rounded-lg border border-error/40 p-3 space-y-2">
            <div class="text-sm font-semibold text-error">Radera</div>
            <p class="text-xs">
              Filen tas bort för alltid<span v-if="current.usedIn"> och försvinner från de {{ current.usedIn }} miljöer där den används</span>.
              Det går inte att ångra.
            </p>
            <button class="btn btn-sm btn-error" :disabled="busy" @click="deleteFile"><span class="material-icons">delete</span> Radera filen</button>
          </div>
          <p v-if="errorMessage" class="text-sm text-error">{{ errorMessage }}</p>
        </aside>
      </div>

      <!-- Library -->
      <div v-else class="grow min-h-0 flex flex-col">
        <div class="flex flex-wrap items-center gap-2 px-5 py-3 border-b border-base-300">
          <button v-for="t in typeChips" :key="t.value" class="btn btn-sm rounded-full" :class="type === t.value ? 'btn-primary' : 'btn-outline'" @click="type = t.value">
            <span class="material-icons text-base">{{ t.icon }}</span> {{ t.label }}
            <span class="badge badge-sm" :class="type === t.value ? 'badge-ghost' : ''">{{ countFor(t.value) }}</span>
          </button>
          <label class="input input-bordered input-sm flex items-center gap-2 ml-auto w-full sm:w-64">
            <span class="material-icons text-base opacity-60">search</span>
            <input v-model="search" type="search" class="grow" placeholder="Sök på filnamn" aria-label="Sök bland filerna">
          </label>
        </div>
        <div v-if="errorMessage" role="alert" class="alert alert-error mx-5 mt-3 py-2"><span>{{ errorMessage }}</span></div>

        <div class="grow min-h-0 overflow-y-auto p-5">
          <div v-if="loading" class="py-16 text-center"><span class="loading loading-spinner loading-lg"></span></div>
          <p v-else-if="!files.length" class="py-16 text-center text-base-content/60">
            {{ search || type ? 'Inga filer matchar.' : 'Det finns inga filer här ännu. Filer som personer i organisationen laddar upp hamnar här.' }}
          </p>
          <div v-else class="grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-3">
            <button v-for="f in files" :key="f.assetId" class="card card-bordered bg-base-100 hover:border-primary text-left overflow-hidden" @click="open(f)">
              <span class="relative grid place-items-center aspect-[4/3] bg-base-300 overflow-hidden">
                <img v-if="f.assetType === 'image'" class="w-full h-full object-cover" :src="`${fileUrl(f)}?scaledown=4`" :alt="f.originalFileName" loading="lazy">
                <video v-else-if="f.assetType === 'video'" class="w-full h-full object-cover" :src="`${fileUrl(f)}#t=0.2`" preload="metadata" muted />
                <span v-else class="material-icons text-5xl text-base-content/50">{{ f.assetType === 'model' ? 'view_in_ar' : 'picture_as_pdf' }}</span>
                <span class="badge badge-neutral badge-sm absolute top-2 left-2">{{ typeLabel(f.assetType) }}</span>
              </span>
              <span class="block px-2 pt-2 text-sm font-semibold truncate" :title="f.originalFileName">{{ f.originalFileName }}</span>
              <span class="block px-2 text-xs text-base-content/60 truncate">av {{ f.uploader ?? 'okänd' }}</span>
              <span class="block px-2 pb-2 text-xs text-base-content/50 truncate">{{ formatDay(f.createdAt) }}<template v-if="f.size"> · {{ humanFileSize(f.size) }}</template><template v-if="unit === 'all' && f.unitName"> · {{ f.unitName }}</template></span>
            </button>
          </div>
          <div v-if="files.length < total" class="text-center mt-5">
            <button class="btn btn-outline btn-sm" :disabled="loadingMore" @click="loadMore">
              <span v-if="loadingMore" class="loading loading-spinner loading-sm"></span> Visa fler ({{ files.length }} av {{ total }})
            </button>
          </div>
        </div>
      </div>
    </div>
  </dialog>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import ModelViewer from '@/components/admin/ModelViewer.vue';
import { assetsUrl, deleteAsset, humanFileSize } from '@/modules/utils';
import { getJwt, orgErrorMessage, orgMediaApi, type MediaType, type OrgMediaFile, type OrgMediaSummary } from '@/modules/authClient';
import type { AssetId } from 'schemas';

const props = defineProps<{
  organizationId: string,
  organizationName: string,
  units: { unitId: string, name: string }[],
  /** 'all' = the whole organization, 'none' = files without a unit, otherwise a unit id */
  initialUnit?: string,
  /** Unit administrators: no moving or deleting, and only the given units (no "whole organization" / "no unit"). */
  readOnly?: boolean,
}>();
const emit = defineEmits<{ close: [], changed: [] }>();
const api = computed(() => orgMediaApi(props.organizationId));

const unit = ref<string>(props.initialUnit ?? (props.readOnly ? (props.units[0]?.unitId ?? 'all') : 'all'));
const type = ref<MediaType | ''>('');
const search = ref('');
const files = ref<OrgMediaFile[]>([]);
const total = ref(0);
const summary = ref<OrgMediaSummary>();
const loading = ref(true);
const loadingMore = ref(false);
const busy = ref(false);
const errorMessage = ref('');
const current = ref<OrgMediaFile>();
const moveTarget = ref('');
const PAGE = 48;

const typeChips: { value: MediaType | '', label: string, icon: string }[] = [
  { value: '', label: 'Alla', icon: 'apps' },
  { value: 'image', label: 'Bilder', icon: 'image' },
  { value: 'video', label: 'Videor', icon: 'movie' },
  { value: 'model', label: '3D-modeller', icon: 'view_in_ar' },
  { value: 'document', label: 'Dokument', icon: 'description' },
];
const typeLabel = (t: MediaType) => ({ image: 'Bild', video: 'Video', model: '3D-modell', document: 'Dokument' })[t];
const fileUrl = (f: OrgMediaFile) => assetsUrl + f.generatedName;
const formatDay = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('sv-SE') : '–');
const formatDate = (iso: string | null) => (iso ? new Date(iso).toLocaleString('sv-SE', { dateStyle: 'medium', timeStyle: 'short' }) : '–');
const scopeLabel = computed(() => unit.value === 'all' ? '' : unit.value === 'none' ? 'Utan enhet' : (props.units.find(u => u.unitId === unit.value)?.name ?? ''));

/** The unit rows of the summary that belong to the chosen scope. */
const scopedSummary = computed(() => (summary.value?.byUnit ?? []).filter(r => unit.value === 'all' || (unit.value === 'none' ? r.unitId === null : r.unitId === unit.value)));
function countFor(value: MediaType | '') {
  return scopedSummary.value.reduce((sum, r) => sum + (value ? r[value] : r.total), 0);
}

const query = () => ({ unit: unit.value === 'all' ? undefined : unit.value, type: type.value || undefined, search: search.value.trim() || undefined });
async function load() {
  loading.value = true; errorMessage.value = '';
  try {
    const result = await api.value.list({ ...query(), offset: 0, limit: PAGE });
    files.value = result.assets; total.value = result.total;
  } catch (e) { files.value = []; total.value = 0; errorMessage.value = orgErrorMessage(e); } finally { loading.value = false; }
}
async function loadSummary() {
  try { summary.value = await api.value.summary(); } catch (e) { errorMessage.value = orgErrorMessage(e); }
}
async function loadMore() {
  loadingMore.value = true;
  try {
    const result = await api.value.list({ ...query(), offset: files.value.length, limit: PAGE });
    const known = new Set(files.value.map(f => f.assetId));
    files.value.push(...result.assets.filter(f => !known.has(f.assetId)));
    total.value = result.total;
  } catch (e) { errorMessage.value = orgErrorMessage(e); } finally { loadingMore.value = false; }
}

let searchTimer: ReturnType<typeof setTimeout> | undefined;
watch(search, () => { clearTimeout(searchTimer); searchTimer = setTimeout(load, 300); });
watch([unit, type], () => { current.value = undefined; void load(); });
onMounted(() => { void load(); void loadSummary(); });
onBeforeUnmount(() => clearTimeout(searchTimer));

function open(f: OrgMediaFile) { current.value = f; moveTarget.value = f.unitId ?? ''; errorMessage.value = ''; }
const index = computed(() => files.value.findIndex(f => f.assetId === current.value?.assetId));
const prevFile = computed(() => (index.value > 0 ? files.value[index.value - 1] : undefined));
const nextFile = computed(() => (index.value >= 0 && index.value < files.value.length - 1 ? files.value[index.value + 1] : undefined));
watch(current, f => { if (f) moveTarget.value = f.unitId ?? ''; });
function onEscape() { if (current.value) current.value = undefined; else emit('close'); }

async function refreshAfterChange() {
  await Promise.all([load(), loadSummary()]);
  emit('changed');
}
async function moveFile() {
  if (!current.value) return;
  busy.value = true; errorMessage.value = '';
  try {
    await api.value.move(current.value.assetId, moveTarget.value || null);
    current.value = undefined;
    await refreshAfterChange();
  } catch (e) { errorMessage.value = orgErrorMessage(e); } finally { busy.value = false; }
}
async function deleteFile() {
  const f = current.value;
  if (!f) return;
  const uses = f.usedIn ? ` Den används i ${f.usedIn} ${f.usedIn === 1 ? 'miljö' : 'miljöer'} och försvinner därifrån.` : '';
  if (!confirm(`Radera "${f.originalFileName}" för alltid?${uses} Det går inte att ångra.`)) return;
  busy.value = true; errorMessage.value = '';
  try {
    // a fresh token: the one in the store lives only about a minute
    await deleteAsset({ assetId: f.assetId as AssetId, authToken: await getJwt() });
    current.value = undefined;
    await refreshAfterChange();
  } catch (e) { errorMessage.value = orgErrorMessage(e); } finally { busy.value = false; }
}
</script>
