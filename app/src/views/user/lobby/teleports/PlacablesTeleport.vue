<script setup lang="ts">

import { Pane } from 'tweakpane';

import { computed, ref, onMounted, reactive, shallowRef } from 'vue';
import { useEventBus } from '@vueuse/core';
import { clickKey } from '@/composables/oculusSimulator';

import { type DetailEvent, THREE, type Entity } from 'aframe';
import PdfEntity from '@/components/lobby/PdfEntity.vue';

import { useDropZone, useFileDialog } from '@vueuse/core';


import {
  Dialog,
  DialogPanel,
  DialogTitle,
  DialogDescription,
} from '@headlessui/vue';


defineOptions({
  components: { PdfEntity },
});

function arrToCoordString(arr: Array<unknown>) {
  const constructedString = arr.join(' ');
  return constructedString;
}

function threeRotationToAframeRotation(threeRotation: THREE.Vector3Tuple): THREE.Vector3Tuple {
  return [
    THREE.MathUtils.radToDeg(threeRotation[0]),
    THREE.MathUtils.radToDeg(threeRotation[1]),
    THREE.MathUtils.radToDeg(threeRotation[2]),
  ];
}

function quaternionToAframeRotation(quaternion: THREE.Quaternion): THREE.Vector3Tuple {
  const euler = new THREE.Euler().reorder('YXZ').setFromQuaternion(quaternion);
  const arr = euler.toArray() as THREE.Vector3Tuple;
  return threeRotationToAframeRotation(arr);
}

type UUID = ReturnType<typeof crypto.randomUUID>
type placeableAssetTypes = `a-${'image' | 'sphere'}` | 'PdfEntity'; // | typeof PdfEntity;
type PlaceableObject = { uuid: UUID, type: placeableAssetTypes, src: string };
type PlacedObjectList = Array<PlaceableObject & { scale: number, position: THREE.Vector3, positionLocal: THREE.Vector3, rotation: THREE.Vector3Tuple }>

const currentlyMovedObject = shallowRef<PlaceableObject | undefined>();
const currentlySelectedObjectId = ref<UUID | undefined>();
// const currentlySelectedObject = ref<PlacedObjectList[number] | undefined>()
const currentlyMovedEntity = ref<Entity | null>(null);
const currentlySelectedEntity = ref<Entity | null>(null);
const placedObjects = reactive<PlacedObjectList>([
  // { type: 'PdfEntity', src: '/documents/smallpdf_sample.pdf', uuid: crypto.randomUUID(), position: [1, 1.8, -2], rotation: [0, 0, 0] },
  // { type: 'PdfEntity', src: '/documents/compressed.tracemonkey-pldi-09.pdf', uuid: crypto.randomUUID(), position: [-2, 1.8, -2], rotation: [0, 0, 0] },
]);
const currentlySelectedObject = computed(() => {
  return placedObjects.find(obj => obj.uuid === currentlySelectedObjectId.value);
});

type Asset = {
  'assetId': UUID,
  'assetType': placeableAssetTypes,
  'originalFileName': string,
  'generatedName': string,
  'location': string,
  'size': number,
  'mimeType': string,
  'assetFileExtension': string,
  'ownerUserId': UUID,
  'createdAt': string
  'updatedAt': string
}

const assets: Asset[] = [
  {
    'assetId': '7388c2b6-50e5-4c24-8f46-3d06b58e0d19',
    'assetType': 'a-image',
    'originalFileName': 'joey-chacon-edbYu4vxXww-unsplash.jpg',
    'generatedName': 'joey-chacon-edbYu4vxXww-unsplash.jpg',
    'location': '/photos/',
    'size': 349296,
    'mimeType': 'image/png',
    'assetFileExtension': 'png',
    'ownerUserId': '39c64016-6feb-48c9-a83e-0a22f7e6f9f6',
    'createdAt': '2024-06-13T06:45:03.491Z',
    'updatedAt': '2024-06-13T06:45:03.476Z',
  },
  {
    'assetId': '7388c2b6-50e5-4c24-8f46-3d06b58e0d09',
    'assetType': 'PdfEntity',
    'originalFileName': 'smallpdf_sample.pdf',
    'generatedName': 'smallpdf_sample.pdf',
    'location': '/documents/',
    'size': 349296,
    'mimeType': 'application/pdf',
    'assetFileExtension': 'pdf',
    'ownerUserId': '39c64016-6feb-48c9-a83e-0a22f7e6f9f6',
    'createdAt': '2024-06-13T06:45:03.491Z',
    'updatedAt': '2024-06-13T06:45:03.476Z',
  },
  {
    'assetId': '7388c2b6-50e5-4c24-8f46-3d06b58e0d10',
    'assetType': 'a-image',
    'originalFileName': 'vr-kids-0.jpeg',
    'generatedName': 'vr-kids-0.jpeg',
    'location': '/photos/',
    'size': 349296,
    'mimeType': 'image/jpeg',
    'assetFileExtension': 'jpeg',
    'ownerUserId': '39c64016-6feb-48c9-a83e-0a22f7e6f9f6',
    'createdAt': '2024-06-13T06:45:03.491Z',
    'updatedAt': '2024-06-13T06:45:03.476Z',
  },
  {
    'assetId': '7388c2b6-50e5-4c24-8f46-3d06b58e0d11',
    'assetType': 'a-image',
    'originalFileName': 'vr-kids-1.jpeg',
    'generatedName': 'vr-kids-1.jpeg',
    'location': '/photos/',
    'size': 349296,
    'mimeType': 'image/jpeg',
    'assetFileExtension': 'jpeg',
    'ownerUserId': '39c64016-6feb-48c9-a83e-0a22f7e6f9f6',
    'createdAt': '2024-06-13T06:45:03.491Z',
    'updatedAt': '2024-06-13T06:45:03.476Z',
  },
  {
    'assetId': '7388c2b6-50e5-4c24-8f46-3d06b58e0d12',
    'assetType': 'a-image',
    'originalFileName': 'vr-kids-2.jpeg',
    'generatedName': 'vr-kids-2.jpeg',
    'location': '/photos/',
    'size': 349296,
    'mimeType': 'image/jpeg',
    'assetFileExtension': 'jpeg',
    'ownerUserId': '39c64016-6feb-48c9-a83e-0a22f7e6f9f6',
    'createdAt': '2024-06-13T06:45:03.491Z',
    'updatedAt': '2024-06-13T06:45:03.476Z',
  },
  {
    'assetId': '7388c2b6-50e5-4c24-8f46-3d06b58e0d13',
    'assetType': 'a-image',
    'originalFileName': 'vr-kids-3.jpeg',
    'generatedName': 'vr-kids-3.jpeg',
    'location': '/photos/',
    'size': 349296,
    'mimeType': 'image/jpeg',
    'assetFileExtension': 'jpeg',
    'ownerUserId': '39c64016-6feb-48c9-a83e-0a22f7e6f9f6',
    'createdAt': '2024-06-13T06:45:03.491Z',
    'updatedAt': '2024-06-13T06:45:03.476Z',
  },
];

const assetPickerIsOpen = ref(true);

const placedObjectsEntity = ref<Entity>();
function placeMovedObject(cursorObject: THREE.Object3D) {
  if (!currentlyMovedObject.value) return;
  const scale = 1;
  const position = cursorObject.position;
  const positionLocal = new THREE.Vector3();
  const rotation = quaternionToAframeRotation(cursorObject.quaternion);
  placedObjects.push({ ...currentlyMovedObject.value, scale, position, positionLocal, rotation });
  selectEntity(currentlyMovedObject.value.uuid, undefined);
  currentlyMovedObject.value = undefined;
}

function pickAsset(type: placeableAssetTypes, src: string) {
  assetPickerIsOpen.value = false;
  createPlaceableObject(type, src);
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

function createPlaceableObject(type: placeableAssetTypes, src: string) {
  console.log('Place photo', type, src);
  const uuid = crypto.randomUUID();
  const newPlaceableObject: PlaceableObject = {
    uuid,
    src,
    type,
  };
  currentlyMovedObject.value = newPlaceableObject;
}

function repositionSelectedObject() {
  const idx = placedObjects.findIndex(obj => obj.uuid === currentlySelectedObject.value?.uuid);
  if (idx < 0) return;
  const [obj] = placedObjects.splice(idx, 1);
  currentlyMovedObject.value = obj;
}

function removeSelectedObject() {
  if (!currentlySelectedObject.value) { return; }
  removeObject(currentlySelectedObject.value.uuid);
  currentlySelectedObjectId.value = undefined;
}

function removeObject(uuid: UUID) {
  const idx = placedObjects.findIndex(obj => obj.uuid === uuid);
  if (idx < 0) return;
  placedObjects.splice(idx, 1);
  updatePaneSelected();
}

function selectEntity(uuid: UUID, evt: DetailEvent<{ cursorEl: Entity, intersection: THREE.Intersection, mouseEvent: MouseEvent }> | undefined) {
  console.log(uuid);
  console.log(evt);
  console.log('Selected entity', currentlySelectedEntity);
  currentlySelectedObjectId.value = uuid;
  updatePaneSelected();
}

const paneContainer = ref(null);
type PaneParams = { 'scale': number, 'positionGlobal': THREE.Vector3, 'positionLocal': THREE.Vector3, 'rotation': THREE.Vector3 }
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
    const obj = currentlySelectedObject.value;
    if (obj) {

      pane.value = new Pane({ container: paneContainer.value });
      pane.value.title = 'Selected: ' + obj.src;

      paneParams.value = {
        'scale': obj.scale,
        'positionGlobal': obj.position,
        'positionLocal': obj.positionLocal,
        'rotation': new THREE.Vector3(obj.rotation[0], obj.rotation[1], obj.rotation[2]),
      };

      pane.value.addBinding(paneParams.value, 'scale', { label: 'Scale', step: 0.01 }).on('change', (ev) => {
        if (!currentlySelectedObject.value) { return; }
        currentlySelectedObject.value.scale = ev.value;
      });

      pane.value.addBlade({
        view: 'separator',
      });

      pane.value.addBinding(paneParams.value, 'positionGlobal', { label: 'Global position', step: 0.025 }).on('change', (ev) => {
        if (!currentlySelectedObject.value) { return; }
        currentlySelectedObject.value.position = ev.value.clone();
      });

      pane.value.addBinding(paneParams.value, 'positionLocal', { label: 'Local position (fine tune)', step: 0.01 }).on('change', (ev) => {
        if (!currentlySelectedObject.value) { return; }
        currentlySelectedObject.value.positionLocal = ev.value.clone();
        if (ev.last) {
          mergeLocalAndWorldPositions();
        }
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
        if (!currentlySelectedObject.value) { return; }
        currentlySelectedObject.value.rotation = [ev.value.x, ev.value.y, ev.value.z];
      });

      pane.value.addBlade({
        view: 'separator',
      });
      pane.value.addButton({
        label: 'Remove object from scene',   // optional
        title: 'Remove',
      }).on('click', () => {
        removeObject(obj.uuid);
      });

      pane.value.addBlade({
        view: 'separator',
      });

    }
  }
}

function mergeLocalAndWorldPositions() {
  if (!currentlySelectedObject.value) { return; }
  if (!currentlySelectedObject.value.positionLocal.equals(new THREE.Vector3())) {
    const selectedEntity = document.getElementById(currentlySelectedObject.value.uuid) as Entity;
    currentlySelectedObject.value.position = selectedEntity.object3D.localToWorld(currentlySelectedObject.value.positionLocal.clone());
    currentlySelectedObject.value.positionLocal = new THREE.Vector3();
    if (paneParams.value) {
      paneParams.value['positionGlobal'] = currentlySelectedObject.value.position;
      paneParams.value['positionLocal'] = currentlySelectedObject.value.positionLocal;
      pane.value?.refresh();
    }
  }
}

const bus = useEventBus(clickKey);
const unsubscribe = bus.on((e) => {
  if (currentlySelectedObject.value) {
    currentlySelectedObjectId.value = undefined;
    updatePaneSelected();
  }
  if (e.cursorObject) {
    placeMovedObject(e.cursorObject);
  }
});

onMounted(() => {
  initPaneCreate();
});

</script>

<template>
  <div>
    <!-- #region Place objects -->
    <!-- <Teleport to="#tp-ui-left">
      <button class="p-3 text-white rounded-md cursor-pointer bg-zinc-800"
        @click="createPlaceableObject('a-image', '/photos/joey-chacon-edbYu4vxXww-unsplash.jpg')">place photo</button>
      <button class="p-3 text-white rounded-md cursor-pointer bg-zinc-800"
        @click="createPlaceableObject('PdfEntity', '/documents/smallpdf_sample.pdf')">Place pdf</button>
    </Teleport> -->
    <!-- #endregion -->

    <!-- #region Tweakpane UI -->
    <Teleport to="#tp-ui-right">
      <div id="paneContainer" ref="paneContainer" class="flex flex-col gap-1">
        <div id="pane1" />
        <div id="pane2" />
      </div>
    </Teleport>
    <!-- #endregion -->

    <Teleport to="#tp-aframe-cursor">
      <component ref="currentlyMovedEntity" v-if="currentlyMovedObject" :is="currentlyMovedObject.type"
        :src="currentlyMovedObject.src" />
    </Teleport>

    <Teleport to="#tp-aframe-scene">
      <a-entity ref="placedObjectsEntity">
        <a-entity v-for="placedObject in placedObjects" :key="placedObject.uuid"
          :scale="`${placedObject.scale} ${placedObject.scale} ${placedObject.scale}`" :position="placedObject.position"
          :rotation="arrToCoordString(placedObject.rotation)" :id="placedObject.uuid"
          :box-helper="`enabled: ${currentlySelectedObjectId === placedObject.uuid}; color: #ff00ff;`">
          <component @click="selectEntity(placedObject.uuid, $event)" class="clickable"
            :box-helper="`enabled: ${currentlySelectedObjectId === placedObject.uuid};`" :is="placedObject.type"
            :src="placedObject.src" :position="placedObject.positionLocal" />
        </a-entity>
      </a-entity>
    </Teleport>

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
            <!-- <DialogDescription>Pick it!</DialogDescription> -->

            <div class="flex flex-row flex-wrap ">
              <!-- <div v-for="asset in assets.filter(a => a.assetType === 'image')" :key="asset.assetId" -->
              <div v-for="asset in assets" :key="asset.assetId" class="basis-1/4 cursor-pointer p-1"
                @click="pickAsset(asset.assetType, asset.location + asset.generatedName)">
                <div class="card card-compact bg-base-100 shadow-xl">
                  <figure class="h-40">
                    <img v-if="asset.assetType === 'a-image'" :src="asset.location + asset.generatedName">
                    <embed v-if="asset.assetType === 'PdfEntity'" :src="asset.location + asset.generatedName"
                      type="application/pdf" width="100%" height="100%">
                  </figure>
                  <div class="card-body">
                    <p>{{ asset.originalFileName }}</p>
                  </div>
                </div>
              </div>
              <div class="basis-1/4 cursor-pointer p-1 flex items-center justify-center">
                <div class="flex flex-col p-4">
                  <button type="button" class="btn" @click="open">
                    Upload a new asset
                  </button>
                  <!-- <span class="label-text">or drag and drop your files</span> -->
                </div>
              </div>
            </div>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  </div>
</template>

<style scoped>
#paneContainer>* {
  display: inline-block;
}
</style>
