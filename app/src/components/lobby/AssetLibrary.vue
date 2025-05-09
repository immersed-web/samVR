<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-wrap gap-2">
      <label class="input input-sm input-bordered max-w-64 grow flex items-center gap-1 px-1">
        <span class="material-icons">search</span>
        <input v-model="searchString" placeholder="sök..." class="w-20 grow">
        <button @click="searchString = ''" v-if="searchString" class="material-icons">clear</button>
      </label>
      <div class="join">
        <!-- <input type="radio" class="join-item material-icons btn btn-sm"><span
                  class="material-icons">view_list</span></input> -->
        <input v-model="viewMode" type="radio" name="viewmode" value="thumbnails" aria-label="view_module"
          class="join-item btn btn-sm px-2 text-2xl leading-none font-normal material-icons" />
        <input v-model="viewMode" type="radio" name="viewmode" value="list" aria-label="view_list"
          class="join-item btn btn-sm px-2 text-2xl leading-none font-normal material-icons" />
      </div>
    </div>
    <div class="flex flex-wrap gap-2">
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
    <div v-if="viewMode === 'thumbnails'" class="grid grid-cols-[repeat(auto-fill,_minmax(6rem,_1fr))] gap-2">
      <!-- <div v-for="asset in assets.filter(a => a.assetType === 'image')" :key="asset.assetId" -->
      <div v-for="asset in searchedAssetList" :key="asset.assetId" class="relative">
        <div v-if="asset.assetId === pickedAsset?.assetId" class="absolute top-2 right-2 z-20">
          <div data-tip="ta bort från biblioteket" class="tooltip">
            <button class="btn btn-error btn-circle btn-sm shadow-xl" @click.stop="onDeleteAsset(asset)"><span
                class="material-icons">delete</span></button>
          </div>
        </div>
        <div @click="pickAsset(asset)" class="card card-compact rounded-lg bg-base-100 shadow-md cursor-pointer"
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
          </div>
        </div>
      </div>
    </div>
    <div v-else>
      <div class="grid grid-cols-[auto_minmax(5rem,1fr)_auto_auto] gap-y-1 gap-x-4">
        <div class="contents text-[0.65rem] uppercase font-bold text-base-content/70">
          <div class="">Bild</div>
          <div>Filnamn</div>
          <div>Filstorlek</div>
          <div>Datum</div>
        </div>
        <template v-for="asset in searchedAssetList" :key="asset.assetId">
          <div @click="pickAsset(asset)" :class="[asset.assetId === pickedAsset?.assetId ? selectedCSSClasses : '']"
            class="border cursor-pointer group overflow-hidden rounded-md items-center auto-rows-[3rem] grid grid-cols-subgrid col-span-4">
            <figure class="h-full aspect-square grid place-content-center">
              <img class="aspect-square object-cover border-r" v-if="asset.assetType === 'image'"
                :src="assetsUrl + asset.generatedName">
              <span v-if="asset.assetType === 'document'" class="material-icons text-5xl leading-none">article</span>
              <span v-if="asset.assetType === 'video'" class="material-icons text-5xl leading-none">movie</span>
              <span v-if="asset.assetType === 'model' || asset.assetType === 'navmesh'"
                class="material-icons text-5xl leading-none">view_in_ar</span>
            </figure>
            <div class="flex">
              <span class="text-nowrap text-ellipsis overflow-hidden">{{ stripExtension(asset.originalFileName)
                }}</span>
              <span>.{{ asset.assetFileExtension }}</span>
            </div>
            <div class="justify-self-end">{{ asset.size ? humanFileSize(asset.size) : 'N/A' }}</div>
            <div class="relative self-stretch grid place-content-center">
              <div class="mr-4">{{ asset.createdAt?.toLocaleDateString() }} </div>
              <div
                class="group-hover:opacity-100 opacity-0 transition-opacity absolute inset-0 bg-gradient-to-l from-50% from-base-100 flex justify-end items-center">
                <button @click.stop="onDeleteAsset(asset)" class="btn btn-error btn-square btn-sm mr-2"><span
                    class="material-icons">delete</span></button>
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { assetsUrl, deleteAsset, humanFileSize, stripExtension } from '@/modules/utils';
import { type Asset, type AssetId, type AssetType } from 'schemas';
import { useAuthStore } from '@/stores/authStore';
import { useClientStore } from '@/stores/clientStore';
import { computed, reactive, ref, shallowRef } from 'vue';
import { useStorage } from '@vueuse/core';
const authStore = useAuthStore();
const clientStore = useClientStore();

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

// const viewMode = ref<'list' | 'thumbnails'>('thumbnails');
const viewMode = useStorage<'list' | 'thumbnails'>('library-view-mode', 'thumbnails');

async function onDeleteAsset(asset: Asset) {
  const deleteParams = {
    assetId: asset.assetId,
    authToken: authStore.tokenOrThrow(),
  };

  await deleteAsset(deleteParams)
  await clientStore.reloadDbData();
  emit('assetDeleted', asset)
}

const selectedCSSClasses = 'outline outline-2 -outline-offset-2 outline-primary/30';

const pickedAsset = shallowRef<Asset>();
function pickAsset(asset: Asset) {
  pickedAsset.value = asset;
  emit('assetPicked', asset);
}

const emit = defineEmits<{
  assetPicked: [asset: Asset],
  assetDeleted: [asset: Asset],
}>()

</script>