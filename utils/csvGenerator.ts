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
 * Row B: Criterion Description (Optional/If present)
 * Row C: Points (Cells B, C, D...)
 * Row D: Level Title (Cells B, C, D...)
 * Row E: Level Description (Cells B, C, D...)
 */
export const generateClassroomCSV = (rubric: RubricData): string => {
  const rows: string[][] = [];

  // Headers required for Spreadsheet import format
  rows.push(['Rekomenduojama neredaguoti rubrikų skaičiuoklės formatu']);
  rows.push(['v1.0-s']);
  // We don't have the exact assignment title in RubricData, using a generic one
  rows.push(['Vertinimo kriterijai']); 

  rubric.criteria.forEach((criterion) => {
    // Sort levels by points descending
    const sortedLevels = [...criterion.levels].sort((a, b) => b.points - a.points);

    // Criterion Title
    rows.push([criterion.title]);

    // Criterion Description
    // Based on the user's image, if description is empty, the row seems to be omitted.
    if (criterion.description && criterion.description.trim()) {
      rows.push([criterion.description]);
    }

    // Points (shifted by 1 column to right)
    const pointsRow = [''];
    sortedLevels.forEach(l => pointsRow.push(l.points.toString()));
    rows.push(pointsRow);

    // Level Title (shifted by 1 column to right)
    const titleRow = [''];
    sortedLevels.forEach(l => titleRow.push(l.title));
    rows.push(titleRow);

    // Level Description (shifted by 1 column to right)
    const descRow = [''];
    sortedLevels.forEach(l => descRow.push(l.description || ''));
    rows.push(descRow);
  });

  // Convert to CSV string
  return rows.map(row => 
    row.map(cell => {
      // Escape double quotes by doubling them
      const escaped = cell.replace(/"/g, '""');
      // Always wrap in quotes to ensure structure is preserved and CSV readers handle newlines correctly
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