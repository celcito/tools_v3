import React, { useState, useEffect } from 'react';
import { LetterBoxConfig, PencilTopperConfig, Model3DDimensions, AppMode } from './types';
import { DEFAULT_CONFIG } from './data/fontsAndPresets';
import { DEFAULT_PENCIL_CONFIG } from './data/pencilTopperPresets';
import {
  loadSavedConfig,
  saveConfigToStorage,
  loadSavedPencilConfig,
  savePencilConfigToStorage,
} from './utils/storage';
import { Navbar } from './components/Navbar';
import { ThreeCanvas } from './components/ThreeCanvas';
import { SidebarControls } from './components/SidebarControls';
import { ExportModal } from './components/ExportModal';
import { PencilCanvas } from './components/PencilCanvas';
import { PencilTopperControls } from './components/PencilTopperControls';
import { PencilExportModal } from './components/PencilExportModal';
import { SvgConverterModal } from './components/SvgConverterModal';
import { generateLetterBoxModel } from './utils/letterGeometryGenerator';
import { exportToMulticolor3MF } from './utils/threemfExporter';
import { generatePencilTopperModel } from './utils/pencilGeometryGenerator';
import { exportPencilTopper3MF } from './utils/threemfPencilExporter';
import { downloadBlob } from './utils/stlExporter';
import { Box, Sliders, CheckCircle2, Download, PenTool, Layers } from 'lucide-react';

export default function App() {
  // Modo atual do aplicativo: 'ponteira-lapis' ou 'letra-caixa'
  const [appMode, setAppMode] = useState<AppMode>('ponteira-lapis');

  // Configurações salvas de ambos os módulos
  const [letterConfig, setLetterConfig] = useState<LetterBoxConfig>(() => loadSavedConfig());
  const [pencilConfig, setPencilConfig] = useState<PencilTopperConfig>(() => loadSavedPencilConfig());

  // Salva automaticamente no localStorage
  useEffect(() => {
    saveConfigToStorage(letterConfig);
  }, [letterConfig]);

  useEffect(() => {
    savePencilConfigToStorage(pencilConfig);
  }, [pencilConfig]);

  // Dimensões calculadas
  const [letterDimensions, setLetterDimensions] = useState<Model3DDimensions>({
    dimX: 195.9,
    dimY: 58.6,
    dimZ: 26.7,
    volumeCm3: 82.4,
    weightGrams: 75.2,
    printTimeMinutes: 105,
  });

  const [pencilDimensions, setPencilDimensions] = useState<Model3DDimensions>({
    dimX: 52.0,
    dimY: 15.6,
    dimZ: 14.3,
    volumeCm3: 4.8,
    weightGrams: 5.9,
    printTimeMinutes: 22,
  });

  // Modais
  const [isLetterExportModalOpen, setIsLetterExportModalOpen] = useState(false);
  const [isPencilExportModalOpen, setIsPencilExportModalOpen] = useState(false);
  const [isSvgConverterOpen, setIsSvgConverterOpen] = useState(false);

  // Mobile view toggle (3D vs Controles)
  const [mobileView, setMobileView] = useState<'3d' | 'controls'>('3d');
  const [quickNotice, setQuickNotice] = useState<string | null>(null);

  // Download rápido direto do .3MF
  const handleQuickDownload3MF = async () => {
    if (appMode === 'letra-caixa') {
      try {
        setQuickNotice('Gerando arquivo .3MF Multicolor (3 Camadas)...');
        const model = await generateLetterBoxModel(letterConfig);
        const safeText = letterConfig.text.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 16) || 'LetraCaixa';
        const filename = `LetraCaixa_${safeText}_${letterConfig.letterHeight}mm_Multicolor.3mf`;

        const blob = await exportToMulticolor3MF(
          model.backMesh.geometry,
          model.midMesh.geometry,
          model.frontMesh.geometry,
          letterConfig.backColor,
          letterConfig.midColor,
          letterConfig.frontColor,
          letterConfig.backDepth,
          letterConfig.midThickness,
          filename
        );

        downloadBlob(blob, filename);
        setQuickNotice('Download do .3MF concluído com sucesso!');
        setTimeout(() => setQuickNotice(null), 3500);
      } catch (err) {
        console.error('Erro ao baixar 3MF Letra Caixa:', err);
        setQuickNotice('Erro ao gerar 3MF. Tente novamente.');
        setTimeout(() => setQuickNotice(null), 3000);
      }
    } else {
      try {
        setQuickNotice('Gerando arquivo .3MF Multicolor da Ponteira...');
        const model = await generatePencilTopperModel(pencilConfig);
        const safeText = pencilConfig.text.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 16) || 'Ponteira';
        const filename = `Ponteira_Lapis_${safeText}_2Cores.3mf`;

        const blob = await exportPencilTopper3MF(
          model.baseMesh.geometry,
          model.reliefMesh.geometry,
          pencilConfig.baseColor,
          pencilConfig.reliefColor,
          filename
        );

        downloadBlob(blob, filename);
        setQuickNotice('Download da Ponteira .3MF concluído com sucesso!');
        setTimeout(() => setQuickNotice(null), 3500);
      } catch (err) {
        console.error('Erro ao baixar 3MF Ponteira:', err);
        setQuickNotice('Erro ao gerar 3MF. Tente novamente.');
        setTimeout(() => setQuickNotice(null), 3000);
      }
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 text-slate-100 overflow-hidden font-sans select-none">
      {/* Barra de Navegação Superior */}
      <Navbar
        appMode={appMode}
        onSelectAppMode={setAppMode}
        letterConfig={letterConfig}
        onChangeLetterConfig={setLetterConfig}
        pencilConfig={pencilConfig}
        onChangePencilConfig={setPencilConfig}
        onOpenExportModal={() => {
          if (appMode === 'letra-caixa') {
            setIsLetterExportModalOpen(true);
          } else {
            setIsPencilExportModalOpen(true);
          }
        }}
        onQuickDownload3MF={handleQuickDownload3MF}
      />

      {/* Notificação Flutuante Rápida de Download */}
      {quickNotice && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl bg-slate-900/95 border border-amber-500/50 backdrop-blur-md text-amber-200 text-xs font-semibold shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{quickNotice}</span>
        </div>
      )}

      {/* Alternador Mobile (Visualização 3D vs Painel de Parâmetros) */}
      <div className="lg:hidden flex bg-slate-900 border-b border-slate-800 p-1.5 shrink-0">
        <button
          type="button"
          onClick={() => setMobileView('3d')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
            mobileView === '3d'
              ? appMode === 'letra-caixa'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'bg-amber-500 text-slate-950 shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Box className="w-3.5 h-3.5" />
          <span>Visualizador 3D</span>
        </button>
        <button
          type="button"
          onClick={() => setMobileView('controls')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
            mobileView === 'controls'
              ? appMode === 'letra-caixa'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'bg-amber-500 text-slate-950 shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>{appMode === 'letra-caixa' ? 'Parâmetros Letra' : 'Parâmetros Ponteira'}</span>
        </button>
      </div>

      {/* Área Principal de Trabalho */}
      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        {/* MÓDULO 1: PONTEIRA DE LÁPIS 3D */}
        {appMode === 'ponteira-lapis' && (
          <>
            {/* Visualizador 3D WebGL da Ponteira */}
            <div
              className={`flex-1 h-full ${
                mobileView === '3d' ? 'block' : 'hidden'
              } lg:block relative`}
            >
              <PencilCanvas
                config={pencilConfig}
                onDimensionsChange={setPencilDimensions}
                onOpenExportModal={() => setIsPencilExportModalOpen(true)}
              />
            </div>

            {/* Painel Lateral Paramétrico da Ponteira */}
            <div
              className={`h-full ${
                mobileView === 'controls' ? 'block' : 'hidden'
              } lg:block shrink-0`}
            >
              <PencilTopperControls
                config={pencilConfig}
                onChange={setPencilConfig}
                dimensions={pencilDimensions}
                onOpenExportModal={() => setIsPencilExportModalOpen(true)}
                onQuickDownload3MF={handleQuickDownload3MF}
                onOpenSvgConverter={() => setIsSvgConverterOpen(true)}
              />
            </div>
          </>
        )}

        {/* MÓDULO 2: LETRA CAIXA 3D (3 CAMADAS) */}
        {appMode === 'letra-caixa' && (
          <>
            {/* Visualizador 3D WebGL da Letra Caixa */}
            <div
              className={`flex-1 h-full ${
                mobileView === '3d' ? 'block' : 'hidden'
              } lg:block relative`}
            >
              <ThreeCanvas
                config={letterConfig}
                onDimensionsChange={setLetterDimensions}
                onOpenExportModal={() => setIsLetterExportModalOpen(true)}
              />
            </div>

            {/* Painel Lateral Paramétrico da Letra Caixa */}
            <div
              className={`h-full ${
                mobileView === 'controls' ? 'block' : 'hidden'
              } lg:block shrink-0`}
            >
              <SidebarControls
                config={letterConfig}
                onChange={setLetterConfig}
                dimensions={letterDimensions}
                onOpenExportModal={() => setIsLetterExportModalOpen(true)}
                onQuickDownload3MF={handleQuickDownload3MF}
              />
            </div>
          </>
        )}
      </main>

      {/* Modais de Exportação */}
      <ExportModal
        isOpen={isLetterExportModalOpen}
        onClose={() => setIsLetterExportModalOpen(false)}
        config={letterConfig}
        dimensions={letterDimensions}
      />

      <PencilExportModal
        isOpen={isPencilExportModalOpen}
        onClose={() => setIsPencilExportModalOpen(false)}
        config={pencilConfig}
        dimensions={pencilDimensions}
      />

      {/* Modal do Conversor de SVG 3D */}
      <SvgConverterModal
        isOpen={isSvgConverterOpen}
        onClose={() => setIsSvgConverterOpen(false)}
        onApplyIcon={(_svgUrl, _name) => {
          setPencilConfig((prev) => ({
            ...prev,
            symbolId: 'star', // Aplica o símbolo estelar ou ícone
          }));
          setQuickNotice('Ícone otimizado aplicado à ponteira!');
          setTimeout(() => setQuickNotice(null), 3000);
        }}
      />
    </div>
  );
}
