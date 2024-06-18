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
          <button :class="{ 'invisible': uploadProgress === 0 }" class="btn btn-circle btn-error"
            @click="abortController?.abort"><span class="material-icons">close</span></button>
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
import type { ExtractSuccessResponse, UploadRequest, UploadResponse } from 'fileserver'
import { useConnectionStore } from '@/stores/connectionStore';
import { useAuthStore } from '@/stores/authStore';
import { type AssetType, maxFileSizeSchema, maxFileSize, createFileExtensionSchema, assetTypeListToExtensionList, getAssetTypeFromExtension } from 'schemas';
import { uploadFileData } from '@/modules/utils';

const props = withDefaults(defineProps<{
  acceptedAssetTypes: AssetType | AssetType[],
  showInUserLibrary?: boolean
  name?: string,
}>(), {
  name: '',
  showInUserLibrary: undefined
});

const emit = defineEmits<{
  uploaded: [uploadDetails: ExtractSuccessResponse<UploadResponse>]
}>()

export type EmitTypes = typeof emit

const authStore = useAuthStore();

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
  const assetType = getAssetTypeFromExtension(extensionOfPickedFile.value, props.acceptedAssetTypes);
  if (!assetType) {
    console.warn('failed to match extension to a valid asset type');
  }
  return assetType
})
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
  const validatedExt = createFileExtensionSchema(props.acceptedAssetTypes).safeParse(ext?.toLowerCase());
  if (validatedExt.error) {
    error.value = 'otillåtet filformat'
    return;
  }
  extensionOfPickedFile.value = validatedExt.data;
  pickedFile.value = file;
}

const fileInput = ref<HTMLInputElement>();

let abortController: AbortController | undefined = undefined;
async function uploadFile() {
  if (!extensionOfPickedFile.value || !derivedAssetType.value) {
    return;
  }
  if (abortController) abortController.abort();
  abortController = new AbortController();
  try {
    if(pickedFile.value){
      const data = new FormData();
      data.append('file', pickedFile.value, pickedFile.value.name);
      data.set('assetType', derivedAssetType.value)
      if (props.showInUserLibrary) {
        data.set('showInUserLibrary', Boolean(props.showInUserLibrary).toString());
      }
      pickedFile.value = undefined;

      // We can apparently receive upload progress after the upload is actually finished.
      // Perhaps some race condition. We use this flag to mitigate that 👍
      // let uploadActive = true; 

      // const response = await axios.post<UploadResponse>(config.url + '/upload', data, {
      //   headers: {
      //     'Content-Type': 'multipart/form-data;',
      //     'Authorization': `Bearer ${authStore.tokenOrThrow()}`,
      //   },
      //   signal: ctl.signal,
      //   timeout: 4 * 60 * 1000,
      //   onUploadProgress(progressEvent) {
      //     if (!uploadActive) return;
      //     console.log(progressEvent);
      //     if(!progressEvent.progress) return;
      //     uploadProgress.value = progressEvent.progress * 100;
      //   },
      // });
      // uploadActive = false;
      const response = await uploadFileData({
        data,
        authToken: authStore.tokenOrThrow(),
        abortController: abortController,
        onProgress(progressEvent) {
          if (!progressEvent.progress) return
          uploadProgress.value = progressEvent.progress * 100;
        },
      });

      uploadProgress.value = 0;
      if ('error' in response) {
        error.value = response['error'];
      } else {
        emit('uploaded', response);
      }
    }
  } catch (err) {
    console.error(err);
    error.value = 'failed to send file';
    uploadProgress.value = 0;
    extensionOfPickedFile.value = undefined;
    abortController.abort('failed to send file');
  }
};

// const update3DModel = async (extension: 'gltf' | 'glb' | null) => {
//   const modelId = streamStore.currentStream?.vrSpace?.virtualSpace3DModelId;
//   if(!modelId) return;
//   await connectionStore.client.vr.update3DModel.mutate({
//     vr3DModelId: modelId,
//     data: {
//       modelFileFormat: props.acceptedAssetTypes === 'model' ? extension : undefined,
//       navmeshFileFormat: props.acceptedAssetTypes === 'navmesh' ? extension : undefined,
//     },
//     reason: props.acceptedAssetTypes === 'model' ? '3D-model updated' : 'navmesh model updated',
//   });

// };

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
  } catch (err) {
    console.log(err);
  }
};
</script>

<style scoped></style>
