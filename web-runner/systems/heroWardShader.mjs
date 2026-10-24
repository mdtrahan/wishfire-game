// Crimson Ward GPU aura: one shared WebGL canvas renders each warded hero's aura from the
// current puppet frame's alpha, then the 2D renderer composites it behind the sprite.
// Glow = distance falloff from the silhouette; flames = noise-warped silhouette lifted upward.
// Returns false when WebGL is unavailable so the caller can use the 2D fallback.
const VERTEX = `attribute vec2 aPos; varying vec2 vUv;
void main(){ vUv = vec2(aPos.x * .5 + .5, .5 - aPos.y * .5); gl_Position = vec4(aPos, 0., 1.); }`;
const FRAGMENT = `precision mediump float;
uniform sampler2D uTex; uniform vec2 uSize; uniform vec4 uSprite;
uniform float uK, uTime, uHit, uBreak, uFlash, uAlpha;
varying vec2 vUv;
float spriteA(vec2 p){ vec2 uv = (p - uSprite.xy) / uSprite.zw;
  if (uv.x < 0. || uv.y < 0. || uv.x > 1. || uv.y > 1.) return 0.; return texture2D(uTex, uv).a; }
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1., 0.)), f.x), mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), f.x), f.y); }
float fbm(vec2 p){ float v = 0., a = .5; for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.03; a *= .5; } return v; }
void main(){
  vec2 p = vUv * uSize; float L = uK;
  float body = spriteA(p), outside = 1. - body;
  // Soft glow: average silhouette coverage on rings of growing radius.
  float glow = 0.;
  for (int r = 1; r <= 4; r++) { float rad = float(r) * 1.25 * L, acc = 0.;
    for (int i = 0; i < 12; i++) { float a = float(i) * .5236; acc += spriteA(p + vec2(cos(a), sin(a)) * rad); }
    glow += acc / 12. * (1.15 - float(r) * .2); }
  glow = clamp(glow / 1.6, 0., 1.);
  // Flames: look below this pixel through a noise warp, so energy appears to rise off the contour.
  vec2 q = p / L; float t = uTime;
  float n = fbm(vec2(q.x * .32, q.y * .22 + t * 2.4)), n2 = fbm(vec2(q.x * .65 + 3., q.y * .45 + t * 3.3));
  float lift = (2.5 + 7.5 * n) * L * (1. + uBreak * 2.5), flame = 0.;
  for (int s = 1; s <= 5; s++) { float d = lift * float(s) / 5.;
    flame += spriteA(p + vec2((n2 - .5) * 2.5 * L, d)) * (1.2 - float(s) * .18); }
  flame = clamp(flame / 2.4, 0., 1.) * smoothstep(.38, .72, n2 + .12);
  float edge = 0.; for (int i = 0; i < 8; i++) { float a = float(i) * .7854; edge += spriteA(p + vec2(cos(a), sin(a)) * .9 * L); }
  edge = edge / 8. * outside;
  float I = max(glow * .85, flame) * outside * (.88 + .12 * sin(t * 6.)) * (1. + uHit * 1.1);
  vec3 deep = vec3(.45, .0, .1), crimson = vec3(.82, .03, .2), hot = vec3(1., .22, .34), white = vec3(1., .78, .82);
  vec3 col = mix(deep, crimson, smoothstep(.05, .4, I));
  col = mix(col, hot, smoothstep(.5, .95, I + edge * .3));
  col = mix(col, white, clamp(smoothstep(.8, 1.15, I + edge * .55) * (.35 + uHit) + uFlash * edge * 2., 0., 1.));
  float alpha = clamp(smoothstep(.03, .5, I) * .85 + edge * (.28 + uFlash), 0., 1.) * uAlpha * (1. - uBreak);
  gl_FragColor = vec4(col * alpha, alpha);
}`;
const TEXTURE_LIMIT = 64;
let gpu, failed = false;

function setup() {
  if (failed) return null;
  if (gpu && !gpu.gl.isContextLost()) return gpu;
  try {
    if (typeof document === 'undefined') throw new Error('no document');
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
    const gl = canvas.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false, preserveDrawingBuffer: true });
    if (!gl) throw new Error('no webgl');
    const shader = (type, source) => { const s = gl.createShader(type); gl.shaderSource(s, source); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const program = gl.createProgram();
    gl.attachShader(program, shader(gl.VERTEX_SHADER, VERTEX)); gl.attachShader(program, shader(gl.FRAGMENT_SHADER, FRAGMENT));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const pos = gl.getAttribLocation(program, 'aPos'); gl.enableVertexAttribArray(pos); gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);
    const u = Object.fromEntries(['uTex', 'uSize', 'uSprite', 'uK', 'uTime', 'uHit', 'uBreak', 'uFlash', 'uAlpha'].map(name => [name, gl.getUniformLocation(program, name)]));
    gl.uniform1i(u.uTex, 0);
    canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); gpu = null; });
    gpu = { canvas, gl, u, textures: new Map() };
    return gpu;
  } catch { failed = true; return null; }
}

function frameTexture({ gl, textures }, frame) {
  const cached = textures.get(frame);
  if (cached) { textures.delete(frame); textures.set(frame, cached); return cached; }
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  for (const [key, value] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, key, value);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, frame);
  textures.set(frame, texture);
  if (textures.size > TEXTURE_LIMIT) { const [old, tex] = textures.entries().next().value; gl.deleteTexture(tex); textures.delete(old); }
  return texture;
}

// Draw the aura for one hero onto ctx behind its sprite. rect is the sprite rect in canvas units.
export function drawHeroWardShader(ctx, { frame, rect, k, pad, time, hit = 0, breakU = 0, alpha = 1 }) {
  const g = setup();
  if (!g) return false;
  const { gl, canvas, u } = g;
  const W = Math.ceil(rect.width * k + 2 * pad), H = Math.ceil(rect.height * k + 2 * pad);
  if (canvas.width < W || canvas.height < H) { canvas.width = Math.max(canvas.width, W); canvas.height = Math.max(canvas.height, H); }
  try {
    gl.bindTexture(gl.TEXTURE_2D, frameTexture(g, frame));
    gl.viewport(0, canvas.height - H, W, H);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(u.uSize, W, H); gl.uniform4f(u.uSprite, pad, pad, rect.width * k, rect.height * k);
    gl.uniform1f(u.uK, k); gl.uniform1f(u.uTime, time); gl.uniform1f(u.uHit, hit);
    gl.uniform1f(u.uBreak, breakU < .11 ? 0 : breakU); gl.uniform1f(u.uFlash, breakU > 0 && breakU < .11 ? 1 : 0); gl.uniform1f(u.uAlpha, alpha);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  } catch { failed = true; return false; }
  ctx.drawImage(canvas, 0, 0, W, H, rect.drawX - pad / k, rect.drawY - pad / k, W / k, H / k);
  return true;
}
