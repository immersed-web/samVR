<template>
  <a-entity :gltf-model="`url(/avatar/${skinPartName}/${part.model}.glb)`"
    :model-color="`colors: ${skinColor ?? ''}; materialName: skin`" />
</template>
<script setup lang="ts">
import type { AvatarDesign, SkinPart } from 'schemas';



const props = defineProps<{
  skinPartName: SkinPart
  skinColor?: string,
  part: AvatarDesign['parts'][SkinPart]
}>()

</script>