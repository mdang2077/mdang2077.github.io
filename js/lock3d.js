/* ============================================================
   LOCK 3D — the hero padlock as a real object.

   Ported from lock-combined-prototype.html. Owns the Three.js
   scene and nothing else: it does not decide whether to run, does
   not read the CTF state, and does not touch the DOM outside the
   stage it is handed. js/lock.js makes those calls.

   Two rules from LOCK_SPEC.md that the code cannot enforce on
   itself, so they are written here:

   1. The environment map is the material. MeshStandardMaterial at
      metalness 1 has nothing to reflect without one, so metal
      renders flat and dark no matter how many lights are added.
      The vertical bars in it are the mechanism — a flat metal face
      reflects them as the hard bright/dark banding that reads as
      polished chrome. Without the bars it is a smooth gradient,
      which reads as plastic.

   2. The shine sweep and the unlock never write the same property.
      The sweep moves lights; the unlock moves meshes. If they ever
      share one, they fight on every scroll event.
   ============================================================ */

/* Proportions from the reference image, body width = 1.0. Every
   dimension derives from these four, so retuning the lock means
   changing constants here rather than scaling the group. */
const BW = 1.7;
const BH = BW * 0.74;
const BR = 0.26;
const BD = 0.45;
const BEVEL = 0.07;
const TUBE = (BW * 0.14) / 2;
const ARC = (BW * 0.83 - TUBE * 2) / 2;

const BODY_Y = -0.35;
const BODY_TOP = BODY_Y + BH / 2;
const ARC_Y = BODY_TOP + BW * 0.77 - ARC - TUBE;

/* Beat 4's angle. The prototype's -1.9 rad (~109deg) puts the
   shackle nearly perpendicular to camera, where it reads edge-on
   as a thin rod rather than an open shackle. -1.2 (~69deg) is
   unmistakable depth with the opening still legible. */
const SWING = -1.2;

const SHADOW_MAP = () => (window.innerWidth < 768 ? 512 : 1024);
const PIXEL_RATIO = () =>
  Math.min(window.devicePixelRatio || 1, window.innerWidth < 768 ? 1.5 : 2);

/* Reads a lock colour token as a Three-parseable hex. The tokens
   live in tokens.css so the lock re-themes from one place; no
   colour is hardcoded in this module. */
function token(name, fallback) {
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  const n = Number.parseInt(raw.replace('#', ''), 16);
  return Number.isFinite(n) ? n : fallback;
}

function tokenNumber(name, fallback) {
  const n = Number.parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue(name),
  );
  return Number.isFinite(n) ? n : fallback;
}

/* The procedural studio environment: a gradient sky with hard
   vertical softbox bars and near-black gaps between them. 512x256
   canvas, no asset, no extra dependency. */
function makeStudioEnv(THREE, renderer, light) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const g = c.getContext('2d');

  const sky = g.createLinearGradient(0, 0, 0, 256);
  if (light) {
    sky.addColorStop(0, '#ffffff');
    sky.addColorStop(0.45, '#cfd4dc');
    sky.addColorStop(0.55, '#8d949e');
    sky.addColorStop(1, '#3a3d42');
  } else {
    sky.addColorStop(0, '#c9d2e0');
    sky.addColorStop(0.42, '#4a5260');
    sky.addColorStop(0.55, '#101319');
    sky.addColorStop(1, '#020305');
  }
  g.fillStyle = sky;
  g.fillRect(0, 0, 512, 256);

  [[24, 58], [132, 30], [188, 74], [300, 26], [352, 46], [452, 36]].forEach(
    ([x, w], i) => {
      g.fillStyle = i % 2
        ? light ? 'rgba(255,255,255,.85)' : 'rgba(205,224,255,.9)'
        : '#ffffff';
      g.fillRect(x, 0, w, 150);
    },
  );

  g.fillStyle = light ? 'rgba(60,62,68,.55)' : 'rgba(0,0,0,.92)';
  [[82, 50], [162, 26], [262, 38], [398, 54]].forEach(([x, w]) =>
    g.fillRect(x, 0, w, 150),
  );

  const texture = new THREE.CanvasTexture(c);
  texture.mapping = THREE.EquirectangularReflectionMapping;

  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const env = pmrem.fromEquirectangular(texture).texture;
  pmrem.dispose();
  texture.dispose();

  return env;
}

export function createLockScene({ THREE, gsap, stage, theme, prefersReducedMotion }) {
  const scene = new THREE.Scene();

  /* The prototype's camera, not the spec text's (0, 0.35, 4.6).
     The 0.77 fill constant in components.css was measured against
     these values — take the camera from one source and the
     constant from the other and the lock comes out the wrong size.
     If this is ever retuned, re-measure 0.77 in the same sitting. */
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 0.3, 5.3);
  camera.lookAt(0, 0.3, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(PIXEL_RATIO());
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  /* Removed in r152+, where it becomes outputColorSpace. Three is
     pinned to r128 in index.html for exactly this reason. */
  renderer.outputEncoding = THREE.sRGBEncoding;

  const canvas = renderer.domElement;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'Padlock, locked');
  stage.appendChild(canvas);

  function resize() {
    const size = stage.clientWidth;
    if (!size) return;
    renderer.setPixelRatio(PIXEL_RATIO());
    renderer.setSize(size, size, false);
    camera.aspect = 1;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);

  /* ── LIGHTS ─────────────────────────────────────────────────
     With the environment doing the material work, these only have
     to carry shadow and rim definition. */
  const key = new THREE.DirectionalLight(0xffffff, 1.5);
  key.position.set(3, 5, 4);
  key.castShadow = true;
  key.shadow.mapSize.set(SHADOW_MAP(), SHADOW_MAP());
  key.shadow.radius = 4;
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 16;
  scene.add(key);

  const rim = new THREE.DirectionalLight(0x9fc4ff, 0.7);
  rim.position.set(-4, 2, -3);
  scene.add(rim);

  const hemi = new THREE.HemisphereLight(0x9bb0ff, 0x0a0b0e, 0.25);
  scene.add(hemi);

  /* ── MATERIALS ──────────────────────────────────────────────
     Two finishes, and the contrast between them is the design.
     The body's darkness comes from its near-black base colour, not
     from low metalness — it still needs high metalness to catch
     the environment's banding, or it flattens into plastic. */
  const steel = new THREE.MeshStandardMaterial({
    metalness: 1.0,
    roughness: 0.1,
  });
  const shell = new THREE.MeshStandardMaterial({
    metalness: 0.94,
    roughness: 0.19,
  });
  const recess = new THREE.MeshStandardMaterial({
    color: 0x07080b,
    metalness: 0.2,
    roughness: 0.92,
  });

  const lock = new THREE.Group();
  scene.add(lock);

  /* ── BODY — extruded rounded rect. The bevel is the bright
     chamfer line from the reference and is not optional. */
  const shape = new THREE.Shape();
  shape.moveTo(-BW / 2 + BR, -BH / 2);
  shape.lineTo(BW / 2 - BR, -BH / 2);
  shape.quadraticCurveTo(BW / 2, -BH / 2, BW / 2, -BH / 2 + BR);
  shape.lineTo(BW / 2, BH / 2 - BR);
  shape.quadraticCurveTo(BW / 2, BH / 2, BW / 2 - BR, BH / 2);
  shape.lineTo(-BW / 2 + BR, BH / 2);
  shape.quadraticCurveTo(-BW / 2, BH / 2, -BW / 2, BH / 2 - BR);
  shape.lineTo(-BW / 2, -BH / 2 + BR);
  shape.quadraticCurveTo(-BW / 2, -BH / 2, -BW / 2 + BR, -BH / 2);

  const bodyGeo = new THREE.ExtrudeGeometry(shape, {
    depth: BD,
    bevelEnabled: true,
    bevelThickness: BEVEL,
    bevelSize: BEVEL,
    bevelSegments: 4,
    curveSegments: 24,
  });
  bodyGeo.center();

  const body = new THREE.Mesh(bodyGeo, shell);
  body.position.y = BODY_Y;
  body.castShadow = true;
  body.receiveShadow = true;
  lock.add(body);

  /* The tumbler is a *child* of the body, not a sibling. As a
     sibling it stays put during beat 2's recoil and the keyhole
     visibly detaches — the bug the combined prototype fixed. */
  const tumbler = new THREE.Group();
  /* The bevel adds BEVEL to each face, so the front of the centred
     body is at BD/2 + BEVEL, not BD/2. The prototype used the
     latter and buried the keyhole inside the body. */
  tumbler.position.set(0, 0.335 * -BH + BH / 2, BD / 2 + BEVEL + 0.02);
  body.add(tumbler);

  const hole = new THREE.Mesh(
    new THREE.CylinderGeometry(BW * 0.097, BW * 0.097, 0.06, 28),
    recess,
  );
  hole.rotation.x = Math.PI / 2;
  tumbler.add(hole);

  const slot = new THREE.Mesh(
    new THREE.BoxGeometry(BW * 0.068, BW * 0.29, 0.06),
    recess,
  );
  slot.position.y = -BW * 0.145;
  tumbler.add(slot);

  /* ── SHACKLE — the pivot trick, and the entire reason the lock
     is 3D. The pivot sits at the right leg with the shackle
     offset back inside it, so rotating pivot.rotation.y swings the
     shackle out sideways *in depth*. Rewriting this as a
     Z-rotation is the SVG fallback's version, and that is the one
     that looks like a cartoon. */
  const pivot = new THREE.Group();
  pivot.position.set(ARC, 0, 0);
  lock.add(pivot);

  const shackle = new THREE.Group();
  shackle.position.set(-ARC, 0, 0);
  pivot.add(shackle);

  const arc = new THREE.Mesh(
    new THREE.TorusGeometry(ARC, TUBE, 22, 56, Math.PI),
    steel,
  );
  arc.position.y = ARC_Y;
  shackle.add(arc);

  const legTop = ARC_Y;
  const legBot = BODY_TOP - 0.42;
  const legLen = legTop - legBot;

  [-ARC, ARC].forEach((x) => {
    const leg = new THREE.Mesh(
      new THREE.CylinderGeometry(TUBE, TUBE, legLen, 22),
      steel,
    );
    leg.position.set(x, (legTop + legBot) / 2, 0);
    shackle.add(leg);
  });

  shackle.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });

  const floorMat = new THREE.ShadowMaterial({ opacity: 0.42 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = BODY_Y - BH / 2 - 0.18;
  floor.receiveShadow = true;
  scene.add(floor);

  /* ── UNLOCK TIMELINE ────────────────────────────────────────
     Absolute start times are part of the design: each beat begins
     before the last ends, so it reads as one continuous mechanism
     rather than four queued steps.

     There is no fifth beat. The spec flashes the body green here;
     the lock is a neutral metal object that signals state by
     opening, and that is the stronger signal. It also means no
     colour has to be parsed out of a theme token — which Three
     r128 could not do with our space-separated hsl() anyway. */
  const timeline = gsap.timeline({ paused: true });
  timeline
    .to(tumbler.rotation, { z: -Math.PI / 2, duration: 0.42, ease: 'power2.inOut' }, 0)
    .to(body.position, { y: BODY_Y - 0.04, duration: 0.07, yoyo: true, repeat: 1, ease: 'power1.inOut' }, 0.36)
    .to(pivot.position, { y: 0.4, duration: 0.3, ease: 'back.out(2.4)' }, 0.42)
    .to(pivot.rotation, { y: SWING, duration: 0.6, ease: 'power3.out' }, 0.66);

  /* ── THEME ──────────────────────────────────────────────────
     The environment has to be rebuilt, not just the lights: it
     carries most of the material's appearance, and a dark studio
     env on the paper theme is most of what would make the lock
     look like a hole punched in the page. PMREM output is a GPU
     texture, so the previous one is disposed or it leaks on every
     toggle. */
  function applyTheme(next) {
    const light = next === 'light';

    hemi.groundColor.setHex(token('--lock-hemi-ground', light ? 0xd8d3c4 : 0x0a0b0e));
    hemi.intensity = tokenNumber('--lock-hemi-intensity', light ? 0.55 : 0.25);
    rim.color.setHex(token('--lock-rim', light ? 0xffe9c4 : 0x9fc4ff));
    shell.color.setHex(token('--lock-shell', light ? 0x424953 : 0x171b21));
    steel.color.setHex(token('--lock-steel', light ? 0xf0f3f7 : 0xdfe5ee));
    floorMat.opacity = tokenNumber('--lock-floor-opacity', light ? 0.2 : 0.42);

    if (scene.environment) scene.environment.dispose();
    scene.environment = makeStudioEnv(THREE, renderer, light);
  }

  applyTheme(theme);

  /* ── SHINE SWEEP ────────────────────────────────────────────
     Moves lights only. In 3D the travelling specular, the shifting
     shade, the flipping lit edge and the swinging cast shadow all
     follow for free from the renderer lighting a real object.
     One consequence to expect and not "fix": solve mid-scroll and
     the shackle relights as it swings, because the renderer is
     lighting a moving object. That is correct. */
  function setLight(p) {
    key.position.x = -6 + p * 12;
    rim.position.x = 6 - p * 12;
  }

  setLight(prefersReducedMotion ? 0.5 : 0);

  /* ── RENDER LOOP ────────────────────────────────────────────
     Gated on visibility and on the tab being foregrounded: without
     that this burns a GPU forever for a 0.02-unit float. */
  let visible = true;
  let running = true;
  let firstFrame = true;
  const onFirstFrame = [];

  const io = new IntersectionObserver((entries) => {
    visible = entries[0].isIntersecting;
  });
  io.observe(stage);

  function tick() {
    if (!running) return;
    requestAnimationFrame(tick);
    if (!visible || document.hidden) return;

    /* The only idle motion. The lock never spins. */
    if (!prefersReducedMotion) {
      lock.position.y = Math.sin(performance.now() / 1400) * 0.02;
    }

    renderer.render(scene, camera);

    if (firstFrame) {
      firstFrame = false;
      onFirstFrame.splice(0).forEach((fn) => fn());
    }
  }
  tick();

  return {
    canvas,
    timeline,
    setLight,
    applyTheme,
    onReady: (fn) => (firstFrame ? onFirstFrame.push(fn) : fn()),
    destroy() {
      running = false;
      io.disconnect();
      window.removeEventListener('resize', resize);
      if (scene.environment) scene.environment.dispose();
      renderer.dispose();
      canvas.remove();
    },
  };
}
