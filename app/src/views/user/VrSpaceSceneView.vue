<template>
  <div>
    <div class="min-h-screen z-0">
      <h2>VrSpace main scene</h2>
      <div class="pointer-events-none *:pointer-events-auto" ref="domOutlet" id="aframe-dom-outlet" />
      <WaitForAframe>
        <a-scene ref="sceneTag">
          <VrAFrame v-if="vrSpaceStore.worldModelUrl" :show-nav-mesh="true" />
        </a-scene>
      </WaitForAframe>
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
import WaitForAframe from '@/components/WaitForAframe.vue';

const vrSpaceStore = useVrSpaceStore();

const props = defineProps<{
  vrSpaceId: VrSpaceId
}>()
const sceneTag = ref<Scene>();
const domOutlet = ref<HTMLDivElement>();
provide(aFrameSceneProvideKey, { sceneTag, domOutlet });

// const sceneReady = ref(false);
// function onWrapperSceneLoaded() {
//   sceneReady.value = true;
// }

onBeforeMount(async () => {
  await vrSpaceStore.enterVrSpace(props.vrSpaceId);
});

</script>

