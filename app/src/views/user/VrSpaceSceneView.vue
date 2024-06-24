<template>
  <div>
    <div class="min-h-screen z-0">
      <h2>VrSpace main scene</h2>
      <div class="pointer-events-none *:pointer-events-auto" ref="domOutlet" id="aframe-dom-outlet" />
      <h2 v-if="!aframeLoaded">laddar...</h2>
      <a-scene v-else @loaded="onWrapperSceneLoaded" ref="sceneTag">
        <VrAFrame v-if="sceneReady && vrSpaceStore.worldModelUrl" :show-nav-mesh="true" />
      </a-scene>
    </div>
  </div>
</template>

<script setup lang="ts">
// import { onMounted } from 'vue';
import { aFrameSceneProvideKey } from '@/modules/injectionKeys';
import VrAFrame from '../../components/lobby/VrAFrame.vue';
import { useVrSpaceStore } from '@/stores/vrSpaceStore';
import type { VrSpaceId } from 'schemas';
import { onBeforeMount, provide, ref } from 'vue';
import type { Scene } from 'aframe';

const vrSpaceStore = useVrSpaceStore();

const props = defineProps<{
  vrSpaceId: VrSpaceId
}>()
const sceneTag = ref<Scene>();
const domOutlet = ref<HTMLDivElement>();
provide(aFrameSceneProvideKey, { sceneTag, domOutlet });

const sceneReady = ref(false);
function onWrapperSceneLoaded() {
  sceneReady.value = true;
}

const aframeLoaded = ref(false);
onBeforeMount(async () => {
  await import('aframe');
  const { default: c } = await import('@/ts/aframe/components');
  c.registerAframeComponents();
  aframeLoaded.value = true;
})

onBeforeMount(async () => {
  await vrSpaceStore.enterVrSpace(props.vrSpaceId);
});

</script>

