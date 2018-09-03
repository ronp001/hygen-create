import { AbsPath } from "@ronp001/ts-utils";
export interface ReplacementInfo {
    linenum: number;
    old_text: string;
    new_text: string;
}
export declare class TemplateInfo {
    relpath: string;
    abspath: AbsPath;
    using_name: string;
    gen_parent_dir: boolean;
    is_binary: boolean;
    constructor(relpath: string, abspath: AbsPath, using_name: string, gen_parent_dir: boolean);
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
    replacer(to_word: string): (match: string, p1_pfx: string, p2_words: string, p2b_uppercased: string, p2b_lowercased: string, p2b_capitalized: string, p2b_camelized: string, p2b_camelized_lf: string, p2b_underscored: string, p2b_underscored_up: string, p2b_dasherized: string, p2b_titlized: string, offset: number, whole_string: string) => string;
    readonly regex: RegExp;
    getProcessedText(text: string): string | null;
    processLine(line: string, num: number): ReplacementInfo | null;
}
export declare class Templatizer {
    static process(relpath: string, abspath: AbsPath, from_name: string, gen_parent_dir: boolean): TemplateInfo;
    static template_filename(relpath: string): string;
}
