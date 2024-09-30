<script setup lang="ts">
import { computed, onBeforeMount, onMounted, onUnmounted, ref, shallowRef, watch, type Ref } from 'vue';
import type { PDFDocumentLoadingTask, PDFDocumentProxy } from 'pdfjs-dist';

import type { Entity } from 'aframe';
import { usePDF } from '@/composables/pdf';
import { watchOnce } from '@vueuse/core';

const pdfUtils = usePDF();
const props = withDefaults(defineProps<{
  src: string,
  currentPage?: number,
}>(), { currentPage: 1 })

const uuid = crypto.randomUUID().substring(0, 8);;
const canvasSelector = `pdf-${uuid}`;

const pdfCanvasTag = ref<HTMLCanvasElement>();
const pdfEntityTag = ref<Entity>();

let numPages = computed(() => loadedDoc.value?.numPages);

let loadedDoc = shallowRef<PDFDocumentProxy>();

defineExpose({ numPages })

watch(() => props.currentPage, newPage => renderPage(newPage));
watch(() => props.src, newSrc => loadDocument(newSrc));

async function loadDocument(src: string) {
  if (!pdfUtils.pdfjsLoaded.value) {
    console.info('pdfjs not loaded yet when trying to load document. setting up watcher to autoload when possible');
    watchOnce(pdfUtils.pdfjsLoaded, () => loadDocument(src))
    return
  }
  // @ts-ignore
  const { pdfjsLib } = globalThis;
  const pdfDoc = pdfjsLib.getDocument(src) as PDFDocumentLoadingTask;
  loadedDoc.value = await pdfDoc.promise
  await renderPage(props.currentPage);
}

async function renderPage(pageIdx: number = 1) {
  if (!loadedDoc.value || !pdfCanvasTag.value || pageIdx === 0) {
    console.error('provided pageIdx is 0 or no pdf doc loaded or no canvas available to render page');
    return;
  }
  const canvas = pdfCanvasTag.value
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    console.error('no 2d context received from canvas');
    return;
  } 
  const wrappedPageNr = ((pageIdx - 1) % loadedDoc.value.numPages) + 1;
  const page = await loadedDoc.value.getPage(wrappedPageNr)
  const vp = page.getViewport({ scale: 4, })
  canvas.width = vp.width;
  canvas.height = vp.height;
  let renderCtx = { canvasContext: ctx, viewport: vp };
  await page.render(renderCtx).promise;
  if (!pdfEntityTag.value) {
    console.error('no pdfEntity ref available to trigger material update');
    return
  }
  pdfEntityTag.value.emit('update-canvas-material');
}
function onPdfEntityLoaded() {
  pdfEntityTag.value?.emit('update-canvas-material');
}
function onCanvasUpdated() {
  // console.log('canvas updated');

  //NOTE: Cant use component emits cause they dont bubble. Which we actually want in this case.
  pdfEntityTag.value?.emit('pdf-loaded');
}
onMounted(() => {
  loadDocument(props.src);
})
</script>

<template>
  <a-entity>
    <a-entity @canvas-updated.stop="onCanvasUpdated" @loaded="onPdfEntityLoaded" class="clickable" :class="$attrs.class"
      ref="pdfEntityTag" :canvas-material="`autoUpdate: false; src: #${canvasSelector};`" />
    <Teleport to="body">
      <canvas :id="canvasSelector" style="display: none;" ref="pdfCanvasTag"></canvas>
    </Teleport>
  </a-entity>
</template>