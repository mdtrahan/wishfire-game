/* Tiny example; approved spell recipes remain in the sibling specs/reference-code. */
(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  if (!window.THREE) {
    $('#error').hidden = false;
    $('#error').textContent = 'Fetch pinned three.js into vendor/three.min.js. See README.md.';
    return;
  }
  const T = THREE, F = VFX, W = 360, H = 640, duration = 2.2;
  const params = new URLSearchParams(location.search), requested = params.get('vfxres');
  const level = /^[0-3]$/.test(requested) ? Number(requested) : 3, ps1 = params.get('ps1') !== '0';
  const divisor = [6, 3, 1.5, 1][level], stylized = level !== 3 || ps1;
  const renderer = new T.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.domElement.setAttribute('aria-label', 'Tiny comet on sand with placeholder actors');
  $('#stage').append(renderer.domElement);
  const scene = new T.Scene(), mistScene = new T.Scene();
  scene.background = new T.Color('#dbc69d');
  const camera = new T.OrthographicCamera(-W / 2, W / 2, H / 2, -H / 2, 1, 2500);
  camera.position.set(0, .75 * 1000, Math.sqrt(1 - .75 ** 2) * 1000);
  camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  // Sim -> design units: zoom .5; camera projects ground z at squash .75.
  const groundPoint = (x, y) => new T.Vector3(x * .5, 0, y * .5);
  const ground = new T.Mesh(new T.PlaneGeometry(2160 * .5, 900 * .5), new T.MeshBasicMaterial({ color: '#d3b780' }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -1; scene.add(ground);
  function actor(x, y, color, sourceFacing, actorFacesLeft) {
    const geo = new T.PlaneGeometry(30, 58); geo.translate(0, 29, 0);
    // Plain asymmetrical quad silhouette, no external art or altered source pixels.
    const flip = (sourceFacing === 'left') !== actorFacesLeft;
    if (flip) { const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i)); }
    const mat = F.material(`varying vec2 vUv;uniform vec3 color;void main(){
      float tip=step(.78,vUv.x)*step(.52,vUv.y)*step(vUv.y,.72);
      vec3 c=mix(color,vec3(.96,.90,.67),tip);gl_FragColor=vec4(c,1.);
      #include <colorspace_fragment>
    }`, { color: { value: new T.Color(color) } }, { additive: false });
    mat.depthWrite = true; mat.transparent = false;
    const object = new T.Mesh(geo, mat); object.position.copy(groundPoint(x, y));
    object.quaternion.copy(camera.quaternion); object.userData.flip = flip; scene.add(object); return object;
  }
  const caster = actor(-180, 200, '#7650a3', 'right', false);
  const target = actor(90, -90, '#68593c', 'right', true);
  const start = caster.position.clone().add(new T.Vector3(0, 42, 0));
  const end = target.position.clone().add(new T.Vector3(0, 29, 0));
  const fx = new T.Group(), mistFX = new T.Group(); scene.add(fx); mistScene.add(mistFX);
  const rt = new T.WebGLRenderTarget(1, 1, { minFilter: T.NearestFilter, magFilter: T.NearestFilter });
  F.sampling.ps1.value = stylized;
  const post = new T.Scene(), postCamera = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const postMaterial = new T.ShaderMaterial({
    uniforms: { map: { value: rt.texture }, ...F.sampling }, vertexShader: F.uvVertex, depthTest: false, depthWrite: false,
    fragmentShader: `varying vec2 vUv;uniform sampler2D map;uniform vec2 snapGrid;uniform bool ps1;
      float bayer(vec2 p){vec2 q=mod(floor(p),4.);float x=q.x,y=q.y;
        return mod(x,2.)*8.+mod(y,2.)*12.-mod(x,2.)*mod(y,2.)*16.+floor(x/2.)*2.+floor(y/2.)*3.-floor(x/2.)*floor(y/2.)*4.;}
      void main(){gl_FragColor=vec4(texture2D(map,vUv).rgb,1.);
        #include <colorspace_fragment>
        if(ps1){float d=(bayer(floor(vUv*snapGrid))/16.-.5)/31.;
        gl_FragColor.rgb=floor(clamp(gl_FragColor.rgb+d,0.,1.)*31.+.5)/31.;}}`
  });
  post.add(new T.Mesh(new T.PlaneGeometry(2, 2), postMaterial));
  let seed = 91731, time = 0, speed = 1, playing = !location.search.includes('capture'), last = performance.now();
  let curve, trail, head, charge, gas, mist;
  const drawingBuffer = new T.Vector2();
  let cssWidth = 0, cssHeight = 0, dpr = 0;
  function resize() {
    const rect = $('#stage').getBoundingClientRect(), ratio = window.devicePixelRatio || 1;
    if (rect.width === cssWidth && rect.height === cssHeight && ratio === dpr) return false;
    cssWidth = rect.width; cssHeight = rect.height; dpr = ratio;
    renderer.setPixelRatio(dpr); renderer.setSize(cssWidth, cssHeight, false);
    renderer.getDrawingBufferSize(drawingBuffer);
    rt.setSize(Math.max(1, Math.round(drawingBuffer.x / divisor)), Math.max(1, Math.round(drawingBuffer.y / divisor)));
    F.sampling.snapGrid.value.set(rt.width, rt.height);
    return true;
  }
  function build(value) {
    const random = F.rng(value); // Validate before disposing the current cast.
    seed = value; F.dispose(fx); F.dispose(mistFX);
    const offset = 24 + random() * 35;
    curve = new T.CubicBezierCurve3(start, start.clone().add(new T.Vector3(-offset, 45, -20)),
      end.clone().add(new T.Vector3(offset, 30, 30)), end);
    trail = F.ribbon(fx, camera); trail.object.renderOrder = 2;
    head = F.glow(fx, camera, 22, '#60eaff', { depthTest: false }); head.renderOrder = 3;
    charge = F.glow(fx, camera, 36, '#a433ff', { depthTest: false }); charge.position.copy(start);
    gas = F.gasParticles(fx, camera, random, target.position, 8);
    mist = F.mistPoints(mistFX, random, end, 120);
    $('#seed').value = seed; $('#seedLabel').textContent = `Seed ${seed}`;
  }
  function render(t) {
    resize();
    time = t;
    const age = t - .2, p = F.clamp(age / .7), arrived = t - .9;
    charge.material.uniforms.alpha.value = t < .3 ? Math.sin(t / .3 * Math.PI) : 0;
    trail.update(u => curve.getPoint(Math.max(0, p - .22) + Math.min(p, .22) * u), 6, age >= 0 && age < .7 ? 1 : 0);
    head.position.copy(curve.getPoint(p)); head.material.uniforms.alpha.value = age >= 0 && age < .7 ? 2 : 0;
    gas.update(arrived); mist.update(arrived, renderer.domElement.width / W);
    renderer.setRenderTarget(rt); renderer.render(scene, camera);
    renderer.setRenderTarget(null); renderer.render(post, postCamera);
    renderer.autoClear = false; renderer.clearDepth(); renderer.render(mistScene, camera); renderer.autoClear = true;
    $('#scrub').value = time; $('#clock').value = `${time.toFixed(3)} s`;
  }
  function setPlaying(value) { playing = value; last = performance.now(); $('#play').textContent = value ? 'Pause' : 'Play'; }
  function setTime(value) {
    if (!Number.isFinite(value) || value < 0 || value > duration) throw new RangeError(`Time must be 0..${duration}`);
    setPlaying(false); render(value);
  }
  function cast(value = F.freshSeed(seed)) { build(value); render(0); last = performance.now(); return seed; }
  function replayInput() {
    try { cast(Number($('#seed').value)); $('#error').hidden = true; }
    catch (error) { $('#error').hidden = false; $('#error').textContent = error.message; }
  }
  $('#recast').onclick = () => { cast(); setPlaying(true); };
  $('#replay').onclick = replayInput;
  $('#play').onclick = () => { if (time === duration) render(0); setPlaying(!playing); };
  $('#scrub').oninput = e => setTime(Number(e.target.value));
  document.querySelectorAll('[data-speed]').forEach(button => button.onclick = () => {
    speed = Number(button.dataset.speed);
    document.querySelectorAll('[data-speed]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
  });
  function loop(now) {
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    if (resize()) render(time); // Also redraw paused casts after layout or monitor-DPR changes.
    if (playing) { const next = time + dt * speed; if (next >= duration) cast(); else render(next); }
    requestAnimationFrame(loop);
  }
  build(seed); render(0); setPlaying(playing); requestAnimationFrame(loop);
  window.STUDY = {
    ready: true, duration, cast, setTime, render, renderer, camera, scene, mistScene, caster, target,
    get state() { return { seed, time, speed, playing }; },
    stats() { return { revision: T.REVISION, internal: [rt.width, rt.height], output: [renderer.domElement.width, renderer.domElement.height],
      css: [cssWidth, cssHeight], dpr, level, ps1, stylized, snapGrid: F.sampling.snapGrid.value.toArray(),
      squash: .75, zoom: .5, actorHeight: 58, actorFlips: [caster.userData.flip, target.userData.flip],
      gasCount: gas.puffs.length, mistCount: mist.object.geometry.attributes.position.count,
      geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures }; }
  };
})();
