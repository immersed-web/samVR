export default function() {
  AFRAME.registerComponent('gltf-shadow', {
    init: function () {
      this.onMeshChanged = this.update.bind(this);
      this.el.addEventListener('object3dset', this.onMeshChanged);
      // this.system.setShadowMapEnabled(true);
    },
  
    update: function () {
      this.updateDescendants(true);
    },
  
    remove: function () {
      const el = this.el;
      el.removeEventListener('object3dset', this.onMeshChanged);
      this.updateDescendants(false, false);
    },
  
    updateDescendants: function (cast) {
      const sceneEl = this.el.sceneEl;
      this.el.object3D.traverse(function (node) {
        if (!(node instanceof THREE.Light)) { return; }
        console.log('found light. setting cast shadow on it');
  
        node.castShadow = cast;
  
        // If scene has already rendered, materials must be updated.
        // if (sceneEl.hasLoaded && node.material) {
        //   var materials = Array.isArray(node.material) ? node.material : [node.material];
        //   for (var i = 0; i < materials.length; i++) {
        //     materials[i].needsUpdate = true;
        //   }
        // }
      });
    }
  });
}