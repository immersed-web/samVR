<template>
  <Teleport
    v-if="domOutlet"
    :to="domOutlet"
  >
    <div
      class="flex justify-center items-center"
      v-if="!soup.userHasInteracted"
    >
      <button
        class="btn btn-primary btn-lg"
      >
        Starta
      </button>
    </div>
    <div v-else-if="!camera.currentCamera">
      Försöker öppna kameran
    </div>
    <div class="hidden max-w-64 pointer-events-none bg-base-200/35">
      <div class="relative">
        <video
          autoplay
          ref="videoTag1"
          :id="`main-video-1`"
          :class="{'rotate-180': freezeableCameraStore.isRoofMounted}"
          crossorigin="anonymous"
          playsinline
          webkit-playsinline
        />
        <p class="absolute z-50 top-0">
          main-video-1
        </p>
      </div>
      
      <div class="relative">
        <video
          autoplay
          ref="videoTag2"
          :id="`main-video-2`"
          :class="{'rotate-180': freezeableCameraStore.isRoofMounted}"
          crossorigin="anonymous"
          playsinline
          webkit-playsinline
        />
        <p class="absolute z-50 top-0">
          main-video-2
        </p>
      </div>
      <audio
        autoplay
        ref="audioTag"
      />
    </div>
  </Teleport>
  <template v-if="soup.userHasInteracted">
    <a-grid :visible="!freezeableCameraStore.is360Camera" />
    <a-entity
      @loaded="onTemplateReady"
      ref="cameraRigTag"
      id="rig"
    >
      <a-camera
        wasd-controls-enabled="false"
        ref="cameraTag"
        id="camera"
        reverse-mouse-drag="true"
        :look-controls-enabled="!movedPortalCameraId && !isViewOriginMoved && !cameraIsAnimating"
      >
        <a-sky
          :visible="!props.editable"
          ref="curtainTag"
          radius="0.1"
          @loaded="onCurtainLoaded" 
          material="transparent: true; color: black; opacity: 1.0;"
          animation__to_black="property: material.opacity; from: 0.0; to: 1.0; dur: 500; startEvents: fadeToBlack"
          animation__from_black="property: material.opacity; from: 1.0; to: 0.0; dur: 500; startEvents: fadeFromBlack"
        />
        <!-- <a-text
          :visible="debugMessage !== '' || debugMessage !== undefined"
          :value="debugMessage"
          position="0.2 0 -2"
        /> -->
      </a-camera>
      <a-entity
        laser-controls="hand:left"
        raycaster="objects: .clickable"
      />
      <a-entity
        laser-controls="hand:right"
        raycaster="objects: .clickable"
      />
    </a-entity>
    <a-entity 
      :visible="!freezeableCameraStore.is360Camera"
      rotation="0 0 0"
    >
      <a-entity
        :position="`0 ${videoHeight/2} ${-cinemaDistance}`"
      >
        <a-plane 
          ref="aVideoTag"
          :width="fixedWidth"
          :height="videoHeight"
          :rotation="`0 0 ${freezeableCameraStore.isRoofMounted?'180': 0}`"
          scale="1 1 -1"
        />
        <a-entity
          v-for="portal in freezeableCameraStore.portals"
          :key="portal.toCameraId"
          :position="`${(portal.x-0.5)*fixedWidth} ${(-portal.y+0.5)*videoHeight} 0.1`"
        >
          <a-sphere
            hover-highlight
            position="0 0 0"
            color="#ef2d5e"
            scale="0.2 0.2 0.2"
            class="clickable"
            @mousedown="onPortalMouseDown(portal, $event)"
          />
          <!-- <a-entity
            text="value:Hello; color:#FFFFFF; width: 4; align: center; shader: msdf; font:https://raw.githubusercontent.com/etiennepinchon/aframe-fonts/master/fonts/creepster/Creepster-Regular.json;"
            position="0 -0.4 0"
          />      -->
          <a-text
            v-if="portal.cameraName"
            :value="portal.cameraName"
            align="center"
            position="0 -0.4 0"
          />
        </a-entity>
      </a-entity>
    </a-entity>
    <a-entity       
      rotation="0 0 0"
      follow-position="#camera"
    >
      <a-entity
        :visible="freezeableCameraStore.is360Camera"
      >
        <a-entity
          v-if="props.editable"
          :rotation="`${camera.viewOrigin?.angleX} ${camera.viewOrigin?.angleY} 0`"
        >
          <a-ring
            radius-inner="0.1"
            radius-outer="0.2"
            position="0 0 -2"
            color="teal"
            hover-highlight
            material="shader: flat;"
          >
            <a-ring
              radius-inner="0"
              radius-outer="0.2"
              color="yellow"
              material="opacity:0;"
              class="clickable"
              @mousedown="isViewOriginMoved = true"
            />
            <a-text
              position="0 -0.3 0"
              value="startriktning"
              width="2"
              align="center"
            />
          </a-ring>
        </a-entity>
        <a-sphere
          ref="vSphereTag"
          :rotation="`0 90 ${freezeableCameraStore.isRoofMounted? '180': '0'}`"
          :phi-start="freezeableCameraStore.FOV?.phiStart??0"
          :phi-length="freezeableCameraStore.FOV?.phiLength??360"
          radius="20"
          scale="-1 1 1"
        />
        <a-entity
          v-for="portal in freezeableCameraStore.portals"
          :key="portal.toCameraId"
          :rotation="`${portal.angleX} ${portal.angleY} 0`"
        >
          <a-sphere
            :position="`0 0 ${-portal.distance}`"
            scale="0.2 0.2 0.2"
            color="#ef2d5e"
            class="clickable"
            hover-highlight
            @mousedown="onPortalMouseDown(portal, $event)"
          >
            <a-text
              position="0 -1.5 0"
              width="15"
              :value="portal.cameraName"
              align="center"
            />
          </a-sphere>
        </a-entity>
      </a-entity>
    </a-entity>
  </template>
</template>
<script setup lang="ts">
import { useRouter } from 'vue-router';
import { useSoupStore } from '@/stores/soupStore';
import type { CameraId, CameraPortalInsert, StreamId } from 'schemas';
import { onBeforeUnmount, onMounted, ref, shallowRef, watch, inject, computed, nextTick, onBeforeMount } from 'vue';
import { computedWithControl, until } from '@vueuse/core';
import { useStreamStore } from '@/stores/streamStore';
import { useCameraStore } from '@/stores/cameraStore';
import type { Entity, Scene } from 'aframe';
import { useAdminStore } from '@/stores/adminStore';
// import { useAutoEnterXR } from '@/composables/autoEnterXR';
import { aFrameSceneProvideKey } from '@/modules/injectionKeys';
import { THREE } from 'aframe';

const props = withDefaults(defineProps<{
  streamId: StreamId,
  cameraId: CameraId,
  editable?: boolean
}>(), {
  editable: false,
});

defineExpose({
  createOrCenterOnPortal,
});

defineOptions({
  inheritAttrs: false,
});

const { domOutlet, sceneTag } = inject(aFrameSceneProvideKey)!;

const router = useRouter();

const videoTag1 = ref<HTMLVideoElement>();
const videoTag2 = ref<HTMLVideoElement>();
const videoTags = computed(() => {
  return [videoTag1.value, videoTag2.value] as const;
});
const audioTag = ref<HTMLAudioElement>();

// const sceneTag = ref<Scene>();
// useAutoEnterXR(sceneTag);
const vSphereTag = ref<Entity>();
const aVideoTag = ref<Entity>();
const curtainTag = ref<Entity>();

const cameraTag = ref<Entity>();
const cameraRigTag = ref<Entity>();

const soup = useSoupStore();
const streamStore = useStreamStore();
const camera = useCameraStore();

const debugMessage = ref<string>();

// we have some tricks so the (derived) camerastore temporarily ignores updates while teleporting. after teleportation we trigger it and starts reacting to updates again.
const freezeCameraState = ref(false);
watch([camera, freezeCameraState], () => {
  if(!freezeCameraState.value) {
    freezeableCameraStore.trigger();
  }
});
const freezeableCameraStore = computedWithControl(()=> undefined, () => {
  // console.log('persistedCamera triggered');
  // NOTE: we cant simply wrap the whole camera store in a computedWithControl for some reason I dont have time to look into.
  // Instead we here return the separate parts of the store we actually need
  return {currentCamera: camera.currentCamera, FOV: camera.FOV, portals: camera.portals, is360Camera: camera.is360Camera, isRoofMounted: camera.isRoofMounted };
});

watch(() => freezeableCameraStore.value.currentCamera?.producers, (newVal, oldVal) => {
  if (!oldVal) return;
  console.log('oldProducers:', oldVal, 'newProducers:', newVal);
  console.log('producers changed. Consuming camera again');
  consumeAndHandleResult();
})

let activeVideoTagIndex = 1; // Since we switch _before_ retrieving video stream we set initial value to the second videotag so it will switch to first videotag on pageload. Yes, its a bit hacky :-)
const activeVideoTag = shallowRef<HTMLVideoElement>();

async function consumeAndHandleResult() {
  ++activeVideoTagIndex;
  activeVideoTagIndex %= 2;
  const vtag = videoTags.value[activeVideoTagIndex];
  activeVideoTag.value = vtag;
  const rcvdTracks = await camera.consumeCurrentCamera();
  // console.log(videoTags.value);
  if(!vtag) {
    console.error('no vtag found in consumeAndHandleResult! Returning');
    return;
  }

  if(!rcvdTracks?.videoTrack && !import.meta.env.DEV ){
    console.error('no videotrack from camera');
    return;
  }
  if(!rcvdTracks?.videoTrack){
    console.warn('falling back to using demo video because we are in dev mode');
    vtag.muted = true;
    vtag.loop = true;
    vtag.srcObject = null;
    vtag.setAttribute('crossorigin', 'anonymous');
    // videoTag.src = 'https://cdn.bitmovin.com/content/assets/playhouse-vr/progressive.mp4';
    // videoTag.src = 'https://bitmovin.com/player-content/playhouse-vr/progressive.mp4';
    // vtag.src = 'https://video.360cities.net/aeropicture/01944711_VIDEO_0520_1_H264-1920x960.mp4';
    vtag.src = testVideos[activeVideoTagIndex];
  }else{
    vtag.muted = false;
    vtag.loop = false;
    vtag.srcObject = new MediaStream([rcvdTracks.videoTrack]);
  }
  // console.log('vTag', vtag);
  try {
    await vtag.play();
    console.log('play promise resolved');
    onCurtainStateChanged();
    // vtag.addEventListener('playing', () => {
    //   console.log('playing event triggered.');
    //   onCurtainStateChanged();
    // }, {once: true});
  } catch(e:unknown) {
    console.warn('failed to call play on videoelelement');
  }
  if(rcvdTracks?.audioTrack && audioTag.value){
    audioTag.value.srcObject = new MediaStream([rcvdTracks.audioTrack]);
  }
}

let fallbackTimeout: ReturnType<typeof setTimeout> | undefined = undefined;
function onCurtainStateChanged() {
  console.log(activeVideoTag.value?.paused);
  console.log(activeVideoTag.value?.id);
  if(!activeVideoTag.value || activeVideoTag.value.paused){
    console.log('video not playing yet!');
  }
  if(!activeVideoTag.value || activeVideoTag.value.paused
    || isFadingToBlack 
    // || isZoomingInOnPortal 
  ){
    // console.log('not yet ready to reveal after portal jump. returning');
    clearTimeout(fallbackTimeout);
    fallbackTimeout = setTimeout(() => {
      console.warn('FALLBACK FADE TRIGGERED because we never reached a ready state for curtain animations');
      prepareSceneAndFadeFromBlack();
    }, 7000);
    return;
  }
  clearTimeout(fallbackTimeout);
  prepareSceneAndFadeFromBlack();
}

function prepareSceneAndFadeFromBlack(){
  console.log('preparing environment after portal jump');

  freezeCameraState.value = false;
  // console.log('offsetting vieworigin:', camera.viewOrigin);
  if(props.editable){
    cameraRigTag.value?.setAttribute('rotation', '0 0 0');
    if(camera.is360Camera){
      setCameraRotation(camera.viewOrigin!.angleX, camera.viewOrigin!.angleY);
    } else {
      setCameraRotation(0,0);
    }
  } else {
    if(camera.is360Camera){
      cameraRigTag.value?.setAttribute('rotation', `0 ${camera.viewOrigin?.angleY??0} 0`);
    } else {
      cameraRigTag.value?.setAttribute('rotation', '0 0 0');
    }
    setCameraRotation(0,0);
  }
  // createVideoMaterials();
  attachVideoMaterial();

  setVideoDimensionsFromTag(activeVideoTag.value!);
  
  cameraRigTag.value?.object3D.position.set(0,0,0);
  
  curtainTag.value?.emit('fadeFromBlack');
}

const cinemaDistance = ref(4);
const fixedWidth = 10;
const videoHeight = ref(1.0);
function setVideoDimensionsFromTag(vTag: HTMLVideoElement){
  const w = vTag.videoWidth;
  const h = vTag.videoHeight;
  // console.log(w,h);
  const ratio = w / h;
  videoHeight.value = fixedWidth/ratio;
}

const templateIsReady = ref(false);
function onTemplateReady() {
  console.log('cameraView template ready');
  templateIsReady.value = true;
}

async function onCameraSwitch(){
  console.log('camera switched');
  await camera.joinCamera(props.cameraId);
  console.log('joined camera');
  consumeAndHandleResult();
}

type ComputedPortal = Exclude<typeof camera.portals, undefined>[CameraId]
function onPortalMouseDown(portal: ComputedPortal, evt: MouseEvent){
  if(props.editable){
    // Start entity move
    movedPortalCameraId.value = portal.toCameraId;
    console.log('clicked portal while in edit mode');
  } else {
    // teleport
    teleportToCamera(portal.toCameraId, evt);
  }
}
// These will hold the play state of the animations.
let isFadingToBlack = false;
// let isZoomingInOnPortal = false;
function teleportToCamera(cameraId: CameraId, event: Event) {
  freezeCameraState.value = true;
  activeVideoTag.value?.pause();
  isFadingToBlack = true;
  curtainTag.value?.emit('fadeToBlack');
  (curtainTag.value as HTMLElement).addEventListener('animationcomplete__to_black', () => {
    console.log('fade to black animation complete');
    isFadingToBlack = false;
    onCurtainStateChanged();
  }, {once: true});

  // Move/zoom animation -----
  const clickedPortal = event.currentTarget as Entity;
  const portalPos = new THREE.Vector3();
  clickedPortal.object3D.getWorldPosition(portalPos);
  const cameraPos = new THREE.Vector3();
  cameraTag.value?.object3D.getWorldPosition(cameraPos);
  const dir = new THREE.Vector3();
  dir.subVectors(portalPos, cameraPos);//.setLength(vSphereRadius-0.2);
  dir.multiplyScalar(0.8);
  //ZOOM ANIMATION
  // const animationString = `property: position; to: ${dir.x} ${dir.y} ${dir.z}; dur: 500; easing:easeInQuad;`;
  // isZoomingInOnPortal = true;
  // cameraRigTag.value?.setAttribute('animation', animationString);
  // (cameraRigTag.value as HTMLElement)?.addEventListener('animationcomplete', () => {
  //   console.log('zoom animation complete');
  //   isZoomingInOnPortal = false;
  //   onCurtainStateChanged();
  // }, {once: true});
  // //ZOOM ANIMATION END
  // const sphereShrinkAnimationString = `property: geometry.radius; to: ${dir.length()}; dur: 500; easing: easeInQuad;`;
  // vSphereTag.value?.setAttribute('animation', sphereShrinkAnimationString);

  
  console.log('go to new camera:', cameraId);
  router.replace({ name: 'userCamera', params: { streamId: props.streamId, cameraId } });
}

const cameraIsAnimating = ref(false);
async function createOrCenterOnPortal(cameraId:CameraId){
  if(!camera.portals || !camera.currentCamera) return;
  const foundPortal = camera.portals[cameraId];
  const cTag = cameraTag.value;
  if(!cTag){
    console.error('cameraTag ref not set');
    return;
  }
  if(foundPortal){
    console.log('portal already exists');
    cameraIsAnimating.value = true;
    // cTag.setAttribute('look-controls', {enabled: false});

    // enforce y angle is in the range 0 - 360
    // js %-operator is remainder operator and not true modulus. I.E. it doesnt wrap negative input.
    const rot = cTag.object3D.rotation;
    const twoPI = 2 * Math.PI;
    rot.y = THREE.MathUtils.euclideanModulo(rot.y, twoPI);

    const toDegrees = THREE.MathUtils.radToDeg;
    let angleX = foundPortal.angleX;
    let angleY = foundPortal.angleY;
    if(!camera.is360Camera){
      const tlCornerPos = new THREE.Vector3(-fixedWidth/2, videoHeight.value, -cinemaDistance.value);
      const portalPos = tlCornerPos.add(new THREE.Vector3(foundPortal.x * fixedWidth, -foundPortal.y*videoHeight.value, 0));

      // Compensate for cameraHeight
      const cameraYPos = cTag.object3D.position.y;
      portalPos.y -= cameraYPos;
      
      console.log(portalPos);
      angleY = toDegrees(Math.atan2(-portalPos.x, -portalPos.z));
      angleX = toDegrees(Math.atan2(portalPos.y, -portalPos.z));
    }
    // hack to make sure rotation animation takes shortest path. aframe doesnt handle this for us so we must make sure ourselves.
    const angleDelta = angleY - toDegrees(rot.y);
    // console.log('angleDelta:', angleDelta);
    if(Math.abs(angleDelta) > 180){
      // console.log('from rotation  was tweaked');
      rot.y += twoPI * Math.sign(angleDelta);
    }
    const rotationString = `property: rotation; from: ${toDegrees(rot.x)} ${toDegrees(rot.y)} 0; to: ${angleX} ${angleY} 0;`;
    console.log('rotationString:', rotationString);
    cTag.setAttribute('animation', rotationString);

    (cTag as HTMLElement).addEventListener('animationcomplete', () => {
      if(!cTag) return;
      const newRotation = cTag.getAttribute('rotation');
      // @ts-ignore
      cTag.components['look-controls'].pitchObject.rotation.x = THREE.MathUtils.degToRad(newRotation.x);
      // @ts-ignore
      cTag.components['look-controls'].yawObject.rotation.y = THREE.MathUtils.degToRad(newRotation.y);
      // cTag.setAttribute('look-controls', {enabled: true});
      cTag.removeAttribute('animation');
      cameraIsAnimating.value = false;
    }, {once: true});
  }else{
    // Create a new portal
    const cameraRotation = cTag.object3D.rotation;
    const portalCoords = camera.utils.anglesToCoords({angleX: THREE.MathUtils.radToDeg(cameraRotation.x), angleY: THREE.MathUtils.radToDeg(cameraRotation.y)});
    console.log(portalCoords);
    const adminStore = useAdminStore();
    adminStore.setPortal({
      fromCameraId: camera.currentCamera.cameraId,
      toCameraId: cameraId,
      distance: 4,
      x: portalCoords.x,
      y: portalCoords.y,
    });
  }
}

const testVideos = [
  'https://video.360cities.net/fotonio/01939793_Barcelona_360VR_Time_Lapse_Playa-1920x960.mp4',
  'https://video.360cities.net/aeropicture/01944711_VIDEO_0520_1_H264-1920x960.mp4',
];

function setCameraRotation(angleX: number, angleY: number){
  if(!cameraTag.value) return;
  const cTag = cameraTag.value;
  cTag.setAttribute('look-controls', {enabled: false});
  // @ts-ignore
  cTag.components['look-controls'].pitchObject.rotation.x = THREE.MathUtils.degToRad(angleX);
  // @ts-ignore
  cTag.components['look-controls'].yawObject.rotation.y = THREE.MathUtils.degToRad(angleY);
  cTag.setAttribute('look-controls', {enabled: true});
}

watch(() => props.cameraId, () => {
  console.log('cameraId updated');
  // if(!templateIsReady.value) {    
  //   const stop = watch(templateIsReady, (templateReady) => {
  //     if(templateReady){
  //       onCameraSwitch();

  //       stop();
  //     }
  //   });
  //   return;
  // }
  onCameraSwitch();
}, {
  immediate: false,
});

onBeforeMount(async () => {
  console.log('onBeforeMount');
  if (!streamStore.currentStream) {
    await streamStore.loadAndJoinStream(props.streamId);
  }
  if(!soup.deviceLoaded){
    await soup.loadDevice();
  }
  await soup.createReceiveTransport();
  // await camera.joinCamera(props.cameraId);
  await until(templateIsReady).toBeTruthy();
  console.log('beforemount waited and got template ready');
  createVideoMaterials();
  onCameraSwitch();
});

onMounted(async () => {
  console.log('mounted');

  sceneTag.value?.setAttribute('raycaster', {objects: '.clickable'});
  sceneTag.value?.setAttribute('cursor', {fuse:false, rayOrigin: 'mouse'});
  sceneTag.value?.setAttribute('xr-mode-ui', {enabled: !props.editable});
  sceneTag.value?.setAttribute('background', {color: '#090F14' });

  document.addEventListener('mouseup', onMouseUp);
  document.addEventListener('pointermove', onMouseMove);
});

let videoTextures: [THREE.VideoTexture | undefined, THREE.VideoTexture | undefined] = [undefined, undefined];
let videoMaterials: [THREE.MeshBasicMaterial | undefined, THREE.MeshBasicMaterial | undefined] = [undefined, undefined];
function createVideoMaterials() {
  console.log('creating videoMaterials!');
  videoTags.value.forEach((vTag, i) => {
    if(!vTag){
      console.error('videotag was undefined');
      return;
    }

    videoTextures[i] = new THREE.VideoTexture(vTag);
    // @ts-ignore
    videoTextures[i].colorSpace = THREE.SRGBColorSpace;
    videoMaterials[i] = new THREE.MeshBasicMaterial({
      side: THREE.BackSide,
      map: videoTextures[i],
    });
  });
}
function attachVideoMaterial() {
  const material = videoMaterials[activeVideoTagIndex];
  if(!material) {
    console.error('no material for activeVideoTagIndex!');
    return;
  }
  const videoSphereMesh = vSphereTag.value?.getObject3D('mesh') as THREE.Mesh | undefined;
  if(videoSphereMesh && videoSphereMesh.isMesh){
    videoSphereMesh.material = material;
  } else {
    console.error('no mesh found in the vSphere');
  }
  
  const videoPlaneMesh = aVideoTag.value?.getObject3D('mesh') as THREE.Mesh | undefined;
  if(videoPlaneMesh && videoPlaneMesh.isMesh) {
    videoPlaneMesh.material = material;
  } else {
    console.error('no mesh found in the videoplane');
  }
}

function disposeVideoMaterials() {
  videoMaterials.forEach((material, i) => {

    if(!material) {
      console.error('material undefined when trying to dispose');
      return;
    }
    material.map = null;
    material?.dispose();
    material = undefined;
  });
  videoTextures.forEach((texture, i) => { 
    if(!texture) {
      console.error('texture undefined when trying to dispose');
      return;
    }
    texture?.dispose();
    texture = undefined;
  });
}

function onCurtainLoaded() {
  console.log('curtain loaded');
  return;
}

onBeforeUnmount(() => {
  document.removeEventListener('mouseup', onMouseUp);
  document.removeEventListener('pointermove', onMouseMove);
  sceneTag.value?.removeAttribute('raycaster');
  sceneTag.value?.removeAttribute('cursor');
  sceneTag.value?.removeAttribute('xr-mode-ui');
  sceneTag.value?.removeAttribute('background');
  disposeVideoMaterials();

  console.log('gonna unmount cameraView');
  videoTags.value.forEach(vtag => vtag?.pause());
  if(camera.currentCamera){
    console.log('Leaving camera');
    camera.leaveCurrentCamera();
  }
});

const movedPortalCameraId = ref<CameraId>();
let isViewOriginMoved = ref(false);
// TODO: Perhaps calculate pixelToRayAngles to make the objects forllow mouse correctly
// Can perhaps somehow be achieved by using the raycaster provided by the cursor component, or building our own component.
function onMouseMove(ev: MouseEvent){
  const xSpeed = 0.0004;
  const ySpeed = 0.0008;
  // console.log(ev);
  if(!camera.currentCamera) return;
  if (isViewOriginMoved.value){
    const newX = camera.currentCamera.viewOrigin.x + ev.movementX * xSpeed;
    camera.currentCamera.viewOrigin.x = (1.0 + newX) % 1.0;
    camera.currentCamera.viewOrigin.y += ev.movementY * ySpeed;
  } else
    if(movedPortalCameraId.value) {
      const newX = camera.currentCamera.portals[movedPortalCameraId.value].x + ev.movementX * xSpeed;
      camera.currentCamera.portals[movedPortalCameraId.value].x = (1.0 + newX) % 1.0;
      camera.currentCamera.portals[movedPortalCameraId.value].y += ev.movementY * ySpeed;
    }
}

function onMouseUp(evt: Event){
  if(!(evt instanceof MouseEvent) || !props.editable) return;
  const adminStore = useAdminStore();

  console.log('mouseup', evt);
  if(movedPortalCameraId.value && camera.currentCamera){
    const portal = camera.currentCamera.portals[movedPortalCameraId.value];
    const data: CameraPortalInsert = {
      fromCameraId: camera.currentCamera.cameraId,
      ...portal,
    };
    console.log('setting portal:', data);
    adminStore.setPortal(data);
  } else if(isViewOriginMoved.value) {
    adminStore.updateCamera({ cameraId: camera.currentCamera!.cameraId, viewOriginX: camera.currentCamera?.viewOrigin.x, viewOriginY: camera.currentCamera?.viewOrigin.y }, 'view origin');
  }
  movedPortalCameraId.value = undefined;
  isViewOriginMoved.value = false;
}

</script>