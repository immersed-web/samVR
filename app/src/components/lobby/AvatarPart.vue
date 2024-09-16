<template>
  <a-entity :gltf-model="`url(/avatar/${partName}/${part.model}.glb)`" :model-color="`colors: ${part.colors ?? ''}`" />
</template>
<script setup lang="ts">
import { readonly, type DeepReadonly } from 'vue';
import type { AvatarDesign, SkinPart } from 'schemas';

type NonSkinParts = Exclude<keyof AvatarDesign['parts'], SkinPart>


const props = defineProps<{
  partName: NonSkinParts
  part: DeepReadonly<AvatarDesign['parts'][NonSkinParts]>
}>()

</script>