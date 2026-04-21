declare module 'papaparse' {
  export interface ParseError {
    message: string;
  }

  export interface ParseMeta {
    delimiter?: string;
  }

  export interface ParseResult<T> {
    data: T[];
    errors: ParseError[];
    meta: ParseMeta;
  }

  export interface ParseStepResult<T> {
    data: T;
    errors: ParseError[];
    meta: ParseMeta;
  }

  export interface Parser {
    abort(): void;
  }

  export interface ParseConfig {
    delimiter?: string;
    preview?: number;
    skipEmptyLines?: boolean | 'greedy';
    step?(result: ParseStepResult<unknown>, parser: Parser): void;
    complete?(result: ParseResult<unknown>): void;
  }

  export interface PapaStatic {
    parse<T>(input: string, config?: ParseConfig): ParseResult<T>;
  }

  const Papa: PapaStatic;
  export default Papa;
}
