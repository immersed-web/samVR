import { ref } from "vue";

const userHasInteracted = ref(navigator.userActivation.hasBeenActive);
const interval = setInterval(() => {
  userHasInteracted.value = navigator.userActivation.hasBeenActive;
  console.log('checking userActivation:', userHasInteracted.value);
}, 4000);

import.meta.hot?.on('vite:beforeUpdate', () => {
  console.log('HMR update detected. Clearing interval:', interval);
  clearInterval(interval);
})

function onMouseDown() {
  userHasInteracted.value = navigator.userActivation.hasBeenActive;
  console.log('document clicked. Updating userActivation:', userHasInteracted.value);
}
document.removeEventListener('mousedown', onMouseDown);
document.addEventListener('mousedown', onMouseDown, { once: true });


export { userHasInteracted }