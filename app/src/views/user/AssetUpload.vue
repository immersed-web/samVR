<template>
  <div v-if="!uploadedAssetData" class="">
    <form @submit.prevent="uploadFile">
      <div class="flex items-center gap-2">
        <div class="relative leading-none">
          <button :class="[!isUploading ? 'visible' : 'invisible']" :disabled="isUploading" @click="() => open()"
            class="btn btn-sm btn-primary pr-2 pl-1 gap-1 flex-nowrap text-nowrap"><span
              class="material-icons">upload</span>Ladda
            upp</button>
          <div v-if="isUploading"
            class="pointer-events-none border-2 absolute rounded-md inset-0 grid place-content-stretch">
            <div :style="`width: ${smoothedProgress}%;`" class="col-start-1 row-start-1 rounded-md bg-secondary">
            </div>
            <div class="self-center justify-self-center col-start-1 row-start-1 leading-none font-bold text-lg">
              {{ smoothedProgress.toFixed(0) }}%
            </div>
          </div>
        </div>
        <button v-if="isUploading" class="btn btn-circle btn-sm btn-error" @click="abortController?.abort">
          <span class="material-icons">close</span>
        </button>
        <div v-auto-animate v-if="errorMessage" role="alert"
          class="bg-error text-error-content flex items-center rounded-2xl text-sm p-1 gap-2 leading-none pr-3 ">
          <span class="material-icons">error</span>
          <span class="text-ellipsis">{{ errorMessage }}</span>
        </div>
        <div v-auto-animate v-else-if="successMessage" role="alert"
          class="bg-info text-info-content flex items-center rounded-2xl text-sm p-1 gap-2 leading-none pr-3 ">
          <span class="material-icons">info</span>
          <span class="text-ellipsis">{{ successMessage }}</span>
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

const errorMessage = autoResetRef<string | undefined>(undefined, 3000);
// const errorMessage = 'asdasdasdj asdöflkj asd öaslkdgj';
const successMessage = autoResetRef<'fil uppladdad' | undefined>(undefined, 3000);
// const successMessage = 'asd very good klart!';
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
const isUploading = computed(() => {
  return uploadProgress.value !== 0;
})
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
    errorMessage.value = 'uppladdning misslyckades';
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
