import * as THREE from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';

// ---------- Geometry (metres) ----------
const H = 0.16, L1 = 0.30, L2 = 0.28, L3 = 0.14;   // shoulder height, upper arm, forearm, wrist→grasp centre
const CUBE = 0.05;
const OPEN_W = 0.095, CLOSED_W = 0.014;              // finger gap
const GRIP_HOLD = (CUBE + 0.002 - CLOSED_W) / (OPEN_W - CLOSED_W);
const MIN_Y = 0.027, MAX_Y = 0.55, MIN_R = 0.13;
const TABLE = { w: 1.6, d: 1.0, h: 0.75 };
const D2R = Math.PI / 180;

const JOINTS = [
  { key: 'base',  label: 'Base',     min: -180, max: 180 },
  { key: 'a1',    label: 'Shoulder', min: -10,  max: 170 },
  { key: 'th2',   label: 'Elbow',    min: -165, max: 20 },
  { key: 'th3',   label: 'Wrist',    min: -125, max: 125 },
  { key: 'roll',  label: 'Twist',    min: -180, max: 180 },
  { key: 'grip',  label: 'Gripper',  min: 0,    max: 100 },
];

// ---------- Renderer / scene ----------
const view = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
view.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xe9edf2);
scene.fog = new THREE.Fog(0xe9edf2, 4, 9);

const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.01, 50);
camera.position.set(1.05, 0.75, 1.0);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0.2, 0.12, 0);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.49;
controls.minDistance = 0.35; controls.maxDistance = 4;
controls.autoRotateSpeed = 0.7;

scene.add(new THREE.HemisphereLight(0xffffff, 0x8a96a8, 1.1));
const sun = new THREE.DirectionalLight(0xffffff, 2.2);
sun.position.set(1.2, 2.2, 0.9);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -1, right: 1, top: 1, bottom: -1, near: 0.5, far: 6 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.01;
scene.add(sun);
const fill = new THREE.DirectionalLight(0xdfe8ff, 0.6); fill.position.set(-1.5, 1, -1); scene.add(fill);

const mat = (color, rough = 0.5, metal = 0.1) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
const M = {
  orange: mat(0xf28c28, 0.42, 0.15), dark: mat(0x2a2f38, 0.5, 0.4), steel: mat(0xb8c0cc, 0.3, 0.8),
  table: mat(0x2f3a48, 0.75, 0.05), leg: mat(0x9aa4b2, 0.4, 0.6), floor: mat(0xd7dde5, 0.95, 0), pad: mat(0x3d4b5c, 0.8, 0),
};
const shadowy = (m) => { m.castShadow = true; m.receiveShadow = true; return m; };

// floor + table
const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), M.floor);
floor.rotation.x = -Math.PI / 2; floor.position.y = -TABLE.h; floor.receiveShadow = true; scene.add(floor);
const tableTop = shadowy(new THREE.Mesh(new THREE.BoxGeometry(TABLE.w, 0.04, TABLE.d), M.table));
tableTop.position.set(0.25, -0.02, 0); scene.add(tableTop);
for (const [x, z] of [[-0.5, -0.45], [-0.5, 0.45], [1.0, -0.45], [1.0, 0.45]]) {
  const leg = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, TABLE.h - 0.04), M.leg));
  leg.position.set(x, -TABLE.h / 2 - 0.02, z); scene.add(leg);
}
// work-area ring on the table
const ring = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.56, 96, 1, -Math.PI * 0.75, Math.PI * 1.5), new THREE.MeshBasicMaterial({ color: 0x3a4757 }));
ring.rotation.x = -Math.PI / 2; ring.rotation.z = 0; ring.position.y = 0.0006; scene.add(ring);

// ---------- Arm ----------
const baseYaw = new THREE.Group();
{
  const plinth = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.11, 0.05, 48), M.dark));
  plinth.position.y = 0.025; scene.add(plinth);
  scene.add(baseYaw);
  const turret = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.085, 0.06, 48), M.orange));
  turret.position.y = 0.08; baseYaw.add(turret);
  for (const z of [-0.045, 0.045]) {
    const cheek = shadowy(new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.08, 0.018), M.orange));
    cheek.position.set(0, 0.14, z); baseYaw.add(cheek);
  }
}
const jointDisc = (r, w, m = M.dark) => { const c = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(r, r, w, 40), m)); c.rotation.x = Math.PI / 2; return c; };
const link = (len, r, m = M.orange) => { const c = shadowy(new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 8, 24), m)); c.rotation.z = -Math.PI / 2; c.position.x = len / 2; return c; };

const shoulder = new THREE.Group(); shoulder.position.y = H; baseYaw.add(shoulder);
shoulder.add(jointDisc(0.042, 0.072));
shoulder.add(link(L1, 0.03));
const elbow = new THREE.Group(); elbow.position.x = L1; shoulder.add(elbow);
elbow.add(jointDisc(0.036, 0.07));
elbow.add(link(L2, 0.024));
const wrist = new THREE.Group(); wrist.position.x = L2; elbow.add(wrist);
wrist.add(jointDisc(0.03, 0.06));
const roll = new THREE.Group(); wrist.add(roll);
{
  const neck = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.022, 0.07, 32), M.steel));
  neck.rotation.z = -Math.PI / 2; neck.position.x = 0.045; roll.add(neck);
  const palm = shadowy(new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.032, 0.125), M.dark));
  palm.position.x = 0.092; roll.add(palm);
}
const fingers = [-1, 1].map((s) => {
  const f = shadowy(new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.026, 0.012), M.steel));
  f.position.set(0.1345, 0, 0); f.userData.side = s; roll.add(f); return f;
});
const grasp = new THREE.Object3D(); grasp.position.x = L3; roll.add(grasp);

// ---------- Cubes ----------
const CUBE_COLORS = [0xe5484d, 0x3e7bfa, 0x2fb67c, 0xf5c518];
const START = [[0.36, -0.16], [0.40, 0.12], [0.24, 0.27], [0.27, -0.33]];
const cubeGeo = new THREE.BoxGeometry(CUBE, CUBE, CUBE);
const cubes = CUBE_COLORS.map((c) => {
  const m = shadowy(new THREE.Mesh(cubeGeo, new THREE.MeshStandardMaterial({ color: c, roughness: 0.35 })));
  scene.add(m); return { mesh: m, state: 'rest', vy: 0 };
});
function resetCubes() {
  if (held) release();
  cubes.forEach((c, i) => { c.mesh.position.set(START[i][0], CUBE / 2, START[i][1]); c.mesh.rotation.set(0, i * 0.35, 0); c.state = 'rest'; c.vy = 0; });
}

function supportUnder(x, z, self) {
  let top = (x > tableTop.position.x - TABLE.w / 2 && x < tableTop.position.x + TABLE.w / 2 && Math.abs(z) < TABLE.d / 2) ? 0 : -TABLE.h;
  if (Math.hypot(x, z) < 0.11) top = Math.max(top, 0.05); // plinth
  const selfY = self && self.state !== 'held' ? self.mesh.position.y : 9;
  for (const c of cubes) {
    if (c === self || c.state === 'held') continue;
    const p = c.mesh.position;
    if (Math.abs(p.x - x) < CUBE * 0.9 && Math.abs(p.z - z) < CUBE * 0.9 && p.y < selfY) top = Math.max(top, p.y + CUBE / 2);
  }
  return top;
}

// ---------- State ----------
const q  = { base: 0, a1: 1.3, th2: -2.0, th3: 0, roll: 0, grip: 1 };   // actual
const qT = { ...q };                                                   // commanded
const T = new THREE.Vector3(0.3, 0.25, 0);                              // IK target (grasp centre)
let rollT = 0, mode = 'ik', held = null, speed = 1;

const wrapPi = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

function clampTarget(p) {
  p.y = clamp(p.y, MIN_Y, MAX_Y);
  let r = Math.hypot(p.x, p.z), ang = Math.atan2(p.z, p.x);
  const wz = p.y + L3 - H, maxD = L1 + L2 - 0.004;
  const maxR = Math.sqrt(Math.max(0.0001, maxD * maxD - wz * wz));
  r = clamp(r, MIN_R, maxR);
  p.x = r * Math.cos(ang); p.z = r * Math.sin(ang);
  return p;
}

function solveIK(p, rollAngle) {
  const r = Math.hypot(p.x, p.z);
  const base = q.base + wrapPi(Math.atan2(-p.z, p.x) - q.base);
  const wr = r, wz = p.y + L3 - H;
  const d = Math.hypot(wr, wz);
  const c2 = clamp((d * d - L1 * L1 - L2 * L2) / (2 * L1 * L2), -1, 1);
  const th2 = -Math.acos(c2);
  const a1 = Math.atan2(wz, wr) - Math.atan2(L2 * Math.sin(th2), L1 + L2 * Math.cos(th2));
  const th3 = -Math.PI / 2 - (a1 + th2);
  return { base, a1, th2, th3, roll: rollAngle };
}

// roll so the fingers line up with a cube's faces
function rollForYaw(baseAngle, cubeYaw) {
  let r = baseAngle - cubeYaw;
  r = ((r % (Math.PI / 2)) + Math.PI * 2.5) % (Math.PI / 2);
  if (r > Math.PI / 4) r -= Math.PI / 2;
  return r;
}

function applyPose() {
  baseYaw.rotation.y = q.base; shoulder.rotation.z = q.a1; elbow.rotation.z = q.th2; wrist.rotation.z = q.th3; roll.rotation.x = q.roll;
  const w = CLOSED_W + q.grip * (OPEN_W - CLOSED_W);
  for (const f of fingers) f.position.z = f.userData.side * (w / 2 + 0.006);
}

function setIKFromArm() { // switch joint → ik without a jump in target position
  roll.updateWorldMatrix(true, true); grasp.getWorldPosition(T); clampTarget(T); rollT = q.roll;
}

// ---------- Gripping ----------
const tmp = new THREE.Vector3();
function updateGrip() {
  grasp.getWorldPosition(tmp);
  if (!held && qT.grip < GRIP_HOLD) {
    const gap = CLOSED_W + q.grip * (OPEN_W - CLOSED_W);
    if (gap <= CUBE + 0.006) {
      let best = null, bd = 0.032;
      for (const c of cubes) { if (c.state === 'held') continue; const d = c.mesh.position.distanceTo(tmp); if (d < bd) { bd = d; best = c; } }
      if (best) { held = best; best.state = 'held'; roll.attach(best.mesh); }
    }
  }
  if (held) {
    q.grip = Math.max(q.grip, GRIP_HOLD);
    if (qT.grip > GRIP_HOLD + 0.05) release();
  }
}
function release() {
  const c = held; held = null;
  scene.attach(c.mesh);
  const e = new THREE.Euler().setFromQuaternion(c.mesh.quaternion, 'YXZ');
  c.mesh.rotation.set(0, e.y, 0);
  c.state = 'fall'; c.vy = 0;
}
function updateCubes(dt) {
  for (const c of cubes) {
    if (c.state === 'held') continue;
    const p = c.mesh.position, sup = supportUnder(p.x, p.z, c);
    if (c.state === 'rest' && p.y - CUBE / 2 > sup + 0.002) { c.state = 'fall'; c.vy = 0; }
    if (c.state === 'fall') {
      c.vy -= 9.81 * dt; p.y += c.vy * dt;
      if (p.y - CUBE / 2 <= sup) { p.y = sup + CUBE / 2; c.state = 'rest'; c.vy = 0; }
    }
  }
}

// ---------- Task queue (auto moves, playback) ----------
let queue = [], current = null;
const ease = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const busy = () => !!current || queue.length > 0;
function cancelTasks() { queue = []; current = null; }

function taskMove(to, rollTo = null, vel = 0.32) {
  return {
    start() { mode = 'ik'; this.from = T.clone(); this.r0 = rollT; this.to = clampTarget(to.clone());
      this.r1 = rollTo ?? rollT; this.t = 0;
      const fa = Math.atan2(this.from.z, this.from.x), ta = Math.atan2(this.to.z, this.to.x);
      this.fa = fa; this.da = wrapPi(ta - fa); this.fr = Math.hypot(this.from.x, this.from.z); this.tr = Math.hypot(this.to.x, this.to.z);
      const arc = Math.abs(this.da) * Math.max(this.fr, this.tr);
      this.dur = Math.max(0.35, Math.hypot(arc, this.tr - this.fr, this.to.y - this.from.y) / vel + Math.abs(this.r1 - this.r0) * 0.15); },
    update(dt) { this.t += dt * speed; const k = ease(Math.min(1, this.t / this.dur));
      const a = this.fa + this.da * k, r = this.fr + (this.tr - this.fr) * k;
      T.set(r * Math.cos(a), this.from.y + (this.to.y - this.from.y) * k, r * Math.sin(a)); rollT = this.r0 + (this.r1 - this.r0) * k;
      return this.t >= this.dur; },
  };
}
const taskGrip = (open) => ({ start() { qT.grip = open ? 1 : 0; this.t = 0; }, update(dt) { this.t += dt * speed; return this.t > 0.5; } });
const taskWait = (s) => ({ start() { this.t = 0; }, update(dt) { this.t += dt * speed; return this.t > s; } });
const taskCall = (fn) => ({ start() { fn(); }, update() { return true; } });
function taskJoints(to) {
  return {
    start() { mode = 'joint'; this.from = { ...qT }; this.t = 0;
      const dmax = Math.max(...['base', 'a1', 'th2', 'th3', 'roll'].map((k) => Math.abs(to[k] - this.from[k])));
      this.dur = Math.max(0.5, dmax / 1.1); },
    update(dt) { this.t += dt * speed; const k = ease(Math.min(1, this.t / this.dur));
      for (const key of ['base', 'a1', 'th2', 'th3', 'roll']) qT[key] = this.from[key] + (to[key] - this.from[key]) * k;
      if (this.t >= this.dur) { qT.grip = to.grip; return true; } return false; },
  };
}
function stepTasks(dt) {
  if (!current && queue.length) { current = queue.shift(); current.start(); }
  if (current && current.update(dt)) current = null;
}

// high-level sequences
const HOVER = 0.11;
function seqPick(c) {
  const p = c.mesh.position.clone();
  const base = Math.atan2(-p.z, p.x);
  const r = rollForYaw(base, c.mesh.rotation.y);
  queue.push(taskGrip(true), taskMove(new THREE.Vector3(p.x, p.y + HOVER, p.z), r), taskMove(new THREE.Vector3(p.x, p.y + 0.002, p.z), r, 0.18),
    taskGrip(false), taskMove(new THREE.Vector3(p.x, p.y + HOVER + 0.04, p.z), r, 0.22));
}
function seqPlace(x, z) {
  const queuedHeld = held;
  const sup = supportUnder(x, z, queuedHeld);
  const y = sup + CUBE / 2 + 0.003;
  queue.push(taskMove(new THREE.Vector3(x, y + HOVER, z)), taskMove(new THREE.Vector3(x, y, z), null, 0.16),
    taskGrip(true), taskWait(0.15), taskMove(new THREE.Vector3(x, y + HOVER, z), null, 0.22));
}
const HOME = new THREE.Vector3(0.3, 0.26, 0);
function goHome() { cancelTasks(); queue.push(taskMove(HOME.clone(), 0)); }

function runDemo() {
  cancelTasks(); if (held) release();
  const spot = [0.44, 0.0];
  queue.push(taskGrip(true), taskMove(HOME.clone(), 0));
  // plan each step when it is reached, so positions/heights are always live
  const later = (fn) => taskCall(() => { const save = queue; queue = []; fn(); queue = queue.concat(save); });
  const atSpot = (c) => Math.hypot(c.mesh.position.x - spot[0], c.mesh.position.z - spot[1]) < CUBE * 0.6;
  const order = [...cubes].sort((a, b) => Math.atan2(a.mesh.position.z, a.mesh.position.x) - Math.atan2(b.mesh.position.z, b.mesh.position.x));
  for (const c of order) {
    queue.push(later(() => {
      if (atSpot(c) || c.state !== 'rest') return;
      seqPick(c);
      queue.push(later(() => { if (held) seqPlace(spot[0], spot[1]); }));
    }));
  }
  queue.push(taskMove(HOME.clone(), 0));
  setStatus('Auto demo: stacking the cubes');
}

// ---------- Teach & replay ----------
let waypoints = [], loop = false;
try { waypoints = JSON.parse(localStorage.getItem('armsim.wp') || '[]'); } catch {}
const saveWp = () => { try { localStorage.setItem('armsim.wp', JSON.stringify(waypoints)); } catch {} ; updateWpInfo(); };
function addWaypoint() { waypoints.push({ ...qT, grip: qT.grip > 0.5 ? 1 : 0 }); saveWp(); toast(`Pose ${waypoints.length} saved`); }
function playWaypoints() {
  if (!waypoints.length) { toast('Save a few poses first (P)'); return; }
  cancelTasks();
  for (const w of waypoints) queue.push(taskJoints(w), taskWait(0.25));
  if (loop) queue.push(taskCall(() => { if (loop) playWaypoints(); }));
  setStatus(`Replaying ${waypoints.length} poses`);
}

// ---------- Input ----------
const keys = new Set();
addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  const k = e.key.toLowerCase();
  if (k === ' ') { e.preventDefault(); toggleGrip(); return; }
  if (['1', '2', '3', '4'].includes(k)) return setView(+k);
  if (k === 'h') return toggleClean();
  if (k === 'c') return toggleOrbit();
  if (k === 'g') return toggleGuides();
  if (k === 'p') return addWaypoint();
  if (k === 'escape') { cancelTasks(); return; }
  keys.add(e.code);
  if (e.code.startsWith('Arrow')) e.preventDefault();
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());

function toggleGrip() { if (busy()) cancelTasks(); qT.grip = qT.grip > 0.5 ? 0 : 1; }

const fwd = new THREE.Vector3(), right = new THREE.Vector3();
let padPrevA = false;
function manualInput(dt) {
  let mx = 0, mz = 0, my = 0, mr = 0;
  const has = (...c) => c.some((x) => keys.has(x));
  if (has('KeyW', 'ArrowUp')) mz += 1; if (has('KeyS', 'ArrowDown')) mz -= 1;
  if (has('KeyD', 'ArrowRight')) mx += 1; if (has('KeyA', 'ArrowLeft')) mx -= 1;
  if (has('KeyR', 'KeyE', 'PageUp')) my += 1; if (has('KeyF', 'KeyQ', 'PageDown')) my -= 1;
  if (has('KeyX')) mr += 1; if (has('KeyZ')) mr -= 1;
  // gamepad
  const pad = navigator.getGamepads ? [...navigator.getGamepads()].find(Boolean) : null;
  if (pad) {
    const dz = (v) => Math.abs(v) < 0.15 ? 0 : v;
    mx += dz(pad.axes[0] || 0); mz -= dz(pad.axes[1] || 0); my -= dz(pad.axes[3] || 0);
    if (pad.buttons[5]?.pressed) mr += 1; if (pad.buttons[4]?.pressed) mr -= 1;
    const a = !!pad.buttons[0]?.pressed; if (a && !padPrevA) toggleGrip(); padPrevA = a;
  }
  if (!mx && !mz && !my && !mr) return;
  if (busy()) cancelTasks();
  if (mode !== 'ik') { setIKFromArm(); mode = 'ik'; }
  const v = (keys.has('ShiftLeft') || keys.has('ShiftRight') ? 0.45 : 0.2) * speed * dt;
  camera.getWorldDirection(fwd); fwd.y = 0; fwd.normalize(); right.crossVectors(fwd, THREE.Object3D.DEFAULT_UP);
  T.addScaledVector(fwd, mz * v).addScaledVector(right, mx * v); T.y += my * v;
  clampTarget(T);
  rollT += mr * 1.6 * speed * dt;
}

// mouse picking
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
let downXY = null, hoverCube = null;
renderer.domElement.addEventListener('pointerdown', (e) => { downXY = [e.clientX, e.clientY]; });
renderer.domElement.addEventListener('pointerup', (e) => {
  if (!downXY || Math.hypot(e.clientX - downXY[0], e.clientY - downXY[1]) > 6) return;
  const hit = pick(e);
  if (!hit) return;
  if (busy()) { toast('Arm is busy — press Esc to stop'); return; }
  if (hit.cube && !held && hit.cube.state === 'rest') { seqPick(hit.cube); setStatus('Picking… now click where to put it'); return; }
  if (held) { const p = hit.cube ? hit.cube.mesh.position : hit.point; seqPlace(p.x, p.z); setStatus('Placing…'); return; }
  if (hit.point) { queue.push(taskMove(new THREE.Vector3(hit.point.x, 0.12, hit.point.z))); }
});
renderer.domElement.addEventListener('pointermove', (e) => {
  const hit = pick(e);
  const c = hit?.cube && !held ? hit.cube : null;
  if (c !== hoverCube) { if (hoverCube) hoverCube.mesh.material.emissive.setHex(0); hoverCube = c; if (c) c.mesh.material.emissive.setHex(0x333333); }
  renderer.domElement.style.cursor = (c || (held && hit)) ? 'pointer' : '';
  if (held && hit && guides && !recorder) { const p = hit.cube ? hit.cube.mesh.position : hit.point; ghost.visible = true;
    ghost.position.set(p.x, supportUnder(p.x, p.z, held) + CUBE / 2, p.z); } else ghost.visible = false;
});
function pick(e) {
  ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const free = cubes.filter((c) => c.state !== 'held');
  const hits = ray.intersectObjects([...free.map((c) => c.mesh), tableTop], false);
  if (!hits.length) return null;
  const h = hits[0], cube = free.find((c) => c.mesh === h.object);
  return { cube, point: h.point };
}

// ---------- Guides ----------
let guides = true;
const marker = new THREE.Mesh(new THREE.SphereGeometry(0.008, 16, 12), new THREE.MeshBasicMaterial({ color: 0xf28c28 }));
const dropLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
  new THREE.LineDashedMaterial({ color: 0xf28c28, dashSize: 0.01, gapSize: 0.008 }));
const ghost = new THREE.Mesh(cubeGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.6 }));
ghost.visible = false;
scene.add(marker, dropLine, ghost);
function updateGuides() {
  const show = guides && mode === 'ik' && !recorder;
  marker.visible = dropLine.visible = show;
  if (!show) return;
  marker.position.copy(T);
  const sup = supportUnder(T.x, T.z, held);
  const pos = dropLine.geometry.attributes.position;
  pos.setXYZ(0, T.x, T.y, T.z); pos.setXYZ(1, T.x, sup + 0.001, T.z); pos.needsUpdate = true;
  dropLine.computeLineDistances();
}

// ---------- Camera presets ----------
const VIEWS = {
  1: { pos: [1.05, 0.75, 1.0], tgt: [0.2, 0.12, 0] },
  2: { pos: [0.25, 0.45, 1.35], tgt: [0.22, 0.15, 0] },
  3: { pos: [0.27, 1.45, 0.001], tgt: [0.27, 0, 0] },
  4: { pos: [0.95, 0.42, 0.62], tgt: [0.32, 0.1, 0] },
};
let camAnim = null;
function setView(n) {
  const v = VIEWS[n]; if (!v) return;
  camAnim = { t: 0, p0: camera.position.clone(), t0: controls.target.clone(), p1: new THREE.Vector3(...v.pos), t1: new THREE.Vector3(...v.tgt) };
}

// ---------- UI ----------
const $ = (id) => document.getElementById(id);
const jointsEl = $('joints'), sliders = {};
for (const j of JOINTS) {
  const row = document.createElement('div'); row.className = 'joint';
  row.innerHTML = `<label>${j.label}</label><input type="range" min="${j.min}" max="${j.max}" step="1"><output></output>`;
  const input = row.querySelector('input'), out = row.querySelector('output');
  input.addEventListener('input', () => {
    if (busy()) cancelTasks();
    if (held && j.key !== 'grip') {/* keep holding */}
    mode = 'joint';
    qT[j.key] = j.key === 'grip' ? input.value / 100 : input.value * D2R;
  });
  input.addEventListener('pointerdown', () => (input.dragging = true));
  input.addEventListener('pointerup', () => (input.dragging = false));
  sliders[j.key] = { input, out, j };
  jointsEl.appendChild(row);
}
function updateSliders() {
  for (const k in sliders) {
    const { input, out } = sliders[k];
    const v = k === 'grip' ? q.grip * 100 : (k === 'base' || k === 'roll' ? wrapPi(q[k]) : q[k]) / D2R;
    if (!input.dragging) input.value = v;
    out.textContent = k === 'grip' ? `${Math.round(v)}%` : `${Math.round(v)}°`;
  }
}

$('btnDemo').onclick = runDemo;
$('btnHome').onclick = goHome;
$('btnGrip').onclick = toggleGrip;
$('btnReset').onclick = () => { cancelTasks(); resetCubes(); setStatus('Click a cube to pick it up'); };
$('speed').oninput = (e) => { speed = +e.target.value; $('speedOut').textContent = speed.toFixed(2).replace(/0$/, '') + '×'; };
document.querySelectorAll('[data-view]').forEach((b) => (b.onclick = () => setView(+b.dataset.view)));
$('btnOrbit').onclick = toggleOrbit;
$('btnGuides').onclick = toggleGuides;
$('btnClean').onclick = toggleClean;
$('btnAddWp').onclick = addWaypoint;
$('btnPlay').onclick = playWaypoints;
$('btnLoop').onclick = () => { loop = !loop; $('btnLoop').classList.toggle('on', loop); };
$('btnUndoWp').onclick = () => { waypoints.pop(); saveWp(); };
$('btnClearWp').onclick = () => { waypoints = []; saveWp(); };
function updateWpInfo() { $('wpInfo').textContent = `${waypoints.length} pose${waypoints.length === 1 ? '' : 's'} saved`; }
updateWpInfo();

function toggleOrbit() { controls.autoRotate = !controls.autoRotate; $('btnOrbit').classList.toggle('on', controls.autoRotate); }
function toggleGuides() { guides = !guides; $('btnGuides').classList.toggle('on', guides); if (!guides) ghost.visible = false; }
function toggleClean() { document.body.classList.toggle('clean'); }
let toastTimer;
function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 1600); }
function setStatus(s) { $('status').textContent = s; }

// ---------- Video recording ----------
let recorder = null, chunks = [], recStart = 0;
function pickMime() {
  const opts = ['video/mp4;codecs=avc1.640028', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  return opts.find((m) => window.MediaRecorder && MediaRecorder.isTypeSupported(m)) || '';
}
function toggleRecord() {
  if (recorder) { recorder.stop(); return; }
  if (!window.MediaRecorder) { toast('Recording not supported in this browser'); return; }
  const mime = pickMime();
  const stream = renderer.domElement.captureStream(60);
  recorder = new MediaRecorder(stream, { mimeType: mime || undefined, videoBitsPerSecond: 14_000_000 });
  chunks = [];
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  recorder.onstop = () => {
    const type = recorder.mimeType || mime || 'video/webm';
    const blob = new Blob(chunks, { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `robot-arm-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.${type.includes('mp4') ? 'mp4' : 'webm'}`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    recorder = null; document.body.classList.remove('recording');
    $('btnRec').textContent = '⏺ Record'; $('btnRec').className = 'primary grow';
    toast('Video saved to your downloads');
  };
  recorder.start(250); recStart = performance.now();
  document.body.classList.add('recording');
  $('btnRec').textContent = '■ Stop & save'; $('btnRec').className = 'rec grow';
}
$('btnRec').onclick = toggleRecord;
window.__sim = { q, qT, T, cubes, get held() { return held; }, seqPick, seqPlace, runDemo, busy, solveIK, rollForYaw, fingers, grasp, roll, scene };

// ---------- Main loop ----------
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

resetCubes();
Object.assign(q, solveIK(T, 0)); Object.assign(qT, q); qT.grip = q.grip = 1;
const clock = new THREE.Clock();
let wasBusy = false;
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  manualInput(dt);
  stepTasks(dt);
  if (mode === 'ik') { const s = solveIK(T, rollT); for (const k in s) qT[k] = s[k]; }
  // servo-like joint following
  const vmax = 3.2 * speed * dt;
  for (const k of ['base', 'a1', 'th2', 'th3', 'roll']) {
    const d = qT[k] - q[k]; q[k] += clamp(d * Math.min(1, dt * 18), -vmax, vmax);
  }
  q.grip += clamp(qT.grip - q.grip, -2.2 * speed * dt, 2.2 * speed * dt);
  updateGrip();
  applyPose();
  updateCubes(dt);
  updateGuides();
  updateSliders();
  if (camAnim) { camAnim.t = Math.min(1, camAnim.t + dt / 0.9); const k = ease(camAnim.t);
    camera.position.lerpVectors(camAnim.p0, camAnim.p1, k); controls.target.lerpVectors(camAnim.t0, camAnim.t1, k); if (camAnim.t >= 1) camAnim = null; }
  controls.update();
  const b = busy(); if (wasBusy && !b) setStatus(held ? 'Click the table or a cube to place it' : 'Click a cube to pick it up'); wasBusy = b;
  if (recorder) { const s = Math.floor((performance.now() - recStart) / 1000); $('recTime').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }
  renderer.render(scene, camera);
});
