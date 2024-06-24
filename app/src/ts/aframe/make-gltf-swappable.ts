export default function () {
  AFRAME.registerComponent('make-gltf-swappable', {
    dependencies: ['gltf-model'],
    init: function () {
      // const gltfModel = this.el.components['gltf-model'];
      // gltfModel.
      this.el.addEventListener('componentchanged', (evt) => {
        if (evt.detail.name === 'gltf-model') {
          const component = evt.target.components['gltf-model'];
          // console.log(component.data)
          const value = component.data;
          let newValue = value;
          if (value.charAt(0) === '#') {
            const el = document.getElementById(value.substring(1));
            if (el) {
              newValue = el.getAttribute('src');
            }
          }
          component.data = newValue;
          component.update();
          // console.log(component);
        }
      })
    },

    update: function () {
    },

    remove: function () {
    },

  });
}