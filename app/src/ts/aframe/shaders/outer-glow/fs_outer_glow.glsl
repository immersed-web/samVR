precision highp float;

uniform vec3 color;
uniform float start;
uniform float end;
uniform float opacity;

varying vec3 fPosition;
varying vec3 fNormal;

void main()
{
    vec3 normal = normalize(fNormal);
    vec3 eye = normalize(-fPosition.xyz);
    float rim = smoothstep(start, end, 1.0 - abs(dot(normal, eye)));
    // gl_FragColor = vec4( clamp(rim, 0.0, 1.0) * alpha * color, 1.0 );
    gl_FragColor = vec4( color, clamp(rim, 0.0, 1.0) * opacity);
}