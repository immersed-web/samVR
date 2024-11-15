<template>
  <div class="grid grid-cols-[auto_minmax(5rem,1fr)_auto] gap-y-1 gap-x-4">
    <div class="contents text-[0.65rem] uppercase font-bold text-base-content/70">
      <div class="">Bild</div>
      <div>Namn</div>
      <div>Typ</div>
    </div>
    <template v-for="placedObject in placedObjects" :key="placedObject.placedObjectId">
      <div @click="pickPlacedObject(placedObject)"
        :class="[placedObject.placedObjectId === pickedPlacedObject?.placedObjectId ? selectedCSSClasses : '']"
        class="border cursor-pointer group overflow-hidden rounded-md items-center auto-rows-[3rem] grid grid-cols-subgrid col-span-3">
        <figure class="h-full aspect-square grid place-content-center">
          <template v-if="placedObject.type === 'asset'">
            <img class="aspect-square object-cover border-r" v-if="placedObject.asset?.assetType === 'image'"
              :src="assetsUrl + placedObject.asset?.generatedName">
            <span v-if="placedObject.asset?.assetType === 'document'"
              class="material-icons text-5xl leading-none">article</span>
            <span v-if="placedObject.asset?.assetType === 'video'"
              class="material-icons text-5xl leading-none">movie</span>
            <span v-if="placedObject.asset?.assetType === 'model' || placedObject.asset?.assetType === 'navmesh'"
              class="material-icons text-5xl leading-none">view_in_ar</span>
          </template>
          <span v-else-if="placedObject.type === 'vrPortal'"
            class="material-icons text-5xl leading-none">door_front</span>
        </figure>
        <div class="flex">
          <template v-if="placedObject.type === 'asset'">
            <span class="text-nowrap text-ellipsis overflow-hidden">{{
              stripExtension(placedObject.asset!.originalFileName) }}</span>
            <span>.{{ placedObject.asset?.assetFileExtension }}</span>
          </template>
          <template v-else-if="placedObject.type === 'vrPortal'">
            <span class="text-nowrap text-ellipsis overflow-hidden">{{ placedObject.vrPortal!.name }}</span>
          </template>
        </div>
        <!-- <div class="justify-self-end">{{ placedObject.size ? humanFileSize(placedObject.size) : 'N/A' }}</div> -->
        <div class="relative self-stretch grid place-content-center">
          <!-- <div class="mr-4">{{ placedObject.createdAt?.toLocaleDateString() }} </div> -->
          <div class="mr-4">{{ placedObject.type }} </div>
          <div
            class="group-hover:opacity-100 opacity-0 transition-opacity absolute inset-0 bg-gradient-to-l from-50% from-base-100 flex justify-end items-center">
            <button @click.stop="onRemovePickedObject(placedObject)" class="btn btn-error btn-square btn-sm mr-2"><span
                class="material-icons">delete</span></button>
          </div>
        </div>
      </div>
    </template>
  </div>

</template>
<script setup lang="ts">
import type { PlacedObjectWithIncludes } from 'database';
import { shallowRef } from 'vue';
import { assetsUrl, stripExtension } from '@/modules/utils';

const { placedObjects } = defineProps<{
  placedObjects: PlacedObjectWithIncludes[]
}>();

const pickedPlacedObject = shallowRef<PlacedObjectWithIncludes>();

function pickPlacedObject(placedObject: PlacedObjectWithIncludes) {
  pickedPlacedObject.value = placedObject;
  emit('placedObjectPicked', placedObject);
}

function onRemovePickedObject(placedObject: PlacedObjectWithIncludes) {
  console.log('remove of placedObject triggered:', placedObject);
  emit('removePlacedObject', placedObject);
}

const selectedCSSClasses = 'outline outline-2 -outline-offset-2 outline-primary/30';

const emit = defineEmits<{
  placedObjectPicked: [placedObject: PlacedObjectWithIncludes],
  removePlacedObject: [placedObject: PlacedObjectWithIncludes],
}>();


</script>