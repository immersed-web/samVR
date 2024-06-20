<template>
  <div class="relative">
    <div v-if="props.navmeshUrl" class="absolute right-0 z-10 rounded-bl-lg bg-neutral-50/70 py-1 px-2">
      <label class="flex items-center cursor-pointer select-none">
        <span class="label-text mr-1 font-bold">visa navmesh</span>
        <input type="checkbox" class="toggle toggle-xs" v-model="showNavMesh">
      </label>
      <!-- <button class="btn btn-xs btn-primary" @click="screenShot">screenshot</button> -->
    </div>
    <a-scene embedded ref="sceneTag" id="ascene" xr-mode-ui="enabled: false">
      <a-assets timeout="20000">
        <!-- <a-asset-item
        id="model-asset"
        :src="props.modelUrl"
      />
      <a-asset-item
        v-if="props.navmeshUrl"
        id="navmesh-asset"
        :src="props.navmeshUrl"
      /> -->
      </a-assets>
      <!-- <StreamEntrance
        v-if="entrancePosString"
        :position="entrancePosString"
        :direction="entranceRotation"
        message="Till kameror"
      /> -->
      <slot />
      <!-- <a-entity ref="spawnPosTag" v-if="spawnPosString" :position="spawnPosString">
        <a-circle color="yellow" transparent="true" opacity="0.5" rotation="-90 0 0" position="0 0.05 0"
          :radius="vrSpaceStore.currentVrSpace?.dbData.spawnRadius" />
        <a-icosahedron v-if="vrSpaceStore.currentVrSpace?.dbData.panoramicPreview" detail="3" scale="-0.5 -0.5 -0.5"
          :material="`shader: pano-portal-dither; src: ${getAssetUrl(vrSpaceStore.currentVrSpace?.dbData.panoramicPreview?.generatedName)}`">
        </a-icosahedron>
      </a-entity> -->

      <!-- for some super weird reason orbit controls doesnt work with the a-camera primitive  -->
      <a-entity camera ref="cameraTag" />
      <a-sky :color="skyColor" />

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
import { ref, watch, computed, onMounted } from 'vue';
import { getAssetUrl } from '@/modules/utils';
import { useTimeoutFn } from '@vueuse/core';
import { useVrSpaceStore } from '@/stores/vrSpaceStore';
import c from '@/ts/aframe/components';
c.registerAframeComponents();

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

defineExpose({
  getPanoScreenshotFromPoint
})

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
  if (!rotate) {
    if (stopAutoRotateTimeout) stopAutoRotateTimeout();
    if (!navmeshTag.value) console.error('navmeshTag undefined');

    cameraTag.value!.setAttribute('orbit-controls', 'autoRotate', false);
  } else {
    stopAutoRotateTimeout = useTimeoutFn(() => {
      cameraTag.value!.setAttribute('orbit-controls', 'autoRotate', true);
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
})

async function getPanoScreenshotFromPoint(point: THREE.Vector3Tuple) {
  if (!sceneTag.value || !point) {
    console.error('no scene or point provided');
    return;
  }
  // spawnPosTag.value.setAttribute('visible', 'false');
  const navMeshVisibleRestoreState = navmeshTag.value?.getAttribute('visible');
  navmeshTag.value?.setAttribute('visible', 'false');
  const spawnPosVec3 = new THREE.Vector3(...point);
  spawnPosVec3.y += 1.7;
  const savedPos = sceneTag.value.camera.position.clone();
  sceneTag.value.camera.position.copy(spawnPosVec3)
  const screenshotComponent = sceneTag.value.components.screenshot;
  // @ts-ignore
  const canvasScreenshot: HTMLCanvasElement = screenshotComponent.getCanvas();
  sceneTag.value.camera.position.copy(savedPos);
  // spawnPosTag.value.setAttribute('visible', 'true');
  navmeshTag.value?.setAttribute('visible', navMeshVisibleRestoreState);
  return canvasScreenshot
  // emit('screenshot', canvasScreenshot);
}

// const entrancePosString = computed(() => {
//   const posArr = streamStore.currentStream?.vrSpace?.virtualSpace3DModel?.entrancePosition;
//   if(!posArr) return undefined;
//   const v = new AFRAME.THREE.Vector3(...posArr as [number, number, number]);
//   return AFRAME.utils.coordinates.stringify(v);
// });

// const entranceRotation = computed(() => {
//   if (!streamStore.currentStream?.vrSpace?.virtualSpace3DModel?.entranceRotation) return 0;
//   return streamStore.currentStream.vrSpace.virtualSpace3DModel.entranceRotation;
// });

onMounted(() => {
})

// const spawnPosition = ref<THREE.Vector3Tuple>();
// const spawnPosString = computed(() => {
//   const posArr = spawnPosition.value;
//   if (!posArr) return undefined;
//   const v = new AFRAME.THREE.Vector3(...posArr as [number, number, number]);
//   return AFRAME.utils.coordinates.stringify(v);
// });

const skyColor = computed(() => {
  const storeSkyColor = vrSpaceStore.currentVrSpace?.dbData.skyColor
  if (!storeSkyColor) return 'lightskyblue'
  return storeSkyColor;
})

function onIntersection(evt: DetailEvent<any>) {
  // console.log('model hovered', evt);
  const point: THREE.Vector3 = evt.detail.intersection.point;
  if (!point) {
    console.error('no point from intersection event');
    return;
  }
  emit('raycastHover', point.toArray());
  // if (props.cursorTarget === 'spawnPosition') {
  //   // console.log('intersect while spawnpointing');
  //   spawnPosition.value = point.toArray();
  //   // if (vrSpaceStore.writableVrSpaceState?.dbData.spawnPosition) {
  //   //   // vrSpaceStore.writableVrSpaceState.dbData.spawnPosition = point.toArray();
  //   // }
  // }
  // if (props.cursorTarget === 'entrancePosition') {
  //   if (vrSpaceStore.currentStream?.vrSpace?.virtualSpace3DModel) {
  //     vrSpaceStore.currentStream.vrSpace.virtualSpace3DModel.entrancePosition = point.toArray();
  //   }
  // }
  // if(!cursorTag.value) return;
  // cursorTag.value?.setAttribute('visible', props.isCursorActive); 
  // cursorTag.value.object3D.position.set(...point.toArray());
}

function onNoIntersection(evt: DetailEvent<any>) {
  console.log('raycast-out');
}

function on3DClick(evt: DetailEvent<{ intersection: { point: THREE.Vector3 } }>) {
  console.log(evt.detail.intersection);
  // switch (props.cursorTarget) {
  //   case 'spawnPosition':
  //     // getPanoScreenShotFromPoint();
  //     break;
  //   case 'selfPlacement':
  //     console.log('placing self');
  //     break;
  // }
  emit('raycastClick', evt.detail.intersection.point.toArray());
}

function onModelLoaded(){
  if(modelTag.value && cameraTag.value){
    console.log('centering camera on model bbox');
    // const obj3D = modelTag.value.components.mesh;
    // const obj3D = modelTag.value.object3DMap;
    const obj3D = modelTag.value.getObject3D('mesh');
    console.log(obj3D);
    
    const bbox = new THREE.Box3().setFromObject(obj3D);
    const modelCenter = bbox.getCenter(new THREE.Vector3());
    // cameraTag.value.object3D.position.set(modelCenter.x, modelCenter.y, modelCenter.z);

    let orbitControlSettings = `autoRotate: true; rotateSpeed: 1; initialPosition: ${modelCenter.x} ${modelCenter.y+2} ${modelCenter.z+5};`;
    orbitControlSettings += `target:${modelCenter.x} ${modelCenter.y} ${modelCenter.z};`;
    cameraTag.value.setAttribute('orbit-controls', orbitControlSettings);
  }
}

function onNavMeshLoaded() {
  // Hack to trigger update of model opacity when its loaded. The aframe component doesnt initialize properly for some reason.
  navmeshTag.value?.setAttribute('model-opacity', 'opacity', navMeshOpacity.value);
}

</script>

<style scoped>

#ascene {
  height: 0;
  padding-top: 56.25%;
}

</style>
