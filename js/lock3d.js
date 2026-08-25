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
      The sweep moves lights and one texture offset; the unlock
      moves meshes. If they ever share one, they fight on every
      scroll event.

   Three things from LOCK_SPEC.md are deliberately absent: the
   dark-gunmetal body (both parts are chrome), the tumbler and its
   key-turn beat (the keyhole is a hole in the body now, with
   nothing to rotate), and the cast shadow. All three are recorded
   in PLAN.md's phase 3R notes.
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

/* The keyhole, taken off the SVG lock's path so the two renderings
   describe the same object. SVG body is 160 wide x 118 tall at
   (10,136); everything below is that path expressed as a fraction
   of BW / BH, measured from the body's centre with y up. */
const KEY_R = BW * (15.5 / 160);          /* circle radius        */
const KEY_CY = BH * (0.5 - 39.6 / 118);   /* circle centre, 33.5% down */
const KEY_TOP_HALF = BW * (5.5 / 160);    /* slot at the tangent  */
const KEY_BOT_HALF = BW * (13 / 160);     /* slot where it flares */
const KEY_TANGENT_Y = BH * (0.5 - 54.09 / 118);
const KEY_BOT_Y = BH * (0.5 - 85.8 / 118);

const BODY_Y = -0.35;
const BODY_TOP = BODY_Y + BH / 2;
const ARC_Y = BODY_TOP + BW * 0.77 - ARC - TUBE;

/* Beat 4's angle: a full half-turn, clockwise seen from above.
   Earlier passes stopped short (the prototype's -1.9 rad, then
   -1.2) to avoid the edge-on pose around 90deg where the shackle
   reads as a thin rod. Going all the way through it is the fix
   rather than the problem — the pose is a moment in the middle of
   a swing, and the lock lands with the shackle laid right open
   across the body's other side.

   A half-turn is also the widest the lock ever gets: the far leg
   swings from -ARC to +3*ARC in the lock's own space, so the
   silhouette grows past the square canvas on the right. SWING_PAN
   is the exact compensation — half the width gained — tweened on
   the same beat so the open lock ends up centred instead of
   clipped. Retune one and the other is wrong. */
const SWING = -Math.PI;

/* Half the width the silhouette gains. Locked, the lock spans the
   body: -BW/2 to +BW/2. Open, the far leg and its tube reach
   3*ARC + TUBE on the right while the body's left edge has not
   moved, so re-centring is that overhang minus the old right edge,
   halved. At the camera's 35deg over 5.3 units the square canvas
   is ~1.67 either side of centre; this lands the open lock's edges
   at ~1.37, so it is framed rather than trimmed. */
const SWING_PAN = -((3 * ARC + TUBE) - BW / 2) / 2;

/* The pan's vertical twin, and needed for the same reason. The
   shackle's crown sits at a fixed height whatever the swing does
   — a Y-rotation cannot move it up or down — but its *projected*
   height is not fixed: at the old 69deg the crown was rotated well
   back in depth and perspective pulled it down the frame, and at a
   half-turn it comes back to z=0 standing at full height. Measured
   at the camera, that lands it a couple of pixels over the top of
   the canvas. This is the shortfall, taken off the lock on the
   same beat so the crown clears with a little room to spare. */
const SWING_DROP = -0.07;

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
   canvas, no asset, no extra dependency.

   Two of these are built, and which one a surface reflects is what
   makes it read correctly:

     `fine`  — a 26px repeating ramp, for the body's flat face.
     `broad` — wide softboxes, for the shackle's tube.

   The reason is angular coverage. A flat face at this camera
   distance reflects only ~35 degrees of the environment, about
   50px of a 512px map, so wide bars leave it a mirror with nothing
   to mirror — one flat tone. The tube is the opposite case: its
   curvature sweeps the whole map in a few pixels of screen, so
   fine bars alias into ringing. One environment cannot serve both,
   so the materials carry their own. */
function makeStudioEnv(THREE, renderer, light, fine) {
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

  /* Fine, high-contrast vertical bars, repeated across the whole
     map. The width matters more than it looks: a flat face at this
     camera distance reflects only ~35 degrees of the environment,
     which is about 50px of a 512px equirect. The prototype's bars
     were 26-74px wide, so the body's front face landed inside a
     single bar and came back one flat tone — a mirror with nothing
     to mirror. At a 26px period the face sweeps roughly two full
     cycles and picks up the hard bright/dark banding that reads as
     polished chrome.

     The sequence within each cycle is the SVG lock's ramp — bright
     edge, mid, dark core, mid, bright rim — so both renderings of
     the lock describe the same material. */
  if (fine) {
    /* The sequence within each cycle is the SVG lock's ramp —
       bright edge, mid, dark core, mid, bright rim — so both
       renderings of the lock describe the same material. */
    const PERIOD = 26;
    const BAND = light
      ? [[0, 4, '#ffffff'], [4, 8, '#9aa0a8'], [8, 22, '#2e3237'], [22, 25, '#d6dae0']]
      : [[0, 4, '#ffffff'], [4, 8, '#67718a'], [8, 22, '#000000'], [22, 25, '#c3cfe2']];

    for (let x = 0; x < 512; x += PERIOD) {
      BAND.forEach(([from, to, colour]) => {
        g.fillStyle = colour;
        g.fillRect(x + from, 0, to - from, 168);
      });
    }
  } else {
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
  }

  const texture = new THREE.CanvasTexture(c);
  texture.mapping = THREE.EquirectangularReflectionMapping;

  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();

  /* The *render target* is returned, not its texture. Disposing
     the texture alone leaves the target allocated, which shows up
     as two extra GPU textures per theme toggle and never comes
     back. `pmrem.dispose()` frees the generator's own scratch
     resources but not what it handed back. */
  const target = pmrem.fromEquirectangular(texture);
  pmrem.dispose();
  texture.dispose();

  return target;
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
     to carry the moving highlight and the rim definition. */
  const key = new THREE.DirectionalLight(0xffffff, 3.4);
  key.position.set(3, 5, 4);
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
    metalness: 1.0,
    roughness: 0.08,
  });
  const recess = new THREE.MeshStandardMaterial({
    color: 0x07080b,
    metalness: 0.2,
    roughness: 0.92,
  });

  /* Two groups, because two things move the lock and neither may
     see the other's value. `bob` is the idle float, written raw
     every frame by the render loop; `lock` inside it is the
     unlock's to tween. Collapsing them back into one group puts
     the render loop and the timeline on the same `position.y`,
     which is rule 2 at the top of this file. */
  const bob = new THREE.Group();
  scene.add(bob);

  const lock = new THREE.Group();
  bob.add(lock);

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

  /* The keyhole is a hole in the body's own shape, not a dark disc
     parked in front of it. That buys three things at once: it cuts
     clean through to the page exactly as the SVG lock's does, the
     extrude bevel wraps the cut and gives the drilled edge its
     bright rim, and there is no separate tumbler mesh left to
     detach from the body during the recoil. */
  /* The path is inflated by BEVEL on every side, because the
     extrude bevel eats that much off a hole's edge. Cut at the
     spec's own numbers the circle closes to a pinhole and the slot
     pinches shut entirely — what is drawn here is the size the
     hole has to be for the *visible* opening to match the SVG. */
  const holeR = KEY_R + BEVEL;
  const holeTopHalf = KEY_TOP_HALF + BEVEL;
  const holeBotHalf = KEY_BOT_HALF + BEVEL;
  const holeBotY = KEY_BOT_Y - BEVEL;
  const tangentY = KEY_CY - Math.sqrt(holeR * holeR - holeTopHalf * holeTopHalf);

  const keyhole = new THREE.Path();
  keyhole.absarc(
    0,
    KEY_CY,
    holeR,
    Math.atan2(tangentY - KEY_CY, -holeTopHalf),
    Math.atan2(tangentY - KEY_CY, holeTopHalf),
    true,
  );
  keyhole.lineTo(holeBotHalf, holeBotY);
  keyhole.lineTo(-holeBotHalf, holeBotY);
  keyhole.closePath();
  shape.holes.push(keyhole);

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
  lock.add(body);

  /* ── THE TRAVELLING SHINE ───────────────────────────────────
     Ported from lock-light-prototype.html, and it exists because
     of an asymmetry in how the two halves of the lock respond to a
     moving light.

     The shackle is a tube. Its normals sweep through a wide range,
     so moving the key light slides a highlight along it exactly as
     the prototype describes — that half needs nothing but the
     lights, which already move.

     The body's front face is flat and faces the camera. Every
     point on it has the same normal, so a moving light barely
     changes it: what the face shows is the environment, and the
     environment is fixed in world space. Three r128 has no way to
     rotate an environment map, so the face gets the prototype's
     own answer instead — a soft specular band that travels across
     it, additively blended over the chrome.

     It is built from the body's own Shape, so it is clipped to the
     silhouette and to the keyhole for free: light never spills
     past the metal, which is the same rule the SVG lock's mask
     enforces. */
  const shineCanvas = document.createElement('canvas');
  shineCanvas.width = 512;
  shineCanvas.height = 4;
  const sg = shineCanvas.getContext('2d');
  const band = sg.createLinearGradient(0, 0, 512, 0);
  band.addColorStop(0.0, 'rgba(255,255,255,0)');
  band.addColorStop(0.33, 'rgba(255,255,255,0.35)');
  band.addColorStop(0.5, 'rgba(255,255,255,1)');
  band.addColorStop(0.67, 'rgba(255,255,255,0.35)');
  band.addColorStop(1.0, 'rgba(255,255,255,0)');
  sg.fillStyle = band;
  sg.fillRect(0, 0, 512, 4);

  const shineTex = new THREE.CanvasTexture(shineCanvas);
  shineTex.wrapS = THREE.ClampToEdgeWrapping;
  shineTex.wrapT = THREE.ClampToEdgeWrapping;

  const shineMat = new THREE.MeshBasicMaterial({
    map: shineTex,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    opacity: 0.5,
  });

  const shine = new THREE.Mesh(new THREE.ShapeGeometry(shape), shineMat);
  shine.position.z = BD / 2 + BEVEL + 0.002;
  body.add(shine);

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

  /* 36 radial segments, not the prototype's 22: against bars this
     fine the tube's own faceting shows up as ringing. */
  const arc = new THREE.Mesh(
    new THREE.TorusGeometry(ARC, TUBE, 36, 72, Math.PI),
    steel,
  );
  arc.position.y = ARC_Y;
  shackle.add(arc);

  const legTop = ARC_Y;
  const legBot = BODY_TOP - 0.42;
  const legLen = legTop - legBot;

  [-ARC, ARC].forEach((x) => {
    const leg = new THREE.Mesh(
      new THREE.CylinderGeometry(TUBE, TUBE, legLen, 36),
      steel,
    );
    leg.position.set(x, (legTop + legBot) / 2, 0);
    shackle.add(leg);
  });


  /* ── UNLOCK TIMELINE ────────────────────────────────────────
     Absolute start times are part of the design: each beat begins
     before the last ends, so it reads as one continuous mechanism
     rather than three queued steps.

     Two beats from the spec are gone. The key turn is cut with the
     tumbler — the keyhole is part of the body now and has nothing
     to rotate. The green emissive flash is cut too: the lock is a
     neutral metal object and signals state by opening, which is
     the stronger signal, and with no emissive there is no theme
     colour for Three r128 to fail to parse.

     The remaining three keep their spacing exactly, shifted 0.36s
     earlier so the mechanism starts on the first frame rather than
     after the gap the key turn used to fill. */
  const timeline = gsap.timeline({ paused: true });
  timeline
    .to(body.position, { y: BODY_Y - 0.04, duration: 0.07, yoyo: true, repeat: 1, ease: 'power1.inOut' }, 0)
    .to(pivot.position, { y: 0.4, duration: 0.3, ease: 'back.out(2.4)' }, 0.06)
    .to(pivot.rotation, { y: SWING, duration: 0.6, ease: 'power3.out' }, 0.3)
    /* Same start, duration and ease as the swing above: this is not
       a move of its own, it is the swing's own growth taken off the
       lock so the frame holds still around it. Any drift between
       the two curves shows up as the lock sliding. */
    .to(lock.position, { x: SWING_PAN, y: SWING_DROP, duration: 0.6, ease: 'power3.out' }, 0.3);

  /* ── THEME ──────────────────────────────────────────────────
     The environment has to be rebuilt, not just the lights: it
     carries most of the material's appearance, and a dark studio
     env on the paper theme is most of what would make the lock
     look like a hole punched in the page. PMREM output is a GPU
     texture, so the previous one is disposed or it leaks on every
     toggle. */
  let steelEnv = null;
  let shellEnv = null;

  function applyTheme(next) {
    const light = next === 'light';

    hemi.groundColor.setHex(token('--lock-hemi-ground', light ? 0xd8d3c4 : 0x0a0b0e));
    hemi.intensity = tokenNumber('--lock-hemi-intensity', light ? 0.55 : 0.25);
    rim.color.setHex(token('--lock-rim', light ? 0xffe9c4 : 0x9fc4ff));
    shell.color.setHex(token('--lock-shell', light ? 0x424953 : 0x171b21));
    steel.color.setHex(token('--lock-steel', light ? 0xf0f3f7 : 0xdfe5ee));
    /* An additive white band on a near-white lock blows out; on
       paper it is barely there at all. */
    shineMat.opacity = tokenNumber('--lock-shine-opacity', light ? 0.28 : 0.5);
    /* Dispose both targets before reassigning, or every theme
       toggle leaks two GPU textures. */
    if (steelEnv) steelEnv.dispose();
    if (shellEnv) shellEnv.dispose();

    steelEnv = makeStudioEnv(THREE, renderer, light, false);
    shellEnv = makeStudioEnv(THREE, renderer, light, true);

    steel.envMap = steelEnv.texture;
    shell.envMap = shellEnv.texture;
    steel.needsUpdate = true;
    shell.needsUpdate = true;

    /* Anything without its own envMap falls back to this. */
    scene.environment = steelEnv.texture;
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

    /* The band sits at u = 0.5 in its texture, so an offset of
       0.5 - p puts it at p across the face. The 1.7 overshoot is
       what carries it fully off both edges rather than parking it
       at the rim. */
    shineTex.offset.x = (0.5 - p) * 1.7;
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
      bob.position.y = Math.sin(performance.now() / 1400) * 0.02;
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
      if (steelEnv) steelEnv.dispose();
      if (shellEnv) shellEnv.dispose();
      shineTex.dispose();
      renderer.dispose();
      canvas.remove();
    },
  };
}
