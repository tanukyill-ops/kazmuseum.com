/**
 * Original, procedural educational miniatures of ten places in Kazakhstan.
 * Stylised reconstructions, not scans or measured architectural surveys.
 * Rebuild: node scripts/generate-models.mjs
 * Every exported model is self-contained binary glTF with real mesh geometry.
 */
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// GLTFExporter uses the browser FileReader API even when no textures are used.
globalThis.FileReader ??= class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((buffer) => {
      this.result = buffer;
      this.onload?.({ target: this });
      this.onloadend?.({ target: this });
    });
  }
  readAsDataURL(blob) {
    blob.arrayBuffer().then((buffer) => {
      this.result = `data:${blob.type};base64,${Buffer.from(buffer).toString('base64')}`;
      this.onload?.({ target: this });
      this.onloadend?.({ target: this });
    });
  }
};

const materials = {};
function mat(name, color, extra = {}) {
  return materials[name] ??= new THREE.MeshStandardMaterial({ name, color, roughness: .83, ...extra });
}
const M = {
  sand: mat('Warm limestone', '#cbaa76'),
  light: mat('Carved pale limestone', '#e4cf9f'),
  stone: mat('Stone plinth', '#b2a185'),
  edge: mat('Foundation edging', '#847968'),
  earth: mat('Steppe earth', '#b9a680'),
  dark: mat('Doorway shadows', '#273439'),
  cedar: mat('Cedar doors', '#624737'),
  turquoise: mat('Turquoise glazed ceramic', '#319aaf', { roughness: .29 }),
  cobalt: mat('Cobalt mosaic', '#22516f', { roughness: .42 }),
  tile: mat('Ivory mosaic', '#ebe0ba', { roughness: .46 }),
  terracotta: mat('Terracotta', '#b97c55'),
  clay: mat('Carved terracotta', '#d49b6c'),
  clayDark: mat('Terracotta recess', '#875637'),
  red: mat('Red sandstone', '#aa6450'),
  rust: mat('Warm sandstone blocks', '#c18568'),
  grass: mat('Sparse steppe vegetation', '#717a50'),
  white: mat('White painted steel', '#eee9d5', { roughness: .42, metalness: .15 }),
  glass: mat('Blue architectural glazing', '#537e86', { roughness: .18, metalness: .35 }),
  gold: mat('Golden reflective glass', '#d9af50', { roughness: .17, metalness: .68 }),
  chalk: mat('White chalk', '#e6dfca'),
  chalkLight: mat('Sunlit chalk', '#f4ecd8'),
  chalkShade: mat('Weathered chalk strata', '#c5b9a0'),
};

let seed = 876;
function rand() { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }
const g = () => new THREE.Group();
function mesh(group, geometry, material, x = 0, y = 0, z = 0) {
  const object = new THREE.Mesh(geometry, material);
  object.position.set(x, y, z); group.add(object); return object;
}
function box(group, w, h, d, material, x = 0, y = 0, z = 0) {
  return mesh(group, new THREE.BoxGeometry(w, h, d), material, x, y, z);
}
function cyl(group, rt, rb, h, material, x = 0, y = 0, z = 0, segments = 24) {
  return mesh(group, new THREE.CylinderGeometry(rt, rb, h, segments), material, x, y, z);
}
function ball(group, radius, material, x = 0, y = 0, z = 0, segments = 32) {
  return mesh(group, new THREE.SphereGeometry(radius, segments, Math.max(12, segments / 2)), material, x, y, z);
}
function ring(group, radius, thickness, material, x, y, z, rotate = true) {
  const m = mesh(group, new THREE.TorusGeometry(radius, thickness, 5, 40), material, x, y, z);
  if (rotate) m.rotation.x = Math.PI / 2;
  return m;
}
function rod(group, a, b, radius, material, segments = 6) {
  const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b), delta = vb.clone().sub(va);
  const object = cyl(group, radius, radius, delta.length(), material, 0, 0, 0, segments);
  object.position.copy(va.add(vb).multiplyScalar(.5));
  object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
  return object;
}
function line(group, points, radius, material, smooth = true) {
  if (!smooth) {
    for (let i = 1; i < points.length; i++) rod(group, points[i - 1], points[i], radius, material);
    return;
  }
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
  return mesh(group, new THREE.TubeGeometry(curve, Math.max(12, Math.ceil(points.length * 1.5)), radius, 5, false), material);
}
function base(group, w = 7, d = 6) {
  box(group, w, .17, d, M.edge, 0, .085, 0);
  box(group, w - .1, .16, d - .1, M.earth, 0, .25, 0);
}
function steps(group, w, count, stepH, stepD, x, y, z, material = M.light) {
  for (let i = 0; i < count; i++) box(group, w, stepH * (i + 1), stepD, material, x, y + stepH * (i + 1) / 2, z - stepD * i);
}
function archPath(width, height, inset = 0) {
  const p = new THREE.Path();
  const half = width / 2, spring = height * .59;
  p.moveTo(-half, -.02 + inset); p.lineTo(-half, spring);
  p.quadraticCurveTo(-half, height * .86, 0, height);
  p.quadraticCurveTo(half, height * .86, half, spring);
  p.lineTo(half, -.02 + inset); p.closePath();
  return p;
}
function archWall(group, width, height, depth, openingW, openingH, material, x, y, z) {
  const shape = new THREE.Shape();
  // The doorway meets the lower edge, so it is an indentation in the outline,
  // not a closed hole touching the exterior (which triangulators may fill).
  const half = openingW / 2, spring = openingH * .59;
  shape.moveTo(-width / 2, 0); shape.lineTo(-half, 0); shape.lineTo(-half, spring);
  shape.quadraticCurveTo(-half, openingH * .86, 0, openingH);
  shape.quadraticCurveTo(half, openingH * .86, half, spring);
  shape.lineTo(half, 0); shape.lineTo(width / 2, 0);
  shape.lineTo(width / 2, height); shape.lineTo(-width / 2, height); shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 16 });
  return mesh(group, geometry, material, x, y, z - depth / 2);
}
function archBorder(group, width, height, thickness, material, x, y, z) {
  const half = width / 2, sy = height * .59;
  const points = [];
  points.push([x - half, y, z], [x - half, y + sy, z]);
  for (let i = 1; i <= 12; i++) {
    const t = i / 12;
    points.push([x - half * (1 - t * t), y + ((1 - t) ** 2 * sy + 2 * (1 - t) * t * height * .86 + t * t * height), z]);
  }
  for (let i = 1; i <= 12; i++) {
    const t = i / 12;
    points.push([x + half * (2 * t - t * t), y + ((1 - t) ** 2 * height + 2 * (1 - t) * t * height * .86 + t * t * sy), z]);
  }
  points.push([x + half, y, z]); line(group, points, thickness, material, false);
}
function brickLines(group, width, height, x, y, z, material = M.clayDark, courses = 12) {
  for (let row = 1; row < courses; row++) {
    box(group, width, .014, .012, material, x, y + height * row / courses, z);
    const interval = width / 9;
    for (let col = 0; col < 9; col++) {
      const px = -width / 2 + interval * (col + (row % 2 ? .5 : 1));
      if (px < width / 2 - .05) box(group, .012, height / courses, .012, material, x + px, y + height * (row + .5) / courses, z);
    }
  }
}
function dome(group, radius, height, x, y, z, material = M.turquoise, ribs = 0) {
  const profile = [[0, 0], [.77, 0], [.91, .12], [1, .32], [.97, .5], [.83, .7], [.53, .89], [.14, .99], [0, 1]];
  mesh(group, new THREE.LatheGeometry(profile.map(([r, h]) => new THREE.Vector2(r * radius, h * height)), 64), material, x, y, z);
  if (ribs) for (let j = 0; j < ribs; j++) {
    const angle = j / ribs * Math.PI * 2;
    line(group, profile.slice(1, -1).map(([r, h]) => [x + (r * radius + .014) * Math.cos(angle), y + h * height, z + (r * radius + .014) * Math.sin(angle)]), .016, M.cobalt);
  }
}
function mosaicBand(group, radius, y, h, x = 0, z = 0, rows = 2) {
  for (let row = 0; row < rows; row++) for (let i = 0; i < 32; i++) {
    const angle = i / 32 * Math.PI * 2;
    const tile = box(group, .10, h / rows * .7, .028, (i + row) % 3 ? M.tile : M.cobalt, x + Math.sin(angle) * radius, y + h * (row + .5) / rows, z + Math.cos(angle) * radius);
    tile.rotation.y = angle;
  }
}
function shrub(group, x, z, s = .14, y = .34) {
  for (let j = 0; j < 3; j++) { const b = ball(group, s * (.6 + rand() * .35), M.grass, x + (rand() - .5) * s, y + s * .25, z + (rand() - .5) * s, 8); b.scale.y = .5; }
}

function yasawi() {
  const root = g(); base(root, 7.3, 6.5);
  box(root, 5.1, .16, 4.8, M.light, 0, .42, -.18);
  box(root, 4.75, 2.7, 4.25, M.sand, 0, 1.83, -.25);
  box(root, 4.82, .16, 4.31, M.light, 0, 3.23, -.25);
  // The monumental unfinished southern portal and its deeply recessed arch.
  archWall(root, 3.0, 4.15, .73, 1.58, 3.35, M.sand, 0, .5, 2.07);
  box(root, 1.56, 3.35, .04, M.dark, 0, 2.17, 1.90);
  archBorder(root, 1.77, 3.55, .055, M.light, 0, .5, 2.47);
  archBorder(root, 1.59, 3.35, .045, M.terracotta, 0, .5, 2.49);
  box(root, .77, 1.22, .11, M.cedar, 0, 1.13, 1.97);
  for (let x of [-.18, .18]) { box(root, .29, .93, .035, M.clayDark, x, 1.12, 2.04); ring(root, .039, .01, M.gold, x * .3, 1.08, 2.07, false); }
  box(root, .025, 1.2, .045, M.gold, 0, 1.13, 2.04);
  for (const x of [-1.32, 1.32]) {
    for (let row = 0; row < 19; row++) {
      box(root, .24, .018, .024, M.terracotta, x, .6 + row * .204, 2.445);
      if (row % 2 === 0) box(root, .018, .18, .026, M.terracotta, x, .7 + row * .204, 2.445);
    }
    cyl(root, .29, .31, 3.1, M.sand, x * 1.34, 2.05, 1.9, 24);
    cyl(root, .32, .32, .15, M.light, x * 1.34, 3.6, 1.9, 24);
  }
  // Ribbed blue main dome, glazed drum and smaller rear dome.
  cyl(root, 1.20, 1.20, .77, M.cobalt, 0, 3.45, -.56, 48);
  mosaicBand(root, 1.212, 3.1, .6, 0, -.56, 3);
  ring(root, 1.2, .06, M.tile, 0, 3.8, -.56);
  dome(root, 1.47, 1.77, 0, 3.78, -.56, M.turquoise, 32);
  cyl(root, .025, .055, .25, M.gold, 0, 5.64, -.56, 12);
  cyl(root, .64, .64, .43, M.cobalt, 1.43, 3.42, -1.3, 32);
  mosaicBand(root, .65, 3.22, .31, 1.43, -1.3);
  dome(root, .75, .95, 1.43, 3.59, -1.3, M.turquoise, 16);
  // Side bays: decorative panels and small window openings.
  for (const side of [-1, 1]) for (let bay = 0; bay < 5; bay++) {
    const z = -1.9 + bay * .76;
    box(root, .03, 1.45, .5, M.clayDark, side * 2.386, 1.69, z);
    box(root, .045, 1.28, .36, M.sand, side * 2.408, 1.67, z);
    box(root, .052, .34, .19, M.dark, side * 2.437, 2.0, z);
    box(root, .045, .085, .57, M.light, side * 2.421, 2.48, z);
  }
  steps(root, 2.15, 3, .065, .24, 0, .32, 3.08);
  for (let x of [-2.83, 2.83]) for (let z of [-2.55, 1.12, 2.57]) shrub(root, x, z, .19);
  return root;
}

function aishaBibi() {
  const root = g(); base(root, 6.8, 6.0);
  box(root, 4.6, .16, 4.5, M.stone, 0, .41, 0);
  box(root, 4.1, .19, 4.0, M.light, 0, .575, 0);
  box(root, 3.63, 2.6, 3.53, M.terracotta, 0, 1.96, 0);
  box(root, 3.78, .14, 3.68, M.clay, 0, 3.30, 0);
  box(root, 3.9, .11, 3.8, M.clayDark, 0, 3.405, 0);
  // Hundreds of tiny relief tiles model the richly patterned terracotta facade.
  for (const side of [0, 1, 2, 3]) {
    const panel = g(); root.add(panel); panel.rotation.y = side * Math.PI / 2;
    for (let row = 0; row < 10; row++) for (let col = 0; col < 13; col++) {
      const x = (col - 6) * .245, y = .86 + row * .231;
      if (side === 0 && Math.abs(x) < .7 && y < 2.55) continue;
      const t = box(panel, .174, .174, .044, (row + col) % 3 ? M.clay : M.light, x, y, 1.79);
      if ((row + col) % 2 === 0) t.rotation.z = Math.PI / 4;
      box(panel, .056, .056, .05, M.terracotta, x, y, 1.816).rotation.z = Math.PI / 4;
    }
    for (const x of [-1.64, 1.64]) {
      cyl(panel, .17, .2, 2.64, M.clay, x, 1.99, 1.73, 16);
      for (let row = 0; row < 13; row++) cyl(panel, .19, .19, .039, row % 3 ? M.terracotta : M.light, x, .77 + row * .203, 1.73, 16);
    }
  }
  box(root, 1.27, 1.93, .024, M.clayDark, 0, 1.68, 1.806);
  archWall(root, 1.4, 2.11, .12, .86, 1.73, M.clay, 0, .7, 1.88);
  box(root, .83, 1.59, .032, M.dark, 0, 1.50, 1.87);
  archBorder(root, .98, 1.87, .045, M.light, 0, .7, 1.973);
  box(root, .55, 1.18, .04, M.cedar, 0, 1.29, 1.946);
  // Tall, circular conical dome on a low round drum, matching the monument's
  // restored silhouette. Horizontal brick courses distinguish it from the
  // neighbouring Babadzha mausoleum's sixteen strongly ribbed roof facets.
  cyl(root, 1.44, 1.47, .22, M.terracotta, 0, 3.57, 0, 48);
  ring(root, 1.47, .033, M.clayDark, 0, 3.47, 0);
  ring(root, 1.45, .033, M.clay, 0, 3.66, 0);
  cyl(root, 0, 1.48, 2.15, M.terracotta, 0, 4.765, 0, 48);
  for (let j = 1; j < 11; j++) {
    const t = j / 12;
    ring(root, 1.48 * (1 - t), .009, M.clayDark, 0, 3.69 + 2.15 * t, 0);
  }
  cyl(root, .022, .044, .17, M.clayDark, 0, 5.90, 0, 12);
  ball(root, .065, M.clay, 0, 5.98, 0, 12).scale.set(.7, 1.3, .7);
  steps(root, 1.6, 4, .08, .23, 0, .33, 2.95);
  for (const x of [-2.7, 2.7]) for (const z of [-2.15, 1.9]) shrub(root, x, z, .18);
  return root;
}

function babadzha() {
  const root = g(); base(root, 6.4, 5.6);
  box(root, 4.25, .19, 4.12, M.light, 0, .425, 0);
  box(root, 3.25, 2.37, 3.20, M.sand, 0, 1.7, 0);
  for (const angle of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
    const side = g(); root.add(side); side.rotation.y = angle;
    brickLines(side, 3.25, 2.25, 0, .55, 1.606, M.terracotta, 17);
    for (const x of [-1.41, 1.41]) box(side, .20, 2.30, .14, M.light, x, 1.70, 1.64);
    box(side, 3.47, .11, .17, M.light, 0, 2.90, 1.62);
    if (angle !== 0) {
      box(side, .73, 1.43, .025, M.terracotta, 0, 1.63, 1.638);
      archWall(side, .83, 1.58, .055, .56, 1.36, M.sand, 0, .90, 1.69);
      box(side, .55, .1, .06, M.light, 0, .91, 1.728);
    }
  }
  box(root, .9, 1.58, .045, M.dark, 0, 1.30, 1.626);
  archWall(root, 1.36, 1.98, .23, .89, 1.60, M.light, 0, .52, 1.74);
  archBorder(root, .99, 1.73, .044, M.terracotta, 0, .52, 1.878);
  box(root, .59, 1.28, .04, M.cedar, 0, 1.16, 1.776);
  cyl(root, 1.47, 1.58, .48, M.light, 0, 3.16, 0, 8);
  cyl(root, 1.40, 1.40, .38, M.terracotta, 0, 3.52, 0, 16);
  ring(root, 1.40, .065, M.light, 0, 3.71, 0);
  // Distinctive sixteen-rib conical dome.
  cyl(root, 0, 1.48, 1.82, M.sand, 0, 4.62, 0, 16);
  for (let i = 0; i < 16; i++) {
    const a = i / 16 * Math.PI * 2;
    rod(root, [Math.sin(a) * 1.50, 3.73, Math.cos(a) * 1.50], [0, 5.54, 0], .035, M.light, 6);
  }
  cyl(root, .025, .04, .18, M.gold, 0, 5.60, 0, 8);
  steps(root, 1.50, 3, .065, .23, 0, .33, 2.42);
  shrub(root, -2.4, -1.92, .19); shrub(root, 2.4, 1.9, .17);
  return root;
}

function irregularRock(group, rings, material, x, y, z, sides = 9, phase = 0) {
  // Each ring is [height, radiusX, radiusZ, optional centreX, centreZ].
  const positions = [], factors = Array.from({ length: sides }, () => .88 + rand() * .23);
  const verts = rings.map(([h, rx, rz, cx = 0, cz = 0]) => Array.from({ length: sides }, (_, j) => {
    const a = phase + j / sides * Math.PI * 2;
    return [x + cx + Math.cos(a) * rx * factors[j], y + h, z + cz + Math.sin(a) * rz * factors[j]];
  }));
  for (let k = 0; k < rings.length - 1; k++) for (let j = 0; j < sides; j++) {
    const n = (j + 1) % sides;
    positions.push(...verts[k][j], ...verts[k + 1][j], ...verts[k][n], ...verts[k][n], ...verts[k + 1][j], ...verts[k + 1][n]);
  }
  for (let j = 1; j < sides - 1; j++) {
    positions.push(...verts[0][0], ...verts[0][j], ...verts[0][j + 1]);
    const t = verts.length - 1; positions.push(...verts[t][0], ...verts[t][j + 1], ...verts[t][j]);
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geo.computeVertexNormals();
  return mesh(group, geo, material);
}

function tamgaly() {
  const root = g(); base(root, 7.3, 5.5);
  const rock = mat('Weathered petroglyph rock', '#786453');
  const pale = mat('Petroglyph rock edges', '#99806a');
  const engraving = mat('Ancient rock carving', '#d7b589');
  irregularRock(root, [[0, 2.4, 1.16], [.25, 2.15, 1.05], [.6, 1.9, .77]], pale, 0, .32, -.12, 11);
  // Flat fronts preserve readability of the geometric petroglyph artwork.
  const slabOutline = new THREE.Shape();
  const slabPoints = [[-1.76, 0], [1.62, .02], [1.78, 1.28], [1.58, 2.68], [.57, 3.02], [-1.28, 2.9], [-1.74, 2.49], [-1.89, 1.03]];
  slabPoints.forEach(([x, y], index) => index ? slabOutline.lineTo(x, y) : slabOutline.moveTo(x, y)); slabOutline.closePath();
  mesh(root, new THREE.ExtrudeGeometry(slabOutline, { depth: .65, bevelEnabled: true, bevelSize: .08, bevelThickness: .08, bevelSegments: 1 }), rock, -.28, .64, -.5);
  irregularRock(root, [[0, .7, .76], [1.1, .63, .48], [2.5, .33, .32], [2.85, .10, .14]], rock, 2.2, .37, -.39, 6);
  irregularRock(root, [[0, .72, .8], [.7, .6, .58], [1.58, .32, .28]], pale, -2.4, .36, -.39, 6);
  const z = .255;
  function carving(points, thick = .029) { line(root, points.map(([x, y]) => [x, y, z]), thick, engraving, false); }
  // Sun-headed figure, an iconic motif of the Tamgaly petroglyph group.
  ring(root, .25, .031, engraving, -.65, 2.96, z, false);
  ring(root, .14, .025, engraving, -.65, 2.96, z, false);
  for (let j = 0; j < 12; j++) {
    const a = j / 12 * Math.PI * 2;
    carving([[-.65 + Math.sin(a) * .31, 2.96 + Math.cos(a) * .31], [-.65 + Math.sin(a) * .43, 2.96 + Math.cos(a) * .43]], .023);
  }
  carving([[-.65, 2.72], [-.65, 2.02], [-.99, 1.6]]); carving([[-.65, 2.02], [-.3, 1.57]]);
  carving([[-.65, 2.53], [-1.08, 2.3], [-1.24, 2.64]]); carving([[-.65, 2.53], [-.21, 2.30], [-.05, 2.62]]);
  // Ibex, deer, and smaller human figure; made of mesh lines, not image decals.
  carving([[.1, 1.27], [.34, 1.47], [1.17, 1.48], [1.37, 1.78], [1.59, 1.75]]);
  carving([[.32, 1.45], [.21, 1.01], [.12, .96]]); carving([[.57, 1.46], [.70, 1.01]]);
  carving([[1.07, 1.47], [1.04, 1.00]]); carving([[1.37, 1.76], [1.30, 2.12], [1.06, 2.19]]);
  carving([[1.48, 1.77], [1.53, 2.03], [1.41, 2.19]]);
  ring(root, .10, .026, engraving, .63, 2.79, z, false);
  carving([[.63, 2.70], [.63, 2.28], [.40, 2.04]]); carving([[.63, 2.28], [.83, 2.04]]);
  carving([[.29, 2.52], [.63, 2.58], [.97, 2.52]]);
  carving([[-1.62, 1.31], [-1.4, 1.50], [-.78, 1.50], [-.64, 1.69], [-.52, 1.67]], .021);
  for (const x of [-1.35, -.89]) carving([[x, 1.49], [x - .05, 1.1]], .021);
  for (let i = 0; i < 16; i++) {
    const x = (rand() - .5) * 6.2, rz = 1.0 + rand() * 1.4;
    irregularRock(root, [[0, .12 + rand() * .15, .14], [.18 + rand() * .15, .05, .065]], i % 2 ? pale : rock, x, .33, rz, 6);
  }
  shrub(root, -2.9, 1.62, .21); shrub(root, 2.87, -.88, .21);
  return root;
}

function ruinedWall(group, length, height, depth, x, y, z, material = M.sand, rotation = 0) {
  const wall = g(); group.add(wall); wall.position.set(x, y, z); wall.rotation.y = rotation;
  const blocks = Math.max(3, Math.round(length / .35)), courses = Math.max(2, Math.round(height / .25));
  for (let row = 0; row < courses; row++) for (let col = 0; col < blocks; col++) {
    if (row === courses - 1 && rand() > .65) continue;
    const w = length / blocks;
    const rock = box(wall, w - .02, .223, depth, (row + col) % 5 === 0 ? M.light : material, -length / 2 + w * (col + .5), row * .242 + .111, (rand() - .5) * .025);
    if (row === courses - 1) rock.rotation.z = (rand() - .5) * .065;
  }
  return wall;
}

function otrar() {
  const root = g(); base(root, 8.1, 6.5);
  box(root, 6.85, .19, 5.35, M.sand, 0, .42, 0);
  // Low excavated rooms within the perimeter of the old city.
  ruinedWall(root, 6.35, 1.2, .4, 0, .50, -2.33);
  for (const side of [-1, 1]) {
    ruinedWall(root, 4.72, 1.2, .4, side * 3.05, .5, 0, M.sand, Math.PI / 2);
    ruinedWall(root, 1.98, 1.45, .42, side * 2.10, .5, 2.20);
    cyl(root, .5, .63, 1.60, M.sand, side * .9, 1.3, 2.2, 20);
    ring(root, .52, .06, M.light, side * .9, 2.10, 2.2);
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2;
      box(root, .16, .26, .18, M.light, side * .9 + Math.sin(a) * .43, 2.23, 2.20 + Math.cos(a) * .43);
    }
    cyl(root, .38, .52, 1.3, M.sand, side * 3.04, 1.15, -2.25, 16);
  }
  archWall(root, 1.39, 1.70, .5, .90, 1.35, M.terracotta, 0, .50, 2.2);
  archBorder(root, 1.0, 1.48, .055, M.light, 0, .5, 2.47);
  // Central processional lane, courtyard outlines and residential foundations.
  box(root, .91, .025, 5.03, M.light, 0, .533, -.20);
  for (const side of [-1, 1]) for (let r = 0; r < 3; r++) {
    const z = -1.64 + r * 1.24;
    ruinedWall(root, 1.53, .71 + rand() * .2, .20, side * 1.79, .52, z - .5, M.terracotta);
    ruinedWall(root, 1.13, .71, .20, side * 1.0, .52, z, M.sand, Math.PI / 2);
    ruinedWall(root, 1.13, .49, .20, side * 2.57, .52, z, M.sand, Math.PI / 2);
    box(root, 1.29, .016, .91, M.earth, side * 1.78, .54, z);
  }
  for (let x of [-2.42, -1.78, -1.14]) {
    cyl(root, .09, .14, .53 + rand() * .4, M.light, x, .88, -1.88, 12);
    box(root, .24, .06, .24, M.terracotta, x, .57, -1.88);
  }
  for (let i = 0; i < 16; i++) {
    const x = (rand() - .5) * 7.3, z = (rand() > .5 ? 1 : -1) * (2.7 + rand() * .2);
    box(root, .15 + rand() * .12, .10 + rand() * .10, .12 + rand() * .1, M.sand, x, .40, z).rotation.y = rand() * 3;
  }
  shrub(root, -3.6, -2.55, .18); shrub(root, 3.49, 2.65, .20);
  return root;
}

function akyrtas() {
  const root = g(); base(root, 8.3, 6.7);
  box(root, 7.3, .14, 5.7, M.rust, 0, .40, 0);
  const blockMat = [M.red, M.rust, mat('Pink sandstone', '#bd8b74'), mat('Dark sandstone', '#905445')];
  function wall(length, rows, x, z, rotate = false) {
    const count = Math.round(length / .40), w = length / count;
    for (let row = 0; row < rows; row++) for (let i = 0; i < count; i++) {
      if (row === rows - 1 && rand() > .8) continue;
      const xx = -length / 2 + (i + .5) * w;
      const b = box(root, rotate ? .36 : w - .017, .266, rotate ? w - .017 : .36, blockMat[Math.floor(rand() * blockMat.length)], x + (rotate ? 0 : xx), .475 + row * .282 + .133, z + (rotate ? xx : 0));
      if (row === rows - 1) b.rotation.y = (rand() - .5) * .05;
    }
  }
  // Massive red stone palace footprint with a clearly open central courtyard.
  wall(6.72, 5, 0, -2.52); wall(5.1, 4, -3.20, 0, true); wall(5.1, 4, 3.20, 0, true);
  wall(2.69, 4, -2.0, 2.52); wall(2.69, 4, 2.0, 2.52);
  wall(3.30, 3, -1.50, -.3, true); wall(3.30, 3, 1.50, -.3, true);
  wall(3.0, 2, 0, -1.83); wall(3.0, 2, 0, 1.24);
  for (const side of [-1, 1]) for (let row = 0; row < 4; row++) wall(1.46, 3, side * 2.34, -1.82 + row * 1.12);
  for (const x of [-.94, 0, .94]) wall(1.04, 2, x, -2.05, true);
  box(root, 2.72, .03, 2.80, M.earth, 0, .49, -.29);
  box(root, 1.2, .033, 1.39, M.light, 0, .495, 2.14);
  // Fallen column drums and standing bases suggest the former colonnade.
  for (const x of [-1.08, 1.08]) for (const z of [-1.29, -.42, .49]) {
    box(root, .36, .09, .36, M.red, x, .55, z);
    cyl(root, .117, .156, .64 + rand() * .31, M.rust, x, .86, z, 12);
    cyl(root, .18, .18, .065, M.light, x, .625, z, 12);
  }
  cyl(root, .16, .16, .62, M.rust, .47, .70, .57, 12).rotation.z = Math.PI / 2;
  for (let i = 0; i < 23; i++) {
    const x = (rand() - .5) * 6.9, z = (rand() > .5 ? 1 : -1) * (2.9 + rand() * .15);
    box(root, .21 + rand() * .2, .16 + rand() * .12, .22, blockMat[i % 4], x, .42, z).rotation.y = rand() * 3;
  }
  return root;
}

function baiterek() {
  const root = g(); base(root, 6.1, 5.7);
  cyl(root, 2.25, 2.29, .13, M.stone, 0, .39, 0, 64);
  cyl(root, 1.9, 2.13, .17, M.light, 0, .54, 0, 64);
  cyl(root, .58, .69, .58, M.glass, 0, .90, 0, 32);
  cyl(root, .31, .42, 4.29, M.white, 0, 2.75, 0, 32);
  cyl(root, .19, .23, 4.70, M.glass, 0, 2.97, 0, 24);
  // Twenty-four bowed white lattice stems cradle the golden observation globe.
  const n = 24;
  function radius(t) { return .45 + .045 * Math.sin(t * Math.PI) + Math.pow(t, 3.35) * .83; }
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2;
    const points = [];
    for (let j = 0; j <= 16; j++) {
      const t = j / 16, r = radius(t);
      points.push([Math.cos(a) * r, .67 + t * 4.9, Math.sin(a) * r]);
    }
    line(root, points, .028, M.white);
    for (let j = 0; j < 9; j++) {
      const t0 = j / 10, t1 = (j + 1) / 10;
      const b = a + Math.PI * 2 / n;
      rod(root, [Math.cos(a) * radius(t0), .67 + t0 * 4.9, Math.sin(a) * radius(t0)], [Math.cos(b) * radius(t1), .67 + t1 * 4.9, Math.sin(b) * radius(t1)], .011, M.white, 5);
      rod(root, [Math.cos(b) * radius(t0), .67 + t0 * 4.9, Math.sin(b) * radius(t0)], [Math.cos(a) * radius(t1), .67 + t1 * 4.9, Math.sin(a) * radius(t1)], .011, M.white, 5);
    }
  }
  for (let j = 1; j < 10; j++) ring(root, radius(j / 10), .018, M.white, 0, .67 + j / 10 * 4.9, 0);
  ball(root, 1.03, M.gold, 0, 5.60, 0, 64);
  // Delicate panel seams make the sphere read as a glazed observation room.
  const seam = mat('Golden glazing seams', '#a88744', { roughness: .25, metalness: .6 });
  for (let j = -3; j <= 3; j++) {
    const yy = j * .25, r = Math.sqrt(1.034 ** 2 - yy ** 2);
    ring(root, r, .009, seam, 0, 5.60 + yy, 0);
  }
  for (let j = 0; j < 16; j++) {
    const a = j / 16 * Math.PI * 2;
    const pts = [];
    for (let k = 0; k <= 20; k++) {
      const p = -.5 * Math.PI + k / 20 * Math.PI;
      pts.push([Math.cos(p) * 1.036 * Math.cos(a), 5.60 + Math.sin(p) * 1.036, Math.cos(p) * 1.036 * Math.sin(a)]);
    }
    line(root, pts, .008, seam);
  }
  for (let i = 0; i < 10; i++) {
    const a = i / 10 * Math.PI * 2;
    const x = Math.sin(a) * 1.63, z = Math.cos(a) * 1.63;
    const slab = box(root, .3, .04, .61, M.sand, x, .65, z); slab.rotation.y = a;
  }
  for (let x of [-2.5, 2.5]) for (let z of [-1.9, 1.9]) shrub(root, x, z, .23);
  return root;
}

function khanShatyr() {
  const root = g(); base(root, 7.5, 6.4);
  const membrane = mat('Pearl tensile membrane', '#dedac8', { roughness: .43, metalness: .13, side: THREE.DoubleSide });
  const membraneAlt = mat('Shaded tensile membrane', '#c6cbc2', { roughness: .46, metalness: .12, side: THREE.DoubleSide });
  const steel = mat('Tensile cable structure', '#8a9895', { roughness: .39, metalness: .4 });
  cyl(root, 2.87, 3.05, .19, M.stone, 0, .43, 0, 72);
  const deck = cyl(root, 2.80, 2.82, .29, M.glass, 0, .66, 0, 72); deck.scale.z = .80;
  const rim = ring(root, 2.83, .065, M.white, 0, .83, 0); rim.scale.y = .80;
  const apex = new THREE.Vector3(.64, 4.97, -.27), segments = 64;
  function surface(a, t) {
    const radial = Math.pow(1 - t, 1.28), height = .83 + 4.14 * Math.pow(t, 1.12);
    return [Math.cos(a) * 2.83 * radial + apex.x * t, height, Math.sin(a) * 2.26 * radial + apex.z * t];
  }
  for (let i = 0; i < segments; i++) {
    const a0 = i / segments * Math.PI * 2, a1 = (i + 1) / segments * Math.PI * 2, positions = [];
    for (let j = 0; j < 16; j++) {
      const t0 = j / 16, t1 = (j + 1) / 16;
      const p00 = surface(a0, t0), p10 = surface(a1, t0), p01 = surface(a0, t1), p11 = surface(a1, t1);
      positions.push(...p00, ...p01, ...p10);
      if (j < 15) positions.push(...p10, ...p01, ...p11);
    }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.computeVertexNormals();
    mesh(root, geometry, i % 4 === 0 ? membraneAlt : membrane);
    if (i % 2 === 0) line(root, Array.from({ length: 20 }, (_, j) => { const p = surface(a0, j / 19); p[1] += .014; return p; }), .014, steel);
  }
  for (let j = 1; j <= 9; j++) {
    const t = j / 11, pts = [];
    for (let i = 0; i <= 64; i++) { const p = surface(i / 64 * Math.PI * 2, t); p[1] += .022; pts.push(p); }
    line(root, pts, .011, steel);
  }
  // The tilted central mast and cable-supported tent silhouette.
  rod(root, [.42, 3.90, -.17], [.72, 5.74, -.31], .048, M.white, 12);
  rod(root, [.69, 5.48, -.30], [-1.6, .94, -.98], .015, steel);
  rod(root, [.69, 5.48, -.30], [1.99, .96, -.96], .015, steel);
  for (let i = 0; i < 56; i++) {
    const a = i / 56 * Math.PI * 2;
    rod(root, [Math.cos(a) * 2.81, .55, Math.sin(a) * 2.25], [Math.cos(a) * 2.81, .81, Math.sin(a) * 2.25], .018, M.white, 6);
  }
  box(root, 1.65, .40, .46, M.glass, 0, .65, 2.26);
  box(root, 1.92, .055, .74, M.white, 0, .91, 2.40);
  for (const x of [-.73, -.25, .25, .73]) box(root, .022, .35, .03, M.white, x, .65, 2.50);
  steps(root, 2.14, 3, .045, .19, 0, .33, 3.00);
  for (const x of [-3.18, 3.18]) for (const z of [-1.8, 1.8]) shrub(root, x, z, .18);
  return root;
}

function layeredRock(group, x, z, width, depth, height, palette, topX = 0, topZ = 0, sides = 8) {
  const profile = [[0, 1.17], [.12, 1.00], [.28, .9], [.43, .94], [.57, .80], [.74, .83], [.88, .63], [1, .57]];
  // Reuse an identical irregular perimeter across layers so strata meet cleanly.
  const factors = Array.from({ length: sides }, () => .87 + rand() * .2);
  const phase = rand() * Math.PI;
  const layerVerts = profile.map(([t, radius]) => Array.from({ length: sides }, (_, j) => {
    const a = j / sides * Math.PI * 2 + phase;
    return [x + Math.cos(a) * width * radius * factors[j] + topX * t, .33 + height * t, z + Math.sin(a) * depth * radius * factors[j] + topZ * t];
  }));
  for (let k = 0; k < profile.length - 1; k++) {
    const pos = [];
    for (let j = 0; j < sides; j++) {
      const n = (j + 1) % sides;
      pos.push(...layerVerts[k][j], ...layerVerts[k + 1][j], ...layerVerts[k][n], ...layerVerts[k][n], ...layerVerts[k + 1][j], ...layerVerts[k + 1][n]);
    }
    if (k === profile.length - 2) for (let j = 1; j < sides - 1; j++) pos.push(...layerVerts[k + 1][0], ...layerVerts[k + 1][j + 1], ...layerVerts[k + 1][j]);
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geometry.computeVertexNormals();
    mesh(group, geometry, palette[k % palette.length]);
  }
}

function charyn() {
  const root = g(); base(root, 8.3, 6.0);
  const strata = [mat('Canyon deep ochre', '#a65636'), mat('Canyon red ochre', '#b86b42'), mat('Canyon sandstone', '#d2945b'), mat('Canyon pale layers', '#dea873'), mat('Canyon warm rust', '#c17949')];
  box(root, 8.13, .07, 5.82, strata[1], 0, .37, 0);
  // A winding pale walking path runs between the geological castle towers.
  const pathPoints = [[-.70, .424, 2.82], [-.94, .424, 2], [-.3, .424, 1.2], [.20, .424, .25], [-.08, .424, -.8], [.53, .424, -1.8], [.7, .424, -2.83]];
  const curve = new THREE.CatmullRomCurve3(pathPoints.map(p => new THREE.Vector3(...p)));
  const ribbon = [];
  for (let i = 0; i < 80; i++) {
    const t0 = i / 80, t1 = (i + 1) / 80, p0 = curve.getPoint(t0), p1 = curve.getPoint(t1);
    const dir = p1.clone().sub(p0).normalize(), perp = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(.22);
    ribbon.push(...p0.clone().add(perp).toArray(), ...p1.clone().add(perp).toArray(), ...p0.clone().sub(perp).toArray(), ...p0.clone().sub(perp).toArray(), ...p1.clone().add(perp).toArray(), ...p1.clone().sub(perp).toArray());
  }
  const pgeo = new THREE.BufferGeometry(); pgeo.setAttribute('position', new THREE.Float32BufferAttribute(ribbon, 3)); pgeo.computeVertexNormals(); mesh(root, pgeo, M.light);
  const towers = [
    [-2.91, -1.70, .77, .65, 2.90], [-2.07, -1.54, .65, .72, 3.83], [-1.22, -2.24, .58, .47, 2.97],
    [-3.12, -.31, .77, .76, 2.51], [-2.01, -.14, .68, .72, 3.11], [-2.92, 1.09, .8, .74, 2.18], [-2.08, 1.67, .63, .55, 2.81],
    [2.91, -1.79, .83, .67, 2.75], [1.78, -1.28, .74, .8, 3.46], [2.94, -.20, .83, .71, 3.73],
    [1.78, .45, .66, .76, 2.68], [2.91, 1.39, .82, .82, 3.14], [1.81, 1.94, .59, .46, 2.17]
  ];
  for (const [x, z, w, d, h] of towers) {
    layeredRock(root, x, z, w, d, h, strata, (rand() - .5) * .17, (rand() - .5) * .16, 9);
    if (h > 3) layeredRock(root, x + .12, z, w * .34, d * .37, h + .43, strata, 0, 0, 7);
  }
  for (let i = 0; i < 22; i++) {
    const x = (rand() > .5 ? 1 : -1) * (.68 + rand() * .65), z = (rand() - .5) * 4.9;
    irregularRock(root, [[0, .10 + rand() * .11, .13], [.16 + rand() * .13, .05, .05]], strata[i % strata.length], x, .42, z, 6);
  }
  shrub(root, .61, 1.50, .12, .42); shrub(root, -.8, -.83, .13, .42);
  return root;
}

function bozzhyra() {
  const root = g(); base(root, 8.3, 6.0);
  box(root, 8.13, .08, 5.83, M.chalkShade, 0, .37, 0);
  const palette = [M.chalkShade, M.chalk, M.chalkLight, M.chalk, M.chalkShade, M.chalkLight, M.chalk];
  // Broad chalk plateau behind the landmark's two isolated limestone fangs.
  layeredRock(root, -2.20, -1.45, 1.50, .96, 2.40, palette, -.10, -.07, 12);
  layeredRock(root, -.66, -1.95, 1.16, .73, 2.06, palette, 0, 0, 10);
  layeredRock(root, 1.40, -1.78, 1.12, .69, 1.80, palette, 0, 0, 10);
  // Layered scree skirts anchor the sharp white pinnacles to the desert floor.
  layeredRock(root, -.90, .71, 1.39, .95, 1.15, palette, .05, 0, 12);
  layeredRock(root, 1.23, .60, 1.13, .87, .94, palette, -.05, .04, 12);
  function fang(x, z, height, width, depth, lean) {
    const rings = [[0, width * 1.30, depth * 1.38], [height * .23, width, depth], [height * .47, width * .58, depth * .73, lean * .4], [height * .73, width * .45, depth * .59, lean * .7], [height * .91, width * .24, depth * .32, lean], [height, width * .02, depth * .025, lean * 1.08]];
    irregularRock(root, rings, M.chalkLight, x, .33, z, 8, .3);
    for (let i = 1; i < 7; i++) {
      const t = i / 8, yy = .33 + height * t, r = width * (1.1 - t * .84);
      // Thin weathered horizontal ledges make geological bedding visible.
      const ledge = cyl(root, r * .97, r, .024, i % 2 ? M.chalk : M.chalkShade, x + lean * t, yy, z, 8);
      ledge.scale.z = depth / width;
    }
  }
  fang(-.95, .60, 4.60, .66, .38, .22);
  fang(1.19, .45, 3.95, .62, .43, -.20);
  // Fine dry drainage lines across the otherwise empty chalk desert.
  const dry = mat('Desert drainage lines', '#b1a48d');
  line(root, [[-3.7, .425, 2.3], [-2.8, .425, 1.99], [-1.9, .425, 2.14], [-.6, .425, 1.82], [.8, .425, 1.96], [2.1, .425, 2.51], [3.8, .425, 2.62]], .032, dry);
  line(root, [[1.90, .427, .89], [2.37, .427, 1.28], [2.18, .427, 1.80], [2.1, .427, 2.5]], .024, dry);
  for (let i = 0; i < 20; i++) {
    const x = (rand() - .5) * 7.7, z = 1.6 + rand() * 1.07;
    irregularRock(root, [[0, .08 + rand() * .13, .10], [.09 + rand() * .08, .035, .034]], M.chalk, x, .42, z, 6);
  }
  return root;
}

function optimise(source, name) {
  source.updateMatrixWorld(true);
  const byMaterial = new Map();
  source.traverse(object => {
    if (!object.isMesh) return;
    let geometry = object.geometry.clone();
    if (geometry.index) geometry = geometry.toNonIndexed();
    geometry.applyMatrix4(object.matrixWorld);
    // All source geometries now share the same attributes for safe merging.
    for (const attribute of Object.keys(geometry.attributes)) if (!['position', 'normal'].includes(attribute)) geometry.deleteAttribute(attribute);
    if (!geometry.attributes.normal) geometry.computeVertexNormals();
    const entries = byMaterial.get(object.material) ?? []; entries.push(geometry); byMaterial.set(object.material, entries);
  });
  const result = g(); result.name = name;
  result.userData = { title: name, classification: 'Stylised educational reconstruction', creator: 'Qazaqstan virtual museum', modelVersion: 1 };
  for (const [material, geometries] of byMaterial) {
    const geometry = mergeVertices(mergeGeometries(geometries, false), 1e-5);
    const modelMesh = mesh(result, geometry, material); modelMesh.name = material.name;
    for (const geo of geometries) geo.dispose();
  }
  const bounds = new THREE.Box3().setFromObject(result);
  const centre = bounds.getCenter(new THREE.Vector3());
  for (const object of result.children) object.geometry.translate(-centre.x, -bounds.min.y, -centre.z);
  return result;
}

const outputDir = fileURLToPath(new URL('../public/models/', import.meta.url));
await fs.mkdir(outputDir, { recursive: true });
const factories = { 'yasawi': yasawi, 'aisha-bibi': aishaBibi, 'babadzha': babadzha, 'tamgaly': tamgaly, 'otrar': otrar, 'akyrtas': akyrtas, 'baiterek': baiterek, 'khan-shatyr': khanShatyr, 'charyn': charyn, 'bozzhyra': bozzhyra };
const manifest = [];
for (const [id, factory] of Object.entries(factories)) {
  seed = 7429 + id.split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  const scene = optimise(factory(), id);
  const glb = await new GLTFExporter().parseAsync(scene, { binary: true, onlyVisible: true, trs: false });
  const file = path.join(outputDir, `${id}.glb`);
  await fs.writeFile(file, Buffer.from(glb));
  const bounds = new THREE.Box3().setFromObject(scene), size = bounds.getSize(new THREE.Vector3());
  let triangles = 0; scene.traverse(m => { if (m.isMesh) triangles += (m.geometry.index?.count ?? m.geometry.attributes.position.count) / 3; });
  manifest.push({ id, file: `/models/${id}.glb`, bytes: glb.byteLength, triangles, materials: scene.children.length, size: size.toArray().map(n => Number(n.toFixed(3))) });
  console.log(`${id.padEnd(12)} ${String(Math.round(glb.byteLength / 1024)).padStart(5)} KiB | ${String(triangles).padStart(7)} triangles | ${scene.children.length} materials`);
}
await fs.writeFile(path.join(outputDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`Created ${manifest.length} self-contained 3D models in ${outputDir}`);
