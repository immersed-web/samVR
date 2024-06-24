import { THREE } from "aframe";

export default () => {

  AFRAME.registerComponent('model-color', {
    dependencies: ['gltf-model'],
    schema: {
      colors: {type: 'array'},
      materialName: { type: 'string', default: 'color' }
    },
    nrOfCustomColors: 0,
    defaultColorsStashed: false,
    modelLoaded: false,
    stashedDefaultColors: undefined as THREE.Color[] | undefined,
    // threeColor: undefined as undefined | THREE.Color,
    init: function () {
      this.stashedDefaultColors = [];
      // console.log(this.el);
      this.el.addEventListener('model-loaded', () => {
        // console.log('model loaded event');
        this.modelLoaded = true;
        this.defaultColorsStashed = false;
        // this.stashDefaultColors();
        // console.log('calling update manually');
        this.update();
      })
      // this.el.addEventListener('model-loaded', this.update.bind(this));
      // this.el.addEventListener('model-loaded', this.stashDefaultColors.bind(this));
      // TODO: verify we can remove this call to update and then do just that!
      // this.update();
      // this.checkCustomProps(this.el.object3D);
      // this.checkCustomProps(this.el.getObject3D('mesh'));
      // console.log(this.el.object3D);
      // console.log(this.el.object3DMap);
    },
    update: function () {
      // console.log('model-color updated:', this.data.colors);
      if (!this.modelLoaded) {
        // console.log('model not yet loaded. skipping');
        return;
      }
      if (!this.defaultColorsStashed) {
        // console.log('default colors not stashed. stashing now.');
        this.stashDefaultColors();
        // return;
      }
      const materialName = this.data.materialName as string;
      // console.log(this.el.object3D);
      // console.log(this.el.object3DMap);
      const mesh = this.el.getObject3D('mesh');
      // console.log('mesh:', mesh);
      const colors: THREE.Color[] = [];
      for (let i = 0; i < this.stashedDefaultColors.length; i++) {
        if (!this.data.colors[i] || this.data.colors[i] === '') {
          // console.log('using default color', i, this.stashedDefaultColors[i]);
          colors[i] = this.stashedDefaultColors[i].clone();
          // console.log(this.stashedDefaultColors);
          // console.log(colors);
        } else {
          colors[i] = new THREE.Color(this.data.colors[i]);
        }
      }
      if (!mesh) { return; }
      // this.recursiveStoppableTraverse(mesh, function (node) {
      //     if(!node.isMesh) {
      //       return;
      //     }
      //     if(node.material?.name.startsWith('color')) return;
      //     // if('ColorableHairtie' in node.userData) {
      //     //   console.log('found colorable');
      //     //   node.material.color = new THREE.Color('green');
      //     //   return true;
      //     // }
      //     console.log('applying color to', node);
      //     // node.material.color = colors[0];
      // })
      let maxColorDigit = 0;
      mesh.traverse((node) => {
          // console.log('node:', node.name, node.id, node.type);
          // console.log('children:', node.children);
          // console.log('userData:', node.userData);
        const mesh = node as THREE.Mesh;
        if (mesh.isMesh) {
          const material = mesh.material
          if (Array.isArray(material)) return;
          if (material.name.startsWith(materialName)) {
            let digit = Number.parseInt(material.name.substring(materialName.length));
            if (isNaN(digit)) {
              digit = 1; // we start colors at 1 and not 0...
            }
            if (digit > maxColorDigit) {
              maxColorDigit = digit;
            // console.log('nrOfCustomColors:', this.nrOfCustomColors);
            }
            if('color' in material && colors[digit-1]){
              // console.log('setting color!');
              material.color = colors[digit-1];
            }
          }
        }
      });
      if (maxColorDigit !== this.nrOfCustomColors) {
        this.nrOfCustomColors = maxColorDigit;
        this.el.emit('nrOfCustomColors', this.nrOfCustomColors);
      }
    },
    stashDefaultColors: function () {
      // console.log('stashing colors');
      const rootMesh = this.el.getObject3D('mesh');
      if (!rootMesh) { return; }
      const materialName = this.data.materialName as string;
      rootMesh.traverse((node) => {
        const mesh = node as THREE.Mesh;
        if (mesh.isMesh) {
          const material = mesh.material
          if (Array.isArray(material)) return;
          if (material.name.startsWith(materialName)) {
            let digit = Number.parseInt(material.name.substring(materialName.length));
            if (isNaN(digit)) {
              // console.warn('no digit on custom material. using digit 1');
              digit = 1;
              // return;
            }
            digit -= 1;
            if ('color' in material && digit >= 0) {
              // console.log('found default color:', digit, material.color);
              this.stashedDefaultColors[digit] = material.color.clone() as THREE.Color;
            }
          }
        }
      });
      // console.log('stashed color:', this.stashedDefaultColors);
      this.defaultColorsStashed = true;
    }
    // recursiveStoppableTraverse: function(root: THREE.Object3D, callBack: (node: THREE.Object3D) => boolean) {
    //   // console.log('travers is on node:', root);
    //   const shouldStop = callBack(root);
    //   if(shouldStop){
    //     // console.log('callback gave stop signal');
    //     return;
    //   }
    //   const children = root.children;
    //   for(const child of children) {
    //     // console.log('recursing on:', child);
    //     this.recursiveStoppableTraverse(child, callBack);
    //   }
    // }
  });
};