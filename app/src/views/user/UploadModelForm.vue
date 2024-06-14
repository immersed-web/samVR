<template>
  <div>
    <form @submit.prevent="uploadFile">
      <div class="form-control gap-1">
        <input type="file" :accept="extensionAcceptString" class="file-input file-input-bordered max-w-xs"
          ref="fileInput" @change="onFilesPicked">
        <div class="flex flex-nowrap items-center gap-2">
          <button type="submit" class="btn btn-primary" :disabled="uploadDisabled">
            Ladda upp {{ props.name }}
          </button>
          <div :class="{ 'invisible': uploadProgress === 0 }" class="radial-progress text-primary"
            :style="`--value:${smoothedProgress}; --size:2.5rem`">
            {{ smoothedProgress.toFixed(0) }}%
          </div>
        </div>
        <div v-if="error" role="alert" class="alert alert-error text-sm">
          {{ error }}
        </div>
      </div>
    </form>
  </div>
  <div v-if="false">
    <form @submit.prevent="removeFile">
      <div class="flex items-center">
        <div class="flex-1 flex items-center gap-4">
          <!-- <i class="text-sm truncate">{{ venueStore.modelUrl }}</i> -->
          <span class="flex-1" />
          <div>
            <button type="submit" class="btn btn-error">
              <span class="material-icons mr-2">delete</span>
              Ta bort {{ props.name }}
            </button>
          </div>
        </div>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">

import { ref, computed, shallowRef } from 'vue';
import { autoResetRef, useTransition } from '@vueuse/core';
import axios from 'axios';
import { useConnectionStore } from '@/stores/connectionStore';
import { useStreamStore } from '@/stores/streamStore';
import { useAuthStore } from '@/stores/authStore';
import { type AssetType, assetTypesToExtensionsMap, maxFileSizeSchema, maxFileSize, createFileExtensionSchema, assetTypeListToExtensionList } from 'schemas';

// Props & emits
// const props = defineProps({
//   model: {type: String, required: true, validator(value: string){return ['model','navmesh'].includes(value);} },
//   name: {type: String, default: '3D-modell'},
// });

const props = withDefaults(defineProps<{
  acceptedAssetTypes: AssetType | AssetType[],
  name?: string,
}>(), {
  name: '3D-modell',
});

// const connectionStore = useConnectionStore();
// const streamStore = useStreamStore();
const authStore = useAuthStore();

// const modelExists = computed(() => {
//   return props.acceptedAssetTypes === 'model' ? !!streamStore.currentStream?.vrSpace?.virtualSpace3DModel?.modelFileFormat : !!streamStore.currentStream?.vrSpace?.virtualSpace3DModel?.navmeshFileFormat;
// });
const acceptedExtensions = computed(() => {
  return assetTypeListToExtensionList(props.acceptedAssetTypes);
})
const extensionAcceptString = computed(() => {
  return acceptedExtensions.value.map(ext => `.${ext}`).join(',');
});

const config = {
  url: `https://${import.meta.env.EXPOSED_SERVER_URL}${import.meta.env.EXPOSED_FILESERVER_PATH}`,
  headers: {
    'Content-Type': 'multipart/form-data',
  },
};

const uploadedFileName = computed(() => {
  // const modelId = streamStore.currentStream?.vrSpace?.virtualSpace3DModelId;
  // const modelFileFormat = streamStore.currentStream?.vrSpace?.virtualSpace3DModel?.modelFileFormat;
  // const navmeshFileFormat = streamStore.currentStream?.vrSpace?.virtualSpace3DModel?.navmeshFileFormat;
  // const fileFormat = props.acceptedAssetTypes === 'model' ? modelFileFormat : navmeshFileFormat;
  // if(!modelId || !fileFormat) {
  //   return undefined;
  // }
  // return `${modelId}.${props.acceptedAssetTypes}.${fileFormat}`;
});

const uploadDisabled = computed(() => {
  return !pickedFile.value || !extensionOfPickedFile.value || uploadProgress.value !== 0;
});

const pickedFile = shallowRef<File>();
const error = autoResetRef<string | undefined>(undefined, 3000);
const extensionOfPickedFile = ref<typeof acceptedExtensions.value[number]>();
const derivedAssetType = computed(() => {
  if (!extensionOfPickedFile.value) {
    return undefined;
  }
  const ext = extensionOfPickedFile.value
  for (const [assetType, extensionList] of Object.entries(assetTypesToExtensionsMap)) {
    if (extensionList.includes(ext)) {
      return assetType as AssetType;
    }
  }
  console.warn('failed to match extension to a valid asset type');
  return undefined
})
// const maxSize = 50 * 1024 * 1024;
const uploadProgress = ref(0);
const smoothedProgress = useTransition(uploadProgress);
function onFilesPicked(evt: Event) {
  pickedFile.value = undefined;
  console.log('files picked:', evt);
  if (!fileInput.value?.files) {
    return;
  }
  const file = fileInput.value.files[0];
  const parseresult = maxFileSizeSchema.safeParse(file.size);
  if (parseresult.error) {
    error.value = `maxstorlek (${maxFileSize / 1024 / 1024}MB) överskriden`;
    return;
  }
  const ext = file.name.split('.').pop();
  const validatedExt = createFileExtensionSchema(props.acceptedAssetTypes).safeParse(ext);
  if (validatedExt.error) {
    error.value = 'otillåtet filformat'
    return;
  }
  extensionOfPickedFile.value = validatedExt.data;
  pickedFile.value = file;
}

const fileInput = ref<HTMLInputElement>();
const uploadFile = async () => {
  if (!extensionOfPickedFile.value || !derivedAssetType.value) {
    return;
  }
  const ctl = new AbortController();
  try {
    if(pickedFile.value){
      const data = new FormData();
      data.append('file', pickedFile.value, pickedFile.value.name);
      data.set('assetType', derivedAssetType.value)
      // Array.from(fileInput.value.files).forEach(file => {
      //   data.append('gltf', file, file.name);
      // });
      pickedFile.value = undefined;

      // if (!streamStore.currentStream?.vrSpace?.virtualSpace3DModelId) {
      //   console.error('no virtualSpace3DModelId');
      //   return;
      // }
      // data.set('venueId', venueStore.currentVenue.venueId);
      // data.set('token', authStore.tokenOrThrow());

      const response = await axios.post(config.url + '/upload', data, {
        headers: {
          'Content-Type': 'multipart/form-data;',
          'Authorization': `Bearer ${authStore.tokenOrThrow()}`,
          // 'venueId': venueStore.currentVenue.venueId,
          // 'model-id': streamStore.currentStream.vrSpace.virtualSpace3DModelId,
          // 'file-name-suffix': props.acceptedAssetTypes,
        },
        signal: ctl.signal,
        timeout: 4 * 60 * 1000,
        onUploadProgress(progressEvent) {
          console.log(progressEvent);
          if(!progressEvent.progress) return;
          uploadProgress.value = progressEvent.progress * 100;
        },
      });
      console.log(extensionOfPickedFile);
      // update3DModel(extensionOfPickedFile.value);
      uploadProgress.value = 0;
      // console.log(response);
      // if(props.model === 'model'){
      //   create3DModel(response.data.modelUrl);
      // }
      // else if (props.model === 'navmesh'){
      //   updateNavmesh(response.data.modelUrl);
      // }
    }
  } catch (err) {
    console.error(err);
    error.value = 'failed to send file';
    uploadProgress.value = 0;
    extensionOfPickedFile.value = undefined;
    ctl.abort('failed to send file');

    // throw new Error(err);
  }
};

// const create3DModel = async (modelUrl: string) => {
//   await connectionStore.client.vr.create3DModel.mutate({modelUrl});
// };

const update3DModel = async (extension: 'gltf' | 'glb' | null) => {
  const modelId = streamStore.currentStream?.vrSpace?.virtualSpace3DModelId;
  if(!modelId) return;
  await connectionStore.client.vr.update3DModel.mutate({
    vr3DModelId: modelId,
    data: {
      modelFileFormat: props.acceptedAssetTypes === 'model' ? extension : undefined,
      navmeshFileFormat: props.acceptedAssetTypes === 'navmesh' ? extension : undefined,
    },
    reason: props.acceptedAssetTypes === 'model' ? '3D-model updated' : 'navmesh model updated',
  });

};

// Remove 3d model
const removeFile = async () => {
  try {

    const body = {
      fileName: uploadedFileName.value,
    };

    console.log(body);

    await axios.post(config.url + '/remove', body, {
      headers: {
        'token': authStore.tokenOrThrow(),
      },
      timeout: 60000,
    });
    update3DModel(null);
  } catch (err) {
    console.log(err);
  }
};
</script>

<style scoped>

.break {
  word-break: break-all;
}

#aframe {

}

</style>
