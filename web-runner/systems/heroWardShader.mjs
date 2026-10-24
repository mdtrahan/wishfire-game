// Crimson Ward GPU aura: one shared WebGL canvas renders each warded hero's aura from the
// current puppet frame's alpha, then the 2D renderer composites it behind the sprite.
// Buff read, not fire: a calm pulsing glow from the silhouette, outline rings that expand and
// fade (the classic buff pulse) and small bright motes drifting up near the body. Two layers of a
// tileable noise texture drift through the glow so its brightness undulates; the noise never
// touches the alpha, so the silhouette stays clean (ragged edges read as fire).
// Returns false when WebGL is unavailable so the caller can use the 2D fallback.
import { runtimeAssetUrl } from './runtimeAssetUrl.mjs';

const VERTEX = `attribute vec2 aPos; varying vec2 vUv;
void main(){ vUv = vec2(aPos.x * .5 + .5, .5 - aPos.y * .5); gl_Position = vec4(aPos, 0., 1.); }`;
const FRAGMENT = `#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform sampler2D uTex, uNoise; uniform vec2 uSize; uniform vec4 uSprite;
uniform float uK, uTime, uHit, uBreak, uFlash, uAlpha;
varying vec2 vUv;
float spriteA(vec2 p){ vec2 uv = (p - uSprite.xy) / uSprite.zw;
  if (uv.x < 0. || uv.y < 0. || uv.x > 1. || uv.y > 1.) return 0.; return texture2D(uTex, uv).a; }
float hash(vec2 p){ p = fract(p * vec2(.1031, .1030)); p += dot(p, p.yx + 33.33); return fract((p.x + p.y) * p.x); }
void main(){
  // Sizes are in logical px (L). Heroes are ~28 L tall and only a few millimetres on a phone,
  // so the glow reaches ~10 L out to read at all.
  vec2 p = vUv * uSize; float L = uK, t = uTime;
  float body = spriteA(p), outside = 1. - body;
  float glow = 0.;
  for (int r = 1; r <= 5; r++) { float rad = float(r) * 2.1 * L, acc = 0.;
    for (int i = 0; i < 16; i++) { float a = float(i) * .3927 + float(r) * .2; acc += spriteA(p + vec2(cos(a), sin(a)) * rad); }
    glow += acc / 16. * (1.3 - float(r) * .22); }
  glow = clamp(glow / 1.35, 0., 1.);
  // Expanding outline ring: a band at a growing distance from the body, fading as it travels.
  float phase = fract(t * .7), ringR = (1.5 + phase * 10.) * L, inner = 0., outer = 0.;
  for (int i = 0; i < 16; i++) { float a = float(i) * .3927; vec2 d = vec2(cos(a), sin(a));
    inner += spriteA(p + d * (ringR - 1.2 * L)); outer += spriteA(p + d * (ringR + 1.2 * L)); }
  float ring = clamp((outer - inner * .35) / 16., 0., 1.) * (1. - phase) * (1. - phase);
  // Rising motes: at most one per grid cell, drifting upward, only where the glow is.
  vec2 cell = p / (7. * L) + vec2(0., t * .55), id = floor(cell), f = fract(cell) - .5;
  vec2 c = vec2(hash(id) - .5, hash(id + 7.3) - .5) * .6;
  float twinkle = .5 + .5 * sin(t * 5. + hash(id + 3.1) * 6.283);
  float mote = smoothstep(.16, 0., length(f - c)) * step(.55, hash(id + 1.7)) * twinkle * smoothstep(.05, .35, glow);
  // Undulating light: two noise layers at different scales drift in different directions; their
  // product only recolours the glow (dim crimson to bright orange), so light rolls around a clean shape.
  vec2 w = p / L;
  float n1 = texture2D(uNoise, w / 46. + vec2(t * .045, -t * .07)).r;
  float n2 = texture2D(uNoise, vec2(w.x + w.y * .6, w.y - w.x * .6) / 29. + vec2(-t * .06, -t * .11)).r;
  float flow = clamp(n1 * n2 * 2.6, 0., 1.6);
  float pulse = .72 + .28 * sin(t * 3.);
  float edge = 0.; for (int i = 0; i < 8; i++) { float a = float(i) * .7854; edge += spriteA(p + vec2(cos(a), sin(a)) * 1.2 * L); }
  edge = edge / 8. * outside;
  float I = (glow * pulse * .8 + ring * .9) * outside * (1. + uHit * 1.3), light = I * (.45 + .75 * flow);
  vec3 deep = vec3(.55, .0, .12), crimson = vec3(.92, .06, .2), orange = vec3(1., .42, .12), white = vec3(1., .9, .8);
  vec3 col = mix(deep, crimson, smoothstep(.04, .35, light));
  col = mix(col, orange, smoothstep(.35, .9, light) * smoothstep(.45, 1.1, flow));
  col = mix(col, white, smoothstep(.85, 1.2, light + edge * .3) * .5);
  col = mix(col, white, clamp(mote + uHit * edge + uFlash * edge * 2., 0., 1.));
  float alpha = clamp(smoothstep(.02, .45, I) * .8 + edge * (.45 + uFlash) + mote * outside, 0., 1.) * uAlpha * (1. - uBreak);
  gl_FragColor = vec4(col * alpha, alpha);
}`;
const TEXTURE_LIMIT = 64, NOISE_PATH = 'images/vfx_ward_noise.png';
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
    const u = Object.fromEntries(['uTex', 'uNoise', 'uSize', 'uSprite', 'uK', 'uTime', 'uHit', 'uBreak', 'uFlash', 'uAlpha'].map(name => [name, gl.getUniformLocation(program, name)]));
    gl.uniform1i(u.uTex, 0); gl.uniform1i(u.uNoise, 1);
    // Noise starts as flat mid-grey so the aura draws before the image arrives.
    const noise = gl.createTexture();
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, noise);
    for (const [key, value] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.REPEAT], [gl.TEXTURE_WRAP_T, gl.REPEAT]]) gl.texParameteri(gl.TEXTURE_2D, key, value);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([140, 140, 140, 255]));
    const image = new Image();
    image.onload = () => { if (gl.isContextLost()) return; gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, noise); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image); gl.activeTexture(gl.TEXTURE0); };
    image.src = runtimeAssetUrl(NOISE_PATH);
    gl.activeTexture(gl.TEXTURE0);
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
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, frameTexture(g, frame));
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
