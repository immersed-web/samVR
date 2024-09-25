<template>
  <div class="relative">
    <div class="absolute right-0 z-10 flex flex-col gap-1">
      <div v-if="props.navmeshUrl" class="rounded-bl-lg bg-neutral-50/70 py-1 px-2">
        <label class="flex items-center cursor-pointer select-none">
          <span class="label-text mr-1 font-bold">visa navmesh</span>
          <input type="checkbox" class="toggle toggle-xs" v-model="showNavMesh">
        </label>
      </div>
      <div v-if="transformedSelectedObject"
        class="rounded-l-lg grid grid-cols-[auto_auto] items-center justify-items-end gap-x-2 gap-y-2 font-bold bg-neutral-50/70 py-1 px-2">
        <div class="col-span-2 justify-self-stretch divider text-xs m-0">Position</div>
        <div class="contents" v-if="placedObjectPosition">
          <span class="-mt-1">x</span>
          <OffsetSlider v-model.number="placedObjectPosition[0]" />
          <span class="-mt-1">y</span>
          <OffsetSlider v-model.number="placedObjectPosition[1]" />
          <span class="-mt-1">z</span>
          <OffsetSlider v-model.number="placedObjectPosition[2]" />
        </div>
        <div class="col-span-2 justify-self-stretch divider text-xs m-0">Storlek</div>
        <button class="btn btn-xs col-start-2" v-if="!placedObjectScale" @click="placedObjectScale = [1, 1, 1]">ändra
          storlek</button>
        <template v-else>
          <button class="btn btn-xs col-start-2" @click="placedObjectScale = undefined">originalstorlek</button>
          <span class="-mt-0.5 text-xs">{{ uniformScale }}</span>
          <OffsetSlider v-model.number="uniformScale" />
        </template>
        <div class="col-span-2 justify-self-stretch divider text-xs m-0">Rotation</div>
        <div class="contents" v-if="placedObjectRotation">
          <span class="-mt-1">x</span>
          <OffsetSlider :offset="90" v-model.number="placedObjectRotation[0]" />
          <span class="-mt-1">y</span>
          <OffsetSlider :offset="90" v-model.number="placedObjectRotation[1]" />
          <span class="-mt-1">z</span>
          <OffsetSlider :offset="90" v-model.number="placedObjectRotation[2]" />
        </div>
      </div>
    </div>
    <a-scene embedded class="min-h-96" ref="sceneTag" id="ascene" xr-mode-ui="enabled: false"
      @raycast-update="setCursorIntersection($event.detail)">
      <a-assets timeout="20000">
        <a-asset-item id="icon-font"
          src="https://fonts.gstatic.com/s/materialicons/v70/flUhRq6tzZclQEJ-Vdg-IuiaDsNa.woff" />
      </a-assets>
      <a-entity camera ref="cameraTag" />
      <a-sky :color="skyColor" />
      <slot />

      <!-- The model -->
      <a-entity>
        <a-gltf-model class="raycastable-surface" v-if="props.modelUrl" @model-loaded="onModelLoaded" id="model"
          ref="modelTag" :src="props.modelUrl" @click.stop="triggerCursorClick" />
        <a-gltf-model id="navmesh" class="raycastable-surface" ref="navmeshTag" @model-loaded="onNavMeshLoaded"
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
import { useCurrentCursorIntersection, useSelectedPlacedObject } from '@/composables/vrSpaceComposables';
import OffsetSlider from '../OffsetSlider.vue';
registerAframeComponents();

const vrSpaceStore = useVrSpaceStore();

const { setCursorIntersection, isCursorOnNavmesh, triggerCursorClick } = useCurrentCursorIntersection();
const { transformedSelectedObject, placedObjectPosition, placedObjectScale, placedObjectRotation } = useSelectedPlacedObject();

// const uniformScale = ref(1);
const uniformScale = computed({
  get() {
    return placedObjectScale.value ? placedObjectScale.value[0] : 1
  },
  set(newValue: number) {
    placedObjectScale.value = [newValue, newValue, newValue];
  }
})

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

// const emit = defineEmits<{
//   'raycastClick': [point: [number, number, number]]
//   'raycastHover': [point: [number, number, number]]
//   'screenshot': [canvas: HTMLCanvasElement]
// }>();

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

const modelCenter = new THREE.Vector3();
function onModelLoaded() {
  if (modelTag.value && cameraTag.value) {
    console.log('centering camera on model bbox');
    const obj3D = modelTag.value.getObject3D('mesh');

    const bbox = new THREE.Box3().setFromObject(obj3D);
    bbox.getCenter(modelCenter);
    attachOrbitControls();
  }
}

function attachOrbitControls() {
  if (!cameraTag.value) return;
  cameraTag.value.setAttribute('position', '0 0 0');
  let orbitControlSettings = `autoRotate: true; rotateSpeed: 1; initialPosition: ${modelCenter.x} ${modelCenter.y + 2} ${modelCenter.z + 5};`;
  orbitControlSettings += `target:${modelCenter.x} ${modelCenter.y} ${modelCenter.z};`;
  cameraTag.value.setAttribute('orbit-controls', orbitControlSettings);
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
  camTag.setAttribute('look-controls', { reverseMouseDrag: false, reverseTouchDrag: false, pointerLockEnabled: true, })
  camTag.setAttribute('wasd-controls', { fly: false });
  point[1] += defaultHeightOverGround;
  camTag.object3D.position.set(...point);
  camTag.setAttribute('simple-navmesh-constraint', `navmesh:#${navmeshId.value}; fall:0.5; height: ${defaultHeightOverGround};`);
  const canvas = sceneTag.value!.canvas
  canvas.addEventListener('mousedown', lockMouseOnCanvas);
  window.addEventListener('mouseup', unlock)
}

async function exitFirstPersonView() {
  firstPersonViewActive.value = false;
  const camTag = cameraTag.value;
  if (!camTag) {
    console.error('no cameratag provided');
    return;
  }
  camTag.removeAttribute('look-controls');
  camTag.removeAttribute('wasd-controls');
  camTag.removeAttribute('simple-navmesh-constraint');
  await nextTick();
  attachOrbitControls();
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
  await nextTick();
  // @ts-ignore
  const canvasScreenshot: HTMLCanvasElement = screenshotComponent.getCanvas();
  camTag.object3D.position.copy(savedEntityPos);
  camTag.object3D.rotation.copy(savedEntityRot);
  camTag.getObject3D('camera').position.copy(savedCameraPos);
  camTag.getObject3D('camera').rotation.copy(savedCameraRot);
  navmeshTag.value?.setAttribute('visible', navMeshVisibleRestoreState);
  return canvasScreenshot;
}

function onNavMeshLoaded() {
  // Hack to trigger update of model opacity when its loaded. The aframe model-opacity component doesnt initialize properly for some reason.
  navmeshTag.value?.setAttribute('model-opacity', 'opacity', navMeshOpacity.value);
}

</script>

<style scoped></style>
