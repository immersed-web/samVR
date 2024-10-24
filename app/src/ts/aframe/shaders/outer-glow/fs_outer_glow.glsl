
precision highp float;

uniform vec3 color;
uniform float start;
uniform float end;
uniform float opacity;


varying vec3 fNormal;
varying vec3 fPositionCameraSpace;
varying vec4 fPositionClipSpace;



void main()
{
    vec3 normal = normalize(fNormal);
    vec3 eye = normalize(-fPositionCameraSpace.xyz);
    vec2 coord = fPositionClipSpace.xy / (fPositionClipSpace.w);
    coord *= 0.9;
    vec2 center = vec2(0,0);
    float distanceFromCenter = distance(coord, center);
    float edgeWeight = smoothstep(0.9, 1.4, distanceFromCenter);
    float rim = 1.0 - abs(dot(normal, eye));
    float glow = smoothstep(start, end, rim);
    float screenweightedGlow = mix(glow, end, edgeWeight);
    //gl_FragColor = vec4(1, 1, 0, 1.0);
    //gl_FragColor = vec4( clamp(glow, 0.0, 1.0) * opacity * color, 1.0 );
    gl_FragColor = vec4(color, vec3(screenweightedGlow)* opacity);
}
