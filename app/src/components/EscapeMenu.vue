<template>
  <Teleport to="body">
    <div 
      v-if="model.isOpen" 
      class="modal modal-open !z-[9999] bg-black/40 backdrop-blur-sm"
      @keydown.esc="close"
    >
      <form method="dialog" class="modal-backdrop" @click="close">
        <button>close</button>
      </form>
      
      <div class="modal-box bg-base-100/10 backdrop-blur-xl border border-base-200/50 max-w-lg">
        <h3 class="text-2xl font-bold text-base-content mb-6">VR Menu</h3>
        
        <div class="space-y-4">
            <button class="w-full btn btn-primary btn-wide">Återuppta</button>
            <button class="w-full btn btn-error btn-wide">Lämna VR miljö</button>
        </div>
        
        <div class="mt-8 pt-6 border-t border-base-200/50 text-sm text-base-content/70 text-center">
          <p><kbd class="kbd kbd-sm">Esc</kbd> to close</p>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
interface EscapeMenuModel {
  isOpen: boolean
  onResume: () => void
  onSettings: () => void
  onShare: () => void
  onLeave: () => void
}

const props = defineProps<{
  model: EscapeMenuModel
}>()

function close() {
  props.model.onResume()
}
</script>