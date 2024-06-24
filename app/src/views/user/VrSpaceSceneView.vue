<template>
  <div>
    <div class="min-h-screen z-0">
      <h2>VrSpace main scene</h2>
      <div class="pointer-events-none *:pointer-events-auto" ref="domOutlet" id="aframe-dom-outlet" />
      <a-scene ref="sceneTag">
        <VrAFrame v-if="vrSpaceStore.worldModelUrl" :show-nav-mesh="false" />
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

onBeforeMount(async () => {
  await import('aframe');
  const { default: c } = await import('@/ts/aframe/components');
  c.registerAframeComponents();
})

onBeforeMount(async () => {
  await vrSpaceStore.enterVrSpace(props.vrSpaceId);
});

</script>

