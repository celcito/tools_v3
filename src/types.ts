export interface FontOption {
  id: string;
  name: string;
  category: 'bold' | 'geom' | 'fun' | 'condensed' | 'script' | 'classic';
  description: string;
  isSystem?: boolean;
}

export interface ColorPalettePreset {
  id: string;
  name: string;
  backColor: string;
  midColor: string;
  frontColor: string;
}

export interface LetterBoxConfig {
  // Parâmetros Principais
  text: string;
  fontFamily: string;
  letterHeight: number; // mm (default: 50 mm)
  backDepth: number; // mm (Profundidade da Caixa Eixo Z, default: 20 mm)

  // Ajustes Finos & Espaçamento
  letterSpacing: number; // mm (default: 1 mm)
  backContour: number; // mm (Contorno Traseiro / Borda Externa, default: 9.5 mm)
  midContour: number; // mm (Contorno Intermediário, default: 4 mm)
  frontThickness: number; // mm (Espessura Frontal, default: 2.4 mm)
  midThickness: number; // mm (Espessura Média, default: 3.4 mm)

  // Base de Apoio (Ficar em Pé)
  flatBase: boolean; // Ativar Base Reta de Apoio
  baseExtraHeight: number; // mm extensão da base para apoio firme
  wallMountHole: boolean; // Furo gota/fechadura traseiro para fixar na parede

  // Cores das 3 Camadas
  backColor: string; // 1. Camada Traseira (Caixa) ex: #7d449c
  midColor: string; // 2. Camada Intermediária ex: #72406e
  frontColor: string; // 3. Texto Frontal ex: #FFFFFF

  // Visualização e Controles Extras
  explodedProgress: number; // 0 a 100% de separação das camadas
  showDimensionsOverlay: boolean;
  environmentMode: 'plate' | 'desk' | 'minimal';
  bevelFront: boolean;
  bevelSize: number; // mm

  // Fonte customizada (upload)
  customFontUrl?: string;
  customFontName?: string;
  customFontBase64?: string;
}

export type AppMode = 'letra-caixa' | 'ponteira-lapis';

export type PencilModelId = 'bic-cristal' | 'lapis-redondo' | 'lapis-hexagonal' | 'personalizado';

export type HoleShape = 'round' | 'hexagonal';

export interface PencilModelOption {
  id: PencilModelId;
  name: string;
  emoji: string;
  defaultDiameter: number;
  description: string;
  defaultHoleShape: HoleShape;
}

export interface PencilColorPalette {
  id: string;
  name: string;
  baseColor: string;
  reliefColor: string;
}

export interface PencilTopperConfig {
  // Modelo & Encaixe
  pencilModel: PencilModelId;
  pencilDiameter: number; // mm (5.0 a 15.0 mm, default: 8.3 mm)
  clearance: number; // mm folga de encaixe (0.0 a 1.5 mm, default: 0 mm)
  holeShape: HoleShape; // 'round' | 'hexagonal'
  holeOrientation: 'horizontal' | 'vertical' | 'through-center';
  socketHeight: number; // mm altura do tubo de encaixe (ex: 12.3 mm)

  // Texto & Tipografia
  text: string; // ex: 'Helena'
  fontFamily: string; // ex: 'Anton'
  letterHeight: number; // mm Tamanho da Letra (default: 15 mm)
  letterSpacing: number; // mm Espaçamento entre Letras (default: 0.5 mm)

  // Ícone Lateral / Símbolo
  symbolId: string; // 'none' | 'heart' | 'star' | 'crown' | etc.
  symbolPosition: 'left' | 'right' | 'both';
  customSvgData?: string;
  customIconUrl?: string;

  // Base & Espessura
  outlineSize: number; // mm Borda / Contorno da Base (default: 2.5 mm)
  baseWallThickness: number; // mm Espessura da Parede da Base (default: 2.0 mm)
  reliefThickness: number; // mm Espessura das Letras em Relevo (default: 2.0 mm)

  // Cores (2 Cores)
  baseColor: string; // 1. Corpo da Base (default: #111827)
  reliefColor: string; // 2. Letras em Relevo (default: #FBBF24)

  // Visualização e Prévia
  showPencilGuide: boolean; // Renderiza o corpo do lápis/caneta no 3D
  showDimensionsOverlay: boolean;
  environmentMode: 'plate' | 'desk' | 'minimal';
}

export interface Model3DDimensions {
  dimX: number; // mm largura total
  dimY: number; // mm altura total
  dimZ: number; // mm profundidade total
  volumeCm3: number;
  weightGrams: number;
  printTimeMinutes: number;
}

