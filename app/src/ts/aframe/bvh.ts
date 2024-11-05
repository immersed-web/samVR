import { THREE, type DetailEvent } from "aframe";

export default () => {

  AFRAME.registerComponent('bvh', {
    schema: {
    },
    events: {
      'model-loaded': function (evt: DetailEvent<{ model: THREE.Object3D, format: string }>) {
        this.update();
      },
    },
    init: function () {
      // console.log('bvh init');
      // this.el.addEventListener('model-loaded', this.update.bind(this));
      this.update();
    },
    update: function () {
      // console.log('bvh updated:', this.data);
      const obj3D = this.el.object3D;
      obj3D.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.computeBoundsTree();
        }
      })
    },
  });
};