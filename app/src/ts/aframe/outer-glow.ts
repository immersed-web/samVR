// Made by PyryM: https://github.com/PyryM/aframe-pano-portal
// I've used the source code directly so we can tweak stuff and make it part of our bundling process
import vertexShader from './shaders/outer-glow/vs_outer_glow.glsl?raw';
import fragmentShader from './shaders/outer-glow/fs_outer_glow.glsl?raw';
export default () => {
  AFRAME.registerShader('outer-glow', {
    schema: {
      // src: { type: 'map', is: 'uniform' },
      // warpParams: { type: 'vec4', is: 'uniform', default: "1.5 0.5 0.3 0.1" },
      color: { type: 'vec3', is: 'uniform', default: '1 1 1' },
      start: { type: 'float', is: 'uniform', default: 0.0 },
      end: { type: 'float', is: 'uniform', default: 1.0 },
      alpha: { type: 'float', is: 'uniform', default: 1.0 },
    },
    vertexShader,
    fragmentShader,
  });
}