export interface RubricLevel {
  title: string;
  points: number;
  description: string;
}

export interface RubricCriterion {
  title: string;
  description: string;
  levels: RubricLevel[];
}

export interface RubricData {
  criteria: RubricCriterion[];
}

export enum GenerationStatus {
  IDLE = 'IDLE',
  GENERATING = 'GENERATING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR'
}