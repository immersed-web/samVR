#define M_PI 3.1415926535897932384626433832795
uniform sampler2D src;
uniform vec4 warpParams;
uniform float opacity;
uniform bool dynamicOpacity;
varying vec3 worldNormal;
varying vec3 worldViewDir;
varying float warpAlpha;

vec3 panoMap(vec3 vdir) {
  float r = length(vdir.xz);  // sqrt(vdir.x * vdir.x + vdir.z * vdir.z);
  float theta = atan(vdir.z, vdir.x) / M_PI;
  float phi = atan(vdir.y, r) / M_PI;
  vec2 uv = vec2((theta*0.5 + 0.5), phi + 0.5);
  return texture2D(src, uv).rgb;
}

void main() {
  vec3 nn = normalize(worldNormal);
  vec3 ndir = normalize(worldViewDir);
  vec3 sampleDir = (warpAlpha)*ndir + (1.0 - warpAlpha)*nn;
  gl_FragColor.rgb = panoMap(sampleDir);
  float warpedOpacity = opacity* clamp(warpAlpha, 0.8, 1.0);
  gl_FragColor.a = dynamicOpacity ? warpedOpacity : opacity;
}