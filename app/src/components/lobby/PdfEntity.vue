<script setup lang="ts">
import { computed, onBeforeMount, onMounted, onUnmounted, ref, shallowRef, watch, type Ref } from 'vue';
import type { PDFDocumentLoadingTask, PDFDocumentProxy } from 'pdfjs-dist';

// import { useScriptTag } from '@vueuse/core';
import type { Entity } from 'aframe';
import { usePDF } from '@/composables/pdf';

const pdfUtils = usePDF();

// const pdfjsLoaded = ref(false);
// useScriptTag('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.2.67/pdf.min.mjs', async el => {
//   console.log('pdfjs loaded');
//   // @ts-ignore
//   const { pdfjsLib } = globalThis;

//   pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.2.67/pdf.worker.mjs'
//   pdfjsLoaded.value = true;
//   loadDocument(props.src);
// }, { type: 'module' })

const props = withDefaults(defineProps<{
  // pdfEntityRef: Entity | undefined,
  src: string,
  currentPage?: number,
}>(), { currentPage: 1 })


const uuid = crypto.randomUUID().substring(0, 8);;
const canvasSelector = `pdf-${uuid}`;

const pdfCanvasTag = ref<HTMLCanvasElement>();
const pdfEntityTag = ref<Entity>();

// const activePage = ref(1);
let numPages = computed(() => loadedDoc.value?.numPages);

let loadedDoc = shallowRef<PDFDocumentProxy>();

defineExpose({ numPages })

// function nextPage() {
//   activePage.value = (activePage.value + 1) % numPages;
//   renderPage(activePage.value + 1);
// }
watch(() => props.currentPage, newPage => renderPage(newPage));
watch(() => props.src, newSrc => loadDocument(newSrc));

async function loadDocument(src: string) {
  if (!pdfUtils.pdfjsLoaded.value) return;
  // @ts-ignore
  const { pdfjsLib } = globalThis;
  const pdfDoc = pdfjsLib.getDocument(src) as PDFDocumentLoadingTask;
  loadedDoc.value = await pdfDoc.promise
  // numPages.value = loadedDoc.value.numPages;
  // console.log(numPages);
  await renderPage(props.currentPage);
  // pdfEntityTag.value?.emit('canvasReady');
}

async function renderPage(pageIdx: number = 1) {
  // console.log(pageIdx);
  if (!loadedDoc.value || !pdfCanvasTag.value || pageIdx == 0) return;
  const canvas = pdfCanvasTag.value
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const wrappedPageNr = ((pageIdx - 1) % loadedDoc.value.numPages) + 1;
  const page = await loadedDoc.value.getPage(wrappedPageNr)
  const vp = page.getViewport({ scale: 4, })
  // console.log(vp.width, vp.height);
  canvas.width = vp.width;
  canvas.height = vp.height;
  let renderCtx = { canvasContext: ctx, viewport: vp };
  await page.render(renderCtx).promise;
  // console.log('rendered');
  pdfEntityTag.value?.emit('update');
}
onMounted(() => {
  loadDocument(props.src);
})

// onBeforeMount(() => {
//   console.log('BEFORE MOUNT');
// })
// onUnmounted(() => {
//   console.log('UNMOUNTED');
// })

</script>

<template>
  <a-entity>
    <a-entity :class="$attrs.class" ref="pdfEntityTag"
      :canvas-material="`autoUpdate: false; src: #${canvasSelector};`" />
    <Teleport to="body">
      <canvas :id="canvasSelector" style="display: none;" ref="pdfCanvasTag"></canvas>
    </Teleport>
  </a-entity>
</template>