import { deflateSync } from 'node:zlib';

const clamp = x => Math.max(0, Math.min(1, x));
const smooth = (x, a, b) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
const skin = rgb('#e9ab85'), blush = rgb('#df987d'), hair = rgb('#e1e1dd'), coat = rgb('#4d3028');
const shirt = rgb('#e6e3da'), pants = rgb('#25282b'), shoes = rgb('#13191d'), white = rgb('#f2eee6');
const blend = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** Paint in the sculpt's coordinates, then bake into its original UVs. No lighting is baked. */
export function paintEinsteinSurface(x, y, z) {
  const ax = Math.abs(x), front = smooth(z, .07, .13);
  if (y < 1.065) {
    let color = pants, roughness = .85;
    const hem = .450 + .017 * Math.exp(-((ax / .062) ** 2));
    const jacket = smooth(y, hem - .002, hem + .002);
    color = blend(color, coat, jacket); roughness += (.88 - roughness) * jacket;
    const shoe = 1 - smooth(y, .111, .122); color = blend(color, shoes, shoe); roughness += (.44 - roughness) * shoe;
    const opening = (1 - smooth(ax, .017 + .019 * (1 - smooth(y, .48, 1.03)), .023 + .020 * (1 - smooth(y, .48, 1.03)))) * front * jacket;
    color = blend(color, pants, opening);
    const collarWidth = .068 * smooth(y, .969, 1.052);
    const collar = (1 - smooth(ax, collarWidth - .0015, collarWidth + .0015)) * smooth(y, .973, .979) * front;
    color = blend(color, shirt, collar); return { color, roughness };
  }
  let color = skin.slice(), roughness = .61;
  const cheek = Math.exp(-(((ax - .215) / .072) ** 2) - ((y - 1.300) / .079) ** 2) * front * .19;
  color = blend(color, blush, cheek);
  const earDistance = ((ax - .355) / .080) ** 2 + ((y - 1.348) / .138) ** 2;
  const ear = (1 - smooth(earDistance, .91, 1.05)) * smooth(z, -.12, -.07);
  const hairline = 1.682 + .007 * Math.cos(x * 22) - .058 * (ax / .32) ** 4;
  let scalp = smooth(y, hairline - .0013, hairline + .0013);
  scalp = Math.max(scalp, (1 - smooth(z, .027, .050)) * smooth(y, 1.121, 1.142));
  const templeWidth = .304 - .012 * smooth(y, 1.40, 1.47) - .023 * smooth(y, 1.47, 1.62) - .060 * smooth(y, 1.62, 1.71);
  scalp = Math.max(scalp, smooth(ax, templeWidth - .002, templeWidth + .002) * smooth(y, 1.381, 1.405));
  scalp *= 1 - ear;
  color = blend(color, hair, scalp); roughness += (.73 - roughness) * scalp;

  // Isolate the raised brow itself, rather than painting a rectangle across the forehead.
  const browTop = 1.619 - .28 * Math.max(0, ax - .16) - 9 * Math.max(0, ax - .17) ** 2;
  const browBottom = 1.571 - .13 * (ax - .08) - 4 * Math.max(0, ax - .16) ** 2;
  const brow = smooth(y, browBottom - .001, browBottom + .001) * (1 - smooth(y, browTop - .001, browTop + .001))
    * smooth(ax, .073, .081) * (1 - smooth(ax, .237, .250)) * smooth(z, .273, .279);
  color = blend(color, hair, brow);

  const lobe = Math.min(((x - .070) / .101) ** 2 + ((y - 1.213) / .056) ** 2,
    ((x + .070) / .101) ** 2 + ((y - 1.213) / .056) ** 2);
  const moustache = (1 - smooth(lobe, .98, 1.045)) * smooth(z, .341, .353);
  color = blend(color, hair, moustache);
  const eye = Math.min(((x - .119) / .072) ** 2 + ((y - 1.429) / .063) ** 2,
    ((x + .119) / .072) ** 2 + ((y - 1.429) / .063) ** 2);
  const eyeWhite = (1 - smooth(eye, .96, 1.04)) * smooth(z, .20, .24);
  color = blend(color, white, eyeWhite); roughness += (.36 - roughness) * eyeWhite;
  return { color, roughness };
}

const crcTable = Array.from({ length: 256 }, (_, n) => { for (let k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1; return n >>> 0; });
const chunk = (type, bytes) => {
  const name = Buffer.from(type), data = Buffer.concat([name, bytes]); let crc = 0xffffffff;
  for (const byte of data) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
  const out = Buffer.alloc(bytes.length + 12); out.writeUInt32BE(bytes.length); name.copy(out, 4); bytes.copy(out, 8); out.writeUInt32BE((crc ^ 0xffffffff) >>> 0, bytes.length + 8); return out;
};
export function encodeRgbPng(pixels, width, height) {
  const header = Buffer.alloc(13); header.writeUInt32BE(width); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 2;
  const row = width * 3, raw = Buffer.alloc((row + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (row + 1)] = 2;
    for (let x = 0; x < row; x++) raw[y * (row + 1) + 1 + x] = (pixels[y * row + x] - (y ? pixels[(y - 1) * row + x] : 0) + 256) & 255;
  }
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', header), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

export function bakeEinsteinTexture(geometry, dimension = 2048) {
  const positions = geometry.attributes.position, uv = geometry.attributes.uv;
  if (!uv) throw new Error('The authored UV atlas is required');
  const albedo = new Uint8Array(dimension * dimension * 3), orm = new Uint8Array(albedo.length), coverage = new Uint8Array(dimension * dimension);
  for (let triangle = 0; triangle < positions.count; triangle += 3) {
    const ids = [triangle, triangle + 1, triangle + 2];
    // glTF samplers read image rows with flipY=false; bake in that convention directly.
    const u = ids.map(i => uv.getX(i) * dimension - .5), v = ids.map(i => uv.getY(i) * dimension - .5);
    const det = (v[1] - v[2]) * (u[0] - u[2]) + (u[2] - u[1]) * (v[0] - v[2]); if (Math.abs(det) < 1e-7) continue;
    const minX = Math.max(0, Math.ceil(Math.min(...u))), maxX = Math.min(dimension - 1, Math.floor(Math.max(...u)));
    const minY = Math.max(0, Math.ceil(Math.min(...v))), maxY = Math.min(dimension - 1, Math.floor(Math.max(...v)));
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
      const a = ((v[1] - v[2]) * (x - u[2]) + (u[2] - u[1]) * (y - v[2])) / det;
      const b = ((v[2] - v[0]) * (x - u[2]) + (u[0] - u[2]) * (y - v[2])) / det, c = 1 - a - b;
      if (a < -1e-6 || b < -1e-6 || c < -1e-6) continue;
      const px = positions.getX(ids[0]) * a + positions.getX(ids[1]) * b + positions.getX(ids[2]) * c;
      const py = positions.getY(ids[0]) * a + positions.getY(ids[1]) * b + positions.getY(ids[2]) * c;
      const pz = positions.getZ(ids[0]) * a + positions.getZ(ids[1]) * b + positions.getZ(ids[2]) * c;
      const painted = paintEinsteinSurface(px, py, pz), pixel = y * dimension + x, at = pixel * 3;
      coverage[pixel] = 1; albedo[at] = painted.color[0]; albedo[at + 1] = painted.color[1]; albedo[at + 2] = painted.color[2];
      orm[at] = 255; orm[at + 1] = Math.round(painted.roughness * 255); orm[at + 2] = 0;
    }
  }
  const coveredPixels = coverage.reduce((n, filled) => n + (filled ? 1 : 0), 0);
  // Extend every UV island into its gutter so bilinear sampling / mipmaps do not create seams.
  for (let pass = 0; pass < 5; pass++) {
    const next = coverage.slice();
    for (let y = 1; y < dimension - 1; y++) for (let x = 1; x < dimension - 1; x++) {
      const at = y * dimension + x; if (coverage[at]) continue;
      const source = [at - 1, at + 1, at - dimension, at + dimension].find(i => coverage[i]); if (source === undefined) continue;
      for (let c = 0; c < 3; c++) { albedo[at * 3 + c] = albedo[source * 3 + c]; orm[at * 3 + c] = orm[source * 3 + c]; } next[at] = 1;
    }
    coverage.set(next);
  }
  return { albedo: encodeRgbPng(albedo, dimension, dimension), orm: encodeRgbPng(orm, dimension, dimension), dimension, coveredPixels };
}
