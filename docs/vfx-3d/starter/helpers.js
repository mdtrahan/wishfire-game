/* Our study helpers. Classic script keeps file:// loading independent of CORS imports. */
(() => {
  'use strict';
  if (!window.THREE) return;
  const T = THREE;
  const clamp = x => Math.max(0, Math.min(1, x));
  const smooth = x => { x = clamp(x); return x * x * (3 - 2 * x); };
  function rng(seed) {
    if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new RangeError('Seed must be uint32');
    return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  }
  function freshSeed(previous) {
    let seed;
    do { seed = crypto.getRandomValues(new Uint32Array(1))[0]; } while (seed === previous);
    return seed;
  }
  const uvVertex = `varying vec2 vUv;
    void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
  const sampling = { snapGrid: { value: new T.Vector2(1, 1) }, ps1: { value: true } };
  const snapVertex = `varying vec2 vUv;uniform vec2 snapGrid;uniform bool ps1;
    void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
      if(ps1){vec2 p=(gl_Position.xy/gl_Position.w*.5+.5)*snapGrid;
      gl_Position.xy=((floor(p)+.5)/snapGrid*2.-1.)*gl_Position.w;}}`;
  function material(fragmentShader, uniforms = {}, { additive = true, depthTest = true, snap = true } = {}) {
    return new T.ShaderMaterial({
      uniforms: { ...sampling, ...uniforms }, vertexShader: snap ? snapVertex : uvVertex, fragmentShader,
      transparent: true, depthWrite: false, depthTest, side: T.DoubleSide,
      blending: additive ? T.AdditiveBlending : T.NormalBlending
    });
  }
  function billboard(parent, camera, width, height, mat) {
    const object = new T.Mesh(new T.PlaneGeometry(width, height), mat);
    object.quaternion.copy(camera.quaternion);
    parent.add(object);
    return object;
  }
  function glow(parent, camera, size, color, options = {}) {
    const mat = material(`varying vec2 vUv;uniform vec3 color;uniform float alpha;
      void main(){float r=length(vUv-.5)*2.;
        gl_FragColor=vec4(color,pow(max(0.,1.-r),1.8)*alpha);}`,
      { color: { value: new T.Color(color) }, alpha: { value: 0 } }, options);
    return billboard(parent, camera, size, size, mat);
  }
  // Stable geometry: sample(u) returns world position, u goes tail -> head.
  function ribbon(parent, camera, segments = 28) {
    const positions = new Float32Array(segments * 18), uv = new Float32Array(segments * 12);
    const geometry = new T.BufferGeometry();
    for (let i = 0; i < segments; i++) {
      const u = i / segments, v = (i + 1) / segments;
      uv.set([u, 0, u, 1, v, 0, v, 0, u, 1, v, 1], i * 12);
    }
    geometry.setAttribute('position', new T.BufferAttribute(positions, 3).setUsage(T.DynamicDrawUsage));
    geometry.setAttribute('uv', new T.BufferAttribute(uv, 2));
    const mat = material(`varying vec2 vUv;uniform float alpha;
      void main(){float r=abs(vUv.y-.5)*2.;float edge=pow(max(0.,1.-r),1.8);
        vec3 color=vUv.x<.48?mix(vec3(.55,.07,1.),vec3(.05,.25,1.),vUv.x/.48):
          mix(vec3(.05,.25,1.),vec3(.03,1.,1.),(vUv.x-.48)/.52);
        color=mix(color,vec3(1.,.98,1.),pow(max(0.,1.-r),12.)*.98);
        gl_FragColor=vec4(color,edge*pow(vUv.x,.65)*alpha);}`,
      { alpha: { value: 0 } }, { depthTest: false });
    const object = new T.Mesh(geometry, mat);
    object.frustumCulled = false;
    parent.add(object);
    const facing = new T.Vector3(0, 0, 1).applyQuaternion(camera.quaternion);
    function update(sample, halfWidth, alpha) {
      mat.uniforms.alpha.value = alpha;
      const pair = u => {
        const p = sample(u), tangent = sample(Math.min(1, u + .001)).sub(sample(Math.max(0, u - .001)));
        const side = tangent.cross(facing).normalize().multiplyScalar(halfWidth * (.12 + .88 * u ** .7));
        return [p.clone().add(side), p.clone().sub(side)];
      };
      for (let i = 0; i < segments; i++) {
        const [a, b] = pair(i / segments), [c, d] = pair((i + 1) / segments);
        [a, b, c, c, b, d].forEach((p, j) => p.toArray(positions, i * 18 + j * 3));
      }
      geometry.attributes.position.needsUpdate = true;
    }
    return { object, update };
  }
  // Individual meshes let three.js sort transparent puffs by depth. Batch only after profiling.
  function gasParticles(parent, camera, random, origin, count = 12) {
    const fragment = `varying vec2 vUv;uniform float time,phase,alpha;uniform vec3 color;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
      void main(){vec2 p=vUv*3.2+phase;
        vec2 warp=vec2(noise(p+vec2(time*.72,-time*.38)),noise(p+vec2(-time*.43,time*.61)+13.7))-.5;
        float r=length((vUv+warp*.18-.5)*2.);
        float density=exp(-2.*r*r)*(1.-smoothstep(.16,1.,r))*(.68+.32*noise(p+time*.4));
        gl_FragColor=vec4(color,alpha*density);
        #include <colorspace_fragment>
      }`;
    const puffs = Array.from({ length: count }, () => {
      const phase = random() * Math.PI * 2, size = 30 + random() * 18;
      const mat = material(fragment, {
        time: { value: 0 }, phase: { value: random() * 12 }, alpha: { value: 0 },
        color: { value: new T.Color('#9a7650') }
      }, { additive: false, snap: false });
      const object = billboard(parent, camera, size, size * .8, mat);
      // Leave equal renderOrder for global back-to-front transparent object sorting.
      return { object, phase, size, speed: 12 + random() * 15, lift: 6 + random() * 14, life: .9 + random() * .4 };
    });
    return { puffs, update(age) {
      for (const p of puffs) {
        const u = clamp(age / p.life), travel = (1 - Math.exp(-2.6 * u)) / (1 - Math.exp(-2.6));
        const o = p.object;
        o.visible = age > 0 && age < p.life;
        o.position.copy(origin).add(new T.Vector3(Math.cos(p.phase) * p.speed * travel,
          12 + p.lift * travel + Math.sin(u * 7 + p.phase) * 3, Math.sin(p.phase) * p.speed * travel));
        o.quaternion.copy(camera.quaternion); o.rotateZ(p.phase + age * .8);
        o.scale.setScalar(.2 + .9 * smooth(u / .55));
        o.material.uniforms.alpha.value = .36 * smooth(u / .15) * (1 - smooth((u - .55) / .45));
        o.material.uniforms.time.value = age;
        o.material.uniforms.color.value.set('#9a7650').lerp(new T.Color('#d7bd8d'), u);
      }
    } };
  }
  // Add this to the separate post-mist scene. Size is in logical phone pixels.
  function mistPoints(parent, random, origin, count = 120) {
    const geometry = new T.BufferGeometry(), points = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3), sizes = new Float32Array(count), lives = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const y = random() * 2 - 1, angle = random() * Math.PI * 2, r = Math.sqrt(1 - y * y);
      const n = new T.Vector3(r * Math.cos(angle), y, r * Math.sin(angle));
      origin.clone().addScaledVector(n, 8).toArray(points, i * 3);
      n.multiplyScalar(100 + random() * 100).toArray(velocities, i * 3);
      sizes[i] = i % 37 ? 1 + random() : 2.6; lives[i] = .60 + random() * .32;
    }
    for (const [name, array, width] of [['position', points, 3], ['velocity', velocities, 3], ['size', sizes, 1], ['life', lives, 1]]) {
      geometry.setAttribute(name, new T.BufferAttribute(array, width));
    }
    const mat = new T.ShaderMaterial({
      transparent: true, depthTest: false, depthWrite: false, blending: T.AdditiveBlending,
      uniforms: { age: { value: -1 }, outputScale: { value: 1 } },
      vertexShader: `attribute vec3 velocity;attribute float size,life;uniform float age,outputScale;varying float alpha;
        void main(){float a=max(0.,age),u=clamp(a/life,0.,1.);
          vec3 p=position+velocity*(1.-exp(-6.*a))/6.;p.y-=48.*a+13.*a*a;
          gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);gl_PointSize=size*outputScale;
          alpha=step(0.,age)*(1.-smoothstep(.38,1.,u));}`,
      fragmentShader: `varying float alpha;void main(){float r=length(gl_PointCoord-.5)*2.;
        float a=exp(-4.5*r*r)*(1.-smoothstep(.72,1.,r))*alpha;
        gl_FragColor=vec4(.57,.92,.98,a);}`
    });
    const object = new T.Points(geometry, mat); object.frustumCulled = false; parent.add(object);
    return { object, update(age, scale) { mat.uniforms.age.value = age; mat.uniforms.outputScale.value = scale; } };
  }
  function dispose(root) {
    root.traverse(o => { o.geometry?.dispose(); if (o.material) o.material.dispose(); });
    root.clear();
  }
  window.VFX = { clamp, smooth, rng, freshSeed, material, billboard, glow, ribbon, gasParticles, mistPoints, dispose, uvVertex, sampling };
})();
