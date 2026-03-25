// fragment.glsl
uniform sampler2D tColor;

varying vec2 vSampleUv;
varying vec2 vLocalUv;
varying float vTransition;// This can be negative now

void main(){
    vec4 texColor=texture2D(tColor,vSampleUv);
    vec3 baseColor=texColor.rgb;
    if(texColor.a>.0001){
        baseColor=clamp(texColor.rgb/texColor.a,0.,1.);
    }
    
    vec2 centered=vLocalUv-.5;
    float dist=length(centered);
    
    // Hard circular cut (scissor-like edge)
    float hardCircle=step(dist,.46);
    
    // MODIFIED: Use abs(vTransition) so it doesn't disappear when negative.
    // Also, we want it to be fully opaque when vTransition is 0.
    // This logic makes it slightly transparent as it scatters (away from 0).
    float transitionFactor=smoothstep(0.,.5,abs(vTransition));
    float alpha=texColor.a*hardCircle*(1.-transitionFactor*.5);
    
    // Trim low-alpha fringe to avoid dark outlines
    if(alpha<.02)discard;
    
    // Premultiplied output with corrected base color helps remove dark edge halo.
    gl_FragColor=vec4(baseColor*alpha,alpha);
}