import * as THREE from 'three';
import { Brush, Evaluator, SUBTRACTION } from 'three-bvh-csg';
import { PencilTopperConfig, Model3DDimensions } from '../types';
import { extractContoursFromImageData, buildThreeShapes } from './contourExtractor';

export interface GeneratedPencilTopper {
  baseMesh: THREE.Mesh;
  reliefMesh: THREE.Mesh;
  guideGroup: THREE.Group;
  dimensions: Model3DDimensions;
}

/**
 * Procedural generation of 3D Pencil/Pen Topper (Ponteira de Lápis e Caneta)
 * Baseado no modelo real MakerWorld / Bambu Studio:
 * - O corpo da ponteira é o próprio nome em 3D com a silhueta das letras (2 cores).
 * - Base escura espessa que se apoia plana na mesa de impressão.
 * - Furo cilíndrico passante perfurado horizontalmente pelo corpo do nome (CSG Boolean Subtraction).
 * - Letras em relevo amarelo/dourado na face superior (+Z no fatiador / +Y no 3D).
 */
export async function generatePencilTopperModel(
  config: PencilTopperConfig
): Promise<GeneratedPencilTopper> {
  const text = config.text.trim() || 'Helena';
  const effectiveDiameter = Math.max(4.0, config.pencilDiameter + config.clearance);
  const pxPerMm = 8;
  const targetFontHeightPx = Math.max(10, config.letterHeight) * pxPerMm;

  // Carrega / aguarda fonte Google Fonts se disponível
  try {
    if (typeof document !== 'undefined' && document.fonts) {
      await document.fonts.load(`${targetFontHeightPx}px "${config.fontFamily}"`);
      await document.fonts.load(`bold ${targetFontHeightPx}px "${config.fontFamily}"`);
    }
  } catch {
    // Segue com fallback
  }

  // Medição do texto
  const measureCanvas = document.createElement('canvas');
  const mctx = measureCanvas.getContext('2d');
  if (!mctx) throw new Error('Falha ao inicializar Canvas 2D');

  const isCursiveOrDisplay = ['Pacifico', 'Lobster', 'Dancing Script', 'Chewy', 'Bangers'].includes(config.fontFamily);
  const fontWeight = isCursiveOrDisplay ? 'normal' : 'bold';
  const fontStyle = `${fontWeight} ${targetFontHeightPx}px "${config.fontFamily}", sans-serif`;
  mctx.font = fontStyle;

  // Espaçamento entre letras com valor padrão seguro para evitar que fiquem coladas
  const letterSpacingMm = Math.max(0.0, config.letterSpacing ?? 1.8);
  const letterSpacingPx = letterSpacingMm * pxPerMm;
  let textWidthPx = 0;
  const charOffsets: number[] = [];

  for (let i = 0; i < text.length; i++) {
    charOffsets.push(textWidthPx);
    const w = mctx.measureText(text[i]).width;
    textWidthPx += w + letterSpacingPx;
  }
  if (text.length > 0) {
    textWidthPx -= letterSpacingPx;
  }

  const textHeightPx = targetFontHeightPx;
  const outlinePx = Math.max(1.5, config.outlineSize) * pxPerMm;

  const innerRadiusMm = effectiveDiameter / 2;
  const socketOuterRadiusMm = innerRadiusMm + Math.max(1.5, config.baseWallThickness);
  const socketOuterRadiusPx = socketOuterRadiusMm * pxPerMm;

  // Altura total da base para abrigar o furo cilíndrico com folga e paredes seguras
  const baseHeightMm = Math.max(config.socketHeight || 12.5, socketOuterRadiusMm * 2);

  // Símbolo lateral opcional
  const hasSymbol = config.symbolId && config.symbolId !== 'none';
  const symbolSizePx = targetFontHeightPx * 0.85;
  const symbolGapPx = symbolSizePx * 0.35;

  let totalContentWidthPx = textWidthPx;
  if (hasSymbol) {
    totalContentWidthPx += symbolGapPx + symbolSizePx;
  }

  // Canvas 2D com margens seguras
  const paddingPx = Math.ceil(Math.max(outlinePx * 2.5, socketOuterRadiusPx * 2) + 28);
  const canvasWidth = Math.ceil(totalContentWidthPx + paddingPx * 2);
  const canvasHeight = Math.ceil(Math.max(textHeightPx, socketOuterRadiusPx * 2) + paddingPx * 2);

  const drawCanvas = document.createElement('canvas');
  drawCanvas.width = canvasWidth;
  drawCanvas.height = canvasHeight;
  const ctx = drawCanvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Erro ao inicializar contexto 2D');

  const centerX = canvasWidth / 2;
  const centerY = canvasHeight / 2;
  const textStartXPx = centerX - totalContentWidthPx / 2;
  const textBaselineY = centerY + textHeightPx * 0.32;
  const symbolX = textStartXPx + textWidthPx + symbolGapPx + symbolSizePx / 2;
  const tunnelCenterYPx = textBaselineY - textHeightPx * 0.28;

  // Função para desenhar símbolos
  const drawPresetSymbol = (
    targetCtx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number
  ) => {
    targetCtx.save();
    targetCtx.translate(x, y);
    const s = size / 2;

    switch (config.symbolId) {
      case 'heart': {
        targetCtx.beginPath();
        targetCtx.moveTo(0, s * 0.3);
        targetCtx.bezierCurveTo(-s, -s * 0.6, -s * 1.1, s * 0.3, 0, s * 1.1);
        targetCtx.bezierCurveTo(s * 1.1, s * 0.3, s, -s * 0.6, 0, s * 0.3);
        targetCtx.closePath();
        targetCtx.fill();
        break;
      }
      case 'star': {
        targetCtx.beginPath();
        for (let i = 0; i < 10; i++) {
          const r = i % 2 === 0 ? s * 1.1 : s * 0.45;
          const angle = (i * Math.PI) / 5 - Math.PI / 2;
          const px = Math.cos(angle) * r;
          const py = Math.sin(angle) * r;
          if (i === 0) targetCtx.moveTo(px, py);
          else targetCtx.lineTo(px, py);
        }
        targetCtx.closePath();
        targetCtx.fill();
        break;
      }
      case 'crown': {
        targetCtx.beginPath();
        targetCtx.moveTo(-s * 0.9, s * 0.7);
        targetCtx.lineTo(-s * 0.9, -s * 0.3);
        targetCtx.lineTo(-s * 0.4, s * 0.1);
        targetCtx.lineTo(0, -s * 0.7);
        targetCtx.lineTo(s * 0.4, s * 0.1);
        targetCtx.lineTo(s * 0.9, -s * 0.3);
        targetCtx.lineTo(s * 0.9, s * 0.7);
        targetCtx.closePath();
        targetCtx.fill();
        break;
      }
      case 'flower': {
        targetCtx.beginPath();
        for (let i = 0; i < 5; i++) {
          const angle = (i * 2 * Math.PI) / 5;
          const px = Math.cos(angle) * s * 0.55;
          const py = Math.sin(angle) * s * 0.55;
          targetCtx.arc(px, py, s * 0.45, 0, Math.PI * 2);
        }
        targetCtx.arc(0, 0, s * 0.35, 0, Math.PI * 2);
        targetCtx.fill();
        break;
      }
      case 'butterfly': {
        targetCtx.beginPath();
        targetCtx.ellipse(-s * 0.5, -s * 0.4, s * 0.45, s * 0.65, -0.4, 0, Math.PI * 2);
        targetCtx.ellipse(s * 0.5, -s * 0.4, s * 0.45, s * 0.65, 0.4, 0, Math.PI * 2);
        targetCtx.ellipse(-s * 0.4, s * 0.4, s * 0.35, s * 0.45, 0.3, 0, Math.PI * 2);
        targetCtx.ellipse(s * 0.4, s * 0.4, s * 0.35, s * 0.45, -0.3, 0, Math.PI * 2);
        targetCtx.rect(-s * 0.1, -s * 0.7, s * 0.2, s * 1.4);
        targetCtx.fill();
        break;
      }
      case 'dino': {
        targetCtx.beginPath();
        targetCtx.arc(s * 0.3, -s * 0.5, s * 0.4, 0, Math.PI * 2);
        targetCtx.rect(-s * 0.5, -s * 0.2, s * 0.9, s * 0.8);
        targetCtx.rect(-s * 0.4, s * 0.5, s * 0.2, s * 0.4);
        targetCtx.rect(s * 0.1, s * 0.5, s * 0.2, s * 0.4);
        targetCtx.fill();
        break;
      }
      case 'gamepad': {
        targetCtx.beginPath();
        targetCtx.roundRect(-s * 0.9, -s * 0.4, s * 1.8, s * 0.8, s * 0.3);
        targetCtx.fill();
        break;
      }
      case 'ball': {
        targetCtx.beginPath();
        targetCtx.arc(0, 0, s * 0.85, 0, Math.PI * 2);
        targetCtx.fill();
        break;
      }
      case 'gradcap': {
        targetCtx.beginPath();
        targetCtx.moveTo(0, -s * 0.7);
        targetCtx.lineTo(s * 0.9, -s * 0.1);
        targetCtx.lineTo(0, s * 0.3);
        targetCtx.lineTo(-s * 0.9, -s * 0.1);
        targetCtx.closePath();
        targetCtx.fill();
        break;
      }
      default:
        break;
    }
    targetCtx.restore();
  };

  // 1. Gera contorno da Base (Silhueta do texto + canal estrutural contínuo)
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  ctx.fillStyle = '#000000';
  ctx.strokeStyle = '#000000';
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  const orientation = config.holeOrientation || 'horizontal';

  // Barra/cápsula estrutural que garante parede sólida ao redor do furo
  if (orientation === 'horizontal') {
    const capLeft = textStartXPx - outlinePx;
    const capRight = textStartXPx + totalContentWidthPx + outlinePx;
    const capWidth = capRight - capLeft;
    const capHeight = socketOuterRadiusPx * 2;
    const capY = tunnelCenterYPx - capHeight / 2;

    ctx.beginPath();
    ctx.roundRect(capLeft, capY, capWidth, capHeight, socketOuterRadiusPx);
    ctx.fill();
  } else if (orientation === 'vertical') {
    const textCenterX = textStartXPx + totalContentWidthPx / 2;
    const capTop = centerY - textHeightPx * 0.6;
    const capBottom = centerY + textHeightPx * 0.6;
    const capWidth = socketOuterRadiusPx * 2;
    const capHeight = capBottom - capTop;

    ctx.beginPath();
    ctx.roundRect(textCenterX - capWidth / 2, capTop, capWidth, capHeight, socketOuterRadiusPx);
    ctx.fill();
  } else {
    // 'through-center'
    const textCenterX = textStartXPx + totalContentWidthPx / 2;
    ctx.beginPath();
    ctx.arc(textCenterX, centerY, socketOuterRadiusPx, 0, Math.PI * 2);
    ctx.fill();
  }

  // Traço contínuo do texto e símbolo para criar os lóbulos característicos de cada letra
  ctx.lineWidth = outlinePx * 2;
  ctx.font = fontStyle;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';

  for (let i = 0; i < text.length; i++) {
    const cx = textStartXPx + charOffsets[i];
    ctx.strokeText(text[i], cx, textBaselineY);
    ctx.fillText(text[i], cx, textBaselineY);
  }

  if (hasSymbol) {
    drawPresetSymbol(ctx, symbolX, tunnelCenterYPx, symbolSizePx + outlinePx * 1.5);
  }

  const baseImgData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
  const mmPerPixel = 1 / pxPerMm;
  const baseContours = extractContoursFromImageData(baseImgData, mmPerPixel, canvasWidth / 2, canvasHeight / 2, 0.35);
  const baseShapes = buildThreeShapes(baseContours.outer, baseContours.holes);

  // 2. Gera o Relevo (Letras amarelas/douradas em relevo)
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  ctx.fillStyle = '#000000';
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1.0 * pxPerMm; // reforço de espessura para caligrafia conexa
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.font = fontStyle;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';

  for (let i = 0; i < text.length; i++) {
    const cx = textStartXPx + charOffsets[i];
    ctx.strokeText(text[i], cx, textBaselineY);
    ctx.fillText(text[i], cx, textBaselineY);
  }

  if (hasSymbol) {
    drawPresetSymbol(ctx, symbolX, tunnelCenterYPx, symbolSizePx);
  }

  const reliefImgData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
  const reliefContours = extractContoursFromImageData(reliefImgData, mmPerPixel, canvasWidth / 2, canvasHeight / 2, 0.3);
  const reliefShapes = buildThreeShapes(reliefContours.outer, reliefContours.holes);

  // Fallbacks de segurança
  const safeBaseShapes = baseShapes.length > 0 ? baseShapes : reliefShapes;
  const safeReliefShapes = reliefShapes.length > 0 ? reliefShapes : safeBaseShapes;

  // Extrusão da Base Sólida (Eixo Z no fatiador = altura da peça)
  const baseExtrudeGeom = new THREE.ExtrudeGeometry(safeBaseShapes, {
    depth: baseHeightMm,
    bevelEnabled: true,
    bevelThickness: 0.35,
    bevelSize: 0.25,
    bevelSegments: 2,
  });

  baseExtrudeGeom.computeBoundingBox();
  const bbBaseInit = baseExtrudeGeom.boundingBox || new THREE.Box3();
  const centerMmX = (bbBaseInit.min.x + bbBaseInit.max.x) / 2;
  // Ponto central do túnel em mm cartesianos
  const centerTunnelMmY = -(tunnelCenterYPx - canvasHeight / 2) * mmPerPixel;
  const totalLengthMm = bbBaseInit.max.x - bbBaseInit.min.x;
  const totalHeightMm = bbBaseInit.max.y - bbBaseInit.min.y;

  // 3. Subtração Booleana Real CSG do Furo Cilíndrico
  const holeRadius = innerRadiusMm;
  const holeSegs = config.holeShape === 'hexagonal' ? 6 : 32;

  let holeGeom: THREE.CylinderGeometry;
  if (orientation === 'horizontal') {
    // Furo longitudinal ao longo do eixo X (atravessa o comprimento do nome)
    const holeLength = totalLengthMm + 30;
    holeGeom = new THREE.CylinderGeometry(holeRadius, holeRadius, holeLength, holeSegs);
    holeGeom.rotateZ(Math.PI / 2); // alinha ao longo do eixo X
    holeGeom.translate(centerMmX, centerTunnelMmY, baseHeightMm / 2);
  } else if (orientation === 'vertical') {
    // Furo vertical ao longo do eixo Y
    const holeHeight = totalHeightMm + 30;
    holeGeom = new THREE.CylinderGeometry(holeRadius, holeRadius, holeHeight, holeSegs);
    holeGeom.translate(centerMmX, centerTunnelMmY, baseHeightMm / 2);
  } else {
    // 'through-center' furo perpendicular através da face Z
    const holeDepth = baseHeightMm + 20;
    holeGeom = new THREE.CylinderGeometry(holeRadius, holeRadius, holeDepth, holeSegs);
    holeGeom.rotateX(Math.PI / 2); // alinha ao longo do eixo Z
    holeGeom.translate(centerMmX, centerTunnelMmY, baseHeightMm / 2);
  }

  let finalBaseGeom: THREE.BufferGeometry;
  try {
    const baseBrush = new Brush(baseExtrudeGeom);
    const holeBrush = new Brush(holeGeom);
    baseBrush.updateMatrixWorld();
    holeBrush.updateMatrixWorld();

    const evaluator = new Evaluator();
    const csgResult = evaluator.evaluate(baseBrush, holeBrush, SUBTRACTION);
    finalBaseGeom = csgResult.geometry;
    finalBaseGeom.computeVertexNormals();
  } catch (csgErr) {
    console.warn('Fallback CSG:', csgErr);
    finalBaseGeom = baseExtrudeGeom;
  }

  // 4. Extrusão do Relevo (Letras Amarelas no Topo)
  const reliefGeom = new THREE.ExtrudeGeometry(safeReliefShapes, {
    depth: Math.max(0.8, config.reliefThickness),
    bevelEnabled: true,
    bevelThickness: 0.25,
    bevelSize: 0.2,
    bevelSegments: 2,
  });
  // Posiciona o relevo diretamente sobre a face superior da base
  reliefGeom.translate(0, 0, baseHeightMm);

  // 5. Centralização no plano XY (para que a peça fique perfeitamente centrada)
  finalBaseGeom.computeBoundingBox();
  const bbFinal = finalBaseGeom.boundingBox || new THREE.Box3();
  const midX = (bbFinal.min.x + bbFinal.max.x) / 2;
  const midY = (bbFinal.min.y + bbFinal.max.y) / 2;

  finalBaseGeom.translate(-midX, -midY, 0);
  reliefGeom.translate(-midX, -midY, 0);

  // Calcula Dimensões Físicas exatas para fatiador
  finalBaseGeom.computeBoundingBox();
  reliefGeom.computeBoundingBox();

  const finalBbBase = finalBaseGeom.boundingBox || new THREE.Box3();
  const finalBbRelief = reliefGeom.boundingBox || new THREE.Box3();
  const totalBox = finalBbBase.clone().union(finalBbRelief);

  const size = new THREE.Vector3();
  totalBox.getSize(size);

  const dimX = Number(size.x.toFixed(1));
  const dimY = Number(size.y.toFixed(1));
  const dimZ = Number(size.z.toFixed(1));

  // Estimativa de Volume e Peso PLA
  const estimatedVolCm3 = Number(
    (
      (dimX * dimY * 0.45 * baseHeightMm -
        Math.PI * Math.pow(innerRadiusMm, 2) * dimX +
        dimX * dimY * 0.25 * config.reliefThickness) /
      1000
    ).toFixed(1)
  );
  const safeVol = Math.max(2.0, estimatedVolCm3);
  const weightGrams = Number((safeVol * 1.24).toFixed(1));
  const printTimeMinutes = Math.max(12, Math.round(weightGrams * 2.8 + 8));

  const dimensions: Model3DDimensions = {
    dimX,
    dimY,
    dimZ,
    volumeCm3: safeVol,
    weightGrams,
    printTimeMinutes,
  };

  // Materiais PBR realistas idênticos ao fatiador (Bambu Studio)
  const baseMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(config.baseColor),
    roughness: 0.35,
    metalness: 0.08,
  });

  const reliefMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(config.reliefColor),
    roughness: 0.28,
    metalness: 0.12,
  });

  const baseMesh = new THREE.Mesh(finalBaseGeom, baseMaterial);
  baseMesh.name = '1_Corpo_da_Base';
  baseMesh.castShadow = true;
  baseMesh.receiveShadow = true;

  const reliefMesh = new THREE.Mesh(reliefGeom, reliefMaterial);
  reliefMesh.name = '2_Letras_em_Relevo';
  reliefMesh.castShadow = true;
  reliefMesh.receiveShadow = true;

  // Grupo guia vazio ("não precisa fazer o lápis")
  const guideGroup = new THREE.Group();
  guideGroup.name = 'Guia_Vazia';

  return {
    baseMesh,
    reliefMesh,
    guideGroup,
    dimensions,
  };
}
