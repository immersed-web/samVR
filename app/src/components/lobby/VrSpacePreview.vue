<template>
  <div class="relative">
    <div v-if="props.navmeshUrl" class="absolute right-0 z-10 rounded-bl-lg bg-neutral-50/70 py-1 px-2">
      <label class="flex items-center cursor-pointer select-none">
        <span class="label-text mr-1 font-bold">visa navmesh</span>
        <input type="checkbox" class="toggle toggle-xs" v-model="showNavMesh">
      </label>
      <!-- <div>
        <button class="btn btn-xs btn-primary" @click="attachOrbitControls">attach orbitctls</button>
        <button class="btn btn-xs btn-primary" @click="removeOrbitControls">remove orbitctls</button>
      </div>
      <div>
        <button class="btn btn-xs btn-primary" @click="attachFirstPersonComponents">attach fps comps</button>
        <button class="btn btn-xs btn-primary" @click="removeFirstPersonComponents">remove fps comps</button>
      </div> -->
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
        <a-gltf-model class="raycastable" v-if="props.modelUrl" @model-loaded="onModelLoaded" id="model" ref="modelTag"
          :src="props.modelUrl" @click.stop="triggerCursorClick" />
        <a-gltf-model id="navmesh" class="raycastable" ref="navmeshTag" @model-loaded="onNavMeshLoaded"
          :visible="showNavMesh" :model-opacity="`opacity: ${navMeshOpacity}`"
          :src="props.navmeshUrl ? props.navmeshUrl : props.modelUrl" @raycast-change="onIntersection"
          @raycast-out="onNoIntersection" @click.stop="triggerCursorClick" />
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
import { useCurrentCursorIntersection } from '@/composables/vrSpaceComposables';
registerAframeComponents();

const vrSpaceStore = useVrSpaceStore();

const { setCursorIntersection, isCursorOnNavmesh, triggerCursorClick } = useCurrentCursorIntersection();

const { lock, unlock, element } = usePointerLock();

const props = withDefaults(defineProps<{
  modelUrl?: string,
  navmeshUrl?: string,
  autoRotate?: boolean,
  raycast?: boolean,
}>(), {
  modelUrl: undefined,
  navmeshUrl: undefined,
  autoRotate: true,
  raycast: false,
});


const emit = defineEmits<{
  'raycastClick': [point: [number, number, number]]
  'raycastHover': [point: [number, number, number]]
  'screenshot': [canvas: HTMLCanvasElement]
}>();

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
// const spawnPosTag = ref<Entity>();

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

watch(() => props.raycast, (raycast) => {
  if (raycast) {
    // console.log('attaching raycaster to scene');
    // console.log('scene:', sceneTag.value);
    // the  raycaster seem to keep a reference to the intersected object which leads to us missing "new" intersection after reattaching raycaster-listen.
    // This is a hacky work-around to "reset" the raycasting logic
    sceneTag.value?.setAttribute('raycaster', 'objects', '.raycastable');
    sceneTag.value?.setAttribute('cursor', { fuse: false, rayOrigin: 'mouse', mouseCursorStylesEnabled: true });
    sceneTag.value?.setAttribute('raycaster-update', true);

    // navmeshTag.value?.setAttribute('raycaster-listen', true);
  } else {
    sceneTag.value?.removeAttribute('cursor');
    sceneTag.value?.removeAttribute('raycaster');
    sceneTag.value?.removeAttribute('raycaster-update');

    // navmeshTag.value?.removeAttribute('raycaster-listen');
  }
});


function lockCanvas() {
  lock(sceneTag.value!.canvas);
}
async function enterFirstPersonView(point: THREE.Vector3Tuple) {
  console.log('enter first person triggered');
  firstPersonViewActive.value = true;
  const camTag = cameraTag.value;
  if (!camTag || !point) {
    console.error('no cameraTag or point provided');
    return;
  }
  camTag.removeAttribute('orbit-controls');
  camTag.setAttribute('look-controls', { reverseMouseDrag: false, reverseTouchDrag: false, pointerLockEnabled: true, })
  camTag.setAttribute('wasd-controls', { fly: false });
  point[1] += defaultHeightOverGround;
  camTag.object3D.position.set(...point);
  camTag.setAttribute('simple-navmesh-constraint', `navmesh:#${navmeshId.value}; fall:0.5; height: ${defaultHeightOverGround};`);
  const canvas = sceneTag.value!.canvas
  canvas.addEventListener('mousedown', lockCanvas);
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
  canvas.removeEventListener('mousedown', lockCanvas);
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

const navmeshId = computed(() => {
  return vrSpaceStore.currentVrSpace?.dbData.navMeshAssetId !== undefined ? 'navmesh' : 'model';
});

onMounted(() => {
});

const skyColor = computed(() => {
  const storeSkyColor = vrSpaceStore.currentVrSpace?.dbData.skyColor;
  if (!storeSkyColor) return 'lightskyblue';
  return storeSkyColor;
});

function onIntersection(evt: DetailEvent<any>) {
  // console.log('model hovered', evt);
  const point: THREE.Vector3 = evt.detail.intersection.point;
  if (!point) {
    console.error('no point from intersection event');
    return;
  }
  emit('raycastHover', point.toArray());
}

function onNoIntersection(evt: DetailEvent<any>) {
  // console.log('raycast-out');
}

function on3DClick(evt: DetailEvent<{ intersection: { point: THREE.Vector3 } }>) {
  // console.log(evt.detail.intersection);
  emit('raycastClick', evt.detail.intersection.point.toArray());
}

const modelCenter = new THREE.Vector3();
function onModelLoaded(){
  if(modelTag.value && cameraTag.value){
    console.log('centering camera on model bbox');
    const obj3D = modelTag.value.getObject3D('mesh');

    const bbox = new THREE.Box3().setFromObject(obj3D);
    bbox.getCenter(modelCenter);
    attachOrbitControls();
  }
}

function attachFirstPersonComponents() {
  if (!cameraTag.value) return;
  cameraTag.value.setAttribute('look-controls', 'enabled', true);
  cameraTag.value.setAttribute('wasd-controls', { fly: true });
}

function removeFirstPersonComponents() {
  if (!cameraTag.value) return;
  cameraTag.value.removeAttribute('look-controls');
  cameraTag.value.removeAttribute('wasd-controls');
}

function attachOrbitControls() {
  if (!cameraTag.value) return;
  cameraTag.value.setAttribute('position', '0 0 0');
  let orbitControlSettings = `autoRotate: true; rotateSpeed: 1; initialPosition: ${modelCenter.x} ${modelCenter.y + 2} ${modelCenter.z + 5};`;
  orbitControlSettings += `target:${modelCenter.x} ${modelCenter.y} ${modelCenter.z};`;
  cameraTag.value.setAttribute('orbit-controls', orbitControlSettings);
}

function removeOrbitControls() {
  if (!cameraTag.value) return;
  cameraTag.value.removeAttribute('orbit-controls');
  const cameraEntityPos = cameraTag.value.object3D.position;
  const cameraObj3DPos = cameraTag.value.getObject3D('camera').position;
  console.log('camera entity pos:', cameraEntityPos);
  console.log('camera obj3d pos:', cameraObj3DPos);
}

function onNavMeshLoaded() {
  // Hack to trigger update of model opacity when its loaded. The aframe component doesnt initialize properly for some reason.
  navmeshTag.value?.setAttribute('model-opacity', 'opacity', navMeshOpacity.value);
}

</script>

<style scoped></style>
