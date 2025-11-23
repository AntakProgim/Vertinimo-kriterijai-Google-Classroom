import { RubricData } from '../types';

/**
 * Converts rubric data to a CSV string format compatible with Google Classroom (Spreadsheet style).
 * 
 * Structure based on Google Classroom export format:
 * Row 1: Warning header
 * Row 2: Version
 * Row 3: Assignment Title
 * 
 * For each criterion:
 * Row A: Criterion Title
 * Row B: Criterion Description (Always present, even if empty)
 * Row C: Points (Cells B, C, D...)
 * Row D: Level Title (Cells B, C, D...)
 * Row E: Level Description (Cells B, C, D...)
 */
export const generateClassroomCSV = (rubric: RubricData, title: string = 'Vertinimo kriterijai'): string => {
  const rows: string[][] = [];

  // Headers required for Spreadsheet import format
  // These headers help Classroom identify the file structure
  rows.push(['Rekomenduojama neredaguoti rubrikų skaičiuoklės formatu']);
  rows.push(['v1.0-s']);
  rows.push([title]); 

  rubric.criteria.forEach((criterion) => {
    // Sort levels by points descending
    const sortedLevels = [...criterion.levels].sort((a, b) => b.points - a.points);

    // Row 1: Criterion Title
    rows.push([criterion.title]);

    // Row 2: Criterion Description (MUST exist to preserve block structure)
    rows.push([criterion.description || '']);

    // Row 3: Points (shifted by 1 column to right)
    const pointsRow = [''];
    sortedLevels.forEach(l => pointsRow.push(l.points.toString()));
    rows.push(pointsRow);

    // Row 4: Level Title (shifted by 1 column to right)
    const titleRow = [''];
    sortedLevels.forEach(l => titleRow.push(l.title));
    rows.push(titleRow);

    // Row 5: Level Description (shifted by 1 column to right)
    const descRow = [''];
    sortedLevels.forEach(l => descRow.push(l.description || ''));
    rows.push(descRow);
  });

  // Convert to CSV string
  return rows.map(row => 
    row.map(cell => {
      // Escape double quotes by doubling them
      const escaped = cell.replace(/"/g, '""');
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