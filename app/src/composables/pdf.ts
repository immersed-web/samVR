
import { useScriptTag } from '@vueuse/core';
import { ref } from 'vue';

const pdfjsLoaded = ref(false);
useScriptTag('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.2.67/pdf.min.mjs', async el => {
  // console.log('pdfjs loaded');
  // @ts-ignore
  const { pdfjsLib } = globalThis;
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.2.67/pdf.worker.mjs';
  pdfjsLoaded.value = true;
  // loadDocument(props.src);
}, { type: 'module' });


export function usePDF() {
  return {
    pdfjsLoaded,
  };
}
