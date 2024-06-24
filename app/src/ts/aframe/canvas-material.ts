export default function () {

  AFRAME.registerComponent('canvas-material', {
    schema: {
      autoUpdate: { type: 'boolean', default: false },
      src: { type: 'selector' }
    },
    // dependencies: ['geometry'],
    // canvasReady: false,
    prevSize: undefined as { width: number, height: number } | undefined,
    events: {
      // canvasReady: function () {
      //   if (this.canvasReady) return;
      //   console.log('canvas ready triggered');
      //   this.canvasReady = true;
      //   const canvas = this.data.src as HTMLCanvasElement;
      //   const ratio = canvas.height / canvas.width;
      //   // console.log(ratio);
      //   this.el.setAttribute('geometry', { primitive: 'plane', width: 1, height: ratio });
      //   this.el.setAttribute('material', { src: this.data.src });
      //   // const geometry = this.el.components.geometry;
      //   // console.log(geometry);
      //   // geometry.height = ratio;
      // },
      update: function (evt: CustomEvent) {
        // console.log('update riggered');
        this.updateMaterial();
      }
    },
    init(data) {
      this.prevSize = { width: 0, height: 0 };
      const canvas = this.data.src as HTMLCanvasElement
      // console.log(this.data.src);
    },
    update: function (_oldData) {
      console.log(this.data.src);
      // this.updateMaterial();
    },
    updateMaterial: function () {

      console.log('update Material triggered!');
      // if (!this.canvasReady) return;
      let el = this.el;
      const canvas = this.data.src as HTMLCanvasElement;
      if (this.prevSize!.width !== canvas.width || this.prevSize!.height !== canvas.height) {
        // console.log(this.prevSize);
        console.log(canvas, 'canvas resized. need to flush material to avoid texture error');
        const ratio = canvas.height / canvas.width;
        // console.log(ratio);
        this.el.setAttribute('geometry', { primitive: 'plane', width: 1, height: ratio });
        el.removeAttribute('material');
        el.setAttribute('material', { src: this.data.src });
      }

      const material = el.getObject3D('mesh').material;
      if (!material.map) {
        console.error('no material map. exiting');
        return;
      }
      console.log('marking material for update');
      material.map.needsUpdate = true;
      this.prevSize!.width = canvas.width;
      this.prevSize!.height = canvas.height;
    },
    tick: function () {
      if (this.data.autoUpdate) {
        this.updateMaterial();
      }
    }
  });
}