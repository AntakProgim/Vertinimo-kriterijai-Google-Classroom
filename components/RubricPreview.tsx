import React, { useState, useRef, useEffect } from 'react';
import { RubricData, RubricCriterion, RubricLevel } from '../types';
import { Download, Table, Calculator, Save, FileType } from 'lucide-react';

interface AutoResizeTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  value: string;
}

const AutoResizeTextarea: React.FC<AutoResizeTextareaProps> = ({ value, className = '', ...props }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  };

  useEffect(() => {
    adjustHeight();
  }, [value]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      adjustHeight();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <textarea
      ref={textareaRef}
      value={value}
      rows={1}
      onInput={adjustHeight}
      className={`resize-none overflow-hidden ${className}`}
      {...props}
    />
  );
};

interface RubricPreviewProps {
  rubric: RubricData | null;
  onDownload: (filename: string) => void;
  onSave: () => void;
  onRubricChange: (rubric: RubricData) => void;
}

export const RubricPreview: React.FC<RubricPreviewProps> = ({
  rubric,
  onDownload,
  onSave,
  onRubricChange
}) => {
  const [filename, setFilename] = useState('rubric.csv');

  if (!rubric || rubric.criteria.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-slate-400 bg-white rounded-xl border border-slate-200 p-12 min-h-[400px]">
        <Table size={48} className="mb-4 opacity-20" />
        <p className="text-lg font-medium text-center">Vertinimo kriterijai dar nesugeneruoti</p>
        <p className="text-sm text-center">Įveskite užduoties aprašymą, kad sukurtumėte lentelę.</p>
      </div>
    );
  }

  const totalPoints = rubric.criteria.reduce((sum, criterion) => {
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
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col">
      <div className="p-4 border-b border-slate-200 flex flex-col xl:flex-row justify-between items-start xl:items-center bg-slate-50 gap-4 rounded-t-xl">
        <div className="min-w-0">
          <h2 className="font-semibold text-slate-800 flex flex-wrap items-center gap-2">
            Peržiūra <span className="text-xs font-normal text-slate-400">(galite redaguoti tekstus)</span>
          </h2>
          <div className="flex flex-wrap items-center gap-3 mt-1">
            <span className="text-xs text-slate-500 flex items-center gap-1">
              {rubric.criteria.length} Kriterijai
            </span>
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
              <Calculator size={10} />
              Iš viso: {totalPoints} balų
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto">
          <button
            onClick={onSave}
            className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 px-3 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm"
            title="Išsaugoti naršyklėje"
          >
            <Save size={16} />
            <span>Išsaugoti</span>
          </button>

          <div className="hidden sm:block h-6 w-px bg-slate-300 mx-1"></div>

          <div className="flex items-center flex-1 sm:flex-initial">
            <div className="relative flex items-center group flex-1 sm:flex-initial">
              <FileType size={14} className="absolute left-2.5 text-slate-400 group-focus-within:text-blue-500 pointer-events-none" />
              <input
                type="text"
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                onBlur={handleBlur}
                className="w-full sm:w-44 pl-8 pr-2 py-2 bg-white border border-slate-300 rounded-l-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 hover:border-slate-400 transition-colors text-slate-700"
                placeholder="rubric.csv"
              />
            </div>

            <button
              onClick={() => onDownload(filename)}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-r-lg text-sm font-medium transition-colors shadow-sm border border-green-600 whitespace-nowrap"
            >
              <Download size={16} />
              <span>Atsisiųsti</span>
            </button>
          </div>
        </div>
      </div>

      <div className="w-full p-4 sm:p-6 space-y-6">
        {rubric.criteria.map((criterion, cIdx) => {
          const maxCriterionPoints = criterion.levels.length > 0
            ? Math.max(...criterion.levels.map(l => l.points))
            : 0;

          return (
            <div key={cIdx} className="border rounded-lg border-slate-200 overflow-hidden shadow-sm">
              <div className="bg-slate-100 p-3 sm:p-4 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start gap-2 sm:gap-4">
                <div className="flex-1 w-full min-w-0">
                  <AutoResizeTextarea
                    value={criterion.title}
                    onChange={(e) => handleCriterionChange(cIdx, 'title', e.target.value)}
                    className="w-full bg-transparent border border-transparent hover:border-slate-300 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded px-2 py-1 font-bold text-slate-800 text-base sm:text-lg leading-snug transition-all mb-1"
                    placeholder="Kriterijaus pavadinimas"
                  />
                  <AutoResizeTextarea
                    value={criterion.description || ''}
                    onChange={(e) => handleCriterionChange(cIdx, 'description', e.target.value)}
                    className="w-full bg-transparent border border-transparent hover:border-slate-300 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded px-2 py-1 text-slate-600 text-sm leading-relaxed"
                    placeholder="Kriterijaus aprašymas"
                  />
                </div>
                <div className="text-xs font-mono bg-slate-200 text-slate-700 px-2.5 py-1 rounded self-start whitespace-nowrap sm:mt-1">
                  Maks: {maxCriterionPoints} tšk.
                </div>
              </div>
              <div className="divide-y divide-slate-100">
                {criterion.levels.map((level, lIdx) => (
                  <div key={lIdx} className="p-3 sm:p-4 flex flex-col sm:flex-row gap-2 sm:gap-4 items-start hover:bg-slate-50 transition-colors">
                    <div className="flex sm:flex-col items-center gap-2 sm:gap-0 flex-shrink-0 sm:w-20 text-center">
                      <input
                        type="number"
                        value={level.points}
                        onChange={(e) => handleLevelChange(cIdx, lIdx, 'points', parseFloat(e.target.value) || 0)}
                        className="w-16 sm:w-full text-center bg-transparent border border-transparent hover:border-slate-300 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded px-1 py-0.5 text-xl sm:text-2xl font-bold text-blue-600 transition-all"
                      />
                      <span className="text-xs text-slate-500 font-medium uppercase tracking-wide">Balai</span>
                    </div>
                    <div className="flex-1 w-full min-w-0">
                      <AutoResizeTextarea
                        value={level.title}
                        onChange={(e) => handleLevelChange(cIdx, lIdx, 'title', e.target.value)}
                        className="w-full bg-transparent border border-transparent hover:border-slate-300 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded px-2 py-1 font-semibold text-slate-900 leading-snug mb-1 transition-all"
                        placeholder="Lygio pavadinimas"
                      />
                      <AutoResizeTextarea
                        value={level.description}
                        onChange={(e) => handleLevelChange(cIdx, lIdx, 'description', e.target.value)}
                        className="w-full bg-transparent border border-transparent hover:border-slate-300 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded px-2 py-1 text-slate-600 text-sm leading-relaxed"
                        placeholder="Lygio aprašymas"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};