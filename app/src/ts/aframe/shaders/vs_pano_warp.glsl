uniform vec4 warpParams;
varying vec3 worldNormal;
varying vec3 worldViewDir;
varying float warpAlpha;
// varying vec4 normalInCameraSpace;

void main(void) {
  vec4 zeroPos = modelMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  vec3 modelCenterToCameraV =  cameraPosition - zeroPos.xyz;
  float distToZero = length(modelCenterToCameraV);
  float dd = (distToZero - warpParams.x) / (warpParams.y - warpParams.x);
  warpAlpha = clamp(dd, 0.0, 1.0);
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  worldViewDir = worldPos.xyz - cameraPosition;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);

  worldNormal = (modelMatrix * vec4(normal.xyz, 0.0)).xyz;
  worldNormal = normalize(worldNormal);
  worldNormal = reflect(worldNormal, normalize(modelCenterToCameraV));
}