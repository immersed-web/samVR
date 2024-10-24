precision highp float;

varying vec2 fUV;
varying vec3 fNormal;
varying vec3 fPositionCameraSpace;
varying vec4 fPositionClipSpace;

void main()
{
    fNormal = normalize(normalMatrix * normal);
    vec4 pos = modelViewMatrix * vec4(position, 1.0);
    fPositionCameraSpace = pos.xyz;
    fUV = uv;
    fPositionClipSpace = projectionMatrix * pos;
    gl_Position = fPositionClipSpace;
}
