precision highp float;

// attribute vec3 position;
// attribute vec3 normal;
// attribute vec2 uv;
attribute vec2 uv2;

// uniform mat3 normalMatrix;
// uniform mat4 modelViewMatrix;
// uniform mat4 projectionMatrix;

varying vec3 fNormal;
varying vec3 fPosition;
varying vec2 fUv;

void main()
{
    fNormal = normalize(normalMatrix * normal);
    vec4 pos = modelViewMatrix * vec4(position, 1.0);
    fPosition = pos.xyz;
    fUv = uv;
    gl_Position = projectionMatrix * pos;
}
