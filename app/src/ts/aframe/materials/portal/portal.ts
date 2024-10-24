// Made by PyryM: https://github.com/PyryM/aframe-pano-portal
// I've used the source code directly so we can tweak stuff and make it part of our bundling process
import vertexShader from './vs_portal.glsl?raw';
import fragmentShader from './fs_portal.glsl?raw';
export default () => {
  AFRAME.registerShader('vr-portal', {
    schema: {
      src: { type: 'map', is: 'uniform' },
      // warpParams: { type: 'vec4', is: 'uniform', default: "1.5 0.5 0.3 0.1" },
      color: { type: 'vec3', is: 'uniform', default: '1 1 1' },
      start: { type: 'float', is: 'uniform', default: 0.0 },
      end: { type: 'float', is: 'uniform', default: 1.0 },
      warpParams: { type: 'vec4', is: 'uniform', default: "1.5 0.5 0.3 0.1" },
      opacity: { type: 'float', is: 'uniform', default: 1.0 },
      dynamicOpacity: { type: 'bool', is: 'uniform', default: false }
    },
    vertexShader,
    fragmentShader,
  });
}