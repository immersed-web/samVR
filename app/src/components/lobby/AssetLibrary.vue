<template>

  <div class="grid grid-cols-[repeat(auto-fill,_minmax(8rem,_1fr))] gap-2">
    <!-- <div v-for="asset in assets.filter(a => a.assetType === 'image')" :key="asset.assetId" -->
    <div v-for="asset in assets" :key="asset.assetId" class="cursor-pointer" @click="pickAsset(asset)">
      <div class="card card-compact bg-base-100 shadow-md">
        <figure class="">
          <img v-if="asset.assetType === 'image'" :src="assetsUrl + asset.generatedName">
          <embed v-if="asset.assetType === 'document'" :src="assetsUrl + asset.generatedName" type="application/pdf"
            width="100%" height="100%">
          <span v-if="asset.assetType === 'model' || asset.assetType === 'navmesh'"
            class="material-icons text-8xl">view_in_ar</span>
        </figure>
        <div class="card-body break-words">
          <p>{{ asset.originalFileName }}</p>
        </div>
      </div>
    </div>
    <!-- <div class="basis-1/4 cursor-pointer p-1 flex items-center justify-center">
      <div class="flex flex-col p-4">
        <button type="button" class="btn" @click="() => open">
          Upload a new asset
        </button>
      </div>
    </div> -->
  </div>
</template>
<script setup lang="ts">
import { assetsUrl } from '@/modules/utils';
import { useFileDialog } from '@vueuse/core';
import { assetTypeListToExtensionList, type Asset, type AssetType } from 'schemas';

const acceptedAssetTypesUpload: AssetType[] = ['document', 'image', 'model'];
const acceptedExtensions = assetTypeListToExtensionList(acceptedAssetTypesUpload);
const acceptedExtensionsString = acceptedExtensions.map(ext => `.${ext}`).join(',');

const { files, open, reset, onChange } = useFileDialog({
  multiple: false,
  accept: acceptedExtensionsString
  // accept: 'image/*', // Set to accept only image files
  // directory: true, // Select directories instead of files if set true
});

onChange((files) => {
  console.log('Files selected', files);
});

function pickAsset(asset: Asset) {
  emit('assetPicked', asset);
  // assetPickerIsOpen.value = false;
  // createPlaceableObject(type, src);
}

const emit = defineEmits<{
  assetPicked: [asset: Asset]
}>()

defineProps<{
  assets: Asset[]
}>();
</script>