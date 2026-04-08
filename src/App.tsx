/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useEffect, useCallback, ChangeEvent, FormEvent } from 'react';
import { motion, useMotionValue, useTransform } from 'motion/react';
import { 
  Camera, 
  Upload, 
  Image as ImageIcon, 
  Settings, 
  Lock, 
  Unlock, 
  RotateCcw, 
  ZoomIn, 
  ZoomOut,
  X,
  Maximize,
  Minimize,
  FlipHorizontal,
  HelpCircle,
  Smartphone,
  PenTool,
  Layers,
  Search,
  Zap
} from 'lucide-react';

const PRESET_IMAGES = [
  { id: 'cat', url: 'https://picsum.photos/seed/cat-sketch/800/800', label: 'Cat' },
  { id: 'flower', url: 'https://picsum.photos/seed/flower-sketch/800/800', label: 'Flower' },
  { id: 'mountain', url: 'https://picsum.photos/seed/mountain-sketch/800/800', label: 'Mountain' },
];

export default function App() {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [overlayImage, setOverlayImage] = useState<string | null>(null);
  const [opacity, setOpacity] = useState(0.5);
  const [isLocked, setIsLocked] = useState(false);
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPresets, setShowPresets] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [isMirrored, setIsMirrored] = useState(false);
  const [language, setLanguage] = useState<'en' | 'pt'>('pt');
  const [isTracing, setIsTracing] = useState(false);
  const [isInverted, setIsInverted] = useState(false);
  const [traceContrast, setTraceContrast] = useState(500);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{id: string, url: string, label: string}[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const t = {
    en: {
      helpTitle: "How to use",
      step1Title: "1. Setup Stand",
      step1Desc: "Place your phone on a stand or glass surface parallel to your paper.",
      step2Title: "2. Adjust Overlay",
      step2Desc: "Upload an image, adjust its scale, rotation, and opacity to match your paper.",
      step3Title: "3. Start Tracing",
      step3Desc: "Look through the screen and trace the lines onto your physical paper.",
      closeBtn: "Got it!",
      devTitle: "Developer",
      devDesc: "Developed by Sidney J Santos. A tool designed to bridge digital art and traditional drawing.",
      langSwitch: "Português (Brasil)",
      mainTitle: "AR Drawing Projector",
      mainDesc: "Transform your phone into a tracing projector. Overlay images on your camera feed to draw with precision.",
      startBtn: "Start Camera",
      camError: "Could not access camera. Please ensure permissions are granted.",
      searchPlaceholder: "Search sketches...",
      traceToggle: "Trace Mode",
      searchBtn: "Search",
      searching: "Searching..."
    },
    pt: {
      helpTitle: "Como usar",
      step1Title: "1. Prepare o Suporte",
      step1Desc: "Coloque seu telefone em um suporte ou superfície de vidro paralela ao papel.",
      step2Title: "2. Ajuste a Sobreposição",
      step2Desc: "Carregue uma imagem, ajuste a escala, rotação e opacidade para combinar com seu papel.",
      step3Title: "3. Comece a Desenhar",
      step3Desc: "Olhe através da tela e trace as linhas no seu papel físico.",
      closeBtn: "Entendi!",
      devTitle: "Desenvolvedor",
      devDesc: "Desenvolvido por Sidney J Santos. Uma ferramenta criada para unir a arte digital ao desenho tradicional.",
      langSwitch: "English",
      mainTitle: "AR Drawing Projector",
      mainDesc: "Transforme seu celular em um projetor de traçado. Sobreponha imagens na câmera para desenhar com precisão.",
      startBtn: "Iniciar Câmera",
      camError: "Não foi possível acessar a câmera. Verifique as permissões.",
      searchPlaceholder: "Pesquisar esboços...",
      traceToggle: "Modo Traço",
      searchBtn: "Pesquisar",
      searching: "Pesquisando..."
    }
  }[language];

  // Camera Setup
  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError('Seu navegador não suporta acesso à câmera.');
      return;
    }

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false,
      });
      setStream(mediaStream);
      setIsCameraActive(true);
      setError(null);
    } catch (err: any) {
      console.error('Error accessing camera:', err);
      if (err.name === 'NotAllowedError') {
        setError('Permissão de câmera negada. Por favor, habilite o acesso.');
      } else {
        setError('Erro ao acessar a câmera: ' + err.message);
      }
    }
  }, []);

  // Ensure stream is attached to video element
  useEffect(() => {
    if (isCameraActive && stream && videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.onloadedmetadata = () => {
        videoRef.current?.play().catch(e => console.error("Error playing video:", e));
      };
    }
  }, [isCameraActive, stream]);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
      setIsCameraActive(false);
    }
  }, [stream]);

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  // Image Handling
  const handleFileUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setOverlayImage(e.target?.result as string);
        setScale(1);
        setRotation(0);
      };
      reader.readAsDataURL(file);
    }
  };

  const resetOverlay = () => {
    setScale(1);
    setRotation(0);
  };

  const handleSearch = async (e: FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    try {
      // Using Lexica API for real search results
      const response = await fetch(`https://lexica.art/api/v1/search?q=${encodeURIComponent(searchQuery)}`);
      const data = await response.json();
      
      if (data.images && Array.isArray(data.images)) {
        const results = data.images.slice(0, 12).map((img: any) => ({
          id: img.id,
          url: img.src,
          label: searchQuery
        }));
        setSearchResults(results);
      }
    } catch (err) {
      console.error('Error searching images:', err);
      // Fallback
      const results = Array.from({ length: 6 }).map((_, i) => ({
        id: `search-${i}-${Date.now()}`,
        url: `https://loremflickr.com/800/800/${encodeURIComponent(searchQuery)}?lock=${i}`,
        label: `${searchQuery} ${i + 1}`
      }));
      setSearchResults(results);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="relative h-screen w-screen bg-gray-900 overflow-hidden font-sans text-white">
      {/* Camera Background */}
      <div className="absolute inset-0 z-0 bg-gray-950">
        {isCameraActive ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center bg-gray-900 px-6 text-center">
            <div className="mb-6 rounded-full bg-gray-800 p-6 shadow-xl">
              <Camera className="h-12 w-12 text-gray-400" />
            </div>
            <h1 className="mb-2 text-3xl font-bold tracking-tight">{t.mainTitle}</h1>
            <p className="mb-8 max-w-xs text-gray-400">
              {t.mainDesc}
            </p>
            <button
              onClick={startCamera}
              className="rounded-full bg-blue-600 px-10 py-4 font-bold text-lg shadow-lg shadow-blue-900/20 transition-all hover:bg-blue-500 active:scale-95"
            >
              {t.startBtn}
            </button>
            {error && (
              <div className="mt-6 rounded-xl bg-red-500/10 p-4 border border-red-500/20">
                <p className="text-red-400 text-sm font-medium">{t.camError}</p>
                <p className="mt-1 text-red-500/70 text-xs">{error}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Overlay Image Layer */}
      {overlayImage && isCameraActive && (
        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
          <motion.div
            drag={!isLocked}
            dragMomentum={false}
            className="pointer-events-auto cursor-move"
            style={{
              opacity,
              scale: isMirrored ? -scale : scale,
              rotate: rotation,
              scaleX: isMirrored ? -1 : 1
            }}
          >
            <img
              src={overlayImage}
              alt="Overlay"
              className="max-w-[80vw] max-h-[80vh] select-none transition-all duration-300"
              style={{
                filter: isTracing 
                  ? `grayscale(100%) contrast(${traceContrast}%) brightness(120%) ${isInverted ? 'invert(100%)' : 'invert(0%)'}` 
                  : 'none'
              }}
              draggable={false}
              referrerPolicy="no-referrer"
            />
          </motion.div>
        </div>
      )}

      {/* UI Controls - Top Bar */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between p-4 bg-gradient-to-b from-black/60 to-transparent">
        <div className="flex gap-2">
          <button
            onClick={() => setShowHelp(true)}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 backdrop-blur-md transition-colors hover:bg-white/20"
            title="Help"
          >
            <HelpCircle className="h-5 w-5" />
          </button>
          <button
            onClick={() => setIsLocked(!isLocked)}
            className={`flex h-10 w-10 items-center justify-center rounded-full backdrop-blur-md transition-colors ${
              isLocked ? 'bg-red-500/80' : 'bg-white/10 hover:bg-white/20'
            }`}
            title={isLocked ? 'Unlock Image' : 'Lock Image'}
          >
            {isLocked ? <Lock className="h-5 w-5" /> : <Unlock className="h-5 w-5" />}
          </button>
          <button
            onClick={resetOverlay}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 backdrop-blur-md transition-colors hover:bg-white/20"
            title="Reset Position"
          >
            <RotateCcw className="h-5 w-5" />
          </button>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setIsTracing(!isTracing)}
            className={`flex h-10 w-10 items-center justify-center rounded-full backdrop-blur-md transition-colors ${
              isTracing ? 'bg-yellow-500/80' : 'bg-white/10 hover:bg-white/20'
            }`}
            title={t.traceToggle}
          >
            <Zap className="h-5 w-5" />
          </button>
          {isTracing && (
            <button
              onClick={() => setIsInverted(!isInverted)}
              className={`flex h-10 w-10 items-center justify-center rounded-full backdrop-blur-md transition-colors ${
                isInverted ? 'bg-orange-500/80' : 'bg-white/10 hover:bg-white/20'
              }`}
              title={language === 'pt' ? 'Inverter Cores' : 'Invert Colors'}
            >
              <RotateCcw className="h-5 w-5" />
            </button>
          )}
          <button
            onClick={() => setIsMirrored(!isMirrored)}
            className={`flex h-10 w-10 items-center justify-center rounded-full backdrop-blur-md transition-colors ${
              isMirrored ? 'bg-blue-500/80' : 'bg-white/10 hover:bg-white/20'
            }`}
            title="Mirror Image"
          >
            <FlipHorizontal className="h-5 w-5" />
          </button>
          <button
            onClick={() => setShowPresets(!showPresets)}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 backdrop-blur-md transition-colors hover:bg-white/20"
          >
            <ImageIcon className="h-5 w-5" />
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 backdrop-blur-md transition-colors hover:bg-white/20"
          >
            <Upload className="h-5 w-5" />
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept="image/*"
            className="hidden"
          />
        </div>
      </div>

      {/* UI Controls - Bottom Panel */}
      {isCameraActive && (
        <div className="absolute bottom-0 left-0 right-0 z-20 p-6 bg-gradient-to-t from-gray-950 to-transparent">
          <div className="mx-auto max-w-md space-y-6">
            {/* Opacity Slider */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-medium uppercase tracking-wider text-gray-400">
                <span>Opacity</span>
                <span>{Math.round(opacity * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={opacity}
                onChange={(e) => setOpacity(parseFloat(e.target.value))}
                className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-gray-700 accent-blue-500"
              />
            </div>

            {/* Zoom Controls */}
            <div className="flex items-center justify-center gap-6">
              <button
                onClick={() => setScale(prev => Math.max(0.1, prev - 0.1))}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-800 shadow-lg transition-transform active:scale-90"
              >
                <ZoomOut className="h-6 w-6" />
              </button>
              <div className="text-center min-w-[60px]">
                <span className="text-sm font-bold text-gray-300">Scale</span>
                <div className="text-lg font-mono">{scale.toFixed(1)}x</div>
              </div>
              <button
                onClick={() => setScale(prev => Math.min(5, prev + 0.1))}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-800 shadow-lg transition-transform active:scale-90"
              >
                <ZoomIn className="h-6 w-6" />
              </button>
            </div>

            {/* Rotation Controls */}
            <div className="flex items-center justify-center gap-4">
              <input
                type="range"
                min="0"
                max="360"
                value={rotation}
                onChange={(e) => setRotation(parseInt(e.target.value))}
                className="h-1.5 w-full max-w-[200px] cursor-pointer appearance-none rounded-full bg-gray-700 accent-blue-500"
              />
              <span className="text-xs font-mono text-gray-400">{rotation}°</span>
            </div>

            {/* Trace Contrast Control (Only when Trace is active) */}
            {isTracing && (
              <div className="pt-4 border-t border-gray-800 space-y-2">
                <div className="flex justify-between text-xs font-medium uppercase tracking-wider text-yellow-500">
                  <span>{language === 'pt' ? 'Contraste do Traço' : 'Trace Contrast'}</span>
                  <span>{traceContrast}%</span>
                </div>
                <input
                  type="range"
                  min="100"
                  max="1000"
                  step="10"
                  value={traceContrast}
                  onChange={(e) => setTraceContrast(parseInt(e.target.value))}
                  className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-gray-700 accent-yellow-500"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Presets Modal */}
      {showPresets && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-gray-950/90 p-6 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl bg-gray-900 p-6 shadow-2xl border border-gray-800">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-bold">{language === 'pt' ? 'Escolha um Esboço' : 'Choose a Sketch'}</h2>
              <button onClick={() => setShowPresets(false)} className="text-gray-400 hover:text-white p-1">
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Search Field */}
            <form onSubmit={handleSearch} className="mb-6 flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t.searchPlaceholder}
                  className="w-full rounded-xl bg-gray-800 py-3 pl-10 pr-4 text-sm outline-none ring-blue-500 focus:ring-2 border border-gray-700"
                />
              </div>
              <button
                type="submit"
                disabled={isSearching}
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold transition-all hover:bg-blue-500 disabled:opacity-50 shadow-lg shadow-blue-900/20"
              >
                {isSearching ? <RotateCcw className="h-4 w-4 animate-spin" /> : t.searchBtn}
              </button>
            </form>

            <div className="grid grid-cols-2 gap-4 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
              {/* Search Results */}
              {searchResults.length > 0 && (
                <div className="col-span-2 mb-2">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500">
                      {language === 'pt' ? 'Resultados da Busca' : 'Search Results'}
                    </h3>
                    <button 
                      onClick={() => setSearchResults([])}
                      className="text-[10px] font-bold text-blue-400 hover:text-blue-300 uppercase tracking-wider"
                    >
                      {language === 'pt' ? 'Limpar' : 'Clear'}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {searchResults.map((img) => (
                      <button
                        key={img.id}
                        onClick={() => {
                          setOverlayImage(img.url);
                          setShowPresets(false);
                          resetOverlay();
                        }}
                        className="group relative aspect-square overflow-hidden rounded-2xl bg-gray-800 ring-2 ring-transparent transition-all hover:ring-blue-500"
                      >
                        <img
                          src={img.url}
                          alt={img.label}
                          className="h-full w-full object-cover opacity-80 transition-opacity group-hover:opacity-100"
                          referrerPolicy="no-referrer"
                        />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Default Presets */}
              <div className="col-span-2 mb-2">
                <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3">
                  {language === 'pt' ? 'Sugestões' : 'Suggestions'}
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {PRESET_IMAGES.map((img) => (
                    <button
                      key={img.id}
                      onClick={() => {
                        setOverlayImage(img.url);
                        setShowPresets(false);
                        resetOverlay();
                      }}
                      className="group relative aspect-square overflow-hidden rounded-2xl bg-gray-800 ring-2 ring-transparent transition-all hover:ring-blue-500"
                    >
                      <img
                        src={img.url}
                        alt={img.label}
                        className="h-full w-full object-cover opacity-80 transition-opacity group-hover:opacity-100"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 transition-opacity group-hover:opacity-100 flex items-end p-2">
                        <span className="text-[10px] font-bold text-white uppercase tracking-wider">{img.label}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Help Modal */}
      {showHelp && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/90 p-6 backdrop-blur-md">
          <div className="w-full max-w-md rounded-3xl bg-zinc-900 p-8 shadow-2xl border border-zinc-800 overflow-y-auto max-h-[90vh]">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold">{t.helpTitle}</h2>
              <div className="flex gap-2">
                <button 
                  onClick={() => setLanguage(language === 'en' ? 'pt' : 'en')}
                  className="text-xs font-bold px-3 py-1 rounded-full bg-zinc-800 hover:bg-zinc-700 transition-colors text-blue-400"
                >
                  {t.langSwitch}
                </button>
                <button onClick={() => setShowHelp(false)} className="rounded-full p-1 hover:bg-zinc-800 transition-colors">
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>
            
            <div className="space-y-6">
              <div className="flex gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-500/20 text-blue-400">
                  <Smartphone className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-bold">{t.step1Title}</h3>
                  <p className="text-sm text-zinc-400">{t.step1Desc}</p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-purple-500/20 text-purple-400">
                  <Layers className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-bold">{t.step2Title}</h3>
                  <p className="text-sm text-zinc-400">{t.step2Desc}</p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-green-500/20 text-green-400">
                  <PenTool className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-bold">{t.step3Title}</h3>
                  <p className="text-sm text-zinc-400">{t.step3Desc}</p>
                </div>
              </div>

              <div className="pt-6 border-t border-zinc-800">
                <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2">{t.devTitle}</h3>
                <p className="text-sm text-zinc-300 italic">
                  "{t.devDesc}"
                </p>
                <p className="mt-2 text-xs font-bold text-blue-500">— Sidney J Santos</p>
              </div>
            </div>

            <button
              onClick={() => setShowHelp(false)}
              className="mt-8 w-full rounded-2xl bg-blue-600 py-4 font-bold transition-all hover:bg-blue-500 active:scale-95"
            >
              {t.closeBtn}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
