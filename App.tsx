import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, GraduationCap, AlertCircle, Loader2, ExternalLink, Save, CheckCircle, Upload, X, File as FileIcon, HelpCircle, Trash2, Settings2 } from 'lucide-react';
import { generateRubricFromGemini } from './services/geminiService';
import { generateClassroomCSV, downloadCSV, validateRubric } from './utils/csvGenerator';
import { RubricData, GenerationStatus } from './types';
import { RubricPreview } from './components/RubricPreview';
import { API_KEY } from './config';

interface AttachedFile {
  name: string;
  mimeType: string;
  data: string; // Base64 string without prefix
}

interface ErrorState {
  title: string;
  message: string;
  suggestion?: string;
  details?: string;
  link?: {
    text: string;
    url: string;
  };
}

const App: React.FC = () => {
  const [assignmentText, setAssignmentText] = useState('');
  const [maxPoints, setMaxPoints] = useState<number>(100);
  const [status, setStatus] = useState<GenerationStatus>(GenerationStatus.IDLE);
  const [rubric, setRubric] = useState<RubricData | null>(null);
  const [error, setError] = useState<ErrorState | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [attachedFile, setAttachedFile] = useState<AttachedFile | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load rubric from localStorage on mount
  useEffect(() => {
    const savedRubric = localStorage.getItem('rubric_data');
    if (savedRubric) {
      try {
        const parsed = JSON.parse(savedRubric) as RubricData;
        if (parsed && parsed.criteria && parsed.criteria.length > 0) {
          setRubric(parsed);
          setStatus(GenerationStatus.SUCCESS);
        }
      } catch (e) {
        console.error("Nepavyko užkrauti išsaugotos lentelės:", e);
        localStorage.removeItem('rubric_data'); // Clean up bad data
      }
    }
  }, []);

  const normalizeFilename = (filename: string): string => {
    let safeFilename = filename.trim();
    if (!safeFilename) safeFilename = 'rubric.csv';
    if (!safeFilename.toLowerCase().endsWith('.csv')) {
      safeFilename += '.csv';
    }
    return safeFilename;
  };

  const handleClearData = () => {
    // Išvalome be window.confirm, nes iframe jis neveikia
    // Clear Local Storage
    localStorage.removeItem('rubric_data');

    // Reset State
    setRubric(null);
    setAssignmentText('');
    setAttachedFile(null);
    setStatus(GenerationStatus.IDLE);
    setError(null);
    setSaveMessage('Duomenys sėkmingai išvalyti.');
    setTimeout(() => setSaveMessage(null), 3000);
  };

  const handleGenerate = async () => {
    if (!assignmentText.trim() && !attachedFile) return;

    setStatus(GenerationStatus.GENERATING);
    setError(null);
    
    if (!API_KEY) {
      setError({
        title: "Konfigūracijos klaida",
        message: "Sistemoje nerastas API raktas (API_KEY).",
        suggestion: "Susisiekite su sistemos administratoriumi arba gaukite raktą:",
        link: {
          text: "Google AI Studio",
          url: "https://aistudio.google.com/app/apikey"
        }
      });
      setStatus(GenerationStatus.ERROR);
      return;
    }

    const targetScore = maxPoints > 0 ? maxPoints : 100;

    try {
      const data = await generateRubricFromGemini(
        assignmentText, 
        targetScore, 
        attachedFile ? { mimeType: attachedFile.mimeType, data: attachedFile.data } : undefined
      );
      setRubric(data);
      setStatus(GenerationStatus.SUCCESS);
    } catch (e) {
      const err = e as Error;
      let errorState: ErrorState = {
        title: "Generavimo klaida",
        message: "Nepavyko sugeneruoti vertinimo lentelės.",
        suggestion: "Pabandykite dar kartą arba sutrumpinkite užduoties aprašymą.",
        details: err.message
      };

      // Identify common Gemini/Network errors
      if (err.message) {
        if (err.message.includes('429') || err.message.toLowerCase().includes('quota')) {
          errorState.title = "Viršytas užklausų limitas";
          errorState.message = "Sistema šiuo metu apkrauta arba viršytas API limitas.";
          errorState.suggestion = "Palaukite minutę arba patikrinkite kvotas:";
          errorState.link = {
            text: "Google Cloud Console",
            url: "https://console.cloud.google.com/apis/dashboard"
          };
        } else if (err.message.includes('400') || err.message.toLowerCase().includes('invalid')) {
          errorState.title = "Neteisinga užklausa";
          errorState.message = "DI negalėjo apdoroti pateikto failo ar teksto.";
          errorState.suggestion = "Patikrinkite, ar failas nėra sugadintas, arba bandykite kopijuoti tekstą tiesiogiai.";
        } else if (err.message.toLowerCase().includes('safety') || err.message.toLowerCase().includes('blocked')) {
          errorState.title = "Turinio saugumo filtras";
          errorState.message = "DI atmetė užklausą dėl saugumo politikos.";
          errorState.suggestion = "Peržiūrėkite tekstą, ar jame nėra neleistino turinio, ir bandykite dar kartą.";
        } else if (err.message.includes('500') || err.message.includes('503')) {
          errorState.title = "Serverio klaida";
          errorState.message = "Google DI serveriai šiuo metu nepasiekiami.";
          errorState.suggestion = "Bandykite vėliau.";
        } else {
          errorState.message = err.message;
        }
      }

      setError(errorState);
      setStatus(GenerationStatus.ERROR);
    }
  };

  const handleDownload = (filename: string) => {
    if (!rubric) return;
    
    // Validate rubric before download
    const validationError = validateRubric(rubric);
    if (validationError) {
      setError({
        title: "Validacijos klaida",
        message: validationError,
        suggestion: "Prašome užpildyti trūkstamą informaciją lentelėje."
      });
      return;
    }

    const finalFilename = normalizeFilename(filename);
    
    // Call without title, as per v1.0-s format
    const csv = generateClassroomCSV(rubric);
    
    downloadCSV(csv, finalFilename);
  };

  const handleSave = () => {
    if (!rubric) return;
    try {
      localStorage.setItem('rubric_data', JSON.stringify(rubric));
      setSaveMessage("Sėkmingai išsaugota naršyklėje!");
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (e) {
      console.error("Saving failed", e);
      setError({
        title: "Išsaugojimo klaida",
        message: "Nepavyko išsaugoti duomenų naršyklėje.",
        suggestion: "Patikrinkite naršyklės nustatymus arba atlaisvinkite vietos.",
        details: (e as Error).message
      });
    }
  };

  const handleRubricChange = (updatedRubric: RubricData) => {
    setRubric(updatedRubric);
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setAssignmentText(e.target.value);
  };

  // File Handling
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    processFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    processFile(file);
  };

  const processFile = async (file: File | undefined) => {
    if (!file) return;

    // 1. Check for empty files
    if (file.size === 0) {
      setError({
        title: "Tuščias failas",
        message: `Failas "${file.name}" yra tuščias.`,
        suggestion: "Prašome įkelti failą su turiniu."
      });
      return;
    }

    // 2. Validate types: PDF, Text, or Images
    const validTypes = ['application/pdf', 'text/plain', 'image/png', 'image/jpeg', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setError({
        title: "Netinkamas failo formatas",
        message: `Failas "${file.name}" nėra palaikomas.`,
        suggestion: "Prašome įkelti PDF, TXT arba paveikslėlį (PNG, JPG, WEBP)."
      });
      return;
    }

    // 3. Size limit
    const MAX_SIZE_MB = 10;
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setError({
        title: "Failas per didelis",
        message: `Failas viršija ${MAX_SIZE_MB}MB limitą.`,
        suggestion: "Sumažinkite failo dydį arba nukopijuokite tekstą į laukelį."
      });
      return;
    }

    // 4. Image dimension validation
    if (file.type.startsWith('image/')) {
      try {
        await new Promise<void>((resolve, reject) => {
          const img = new Image();
          const objectUrl = URL.createObjectURL(file);
          img.onload = () => {
            URL.revokeObjectURL(objectUrl);
            if (img.width < 100 || img.height < 100) {
              reject(new Error("Paveikslėlis per mažas. Rekomenduojama bent 200x200 pikselių rezoliucija geresniam atpažinimui."));
            } else if (img.width > 10000 || img.height > 10000) {
              reject(new Error("Paveikslėlis per didelis. Maksimalūs matmenys yra 10000x10000 pikselių."));
            } else {
              resolve();
            }
          };
          img.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            reject(new Error("Nepavyko nuskaityti paveikslėlio failo."));
          };
          img.src = objectUrl;
        });
      } catch (e) {
        setError({
          title: "Paveikslėlio klaida",
          message: (e as Error).message,
          suggestion: "Pabandykite įkelti kitą paveikslėlį arba naudokite tekstą."
        });
        return;
      }
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // Remove Data URL prefix to get raw base64
      const base64Data = result.split(',')[1];
      
      setAttachedFile({
        name: file.name,
        mimeType: file.type,
        data: base64Data
      });
      setError(null);
    };
    reader.onerror = () => {
       setError({
        title: "Failo nuskaitymo klaida",
        message: "Nepavyko nuskaityti įkelto failo.",
        suggestion: "Bandykite įkelti iš naujo."
       });
    };
    reader.readAsDataURL(file);
  };

  const removeFile = () => {
    setAttachedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const canGenerate = (assignmentText.trim().length > 0 || attachedFile !== null) && status !== GenerationStatus.GENERATING;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-2 rounded-lg text-white">
              <GraduationCap size={20} />
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Vertinimo kriterijai <span className="text-slate-400 font-normal">skirti Google Classroom užduotims</span></h1>
          </div>
          
          <div className="flex items-center gap-4">
            <button
              onClick={handleClearData}
              className="text-sm text-red-500 hover:text-red-700 font-medium flex items-center gap-1 transition-colors"
              title="Išvalyti viską"
            >
              <Trash2 size={16} /> Išvalyti
            </button>
            <a 
              href="https://support.google.com/edu/classroom/answer/9335069" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-sm text-slate-500 hover:text-blue-600 flex items-center gap-1 transition-colors hidden sm:flex"
            >
              Pagalbos centras <ExternalLink size={14} />
            </a>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6 relative">
        
        {/* Input Column */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-600 text-xs">1</span>
              Užduoties informacija
            </h2>
            <p className="text-sm text-slate-500 mb-4">
              Įkelkite užduoties failą (PDF, Word kopiją) arba įklijuokite tekstą.
            </p>

            {/* File Upload Area */}
            <div 
              className={`mb-4 border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center text-center transition-colors cursor-pointer relative
                ${attachedFile 
                  ? 'border-blue-200 bg-blue-50' 
                  : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'
                }`}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => !attachedFile && fileInputRef.current?.click()}
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                onChange={handleFileSelect}
                accept=".pdf,.txt,image/*"
              />
              
              {attachedFile ? (
                <div className="w-full flex items-center justify-between bg-white p-3 rounded border border-blue-200 shadow-sm">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="bg-blue-100 p-2 rounded text-blue-600">
                      <FileIcon size={20} />
                    </div>
                    <div className="text-left overflow-hidden">
                      <div className="text-sm font-medium text-slate-700 truncate max-w-[180px]">{attachedFile.name}</div>
                      <div className="text-xs text-slate-400 uppercase">{attachedFile.mimeType.split('/')[1]}</div>
                    </div>
                  </div>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile();
                    }}
                    className="p-1 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center w-full">
                  <div className="flex gap-4 mb-3">
                      <div className="bg-slate-100 p-3 rounded-full text-slate-400">
                        <Upload size={24} />
                      </div>
                  </div>
                  
                  <p className="text-sm font-medium text-slate-700 mb-4">Spauskite įkelti failą arba tempkite čia</p>
                  
                  <p className="text-xs text-slate-400 mt-2">Palaikoma: PDF, TXT, Paveikslėliai (Maks 10MB)</p>
                </div>
              )}
            </div>
            
            <div className="relative mb-2 flex items-center gap-4">
               <div className="h-px bg-slate-200 flex-1"></div>
               <span className="text-xs text-slate-400 font-medium uppercase">Arba rašykite tekstą</span>
               <div className="h-px bg-slate-200 flex-1"></div>
            </div>

            <div className="relative mb-6">
              <textarea
                value={assignmentText}
                onChange={handleTextareaChange}
                placeholder="Pavyzdys: Parašykite 500 žodžių esė, analizuojančią pagrindines veikėjo savybes..."
                className="w-full h-40 p-4 rounded-lg border border-slate-300 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none transition-all text-slate-800 placeholder-slate-400 text-sm leading-relaxed"
              />
              <div className="absolute bottom-3 right-3 text-xs text-slate-400 pointer-events-none">
                {assignmentText.length} simb.
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-6">
               <h3 className="text-sm font-medium text-slate-700 mb-3 flex items-center gap-2">
                  <Settings2 size={16} />
                  Vertinimo nustatymai
               </h3>
               <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <label htmlFor="maxPoints" className="block text-xs text-slate-500 mb-1 uppercase font-semibold tracking-wider">
                      Maksimalus balų skaičius
                    </label>
                    <div className="relative">
                      <input
                        id="maxPoints"
                        type="number"
                        min="1"
                        max="1000"
                        value={maxPoints}
                        onChange={(e) => setMaxPoints(parseInt(e.target.value) || 0)}
                        className="w-full pl-3 pr-12 py-2 rounded-md border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      />
                      <span className="absolute right-3 top-2 text-xs text-slate-400 font-medium">tšk.</span>
                    </div>
                  </div>
                  <div className="flex-1 text-xs text-slate-400 leading-tight">
                     DI paskirstys šiuos balus tarp visų sugeneruotų kriterijų.
                  </div>
               </div>
            </div>

            <div>
              <button
                onClick={handleGenerate}
                disabled={!canGenerate}
                className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-semibold text-white transition-all shadow-md
                  ${!canGenerate 
                    ? 'bg-slate-300 cursor-not-allowed' 
                    : 'bg-blue-600 hover:bg-blue-700 hover:shadow-lg active:scale-[0.99]'
                  }`}
              >
                {status === GenerationStatus.GENERATING ? (
                  <>
                    <Loader2 className="animate-spin" size={20} />
                    Generuojama...
                  </>
                ) : (
                  <>
                    <Sparkles size={20} />
                    Generuoti kriterijus
                  </>
                )}
              </button>
            </div>

            {error && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={18} />
                <div className="flex-1 text-sm">
                  <span className="font-bold text-red-800 block mb-1">{error.title}</span>
                  <p className="text-red-700 mb-2">{error.message}</p>
                  {error.suggestion && (
                    <div className="text-red-600 text-xs bg-red-100/50 p-2 rounded flex items-start gap-1.5 mb-2">
                      <HelpCircle size={12} className="mt-0.5 flex-shrink-0" />
                      <span>
                        {error.suggestion}
                        {error.link && (
                          <>
                            {' '}
                            <a 
                              href={error.link.url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="underline hover:text-red-800 font-medium inline-flex items-center gap-0.5"
                            >
                              {error.link.text}
                              <ExternalLink size={10} />
                            </a>
                          </>
                        )}
                      </span>
                    </div>
                  )}
                  {error.details && (
                    <details className="text-xs text-red-800/70 mt-1">
                      <summary className="cursor-pointer hover:text-red-800 font-medium select-none">Detali klaidos informacija</summary>
                      <pre className="mt-1 whitespace-pre-wrap font-mono text-[10px] bg-white/50 p-2 rounded border border-red-100 overflow-x-auto">
                        {error.details}
                      </pre>
                    </details>
                  )}
                </div>
              </div>
            )}

            {saveMessage && (
              <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3 animate-fade-in">
                <CheckCircle className="text-green-600 flex-shrink-0 mt-0.5" size={18} />
                <div className="text-sm text-green-700">
                  <span className="font-medium">{saveMessage}</span>
                </div>
              </div>
            )}
          </div>

          <div className="bg-indigo-50 rounded-xl border border-indigo-100 p-6">
            <h3 className="text-indigo-900 font-semibold mb-2 text-sm">Patarimai rezultatams</h3>
            <ul className="space-y-2 text-sm text-indigo-700 list-disc list-inside">
              <li>Galite įkelti <strong>PDF</strong> arba <strong>Paveikslėlius</strong> su užduotimi.</li>
              <li>Nurodykite, kokius aspektus (pvz., gramatika, kūrybiškumas) norite akcentuoti pastabose.</li>
              <li>Gautą CSV failą galite tiesiogiai įkelti į Google Classroom.</li>
            </ul>
          </div>
        </div>

        {/* Output Column */}
        <div className="lg:col-span-7 h-[600px] lg:h-auto flex flex-col">
           <RubricPreview 
             rubric={rubric} 
             onDownload={handleDownload} 
             onSave={handleSave}
             onRubricChange={handleRubricChange} 
           />
        </div>
      </main>
    </div>
  );
};

export default App;