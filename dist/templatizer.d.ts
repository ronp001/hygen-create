import { AbsPath } from './path_helper';
export interface ReplacementInfo {
    linenum: number;
    old_text: string;
    new_text: string;
}
export declare class TemplateInfo {
    relpath: string;
    abspath: AbsPath;
    using_name: string;
    constructor(relpath: string, abspath: AbsPath, using_name: string);
    readonly template_filename: string;
    readonly target_filename: string;
    readonly header: string;
    readonly numReplacementLines: number;
    readonly replacements: ReplacementInfo[];
    readonly contentsAfterReplacements: string;
    private _replacements;
    private _lines;
    private _lines_after_replacements;
    process(): void;
    replacer(to_word: string): (match: string, p1_pfx: string, p2_words: string, p2a_lower: string, p2b_upper: string, offset: number, whole_string: string) => string;
    readonly regex: RegExp;
    getProcessedText(text: string): string | null;
    processLine(line: string, num: number): ReplacementInfo | null;
}
export declare class Templatizer {
    static process(relpath: string, abspath: AbsPath, from_name: string): TemplateInfo;
    static template_filename(relpath: string): string;
}
