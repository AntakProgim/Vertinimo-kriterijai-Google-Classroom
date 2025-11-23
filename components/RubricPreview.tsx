import React, { useState } from 'react';
import { RubricData, RubricCriterion, RubricLevel } from '../types';
import { Download, Table, Calculator, Save, HardDrive, Loader2, FileType } from 'lucide-react';

interface RubricPreviewProps {
  rubric: RubricData | null;
  onDownload: (filename: string) => void;
  onSave: () => void;
  onSaveToDrive: (filename: string) => void;
  isSavingToDrive?: boolean;
  driveStatusMessage?: string;
  onRubricChange: (rubric: RubricData) => void;
}

export const RubricPreview: React.FC<RubricPreviewProps> = ({ 
  rubric, 
  onDownload, 
  onSave, 
  onSaveToDrive,
  isSavingToDrive = false,
  driveStatusMessage,
  onRubricChange 
}) => {
  const [filename, setFilename] = useState('rubric.csv');

  if (!rubric || rubric.criteria.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-slate-400 bg-white rounded-xl border border-slate-200 p-12 min-h-[400px]">
        <Table size={48} className="mb-4 opacity-20" />
        <p className="text-lg font-medium">Vertinimo kriterijai dar nesugeneruoti</p>
        <p className="text-sm">Įveskite užduoties aprašymą, kad sukurtumėte lentelę.</p>
      </div>
    );
  }

  // Calculate total max points
  const totalPoints = rubric.criteria.reduce((sum, criterion) => {
    // Find the highest point value in this criterion's levels
    const maxLevelPoints = criterion.levels.length > 0 
      ? Math.max(...criterion.levels.map(l => l.points)) 
      : 0;
    return sum + maxLevelPoints;
  }, 0);

  const handleCriterionChange = (index: number, field: keyof RubricCriterion, value: string) => {
    const newCriteria = [...rubric.criteria];
    newCriteria[index] = { ...newCriteria[index], [field]: value };
    onRubricChange({ ...rubric, criteria: newCriteria });
  };

  const handleLevelChange = (cIndex: number, lIndex: number, field: keyof RubricLevel, value: string | number) => {
    const newCriteria = [...rubric.criteria];
    const newLevels = [...newCriteria[cIndex].levels];
    newLevels[lIndex] = { ...newLevels[lIndex], [field]: value };
    newCriteria[cIndex] = { ...newCriteria[cIndex], levels: newLevels };
    onRubricChange({ ...rubric, criteria: newCriteria });
  };

  const handleBlur = () => {
    if (!filename.trim()) {
      setFilename('rubric.csv');
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col h-full overflow-hidden">
      <div className="p-4 border-b border-slate-200 flex flex-col xl:flex-row justify-between items-start xl:items-center bg-slate-50 gap-4">
        <div>
          <h2 className="font-semibold text-slate-800 flex items-center gap-2">
            Peržiūra <span className="text-xs font-normal text-slate-400">(galite redaguoti tekstus)</span>
          </h2>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-xs text-slate-500 flex items-center gap-1">
               {rubric.criteria.length} Kriterijai
            </span>
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
               <Calculator size={10} />
               Iš viso: {totalPoints} balų
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onSave}
            className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 px-3 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm"
            title="Išsaugoti naršyklėje"
          >
            <Save size={16} />
            <span className="hidden lg:inline">Išsaugoti</span>
          </button>
          
          <button
            onClick={() => onSaveToDrive(filename)}
            disabled={isSavingToDrive}
            className="flex items-center gap-2 bg-white hover:bg-blue-50 text-blue-700 border border-blue-200 px-3 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm disabled:opacity-75 disabled:cursor-not-allowed"
            title="Įkelti į Google Drive"
          >
            {isSavingToDrive ? <Loader2 size={16} className="animate-spin" /> : <HardDrive size={16} />}
            <span className="hidden lg:inline">
               {isSavingToDrive && driveStatusMessage ? driveStatusMessage : 'Į Drive'}
            </span>
          </button>

          <div className="h-6 w-px bg-slate-300 mx-1"></div>

          <div className="relative flex items-center group">
             <FileType size={14} className="absolute left-2.5 text-slate-400 group-focus-within:text-blue-500 pointer-events-none" />
             <input
                type="text"
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                onBlur={handleBlur}
                className="w-48 pl-8 pr-2 py-2 bg-white border border-slate-300 rounded-l-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 hover:border-slate-400 transition-colors text-slate-700"
                placeholder="rubric.csv"
             />
          </div>

          <button
            onClick={() => onDownload(filename)}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-r-lg text-sm font-medium transition-colors shadow-sm -ml-2 z-10 border border-green-600"
          >
            <Download size={16} />
            <span className="hidden sm:inline">Atsisiųsti</span>
          </button>
        </div>
      </div>

      <div className="overflow-x-auto overflow-y-auto flex-1 p-0 custom-scrollbar">
        <div className="min-w-[800px] p-6">
          {rubric.criteria.map((criterion, cIdx) => (
            <div key={cIdx} className="mb-8 last:mb-0 border rounded-lg border-slate-200 overflow-hidden shadow-sm group/criterion">
              <div className="bg-slate-100 p-3 border-b border-slate-200 flex justify-between items-start gap-4">
                <div className="flex-1">
                  <input
                    type="text"
                    value={criterion.title}
                    onChange={(e) => handleCriterionChange(cIdx, 'title', e.target.value)}
                    className="w-full bg-transparent border border-transparent hover:border-slate-300 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded px-2 py-1 font-bold text-slate-800 text-lg transition-all mb-1"
                    placeholder="Kriterijaus pavadinimas"
                  />
                  <textarea
                    value={criterion.description}
                    onChange={(e) => handleCriterionChange(cIdx, 'description', e.target.value)}
                    className="w-full bg-transparent border border-transparent hover:border-slate-300 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded px-2 py-1 text-slate-600 text-sm resize-none overflow-hidden"
                    placeholder="Kriterijaus aprašymas"
                    rows={1}
                    style={{ minHeight: '2rem' }}
                    onInput={(e) => {
                        const target = e.target as HTMLTextAreaElement;
                        target.style.height = 'auto';
                        target.style.height = target.scrollHeight + 'px';
                    }}
                  />
                </div>
                <div className="text-xs font-mono bg-slate-200 text-slate-600 px-2 py-1 rounded self-start whitespace-nowrap mt-2">
                  Maks: {Math.max(...criterion.levels.map(l => l.points))} tšk.
                </div>
              </div>
              <div className="grid grid-cols-1 divide-y divide-slate-100">
                {criterion.levels.map((level, lIdx) => (
                  <div key={lIdx} className="p-4 flex flex-row gap-4 items-start hover:bg-slate-50 transition-colors group/level">
                    <div className="flex-shrink-0 w-24 text-center">
                      <input
                        type="number"
                        value={level.points}
                        onChange={(e) => handleLevelChange(cIdx, lIdx, 'points', parseFloat(e.target.value) || 0)}
                        className="block w-full text-center bg-transparent border border-transparent hover:border-slate-300 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded px-1 py-0.5 text-2xl font-bold text-blue-600 transition-all"
                      />
                      <span className="text-xs text-slate-500 font-medium uppercase tracking-wide">Balai</span>
                    </div>
                    <div className="flex-1">
                      <input
                        type="text"
                        value={level.title}
                        onChange={(e) => handleLevelChange(cIdx, lIdx, 'title', e.target.value)}
                        className="w-full bg-transparent border border-transparent hover:border-slate-300 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded px-2 py-1 font-semibold text-slate-900 mb-1 transition-all"
                        placeholder="Lygio pavadinimas"
                      />
                      <textarea
                        value={level.description}
                        onChange={(e) => handleLevelChange(cIdx, lIdx, 'description', e.target.value)}
                        className="w-full bg-transparent border border-transparent hover:border-slate-300 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded px-2 py-1 text-slate-600 text-sm leading-relaxed resize-none overflow-hidden"
                        placeholder="Lygio aprašymas"
                        rows={2}
                        onInput={(e) => {
                            const target = e.target as HTMLTextAreaElement;
                            target.style.height = 'auto';
                            target.style.height = target.scrollHeight + 'px';
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};