import { sliceFragment } from './rustCombatShader.mjs';
import { sampleRustVfx, rustVfxFrameAlpha } from './rustCombatAssets.mjs';
const VERTEX = `attribute vec3 position;attribute vec2 texcoord;attribute vec4 color0,normal;uniform float snap;uniform vec2 snapSize;varying vec2 uv;varying vec4 col,aux;void main(){uv=texcoord;col=color0;aux=normal;gl_Position=vec4(position.x/180.-1.,1.-position.y/320.,position.z,1.);if(snap>.5){vec2 g=snapSize;gl_Position.xy=(floor((gl_Position.xy*.5+.5)*g)+.5)/g*2.-1.;}}`;
// Reusable CPU and GPU buffers; drawing allocates no arrays or typed views.
export class SliceGpu {
  constructor(assets) {
    this.canvas = document.createElement('canvas');
    const gl = this.gl = this.canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, preserveDrawingBuffer: true });
    if (!gl) throw new Error('Rust slice VFX require WebGL');
    const compile = (type, source) => {
      const shader = gl.createShader(type); gl.shaderSource(shader, source); gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
      return shader;
    };
    const program = this.program = gl.createProgram();
    gl.attachShader(program, compile(gl.VERTEX_SHADER, VERTEX)); gl.attachShader(program, compile(gl.FRAGMENT_SHADER, sliceFragment)); gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    gl.useProgram(program);
    this.data = new Float32Array(13 * 12288); this.count = 0;
    this.uploadViews = Array.from({length:4097},(_,triangles)=>new Float32Array(this.data.buffer,0,triangles*39));
    this.buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer); gl.bufferData(gl.ARRAY_BUFFER, this.data.byteLength, gl.DYNAMIC_DRAW);
    for (const [name, size, offset] of [['position',3,0],['texcoord',2,3],['color0',4,5],['normal',4,9]]) {
      const index = gl.getAttribLocation(program, name); gl.enableVertexAttribArray(index); gl.vertexAttribPointer(index,size,gl.FLOAT,false,52,offset*4);
    }
    this.modeUniform = gl.getUniformLocation(program,'mode'); this.clockUniform = gl.getUniformLocation(program,'clock');
    this.snapUniform = gl.getUniformLocation(program,'snap'); this.sizeUniform = gl.getUniformLocation(program,'snapSize'); this.sampleUniform = gl.getUniformLocation(program,'sampleSize');
    this.lightModeUniform=gl.getUniformLocation(program,'ActorLightMode');this.hueUniform=gl.getUniformLocation(program,'HueStrength');this.tintUniform=gl.getUniformLocation(program,'ActorTint');this.liftUniform=gl.getUniformLocation(program,'ActorLift');this.actorTextures=new Map();
    this.mode = -1; this.blend = ''; this.texture = null; this.clock = 0;
    this.assets = assets.entries;
    this.textures = new Map(); this.resources = [];
    for (const art of this.assets.values()) if (!this.textures.has(art.image)) this.textures.set(art.image, this.upload(art.image, true));
    const pixels = new Uint8Array(64*64*4), bands = new Float32Array(64); let seed = 471;
    const random = () => { seed=(Math.imul(seed,1664525)+1013904223)>>>0; return seed/4294967296; };
    for(let i=0;i<64;i++) bands[i]=random();
    for(let y=0;y<64;y++) for(let x=0;x<64;x++) { const i=(y*64+x)*4; pixels[i]=pixels[i+1]=pixels[i+2]=255; pixels[i+3]=Math.min(255,Math.floor((.08+random()*.24+bands[x]**3*.7+((y+x*3)%23<2?.32:0))*255)); }
    const stone=new Uint8Array(64*64*4),mask=new Uint8Array(64*64*4),palette=[0x4a3020,0x634027,0x7d502e,0xa07040,0xb3844d,0xbf965c,0xc9a46a];
    const hash=(x,y)=>{const v=Math.sin(x*127.1+y*311.7+19.17)*43758.5453;return v-Math.floor(v);};
    const noise=(x,y)=>{const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy);return(hash(ix,iy)*(1-u)+hash(ix+1,iy)*u)*(1-v)+(hash(ix,iy+1)*(1-u)+hash(ix+1,iy+1)*u)*v;};
    for(let y=0;y<64;y++)for(let x=0;x<64;x++){const n=.65*noise(x/15,y/15)+.25*noise(x/7+13,y/7+9)+.10*noise(x/3+27,y/3+31),p=palette[Math.round(Math.max(0,Math.min(1,(n-.25)/.5))*6)],i=(y*64+x)*4;stone[i]=p>>16;stone[i+1]=p>>8;stone[i+2]=p;stone[i+3]=255;}
    for(const [name,unit] of [['Pattern',1],['Mask',2],['Stone',3]]) {
      gl.activeTexture(gl.TEXTURE0+unit); const texture=gl.createTexture(); if(name==='Mask')this.maskTexture=texture; this.resources.push(texture);gl.bindTexture(gl.TEXTURE_2D,texture);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,64,64,0,gl.RGBA,gl.UNSIGNED_BYTE,name==='Stone'?stone:name==='Mask'?mask:pixels);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.REPEAT);gl.uniform1i(gl.getUniformLocation(program,name),unit);
    }
    gl.activeTexture(gl.TEXTURE0); gl.uniform1i(gl.getUniformLocation(program,'Texture'),0); gl.enable(gl.BLEND);
  }
  upload(image, linear) {
    const gl=this.gl, texture=gl.createTexture(); this.resources.push(texture);gl.bindTexture(gl.TEXTURE_2D,texture);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,linear?gl.LINEAR:gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,linear?gl.LINEAR:gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);return texture;
  }
  begin(density,ctx,scale,offsetX,offsetY) {
    this.ctx=ctx;this.scale=scale;this.offsetX=offsetX;this.offsetY=offsetY;this.groupOp='source-over';this.hasDraw=false;
    const gl=this.gl, w=Math.max(1,Math.round(360*density)),h=Math.max(1,Math.round(640*density));
    if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;}
    gl.viewport(0,0,w,h);gl.depthMask(true);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);this.count=0;this.texture=null;this.mode=-99;this.blend='';
    gl.useProgram(this.program);gl.uniform2f(this.sizeUniform,w,h);gl.uniform2f(this.sampleUniform,w,h);gl.uniform1f(this.snapUniform,0);
  }
  use(mode, blend='alpha', texture=null, clock=0) {
    if(this.mode===mode&&this.blend===blend&&this.texture===texture&&this.clock===clock)return;
    this.flush();const operation=blend==='additive'?'lighter':'source-over';if(operation!==this.groupOp){this.blit();this.groupOp=operation;}const gl=this.gl;this.mode=mode;this.blend=blend;this.texture=texture;this.clock=clock;
    gl.uniform1f(this.modeUniform,mode);gl.uniform1f(this.clockUniform,clock);gl.uniform1f(this.snapUniform,mode>=0?1:0);
    if(blend==='solid'||blend==='gas'){gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.depthMask(blend==='solid');}else{gl.disable(gl.DEPTH_TEST);gl.depthMask(false);}
    gl.blendFuncSeparate(gl.SRC_ALPHA,blend==='additive'?gl.ONE:gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
    if(texture){gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);}
  }
  flush() {
    if(!this.count)return;const gl=this.gl;gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);gl.bufferSubData(gl.ARRAY_BUFFER,0,this.uploadViews[this.count/3]);gl.drawArrays(gl.TRIANGLES,0,this.count);this.count=0;this.hasDraw=true;
  }
  vertex(x,y,z,u,v,color,alpha,nx=0,ny=0,nz=0,nw=1) {
    if(this.count===12288)this.flush();let i=this.count++*13;const a=this.data;
    a[i++]=x;a[i++]=y;a[i++]=z;a[i++]=u;a[i++]=v;a[i++]=((color>>>16)&255)/255;a[i++]=((color>>>8)&255)/255;a[i++]=(color&255)/255;a[i++]=Math.min(1,alpha);a[i++]=nx;a[i++]=ny;a[i++]=nz;a[i]=nw;
  }
  quad(x,y,w,h,rotation,color,alpha,mode=0,blend='additive',clock=0,aux=0,auxY=0) {
    if(alpha<=.0001)return;this.use(mode,blend,null,clock);
    const c=Math.cos(rotation),s=Math.sin(rotation),wx=w*c/2,wy=w*s/2,hx=-h*s/2,hy=h*c/2,gain=Math.max(1,alpha);
    this.vertex(x-wx-hx,y-wy-hy,0,0,0,color,alpha,aux,auxY,0,gain);this.vertex(x+wx-hx,y+wy-hy,0,1,0,color,alpha,aux,auxY,0,gain);this.vertex(x+wx+hx,y+wy+hy,0,1,1,color,alpha,aux,auxY,0,gain);
    this.vertex(x-wx-hx,y-wy-hy,0,0,0,color,alpha,aux,auxY,0,gain);this.vertex(x+wx+hx,y+wy+hy,0,1,1,color,alpha,aux,auxY,0,gain);this.vertex(x-wx+hx,y-wy+hy,0,0,1,color,alpha,aux,auxY,0,gain);
  }
  ring(x,y,rx,ry,width,color,alpha,n=32) {
    if(alpha<=0)return;this.use(-3,'additive');
    for(let i=0;i<n;i++){const a=i/n*Math.PI*2,b=(i+1)/n*Math.PI*2,ax=Math.cos(a),ay=Math.sin(a),bx=Math.cos(b),by=Math.sin(b),iw=width/2;
      this.vertex(x+ax*(rx-iw),y+ay*(ry-iw),0,.5,.5,color,alpha);this.vertex(x+ax*(rx+iw),y+ay*(ry+iw),0,.5,.5,color,alpha);this.vertex(x+bx*(rx-iw),y+by*(ry-iw),0,.5,.5,color,alpha);
      this.vertex(x+ax*(rx+iw),y+ay*(ry+iw),0,.5,.5,color,alpha);this.vertex(x+bx*(rx+iw),y+by*(ry+iw),0,.5,.5,color,alpha);this.vertex(x+bx*(rx-iw),y+by*(ry-iw),0,.5,.5,color,alpha);
    }
  }
  glow(x,y,size,color,alpha) {this.quad(x,y,size,size,0,color,alpha);}
  solidLine(x,y,qx,qy,width,color,alpha) {this.quad((x+qx)/2,(y+qy)/2,Math.hypot(qx-x,qy-y),width,Math.atan2(qy-y,qx-x),color,alpha,-3,'alpha');}
  line(x,y,qx,qy,width,color,alpha) {this.quad((x+qx)/2,(y+qy)/2,Math.hypot(qx-x,qy-y),width,Math.atan2(qy-y,qx-x),color,alpha);}
  bitmap(id,frame,x,y,w=0,h=0,rotation=0,alpha=1,color=0xffffff,mirror=false) {
    const e=this.assets.get(id);if(!e)throw new Error(`Missing slice effect: ${id}`);if(alpha<=0)return;
    if(w===0&&h===0){w=e.screen_size_px[0];h=e.screen_size_px[1];}
    const fw=e.frame_size[0],fh=e.frame_size[1],ix=Math.min(frame,e.frame_count-1),texture=this.textures.get(e.image);
    this.use(id.startsWith('charge-')||id==='crit-poison'?-2:-1,e.blend,texture);
    const px=e.centered?w*.5:e.pivot[0]/fw*w,py=e.centered?h*.5:e.pivot[1]/fh*h,c=Math.cos(rotation),s=Math.sin(rotation),left=-px,right=w-px,top=-py,bottom=h-py;
    const u0=(ix*fw+.5)/e.image.width,u1=((ix+1)*fw-.5)/e.image.width,v0=.5/fh,v1=1-.5/fh;
    const ua=mirror?u1:u0,ub=mirror?u0:u1;
    this.vertex(x+left*c-top*s,y+left*s+top*c,0,ua,v0,color,alpha);this.vertex(x+right*c-top*s,y+right*s+top*c,0,ub,v0,color,alpha);this.vertex(x+right*c-bottom*s,y+right*s+bottom*c,0,ub,v1,color,alpha);
    this.vertex(x+left*c-top*s,y+left*s+top*c,0,ua,v0,color,alpha);this.vertex(x+right*c-bottom*s,y+right*s+bottom*c,0,ub,v1,color,alpha);this.vertex(x+left*c-bottom*s,y+left*s+bottom*c,0,ua,v1,color,alpha);
  }
  mask(canvas){const gl=this.gl;this.flush();gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,this.maskTexture);if(this.maskWidth!==canvas.width||this.maskHeight!==canvas.height){gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,canvas);this.maskWidth=canvas.width;this.maskHeight=canvas.height;}else gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,gl.RGBA,gl.UNSIGNED_BYTE,canvas);gl.activeTexture(gl.TEXTURE0);}
  actor(image,x,y,w,h,alpha,hue,strength,tr,tg,tb,lift=0,blend='alpha',angle=0,px=x+w/2,py=y+h,lightMode=-1){
    let texture=this.actorTextures.get(image);if(!texture){this.flush();texture=this.upload(image,true);this.actorTextures.set(image,texture);this.texture=null;}
    this.use(lightMode<0?-4:-5,blend,texture);this.flush();const gl=this.gl;
    gl.uniform4f(this.hueUniform,(hue>>16&255)/255,(hue>>8&255)/255,(hue&255)/255,strength);gl.uniform3f(this.tintUniform,tr,tg,tb);gl.uniform1f(this.liftUniform,lift);gl.uniform1f(this.lightModeUniform,lightMode);
    const co=Math.cos(angle),si=Math.sin(angle),lx=x-px,rx=x+w-px,ty=y-py,by=y+h-py,ax=px+lx*co-ty*si,ay=py+lx*si+ty*co,bx=px+rx*co-ty*si,by0=py+rx*si+ty*co,cx=px+rx*co-by*si,cy=py+rx*si+by*co,dx=px+lx*co-by*si,dy=py+lx*si+by*co;
    this.vertex(ax,ay,0,0,0,0xffffff,alpha);this.vertex(bx,by0,0,1,0,0xffffff,alpha);this.vertex(cx,cy,0,1,1,0xffffff,alpha);
    this.vertex(ax,ay,0,0,0,0xffffff,alpha);this.vertex(cx,cy,0,1,1,0xffffff,alpha);this.vertex(dx,dy,0,0,1,0xffffff,alpha);this.flush();
  }
  strip(id,x,y,qx,qy,height,alpha=1,color=0xffffff){const e=this.assets.get(id),dx=qx-x,dy=qy-y,length=Math.hypot(dx,dy);if(length<.001)return;const width=length*e.frame_size[0]/e.boundsWidth,offset=(e.pivot[0]-e.boundsX)/e.frame_size[0]*width;this.bitmap(id,0,x+dx/length*offset,y+dy/length*offset,width,height,Math.atan2(dy,dx),alpha,color);}
  once(id,age,x,y,w=0,h=0,rotation=0,alpha=1,color=0xffffff,mirror=false) {const e=this.assets.get(id);if(!e)throw new Error(`Missing slice effect: ${id}`);const frame=sampleRustVfx(e,age);if(frame>=0)this.bitmap(id,frame,x,y,w,h,rotation,alpha*rustVfxFrameAlpha(e,age,frame),color,mirror);}
  blit(){if(!this.hasDraw)return;const ctx=this.ctx;ctx.save();ctx.globalCompositeOperation=this.groupOp;ctx.drawImage(this.canvas,this.offsetX,this.offsetY,360*this.scale,640*this.scale);ctx.restore();this.gl.clear(this.gl.COLOR_BUFFER_BIT);this.hasDraw=false;}
  composite(){this.flush();this.blit();}
  dispose() {const gl=this.gl;for(const t of this.resources)gl.deleteTexture(t);gl.deleteBuffer(this.buffer);gl.deleteProgram(this.program);gl.getExtension('WEBGL_lose_context')?.loseContext();this.assets.clear();this.actorTextures.clear();}
}
