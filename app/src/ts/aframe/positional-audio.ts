import { assertSceneHasAudioListener } from "@/modules/3DUtils";
import { THREE } from "aframe";
export default () => {
  AFRAME.registerComponent('positional-audio', {
    schema: {
      audioSourceElement: {
        type: 'selector',
        default: '',
      },
      distanceModel: {
        default: 'exponential',
        oneOf: ['linear', 'inverse', 'exponential'],
      },
      maxDistance: { default: 10000 },
      refDistance: { default: 4 },
      rolloffFactor: { default: 4 },
    },
    update() {
      this.setupSound();
      this.setPannerProperties();
    },
    setupSound() {
      const el = this.el;
      console.assert(el.sceneEl, 'positional-audio: sceneEl was undefined in setupSound function');
      const sceneEl = assertSceneHasAudioListener(el.sceneEl!);


      const mediaElement = this.data.audioSourceElement as HTMLMediaElement;
      if (!(this.data.audioSourceElement instanceof HTMLMediaElement)) {
        console.error('audiosourceselector was not instance of an HTMLMediaElement');
        return;
      }
      const posAudio = this.getOrCreatePosAudio(sceneEl);
      posAudio.setMediaElementSource(mediaElement);
    },
    getOrCreatePosAudio(sceneEl: ReturnType<typeof assertSceneHasAudioListener>) {
      const posAudio = this.el.getObject3D('posAudio');
      if ((posAudio instanceof THREE.PositionalAudio)) {
        return posAudio;
      }
      // console.log('creating positional audio! -----------------------');
      const newPosAudio = new THREE.PositionalAudio(sceneEl.audioListener);
      this.el.setObject3D('posAudio', newPosAudio);
      return newPosAudio;
    },
    setPannerProperties() {
      const posAudio = this.el.getObject3D('posAudio');
      if (!(posAudio instanceof THREE.PositionalAudio)) {
        console.error('posaudio was undefined');
        return;
      }
      posAudio.setDistanceModel(this.data.distanceModel);
      posAudio.setMaxDistance(this.data.maxDistance);
      posAudio.setRefDistance(this.data.refDistance);
      posAudio.setRolloffFactor(this.data.rolloffFactor);
    },
    remove() {
      this.destroySound();
    },
    destroySound() {
      const posAudio = this.el.getObject3D('posAudio');
      if (!(posAudio instanceof THREE.PositionalAudio)) {
        console.error('posaudio was undefined');
        return;
      }
      try {

        posAudio.disconnect();
        this.el.removeObject3D('posAudio');
        console.log('destroy sound has run!');
      } catch (e) {
        console.error('error when destroying positional-audio');
        console.error(e);
      }
    },
  });
};