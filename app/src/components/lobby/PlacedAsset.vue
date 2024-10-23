<template>
  <a-entity>
    <!-- <a-sphere :class="$attrs.class" color="yellow" scale="0.2 0.2 0.2" /> -->
    <a-image @materialtextureloaded="onTextureLoaded" v-if="tagName === 'a-image'" :class="$attrs.class" :src="src" />
    <PdfEntity v-else-if="tagName === 'PdfEntity'" v-model:current-page="currentPage" :src="src"
      :class="$attrs.class" />
    <template v-else-if="tagName === 'a-video'">
      <a-video ref="aVideoTag" :src="`#${generatedId}`" :class="$attrs.class"
        @materialtextureloaded="onVideoTextureLoaded" @materialvideoloadeddata="onVideoTextureLoaded" />
      <video muted ref="videoTag" :id="generatedId" :src="src" />
      <!-- <audio ref="audioTag" :id="`${generatedId}-audioTag`" /> -->
    </template>
    <component rotation="90 0 0" v-else :is="tagName" :src="src" :class="$attrs.class" />
  </a-entity>
</template>
<script setup lang="ts">
import { getAssetUrl } from '@/modules/utils';
import { THREE, type DetailEvent, type Entity } from 'aframe';
import { extensionsToAframeTagsMap, type Asset } from 'schemas';
import { computed, onMounted, onUnmounted, onUpdated, ref, useAttrs, watch } from 'vue';
import { userHasInteracted } from '@/composables/userActivation';
import PdfEntity from './PdfEntity.vue';
const attrs = useAttrs();

onUpdated(() => {
  // console.log('PlacedAsset updated');
})
onMounted(() => {
  // console.log('PlacedAsset mounted');
  // console.log('attrs:', attrs);
  // console.log('props:', props);
  // console.log(videoTag.value);

  // if (videoTag.value && aVideoTag.value) {
  //   const vTag = videoTag.value;
  //   // const audioSourceNode = audioContext.createMediaElementSource(vTag);
  //   const sceneEl = aVideoTag.value.sceneEl!;
  //   //this makes sure we ever only have one audioListener
  //   if (!sceneEl.audioListener) {
  //     sceneEl['audioListener'] = new THREE.AudioListener();
  //     sceneEl.camera && sceneEl.camera.add(sceneEl.audioListener);
  //     sceneEl.addEventListener('camera-set-active', function (evt: any) {
  //       evt.detail.cameraEl.getObject3D('camera').add(sceneEl.audioListener);
  //     });
  //   }
  //   const audioListener = aVideoTag.value.sceneEl['audioListener'] as THREE.AudioListener;
  //   const positionalAudio = new THREE.PositionalAudio(audioListener);
  //   // positionalAudio.setNodeSource(audioSourceNode);
  //   positionalAudio.setMediaElementSource(vTag);
  //   positionalAudio.play();
  //   aVideoTag.value?.setObject3D('posAudio', positionalAudio);
  // }
})
onUnmounted(() => {
  // console.log('PlacedAsset unmounted');
})

const currentPage = ref(1);
const aVideoTag = ref<Entity>();
const videoTag = ref<HTMLVideoElement>();
const audioTag = ref<HTMLAudioElement>();

watch(userHasInteracted, (interacted) => {
  if (interacted) {
    if (!aVideoTag.value) {
      return;
    }
    const videoElement: HTMLVideoElement = aVideoTag.value.components['material']?.material?.map?.source?.data;
    if (!videoElement) {
      console.warn('no videoElement found in a-video');
      return;
    };
    videoElement.play();
  }
})

function onVideoTextureLoaded(evt: DetailEvent<{ src: HTMLVideoElement, texture: THREE.VideoTexture }>) {
  // console.log('videoTexture loaded:', evt);
  const aVideoTag = evt.target;
  const videoElement = evt.detail.src;
  videoElement.loop = true;
  const { videoWidth, videoHeight } = videoElement;
  const ratio = videoWidth / videoHeight;
  aVideoTag.object3D.scale.set(ratio, 1, 1);
  if (userHasInteracted.value) {
    videoElement.play();
  }
}

function onTextureLoaded(event: DetailEvent<{ src: HTMLImageElement, texture: THREE.Texture }>) {
  // console.log('texture loaded:', event);
  const aImageTag = event.target;
  const { width, height } = event.detail.src
  const ratio = width / height;
  aImageTag.object3D.scale.set(ratio, 1, 1);
  return
}

const tagName = computed(() => {
  return extensionsToAframeTagsMap[props.asset.assetFileExtension];
})

const src = computed(() => {
  return getAssetUrl(props.asset.generatedName);
})

const props = defineProps<{
  asset: Asset
}>();

const generatedId = `${props.asset.assetId}-${crypto.randomUUID().substring(0, 8)}`;

</script>