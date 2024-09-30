import { THREE, type Entity } from "aframe";

export default function () {
  AFRAME.registerComponent('box-helper', {
    boxHelper: undefined as unknown as THREE.BoxHelper,
    modelLoaded: false,
    currentColor: undefined as unknown as THREE.Color,
    schema: {
      enabled: { type: 'boolean', default: true },
      color: { type: 'color', default: '#ffffff' }
    },
    currentPosition: undefined as unknown as THREE.Vector3,
    prevPosition: undefined as unknown as THREE.Vector3,
    currentQuat: undefined as unknown as THREE.Quaternion,
    prevQuat: undefined as unknown as THREE.Quaternion,
    currentScale: undefined as unknown as THREE.Vector3,
    prevScale: undefined as unknown as THREE.Vector3,
    init: function () {
      console.log('box-helper init');
      this.currentColor = new THREE.Color();
      this.currentPosition = new THREE.Vector3();
      this.prevPosition = new THREE.Vector3();
      this.currentQuat = new THREE.Quaternion();
      this.prevQuat = new THREE.Quaternion();
      this.currentScale = new THREE.Vector3();
      this.prevScale = new THREE.Vector3();
      this.createAndAddBoxHelper();
    },
    events: {
      'model-loaded': function () {

        // (gltf) models might/usually (always?) finish loading after the entity is loaded.
        // Thus we need to listen for model-loaded to account for models geometry
        // NOTE: A weird bug (sometimes) places the bbox a bit away from the model entity if we dont wait a few millis. Extremely odd!!!
        // I get a feeling it's related to some code in the gltf loader that massages the entity/object3d after loading.
        setTimeout(() => {
          this.boxHelper.update();
        }, 15);
      },
      'pdf-loaded': function () {
        // console.log('boxhelper: pdf loaded');
        this.boxHelper.update();
      },
    },
    createAndAddBoxHelper: function () {
      console.log('creating and adding box helper');
      this.boxHelper = new THREE.BoxHelper(this.el.object3D)

      const scene = this.el.sceneEl?.object3D
      if (scene) {
        scene.add(this.boxHelper);
      }
      this.boxHelper.update();
    },
    removeAndDisposeBoxHelper: function () {
      console.log('removing and disposing box helper');
      this.el.sceneEl?.object3D.remove(this.boxHelper);
      this.boxHelper.dispose();
    },
    tick() {
      if (this.data.enabled === false) return;
      this.el.object3D.matrixWorld.decompose(this.currentPosition, this.currentQuat, this.currentScale);
      if (this.modelLoaded || this.currentScale.distanceTo(this.prevScale) > 0.01 || this.currentQuat.angleTo(this.prevQuat) > 0.01 || this.currentPosition.distanceTo(this.prevPosition) > 0.01) {
        console.log('UPDATING box helper');
        this.boxHelper.update();
        this.modelLoaded = false;
      }
      this.prevPosition.copy(this.currentPosition);
      this.prevQuat.copy(this.currentQuat);
      this.prevScale.copy(this.currentScale);
    },
    update: function () {
      this.boxHelper.visible = this.data.enabled;
      if (this.data.color && this.boxHelper) {
        this.currentColor?.set(this.data.color);
        this.boxHelper.material.color = this.currentColor;
      }
    },

    remove: function () {
      this.removeAndDisposeBoxHelper();
    },
  })
}