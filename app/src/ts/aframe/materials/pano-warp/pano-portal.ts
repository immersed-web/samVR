// Made by PyryM: https://github.com/PyryM/aframe-pano-portal
// I've used the source code directly so we can tweak stuff and make it part of our bundling process
import vertexShader from './vs_pano_warp.glsl?raw';
import fragmentShaderDithered from './fs_pano_warp_dither.glsl?raw';
import fragmentShader from './fs_pano_warp.glsl?raw';
export default () => {
  AFRAME.registerShader('pano-warp', {
    schema: {
      src: { type: 'map', is: 'uniform' },
      warpParams: { type: 'vec4', is: 'uniform', default: "1.5 0.5 0.3 0.1" },
      opacity: { type: 'float', is: 'uniform', default: 1.0 },
      dynamicOpacity: { type: 'bool', is: 'uniform', default: false }
    },
    vertexShader,
    fragmentShader,
  });

  AFRAME.registerShader('pano-portal-dither', {
    schema: {
      src: { type: 'map', is: 'uniform' },
      warpParams: { type: 'vec4', is: 'uniform', default: "1.5 0.5 0.3 0.1" }
    },
    vertexShader,
    fragmentShader: fragmentShaderDithered,
  });
}