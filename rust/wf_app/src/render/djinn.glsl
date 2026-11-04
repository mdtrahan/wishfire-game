#version 100
precision highp float;
varying vec2 uv;
varying vec4 col,aux;
uniform float mode,clock,seed;
float hash3(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
float noise3(vec3 p){vec3 a=floor(p),u=fract(p);u=u*u*(3.-2.*u);return mix(mix(mix(hash3(a),hash3(a+vec3(1,0,0)),u.x),mix(hash3(a+vec3(0,1,0)),hash3(a+vec3(1,1,0)),u.x),u.y),mix(mix(hash3(a+vec3(0,0,1)),hash3(a+vec3(1,0,1)),u.x),mix(hash3(a+vec3(0,1,1)),hash3(a+vec3(1,1,1)),u.x),u.y),u.z);}
float fbm3(vec3 p){return .64*noise3(p)+.26*noise3(p*2.03)+.1*noise3(p*4.01);}
float S(float x){x=clamp(x,0.,1.);return x*x*(3.-2.*x);}
void main(){
 float time=clock+7./3.,fade=S((clock-.39)/.06),a=col.a;
 vec3 n=normalize(aux.xyz),v=vec3(0,0,1);
 // Study key transformed from world coordinates into the orthographic view.
 vec3 keyDir=normalize(vec3(-.35,1.*.6614378+.65*.75,1.*.75-.65*.6614378));
 float facing=max(0.,dot(n,v)),rim=pow(1.-abs(dot(n,v)),1.6),key=max(0.,dot(n,keyDir));
 vec3 rgb;
 if(mode<2.5){
  float angle=uv.y*6.2831853;
  vec3 q=vec3(uv.x*.052-time*4.7,cos(angle)*1.7,sin(angle)*1.7+time*.38);
  q+=vec3(fbm3(q*.8+11.),fbm3(q*.8+23.),fbm3(q*.8+37.))*1.15;
  float billow=fbm3(q),crest=smoothstep(.44,.67,billow);
  float bands=pow(.5+.5*sin(uv.x*.12-time*55.+billow*7.),9.);
  // aux.w carries full lane length for cylinder materials.
  float u=uv.x/max(.01,aux.w);
  vec3 c=mix(vec3(.002,.105,.115),vec3(.035,1.05,.94),smoothstep(.25,.57,billow));
  c=mix(c,vec3(1.3,2.2,2.05),crest*.78);
  float pink=smoothstep(.40,.95,u)*smoothstep(.48,.68,billow)*(.20+.6*rim);
  c=mix(c,vec3(2.3,1.3,2.0),pink);
  rgb=c*(.42+.72*key)+vec3(.12,.6,.65)*rim+vec3(1.6,2.8,2.65)*bands*.11;
  if(mode<.5){a*=.98;if(fade>0.){if(noise3(vec3(uv.x*.13,uv.y*15.,seed))<fade*.7)discard;rgb=mix(rgb,mix(vec3(1.6,2.7,3.),vec3(3.1,1.25,2.8),u)*(.58+.46*key+.14*crest),S(fade/.65));}}
  else if(mode<1.5){rgb=mix(vec3(.40,.04,1.55),vec3(1.3,.23,2.8),rim);a*=rim*.65*(.7+.3*fbm3(vec3(u*6.,uv.y*6.,time*.6)));}
  else{float smoke=fbm3(vec3(u*13.-time*.35,uv.y*3.,seed));rgb=mix(vec3(.0005,.005,.005),vec3(.006,.052,.045),smoke);a*=pow(max(.001,abs(n.z)),.48)*smoothstep(0.,.045,u)*(1.-smoothstep(.95,1.,u));}
 }else if(mode<3.5){rgb=mix(vec3(.01,.55,.53),vec3(.12,2.2,1.9),.25+.75*key)+vec3(.3,1.7,1.6)*rim+vec3(2.,3.1,2.9)*pow(facing,5.);a*=.86;}
 else if(mode<4.5){rgb=mix(vec3(.18,1.4,1.5),vec3(2.8,3.7,3.4),.2+.8*facing)+vec3(.5,1.,1.2)*rim;}
 else if(mode<5.5){rgb=vec3(7,9,8);}
 else if(mode<6.5||mode>9.5){float noise=fbm3(vec3(uv*3.4,time*.3));rgb=col.rgb*aux.w*(.65+.5*noise);a*=pow(abs(n.z),1.15)*smoothstep(.18,.55,noise);}
 else if(mode<7.5){rgb=vec3(.001,.018,.016);a*=pow(abs(n.z),.6);}
 else if(mode<8.5){rgb=col.rgb*aux.w;}
 else{float r=length((uv-.5)*2.);rgb=col.rgb*aux.w;a*=exp(-r*r*3.)*(1.-smoothstep(.7,1.,r));}
 // Linear radiance packed into RGBA8 for bloom, avoiding a new HDR dependency.
 // Ink is composited afterwards and uses the approved exposure/gamma directly.
 if((mode>1.5&&mode<2.5)||(mode>6.5&&mode<7.5))rgb=pow(vec3(1)-exp(-rgb*1.05),vec3(1./2.2));
 else{rgb/=16.;float d=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453)-.5;rgb=max(vec3(0),rgb+d/255.);}
 gl_FragColor=vec4(rgb,a);
}
