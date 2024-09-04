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
    <a-scene embedded class=" min-h-96" ref="sceneTag" id="ascene" xr-mode-ui="enabled: false">
      <a-assets timeout="20000" />
      <a-entity camera ref="cameraTag" />
      <a-sky :color="skyColor" />
      <slot />

      <!-- The model -->
      <a-entity>
        <a-gltf-model v-if="props.modelUrl" @model-loaded="onModelLoaded" id="model" ref="modelTag"
          :src="props.modelUrl" />
        <a-gltf-model id="navmesh" ref="navmeshTag" @model-loaded="onNavMeshLoaded" :visible="showNavMesh"
          :model-opacity="`opacity: ${navMeshOpacity}`" :src="props.navmeshUrl ? props.navmeshUrl : props.modelUrl"
          @raycast-change="onIntersection" @raycast-out="onNoIntersection" @click="on3DClick" />
      </a-entity>
    </a-scene>
  </div>
</template>

<script setup lang="ts">
import { type Scene, type Entity, type DetailEvent, THREE } from 'aframe';
import { ref, watch, computed, onMounted, nextTick } from 'vue';
import { useTimeoutFn } from '@vueuse/core';
import { useVrSpaceStore } from '@/stores/vrSpaceStore';
import registerAframeComponents from '@/ts/aframe/components';
registerAframeComponents();

const vrSpaceStore = useVrSpaceStore();

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
    // the  raycaster seem to keep a reference to the intersected object which leads to us missing "new" intersection after reattaching raycaster-listen.
    // This is a hacky work-around to "reset" the raycasting logic
    sceneTag.value?.setAttribute('raycaster', 'objects', '#navmesh');
    sceneTag.value?.setAttribute('cursor', { fuse: false, rayOrigin: 'mouse' });
    navmeshTag.value?.setAttribute('raycaster-listen', true);
  } else {
    sceneTag.value?.removeAttribute('cursor');
    sceneTag.value?.removeAttribute('raycaster');
    navmeshTag.value?.removeAttribute('raycaster-listen');
  }
});


async function enterFirstPersonView(point: THREE.Vector3Tuple) {
  console.log('enter first person triggered');
  firstPersonViewActive.value = true;
  const camTag = cameraTag.value;
  if (!camTag || !point) {
    console.error('no cameraTag or point provided');
    return;
  }
  camTag.removeAttribute('orbit-controls');
  camTag.setAttribute('look-controls', 'enabled', true);
  camTag.setAttribute('wasd-controls', { fly: false });
  point[1] += 1.7;
  camTag.object3D.position.set(...point);
  camTag.setAttribute('simple-navmesh-constraint', `navmesh:#${navmeshId.value}; fall:0.5; height:1.65;`);
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
}

async function getPanoScreenshotFromPoint(point: THREE.Vector3Tuple) {
  const camTag = cameraTag.value;
  if (!camTag || !point) {
    console.error('no cameraEntity or point provided');
    return;
  }
  const navMeshVisibleRestoreState = navmeshTag.value?.getAttribute('visible');
  navmeshTag.value?.setAttribute('visible', 'false');
  const spawnPosVec3 = new THREE.Vector3(...point);
  spawnPosVec3.y += 1.7;
  // we save all the camera pos and rot stuff so we can restore it afterwards
  const savedEntityPos = camTag.object3D.position.clone();
  const savedEntityRot = camTag.object3D.rotation.clone();
  const savedCameraPos = camTag.getObject3D('camera').position.clone();
  const savedCameraRot = camTag.getObject3D('camera').rotation.clone();
  camTag.object3D.position.copy(spawnPosVec3);
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
