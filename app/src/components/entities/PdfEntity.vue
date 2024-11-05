<script setup lang="ts">
import { computed, onBeforeMount, onMounted, onUnmounted, ref, shallowRef, watch, type Ref } from 'vue';
import type { PDFDocumentLoadingTask, PDFDocumentProxy } from 'pdfjs-dist';

import type { Entity } from 'aframe';
import { usePDF } from '@/composables/pdf';
import { watchOnce } from '@vueuse/core';

const pdfUtils = usePDF();
const currentPage = defineModel<number>('currentPage', {
  default: 1,
  required: false,
});
const props = withDefaults(defineProps<{
  src: string,
  withPageButtons?: boolean,
  // currentPage?: number,
}>(), {
  // currentPage: 1 
  withPageButtons: true,
})

const uuid = crypto.randomUUID().substring(0, 8);;
const canvasSelector = `pdf-${uuid}`;

const pdfCanvasTag = ref<HTMLCanvasElement>();
const pdfEntityTag = ref<Entity>();

let numPages = computed(() => loadedDoc.value?.numPages);

let loadedDoc = shallowRef<PDFDocumentProxy>();

defineExpose({ numPages })

watch(currentPage, newPage => renderPage(newPage));
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
  await renderPage(currentPage.value);
}

function nextPage() {
  // console.log('next page called');
  if (currentPage.value === numPages.value) return
  currentPage.value++;
}
function prevPage() {
  // console.log('prev page called');
  if (currentPage.value === 1) return
  currentPage.value--;
}

async function renderPage(pageIdx: number = 1) {
  // console.log('renderPage called', pageIdx);
  if (!loadedDoc.value || !pdfCanvasTag.value || pageIdx < 1 || pageIdx > numPages.value) {
    console.error('provided pageIdx is outside range or no pdf doc loaded or no canvas available to render page');
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
    <a-entity @canvas-updated.stop="onCanvasUpdated" @loaded="onPdfEntityLoaded" :class="$attrs.class"
      ref="pdfEntityTag" :canvas-material="`autoUpdate: false; src: #${canvasSelector};`">
      <a-entity v-if="withPageButtons" position="0 0 0.01">
        <!-- <a-sphere color="red" scale="0.1 0.1 0.1" position="0 -0.1 0" /> -->
        <a-troika-text v-if="currentPage < numPages" value="keyboard_arrow_right" font-size="0.2" font="#icon-font"
          position="0.7 0 0">
          <a-circle class="clickable" @click.stop="nextPage()" transparent="true" opacity="0.4" color="black"
            scale="0.1 0.1 0.1" position="0 0 -0.001" />
        </a-troika-text>
        <a-troika-text v-if="currentPage > 1" value="keyboard_arrow_left" font-size="0.2" font="#icon-font"
          position="-0.7 0 0">
          <a-circle class="clickable" @click.stop="prevPage()" transparent="true" opacity="0.4" color="black"
            scale="0.1 0.1 0.1" position="0 0 -0.001" />
        </a-troika-text>
        <!-- <a-troika-text color="red" value="helllo" position="0 0 0" look-at-camera /> -->
      </a-entity>
    </a-entity>
    <Teleport to="body">
      <canvas :id="canvasSelector" style="display: none;" ref="pdfCanvasTag"></canvas>
    </Teleport>
  </a-entity>
</template>