precision highp float;

//panorama warp stuff
uniform vec4 warpParams;
varying vec3 worldNormal;
varying vec3 worldViewDir;
varying float warpAlpha;

//glow stuff
varying vec2 fUV;
varying vec3 fNormal;
varying vec3 fPositionCameraSpace;
varying vec4 fPositionClipSpace;

void main(void) {
  fNormal = normalize(normalMatrix * normal);
  vec4 pos = modelViewMatrix * vec4(position, 1.0);
  fPositionCameraSpace = pos.xyz;
  fUV = uv;
  fPositionClipSpace = projectionMatrix * pos;
  gl_Position = fPositionClipSpace;

  vec4 zeroPos = modelMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  vec3 modelCenterToCameraV =  cameraPosition - zeroPos.xyz;
  float distToZero = length(modelCenterToCameraV);
  float dd = (distToZero - warpParams.x) / (warpParams.y - warpParams.x);
  warpAlpha = clamp(dd, 0.0, 1.0);
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  worldViewDir = worldPos.xyz - cameraPosition;

  worldNormal = (modelMatrix * vec4(normal.xyz, 0.0)).xyz;
  worldNormal = normalize(worldNormal);
  worldNormal = reflect(worldNormal, normalize(modelCenterToCameraV));
}