<template>
  <div v-if="!uploadedAssetData">
    <form @submit.prevent="uploadFile">
      <div class="form-control gap-1">
        <div class="flex flex-nowrap items-center gap-2">
          <!-- <input type="file" :accept="extensionAcceptString"
            class="file-input file-input-bordered max-w-xs file-input-sm" ref="fileInput" @change="onFilesPicked">
          <button type="submit" class="btn btn-primary btn-sm" :disabled="uploadDisabled">
            Ladda upp {{ props.name }}
          </button> -->
          <button :disabled="uploadDisabled" @click="() => open()" class="btn btn-sm btn-primary px-2 gap-1"><span
              class="material-icons">upload</span>Ladda upp</button>
          <div :class="{ 'invisible': uploadProgress === 0 }" class="radial-progress text-primary"
            :style="`--value:${smoothedProgress}; --size:2.5rem`">
            {{ smoothedProgress.toFixed(0) }}%
          </div>
          <button :class="{ 'invisible': uploadProgress === 0 }" class="btn btn-circle btn-error"
            @click="abortController?.abort">
            <span class="material-icons">close</span>
          </button>
        </div>
        <div v-if="errorMessage" role="alert" class="alert alert-error text-sm">
          {{ errorMessage }}
        </div>
        <div v-else-if="successMessage" role="alert" class="alert alert-success text-sm">
          {{ successMessage }}
        </div>
      </div>
    </form>
  </div>
  <div v-else>
    <form @submit.prevent="removeFile">
      <button type="submit" class="btn btn-error btn-sm">
        <span class="material-icons mr-2">delete</span>
        Ta bort {{ props.name }}
      </button>
    </form>
  </div>
</template>

<script setup lang="ts">

import { ref, computed, shallowRef, type DeepReadonly, watch } from 'vue';
import { autoResetRef, useTransition, useFileDialog } from '@vueuse/core';
import type { ExtractSuccessResponse, UploadResponse } from 'fileserver';
import { useAuthStore } from '@/stores/authStore';
import { type AssetType, maxFileSizeSchema, maxFileSize, createFileExtensionSchema, assetTypeListToExtensionList, getAssetTypeFromExtension, type Asset } from 'schemas';
import { deleteAsset, uploadFileData } from '@/modules/utils';


const props = withDefaults(defineProps<{
  acceptedAssetTypes: AssetType | AssetType[],
  showInUserLibrary?: boolean
  name?: string,
  uploadedAssetData?: DeepReadonly<Asset> | null
}>(), {
  name: '',
  showInUserLibrary: undefined, // default to undefined will let the db use it's default value
});

export type AssetUploadEmitUploadedPayload = ExtractSuccessResponse<UploadResponse>;
const emit = defineEmits<{
  uploaded: [uploadDetails: AssetUploadEmitUploadedPayload],
  assetDeleted: [],
}>();

// export type AssetUploadEmitTypes = typeof emit;

const authStore = useAuthStore();

const acceptedExtensions = computed(() => {
  return assetTypeListToExtensionList(props.acceptedAssetTypes);
});
const extensionAcceptString = computed(() => {
  return acceptedExtensions.value.map(ext => `.${ext}`).join(',');
});

const { files, open, onCancel, onChange: onFilesPicked, reset: resetPickedFile } = useFileDialog({
  accept: extensionAcceptString.value,
});

const uploadDisabled = computed(() => {
  return uploadProgress.value !== 0;
});

const errorMessage = autoResetRef<string | undefined>(undefined, 3000);
const successMessage = autoResetRef<'fil uppladdad' | undefined>(undefined, 3000);
const extensionOfPickedFile = ref<typeof acceptedExtensions.value[number]>();
const derivedAssetType = computed(() => {
  if (!extensionOfPickedFile.value) {
    return undefined;
  }
  const assetType = getAssetTypeFromExtension(extensionOfPickedFile.value, props.acceptedAssetTypes);
  if (!assetType) {
    console.warn('failed to match extension to a valid asset type');
  }
  return assetType;
});
const uploadProgress = ref(0);
const smoothedProgress = useTransition(uploadProgress);

const pickedFile = computed(() => {
  if (!files.value) return undefined;
  return files.value[0];
})


// const fileSizeAllowed = computed(() => {
//   if(!pickedFile.value) return undefined;
//   const parseresult = maxFileSizeSchema.safeParse(pickedFile.value.size);
//   if (parseresult.error) {
//     // errorMessage.value = `maxstorlek (${maxFileSize / 1024 / 1024}MB) överskriden`;
//     return false;
//   }
//   return true;
// })

// const extensionOfPickedFile = computed(() => {
//   if(!pickedFile.value) return undefined;
//   const ext = pickedFile.value.name.split('.').pop();
//   const validatedExt = createFileExtensionSchema(props.acceptedAssetTypes).safeParse(ext?.toLowerCase());
//   if (validatedExt.error) {
//     // errorMessage.value = 'otillåtet filformat';
//     return undefined;
//   }
//   return validatedExt.data;
//   // extensionOfPickedFile.value = validatedExt.data;
// })

// watch([pickedFile, extensionOfPickedFile], ([file, extension]) => {
//   if(!file){
//     errorMessage.value = undefined;
//   }
//   if(!extension) {
//     errorMessage.value = 'otillåtet filformat';
//   }
// })

onFilesPicked((files) => {
  console.log('onFilesPicked:', files);

  if (files === null) {
    console.log('file(s) change event but fileList is null');
    return;
  };

  const file = files[0];

  const parseresult = maxFileSizeSchema.safeParse(file.size);
  if (parseresult.error) {
    errorMessage.value = `maxstorlek (${maxFileSize / 1024 / 1024}MB) överskriden`;
    return;
  }

  const ext = file.name.split('.').pop();
  const validatedExt = createFileExtensionSchema(props.acceptedAssetTypes).safeParse(ext?.toLowerCase());
  if (validatedExt.error) {
    errorMessage.value = 'otillåtet filformat';
    return;
  }
  extensionOfPickedFile.value = validatedExt.data;

  uploadFile();
});

let abortController: AbortController | undefined = undefined;
async function uploadFile() {
  if (!extensionOfPickedFile.value || !derivedAssetType.value) {
    return;
  }
  if (abortController) abortController.abort();
  abortController = new AbortController();
  try {
    if (pickedFile.value) {
      const data = new FormData();
      data.append('file', pickedFile.value, pickedFile.value.name);
      data.set('assetType', derivedAssetType.value);
      if (props.showInUserLibrary !== undefined) {
        const showInLib = props.showInUserLibrary;
        data.set('showInUserLibrary', `${showInLib}`);
      }
      resetPickedFile();

      const response = await uploadFileData({
        data,
        authToken: authStore.tokenOrThrow(),
        abortController: abortController,
        onProgress(progressEvent) {
          if (!progressEvent.progress) return;
          uploadProgress.value = progressEvent.progress * 100;
        },
      });

      uploadProgress.value = 0;
      if ('error' in response) {
        errorMessage.value = response['error'];
      } else {
        successMessage.value = 'fil uppladdad';
        emit('uploaded', response);
      }
    }
  } catch (err) {
    console.error(err);
    errorMessage.value = 'failed to send file';
    uploadProgress.value = 0;
    extensionOfPickedFile.value = undefined;
    abortController.abort('failed to send file');
  }
}

// TODO: It's a bit splitted here. The logic for actually deleting the asset is here.
// But sometimes we'll need to reload DB-data after deletion and thus we emit an event after the deletion so the parent component can take action if needed.
// We should probably move out all delete logic and only emit an event from here, making this component more "dumb" and keep less state.
const removeFile = async () => {
  if (!props.uploadedAssetData) {
    console.warn('no asset data to remove');
    return;
  };

  const deleteParams = {
    assetId: props.uploadedAssetData.assetId,
    authToken: authStore.tokenOrThrow(),
  };

  await deleteAsset(deleteParams)
  emit('assetDeleted');
};
</script>

<style scoped></style>
