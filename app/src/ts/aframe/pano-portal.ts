// Made by PyryM: https://github.com/PyryM/aframe-pano-portal
// I've used the source code directly so we can tweak stuff and make it part of our bundling process
import vertexShader from './shaders/vs_pano_warp.glsl?raw';
import fragmentShaderDithered from './shaders/fs_pano_warp_dither.glsl?raw';
import fragmentShader from './shaders/fs_pano_warp.glsl?raw';
export default () => {
  AFRAME.registerShader('pano-portal', {
    schema: {
      src: { type: 'map', is: 'uniform' },
      warpParams: { type: 'vec4', is: 'uniform', default: "1.5 0.5 0.3 0.1" },
      opacity: { type: 'float', is: 'uniform', default: 1.0 }
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