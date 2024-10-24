
// glow stuff
uniform vec3 color;
uniform float start;
uniform float end;

varying vec3 fNormal;
varying vec3 fPositionCameraSpace;
varying vec4 fPositionClipSpace;

//panorama warp stuff
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
  //Glow
  vec3 normal = normalize(fNormal);
  vec3 eye = normalize(-fPositionCameraSpace.xyz);
  vec2 coord = fPositionClipSpace.xy / (fPositionClipSpace.w);
  coord *= 0.9;
  vec2 center = vec2(0,0);
  float distanceFromCenter = distance(coord, center);
  float edgeWeight = smoothstep(0.7, 1.4, distanceFromCenter);
  float rim = 1.0 - abs(dot(normal, eye));
  float glow = smoothstep(start, end, rim);
  float screenweightedGlow = mix(glow, 1.0, edgeWeight);
  //gl_FragColor = vec4(1, 1, 0, 1.0);
  //gl_FragColor = vec4( clamp(glow, 0.0, 1.0) * opacity * color, 1.0 );
  // vec4 outputGlow = vec4(color, vec3(screenweightedGlow)* opacity);

  //Panorama
  vec3 nn = normalize(worldNormal);
  vec3 ndir = normalize(worldViewDir);
  vec3 sampleDir = (warpAlpha)*ndir + (1.0 - warpAlpha)*nn;
  // gl_FragColor.rgb = panoMap(sampleDir);
  vec3 panoramaPixel = panoMap(sampleDir);
  float warpedOpacity = opacity* mix(0.7, 1.0, warpAlpha);
  
  
  gl_FragColor.rgb = mix(panoMap(sampleDir), color, screenweightedGlow);
  gl_FragColor.a = dynamicOpacity ? warpedOpacity : opacity;
}