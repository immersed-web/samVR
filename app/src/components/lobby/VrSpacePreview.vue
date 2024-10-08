<template>
  <div class="relative">
    <div class="absolute right-0 z-10 flex flex-col gap-1 lowercase font-bold text-base-content *:bg-base-100/75">
      <div v-if="props.navmeshUrl" class="rounded-bl-lg py-1 px-2">
        <label class="flex items-center justify-between cursor-pointer select-none">
          <span class="label-text mr-1">visa navmesh</span>
          <input type="checkbox" class="toggle toggle-xs" v-model="showNavMesh">
        </label>
      </div>
      <div v-if="transformedSelectedObject"
        class="rounded-l-lg grid grid-cols-[auto_auto] items-center justify-items-center gap-x-2 gap-y-2 py-1 px-2">
        <div class="col-span-2 justify-self-stretch flex items-center gap-2 justify-between">
          <span class="grow self-center divider divider-start text-xs m-0">Position</span>
          <button class="btn btn-xs btn-circle material-icons" @click="startMovingObject">ads_click</button>
        </div>
        <div class="contents" v-if="placedObjectPosition">
          <span class="-mt-1">x</span>
          <OffsetSlider inverted v-model.number="placedObjectPosition[0]" />
          <span class="-mt-1">y</span>
          <OffsetSlider v-model.number="placedObjectPosition[1]" />
          <span class="-mt-1">z</span>
          <OffsetSlider v-model.number="placedObjectPosition[2]" />
        </div>
        <template v-if="transformedSelectedObject.type !== 'vrPortal'">
          <div class="col-span-2 justify-self-stretch flex items-center gap-2 justify-between">
            <span class="grow self-center divider divider-start text-xs m-0">Storlek</span>
            <button class="btn btn-xs btn-circle material-icons"
              @click="placedObjectScale = undefined">restart_alt</button>
          </div>
          <div class="contents">
            <span class=" material-icons">zoom_out_map</span>
            <OffsetSlider :step="0.01" :offset="0.7" v-model.number="uniformScale" />
          </div>
          <div class="col-span-2 justify-self-stretch flex items-center gap-2 justify-between">
            <span class="grow self-center divider divider-start text-xs m-0">Rotation</span>
            <button @click="placedObjectRotation = [0, 0, 0]"
              class="btn btn-xs btn-circle material-icons">restart_alt</button>
          </div>
          <div class="contents" v-if="placedObjectRotation">
            <span class="material-icons">360</span>
            <input type="range" class="accent-primary" min="-180" max="180" v-model.number="placedObjectRotation[1]">
            <!-- <OffsetSlider :offset="90" v-model.number="placedObjectRotation[1]" /> -->
            <span class="rotate-90 material-icons">360</span>
            <input type="range" class="accent-primary" min="-90" max="90" v-model.number="placedObjectRotation[0]">
            <!-- <OffsetSlider :offset="90" v-model.number="placedObjectRotation[0]" /> -->
            <span class="material-icons">refresh</span>
            <input type="range" class="accent-primary" min="-180" max="180" v-model.number="placedObjectRotation[2]">
            <!-- <OffsetSlider :offset="90" v-model.number="placedObjectRotation[2]" /> -->
          </div>
        </template>
        <button class="btn btn-xs btn-error" @click="removeSelectedObject">Radera</button>
      </div>
    </div>
    <a-scene tick-counter @renderstart="onRenderStart" @loaded="onSceneLoaded" embedded class="min-h-96" ref="sceneTag"
      id="ascene" xr-mode-ui="enabled: false" @raycast-update="setCursorIntersection($event.detail)">
      <a-assets timeout="20000">
        <a-asset-item id="icon-font"
          src="https://fonts.gstatic.com/s/materialicons/v70/flUhRq6tzZclQEJ-Vdg-IuiaDsNa.woff" />
      </a-assets>
      <a-entity @loaded="onCameraEntityLoaded" camera ref="cameraTag" />
      <a-sky :color="skyColor" />
      <slot />

      <!-- The model -->
      <a-entity>
        <a-gltf-model bvh :class="{ 'navmesh': !vrSpaceStore.navMeshUrl }" class="raycastable-surface"
          v-if="props.modelUrl" @model-loaded="onModelLoaded" id="model" ref="modelTag" :src="props.modelUrl"
          @click.stop="triggerCursorClick" />
        <a-gltf-model id="navmesh" class="raycastable-surface navmesh" ref="navmeshTag" @model-loaded="onNavMeshLoaded"
          :visible="showNavMesh" :model-opacity="`opacity: ${navMeshOpacity}`"
          :src="props.navmeshUrl ? props.navmeshUrl : props.modelUrl" @click.stop="triggerCursorClick" />
      </a-entity>
    </a-scene>
  </div>
</template>

<script setup lang="ts">
import { type Scene, type Entity, type DetailEvent, THREE } from 'aframe';
import { ref, watch, computed, onMounted, nextTick } from 'vue';
import { useTimeoutFn, usePointerLock } from '@vueuse/core';
import { useVrSpaceStore } from '@/stores/vrSpaceStore';
import registerAframeComponents from '@/ts/aframe/components';
import { defaultHeightOverGround } from 'schemas';
import { useCurrentCursorIntersection, useSelectedPlacedObject, useCurrentlyMovedObject } from '@/composables/vrSpaceComposables';
import OffsetSlider from '../OffsetSlider.vue';
import { ta } from 'date-fns/locale';
registerAframeComponents();

const vrSpaceStore = useVrSpaceStore();

const { setCursorIntersection, isCursorOnNavmesh, triggerCursorClick, setCursorMode } = useCurrentCursorIntersection();
const { selectedPlacedObject, transformedSelectedObject, placedObjectPosition, placedObjectScale, placedObjectRotation } = useSelectedPlacedObject();
const { currentlyMovedObject } = useCurrentlyMovedObject();

const uniformScale = computed<number>({
  get() {
    return placedObjectScale.value ? placedObjectScale.value[0] : 1
  },
  set(newValue: number) {
    placedObjectScale.value = [newValue, newValue, newValue];
  }
})

async function removeSelectedObject() {
  if (!selectedPlacedObject.value) { return; }
  await vrSpaceStore.removePlacedObject(selectedPlacedObject.value.placedObjectId);
  selectedPlacedObject.value = undefined;
}

function startMovingObject() {
  const placedObjectId = selectedPlacedObject.value?.placedObjectId;
  selectedPlacedObject.value = undefined;

  const selectedObjectInVrSpace = vrSpaceStore.currentVrSpace?.dbData.placedObjects.find(po => po.placedObjectId === placedObjectId)
  currentlyMovedObject.value = selectedObjectInVrSpace;
  setCursorMode('place-asset');
}

const { lock, unlock, element } = usePointerLock();

const props = withDefaults(defineProps<{
  modelUrl?: string,
  navmeshUrl?: string,
  autoRotate?: boolean,
  raycastSelector?: string,
}>(), {
  modelUrl: undefined,
  navmeshUrl: undefined,
  autoRotate: true,
  raycastSelector: undefined,
});

onMounted(() => {
  if (props.raycastSelector) {
    attachRaycaster(props.raycastSelector)
  }
});

const firstPersonViewActive = ref(false);

defineExpose({
  getPanoScreenshotFromPoint,
  enterFirstPersonView,
  exitFirstPersonView,
  firstPersonViewActive,
});

// A-frame
const sceneTag = ref<Scene>();
const modelTag = ref<Entity>();
const navmeshTag = ref<Entity>();
const cameraTag = ref<Entity>();

const showNavMesh = ref(false);
const navMeshOpacity = computed(() => {
  return showNavMesh.value ? 0.7 : 0.0;
});

let stopAutoRotateTimeout: ReturnType<typeof useTimeoutFn>['stop'] | undefined = undefined;

watch(() => props.autoRotate, (rotate) => {
  console.log('autorotate updated!');
  if (!rotate) {
    if (stopAutoRotateTimeout) stopAutoRotateTimeout();

    if (cameraTag.value?.getAttribute('orbit-controls')) {
      cameraTag.value!.setAttribute('orbit-controls', 'autoRotate', false);
    }

  } else {
    stopAutoRotateTimeout = useTimeoutFn(() => {
      if (cameraTag.value?.getAttribute('orbit-controls')) {
        cameraTag.value!.setAttribute('orbit-controls', 'autoRotate', true);
      }
    }, 5000).stop;
  }
});

watch(() => props.raycastSelector, (selector) => {
  if (selector) {
    attachRaycaster(selector);
  } else {
    removeRaycaster();
  }
});

function lockMouseOnCanvas() {
  lock(sceneTag.value!.canvas);
}
const navmeshId = computed(() => {
  return vrSpaceStore.currentVrSpace?.dbData.navMeshAssetId !== undefined ? 'navmesh' : 'model';
});

const skyColor = computed(() => {
  const storeSkyColor = vrSpaceStore.currentVrSpace?.dbData.skyColor;
  if (!storeSkyColor) return 'lightskyblue';
  return storeSkyColor;
});

function calculateOrbitTarget() {
  if (!modelTag.value || !cameraTag.value) {
    console.warn('no modelTag or cameraTag provided to calculateOrbitTarget');
    return;
  }
  const spawnPoint = vrSpaceStore.currentVrSpace?.dbData.spawnPosition;
  if (spawnPoint) {
    return new THREE.Vector3(...spawnPoint);
  }
  console.log('centering camera on model bbox');
  const obj3D = modelTag.value.getObject3D('mesh');

  const bbox = new THREE.Box3().setFromObject(obj3D);
  const modelCenter = new THREE.Vector3();
  bbox.getCenter(modelCenter);
  return modelCenter;
}

function onSceneLoaded(event: CustomEvent<unknown>) {
  console.log('scene loaded:', event);
}

function onRenderStart(event: CustomEvent<unknown>) {
  console.log('scene render start:', event);
}

function onModelLoaded(evt: DetailEvent<{ model: THREE.Object3D, format: string }>) {
  // console.log('model loaded', evt);
  const target = calculateOrbitTarget();
  if (!target) {
    console.error('calculateOrbitTarget returned undefined');
    return;
  }
  setTimeout(() => {
    attachOrbitControls(target);
  }, 500);
}

function onCameraEntityLoaded(evt: CustomEvent<unknown>) {
  console.log('camera entity loaded', evt);

}

function attachOrbitControls(target: THREE.Vector3) {
  if (!cameraTag.value) {
    console.warn('no cameraTag provided to attach orbit-controls to');
    return;
  }
  cameraTag.value.setAttribute('position', '0 0 0');
  let orbitControlSettings = `autoRotate: true; rotateSpeed: 1; initialPosition: ${target.x} ${target.y + 2} ${target.z + 5}; `;
  orbitControlSettings += `target:${target.x} ${target.y} ${target.z};`;
  console.log('attaching orbit-controls to camera:', orbitControlSettings);
  cameraTag.value.setAttribute('orbit-controls', orbitControlSettings);
  console.log('cameraTag after attaching orbit-controls:', cameraTag.value);
}

function removeOrbitControls() {
  if (!cameraTag.value) {
    console.warn('no cameraTag provided to remove orbit-controls from');
    return;
  };
  cameraTag.value.removeAttribute('orbit-controls');
}

function attachRaycaster(selector: string) {
  if (!sceneTag.value) {
    console.warn('no sceneTag provided to attach raycaster to');
  }
// console.log('attaching raycaster to scene');
// console.log('scene:', sceneTag.value);
  // the raycaster seem to keep a reference to the intersected object which leads to us missing "new" intersection after reattaching raycaster-listen.
  // This is a hacky work-around to "reset" the raycasting logic
  sceneTag.value?.setAttribute('raycaster', 'objects', selector);
  sceneTag.value?.setAttribute('cursor', { fuse: false, rayOrigin: 'mouse', mouseCursorStylesEnabled: true });
  sceneTag.value?.setAttribute('raycaster-update', true);

}
function removeRaycaster() {
  sceneTag.value?.removeAttribute('cursor');
  sceneTag.value?.removeAttribute('raycaster');
  sceneTag.value?.removeAttribute('raycaster-update');
}

async function enterFirstPersonView(point: THREE.Vector3Tuple) {
  console.log('enter first person triggered');
  firstPersonViewActive.value = true;
  const camTag = cameraTag.value;
  if (!camTag || !point) {
    console.error('no cameraTag or point provided');
    return;
  }
  removeOrbitControls();
  attachFPSComponents(camTag);
  point[1] += defaultHeightOverGround;
  camTag.object3D.position.set(...point);
  const canvas = sceneTag.value!.canvas
  canvas.addEventListener('mousedown', lockMouseOnCanvas);
  window.addEventListener('mouseup', unlock)
}

function attachFPSComponents(camTag: Entity) {
  camTag.setAttribute('look-controls', { reverseMouseDrag: false, reverseTouchDrag: false, pointerLockEnabled: true, })
  camTag.setAttribute('wasd-controls', { fly: false });
  camTag.setAttribute('simple-navmesh-constraint', `navmesh:#${navmeshId.value}; fall:0.5; height: ${defaultHeightOverGround};`);
}

function removeFPSComponents(camTag: Entity) {
  camTag.removeAttribute('look-controls');
  camTag.removeAttribute('wasd-controls');
  camTag.removeAttribute('simple-navmesh-constraint');
}

async function exitFirstPersonView() {
  firstPersonViewActive.value = false;
  const camTag = cameraTag.value;
  if (!camTag) {
    console.error('no cameratag provided');
    return;
  }
  removeFPSComponents(camTag);
  await nextTick();
  const target = calculateOrbitTarget();
  if (target) {
    attachOrbitControls(target);
  }
  const canvas = sceneTag.value!.canvas
  canvas.removeEventListener('mousedown', lockMouseOnCanvas);
  window.removeEventListener('mouseup', unlock)
}

async function getPanoScreenshotFromPoint(point: THREE.Vector3Tuple) {
  const camTag = cameraTag.value;
  if (!camTag || !point) {
    console.error('no cameraEntity or point provided');
    return;
  }
  const navMeshVisibleRestoreState = navmeshTag.value?.getAttribute('visible');
  if (firstPersonViewActive.value) {
    removeFPSComponents(camTag);
  } else {
    removeOrbitControls();
  }

  navmeshTag.value?.setAttribute('visible', 'false');
  const pointAsVector3 = new THREE.Vector3(...point);
  pointAsVector3.y += defaultHeightOverGround;
  // we save all the camera pos and rot stuff so we can restore it afterwards
  const savedEntityPos = camTag.object3D.position.clone();
  const savedEntityRot = camTag.object3D.rotation.clone();
  const savedCameraPos = camTag.getObject3D('camera').position.clone();
  const savedCameraRot = camTag.getObject3D('camera').rotation.clone();
  camTag.object3D.position.copy(pointAsVector3);
  camTag.object3D.rotation.set(0, THREE.MathUtils.degToRad(180), 0);
  camTag.getObject3D('camera').position.set(0, 0, 0);
  camTag.getObject3D('camera').rotation.set(0, 0, 0);
  const screenshotComponent = camTag.sceneEl?.components.screenshot;

  // We need to wait for some components to have their tick called before we take the screenshot.
  // The look-at component is one of them. It needs to tick once to update its orientation towards the camera.
  await sceneTag.value?.components['tick-counter'].waitForTicks(1);
  // await new Promise(resolve => setTimeout(resolve, 0));
  // @ts-ignore
  const canvasScreenshot: HTMLCanvasElement = screenshotComponent.getCanvas();
  camTag.object3D.position.copy(savedEntityPos);
  camTag.object3D.rotation.copy(savedEntityRot);
  camTag.getObject3D('camera').position.copy(savedCameraPos);
  camTag.getObject3D('camera').rotation.copy(savedCameraRot);
  navmeshTag.value?.setAttribute('visible', navMeshVisibleRestoreState);
  if (firstPersonViewActive.value) {
    attachFPSComponents(camTag);
  } else {
    const target = calculateOrbitTarget();
    if (target) {
      attachOrbitControls(target);
    }
  }
  return canvasScreenshot;
}

function onNavMeshLoaded() {
  // Hack to trigger update of model opacity when its loaded. The aframe model-opacity component doesnt initialize properly for some reason.
  navmeshTag.value?.setAttribute('model-opacity', 'opacity', navMeshOpacity.value);
}

</script>

<style scoped></style>
