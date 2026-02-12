import { ChildProcessWithoutNullStreams, spawn } from 'node:child_process';
import { match } from './types.js';

export class Find {
  private buffer: string = '';
  private matches: match[] = [];

  constructor(
    private search: string,
    private path: string,
    private global: boolean = false,
    private binary: string = 'fd',
    private maxMatches: number = 20,
  ) {}

  start(): ChildProcessWithoutNullStreams {
    return spawn(
      this.binary,
      [
        '-i',
        '-t=f',
        '-p',
        this.global ? '--search-path=/' : '--search-path=.',
        '-F',
        '--',
        this.search,
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
      this.matches.push({
        path: line,
        line: 0,
        col: 0,
      });
    }
    return true;
  }

  results(): match[] {
    return this.matches;
  }
}
