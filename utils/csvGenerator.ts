import { RubricData } from '../types';

export const validateRubric = (rubric: RubricData | null): string | null => {
  if (!rubric || !rubric.criteria || rubric.criteria.length === 0) {
    return "Lentelėje nėra kriterijų.";
  }
  
  for (let i = 0; i < rubric.criteria.length; i++) {
    const criterion = rubric.criteria[i];
    if (!criterion.title || !criterion.title.trim()) {
      return `Kriterijus #${i + 1} neturi pavadinimo.`;
    }
    
    if (!criterion.levels || criterion.levels.length === 0) {
      return `Kriterijus "${criterion.title}" neturi lygių.`;
    }
    
    for (let j = 0; j < criterion.levels.length; j++) {
      const level = criterion.levels[j];
      if (level.points === undefined || level.points === null || isNaN(level.points)) {
        return `Kriterijuje "${criterion.title}" lygis #${j + 1} turi netinkamą balų skaičių.`;
      }
    }
  }

  return null;
};

/**
 * Converts rubric data to a CSV string format compatible with Google Classroom (Spreadsheet style).
 * 
 * Structure based on Google Classroom export format (v1.0-s):
 * Row 1: Warning header
 * Row 2: Version
 * Row 3+: Criterion blocks (No global assignment title row in v1.0-s)
 * 
 * For each criterion:
 * Row A: Criterion Title
 * Row B: Criterion Description (Always present, even if empty)
 * Row C: Points (Cells B, C, D...)
 * Row D: Level Title (Cells B, C, D...)
 * Row E: Level Description (Cells B, C, D...)
 */
export const generateClassroomCSV = (rubric: RubricData): string => {
  const rows: string[][] = [];

  // Headers required for Spreadsheet import format
  // v1.0-s does NOT use a separate assignment title row between version and first criterion
  rows.push(['Rekomenduojama neredaguoti rubrikų skaičiuoklės formatu']);
  rows.push(['v1.0-s']);

  rubric.criteria.forEach((criterion) => {
    // Sort levels by points descending
    const sortedLevels = [...criterion.levels].sort((a, b) => b.points - a.points);

    // Row 1: Criterion Title
    // Ensure title is present, defaulting to empty string if missing, to preserve row structure
    rows.push([criterion.title || '']);

    // Row 2: Criterion Description (MUST exist to preserve block structure)
    rows.push([criterion.description || '']);

    // Row 3: Points (shifted by 1 column to right)
    const pointsRow = [''];
    sortedLevels.forEach(l => pointsRow.push(l.points.toString()));
    rows.push(pointsRow);

    // Row 4: Level Title (shifted by 1 column to right)
    const titleRow = [''];
    sortedLevels.forEach(l => titleRow.push(l.title || ''));
    rows.push(titleRow);

    // Row 5: Level Description (shifted by 1 column to right)
    const descRow = [''];
    sortedLevels.forEach(l => descRow.push(l.description || ''));
    rows.push(descRow);
  });

  // Convert to CSV string
  return rows.map(row => 
    row.map(cell => {
      // Ensure cell is string and escape double quotes
      const cellStr = cell || '';
      const escaped = cellStr.replace(/"/g, '""');
      // Always wrap in quotes to ensure structure is preserved
      return `"${escaped}"`;
    }).join(',')
  ).join('\n');
};

export const downloadCSV = (csvContent: string, filename: string = 'rubric.csv') => {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};