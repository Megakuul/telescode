export const listAction = 'list';

export interface listInput {
  search: string;
}

export interface listOutput {
  command: string;
  matches: rgMatch[];
}

export const previewAction = 'preview';

export interface previewInput {
  file: string;
}

export interface previewOutput {
  code: string;
  theme: string;
}

export const selectAction = 'select';

export interface selectInput {
  file: string;
  line: number;
  column: number;
}

export type rgArbitary = { text: string };

export interface rgMatch {
  type: 'match';
  data: {
    path: rgArbitary;
    lines: rgArbitary;
    line_number: number | null;
    absolute_offset: number;
    submatches: Array<{
      match: rgArbitary;
      start: number;
      end: number;
    }>;
  };
}
