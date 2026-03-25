uniform sampler2D tColor;

varying vec2 vSampleUv;
varying vec2 vLocalUv;
varying float vTransition;

void main(){
    vec4 texColor=texture2D(tColor,vSampleUv);
    
    vec2 centered=vLocalUv-.5;
    float dist=length(centered);
    
    float softCircle=1.-smoothstep(.38,.5,dist);
    float alpha=texColor.a*softCircle*smoothstep(0.,.15,vTransition);
    
    if(alpha<.01)discard;
    
    gl_FragColor=vec4(texColor.rgb,alpha);
}