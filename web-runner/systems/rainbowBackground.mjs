// Native WebGL time/resolution pattern: https://webglfundamentals.org/webgl/lessons/webgl-shadertoy.html
// Authored pearly stream shader; no external shader asset or rendering dependency.
export function createRainbowBackground(host){
 const canvas=document.createElement('canvas');canvas.className='rainbow';canvas.setAttribute('aria-hidden','true');host.prepend(canvas);
 const gl=canvas.getContext('webgl',{alpha:false,antialias:false,depth:false});
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 let program,position,time,resolution,lightPositions,lightColors,last=-Infinity;
 const positions=new Float32Array(32),colors=new Float32Array(48);
 function setup(){
  const shaders=[];
  try{
   for(const [type,source] of [[gl.VERTEX_SHADER,'attribute vec2 position;void main(){gl_Position=vec4(position,0.,1.);}'],[gl.FRAGMENT_SHADER,`
    precision mediump float;
    uniform vec2 resolution;uniform float time;
    uniform vec2 lights[16];uniform vec3 colors[16];
    void main(){
     vec2 uv=gl_FragCoord.xy/resolution;
     // Broad, asymmetric folds with travelling reflections rather than round ridges.
     float ribbon=uv.x*7.+.065*sin(uv.y*5.+time*.32)+.035*sin(uv.y*11.-time*.21);
     float band=floor(ribbon),face=fract(ribbon);
     float edge=exp(-face*65.);
     float reflection=.5+.5*sin(uv.y*13.-time*.85+band*1.7+face*2.);
     float sheen=pow(reflection,6.);
     float slope=pow(face,3.);
     vec3 color=vec3(.965,.972,.98)-slope*.09*(.35+.65*reflection)+sheen*.077;
     vec3 prism=.5+.5*cos(vec3(0.,2.1,4.2)+face*45.+uv.y*3.-time*.35);
     color-=edge*(vec3(1.)-prism)*(.049+.168*reflection);
     vec3 tint=vec3(0.);float weight=0.;
     for(int i=0;i<16;i++){
      // Each fold refracts the item influence into a separate strip of reflected color.
      vec2 reflected=uv+vec2((face-.5)*.065,sin(band*1.7)*.055+face*.07);
      // The anchor is the card's upper edge. Only pixels behind it receive a wake.
      float behind=(uv.y-lights[i].y)*resolution.y/resolution.x;
      vec2 delta=reflected-lights[i];
      float bloom=exp(-pow(delta.x/.09,2.)-max(behind,0.)/.136);
      bloom*=step(0.,behind)*(1.-smoothstep(.256,.384,behind));
      bloom*=1.-smoothstep(.095,.125,abs(uv.x-lights[i].x));
      bloom*=smoothstep(.04,.24,face)*(1.-smoothstep(.65,.98,face))*(.3+.7*reflection);
      tint+=colors[i]*bloom;weight+=bloom;
     }
     if(weight>0.)color=mix(color,tint/max(weight,.001),min(weight*1.7,.8));
     color+=edge*.056+sheen*.049;
     gl_FragColor=vec4(color,1.);
    }`]]){
    const shader=gl.createShader(type);shaders.push(shader);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));
   }
   program=gl.createProgram();shaders.forEach(s=>gl.attachShader(program,s));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
   gl.useProgram(program);const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
   position=gl.getAttribLocation(program,'position');gl.enableVertexAttribArray(position);gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
   time=gl.getUniformLocation(program,'time');resolution=gl.getUniformLocation(program,'resolution');lightPositions=gl.getUniformLocation(program,'lights[0]');lightColors=gl.getUniformLocation(program,'colors[0]');canvas.hidden=false;canvas.dataset.renderer='webgl';last=-Infinity;
  }catch(error){if(program)gl.deleteProgram(program);program=null;canvas.hidden=true;canvas.dataset.renderer='fallback';console.warn('Rainbow background unavailable:',error.message);}
  finally{shaders.forEach(s=>gl.deleteShader(s));}
 }
 reduced.addEventListener('change',()=>{last=-Infinity;});
 if(gl)setup();else{canvas.hidden=true;canvas.dataset.renderer='fallback';}
 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();program=null;canvas.hidden=true;});
 canvas.addEventListener('webglcontextrestored',setup);
 return {draw(width,height,items=[]){
  if(!program||document.hidden)return;
  // Soft background needs at most 360 pixels across; preserve sharp native DOM controls.
  const scale=Math.min(1,360/width),w=Math.max(1,Math.round(width*scale)),h=Math.max(1,Math.round(height*scale));
  const resized=canvas.width!==w||canvas.height!==h,now=performance.now();
  if(!resized&&(reduced.matches?last!==-Infinity:now-last<33))return;
  if(resized){canvas.width=w;canvas.height=h;gl.viewport(0,0,w,h);}
  positions.fill(-10);colors.fill(0);
  items.slice(0,16).forEach((item,i)=>{positions[i*2]=item.x;positions[i*2+1]=1-item.y;const hex=parseInt(item.color.slice(1),16);colors[i*3]=((hex>>16)&255)/255;colors[i*3+1]=((hex>>8)&255)/255;colors[i*3+2]=(hex&255)/255;});
  gl.uniform2fv(lightPositions,positions);gl.uniform3fv(lightColors,colors);
  gl.uniform2f(resolution,w,h);gl.uniform1f(time,reduced.matches?0:now/1000);gl.drawArrays(gl.TRIANGLES,0,3);last=now;
 }};
}
