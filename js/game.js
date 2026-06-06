'use strict';
// ============================================================
// BUFF CHICKENS — js/game.js  (3D Edition v2.0)
// Three.js WebGL 3D farm RPG
// ============================================================

// ── Renderer & Camera ────────────────────────────────────────
const canvas = document.getElementById('gameCanvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setSize(window.innerWidth, window.innerHeight);

const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 800);

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});

// ── Camera orbit state ───────────────────────────────────────
let camYaw = 0;       // horizontal orbit angle
let camPitch = 0.45;  // vertical tilt (radians)
const CAM_DIST = 13;
const CAM_LOOK_H = 1.4; // look-at height offset above player base

// ── Input ────────────────────────────────────────────────────
const keys = {};
let mouseRightDown = false, lastMX = 0, lastMY = 0;

window.addEventListener('keydown', e => { keys[e.key.toLowerCase()] = true; handleKey(e.key.toLowerCase()); });
window.addEventListener('keyup',   e => { keys[e.key.toLowerCase()] = false; });
canvas.addEventListener('mousedown', e => {
  if (e.button === 2) { mouseRightDown = true; lastMX = e.clientX; lastMY = e.clientY; }
  if (e.button === 0 && G.running) G.playerAttack();
});
canvas.addEventListener('mouseup',  e => { if (e.button === 2) mouseRightDown = false; });
canvas.addEventListener('mousemove', e => {
  if (!mouseRightDown) return;
  camYaw   -= (e.clientX - lastMX) * 0.005;
  camPitch  = Math.max(0.15, Math.min(1.2, camPitch + (e.clientY - lastMY) * 0.003));
  lastMX = e.clientX; lastMY = e.clientY;
});
canvas.addEventListener('contextmenu', e => e.preventDefault());

function handleKey(k) {
  if (!G.running) return;
  if (k === 'z') G.sleep();
  if (k === 'c') G.toggleChickenPanel();
  if (k === 's') G.save();
  if (k === 'l') G.load();
  if (k === 'e') G.interact();
  if (k === 'f') G.playerAttack();
}

// ── Constants ────────────────────────────────────────────────
const RUNE_TYPES    = ['air','earth','water','fire'];
const SPECIAL_RUNES = ['buff','sand','rock','lava'];
const ALL_RUNES     = [...RUNE_TYPES, ...SPECIAL_RUNES];

const RUNE_COLORS = {
  air:0x87CEEB, earth:0x8B6914, water:0x4169E1, fire:0xFF4500,
  buff:0xFFD700, sand:0xF4A460, rock:0xaaaaaa,  lava:0xFF6347,
};
const RUNE_EMOJI = { air:'💨',earth:'🪨',water:'💧',fire:'🔥',buff:'💪',sand:'🏖️',rock:'⛰️',lava:'🌋' };

const CHK_XFORM = {
  air:  { color:0xc8f0ff, label:'Air Chicken',   baseDmg:12, baseSpd:0.26, atkR:10, proj:true  },
  earth:{ color:0xb8a060, label:'Earth Chicken', baseDmg:20, baseSpd:0.18, atkR:2.5,proj:false },
  water:{ color:0x6699ff, label:'Water Chicken', baseDmg:14, baseSpd:0.24, atkR:12, proj:true  },
  fire: { color:0xff6622, label:'Fire Chicken',  baseDmg:18, baseSpd:0.22, atkR:10, proj:true  },
};

const ENEMY_DEFS = {
  cyborg_cow:   { label:'Cyborg Cow',    col:0x88aacc, sz:1.2, hp:70,  dmg:14, spd:0.045, ranged:true,  atkR:18, runeT:'air',   aggR:25 },
  psychic_sheep:{ label:'Psychic Sheep', col:0xcc88ff, sz:0.9, hp:50,  dmg:18, spd:0.050, ranged:true,  atkR:16, runeT:'earth', aggR:22 },
  heavy_horse:  { label:'Heavy Horse',   col:0xa09060, sz:1.6, hp:120, dmg:22, spd:0.035, ranged:false, atkR:3,  runeT:'water', aggR:20 },
  monster_mutt: { label:'Monster Mutt',  col:0xff8844, sz:0.8, hp:40,  dmg:16, spd:0.090, ranged:false, atkR:2,  runeT:'fire',  aggR:25 },
};
const ZONE_ENEMY = {
  gym:     { label:'Buff Pig',      col:0xe0a0e0, sz:1.0, hp:80,  dmg:18, spd:0.055, ranged:false, atkR:2.5,runeT:'buff', aggR:20 },
  beach:   { label:'Sand Cat',      col:0xf4e066, sz:0.5, hp:30,  dmg:10, spd:0.110, ranged:false, atkR:2,  runeT:'sand', aggR:18 },
  mountain:{ label:'Mountain Goat', col:0x888888, sz:0.8, hp:50,  dmg:14, spd:0.065, ranged:false, atkR:2,  runeT:'rock', aggR:20 },
  volcano: { label:'Rocky Rat',     col:0xcc6666, sz:0.4, hp:25,  dmg:8,  spd:0.100, ranged:false, atkR:2,  runeT:'lava', aggR:18 },
};

const ZONES = {
  farm:    { label:'The Farm'    },
  gym:     { label:'The Gym'     },
  beach:   { label:'The Beach'   },
  mountain:{ label:'The Mountain'},
  volcano: { label:'The Volcano' },
};

const UNLOCK_REQ = { air:'gym', earth:'mountain', water:'beach', fire:'volcano' };
const ZONE_RUNE  = { gym:'buff', mountain:'rock', beach:'sand', volcano:'lava' };

// ── Utilities ────────────────────────────────────────────────
const rnd  = (a,b) => a + Math.random()*(b-a);
const rndI = (a,b) => Math.floor(rnd(a,b+1));

function dist2D(a, b) {
  const ax = a.pos ? a.pos.x : a.x;
  const az = a.pos ? a.pos.z : a.z;
  const bx = b.pos ? b.pos.x : b.x;
  const bz = b.pos ? b.pos.z : b.z;
  return Math.sqrt((ax-bx)**2 + (az-bz)**2);
}

// ── Geometry / Material cache ────────────────────────────────
const _G = {}, _M = {};
const sphG  = (r,s=8) => { const k=`sp${r}${s}`; return _G[k]||(_G[k]=new THREE.SphereGeometry(r,s,s)); };
const boxG  = (w,h,d) => { const k=`bx${w}${h}${d}`; return _G[k]||(_G[k]=new THREE.BoxGeometry(w,h,d)); };
const cylG  = (a,b,h,s=8) => { const k=`cy${a}${b}${h}${s}`; return _G[k]||(_G[k]=new THREE.CylinderGeometry(a,b,h,s)); };
const coneG = (r,h,s=6) => { const k=`cn${r}${h}${s}`; return _G[k]||(_G[k]=new THREE.ConeGeometry(r,h,s)); };
const toruG = (r,t,rs,ts) => new THREE.TorusGeometry(r,t,rs,ts);
const lmat  = (c) => _M[c] || (_M[c] = new THREE.MeshLambertMaterial({color:c}));
const bmat  = (c,op=1) => { const k=`${c}_${op}`; return _M[k]||(_M[k]=new THREE.MeshBasicMaterial({color:c,transparent:op<1,opacity:op})); };
const M     = (geo,mat) => new THREE.Mesh(geo,mat);

// ── Add mesh helper ──────────────────────────────────────────
function addM(parent, geo, mat, px=0,py=0,pz=0, rx=0,ry=0,rz=0, sx=1,sy=1,sz=1) {
  const m = M(geo, mat);
  m.position.set(px,py,pz);
  m.rotation.set(rx,ry,rz);
  m.scale.set(sx,sy,sz);
  m.castShadow = true;
  parent.add(m);
  return m;
}

// ============================================================
// PROCEDURAL 3D MODELS  (all facing +Z by default)
// ============================================================

function makeChickenMesh(gender='hen', transform=null, buffLevel=0) {
  const g = new THREE.Group();
  const bColor = transform ? CHK_XFORM[transform].color : (gender==='rooster' ? 0xffcc44 : 0xffe080);
  const bMat   = lmat(bColor);
  const scale  = 1 + buffLevel * 0.2;

  // Legs (y=0 is ground)
  const legMat = lmat(0xffaa00);
  for (const xs of [-0.12, 0.12]) {
    addM(g, cylG(0.045,0.045,0.38), legMat, xs,0.19,0.05);
    addM(g, boxG(0.2,0.04,0.1),     legMat, xs+0.04,0.02,0.08);
  }
  // Body
  const body = M(sphG(0.48,8), bMat);
  body.position.set(0,0.52,0); body.scale.set(1,0.85,1); body.castShadow=true;
  g.add(body);
  // Wings
  const wScale = transform ? (transform==='air'?2.2:1.2) : 1.0;
  const wingMat = new THREE.MeshLambertMaterial({color:bColor, transparent:true, opacity:0.85});
  for (const xs of [-1,1]) {
    addM(g, boxG(0.12,0.22,0.38*wScale), wingMat, xs*0.5,0.52,0, 0,0,xs*0.28);
  }
  // Head
  addM(g, sphG(0.3,8), bMat, 0,0.88,0.38);
  // Beak
  addM(g, coneG(0.06,0.2,6), lmat(0xe8a020), 0,0.84,0.7, Math.PI/2,0,0);
  // Comb
  for (let i=0;i<3;i++) addM(g, sphG(0.07,6), lmat(0xee0000), 0,1.12,0.3+i*0.06);
  // Eye
  addM(g, sphG(0.045,6), lmat(0x111111), 0.17,0.9,0.65);

  // Rooster tail
  if (gender==='rooster') {
    addM(g, coneG(0.14,0.44,5), lmat(0xcc4400), 0,0.65,-0.55, -Math.PI/2,0,0);
    addM(g, coneG(0.1,0.38,5),  lmat(0xff6600), 0.12,0.7,-0.5, -Math.PI*0.55,0.2,0);
    addM(g, coneG(0.1,0.38,5),  lmat(0xff6600), -0.12,0.7,-0.5,-Math.PI*0.55,-0.2,0);
  }

  // Transform decorations
  if (transform === 'fire') {
    for (let i=0;i<4;i++) {
      const a = i*Math.PI/2;
      const fl = M(coneG(0.07,0.22,5), new THREE.MeshBasicMaterial({color:0xff6600,transparent:true,opacity:0.8}));
      fl.position.set(Math.cos(a)*0.38,0.55,Math.sin(a)*0.38);
      g.add(fl);
    }
  }
  if (transform === 'earth') {
    addM(g, sphG(0.14,6), lmat(0x5a4520), -0.2,0.65,0.25);
    addM(g, sphG(0.11,6), lmat(0x6b5530),  0.18,0.7,-0.15);
  }
  if (transform === 'water') {
    const ring = M(toruG(0.52,0.04,6,16), bmat(0x4169e1,0.6));
    ring.rotation.x = Math.PI/2; ring.position.set(0,0.45,0);
    g.add(ring);
  }
  if (transform === 'air') {
    const ring = M(toruG(0.65,0.03,6,20), bmat(0x87ceeb,0.5));
    ring.rotation.x = Math.PI/2; ring.position.set(0,0.4,0);
    g.add(ring);
  }

  // Buff muscles
  if (buffLevel > 0) {
    for (const xs of [-1,1]) {
      const m = M(sphG(0.18+buffLevel*0.04,8), lmat(0xffaa00));
      m.position.set(xs*0.52,0.55,0); m.scale.set(1.3,0.9,1);
      g.add(m);
    }
  }

  // Rock rune armor
  if (g.userData.rockArmored) {
    for (let i=0;i<6;i++) {
      const a=i*Math.PI/3;
      addM(g, sphG(0.1,5), lmat(0x888888), Math.cos(a)*0.45,0.52,Math.sin(a)*0.45);
    }
  }

  g.scale.setScalar(scale);
  return g;
}

function makePlayerMesh() {
  const g = new THREE.Group();
  // Boots
  for (const xs of [-0.15,0.15]) {
    addM(g, boxG(0.22,0.14,0.32), lmat(0x222222), xs+0.04,0.07,0.05);
  }
  // Legs
  for (const xs of [-0.15,0.15]) {
    addM(g, cylG(0.12,0.1,0.65,8), lmat(0x3355aa), xs,0.52,0);
  }
  // Torso
  addM(g, boxG(0.56,0.72,0.36), lmat(0x336699), 0,1.05,0);
  // Belt
  addM(g, boxG(0.58,0.08,0.38), lmat(0x884400), 0,0.72,0);
  // Arms
  for (const xs of [-1,1]) {
    addM(g, cylG(0.09,0.08,0.55,8), lmat(0x336699), xs*0.35,1.0,0, 0,0,xs*0.25);
    addM(g, sphG(0.1,6), lmat(0xffcc88), xs*0.44,0.72,0);
  }
  // Neck
  addM(g, cylG(0.1,0.1,0.18,8), lmat(0xffcc88), 0,1.48,0);
  // Head
  addM(g, sphG(0.27,8), lmat(0xffcc88), 0,1.78,0);
  // Hair
  const hair = M(sphG(0.27,8), lmat(0x553300));
  hair.position.set(0,1.88,0); hair.scale.set(1,0.5,1.1); g.add(hair);
  // Eyes
  addM(g, sphG(0.04,6), lmat(0x111111), 0.18,1.78,0.24);
  addM(g, sphG(0.04,6), lmat(0x111111), -0.18,1.78,0.24);
  // Sword
  const sw = new THREE.Group();
  addM(sw, boxG(0.06,0.68,0.04), lmat(0xcccccc), 0,0.34,0);
  addM(sw, boxG(0.24,0.06,0.07), lmat(0x8B6914), 0,0,0);
  addM(sw, cylG(0.05,0.05,0.24,6), lmat(0x8B4513), 0,-0.17,0);
  sw.position.set(0,0.85,0.5); sw.rotation.x = 0.3;
  g.add(sw);
  return g;
}

function makeEnemyMesh(type) {
  const g = new THREE.Group();
  const d = ENEMY_DEFS[type] || ZONE_ENEMY[type] || ENEMY_DEFS.monster_mutt;
  const c = d.col;

  if (type === 'cyborg_cow') {
    addM(g, boxG(1.7,1.3,1.1), lmat(c), 0,0.75,0);
    addM(g, boxG(0.85,0.75,0.65), lmat(c), 0,1.1,0.95);
    addM(g, boxG(0.95,0.48,0.28), lmat(0x445566), 0,1.15,0);
    addM(g, sphG(0.1,8), bmat(0x00ff88), 0.3,1.25,1.25);
    addM(g, cylG(0.03,0.02,0.55,6), lmat(0x445566), 0.3,1.65,0);
    for (const [xs,zs] of [[-0.5,-0.42],[-0.5,0.42],[0.5,-0.42],[0.5,0.42]]) {
      addM(g, cylG(0.11,0.09,0.82,6), lmat(0x445566), xs,0.12,zs);
    }
  }
  else if (type === 'psychic_sheep') {
    const bdy = M(sphG(0.75,8), lmat(0xcc88ff)); bdy.scale.y=0.85; bdy.position.set(0,0.72,0); bdy.castShadow=true; g.add(bdy);
    for (let i=0;i<6;i++) {
      const a=i*Math.PI/3;
      addM(g, sphG(0.3,6), lmat(0xbb77ee), Math.cos(a)*0.58,0.82,Math.sin(a)*0.58);
    }
    addM(g, sphG(0.36,8), lmat(0xddaaff), 0,1.22,0.65);
    addM(g, sphG(0.11,8), bmat(0xff00ff), 0,1.3,1.01);
    addM(g, sphG(0.055,6), bmat(0x000000), 0,1.3,1.12);
    for (const xs of [-0.28,0.28]) addM(g, boxG(0.18,0.32,0.16), lmat(0x333333), xs,0.08,0);
  }
  else if (type === 'heavy_horse') {
    const bdy = M(sphG(1.25,8), lmat(c)); bdy.scale.set(1,0.9,1); bdy.position.set(0,1.15,0); bdy.castShadow=true; g.add(bdy);
    addM(g, boxG(0.85,0.62,0.52), lmat(c), 0,1.6,1.3);
    addM(g, boxG(0.2,0.62,0.52), lmat(0x604020), -0.1,1.95,0.95);
    addM(g, sphG(0.07,6), lmat(0x553300), 0.12,1.52,1.62);
    addM(g, sphG(0.07,6), lmat(0x553300), -0.12,1.52,1.62);
  }
  else if (type === 'monster_mutt') {
    addM(g, boxG(0.88,0.62,0.58), lmat(c), 0,0.58,0);
    addM(g, sphG(0.42,8), lmat(c), 0,1.08,0.55);
    for (const xs of [-0.18,0.18]) {
      addM(g, coneG(0.08,0.5,6), lmat(0xcc4400), xs,1.6,0.42);
    }
    addM(g, boxG(0.24,0.17,0.18), lmat(c), 0,0.94,0.88);
    for (const [xs,zs] of [[-0.2,-0.24],[-0.2,0.24],[0.22,-0.24],[0.22,0.24]]) {
      addM(g, cylG(0.08,0.06,0.58,6), lmat(c), xs,0.1,zs);
    }
  }
  else if (type === 'gym') {
    const bdy = M(sphG(0.68,8), lmat(0xe0a0e0)); bdy.scale.set(1.2,1,1.2); bdy.position.set(0,0.8,0); bdy.castShadow=true; g.add(bdy);
    for (const xs of [-1,1]) addM(g, sphG(0.33,8), lmat(0xcc88cc), xs*0.72,0.85,0);
    addM(g, sphG(0.36,8), lmat(0xe0a0e0), 0,1.38,0.62);
    addM(g, cylG(0.15,0.15,0.1,8), lmat(0xddaacc), 0,1.3,1.0, 0,0,Math.PI/2);
  }
  else if (type === 'beach') {
    addM(g, boxG(0.58,0.38,0.38), lmat(0xf4e066), 0,0.42,0);
    addM(g, sphG(0.27,8), lmat(0xf4e066), 0,0.76,0.4);
    for (const xs of [-0.15,0.15]) addM(g, coneG(0.07,0.16,5), lmat(0xd4c055), xs,1.04,0.28);
    addM(g, cylG(0.05,0.03,0.55,6), lmat(0xf4e066), -0.45,0.45,0, 0,0,-0.5);
  }
  else if (type === 'mountain') {
    addM(g, boxG(0.78,0.62,0.48), lmat(0x888888), 0,0.55,0);
    addM(g, sphG(0.31,8), lmat(0x888888), 0,1.02,0.52);
    for (const xs of [-0.12,0.12]) {
      const horn = M(cylG(0.04,0.01,0.52,5), lmat(0xaaaaaa));
      horn.position.set(xs,1.4,0.42); horn.rotation.z = xs>0?-0.3:0.3; horn.castShadow=true;
      g.add(horn);
    }
    addM(g, coneG(0.09,0.28,6), lmat(0xdddddd), 0,0.72,0.8, Math.PI,0,0);
  }
  else if (type === 'volcano') {
    addM(g, sphG(0.34,8), lmat(0xcc6666), 0,0.38,0);
    addM(g, sphG(0.22,8), lmat(0xcc6666), 0,0.72,0.32);
    for (const xs of [-0.1,0.1]) addM(g, sphG(0.1,6), lmat(0xff8888), xs,0.97,0.22);
    addM(g, cylG(0.04,0.02,0.48,6), lmat(0xcc6666), -0.38,0.38,0, 0,0,-0.7);
  }
  return g;
}

function makeBossMesh() {
  const g = new THREE.Group();
  // Scale up: boss is 3x player
  for (const xs of [-0.38,0.38]) {
    addM(g, cylG(0.32,0.26,2.1,8), lmat(0x3366aa), xs,1.2,0);
    addM(g, boxG(0.48,0.42,0.68), lmat(0x222222), xs+0.08,0.12,0.05);
  }
  addM(g, boxG(1.65,1.85,1.05), lmat(0x3366aa), 0,2.2,0);
  addM(g, boxG(1.75,1.25,1.12), lmat(0x5a2d0c), 0,3.1,0);
  for (const xs of [-1,1]) {
    addM(g, cylG(0.24,0.2,1.45,8), lmat(0x5a2d0c), xs*0.98,2.9,0, 0,0,xs*0.3);
    addM(g, sphG(0.24,8), lmat(0xc68642), xs*1.22,2.12,0);
  }
  addM(g, cylG(0.3,0.3,0.42,8), lmat(0xc68642), 0,3.85,0);
  addM(g, sphG(0.82,10), lmat(0xc68642), 0,4.62,0);
  addM(g, cylG(1.25,1.25,0.14,16), lmat(0x3a2010), 0,5.25,0);
  addM(g, cylG(0.78,0.68,0.95,16), lmat(0x3a2010), 0,5.8,0);
  addM(g, sphG(0.13,8), bmat(0xff2200), 0.62,4.68,0.66);
  addM(g, sphG(0.13,8), bmat(0xff2200), -0.62,4.68,0.66);
  addM(g, sphG(0.16,8), bmat(0xff00ff), 0,4.92,0.78);
  addM(g, sphG(0.08,6), bmat(0x000000), 0,4.92,0.94);
  // Pitchfork
  addM(g, cylG(0.06,0.06,2.55,6), lmat(0x8B6914), 0,2.35,1.85);
  for (const xs of [-0.22,0,0.22]) {
    addM(g, cylG(0.04,0.02,0.72,6), lmat(0xcccccc), xs,3.72,1.85);
  }
  return g;
}

function makeRuneMesh(type) {
  const c = RUNE_COLORS[type] || 0xffffff;
  const g = new THREE.Group();
  g.add(M(new THREE.OctahedronGeometry(0.22), bmat(c)));
  const wf = M(new THREE.OctahedronGeometry(0.34), bmat(c,0.4));
  g.add(wf);
  return g;
}

function makeEggMesh() {
  const e = M(sphG(0.18,8), lmat(0xffe8b0));
  e.scale.y = 1.4; e.castShadow = true;
  return e;
}

function makeOutlineMesh(size) {
  // BackSide white sphere — sits as a child of the enemy mesh, creating a glowing outline halo
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(size * 1.55, 10, 10),
    new THREE.MeshBasicMaterial({ color:0xffffff, side:THREE.BackSide, transparent:true, opacity:0.88 })
  );
  m.visible = false;
  return m;
}

function makeProjectile(color) {
  const g = new THREE.Group();
  g.add(M(sphG(0.18,6), bmat(color)));
  const glow = M(sphG(0.28,6), bmat(color,0.35)); g.add(glow);
  return g;
}

// ============================================================
// WORLD SCENE BUILDERS
// ============================================================

function addLights(scene, ambCol, ambInt, sunCol, sunInt, sunX, sunY, sunZ) {
  scene.add(new THREE.AmbientLight(ambCol, ambInt));
  const sun = new THREE.DirectionalLight(sunCol, sunInt);
  sun.position.set(sunX, sunY, sunZ);
  sun.castShadow = true;
  sun.shadow.mapSize.width = 1024; sun.shadow.mapSize.height = 1024;
  sun.shadow.camera.near = 0.5; sun.shadow.camera.far = 300;
  sun.shadow.camera.left = -100; sun.shadow.camera.right = 100;
  sun.shadow.camera.top = 100; sun.shadow.camera.bottom = -100;
  scene.add(sun);
}

function addTree(scene, x, z) {
  const trunk = M(cylG(0.22,0.18,1.4,8), lmat(0x5a3010));
  trunk.position.set(x,0.7,z); trunk.castShadow=true; scene.add(trunk);
  const top = M(sphG(rnd(1.0,1.6),7), lmat(0x1a5a10));
  top.position.set(x,2.2+rnd(-0.3,0.3),z); top.castShadow=true; scene.add(top);
  const top2 = M(sphG(rnd(0.8,1.2),6), lmat(0x2a7a20));
  top2.position.set(x+rnd(-0.4,0.4),2.8+rnd(-0.2,0.2),z+rnd(-0.4,0.4)); top2.castShadow=true; scene.add(top2);
}

function addPortalGate(scene, x, z, rotY, label, color) {
  const arc = new THREE.Group();
  // Two posts
  for (const xs of [-1.2,1.2]) {
    addM(arc, cylG(0.15,0.15,3.5,8), lmat(color), xs,1.75,0);
  }
  // Top bar
  addM(arc, cylG(0.15,0.15,2.55,8), lmat(color), 0,3.55,0, 0,0,Math.PI/2);
  // Glow panel
  const panel = M(boxG(2.4,2.9,0.1), new THREE.MeshBasicMaterial({color, transparent:true, opacity:0.25, side:THREE.DoubleSide}));
  panel.position.set(0,1.8,0); arc.add(panel);
  arc.position.set(x,0,z);
  arc.rotation.y = rotY;
  scene.add(arc);
  // Label sprite (using a simple mesh + text approximation via colored box)
  const sign = M(boxG(2.2,0.4,0.05), lmat(color));
  sign.position.set(x,4.2,z+Math.sin(rotY)*0.1); scene.add(sign);
}

// ── FARM SCENE ───────────────────────────────────────────────
function buildFarmScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb);
  scene.fog = new THREE.Fog(0x87ceeb, 80, 220);
  addLights(scene, 0xffffff,0.55, 0xffffff,0.9, 60,100,40);

  // Ground
  const gnd = M(new THREE.PlaneGeometry(260,260,1,1), new THREE.MeshLambertMaterial({color:0x2d6a2d}));
  gnd.rotation.x = -Math.PI/2; gnd.receiveShadow = true; scene.add(gnd);

  // Grass patches
  for (let i=0;i<80;i++) {
    const p = M(boxG(rnd(0.3,1.0),0.06,rnd(0.3,1.0)), lmat(0x1a5a10));
    p.position.set(rnd(-100,100),0.03,rnd(-100,100)); scene.add(p);
  }

  // Barn (at x=18, z=-10)
  const barn = new THREE.Group();
  addM(barn, boxG(8,5,6),   lmat(0x8B2500), 0,2.5,0);
  addM(barn, boxG(8.4,0.4,6.4), lmat(0x6B1500), 0,5.2,0);
  // Roof (triangular prism approx with tapered box)
  const roof = M(new THREE.CylinderGeometry(0,4.6,3,4,1), lmat(0xcc3300));
  roof.position.set(0,6.5,0); roof.rotation.y=Math.PI/4; barn.add(roof);
  addM(barn, boxG(2.2,3,0.3), lmat(0x4a1a00), 0,1.5,3.15); // door
  barn.position.set(18,0,-10); scene.add(barn);

  // Fences
  for (let i=-6;i<=6;i++) {
    for (const zOff of [-28,28]) {
      addM(scene, cylG(0.1,0.1,1.8,6), lmat(0x8B6914), i*4.5,0.9,zOff);
      if (i<6) { addM(scene, boxG(4.5,0.1,0.1), lmat(0x8B6914), i*4.5+2.25,1.2,zOff); }
    }
    for (const xOff of [-28,28]) {
      addM(scene, cylG(0.1,0.1,1.8,6), lmat(0x8B6914), xOff,0.9,i*4.5);
      if (i<6) { addM(scene, boxG(0.1,0.1,4.5), lmat(0x8B6914), xOff,1.2,i*4.5+2.25); }
    }
  }

  // Trees around farm
  for (let i=0;i<28;i++) {
    const a=rnd(0,Math.PI*2), r=rnd(32,70);
    addTree(scene, Math.cos(a)*r, Math.sin(a)*r);
  }

  // Hay bales
  for (let i=0;i<8;i++) {
    const hb = M(cylG(0.9,0.9,1.1,12), lmat(0xc8a020));
    hb.rotation.z=Math.PI/2; hb.position.set(rnd(-22,22),0.55,rnd(-22,22)); hb.castShadow=true; scene.add(hb);
  }

  // Dirt path to barn
  addM(scene, boxG(2.5,0.02,12), lmat(0x8B7355), 8,0.01,-4);

  // Water trough
  addM(scene, boxG(3,0.5,0.8), lmat(0x8B4513), -12,0.25,-8);
  addM(scene, boxG(2.8,0.3,0.6), lmat(0x4169e1), -12,0.45,-8, -0.05,0,0);

  // Zone portals (each unlockable)
  addPortalGate(scene, 0, -70, 0, 'Gym',      0xffd700); // north
  addPortalGate(scene, 70, 0,  Math.PI/2, 'Beach',    0x00aaff); // east
  addPortalGate(scene, 0,  70, Math.PI, 'Mountain', 0x888888); // south
  addPortalGate(scene, -70,0, -Math.PI/2,'Volcano',  0xff4400); // west

  scene.userData.portals = [
    { x:0,  z:-70, zone:'gym',      radius:4 },
    { x:70, z:0,   zone:'beach',    radius:4 },
    { x:0,  z:70,  zone:'mountain', radius:4 },
    { x:-70,z:0,   zone:'volcano',  radius:4 },
  ];

  return scene;
}

// ── GYM SCENE ────────────────────────────────────────────────
function buildGymScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x303030);
  scene.fog = new THREE.Fog(0x303030, 40, 120);
  addLights(scene, 0xffffff,0.8, 0xffffff,0.7, 0,30,10);
  // Overhead fluorescent strips
  for (let i=-2;i<=2;i++) {
    const strip = M(boxG(0.3,0.05,8), bmat(0xffffcc,0.9));
    strip.position.set(i*8,9,0); scene.add(strip);
  }

  // Floor
  const fl = M(new THREE.PlaneGeometry(80,80,1,1), new THREE.MeshLambertMaterial({color:0x555555}));
  fl.rotation.x=-Math.PI/2; fl.receiveShadow=true; scene.add(fl);
  // Rubber mat lines
  for (let i=-3;i<=3;i++) {
    addM(scene, boxG(0.1,0.02,78), lmat(0x222222), i*10,0.01,0);
    addM(scene, boxG(78,0.02,0.1), lmat(0x222222), 0,0.01,i*10);
  }

  // Walls
  for (const [wx,wz,ww,wh,wd] of [
    [0,40,80,10,0.5],[0,-40,80,10,0.5],[40,0,0.5,10,80],[-40,0,0.5,10,80]
  ]) {
    addM(scene, boxG(ww,wh,wd), lmat(0x444444), wx,5,wz);
  }

  // Weight racks
  for (let row=0;row<3;row++) {
    for (let col=0;col<4;col++) {
      const bar = M(cylG(0.06,0.06,2.0,8), lmat(0x888888));
      bar.rotation.z=Math.PI/2; bar.position.set(-15+col*10,1.2,-20+row*8); scene.add(bar);
      for (const xs of [-0.7,0.7]) {
        const wt = M(cylG(0.5,0.5,0.3,12), lmat(row===0?0xff4444:row===1?0x4444ff:0x44ff44));
        wt.rotation.z=Math.PI/2; wt.position.set(-15+col*10+xs,1.2,-20+row*8); scene.add(wt);
      }
      // Rack stand
      for (const xs2 of [-0.8,0.8]) addM(scene, cylG(0.06,0.06,1.2,6), lmat(0x666666), -15+col*10+xs2,0.6,-20+row*8);
    }
  }

  // Bench press benches
  for (let i=0;i<3;i++) {
    const bench = M(boxG(0.6,0.2,2.2), lmat(0x883300));
    bench.position.set(8+i*8,0.75,10); scene.add(bench);
    const legs = M(boxG(0.55,0.65,0.1), lmat(0x555555));
    legs.position.set(8+i*8,0.32,10); scene.add(legs);
  }

  // Pull-up bar frames
  for (let i=0;i<2;i++) {
    addM(scene, cylG(0.08,0.08,4.5,8), lmat(0x555555), -25+i*8,2.25,-10);
    addM(scene, cylG(0.08,0.08,4.5,8), lmat(0x555555), -25+i*8,2.25,-15);
    addM(scene, cylG(0.06,0.06,4.5,8), lmat(0x777777), -25+i*8+2.25,4.5,-12.5, 0,0,Math.PI/2);
  }

  // Punching bags
  for (let i=0;i<3;i++) {
    addM(scene, cylG(0.35,0.28,1.4,8), lmat(0xcc3300), 15,3.2,-15+i*7);
    addM(scene, cylG(0.04,0.04,2.5,6), lmat(0x888888), 15,5.0,-15+i*7);
  }

  // Mirror wall
  addM(scene, boxG(40,8,0.1), new THREE.MeshLambertMaterial({color:0xaaccff,metalness:0.8}), 0,4,39.9);

  // Motivational sign (colored box)
  addM(scene, boxG(10,1.5,0.2), lmat(0xcc0000), 0,8.5,-39);

  // Return portal
  addPortalGate(scene, 0,35, Math.PI,'Farm', 0x00ff88);
  scene.userData.portals = [{ x:0, z:35, zone:'farm', radius:4 }];
  // Enemy spawn points
  scene.userData.enemyZone = 'gym';
  scene.userData.bounds = 36;
  return scene;
}

// ── BEACH SCENE ──────────────────────────────────────────────
function buildBeachScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceef);
  scene.fog = new THREE.Fog(0xaaddff, 60, 180);
  addLights(scene, 0xfff8e0,0.65, 0xffee88,1.0, 80,100,20);

  // Sand ground
  const sand = M(new THREE.PlaneGeometry(120,80,1,1), new THREE.MeshLambertMaterial({color:0xe8d080}));
  sand.rotation.x=-Math.PI/2; sand.receiveShadow=true; scene.add(sand);

  // Water plane
  const water = M(new THREE.PlaneGeometry(120,60,1,1), new THREE.MeshLambertMaterial({color:0x1a7aaa,transparent:true,opacity:0.85}));
  water.rotation.x=-Math.PI/2; water.position.set(0,0.04,55); scene.add(water);

  // Sandy bumps/dunes
  for (let i=0;i<20;i++) {
    const dune = M(sphG(rnd(1.5,4),7), lmat(0xd4b860));
    dune.scale.y=0.3; dune.position.set(rnd(-50,50),0.3,rnd(-30,20)); dune.castShadow=true; scene.add(dune);
  }

  // Palm trees
  for (let i=0;i<8;i++) {
    const x=rnd(-45,45), z=rnd(-30,15);
    const trunk = M(cylG(0.18,0.12,4.5,8), lmat(0x8B6340));
    trunk.position.set(x,2.25,z); trunk.rotation.z=rnd(-0.2,0.2); trunk.castShadow=true; scene.add(trunk);
    for (let l=0;l<5;l++) {
      const leaf = M(new THREE.CylinderGeometry(0.05,0.6,2.2,5), lmat(0x1a8820));
      leaf.position.set(x+Math.cos(l*Math.PI*0.4)*1.1,4.8,z+Math.sin(l*Math.PI*0.4)*1.1);
      leaf.rotation.set(Math.PI*0.45,l*Math.PI*0.4,0); leaf.castShadow=true; scene.add(leaf);
    }
  }

  // Beach umbrellas
  for (let i=0;i<5;i++) {
    const x=rnd(-35,35), z=rnd(-25,5);
    addM(scene, cylG(0.06,0.06,2.5,6), lmat(0x885500), x,1.25,z);
    addM(scene, coneG(2.2,0.8,8), lmat(i%2===0?0xff4444:0x4488ff), x,3.2,z);
  }

  // Beach chairs
  for (let i=0;i<4;i++) {
    addM(scene, boxG(0.7,0.1,1.4), lmat(0xddaa44), -20+i*10,0.35,-10, -0.3,0,0);
  }

  // Sandcastles (from game spec)
  for (let i=0;i<3;i++) {
    const cx=rnd(-30,30), cz=rnd(-20,10);
    addM(scene, cylG(1.2,1.0,1.0,8), lmat(0xe0c870), cx,0.5,cz);
    addM(scene, coneG(1.1,0.8,8), lmat(0xd4b85a), cx,1.3,cz);
    for (let j=0;j<4;j++) {
      const a=j*Math.PI/2;
      addM(scene, cylG(0.35,0.3,0.75,8), lmat(0xe0c870), cx+Math.cos(a)*1.2,0.37,cz+Math.sin(a)*1.2);
      addM(scene, coneG(0.32,0.35,8), lmat(0xd4b85a), cx+Math.cos(a)*1.2,0.95,cz+Math.sin(a)*1.2);
    }
  }

  // Driftwood
  for (let i=0;i<6;i++) {
    const log = M(cylG(0.12,0.08,rnd(1.5,3.5),6), lmat(0x8B7355));
    log.position.set(rnd(-40,40),0.1,rnd(-28,12));
    log.rotation.set(0,rnd(0,Math.PI),rnd(-0.1,0.3)); log.castShadow=true; scene.add(log);
  }

  addPortalGate(scene, -50,0, Math.PI/2,'Farm', 0x00ff88);
  scene.userData.portals = [{ x:-50, z:0, zone:'farm', radius:4 }];
  scene.userData.enemyZone = 'beach';
  scene.userData.bounds = 55;
  return scene;
}

// ── MOUNTAIN SCENE ───────────────────────────────────────────
function buildMountainScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x7a8fa0);
  scene.fog = new THREE.Fog(0x9aaabb, 50, 180);
  addLights(scene, 0xbbccdd,0.7, 0xeeeeff,0.8, -30,80,40);

  // Heightfield terrain
  const segments = 40;
  const geo = new THREE.PlaneGeometry(160,160,segments,segments);
  geo.rotateX(-Math.PI/2);
  const pos = geo.attributes.position;
  for (let i=0; i<pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = Math.max(0,
      Math.sin(x/22)*6 + Math.cos(z/18)*5 +
      Math.sin(x/10+1)*3 + Math.cos(z/12+2)*3 +
      (Math.abs(x)+Math.abs(z))/40 +
      Math.random()*1.5
    );
    pos.setY(i, h);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  const terrain = M(geo, new THREE.MeshLambertMaterial({color:0x7a7060}));
  terrain.receiveShadow = true; terrain.castShadow = true;
  scene.add(terrain);

  // Snow caps on high areas
  const snowGeo = new THREE.PlaneGeometry(160,160,segments,segments);
  snowGeo.rotateX(-Math.PI/2);
  const sp = snowGeo.attributes.position;
  for (let i=0; i<pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = pos.getY(i);
    sp.setX(i,x); sp.setY(i, h > 12 ? h + 0.05 : -999); sp.setZ(i,z);
  }
  sp.needsUpdate = true;
  snowGeo.computeVertexNormals();
  const snow = M(snowGeo, new THREE.MeshLambertMaterial({color:0xffffff}));
  scene.add(snow);

  // Rocks
  for (let i=0;i<40;i++) {
    const x=rnd(-70,70), z=rnd(-70,70);
    const rock = M(sphG(rnd(0.5,2.5),6), lmat(0x666655));
    rock.scale.set(rnd(0.6,1.8),rnd(0.4,0.9),rnd(0.6,1.8));
    rock.position.set(x,0.2,z); rock.castShadow=true; scene.add(rock);
  }

  // Pine trees on slopes
  for (let i=0;i<20;i++) {
    const x=rnd(-60,60), z=rnd(-60,60);
    const trunk = M(cylG(0.14,0.1,2.0,8), lmat(0x5a3010));
    trunk.position.set(x,1.0,z); trunk.castShadow=true; scene.add(trunk);
    for (let l=0;l<3;l++) {
      const lvl = M(coneG(1.2-l*0.3,1.4,7), lmat(0x1a4a10));
      lvl.position.set(x,2.3+l*0.9,z); lvl.castShadow=true; scene.add(lvl);
    }
  }

  // Cliff faces (tall boxes)
  for (let i=0;i<8;i++) {
    const a=rnd(0,Math.PI*2), r=rnd(30,55);
    const cliff = M(boxG(rnd(4,12),rnd(8,18),rnd(2,5)), lmat(0x5a5040));
    cliff.position.set(Math.cos(a)*r, rnd(2,7), Math.sin(a)*r); cliff.castShadow=true; scene.add(cliff);
  }

  // Mining rocks (interactive visual)
  for (let i=0;i<10;i++) {
    const r = M(sphG(0.8,6), lmat(0x6a5830));
    r.scale.set(rnd(0.8,1.8),rnd(0.6,1.0),rnd(0.8,1.8));
    r.position.set(rnd(-40,40),0.35,rnd(-40,40)); r.castShadow=true; scene.add(r);
  }

  addPortalGate(scene, 0,60, Math.PI,'Farm', 0x00ff88);
  scene.userData.portals = [{ x:0, z:60, zone:'farm', radius:4 }];
  scene.userData.enemyZone = 'mountain';
  scene.userData.bounds = 70;
  return scene;
}

// ── VOLCANO SCENE ────────────────────────────────────────────
function buildVolcanoScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a0808);
  scene.fog = new THREE.Fog(0x3a1808, 40, 140);
  addLights(scene, 0xff4400,0.4, 0xff6600,0.9, 0,60,0);
  // Lava glow from below
  const lavaLight = new THREE.PointLight(0xff4400, 2, 60);
  lavaLight.position.set(0,1,0); scene.add(lavaLight);

  // Dark rocky ground
  const gnd = M(new THREE.PlaneGeometry(140,140,1,1), new THREE.MeshLambertMaterial({color:0x2a1a0a}));
  gnd.rotation.x=-Math.PI/2; gnd.receiveShadow=true; scene.add(gnd);

  // Volcano cone (central)
  const cone1 = M(coneG(22,28,16), lmat(0x3a2010));
  cone1.position.set(0,14,0); cone1.castShadow=true; scene.add(cone1);
  // Inner crater
  const crater = M(coneG(6,4,12), lmat(0xff4400));
  crater.position.set(0,28.5,0); crater.rotation.y=0.2; scene.add(crater);
  // Lava top glow
  const lavaCap = M(new THREE.CircleGeometry(5.5,12), new THREE.MeshBasicMaterial({color:0xff6600}));
  lavaCap.rotation.x=-Math.PI/2; lavaCap.position.set(0,28.2,0); scene.add(lavaCap);

  // Lava rivers
  for (let i=0;i<5;i++) {
    const a=i*Math.PI*0.4+0.2;
    const river = M(boxG(1.5,0.08,rnd(12,22)), new THREE.MeshBasicMaterial({color:0xff5500,transparent:true,opacity:0.85}));
    river.rotation.y=a; river.position.set(Math.cos(a)*12,0.08,Math.sin(a)*12); scene.add(river);
  }

  // Lava pools
  for (let i=0;i<8;i++) {
    const a=rnd(0,Math.PI*2), r=rnd(18,50);
    const pool = M(new THREE.CircleGeometry(rnd(2,5),10), new THREE.MeshBasicMaterial({color:0xff4400,transparent:true,opacity:0.8}));
    pool.rotation.x=-Math.PI/2; pool.position.set(Math.cos(a)*r,0.06,Math.sin(a)*r); scene.add(pool);
    // Pool glow
    const glow = new THREE.PointLight(0xff3300, 0.8, 12);
    glow.position.set(Math.cos(a)*r,1,Math.sin(a)*r); scene.add(glow);
  }

  // Volcanic rocks
  for (let i=0;i<50;i++) {
    const rock = M(sphG(rnd(0.3,1.8),5), lmat(0x2a1a0a));
    rock.scale.set(rnd(0.5,2),rnd(0.3,0.8),rnd(0.5,2));
    rock.position.set(rnd(-60,60),0.2,rnd(-60,60)); rock.castShadow=true; scene.add(rock);
  }

  // Steam/smoke pillars (static cones approximation)
  for (let i=0;i<6;i++) {
    const a=rnd(0,Math.PI*2), r=rnd(8,20);
    const steam = M(coneG(1.2,5,6), new THREE.MeshBasicMaterial({color:0x888888,transparent:true,opacity:0.2}));
    steam.position.set(Math.cos(a)*r, 5, Math.sin(a)*r); scene.add(steam);
  }

  // Obsidian pillars
  for (let i=0;i<12;i++) {
    const a=rnd(0,Math.PI*2), r=rnd(22,55);
    const pillar = M(cylG(rnd(0.4,1.0),rnd(0.2,0.7),rnd(2,8),5), lmat(0x111111));
    pillar.position.set(Math.cos(a)*r,rnd(1,4),Math.sin(a)*r); pillar.rotation.z=rnd(-0.2,0.2); pillar.castShadow=true; scene.add(pillar);
  }

  addPortalGate(scene, 55,0, -Math.PI/2,'Farm', 0x00ff88);
  scene.userData.portals = [{ x:55, z:0, zone:'farm', radius:4 }];
  scene.userData.enemyZone = 'volcano';
  scene.userData.bounds = 60;
  return scene;
}

// ============================================================
// GAME STATE
// ============================================================
const G = {
  running: false,
  day: 1,
  runes: {},
  unlockedZones: { farm:true, gym:false, beach:false, mountain:false, volcano:false },
  runesFedByType: { air:0, earth:0, water:0, fire:0 },
  currentZone: 'farm',
  isBossFight: false,
  victoryActive: false,

  // Scenes
  scenes: {},
  activeScene: null,

  // Entities (per zone)
  player: null,
  chickens: [],
  eggs: [],
  enemies: [],
  projectiles: [],
  runePickups: [],

  // Player combat target (for chicken assist)
  playerTarget: null,
  // Single locked target — white-outlined, all attacks home toward it
  lockedTarget: null,

  // HUD / UI
  msgEl: document.getElementById('msg-box'),
  animId: null,
  lastTime: 0,

  // ── INIT ──────────────────────────────────────────────────
  initRunes() { ALL_RUNES.forEach(r => { this.runes[r] = 0; }); },

  // ── START ─────────────────────────────────────────────────
  start() {
    this.initRunes();
    this.day = 1;
    this.chickens = [];
    this.eggs = [];
    this.enemies = [];
    this.projectiles = [];
    this.runePickups = [];
    this.isBossFight = false;
    this.victoryActive = false;
    this.runesFedByType = { air:0, earth:0, water:0, fire:0 };
    this.unlockedZones = { farm:true, gym:false, beach:false, mountain:false, volcano:false };
    this.currentZone = 'farm';
    this.playerTarget = null;
    this.lockedTarget = null;

    // Build all scenes
    this.scenes.farm     = buildFarmScene();
    this.scenes.gym      = buildGymScene();
    this.scenes.beach    = buildBeachScene();
    this.scenes.mountain = buildMountainScene();
    this.scenes.volcano  = buildVolcanoScene();
    this.activeScene = this.scenes.farm;

    // Player
    this.player = {
      pos: new THREE.Vector3(0, 0, 0),
      mesh: makePlayerMesh(),
      hp: 100, maxHp: 100,
      speed: 0.12,
      size: 0.7,
      dmg: 25,
      atkRange: 3.5,
      attackCooldown: 0,
      invincible: 0,
      dead: false,
      facingYaw: 0,
    };
    this.player.mesh.position.copy(this.player.pos);
    this.activeScene.add(this.player.mesh);

    // Spawn starting chickens
    for (let i=0;i<15;i++) this.spawnChicken('hen');
    for (let i=0;i<15;i++) this.spawnChicken('rooster');

    this.spawnInitialRunes();
    this.spawnEnemiesForDay();

    document.getElementById('start-screen').classList.add('hidden');
    this.running = true;
    camYaw = 0;

    this.msg('The chickens gather around you... 🐔', '#ffe080');
    setTimeout(() => this.msg('"Farmer Jim is going to EAT US! Find the runes and save us!"', '#ffcc44'), 2200);

    this.updateHUD();
    this.loop(0);
  },

  // ── SPAWN HELPERS ─────────────────────────────────────────
  spawnChicken(gender, x, z) {
    x = x !== undefined ? x : rnd(-20,20);
    z = z !== undefined ? z : rnd(-20,20);
    const c = {
      pos: new THREE.Vector3(x, 0, z),
      gender,
      transform: null,
      buffLevel: 0,
      specialUpgrades: {},   // rock/sand/lava upgrades
      following: false,
      hp: 40, maxHp: 40,
      hpRegen: 0,            // fractional regen accumulator
      dead: false,
      attackCooldown: 0,
      wanderTimer: rndI(80,200),
      wanderTarget: new THREE.Vector3(x+rnd(-8,8),0,z+rnd(-8,8)),
      label: gender==='hen'?'Hen':'Rooster',
      id: Math.random().toString(36).slice(2,8),
      mesh: null,
    };
    c.mesh = makeChickenMesh(c.gender, null, 0);
    c.mesh.position.copy(c.pos);
    this.activeScene.add(c.mesh);
    this.chickens.push(c);
    return c;
  },

  spawnEnemy(type, x, z, scene) {
    scene = scene || this.activeScene;
    const def = ENEMY_DEFS[type] || ZONE_ENEMY[type];
    if (!def) return;
    const scale = 1 + (this.day-1)*0.04;
    const e = {
      type,
      pos: new THREE.Vector3(x||rnd(-60,60), 0, z||rnd(-60,60)),
      def,
      label: def.label,
      hp: Math.round(def.hp*scale),
      maxHp: Math.round(def.hp*scale),
      dmg: Math.round(def.dmg*scale),
      speed: def.spd,
      size: def.sz,
      atkRange: def.atkR,
      aggroRange: def.aggR,
      ranged: def.ranged,
      runeType: def.runeT,
      attackCooldown: 0,
      stunTime: 0,
      dead: false,
      mesh: null,
    };
    e.mesh = makeEnemyMesh(type);
    e.mesh.position.copy(e.pos);
    // Outline halo child — shown only when this is the locked target
    e.outlineMesh = makeOutlineMesh(def.sz);
    e.outlineMesh.position.y = def.sz * 0.75;
    e.mesh.add(e.outlineMesh);
    e.aggroed = false;
    scene.add(e.mesh);
    this.enemies.push(e);
    return e;
  },

  spawnRunePickup(type, x, z) {
    x = x !== undefined ? x : rnd(-40,40);
    z = z !== undefined ? z : rnd(-40,40);
    const rp = {
      pos: new THREE.Vector3(x, 0.5, z),
      type, dead: false,
      mesh: makeRuneMesh(type),
      phase: rnd(0, Math.PI*2),
    };
    rp.mesh.position.copy(rp.pos);
    this.activeScene.add(rp.mesh);
    this.runePickups.push(rp);
    return rp;
  },

  spawnInitialRunes() {
    const zones = [
      {type:'air',  cx:-15, cz:-12, n:6},
      {type:'earth',cx:15,  cz:12,  n:6},
      {type:'water',cx:12,  cz:-15, n:6},
      {type:'fire', cx:-12, cz:15,  n:6},
    ];
    for (const z of zones) {
      for (let i=0;i<z.n;i++) this.spawnRunePickup(z.type, z.cx+rnd(-10,10), z.cz+rnd(-10,10));
    }
  },

  spawnEnemiesForDay() {
    const day = this.day;
    const count = Math.floor(3 + day*0.35);
    const types = ['cyborg_cow','psychic_sheep','heavy_horse','monster_mutt'];
    // Only spawn farm enemies when on farm
    for (let i=0;i<count;i++) {
      const type = types[i%types.length];
      const a = rnd(0,Math.PI*2), r = rnd(30,65);
      this.spawnEnemy(type, Math.cos(a)*r, Math.sin(a)*r, this.scenes.farm);
    }
  },

  spawnZoneEnemies(zoneName) {
    const scene = this.scenes[zoneName];
    const zType = zoneName;
    const bounds = scene.userData.bounds || 35;
    const count = 4 + Math.floor(this.day*0.25);
    for (let i=0;i<count;i++) {
      const a=rnd(0,Math.PI*2), r=rnd(8,bounds*0.7);
      const e = this.spawnEnemy(zType, Math.cos(a)*r, Math.sin(a)*r, scene);
    }
    // Rune pickups in zone
    const runeType = ZONE_RUNE[zoneName];
    for (let i=0;i<6;i++) {
      const a=rnd(0,Math.PI*2), r=rnd(5,bounds*0.6);
      const rp = {
        pos: new THREE.Vector3(Math.cos(a)*r, 0.5, Math.sin(a)*r),
        type:runeType, dead:false,
        mesh: makeRuneMesh(runeType),
        phase: rnd(0, Math.PI*2),
      };
      rp.mesh.position.copy(rp.pos);
      scene.add(rp.mesh);
      this.runePickups.push(rp);
    }
  },

  // ── ZONE TRANSITION ───────────────────────────────────────
  enterZone(zoneName) {
    if (!this.unlockedZones[zoneName] && zoneName !== 'farm') {
      this.msg(`🔒 Zone locked! Feed ${Object.keys(UNLOCK_REQ).find(k=>UNLOCK_REQ[k]===zoneName)} runes to 10 chickens first.`, '#ff8888');
      return;
    }
    const oldScene = this.activeScene;
    const newScene = this.scenes[zoneName];

    // Move player mesh
    oldScene.remove(this.player.mesh);
    newScene.add(this.player.mesh);

    // Move following chickens
    for (const c of this.chickens) {
      if (c.dead) continue;
      oldScene.remove(c.mesh);
      if (c.following) {
        newScene.add(c.mesh);
      } else {
        // Non-following chickens stay on farm
        if (zoneName !== 'farm') {
          this.scenes.farm.add(c.mesh);
        }
      }
    }

    // Remove non-farm enemies from arrays when leaving zone
    this.enemies = this.enemies.filter(e => {
      if (e.dead) return false;
      // Keep enemies in their scene
      return true;
    });

    // Clear zone-specific pickups/enemies from other zones
    this.runePickups = this.runePickups.filter(rp => !rp.dead);
    this.projectiles.forEach(p => { oldScene.remove(p.mesh); p.dead=true; });
    this.projectiles = [];

    this.activeScene = newScene;
    this.currentZone = zoneName;

    // Set player spawn position in new zone
    if (zoneName === 'farm') {
      // Return near the portal they came from
      const portals = newScene.userData.portals || [];
      // Player returns near opposite side
      this.player.pos.set(rnd(-5,5), 0, rnd(-5,5));
    } else {
      this.player.pos.set(0, 0, -30);
      // Spawn zone enemies if first visit
      const hasEnemies = this.enemies.some(e => e.mesh.parent === newScene);
      if (!hasEnemies) this.spawnZoneEnemies(zoneName);
    }
    this.player.mesh.position.copy(this.player.pos);

    const zoneLabel = ZONES[zoneName]?.label || zoneName;
    this.msg(`Entered: ${zoneLabel}`, '#aaffaa');
    this.updateHUD();
  },

  // ── SLEEP (next day) ──────────────────────────────────────
  sleep() {
    if (!this.running || this.isBossFight) return;
    this.day++;
    this.msg(`Day ${this.day} begins. Hens lay eggs!`, '#ffd700');

    for (const c of this.chickens) {
      if (c.dead || c.gender !== 'hen') continue;
      const egg = {
        pos: new THREE.Vector3(c.pos.x+rnd(-1.5,1.5), 0.18, c.pos.z+rnd(-1.5,1.5)),
        dead: false,
        mesh: makeEggMesh(),
      };
      egg.mesh.position.copy(egg.pos);
      this.scenes.farm.add(egg.mesh);
      this.eggs.push(egg);
    }

    this.enemies = this.enemies.filter(e => !e.dead);
    // Add new farm enemies
    if (this.currentZone === 'farm') this.spawnEnemiesForDay();
    else {
      // Still add them to farm for when player returns
      const day = this.day, count = Math.floor(3+day*0.35);
      const types = ['cyborg_cow','psychic_sheep','heavy_horse','monster_mutt'];
      for (let i=0;i<count;i++) {
        const type=types[i%types.length], a=rnd(0,Math.PI*2), r=rnd(30,65);
        this.spawnEnemy(type, Math.cos(a)*r, Math.sin(a)*r, this.scenes.farm);
      }
    }

    // Refresh farm rune pickups
    for (let i=0;i<4;i++) {
      const t = RUNE_TYPES[rndI(0,3)];
      this.spawnRunePickup(t, rnd(-30,30), rnd(-30,30));
    }

    if (this.day >= 100 && !this.isBossFight) this.triggerBoss();
    this.updateHUD();
  },

  // ── BOSS ──────────────────────────────────────────────────
  triggerBoss() {
    this.isBossFight = true;
    document.getElementById('boss-screen').classList.remove('hidden');
  },

  startBoss() {
    document.getElementById('boss-screen').classList.add('hidden');
    if (this.currentZone !== 'farm') this.enterZone('farm');
    // Red sky
    this.activeScene.background = new THREE.Color(0x3a0000);
    this.activeScene.fog = new THREE.Fog(0x3a0000, 40, 160);
    // Spawn boss
    const boss = {
      isBoss: true,
      type: 'boss',
      pos: new THREE.Vector3(0, 0, -25),
      mesh: makeBossMesh(),
      hp: 2000, maxHp: 2000,
      dmg: 35, speed: 0.04,
      size: 3.5,
      atkRange: 20,
      aggroRange: 9999,
      ranged: true,
      attackCooldown: 0,
      specialCooldown: 200,
      phase: 1,
      stunTime: 0,
      dead: false,
    };
    boss.mesh.position.copy(boss.pos);
    this.activeScene.add(boss.mesh);
    this.enemies.push(boss);
    this.enemies = this.enemies.filter(e => e.isBoss || e.dead);
    this.msg('DAY 100 — FARMER JIM APPROACHES!', '#ff0000');
  },

  // ── PLAYER ATTACK ─────────────────────────────────────────
  playerAttack() {
    if (!this.running || this.player.attackCooldown > 0) return;
    this.player.attackCooldown = 18;

    // Find nearest enemy in arc
    let nearest = null, nearestD = Infinity;
    for (const e of this.enemies) {
      if (e.dead || e.mesh.parent !== this.activeScene) continue;
      const d = dist2D(this.player, e);
      if (d < this.player.atkRange + e.size + 1.5 && d < nearestD) {
        nearestD = d; nearest = e;
      }
    }
    if (nearest) {
      const killed = this.damageEnemy(nearest, this.player.dmg);
      this.playerTarget = nearest.dead ? null : nearest;
    }

    // Shoot projectile — homes toward locked target if one exists
    const fwd = new THREE.Vector3(Math.sin(this.player.facingYaw), 0, Math.cos(this.player.facingYaw));
    this.spawnProjectile(this.player.pos.clone().add(new THREE.Vector3(0,1.2,0)), fwd, 0.35, this.player.dmg, 0x88ccff, 'player', this.lockedTarget);
  },

  setLockedTarget(e) {
    if (this.lockedTarget && this.lockedTarget.outlineMesh)
      this.lockedTarget.outlineMesh.visible = false;
    this.lockedTarget = e || null;
    if (this.lockedTarget && this.lockedTarget.outlineMesh)
      this.lockedTarget.outlineMesh.visible = true;
  },

  damageEnemy(e, dmg) {
    if (e.dead) return false;
    e.hp -= dmg;
    e.stunTime = 8;
    if (e.hp <= 0) {
      e.dead = true;
      e.mesh.parent && e.mesh.parent.remove(e.mesh);
      this.onEnemyKilled(e);
      if (this.playerTarget === e) this.playerTarget = null;
      if (this.lockedTarget === e) {
        // Hand lock off to the next already-aggroed enemy in this scene
        const next = this.enemies.find(en =>
          !en.dead && en.aggroed && en !== e && en.mesh.parent === this.activeScene
        );
        this.setLockedTarget(next || null);
      }
      return true;
    }
    return false;
  },

  onEnemyKilled(e) {
    const runeType = e.runeType || 'air';
    const rp = {
      pos: new THREE.Vector3(e.pos.x, 0.5, e.pos.z),
      type: runeType, dead: false,
      mesh: makeRuneMesh(runeType),
      phase: rnd(0,Math.PI*2),
    };
    rp.mesh.position.copy(rp.pos);
    this.activeScene.add(rp.mesh);
    this.runePickups.push(rp);
    if (e.isBoss) this.triggerVictory();
    else this.msg(`${e.label} defeated! Dropped a ${runeType} rune.`, '#88ff88');
  },

  spawnProjectile(origin, dir, spd, dmg, color, owner, homingTarget) {
    const pr = {
      pos: origin.clone(),
      dir: dir.clone().normalize(),
      speed: spd,
      dmg, color, owner,
      homingTarget: homingTarget || null,
      life: 80, dead: false,
      mesh: makeProjectile(color),
    };
    pr.mesh.position.copy(pr.pos);
    this.activeScene.add(pr.mesh);
    this.projectiles.push(pr);
  },

  // ── INTERACT ──────────────────────────────────────────────
  interact() {
    if (!this.running) return;
    const p = this.player;

    // Egg hatch
    for (const egg of this.eggs) {
      if (egg.dead) continue;
      if (dist2D(p, egg) < 2.0) {
        egg.dead = true;
        egg.mesh.parent && egg.mesh.parent.remove(egg.mesh);
        const gender = Math.random() < 0.5 ? 'hen' : 'rooster';
        const nc = this.spawnChicken(gender, egg.pos.x, egg.pos.z);
        this.msg(`A ${gender} hatched from the egg!`, '#ffe080');
        this.updateHUD();
        return;
      }
    }
    // Rune pickup
    for (const rp of this.runePickups) {
      if (rp.dead || rp.mesh.parent !== this.activeScene) continue;
      if (dist2D(p, rp) < 2.0) {
        rp.dead = true;
        rp.mesh.parent && rp.mesh.parent.remove(rp.mesh);
        this.runes[rp.type]++;
        this.msg(`Picked up ${rp.type} rune! (${this.runes[rp.type]} total)`, '#ffd700');
        this.updateHUD();
        return;
      }
    }
    // Chicken feed
    for (const c of this.chickens) {
      if (c.dead || c.mesh.parent !== this.activeScene) continue;
      if (dist2D(p, c) < 2.5) {
        this.openFeedPanel(c);
        return;
      }
    }
  },

  // ── FEED PANEL ────────────────────────────────────────────
  openFeedPanel(chicken) {
    const panel   = document.getElementById('feed-panel');
    const title   = document.getElementById('feed-title');
    const desc    = document.getElementById('feed-desc');
    const opts    = document.getElementById('feed-options');
    title.textContent = `Feed a Rune to ${chicken.label}`;
    desc.textContent  = chicken.transform
      ? `Transformed: ${CHK_XFORM[chicken.transform].label}. Feed upgrade runes to strengthen!`
      : 'Choose a rune to transform or upgrade this chicken:';
    opts.innerHTML = '';

    const addBtn = (label, action) => {
      const btn = document.createElement('button');
      btn.textContent = label;
      btn.onclick = () => { action(); this.closeFeedPanel(); this.updateHUD(); };
      opts.appendChild(btn);
    };

    // Basic transform runes (only if not yet transformed)
    if (!chicken.transform) {
      for (const r of RUNE_TYPES) {
        if (this.runes[r] <= 0) continue;
        const xf = CHK_XFORM[r];
        addBtn(`${RUNE_EMOJI[r]} ${r.charAt(0).toUpperCase()+r.slice(1)} Rune → ${xf.label} (have ${this.runes[r]})`, () => {
          this.runes[r]--;
          this.feedRuneToChicken(chicken, r);
        });
      }
    }

    // Special / upgrade runes — always available regardless of transform
    // Buff Rune: size/HP/dmg/speed boost
    if (this.runes.buff > 0) {
      addBtn(`${RUNE_EMOJI.buff} Buff Rune → BUFF UP! HP+30 DMG+30% SPD+10% SIZE+20% (have ${this.runes.buff})`, () => {
        this.runes.buff--;
        chicken.buffLevel++;
        chicken.maxHp += 30;
        chicken.hp = Math.min(chicken.hp + 30, chicken.maxHp);
        this.rebuildChickenMesh(chicken);
        this.msg(`${chicken.label} gets BUFFER! (Buff Lv.${chicken.buffLevel}) 💪`, '#FFD700');
      });
    }
    // Rock Rune: damage reduction + rocky armor
    if (this.runes.rock > 0) {
      addBtn(`${RUNE_EMOJI.rock} Rock Rune → Rocky Armor! -35% incoming dmg (have ${this.runes.rock})`, () => {
        this.runes.rock--;
        chicken.specialUpgrades.rock = (chicken.specialUpgrades.rock||0) + 1;
        chicken.maxHp += 20;
        chicken.hp = Math.min(chicken.hp + 20, chicken.maxHp);
        this.rebuildChickenMesh(chicken);
        this.msg(`${chicken.label} grows rocky armor! ⛰️`, '#aaaaaa');
      });
    }
    // Sand Rune: speed boost + sand projectile
    if (this.runes.sand > 0) {
      addBtn(`${RUNE_EMOJI.sand} Sand Rune → Speed Boost! +35% speed, sand blasts (have ${this.runes.sand})`, () => {
        this.runes.sand--;
        chicken.specialUpgrades.sand = (chicken.specialUpgrades.sand||0) + 1;
        this.rebuildChickenMesh(chicken);
        this.msg(`${chicken.label} is lightning fast! 🏖️`, '#F4A460');
      });
    }
    // Lava Rune: fire damage on hit
    if (this.runes.lava > 0) {
      addBtn(`${RUNE_EMOJI.lava} Lava Rune → Lava Coating! +50% damage (have ${this.runes.lava})`, () => {
        this.runes.lava--;
        chicken.specialUpgrades.lava = (chicken.specialUpgrades.lava||0) + 1;
        this.rebuildChickenMesh(chicken);
        this.msg(`${chicken.label} coated in lava! 🌋`, '#FF6347');
      });
    }

    if (opts.children.length === 0) {
      const p = document.createElement('p');
      p.textContent = 'No applicable runes to feed.';
      p.style.color = '#aaa';
      opts.appendChild(p);
    }
    panel.classList.remove('hidden');
    this.running = false; // pause game while panel open
  },

  closeFeedPanel() {
    document.getElementById('feed-panel').classList.add('hidden');
    this.running = true;
  },

  feedRuneToChicken(chicken, runeType) {
    chicken.transform = runeType;
    chicken.following = true;
    chicken.maxHp = 80;
    chicken.hp = 80;
    chicken.label = CHK_XFORM[runeType].label;
    this.runesFedByType[runeType]++;
    this.rebuildChickenMesh(chicken);
    this.msg(`${chicken.label} transformed! Now following you. 🐔✨`, '#ffd700');
    this.checkZoneUnlocks();
  },

  rebuildChickenMesh(chicken) {
    if (chicken.mesh.parent) {
      chicken.mesh.parent.remove(chicken.mesh);
    }
    chicken.mesh = makeChickenMesh(chicken.gender, chicken.transform, chicken.buffLevel);
    // Apply rock armor visuals
    if (chicken.specialUpgrades.rock) {
      for (let i=0;i<6;i++) {
        const a=i*Math.PI/3;
        addM(chicken.mesh, sphG(0.1,5), lmat(0x888888), Math.cos(a)*0.45,0.52,Math.sin(a)*0.45);
      }
    }
    // Apply lava visuals
    if (chicken.specialUpgrades.lava) {
      for (let i=0;i<3;i++) {
        const a=i*Math.PI*0.66;
        const lv = M(sphG(0.08,5), new THREE.MeshBasicMaterial({color:0xff4400,transparent:true,opacity:0.85}));
        lv.position.set(Math.cos(a)*0.4, 0.3, Math.sin(a)*0.4);
        chicken.mesh.add(lv);
      }
    }
    chicken.mesh.position.copy(chicken.pos);
    (chicken.following ? this.activeScene : this.scenes.farm).add(chicken.mesh);
  },

  checkZoneUnlocks() {
    for (const [runeType, count] of Object.entries(this.runesFedByType)) {
      const zoneName = UNLOCK_REQ[runeType];
      if (count >= 10 && !this.unlockedZones[zoneName]) {
        this.unlockedZones[zoneName] = true;
        this.msg(`🔓 NEW ZONE UNLOCKED: ${ZONES[zoneName].label}! Head to the portal!`, '#00ff88');
      }
    }
  },

  // ── CHICKEN PANEL ─────────────────────────────────────────
  toggleChickenPanel() {
    const panel = document.getElementById('chicken-panel');
    if (panel.classList.contains('hidden')) { this.renderChickenList(); panel.classList.remove('hidden'); }
    else panel.classList.add('hidden');
  },
  closeChickenPanel() { document.getElementById('chicken-panel').classList.add('hidden'); },

  renderChickenList() {
    const list = document.getElementById('chicken-list');
    list.innerHTML = '';
    const alive = this.chickens.filter(c => !c.dead);
    alive.forEach(c => {
      const div = document.createElement('div');
      div.className = 'chk-entry' + (c.following?' following':'') + (c.transform?' '+c.transform+'-t':'');
      let upgStr = '';
      if (c.buffLevel > 0) upgStr += ` 💪x${c.buffLevel}`;
      if (c.specialUpgrades.rock) upgStr += ` ⛰️x${c.specialUpgrades.rock}`;
      if (c.specialUpgrades.sand) upgStr += ` 🏖️x${c.specialUpgrades.sand}`;
      if (c.specialUpgrades.lava) upgStr += ` 🌋x${c.specialUpgrades.lava}`;
      div.innerHTML = `<b>${c.label}</b> HP:${Math.ceil(c.hp)}/${c.maxHp}${upgStr}`;
      const btn = document.createElement('button');
      btn.style = 'float:right;background:rgba(255,255,255,0.1);border:none;color:#fff;padding:2px 6px;border-radius:4px;cursor:pointer;font-size:11px;';
      btn.textContent = c.following ? 'Dismiss' : 'Follow';
      btn.onclick = () => { c.following = !c.following; this.renderChickenList(); };
      div.appendChild(btn);
      list.appendChild(div);
    });
    if (!alive.length) list.innerHTML = '<p style="color:#aaa">All chickens have fallen...</p>';
  },

  // ── SAVE / LOAD ───────────────────────────────────────────
  save() {
    const data = {
      day: this.day,
      runes: this.runes,
      playerHp: this.player.hp,
      unlockedZones: this.unlockedZones,
      runesFedByType: this.runesFedByType,
      chickens: this.chickens.map(c => ({
        x:c.pos.x, z:c.pos.z, gender:c.gender,
        transform:c.transform, buffLevel:c.buffLevel,
        specialUpgrades:c.specialUpgrades,
        following:c.following, hp:c.hp, maxHp:c.maxHp,
      })),
    };
    localStorage.setItem('buffchickens_save', JSON.stringify(data));
    this.msg('Game saved! 💾', '#88ff88');
  },

  load() {
    const raw = localStorage.getItem('buffchickens_save');
    if (!raw) { this.msg('No save found.', '#ff8888'); return; }
    const data = JSON.parse(raw);
    if (!this.running) { this.start(); }
    this.day   = data.day;
    this.runes = data.runes;
    this.player.hp = data.playerHp;
    this.unlockedZones = data.unlockedZones;
    this.runesFedByType = data.runesFedByType;

    // Remove old chickens
    for (const c of this.chickens) {
      c.mesh.parent && c.mesh.parent.remove(c.mesh);
    }
    this.chickens = [];

    for (const cd of data.chickens) {
      const c = {
        pos: new THREE.Vector3(cd.x, 0, cd.z),
        gender: cd.gender, transform: cd.transform,
        buffLevel: cd.buffLevel||0,
        specialUpgrades: cd.specialUpgrades||{},
        following: cd.following, hp: cd.hp, maxHp: cd.maxHp||40,
        hpRegen: 0, dead: false,
        attackCooldown: 0, stunTime: 0,
        wanderTimer: rndI(80,200),
        wanderTarget: new THREE.Vector3(cd.x+rnd(-8,8),0,cd.z+rnd(-8,8)),
        label: cd.transform ? (CHK_XFORM[cd.transform]?.label||cd.transform) : (cd.gender==='hen'?'Hen':'Rooster'),
        id: Math.random().toString(36).slice(2,8),
        mesh: null,
      };
      c.mesh = makeChickenMesh(c.gender, c.transform, c.buffLevel);
      c.mesh.position.copy(c.pos);
      (c.following ? this.activeScene : this.scenes.farm).add(c.mesh);
      this.chickens.push(c);
    }

    this.updateHUD();
    this.msg('Game loaded! 💾', '#88ff88');
  },

  // ── VICTORY ───────────────────────────────────────────────
  triggerVictory() {
    this.running = false;
    document.getElementById('victory-screen').classList.remove('hidden');
    this.victoryActive = true;
    this.animateVictory(0);
  },

  animateVictory(frame) {
    if (!this.victoryActive) return;
    const vc = document.getElementById('victory-canvas');
    const vctx = vc.getContext('2d');
    vctx.clearRect(0,0,vc.width,vc.height);
    vctx.fillStyle='#1a2e00'; vctx.fillRect(0,0,vc.width,vc.height);
    const walkX = (frame*2.5)%(vc.width+200)-100;
    this.draw2DBuffChicken(vctx, walkX, vc.height/2+20, frame);
    requestAnimationFrame(() => this.animateVictory(frame+1));
  },

  draw2DBuffChicken(vctx, x, y, frame) {
    const s = 40, flex = Math.floor(frame/25)%2===1;
    vctx.save(); vctx.translate(x,y);
    vctx.beginPath(); vctx.ellipse(0,0,s*1.2,s*1.3,0,0,Math.PI*2); vctx.fillStyle='#ffd700'; vctx.fill();
    vctx.fillStyle='#ffaa00';
    if (flex) {
      vctx.beginPath(); vctx.ellipse(-s*1.1,-s,s*0.7,s*0.5,Math.PI*0.7,0,Math.PI*2); vctx.fill();
      vctx.beginPath(); vctx.ellipse( s*1.1,-s,s*0.7,s*0.5,-Math.PI*0.7,0,Math.PI*2); vctx.fill();
      for(let i=0;i<6;i++){const a=(i/6)*Math.PI*2;vctx.beginPath();vctx.arc(Math.cos(a)*s*2,Math.sin(a)*s*2-30,4,0,Math.PI*2);vctx.fillStyle='#fff';vctx.fill();}
    } else {
      vctx.beginPath(); vctx.ellipse(-s*1.3,-s*0.3,s*0.7,s*0.5,Math.PI*0.3,0,Math.PI*2); vctx.fill();
      vctx.beginPath(); vctx.ellipse( s*1.3,-s*0.3,s*0.7,s*0.5,-Math.PI*0.3,0,Math.PI*2); vctx.fill();
    }
    vctx.beginPath(); vctx.arc(s*0.6,-s*0.5,s*0.65,0,Math.PI*2); vctx.fillStyle='#ffd700'; vctx.fill();
    vctx.fillStyle='#e00';
    for(let i=0;i<3;i++){vctx.beginPath();vctx.arc(s*0.3+i*14,-s*1.05,8,Math.PI,Math.PI*2);vctx.fill();}
    vctx.fillStyle='rgba(0,0,0,0.7)'; vctx.fillRect(s*0.65,-s*0.68,s*0.75,s*0.28);
    const sw=Math.sin(frame/7)*14;
    vctx.fillStyle='#ffaa00';
    vctx.fillRect(-s*0.3+sw,s*1.1,s*0.2,s*0.65);
    vctx.fillRect( s*0.1-sw,s*1.1,s*0.2,s*0.65);
    vctx.restore();
  },

  // ── MSG / HUD ─────────────────────────────────────────────
  msg(text, color='#fff') {
    const el = document.createElement('div');
    el.className='msg'; el.style.color=color; el.textContent=text;
    this.msgEl.appendChild(el);
    setTimeout(()=>el.remove(), 3300);
  },

  updateHUD() {
    const alive = this.chickens.filter(c=>!c.dead).length;
    const eggCount = this.eggs.filter(e=>!e.dead).length;
    document.getElementById('day-label').textContent = `Day ${this.day} / 100`;
    document.getElementById('day-bar-fill').style.width = `${this.day}%`;
    document.getElementById('hp-bar-fill').style.width  = `${(this.player.hp/this.player.maxHp)*100}%`;
    document.getElementById('hp-text').textContent      = `${Math.ceil(this.player.hp)}/${this.player.maxHp}`;
    for (const r of ALL_RUNES) {
      const el = document.getElementById(`r-${r}`);
      if (el) el.textContent = this.runes[r]||0;
    }
    document.getElementById('chk-count').textContent = alive;
    document.getElementById('egg-count').textContent = eggCount;
    document.getElementById('area-name').textContent = ZONES[this.currentZone]?.label || 'The Farm';
  },

  // ── MAIN LOOP ─────────────────────────────────────────────
  loop(ts) {
    if (!this.running) {
      renderer.render(this.activeScene || this.scenes.farm, camera);
      this.animId = requestAnimationFrame(t => this.loop(t));
      return;
    }
    this.animId = requestAnimationFrame(t => this.loop(t));
    this.update(ts);
    this.renderFrame();
  },

  // ── UPDATE ────────────────────────────────────────────────
  update(ts) {
    const dt = Math.min(ts - this.lastTime, 50) / 16.67; // normalize to 60fps
    this.lastTime = ts;

    const p = this.player;

    // ── Player movement ──
    const forward = new THREE.Vector3(-Math.sin(camYaw), 0, -Math.cos(camYaw));
    const right   = new THREE.Vector3( Math.cos(camYaw), 0, -Math.sin(camYaw));
    const move = new THREE.Vector3();
    if (keys['w']||keys['arrowup'])    move.addScaledVector(forward, 1);
    if (keys['s']||keys['arrowdown'])  move.addScaledVector(forward,-1);
    if (keys['a']||keys['arrowleft'])  move.addScaledVector(right,  -1);
    if (keys['d']||keys['arrowright']) move.addScaledVector(right,   1);

    if (move.lengthSq() > 0) {
      move.normalize().multiplyScalar(p.speed * dt);
      p.pos.add(move);
      p.facingYaw = Math.atan2(move.x, move.z);
      p.mesh.rotation.y = p.facingYaw;
    }

    // Bounds
    const bounds = this.activeScene.userData.bounds || 85;
    p.pos.x = Math.max(-bounds, Math.min(bounds, p.pos.x));
    p.pos.z = Math.max(-bounds, Math.min(bounds, p.pos.z));
    p.pos.y = 0;
    p.mesh.position.copy(p.pos);

    if (p.invincible > 0) { p.invincible--; p.mesh.visible = Math.floor(p.invincible/4)%2===0; }
    else p.mesh.visible = true;
    if (p.attackCooldown > 0) p.attackCooldown--;

    // ── Player HP regen (~1 HP / 4 s, pauses for 2 s after taking a hit) ──
    if (p.hp < p.maxHp && p.invincible === 0) {
      p.hpRegen = (p.hpRegen || 0) + (dt / 240);
      if (p.hpRegen >= 1) {
        p.hp = Math.min(p.maxHp, p.hp + Math.floor(p.hpRegen));
        p.hpRegen -= Math.floor(p.hpRegen);
      }
    }

    // ── Portal check ──
    const portals = this.activeScene.userData.portals || [];
    for (const portal of portals) {
      if (dist2D(p, {pos:{x:portal.x,z:portal.z}}) < portal.radius) {
        if (portal.zone !== this.currentZone) {
          this.enterZone(portal.zone);
          return;
        }
      }
    }

    // ── Rune pickup (walk over) ──
    for (const rp of this.runePickups) {
      if (rp.dead || rp.mesh.parent !== this.activeScene) continue;
      rp.mesh.rotation.y += 0.03;
      rp.mesh.position.y = 0.5 + Math.sin(Date.now()/600 + rp.phase)*0.18;
      if (dist2D(p, rp) < 1.5) {
        rp.dead = true;
        rp.mesh.parent.remove(rp.mesh);
        this.runes[rp.type]++;
        this.msg(`${RUNE_EMOJI[rp.type]} ${rp.type} rune collected!`, '#ffd700');
        this.updateHUD();
      }
    }

    // ── Egg walk-over ──
    for (const egg of this.eggs) {
      if (egg.dead) continue;
      if (dist2D(p, egg) < 1.5) {
        egg.dead = true;
        egg.mesh.parent && egg.mesh.parent.remove(egg.mesh);
        const gender = Math.random() < 0.5 ? 'hen' : 'rooster';
        this.spawnChicken(gender, egg.pos.x, egg.pos.z);
        this.msg(`Egg hatched: a ${gender}!`, '#ffe080');
        this.updateHUD();
      }
    }

    // ── Chicken update ──
    const followingChickens = this.chickens.filter(c => !c.dead && c.following);
    let followIdx = 0;
    for (const c of this.chickens) {
      if (c.dead) continue;

      // Health regen: ~1 HP per 3 seconds (60fps → 1/180 per frame)
      if (c.hp < c.maxHp) {
        c.hpRegen += (dt / 180);
        if (c.hpRegen >= 1) {
          c.hp = Math.min(c.maxHp, c.hp + Math.floor(c.hpRegen));
          c.hpRegen -= Math.floor(c.hpRegen);
        }
      }

      // Only update chickens in current scene
      if (c.mesh.parent !== this.activeScene) continue;

      // Combat assist: target what player is targeting
      let combatTarget = null;
      if (c.transform && this.playerTarget && !this.playerTarget.dead && this.playerTarget.mesh.parent === this.activeScene) {
        combatTarget = this.playerTarget;
      }

      if (combatTarget && c.following) {
        // Move toward target
        const d = dist2D(c, combatTarget);
        const atkR = this.getChickenAtkRange(c);
        if (d > atkR) {
          const dx = combatTarget.pos.x - c.pos.x, dz = combatTarget.pos.z - c.pos.z;
          const len = Math.sqrt(dx*dx+dz*dz)||1;
          const spd = this.getChickenSpeed(c) * dt;
          c.pos.x += (dx/len)*spd; c.pos.z += (dz/len)*spd;
          c.mesh.rotation.y = Math.atan2(dx,dz);
        }
        // Attack
        if (d <= atkR + combatTarget.size + 0.5 && c.attackCooldown <= 0) {
          c.attackCooldown = 40;
          const dmg = this.getChickenDmg(c);
          if (this.getChickenProj(c)) {
            const dx=combatTarget.pos.x-c.pos.x, dz=combatTarget.pos.z-c.pos.z;
            const len=Math.sqrt(dx*dx+dz*dz)||1;
            const col = c.transform==='air'?0x87CEEB:c.transform==='water'?0x4169E1:c.transform==='fire'?0xFF4500:0xffffff;
            this.spawnProjectile(c.pos.clone().add(new THREE.Vector3(0,0.9,0)), new THREE.Vector3(dx/len,0,dz/len), 0.28, dmg, col, 'chicken', this.lockedTarget);
          } else {
            this.damageEnemy(combatTarget, dmg);
            if (combatTarget.dead && this.playerTarget === combatTarget) this.playerTarget = null;
          }
        }
      } else if (c.following) {
        // Follow player formation
        const angle = (followIdx / Math.max(1,followingChickens.length)) * Math.PI*2 + Date.now()*0.0005;
        const radius = 2.5 + Math.floor(followIdx/8)*1.5;
        const targetX = p.pos.x + Math.cos(angle)*radius;
        const targetZ = p.pos.z + Math.sin(angle)*radius + 2.5;
        const dx = targetX-c.pos.x, dz = targetZ-c.pos.z;
        const d = Math.sqrt(dx*dx+dz*dz);
        if (d > 0.5) {
          const spd = this.getChickenSpeed(c)*dt;
          c.pos.x += (dx/d)*Math.min(spd,d);
          c.pos.z += (dz/d)*Math.min(spd,d);
          c.mesh.rotation.y = Math.atan2(dx,dz);
        }
        followIdx++;
      } else {
        // Wander
        c.wanderTimer -= dt;
        if (c.wanderTimer <= 0) {
          c.wanderTimer = rndI(80,200);
          c.wanderTarget.set(c.pos.x+rnd(-8,8), 0, c.pos.z+rnd(-8,8));
        }
        const dx=c.wanderTarget.x-c.pos.x, dz=c.wanderTarget.z-c.pos.z;
        const d=Math.sqrt(dx*dx+dz*dz);
        if (d > 0.6) {
          c.pos.x += (dx/d)*0.05*dt;
          c.pos.z += (dz/d)*0.05*dt;
          c.mesh.rotation.y = Math.atan2(dx,dz);
        }
      }

      // Animate walk (bob)
      c.mesh.position.copy(c.pos);
      c.mesh.position.y = Math.abs(Math.sin(Date.now()/180 + c.pos.x))*0.08;
      if (c.attackCooldown > 0) c.attackCooldown--;
    }

    // ── Enemy update ──
    for (const e of this.enemies) {
      if (e.dead || e.mesh.parent !== this.activeScene) continue;
      if (e.stunTime > 0) { e.stunTime--; continue; }

      // Boss special phases
      if (e.isBoss) {
        if (e.hp < 1500 && e.phase===1){ e.phase=2; e.speed=0.055; e.dmg=45; this.msg('PHASE 2: "I\'ll turn you all into nuggets!"','#ff4400'); }
        if (e.hp <  800 && e.phase===2){ e.phase=3; e.speed=0.07;  e.dmg=55; this.msg('PHASE 3: "NO MORE MISTER NICE FARMER!"','#ff0000'); }
        // Boss triple shot
        if (e.attackCooldown <= 0) {
          e.attackCooldown = 48;
          const dx=p.pos.x-e.pos.x, dz=p.pos.z-e.pos.z, l=Math.sqrt(dx*dx+dz*dz)||1;
          for (const ao of [-0.3,0,0.3]) {
            const ang = Math.atan2(dx,dz)+ao;
            this.spawnProjectile(e.pos.clone().add(new THREE.Vector3(0,3,0)), new THREE.Vector3(Math.sin(ang),0,Math.cos(ang)), 0.22, e.dmg, 0xff4400, 'enemy');
          }
        }
        if (e.specialCooldown <= 0) {
          e.specialCooldown = 180;
          for (let i=0;i<8;i++) {
            const a=(i/8)*Math.PI*2;
            this.spawnProjectile(e.pos.clone().add(new THREE.Vector3(0,2,0)), new THREE.Vector3(Math.sin(a),0,Math.cos(a)), 0.18, e.dmg*0.7, 0xff8800, 'enemy');
          }
          this.msg('Farmer Jim uses RING OF PITCHFORKS!','#ff6600');
        }
        e.specialCooldown--;
      }

      const d = dist2D(e, p);

      // ── Aggro detection — first sight sets the locked target ──
      if (d < e.aggroRange && !e.aggroed) {
        e.aggroed = true;
        if (!this.lockedTarget || this.lockedTarget.dead) {
          this.setLockedTarget(e);
        }
      }

      // Aggro/chase
      if (d < e.aggroRange) {
        if (!e.isBoss && d > (e.atkRange || 3)) {
          const dx=p.pos.x-e.pos.x, dz=p.pos.z-e.pos.z, l=Math.sqrt(dx*dx+dz*dz)||1;
          e.pos.x += (dx/l)*e.speed*dt;
          e.pos.z += (dz/l)*e.speed*dt;
          e.mesh.rotation.y = Math.atan2(dx,dz);
        } else if (e.isBoss && d > 8) {
          const dx=p.pos.x-e.pos.x, dz=p.pos.z-e.pos.z, l=Math.sqrt(dx*dx+dz*dz)||1;
          e.pos.x += (dx/l)*e.speed*dt;
          e.pos.z += (dz/l)*e.speed*dt;
          e.mesh.rotation.y = Math.atan2(dx,dz);
        }

        // Melee attack
        if (e.attackCooldown <= 0 && d < (e.atkRange||3) + p.size) {
          e.attackCooldown = 90;
          if (e.ranged && !e.isBoss) {
            const dx=p.pos.x-e.pos.x, dz=p.pos.z-e.pos.z, l=Math.sqrt(dx*dx+dz*dz)||1;
            this.spawnProjectile(e.pos.clone().add(new THREE.Vector3(0,1,0)), new THREE.Vector3(dx/l,0,dz/l), 0.18, e.dmg, e.def?.col||0xff4400, 'enemy');
          } else if (!e.ranged) {
            p.hp -= e.dmg;
            p.invincible = 30;
            if (p.hp <= 0) { p.hp=0; p.dead=true; }
          }
        }
      }

      e.mesh.position.copy(e.pos);
      if (e.attackCooldown > 0) e.attackCooldown--;
    }

    // ── Projectile update ──
    for (const pr of this.projectiles) {
      if (pr.dead || pr.mesh.parent !== this.activeScene) continue;

      // Homing steering — curve toward locked target
      if (pr.homingTarget && !pr.homingTarget.dead) {
        const tx = pr.homingTarget.pos.x - pr.pos.x;
        const tz = pr.homingTarget.pos.z - pr.pos.z;
        const tLen = Math.sqrt(tx*tx + tz*tz) || 1;
        const desired = new THREE.Vector3(tx/tLen, 0, tz/tLen);
        pr.dir.lerp(desired, 0.09).normalize();
      }

      pr.pos.addScaledVector(pr.dir, pr.speed * dt);
      pr.pos.y = pr.owner==='enemy' ? 1.0 : 1.1;
      pr.mesh.position.copy(pr.pos);
      pr.life -= dt;
      if (pr.life <= 0) { pr.dead=true; pr.mesh.parent&&pr.mesh.parent.remove(pr.mesh); continue; }

      // Hit detection
      if (pr.owner==='enemy') {
        if (dist2D(pr, p) < p.size + 0.3 && p.invincible<=0) {
          pr.dead=true; pr.mesh.parent&&pr.mesh.parent.remove(pr.mesh);
          p.hp -= pr.dmg; p.invincible=30;
          if (p.hp<=0){p.hp=0;p.dead=true;}
        }
      } else {
        for (const e of this.enemies) {
          if (e.dead || e.mesh.parent !== this.activeScene) continue;
          if (dist2D(pr,e) < e.size + 0.3) {
            pr.dead=true; pr.mesh.parent&&pr.mesh.parent.remove(pr.mesh);
            this.damageEnemy(e, pr.dmg);
            break;
          }
        }
      }
    }

    // Prune dead
    this.enemies      = this.enemies.filter(e=>!e.dead);
    this.runePickups  = this.runePickups.filter(r=>!r.dead);
    this.projectiles  = this.projectiles.filter(pr=>!pr.dead);
    this.eggs         = this.eggs.filter(e=>!e.dead);
    this.chickens     = this.chickens.filter(c=>{
      if (c.dead) { c.mesh.parent&&c.mesh.parent.remove(c.mesh); return false; }
      return true;
    });

    // Player death
    if (p.dead) {
      this.running = false;
      document.getElementById('go-text').textContent = `You survived ${this.day} days... Farmer Jim wins.`;
      document.getElementById('gameover-screen').classList.remove('hidden');
    }

    if (Math.random() < 0.05) this.updateHUD();
  },

  // ── Chicken stat helpers ───────────────────────────────────
  getChickenSpeed(c) {
    let s = c.transform ? CHK_XFORM[c.transform].baseSpd : 0.07;
    s *= (1 + c.buffLevel*0.1);
    if (c.specialUpgrades.sand) s *= (1 + c.specialUpgrades.sand*0.35);
    return s;
  },
  getChickenDmg(c) {
    let d = c.transform ? CHK_XFORM[c.transform].baseDmg : 8;
    d *= (1 + c.buffLevel*0.3);
    if (c.specialUpgrades.lava) d *= (1 + c.specialUpgrades.lava*0.5);
    return d;
  },
  getChickenAtkRange(c) {
    return c.transform ? CHK_XFORM[c.transform].atkR : 2.5;
  },
  getChickenProj(c) {
    return c.transform ? CHK_XFORM[c.transform].proj : false;
  },

  // ── RENDER ────────────────────────────────────────────────
  renderFrame() {
    // Camera orbit around player
    const p = this.player;
    const cx = p.pos.x + Math.sin(camYaw)*CAM_DIST*Math.cos(camPitch);
    const cy = p.pos.y + Math.sin(camPitch)*CAM_DIST;
    const cz = p.pos.z + Math.cos(camYaw)*CAM_DIST*Math.cos(camPitch);
    camera.position.lerp(new THREE.Vector3(cx,cy,cz), 0.1);
    camera.lookAt(p.pos.x, p.pos.y + CAM_LOOK_H, p.pos.z);

    // Animate rune pickups
    // (done in update)

    renderer.render(this.activeScene, camera);
  },
};

// Expose Game to HTML
window.Game = G;

// Start rendering immediately (shows title screen backdrop)
G.scenes = {};
G.scenes.farm = buildFarmScene();
G.activeScene = G.scenes.farm;
G.player = { pos: new THREE.Vector3(0,0,0), mesh: makePlayerMesh(), hp:100, maxHp:100, invincible:0 };
G.player.mesh.position.copy(G.player.pos);
G.activeScene.add(G.player.mesh);
camera.position.set(0, 8, 13);
camera.lookAt(0, 1.4, 0);

// Idle render loop (before game starts)
(function idleRender(ts) {
  if (!G.running) {
    renderer.render(G.activeScene, camera);
    requestAnimationFrame(idleRender);
  }
})(0);
