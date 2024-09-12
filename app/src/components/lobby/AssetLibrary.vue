<template>

  <div class="flex flex-row flex-wrap ">
    <!-- <div v-for="asset in assets.filter(a => a.assetType === 'image')" :key="asset.assetId" -->
    <div v-for="asset in assets" :key="asset.assetId" class="basis-1/4 cursor-pointer p-1" @click="pickAsset(asset)">
      <div class="card card-compact bg-base-100 shadow-xl">
        <figure class="h-40">
          <img v-if="asset.assetType === 'image'" :src="assetsUrl + asset.generatedName">
          <embed v-if="asset.assetType === 'document'" :src="assetsUrl + asset.generatedName" type="application/pdf"
            width="100%" height="100%">
        </figure>
        <div class="card-body">
          <p>{{ asset.originalFileName }}</p>
        </div>
      </div>
    </div>
    <div class="basis-1/4 cursor-pointer p-1 flex items-center justify-center">
      <div class="flex flex-col p-4">
        <button type="button" class="btn" @click="() => open">
          Upload a new asset
        </button>
        <!-- <span class="label-text">or drag and drop your files</span> -->
      </div>
    </div>
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