export default () => {

  AFRAME.registerComponent('scene-cleanup', {
    remove() {
      // console.log('scene-cleanup removed hook');
      document.documentElement.classList.remove('a-fullscreen');
    }
  });
};