// vertex.glsl

uniform sampler2D tDepth;
uniform float uTime;
uniform float uTransition;// Now 0.0 is the "Gathered/Target" state
uniform float uClickPulse;
uniform float uIdleOrbitRadius;
uniform float uIdleOrbitSpeedMin;
uniform float uIdleOrbitSpeedMax;
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
    // Generate isotropic direction on a sphere
    float az=hash11(rnd+.13)*6.28318530718;
    float z=hash11(rnd+.37)*2.-1.;
    float r=sqrt(max(0.,1.-z*z));
    vec3 unitDir=vec3(cos(az)*r,sin(az)*r,z);
    
    // Shift distribution outward so early scatter reads as a wider burst.
    float radialDist=pow(hash11(rnd+1.91),.55);
    
    float radiusXY=mix(.25,1.,radialDist)*uScatterRadiusXY;
    float radiusZ=mix(.2,1.,radialDist)*uScatterRadiusZ;
    
    // Increase overall scatter size while transition is far from gathered state.
    float transitionAmount=clamp(abs(uTransition),0.,1.);
    float burstScale=mix(1.,1.6,transitionAmount);
    radiusXY*=burstScale;
    radiusZ*=burstScale;
    
    // Add unique rotation offsets per particle so they don't move in sync
    float phaseA=hash11(rnd+7.2)*6.28318530718;
    float phaseB=hash11(rnd+3.6)*6.28318530718;
    float phaseC=hash11(rnd+9.4)*6.28318530718;
    
    // Dynamic per-axis noise-like wobble
    vec3 wobble=vec3(
        sin(t*.73+phaseA),
        cos(t*.91+phaseB),
        sin(t*1.07+phaseC)
    );
    
    vec3 scatter=vec3(unitDir.x*radiusXY,unitDir.y*radiusXY,unitDir.z*radiusZ);
    scatter+=vec3(radiusXY*.14,radiusXY*.14,radiusZ*.18)*wobble;
    return scatter;
}

vec3 idleOrbit(float rnd,float t){
    float speed=mix(uIdleOrbitSpeedMin,uIdleOrbitSpeedMax,hash11(rnd+5.7));
    float phase=hash11(rnd+8.3)*6.28318530718;
    float angle=t*speed+phase;

    vec3 axis=normalize(vec3(
        hash11(rnd+1.3)*2.-1.,
        hash11(rnd+2.1)*2.-1.,
        hash11(rnd+3.7)*2.-1.
    ));

    vec3 ref=abs(axis.y)<.99?vec3(0.,1.,0.):vec3(1.,0.,0.);
    vec3 tangent=normalize(cross(axis,ref));
    vec3 bitangent=normalize(cross(axis,tangent));

    float radius=uIdleOrbitRadius*mix(.35,1.,hash11(rnd+9.9));
    return (tangent*cos(angle)+bitangent*sin(angle))*radius;
}

void main(){
    vSampleUv=aUv;
    vLocalUv=uv;
    vTransition=uTransition;
    
    // Calculate depth displacement
    vec4 depthTex=texture2D(tDepth,aUv);
    float depthValue=mix(depthTex.r,1.-depthTex.r,uDepthInvert);
    float centeredDepth=(depthValue-.5)*2.;
    float zDisplacement=centeredDepth*uDepthScale;
    float yDisplacement=centeredDepth*uDepthScale*.9;
    
    // This is our final target position (the 2.5D image)
    vec3 gatheredCenter=offset;
    gatheredCenter.y+=yDisplacement;
    gatheredCenter.z+=zDisplacement;
    
    // Signed transition: negative values invert incoming direction.
    float signedTransition=clamp(uTransition,-1.,1.);
    float chaos=smoothstep(0.,1.,abs(signedTransition));
    float directionSign=signedTransition<0.?-1.:1.;
    
    float offsetSeed=hash11(offset.x*.001+offset.y*.003);
    vec3 scatterVec=sphericalScatter(fract(aRandom+offsetSeed),uTime)*directionSign;
    vec3 scatterCenter=gatheredCenter+scatterVec;
    
    // Transitioning from gatheredCenter (at 0.0) to scatterCenter (at +/-1.0)
    vec3 centerPos=mix(gatheredCenter,scatterCenter,chaos);
    
    // Mouse click pulse: brief additional burst and return.
    centerPos+=scatterVec*uClickPulse;

    // Subtle per-particle idle motion when mostly gathered.
    float gatheredWeight=smoothstep(1.,0.,chaos);
    centerPos+=idleOrbit(fract(aRandom+offsetSeed*1.37),uTime)*gatheredWeight;
    
    vec3 localPos=position;
    vec3 worldPos=centerPos+localPos;
    
    gl_Position=projectionMatrix*modelViewMatrix*vec4(worldPos,1.);
}