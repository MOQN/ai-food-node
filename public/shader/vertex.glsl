uniform sampler2D tDepth;
uniform float uTime;
uniform float uTransition;
uniform float uDepthScale;
uniform float uDepthInvert;
uniform float uScatterRadiusXY;
uniform float uScatterRadiusZ;

attribute vec3 offset;
attribute vec2 aUv;
attribute float aRandom;

varying vec2 vSampleUv;
varying vec2 vLocalUv;
varying float vTransition;

float hash11(float p){
    p=fract(p*.1031);
    p*=p+33.33;
    p*=p+p;
    return fract(p);
}

vec3 sphericalScatter(float rnd,float t){
    float a=rnd*6.28318530718;
    float b=hash11(rnd+.37)*6.28318530718;
    
    float radiusXY=mix(.35,1.,hash11(rnd+1.91))*uScatterRadiusXY;
    float radiusZ=mix(.2,1.,hash11(rnd+4.73))*uScatterRadiusZ;
    
    float wobbleA=sin(t*.7+rnd*20.);
    float wobbleB=cos(t*.9+rnd*13.);
    
    return vec3(
        cos(a+wobbleA*.4)*radiusXY,
        sin(a+wobbleB*.4)*radiusXY,
        sin(b+wobbleA*.3)*radiusZ
    );
}

void main(){
    vSampleUv=aUv;
    vLocalUv=uv;
    vTransition=uTransition;
    
    vec4 depthTex=texture2D(tDepth,aUv);
    
    float depthValue=mix(depthTex.r,1.-depthTex.r,uDepthInvert);
    float centeredDepth=(depthValue-.5)*2.;
    float zDisplacement=centeredDepth*uDepthScale;
    float yDisplacement=centeredDepth*uDepthScale*.9;
    
    vec3 gatheredCenter=offset;
    gatheredCenter.y+=yDisplacement;
    gatheredCenter.z+=zDisplacement;
    
    vec3 scatterCenter=offset+sphericalScatter(aRandom,uTime);
    
    float ease=smoothstep(0.,1.,uTransition);
    vec3 centerPos=mix(scatterCenter,gatheredCenter,ease);
    
    vec3 localPos=position;
    vec3 worldPos=centerPos+localPos;
    
    gl_Position=projectionMatrix*modelViewMatrix*vec4(worldPos,1.);
}