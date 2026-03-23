uniform sampler2D tColor;
uniform float uTransition;

// Varyings receiving data from vertex shader
varying vec2 vUv;
varying vec3 vPosition;

void main(){
    // Sample texture color using matched varying vUv
    vec4 texColor=texture2D(tColor,vUv);
    
    // Apply texture color and control opacity via transition
    gl_FragColor=vec4(texColor.rgb,texColor.a*uTransition);
}