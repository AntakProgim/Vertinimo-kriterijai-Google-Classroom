import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, GraduationCap, AlertCircle, Loader2, ExternalLink, Settings2, CheckCircle, Upload, X, File as FileIcon, HardDrive, HelpCircle, Settings } from 'lucide-react';
import { generateRubricFromGemini } from './services/geminiService';
import { generateClassroomCSV, downloadCSV } from './utils/csvGenerator';
import { RubricData, GenerationStatus } from './types';
import { RubricPreview } from './components/RubricPreview';
import { API_KEY } from './config';

// Default fallback if set in code. 
// Users can also set this via the UI which saves to localStorage.
const DEFAULT_CLIENT_ID = ''; 

// Added drive.file to allow creating files, kept readonly for Picker access to existing files
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/drive.file';

interface AttachedFile {
  name: string;
  mimeType: string;
  data: string; // Base64 string without prefix
}

interface ErrorState {
  title: string;
  message: string;
  suggestion?: string;
}

declare global {
  interface Window {
    google: any;
    gapi: any;
  }
}

const App: React.FC = () => {
  const [assignmentText, setAssignmentText] = useState('');
  const [maxPoints, setMaxPoints] = useState<number>(100);
  const [status, setStatus] = useState<GenerationStatus>(GenerationStatus.IDLE);
  const [rubric, setRubric] = useState<RubricData | null>(null);
  const [error, setError] = useState<ErrorState | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [attachedFile, setAttachedFile] = useState<AttachedFile | null>(null);
  const [driveApiReady, setDriveApiReady] = useState(false);
  const [isSavingToDrive, setIsSavingToDrive] = useState(false);
  
  // Configuration State
  const [googleClientId, setGoogleClientId] = useState<string>(() => {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('google_client_id') || DEFAULT_CLIENT_ID;
    }
    return DEFAULT_CLIENT_ID;
  });
  const [showConfigWarning, setShowConfigWarning] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [tempClientId, setTempClientId] = useState('');

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

  // Initialize Google API
  useEffect(() => {
    const checkGoogle = setInterval(() => {
      if (window.gapi && window.google) {
        clearInterval(checkGoogle);
        window.gapi.load('picker', () => {
          setDriveApiReady(true);
        });
      }
    }, 500);
    return () => clearInterval(checkGoogle);
  }, []);

  const handleSaveClientId = () => {
    const cleaned = tempClientId.trim();
    if (cleaned) {
      setGoogleClientId(cleaned);
      localStorage.setItem('google_client_id', cleaned);
      setTempClientId('');
      setShowSettings(false); // Close settings if open
    }
  };

  const handleGenerate = async () => {
    if (!assignmentText.trim() && !attachedFile) return;

    setStatus(GenerationStatus.GENERATING);
    setError(null);
    
    if (!API_KEY) {
      setError({
        title: "Konfigūracijos klaida",
        message: "Sistemoje nerastas API raktas (API_KEY).",
        suggestion: "Susisiekite su sistemos administratoriumi."
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
        suggestion: "Pabandykite dar kartą arba sutrumpinkite užduoties aprašymą."
      };

      // Identify common Gemini/Network errors
      if (err.message) {
        if (err.message.includes('429') || err.message.toLowerCase().includes('quota')) {
          errorState.title = "Viršytas užklausų limitas";
          errorState.message = "Sistema šiuo metu apkrauta arba viršytas API limitas.";
          errorState.suggestion = "Palaukite minutę ir bandykite dar kartą.";
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
    
    let finalFilename = filename.trim();
    if (!finalFilename) finalFilename = 'rubric.csv';
    if (!finalFilename.toLowerCase().endsWith('.csv')) {
      finalFilename += '.csv';
    }
    
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
        suggestion: "Patikrinkite naršyklės nustatymus arba atlaisvinkite vietos."
      });
    }
  };

  const handleSaveToDrive = (filename: string) => {
    if (!rubric) return;
    
    if (!googleClientId) {
      setError({
        title: "Nėra Client ID",
        message: "Google Drive integracija nesukonfigūruota.",
        suggestion: "Įveskite Client ID nustatymuose (krumpliaratis viršuje) arba šoniniame skydelyje."
      });
      setShowSettings(true); // Open settings to help user
      return;
    }

    if (!driveApiReady) {
      setError({
        title: "Google API kraunasi",
        message: "Google paslaugos dar nėra pilnai užsikrovusios.",
        suggestion: "Palaukite kelias sekundes ir bandykite vėl."
      });
      return;
    }

    if (!window.confirm('Are you sure you want to save to Google Drive?')) {
      return;
    }

    setIsSavingToDrive(true);

    const tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: googleClientId,
      scope: DRIVE_SCOPE,
      callback: async (response: any) => {
        if (response.error !== undefined) {
          setError({
            title: "Autentifikavimo klaida",
            message: "Nepavyko prisijungti prie Google paskyros.",
            suggestion: "Patikrinkite ar Client ID yra teisingas."
          });
          setIsSavingToDrive(false);
          return;
        }
        // Use Picker to select folder
        createFolderPicker(response.access_token, filename);
      },
    });
    tokenClient.requestAccessToken();
  };

  const createFolderPicker = (oauthToken: string, filename: string) => {
    if (!window.google || !window.google.picker) {
        setError({
            title: "Google Picker API Error",
            message: "Google Picker API nepavyko užkrauti.",
        });
        setIsSavingToDrive(false);
        return;
    }

    const docsView = new window.google.picker.DocsView(window.google.picker.ViewId.FOLDERS)
      .setSelectFolderEnabled(true)
      .setMimeTypes('application/vnd.google-apps.folder');

    const picker = new window.google.picker.PickerBuilder()
        .addView(docsView)
        .setOAuthToken(oauthToken)
        .setDeveloperKey(API_KEY)
        .setCallback((data: any) => folderPickerCallback(data, oauthToken, filename))
        .setTitle('Pasirinkite aplanką išsaugojimui')
        .build();
    picker.setVisible(true);
  };

  const folderPickerCallback = async (data: any, oauthToken: string, filename: string) => {
    if (data.action === window.google.picker.Action.PICKED) {
      const doc = data.docs[0];
      const folderId = doc.id;
      await uploadToDrive(oauthToken, folderId, filename);
    } else if (data.action === window.google.picker.Action.CANCEL) {
      setIsSavingToDrive(false);
    }
  };

  const uploadToDrive = async (accessToken: string, folderId: string, filename: string) => {
    if (!rubric) return;
    try {
      let safeFilename = filename.trim();
      if (!safeFilename) safeFilename = 'rubric.csv';
      if (!safeFilename.toLowerCase().endsWith('.csv')) safeFilename += '.csv';

      // Call without title
      const csvContent = generateClassroomCSV(rubric);
      
      const metadata = {
        name: safeFilename,
        mimeType: 'text/csv',
        parents: [folderId]
      };

      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      form.append('file', new Blob([csvContent], { type: 'text/csv' }));

      const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: form,
      });

      if (!res.ok) throw new Error(`Upload failed: ${res.statusText}`);
      
      const result = await res.json();
      setSaveMessage("Sėkmingai išsaugota Google Drive!");
      setTimeout(() => setSaveMessage(null), 3000);

    } catch (e) {
      console.error(e);
      setError({
        title: "Įkėlimo klaida",
        message: "Nepavyko įkelti failo į Google Drive.",
        suggestion: "Patikrinkite interneto ryšį ir bandykite dar kartą."
      });
    } finally {
      setIsSavingToDrive(false);
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

  const processFile = (file: File | undefined) => {
    if (!file) return;

    // Validate types: PDF, Text, or Images
    const validTypes = ['application/pdf', 'text/plain', 'image/png', 'image/jpeg', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setError({
        title: "Netinkamas failo formatas",
        message: `Failas "${file.name}" nėra palaikomas.`,
        suggestion: "Prašome įkelti PDF, TXT arba paveikslėlį (PNG, JPG, WEBP)."
      });
      return;
    }

    const MAX_SIZE_MB = 10;
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setError({
        title: "Failas per didelis",
        message: `Failas viršija ${MAX_SIZE_MB}MB limitą.`,
        suggestion: "Sumažinkite failo dydį arba nukopijuokite tekstą į laukelį."
      });
      return;
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

  // Google Drive Handler for Picker
  const handleDriveClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the parent file input click

    if (!googleClientId) {
      setError({
        title: "Nėra Client ID",
        message: "Google Drive integracija nesukonfigūruota.",
        suggestion: "Įveskite Client ID nustatymuose."
      });
      setShowSettings(true);
      return;
    }

    if (!driveApiReady) {
      setError({
        title: "Google API kraunasi",
        message: "Google paslaugos dar nėra pilnai užsikrovusios.",
        suggestion: "Palaukite kelias sekundes ir bandykite vėl."
      });
      return;
    }

    const tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: googleClientId,
      scope: DRIVE_SCOPE,
      callback: async (response: any) => {
        if (response.error !== undefined) {
          console.error(response);
          setError({
            title: "Prisijungimo klaida",
            message: "Nepavyko prisijungti prie Google Drive.",
            suggestion: "Patikrinkite Client ID ir ar leidote iššokančius langus."
          });
          return;
        }
        createPicker(response.access_token);
      },
    });
    tokenClient.requestAccessToken();
  };

  const createPicker = (oauthToken: string) => {
    if (!window.google || !window.google.picker) return;

    const picker = new window.google.picker.PickerBuilder()
        .addView(window.google.picker.ViewId.DOCS)
        .setOAuthToken(oauthToken)
        .setDeveloperKey(API_KEY)
        .setCallback((data: any) => pickerCallback(data, oauthToken))
        .build();
    picker.setVisible(true);
  };

  const pickerCallback = async (data: any, oauthToken: string) => {
    if (data.action === window.google.picker.Action.PICKED) {
      const doc = data.docs[0];
      const fileId = doc.id;
      const name = doc.name;
      const mimeType = doc.mimeType;
      
      // Determine download URL
      // If Google Doc/Sheet/Slides -> export as PDF
      // If binary file -> download directly
      let url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
      let targetMimeType = mimeType;

      if (mimeType.startsWith('application/vnd.google-apps.')) {
         url = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=application/pdf`;
         targetMimeType = 'application/pdf';
      }

      try {
        setStatus(GenerationStatus.GENERATING); 
        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${oauthToken}` }
        });

        if (!response.ok) {
          throw new Error(`Serveris grąžino klaidą: ${response.status}`);
        }

        const blob = await response.blob();
        
        if (blob.size > 10 * 1024 * 1024) {
          throw new Error("Failas per didelis (Maks 10MB).");
        }

        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          const base64Data = result.split(',')[1];
          
          setAttachedFile({
            name: name,
            mimeType: targetMimeType,
            data: base64Data
          });
          setStatus(GenerationStatus.IDLE);
          setError(null);
        };
        reader.readAsDataURL(blob);

      } catch (err) {
        console.error(err);
        setError({
          title: "Failo atsisiuntimo klaida",
          message: "Nepavyko gauti failo iš Google Drive.",
          suggestion: "Patikrinkite, ar turite teises atsisiųsti šį failą."
        });
        setStatus(GenerationStatus.IDLE);
      }
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
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 text-slate-500 hover:text-blue-600 hover:bg-slate-50 rounded-lg transition-colors relative"
              title="Nustatymai"
            >
              <Settings size={20} />
              {!googleClientId && <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border border-white"></span>}
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
        
        {/* Settings Modal/Panel Overlay */}
        {showSettings && (
          <div className="absolute top-4 right-4 lg:right-auto lg:left-4 z-30 w-80 bg-white shadow-xl rounded-xl border border-slate-200 p-6 animate-in fade-in zoom-in-95 duration-200">
             <div className="flex justify-between items-center mb-4">
               <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                 <Settings2 size={18} /> Nustatymai
               </h3>
               <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-slate-600">
                 <X size={18} />
               </button>
             </div>
             
             <div className="mb-4">
               <label className="block text-xs font-bold text-slate-700 mb-2 uppercase">Google Client ID</label>
               <input
                 type="text"
                 value={tempClientId}
                 onChange={(e) => setTempClientId(e.target.value)}
                 placeholder={googleClientId || "Pvz: 123...apps.googleusercontent.com"}
                 className="w-full text-sm p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none mb-2"
               />
               <p className="text-xs text-slate-500 mb-3">Reikalingas "Save to Drive" ir failų pasirinkimo funkcijoms.</p>
               
               <button 
                 onClick={handleSaveClientId}
                 className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm py-2 rounded-lg font-medium transition-colors"
               >
                 Išsaugoti
               </button>
             </div>
             
             {googleClientId && (
               <div className="p-3 bg-green-50 border border-green-200 rounded text-xs text-green-700 flex gap-2 items-center">
                 <CheckCircle size={14} /> Client ID sukonfigūruotas
               </div>
             )}
          </div>
        )}

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
                  
                  <div className="flex items-center gap-2 w-full max-w-xs">
                    <div className="h-px bg-slate-200 flex-1"></div>
                    <span className="text-xs text-slate-400 uppercase font-medium">arba</span>
                    <div className="h-px bg-slate-200 flex-1"></div>
                  </div>

                  <button
                    onClick={handleDriveClick}
                    className="mt-4 flex items-center gap-2 bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 hover:border-slate-400 transition-all shadow-sm z-10"
                  >
                    <HardDrive size={16} className="text-slate-500" />
                    Google Drive
                  </button>
                  
                  <p className="text-xs text-slate-400 mt-4">Palaikoma: PDF, TXT, Paveikslėliai</p>
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
                    <p className="text-red-600 text-xs bg-red-100/50 p-2 rounded flex items-center gap-1.5">
                      <HelpCircle size={12} />
                      {error.suggestion}
                    </p>
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

          {!googleClientId && showConfigWarning && (
            <div className="relative bg-amber-50 rounded-xl border border-amber-200 p-6 transition-all">
              <button 
                onClick={() => setShowConfigWarning(false)}
                className="absolute top-2 right-2 p-1 text-amber-500 hover:bg-amber-100 rounded-full transition-colors"
                title="Uždaryti"
              >
                <X size={16} />
              </button>
              <h3 className="text-amber-900 font-semibold mb-3 text-sm flex items-center gap-2">
                <AlertCircle size={16} />
                Konfigūracija
              </h3>
              <p className="text-sm text-amber-800 mb-3 leading-relaxed">
                Norėdami naudotis Google Drive funkcija, turite įvesti <strong>Client ID</strong>.
              </p>
              
              <div className="flex flex-col gap-2">
                 <input
                    type="text"
                    value={tempClientId}
                    onChange={(e) => setTempClientId(e.target.value)}
                    placeholder="Įklijuokite Client ID čia..."
                    className="w-full text-sm p-2 rounded border border-amber-300 bg-white text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                 />
                 <button 
                    onClick={handleSaveClientId}
                    className="bg-amber-600 hover:bg-amber-700 text-white text-sm py-1.5 px-3 rounded font-medium transition-colors self-start"
                 >
                    Išsaugoti ID
                 </button>
              </div>

              <ul className="mt-3 space-y-1 text-xs text-amber-800">
                <li>• Client ID rasite Google Cloud Console.</li>
                <li>• Jis atrodo taip: <code>123...apps.googleusercontent.com</code></li>
              </ul>
            </div>
          )}
        </div>

        {/* Output Column */}
        <div className="lg:col-span-7 h-[600px] lg:h-auto flex flex-col">
           <RubricPreview 
             rubric={rubric} 
             onDownload={handleDownload} 
             onSave={handleSave}
             onSaveToDrive={handleSaveToDrive}
             isSavingToDrive={isSavingToDrive}
             onRubricChange={handleRubricChange} 
           />
        </div>
      </main>
    </div>
  );
};

export default App;
