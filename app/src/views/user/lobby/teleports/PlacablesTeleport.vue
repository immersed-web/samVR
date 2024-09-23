<template>
  <!-- #region Place objects -->
  <!-- <Teleport to="#tp-ui-left">
      <button class="p-3 text-white rounded-md cursor-pointer bg-zinc-800"
        @click="createPlaceableObject('a-image', '/photos/joey-chacon-edbYu4vxXww-unsplash.jpg')">place photo</button>
      <button class="p-3 text-white rounded-md cursor-pointer bg-zinc-800"
        @click="createPlaceableObject('PdfEntity', '/documents/smallpdf_sample.pdf')">Place pdf</button>
    </Teleport> -->
  <!-- #endregion -->

  <!-- #region Tweakpane UI -->
  <Teleport to="#teleport-target-ui-right">
    <div id="paneContainer" ref="paneContainer" class="flex flex-col gap-1 pointer-events-auto">
      <div id="pane1" />
      <div id="pane2" />
    </div>
  </Teleport>
  <!-- #endregion -->

  <template v-if="isAsset(currentlyMovedObject)">
    <Teleport to="#teleport-target-aframe-cursor">
      <PlacedAsset v-if="currentlyMovedObject" :asset="currentlyMovedObject" />
    </Teleport>
  </template>
  <!-- <component ref="currentlyMovedEntity" v-if="currentlyMovedObject" :is="currentlyMovedObject.type"
        :src="currentlyMovedObject.src" /> -->

  <a-entity id="placed-objects" ref="placedObjectsEntity">
    <a-entity v-for="placedObject in placedObjects" :key="placedObject.placedObjectId"
      :position="arrToCoordString(placedObject.position)"
      :rotation="arrToCoordString(quaternionTupleToAframeRotation(placedObject.orientation ?? [0, 0, 0, 1]))"
      :id="placedObject.placedObjectId">
      <!-- <a-sphere color="red" position="0 1 0" /> -->
      <PlacedAsset @click="selectedPlacedObject = placedObject" class="selectable-object"
        v-if="placedObject.type === 'asset' && placedObject.asset" :asset="placedObject.asset" />
      <!-- <component @click="selectEntity(placedObject.placedObjectId, $event)" class="clickable"
            :box-helper="`enabled: ${currentlySelectedPlacedObjectId === placedObject.placedObjectId};`"
            :is="placedObject.type"
            :src="placedObject.asset?.generatedName" /> -->
    </a-entity>
  </a-entity>

  <!-- Asset picker -->
  <Dialog ref="dropZoneRef" :open="assetPickerIsOpen" @close="assetPickerIsOpen = false" class="relative z-50">
    <div class="fixed inset-0 flex w-screen items-center justify-center p-40">
      <!-- <div v-if="isOverDropZone"
          class="absolute top-0 left-0 bg-slate-50 opacity-90 w-screen h-screen pointer-events-none z-10 flex items-center justify-center">
          Drop
          your files here</div> -->

      <DialogPanel
        class="w-full h-full transform rounded-2xl bg-white p-4 text-left align-middle shadow-xl transition-all">
        <div class="h-full overflow-y-auto">
          <DialogTitle>Pick an asset and place it in the scene</DialogTitle>
          <AssetLibrary :assets="assets" @assetPicked="pickAsset" />
        </div>
      </DialogPanel>
    </div>
  </Dialog>
</template>

<style scoped>
#paneContainer>* {
  display: inline-block;
}
</style>

<script setup lang="ts">

import { Pane } from 'tweakpane';

import { computed, ref, onMounted, reactive, shallowRef } from 'vue';
import { useEventBus } from '@vueuse/core';
import { useCurrentCursorIntersection, useSelectedPlacedObject } from '@/composables/vrSpaceComposables';

import { type DetailEvent, THREE, type Entity } from 'aframe';
import PdfEntity from '@/components/lobby/PdfEntity.vue';

import { useDropZone, useFileDialog } from '@vueuse/core';


import {
  Dialog,
  DialogPanel,
  DialogTitle,
  DialogDescription,
} from '@headlessui/vue';
import AssetLibrary from '@/components/lobby/AssetLibrary.vue';
import { extensionsToAframeTagsMap, type Asset, type AssetAframeTagname, type AssetId, type AssetType, type PlacedObject, type PlacedObjectId, type PlacedObjectInsert, type UserId } from 'schemas';
import { getAssetUrl } from '@/modules/utils';
import { quaternionToAframeRotation, arrToCoordString, quaternionTupleToAframeRotation, eulerTupleToQuaternionTuple, intersectionToTransform } from '@/modules/3DUtils';
import PlacedAsset from '@/components/lobby/PlacedAsset.vue';
import type { PlacedObjectWithIncludes } from 'database';
import { useClientStore } from '@/stores/clientStore';
const clientStore = useClientStore();
import { useVrSpaceStore } from '@/stores/vrSpaceStore';
const vrSpaceStore = useVrSpaceStore();

const { currentCursorIntersection, onCursorClick, setCursorMode, currentCursorMode } = useCurrentCursorIntersection();
const { selectedPlacedObject } = useSelectedPlacedObject();


defineOptions({
  components: { PdfEntity },
});

const currentlyMovedObject = shallowRef<Asset | PlacedObjectWithIncludes | undefined>();
const currentlySelectedPlacedObjectId = ref<PlacedObjectId | undefined>();
// const currentlySelectedObject = ref<PlacedObjectList[number] | undefined>()
const currentlyMovedEntity = ref<Entity | null>(null);
const currentlySelectedEntity = ref<Entity | null>(null);
// const placedObjects = reactive<PlacedObjectWithIncludes[]>([
//   // { type: 'PdfEntity', src: '/documents/smallpdf_sample.pdf', uuid: crypto.randomUUID(), position: [1, 1.8, -2], rotation: [0, 0, 0] },
//   // { type: 'PdfEntity', src: '/documents/compressed.tracemonkey-pldi-09.pdf', uuid: crypto.randomUUID(), position: [-2, 1.8, -2], rotation: [0, 0, 0] },
// ]);
const placedObjects = computed(() => {
  return vrSpaceStore.currentVrSpace?.dbData.placedObjects ?? [];
});
const currentlySelectedPlacedObject = computed(() => {
  return placedObjects.value.find(obj => obj.placedObjectId === currentlySelectedPlacedObjectId.value);
});

const assets = computed(() => {
  return clientStore.clientState?.assets.filter(asset => asset.showInUserLibrary) ?? [];
})

const assetPickerIsOpen = ref(false);

const placedObjectsEntity = ref<Entity>();
function isAsset(obj?: Asset | PlacedObjectWithIncludes): obj is Asset {
  if (!obj) return false;
  return 'assetId' in obj
}
async function placeMovedObject(position: THREE.Vector3Tuple, orientation: THREE.Vector4Tuple) {
  console.log('placeMovedObject', position, orientation);
  if (!currentlyMovedObject.value) return;
  // const position = cursorObject.position.toArray();
  // const rotation = cursorObject.quaternion.toArray() as THREE.Vector4Tuple;
  if (isAsset(currentlyMovedObject.value)) {
    console.log('placed an asset. Need to create a placedObject');
    await vrSpaceStore.upsertPlacedObject({
      type: 'asset',
      objectId: currentlyMovedObject.value.assetId,
      position,
      orientation
    }, 'placing an asset')
    currentlyMovedObject.value = undefined;
    return;
  } else {
    console.log('placed an already placedObject, should update the DB');
    await vrSpaceStore.upsertPlacedObject({
      placedObjectId: currentlyMovedObject.value.placedObjectId,
      position,
      orientation,
      type: currentlyMovedObject.value.type,
    })
  }

  // TODO: create/update placedObject in DB here
  // currentlyMovedObject.value.position = position;
  // currentlyMovedObject.value.orientation = orientation;
  // placedObjects.push(currentlyMovedObject.value);
  selectEntity(currentlyMovedObject.value.placedObjectId, undefined);
  currentlyMovedObject.value = undefined;
}

function pickAsset(asset: Asset) {
  assetPickerIsOpen.value = false;
  const src = getAssetUrl(asset.generatedName);
  const tag = extensionsToAframeTagsMap[asset.assetFileExtension];
  if (src) {
    // createPlaceableObject(extensionsToAframeTagsMap[asset.assetFileExtension], src);
    currentlyMovedObject.value = asset;
    setCursorMode('placeObject');
  }
}

const { files, open, reset, onChange } = useFileDialog({
  // accept: 'image/*', // Set to accept only image files
  // directory: true, // Select directories instead of files if set true
});

onChange((files) => {
  console.log('Files selected', files);
});

// DROP ZONE
// const dropZoneRef = ref<HTMLDivElement>()

// function onDrop(filesDropped: File[] | null) {
//   console.log("Dropped files", filesDropped)
// }

// const { isOverDropZone } = useDropZone(dropZoneRef, {
//   onDrop,
//   // specify the types of data to be received.
//   dataTypes: ['image/jpeg', 'image/png', 'model/gltf-binary', 'model/gltf+json', 'application/pdf']
// })

// function createPlaceableObject(type: AssetAframeTagname, src: string) {
//   console.log('Place photo', type, src);
//   const uuid = crypto.randomUUID();
//   const newPlaceableObject: PlaceableObject = {
//     uuid,
//     src,
//     type,
//   };
//   currentlyMovedObject.value = newPlaceableObject;
// }

function repositionSelectedObject() {
  //TODO: reposition selected object
  if (isAsset(currentlyMovedObject.value)) return;
  // const idx = placedObjects.findIndex(obj => obj.placedObjectId === currentlySelectedPlacedObject.value?.placedObjectId);
  // if (idx < 0) return;
  // const [obj] = placedObjects.splice(idx, 1);
  // currentlyMovedObject.value = obj;
}

function removeSelectedObject() {
  if (!currentlySelectedPlacedObject.value) { return; }
  removeObject(currentlySelectedPlacedObject.value.placedObjectId);
  currentlySelectedPlacedObjectId.value = undefined;
}

async function removeObject(placedObjectId: PlacedObjectId) {
  // const idx = placedObjects.findIndex(obj => obj.placedObjectId === placedObjectId);
  // if (idx < 0) return;
  // placedObjects.splice(idx, 1);
  await vrSpaceStore.removePlacedObject(placedObjectId); 
  updatePaneSelected();
}

function selectEntity(uuid: PlacedObjectId, evt: DetailEvent<{ cursorEl: Entity, intersection: THREE.Intersection, mouseEvent: MouseEvent }> | undefined) {
  console.log(uuid);
  console.log(evt);
  console.log('Selected entity', currentlySelectedEntity);
  currentlySelectedPlacedObjectId.value = uuid;
  updatePaneSelected();
}

const paneContainer = ref(null);
type PaneParams = {
  'scale': THREE.Vector3Tuple,
  // 'positionGlobal': THREE.Vector3,
  'positionLocal': THREE.Vector3Tuple,
  'rotation': THREE.Vector3Tuple
}
const pane = ref<Pane | undefined>();
const paneParams = ref<PaneParams | undefined>();

function initPaneCreate() {
  if (paneContainer.value) {

    const p = new Pane({ container: paneContainer.value });
    p.title = 'Objects in scene';

    p.addButton({
      title: 'Add new object',
    }).on('click', () => {
      assetPickerIsOpen.value = true;
    });

  }
}

function updatePaneSelected() {

  if (pane.value) {
    pane.value.dispose();
    pane.value = undefined;
  }

  if (paneContainer.value) {
    const obj = currentlySelectedPlacedObject.value;
    if (obj) {

      pane.value = new Pane({ container: paneContainer.value });
      pane.value.title = 'Selected: ' + obj.placedObjectId;
      const aframeRotation = quaternionTupleToAframeRotation(obj.orientation ?? [0, 0, 0, 1]);

      paneParams.value = {
        'scale': [...obj.scale ?? [1, 1, 1]],
        // 'positionGlobal': obj.position,
        'positionLocal': [...obj.position],
        'rotation': aframeRotation,
      };

      pane.value.addBinding(paneParams.value, 'scale', { label: 'Scale', step: 0.01 }).on('change', (ev) => {
        if (!currentlySelectedPlacedObject.value) { return; }
        // currentlySelectedPlacedObject.value.scale = [...ev.value];
      });

      pane.value.addBlade({
        view: 'separator',
      });

      // pane.value.addBinding(paneParams.value, 'positionGlobal', { label: 'Global position', step: 0.025 }).on('change', (ev) => {
      //   if (!currentlySelectedPlacedObject.value) { return; }
      //   currentlySelectedPlacedObject.value.position = ev.value.clone();
      // });

      pane.value.addBinding(paneParams.value, 'positionLocal', { label: 'Local position (fine tune)', step: 0.01 }).on('change', (ev) => {
        if (!currentlySelectedPlacedObject.value) { return; }
        // currentlySelectedPlacedObject.value.position = [...ev.value];
        // if (ev.last) {
        //   mergeLocalAndWorldPositions();
        // }
      });

      pane.value.addButton({
        label: 'Reposition in scene',   // optional
        title: 'Reposition',
      }).on('click', () => {
        repositionSelectedObject();
      });

      pane.value.addBlade({
        view: 'separator',
      });

      pane.value.addBinding(paneParams.value, 'rotation', { label: 'Rotation', step: 1, min: -180, max: 180 }).on('change', (ev) => {
        if (!currentlySelectedPlacedObject.value) { return; }
        const quatTuple = eulerTupleToQuaternionTuple(ev.value);
        // currentlySelectedPlacedObject.value.orientation = quatTuple;
      });

      pane.value.addBlade({
        view: 'separator',
      });
      pane.value.addButton({
        label: 'Remove object from scene',   // optional
        title: 'Remove',
      }).on('click', () => {
        removeObject(obj.placedObjectId);
      });

      pane.value.addBlade({
        view: 'separator',
      });

    }
  }
}

// function mergeLocalAndWorldPositions() {
//   if (!currentlySelectedPlacedObject.value) { return; }
//   if (!currentlySelectedPlacedObject.value.positionLocal.equals(new THREE.Vector3())) {
//     const selectedEntity = document.getElementById(currentlySelectedPlacedObject.value.uuid) as Entity;
//     currentlySelectedPlacedObject.value.position = selectedEntity.object3D.localToWorld(currentlySelectedPlacedObject.value.positionLocal.clone());
//     currentlySelectedPlacedObject.value.positionLocal = new THREE.Vector3();
//     if (paneParams.value) {
//       paneParams.value['positionGlobal'] = currentlySelectedPlacedObject.value.position;
//       paneParams.value['positionLocal'] = currentlySelectedPlacedObject.value.positionLocal;
//       pane.value?.refresh();
//     }
//   }
// }

// const bus = useEventBus(clickKey);
// const unsubscribe = bus.
onCursorClick((e) => {
  console.log('cursor clicked', e);
  if (currentlySelectedPlacedObject.value) {
    currentlySelectedPlacedObjectId.value = undefined;
    updatePaneSelected();
  }
  if (currentCursorMode.value === 'placeObject') {
    // const position = e.detail.intersection.point.toArray();
    // const orientation = e.detail.intersection.;
    if (!currentCursorIntersection.value) return;
    const transform = intersectionToTransform(currentCursorIntersection.value)
    if (!transform) return;

    placeMovedObject(transform.position, transform.rotation);
    setCursorMode(undefined);
  }
});

onMounted(() => {
  initPaneCreate();
});

</script>

