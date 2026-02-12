import { ChildProcessWithoutNullStreams, spawn } from 'node:child_process';
import { match } from './types.js';

type rgArbitary = { text: string };

interface rgMatch {
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

export class Grep {
  private buffer: string = '';
  private matches: match[] = [];

  constructor(
    private search: string,
    private path: string,
    private regex: boolean = false,
    private binary: string = 'rg',
    private maxMatches: number = 20,
  ) {}

  start(): ChildProcessWithoutNullStreams {
    return spawn(
      this.binary,
      [
        '--json',
        '--no-messages',
        '--smart-case',
        '--max-filesize=1M',
        '-m=5',
        this.regex ? '' : '-F',
        '--',
        this.search,
        '.',
      ].filter(v => v),
      {
        cwd: this.path,
      },
    );
  }

  process(input: string): boolean {
    this.buffer += input;
    const lines: string[] = input.split('\n');
    if (lines.length < 2) {
      return true;
    }
    if (this.matches.length > this.maxMatches) {
      return false;
    }

    this.buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.trim()) continue;
      const parsedEntry: rgMatch = JSON.parse(line);
      if (parsedEntry.type === 'match')
        this.matches.push({
          path: parsedEntry.data.path.text,
          line: parsedEntry.data.line_number ?? 0,
          col: parsedEntry.data?.submatches[0]?.start ?? 0,
        });
    }
    return true;
  }

  results(): match[] {
    return this.matches;
  }
}
