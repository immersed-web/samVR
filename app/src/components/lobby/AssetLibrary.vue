<template>
  <div class="flex flex-col gap-2">
    <div class="flex gap-2">
      <label class="input input-sm input-bordered flex items-center gap-1 px-1">
        <span class="material-icons">search</span>
        <input v-model="searchString" placeholder="sök..." class="">
        <button @click="searchString = ''" v-if="searchString" class="material-icons">clear</button>
      </label>
      <div class="join">
        <!-- <input type="radio" class="join-item material-icons btn btn-sm"><span
                  class="material-icons">view_list</span></input> -->
        <input type="radio" name="viewmode" aria-label="view_list"
          class="join-item btn btn-sm text-2xl font-normal material-icons" />
        <input type="radio" name="viewmode" aria-label="view_module"
          class="join-item btn btn-sm text-2xl font-normal material-icons" />
      </div>
    </div>
    <div class="flex gap-2">
      <label class="btn btn-xs gap-1 rounded-full has-[:checked]:btn-primary">
        <input v-model="filters.image" type="checkbox" class="hidden" /><span
          class="text-sm material-icons">done</span>Bilder
      </label>
      <label class="btn btn-xs gap-1 rounded-full has-[:checked]:btn-primary">
        <input v-model="filters.video" type="checkbox" class="hidden" /><span
          class="text-sm material-icons">done</span>Videos
      </label>
      <label class="btn btn-xs gap-1 rounded-full has-[:checked]:btn-primary">
        <input v-model="filters.model" type="checkbox" class="hidden" /><span
          class="text-sm material-icons">done</span>3D-Modeller
      </label>
      <label class="btn btn-xs gap-1 rounded-full has-[:checked]:btn-primary">
        <input v-model="filters.document" type="checkbox" class="hidden" /><span
          class="text-sm material-icons">done</span>Dokument
      </label>
      <button v-if="filterActive" @click="clearFilters"
        class="btn btn-neutral btn-circle btn-xs material-icons">clear</button>
    </div>
    <div class="grid grid-cols-[repeat(auto-fill,_minmax(6rem,_1fr))] gap-2">
      <!-- <div v-for="asset in assets.filter(a => a.assetType === 'image')" :key="asset.assetId" -->
      <div v-for="asset in searchedAssetList" :key="asset.assetId" class="">
        <div @click="pickAsset(asset)" class="card card-compact bg-base-100 shadow-md cursor-pointer"
          :class="[asset.assetId === pickedAsset?.assetId ? selectedCSSClasses : '']">
          <figure class="">
            <img v-if="asset.assetType === 'image'" :src="assetsUrl + asset.generatedName">
            <embed v-if="asset.assetType === 'document'" :src="assetsUrl + asset.generatedName" type="application/pdf"
              width="100%" height="100%">
            <span v-if="asset.assetType === 'model' || asset.assetType === 'navmesh'"
              class="material-icons text-8xl">view_in_ar</span>
          </figure>
          <div class="card-body break-words">
            <p class="text-xs">{{ asset.originalFileName }}</p>
            <button class="btn btn-error btn-circle material-icons"
              @click="onDeleteAsset(asset.assetId)">delete</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { assetsUrl, deleteAsset } from '@/modules/utils';
import { type Asset, type AssetId, type AssetType } from 'schemas';
import { useAuthStore } from '@/stores/authStore';
import { computed, reactive, ref, shallowRef } from 'vue';
import { filter } from 'lodash-es';
const authStore = useAuthStore();

const { assets } = defineProps<{
  assets: Asset[]
}>();

type FilteredAssetTypes = Exclude<AssetType, 'navmesh'>;
const filters = reactive<Record<FilteredAssetTypes, boolean>>({
  image: false,
  video: false,
  model: false,
  document: false,
})
const pickedFilters = computed(() => {
  const filterArr = Object.entries(filters)
  const activeFiltersArr = filterArr.filter(([k, active]) => active);
  return activeFiltersArr.map(([k, _active]) => k);
})
function clearFilters() {
  filters.image = false;
  filters.video = false;
  filters.model = false;
  filters.document = false;
}

const filterActive = computed(() => {
  const filterArr = Object.entries(filters)
  return filterArr.some(([k, active]) => active);
})


const filteredAssetList = computed(() => {
  if (!filterActive.value) return assets;
  return assets.filter(asset => pickedFilters.value.includes(asset.assetType));
})

const searchString = ref('');
const searchedAssetList = computed(() => {
  if (searchString.value === '') return filteredAssetList.value;
  return filteredAssetList.value.filter((asset) =>
    asset.originalFileName
      .toLowerCase()
      .replace(/\s+/g, '')
      .includes(searchString.value.toLowerCase().replace(/\s+/g, ''))
  )
})

async function onDeleteAsset(assetId: AssetId) {
  const deleteParams = {
    assetId,
    authToken: authStore.tokenOrThrow(),
  };

  await deleteAsset(deleteParams)
}

const selectedCSSClasses = 'outline outline-2 -outline-offset-2 outline-primary/30';

const pickedAsset = shallowRef<Asset>();
function pickAsset(asset: Asset) {
  pickedAsset.value = asset;
  emit('assetPicked', asset);
}

const emit = defineEmits<{
  assetPicked: [asset: Asset]
}>()

</script>