// Standard uniforms passed by ShaderMaterial
uniform sampler2D tDepth;
uniform float uTime;
uniform float uTransition;
uniform float uDepthScale;

// Custom attributes defined in JS
attribute vec3 offset;
attribute vec2 aUv;

// Varyings to pass data to fragment shader
varying vec2 vUv;
varying vec3 vPosition;

float random(vec2 st){
    return fract(sin(dot(st.xy,vec2(12.9898,78.233)))*43758.5453123);
}

void main(){
    // Send UV to fragment shader
    vUv=aUv;
    
    // Read depth using custom UV
    vec4 depthData=texture2D(tDepth,aUv);
    float zDisplacement=depthData.r*uDepthScale;
    
    // Base position = box position + instance offset
    vec3 gatheredPos=position+offset;
    gatheredPos.z+=zDisplacement;
    
    // Scattered position for transition effect
    float rnd=random(aUv);
    vec3 scatterOffset=vec3(
        sin(uTime*1.5+rnd*20.)*150.,
        cos(uTime*1.-rnd*15.)*150.,
        sin(uTime*2.+rnd*10.)*100.
    );
    vec3 scatteredPos=position+offset+scatterOffset;
    
    // Interpolation
    float ease=smoothstep(0.,1.,uTransition);
    vec3 finalPos=mix(scatteredPos,gatheredPos,ease);
    
    vPosition=finalPos;
    
    gl_Position=projectionMatrix*modelViewMatrix*vec4(finalPos,1.);
}