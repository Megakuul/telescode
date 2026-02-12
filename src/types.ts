export interface match {
  path: string;
  line: number;
  col: number;
}

export type listType = 'match' | 'regex' | 'file' | 'global';

export const listAction = 'list';

export interface listInput {
  mode: listType;
  search: string;
}

export interface listOutput {
  command: string;
  matches: match[];
}

export const previewAction = 'preview';

export interface previewInput {
  file: string;
}

export interface previewOutput {
  code: string;
}

export const selectAction = 'select';

export interface selectInput {
  file: string;
  line: number;
  column: number;
}
