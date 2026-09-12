import { LetterBoxConfig, PencilTopperConfig } from '../types';
import { DEFAULT_CONFIG } from '../data/fontsAndPresets';
import { DEFAULT_PENCIL_CONFIG } from '../data/pencilTopperPresets';

export const CONFIG_STORAGE_KEY = 'letra_caixa_3d_config_v1';
export const PENCIL_STORAGE_KEY = 'ponteira_lapis_3d_config_v1';

export function loadSavedPencilConfig(): PencilTopperConfig {
  if (typeof window === 'undefined') {
    return DEFAULT_PENCIL_CONFIG;
  }

  try {
    const raw = window.localStorage.getItem(PENCIL_STORAGE_KEY);
    if (!raw) return DEFAULT_PENCIL_CONFIG;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return DEFAULT_PENCIL_CONFIG;

    return {
      ...DEFAULT_PENCIL_CONFIG,
      ...parsed,
      text: typeof parsed.text === 'string' ? parsed.text : DEFAULT_PENCIL_CONFIG.text,
      pencilModel: parsed.pencilModel || DEFAULT_PENCIL_CONFIG.pencilModel,
      pencilDiameter: typeof parsed.pencilDiameter === 'number' ? parsed.pencilDiameter : DEFAULT_PENCIL_CONFIG.pencilDiameter,
      clearance: typeof parsed.clearance === 'number' ? parsed.clearance : DEFAULT_PENCIL_CONFIG.clearance,
      letterSpacing: typeof parsed.letterSpacing === 'number' && parsed.letterSpacing >= 0.5 ? parsed.letterSpacing : DEFAULT_PENCIL_CONFIG.letterSpacing,
      holeShape: parsed.holeShape || DEFAULT_PENCIL_CONFIG.holeShape,
      baseColor: typeof parsed.baseColor === 'string' && parsed.baseColor.startsWith('#') ? parsed.baseColor : DEFAULT_PENCIL_CONFIG.baseColor,
      reliefColor: typeof parsed.reliefColor === 'string' && parsed.reliefColor.startsWith('#') ? parsed.reliefColor : DEFAULT_PENCIL_CONFIG.reliefColor,
    };
  } catch (err) {
    console.warn('Erro ao carregar ponteira do localStorage:', err);
    return DEFAULT_PENCIL_CONFIG;
  }
}

export function savePencilConfigToStorage(config: PencilTopperConfig): boolean {
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.setItem(PENCIL_STORAGE_KEY, JSON.stringify(config));
    return true;
  } catch (err) {
    console.warn('Erro ao salvar ponteira no localStorage:', err);
    return false;
  }
}

/**
 * Carrega a configuração salva no localStorage.
 * Faz merge inteligente com DEFAULT_CONFIG para garantir que
 * todas as propriedades necessárias existam e tenham valores válidos.
 */
export function loadSavedConfig(): LetterBoxConfig {
  if (typeof window === 'undefined') {
    return DEFAULT_CONFIG;
  }

  try {
    const raw = window.localStorage.getItem(CONFIG_STORAGE_KEY);
    if (!raw) {
      return DEFAULT_CONFIG;
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return DEFAULT_CONFIG;
    }

    // Restaura fonte customizada se foi salva em base64
    if (parsed.customFontBase64 && parsed.customFontName && 'fonts' in document) {
      try {
        const binaryString = window.atob(parsed.customFontBase64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const fontFace = new FontFace(parsed.customFontName, bytes.buffer);
        fontFace.load().then((loadedFace) => {
          document.fonts.add(loadedFace);
        }).catch((err) => {
          console.warn('Não foi possível restaurar fonte customizada:', err);
        });
      } catch (fontErr) {
        console.warn('Falha ao decodificar fonte customizada salva:', fontErr);
      }
    }

    // Merge com validação de tipos essenciais
    return {
      ...DEFAULT_CONFIG,
      ...parsed,
      text: typeof parsed.text === 'string' ? parsed.text : DEFAULT_CONFIG.text,
      fontFamily: typeof parsed.fontFamily === 'string' ? parsed.fontFamily : DEFAULT_CONFIG.fontFamily,
      letterHeight: typeof parsed.letterHeight === 'number' && !isNaN(parsed.letterHeight) ? parsed.letterHeight : DEFAULT_CONFIG.letterHeight,
      backDepth: typeof parsed.backDepth === 'number' && !isNaN(parsed.backDepth) ? parsed.backDepth : DEFAULT_CONFIG.backDepth,
      letterSpacing: typeof parsed.letterSpacing === 'number' && !isNaN(parsed.letterSpacing) ? parsed.letterSpacing : DEFAULT_CONFIG.letterSpacing,
      backContour: typeof parsed.backContour === 'number' && !isNaN(parsed.backContour) ? parsed.backContour : DEFAULT_CONFIG.backContour,
      midContour: typeof parsed.midContour === 'number' && !isNaN(parsed.midContour) ? parsed.midContour : DEFAULT_CONFIG.midContour,
      frontThickness: typeof parsed.frontThickness === 'number' && !isNaN(parsed.frontThickness) ? parsed.frontThickness : DEFAULT_CONFIG.frontThickness,
      midThickness: typeof parsed.midThickness === 'number' && !isNaN(parsed.midThickness) ? parsed.midThickness : DEFAULT_CONFIG.midThickness,
      flatBase: typeof parsed.flatBase === 'boolean' ? parsed.flatBase : DEFAULT_CONFIG.flatBase,
      backColor: typeof parsed.backColor === 'string' && parsed.backColor.startsWith('#') ? parsed.backColor : DEFAULT_CONFIG.backColor,
      midColor: typeof parsed.midColor === 'string' && parsed.midColor.startsWith('#') ? parsed.midColor : DEFAULT_CONFIG.midColor,
      frontColor: typeof parsed.frontColor === 'string' && parsed.frontColor.startsWith('#') ? parsed.frontColor : DEFAULT_CONFIG.frontColor,
    };
  } catch (err) {
    console.warn('Erro ao carregar configuração do localStorage:', err);
    return DEFAULT_CONFIG;
  }
}

/**
 * Salva a configuração atual no localStorage de forma segura.
 */
export function saveConfigToStorage(config: LetterBoxConfig): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    const serialized = JSON.stringify(config);
    window.localStorage.setItem(CONFIG_STORAGE_KEY, serialized);
    return true;
  } catch (err) {
    // Se estourar a quota de armazenamento (ex: fonte customizada muito grande)
    try {
      const configWithoutBase64 = { ...config, customFontBase64: undefined };
      window.localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(configWithoutBase64));
      return true;
    } catch (fallbackErr) {
      console.warn('Erro ao salvar no localStorage:', fallbackErr);
      return false;
    }
  }
}

/**
 * Remove a configuração salva e redefine para o padrão de fábrica
 */
export function clearSavedConfig(): void {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(CONFIG_STORAGE_KEY);
    } catch (err) {
      console.warn('Erro ao limpar localStorage:', err);
    }
  }
}
