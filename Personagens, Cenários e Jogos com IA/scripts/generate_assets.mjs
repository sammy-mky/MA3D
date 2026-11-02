import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

// Diretório de destino
const outDir = path.resolve('public/assets');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// Gerador simples e puro de PNG usando buffers nativos do Node e zlib
function createPNG(width, height, getPixel) {
  // Cabeçalho PNG
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // color type: RGBA
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace
  const ihdrChunk = makeChunk('IHDR', ihdrData);

  // Scanlines com filtro 0 (None)
  const rawScanlineLen = 1 + width * 4;
  const rawData = Buffer.alloc(height * rawScanlineLen);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rawScanlineLen;
    rawData[rowOffset] = 0; // Filter byte: 0
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = getPixel(x, y);
      const pxOffset = rowOffset + 1 + x * 4;
      rawData[pxOffset] = Math.max(0, Math.min(255, Math.floor(r)));
      rawData[pxOffset + 1] = Math.max(0, Math.min(255, Math.floor(g)));
      rawData[pxOffset + 2] = Math.max(0, Math.min(255, Math.floor(b)));
      rawData[pxOffset + 3] = Math.max(0, Math.min(255, Math.floor(a)));
    }
  }

  const compressed = zlib.deflateSync(rawData);
  const idatChunk = makeChunk('IDAT', compressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// Função para calcular CRC32 de chunks PNG
function crc32(buf) {
  let table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  let c = 0 ^ (-1);
  for (let i = 0; i < buf.length; i++) {
    c = (c >>> 8) ^ table[(c ^ buf[i]) & 0xFF];
  }
  return (c ^ (-1)) >>> 0;
}

function makeChunk(typeStr, dataBuf) {
  const typeBuf = Buffer.from(typeStr, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(dataBuf.length, 0);
  const toHash = Buffer.concat([typeBuf, dataBuf]);
  const crc = crc32(toHash);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc, 0);
  return Buffer.concat([lenBuf, typeBuf, dataBuf, crcBuf]);
}

// 1. bones_idle.png (32x48)
const bonesIdlePNG = createPNG(32, 48, (x, y) => {
  // Cores: osso (#e6e4dc), sombra (#949188), capa roxa (#4c1d95), olho verde brilhante (#22c55e)
  // Cabeça / Crânio (x: 10..22, y: 4..16)
  const inHead = (x >= 10 && x <= 21 && y >= 4 && y <= 16);
  if (inHead) {
    if ((x === 13 || x === 14) && (y === 8 || y === 9)) return [34, 197, 94, 255]; // olho verde esquerdo
    if ((x === 17 || x === 18) && (y === 8 || y === 9)) return [34, 197, 94, 255]; // olho verde direito
    if (x >= 15 && x <= 16 && y === 12) return [40, 20, 60, 255]; // cavidade nasal
    if (y >= 14 && y <= 16 && (x === 12 || x === 14 || x === 17 || x === 19)) return [60, 50, 70, 255]; // dentes
    return [230, 228, 220, 255]; // osso
  }
  // Coluna e costelas (y: 17..28)
  if (y >= 17 && y <= 28) {
    if (x >= 14 && x <= 17) return [235, 233, 225, 255]; // espinha
    if (y % 3 !== 0 && ((x >= 11 && x <= 13) || (x >= 18 && x <= 20))) return [215, 212, 200, 255]; // costelas
    // Capa roxa nas costas
    if (x >= 8 && x <= 10 && y >= 18 && y <= 29) return [76, 29, 149, 230];
    if (x >= 21 && x <= 23 && y >= 18 && y <= 29) return [76, 29, 149, 230];
  }
  // Braços (y: 18..30)
  if (y >= 18 && y <= 30) {
    if ((x >= 8 && x <= 10) && y <= 27) return [230, 228, 220, 255];
    if ((x >= 21 && x <= 23) && y <= 27) return [230, 228, 220, 255];
  }
  // Bacia (y: 29..32, x: 12..19)
  if (y >= 29 && y <= 32 && x >= 12 && x <= 19) {
    return [230, 228, 220, 255];
  }
  // Pernas (y: 33..46)
  if (y >= 33 && y <= 45) {
    if (x >= 12 && x <= 14) return [215, 212, 200, 255]; // perna esq
    if (x >= 17 && x <= 19) return [215, 212, 200, 255]; // perna dir
  }
  // Pés (y: 45..47)
  if (y >= 45 && y <= 47) {
    if (x >= 10 && x <= 14) return [235, 233, 225, 255];
    if (x >= 17 && x <= 21) return [235, 233, 225, 255];
  }
  return [0, 0, 0, 0];
});
fs.writeFileSync(path.join(outDir, 'bones_idle.png'), bonesIdlePNG);

// 2. bones_walk.png (128x48, 4 quadros de 32x48)
const bonesWalkPNG = createPNG(128, 48, (x, y) => {
  const frame = Math.floor(x / 32);
  const fx = x % 32;
  const legShift = [0, 3, 0, -3][frame];
  const armShift = [0, -2, 0, 2][frame];

  // Crânio
  if (fx >= 10 && fx <= 21 && y >= 4 && y <= 16) {
    if ((fx === 13 || fx === 14) && (y === 8 || y === 9)) return [34, 197, 94, 255];
    if ((fx === 17 || fx === 18) && (y === 8 || y === 9)) return [34, 197, 94, 255];
    if (fx >= 15 && fx <= 16 && y === 12) return [40, 20, 60, 255];
    return [230, 228, 220, 255];
  }
  // Tronco
  if (y >= 17 && y <= 28) {
    if (fx >= 14 && fx <= 17) return [235, 233, 225, 255];
    if (y % 3 !== 0 && ((fx >= 11 && fx <= 13) || (fx >= 18 && fx <= 20))) return [215, 212, 200, 255];
    if (fx >= 8 && fx <= 10) return [76, 29, 149, 230];
    if (fx >= 21 && fx <= 23) return [76, 29, 149, 230];
  }
  // Braços animados
  if (y >= 18 && y <= 28) {
    const armX1 = 8 - armShift;
    const armX2 = 22 + armShift;
    if (fx >= armX1 && fx <= armX1 + 2) return [230, 228, 220, 255];
    if (fx >= armX2 && fx <= armX2 + 2) return [230, 228, 220, 255];
  }
  // Bacia
  if (y >= 29 && y <= 32 && fx >= 12 && fx <= 19) return [230, 228, 220, 255];
  // Pernas animadas
  if (y >= 33 && y <= 45) {
    const lx1 = 12 + legShift;
    const lx2 = 17 - legShift;
    if (fx >= lx1 && fx <= lx1 + 2) return [215, 212, 200, 255];
    if (fx >= lx2 && fx <= lx2 + 2) return [215, 212, 200, 255];
  }
  // Pés
  if (y >= 45 && y <= 47) {
    const lx1 = 11 + legShift;
    const lx2 = 16 - legShift;
    if (fx >= lx1 - 1 && fx <= lx1 + 3) return [235, 233, 225, 255];
    if (fx >= lx2 - 1 && fx <= lx2 + 3) return [235, 233, 225, 255];
  }
  return [0, 0, 0, 0];
});
fs.writeFileSync(path.join(outDir, 'bones_walk.png'), bonesWalkPNG);

// 3. bones_jump.png (32x48)
const bonesJumpPNG = createPNG(32, 48, (x, y) => {
  // Salto: pernas encolhidas, capa levantada, braços para cima
  if (x >= 10 && x <= 21 && y >= 3 && y <= 15) {
    if ((x === 13 || x === 14) && (y === 7 || y === 8)) return [34, 197, 94, 255]; // olhos verdes
    if ((x === 17 || x === 18) && (y === 7 || y === 8)) return [34, 197, 94, 255];
    return [230, 228, 220, 255];
  }
  // Capa esvoaçante
  if (y >= 16 && y <= 36 && ((x >= 5 && x <= 9) || (x >= 22 && x <= 26))) {
    return [88, 28, 135, 240];
  }
  // Braços erguidos
  if (y >= 10 && y <= 22) {
    if (x >= 6 && x <= 8) return [230, 228, 220, 255];
    if (x >= 23 && x <= 25) return [230, 228, 220, 255];
  }
  // Tronco
  if (y >= 16 && y <= 27 && x >= 12 && x <= 19) return [225, 222, 210, 255];
  // Pernas flexionadas
  if (y >= 28 && y <= 38) {
    if (x >= 9 && x <= 13) return [230, 228, 220, 255];
    if (x >= 18 && x <= 22) return [230, 228, 220, 255];
  }
  return [0, 0, 0, 0];
});
fs.writeFileSync(path.join(outDir, 'bones_jump.png'), bonesJumpPNG);

// 4. enemy.png (36x40) - Fantasma roxo espectral patrulheiro
const enemyPNG = createPNG(36, 40, (x, y) => {
  const dx = x - 18;
  const dy = y - 18;
  const dist = Math.sqrt(dx * dx + dy * dy);
  // Corpo arredondado do fantasma com cauda ondulada
  if (y <= 24 && dist <= 14) {
    // Olhos
    if ((x >= 12 && x <= 15 && y >= 13 && y <= 16) || (x >= 21 && x <= 24 && y >= 13 && y <= 16)) {
      return [255, 255, 255, 255]; // olho branco
    }
    if ((x === 14 && y === 15) || (x === 23 && y === 15)) {
      return [20, 10, 40, 255]; // pupila
    }
    return [168, 85, 247, 240]; // roxo espectral brilhante
  }
  // Cauda e tentáculos fantasmagóricos
  if (y > 24 && y <= 38 && x >= 6 && x <= 30) {
    const wave = Math.sin((x + y * 0.5) * 0.6);
    if (wave > -0.2) {
      return [147, 51, 234, 220];
    }
  }
  // Brilho exterior leve
  if (dist <= 17 && dist > 14 && y <= 25) {
    return [192, 132, 252, 100];
  }
  return [0, 0, 0, 0];
});
fs.writeFileSync(path.join(outDir, 'enemy.png'), enemyPNG);

// 5. bone.png (28x28) - Osso colecionável brilhante
const bonePNG = createPNG(28, 28, (x, y) => {
  // Osso deitado ou levemente inclinado com articulações duplas
  const inShaft = (y >= 11 && y <= 16 && x >= 6 && x <= 21);
  const inJointL1 = Math.hypot(x - 6, y - 9) <= 4;
  const inJointL2 = Math.hypot(x - 6, y - 18) <= 4;
  const inJointR1 = Math.hypot(x - 21, y - 9) <= 4;
  const inJointR2 = Math.hypot(x - 21, y - 18) <= 4;

  if (inShaft || inJointL1 || inJointL2 || inJointR1 || inJointR2) {
    // Brilho central
    if (y === 12 || y === 13) return [255, 255, 255, 255];
    return [245, 245, 240, 255]; // marfim claro
  }
  // Aura esmeralda/verde mágica sutil em volta
  const distShaft = Math.min(
    Math.hypot(x - 6, y - 13.5),
    Math.hypot(x - 21, y - 13.5),
    Math.abs(y - 13.5)
  );
  if (distShaft <= 6 && x >= 3 && x <= 24) {
    return [34, 197, 94, 80]; // aura verde
  }
  return [0, 0, 0, 0];
});
fs.writeFileSync(path.join(outDir, 'bone.png'), bonePNG);

// 6. bg_sky.png (600x400) - Céu noturno com gradiente, estrelas e grande lua cheia
const bgSkyPNG = createPNG(600, 400, (x, y) => {
  // Gradiente vertical de preto arroxeado a roxo profundo
  const t = y / 400;
  const r = Math.floor(12 + t * 24);
  const g = Math.floor(6 + t * 15);
  const b = Math.floor(30 + t * 45);

  // Lua Cheia no céu (x: 480, y: 100, raio: 46)
  const dMoon = Math.hypot(x - 480, y - 100);
  if (dMoon <= 46) {
    // Crateras sutis
    if (Math.hypot(x - 470, y - 90) < 10 || Math.hypot(x - 495, y - 110) < 12) {
      return [220, 225, 215, 255];
    }
    return [250, 252, 245, 255];
  }
  // Brilho da lua
  if (dMoon <= 80) {
    const alpha = (1 - (dMoon - 46) / 34) * 0.4;
    return [
      Math.floor(r * (1 - alpha) + 220 * alpha),
      Math.floor(g * (1 - alpha) + 230 * alpha),
      Math.floor(b * (1 - alpha) + 255 * alpha),
      255
    ];
  }

  // Estrelas pseudo-aleatórias
  const seed = (x * 374761393 + y * 668265263) >>> 0;
  if ((seed % 420) === 0 && y < 280) {
    return [255, 255, 240, 255];
  }
  if ((seed % 890) === 0 && y < 240) {
    return [34, 197, 94, 200]; // estrela verde fantasmagórica
  }

  return [r, g, b, 255];
});
fs.writeFileSync(path.join(outDir, 'bg_sky.png'), bgSkyPNG);

// 7. bg_trees.png (600x400) - Camada de silhuetas de árvores sombrias do cemitério
const bgTreesPNG = createPNG(600, 400, (x, y) => {
  // Fundo transparente com árvores góticas escuras
  let inTree = false;
  // Três troncos principais repetidos
  const treePositions = [80, 240, 420, 560];
  for (const tx of treePositions) {
    const dx = Math.abs(x - tx);
    // Tronco
    if (y >= 180 && dx <= (y - 140) * 0.08) inTree = true;
    // Galhos retorcidos
    const branch1 = Math.abs((y - 200) - (x - tx) * 0.8) < 6 && y > 150 && x > tx && x < tx + 70;
    const branch2 = Math.abs((y - 220) + (x - tx) * 0.7) < 6 && y > 160 && x < tx && x > tx - 60;
    const branch3 = Math.abs((y - 280) - (x - tx) * 0.6) < 8 && y > 220 && x > tx && x < tx + 80;
    if (branch1 || branch2 || branch3) inTree = true;
    // Copa esparsa
    if (Math.hypot(x - tx, y - 150) < 38) inTree = true;
  }
  if (inTree) {
    return [24, 12, 38, 220]; // silhueta roxo-escura
  }
  return [0, 0, 0, 0];
});
fs.writeFileSync(path.join(outDir, 'bg_trees.png'), bgTreesPNG);

// 8. bg_graves.png (600x400) - Camada de lápides, cruzes e mausoléus
const bgGravesPNG = createPNG(600, 400, (x, y) => {
  // Lápides no chão (y >= 260)
  const graveSpacings = [50, 110, 190, 270, 340, 430, 510, 580];
  let inGrave = false;
  for (let i = 0; i < graveSpacings.length; i++) {
    const gx = graveSpacings[i];
    const type = i % 3; // 0: cruz, 1: lápide redonda, 2: obelisco
    if (type === 0) {
      // Cruz gótica
      if (Math.abs(x - gx) <= 4 && y >= 250 && y <= 340) inGrave = true;
      if (Math.abs(y - 280) <= 4 && Math.abs(x - gx) <= 16) inGrave = true;
    } else if (type === 1) {
      // Lápide arredondada
      if (Math.abs(x - gx) <= 14 && y >= 265 && y <= 340) inGrave = true;
      if (Math.hypot(x - gx, y - 265) <= 14 && y <= 265) inGrave = true;
    } else {
      // Obelisco
      const halfW = Math.max(3, (340 - y) * 0.12);
      if (Math.abs(x - gx) <= halfW && y >= 240 && y <= 340) inGrave = true;
    }
  }
  // Colina de chão suave
  if (y >= 330) {
    const hillY = 330 + Math.sin(x * 0.02) * 8;
    if (y >= hillY) inGrave = true;
  }

  if (inGrave) {
    return [40, 20, 60, 235]; // roxo escuro de primeiro plano de parallax
  }
  return [0, 0, 0, 0];
});
fs.writeFileSync(path.join(outDir, 'bg_graves.png'), bgGravesPNG);

// 9. tile_ground.png (64x64) - Bloco de chão repetível com grama escura e pedras
const tileGroundPNG = createPNG(64, 64, (x, y) => {
  // Topo (0..10): grama de cemitério verde musgo (#1e4620 e #22c55e)
  if (y < 8) {
    const blade = ((x * 7 + y * 3) % 5 === 0);
    if (blade) return [34, 197, 94, 255]; // verde brilhante
    return [26, 54, 30, 255]; // verde musgo escuro
  }
  if (y < 14) {
    return [45, 30, 55, 255]; // transição para terra/pedra
  }
  // Corpo de pedra/lajes (14..64)
  const isMortar = (x % 32 === 0 || y % 20 === 0);
  if (isMortar) {
    return [28, 18, 36, 255]; // fresta escura entre pedras
  }
  // Superfície da pedra com ruído sutil
  const noise = ((x * 13 + y * 29) % 17) - 8;
  const baseR = 55 + noise;
  const baseG = 45 + noise;
  const baseB = 70 + noise;
  return [baseR, baseG, baseB, 255];
});
fs.writeFileSync(path.join(outDir, 'tile_ground.png'), tileGroundPNG);

console.log('Todos os 9 assets foram gerados com sucesso em /public/assets!');
