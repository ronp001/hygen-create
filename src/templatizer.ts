import * as _ from 'lodash'
import * as inflection from 'inflection'

import {AbsPath} from './path_helper'

export interface ReplacementInfo {
    linenum: number
    old_text: string
    new_text: string
}

export class TemplateInfo {
    public is_binary : boolean

    constructor(public relpath: string, public abspath: AbsPath, public using_name: string, public gen_parent_dir: boolean) {
        this.is_binary = abspath.isBinaryFile
    }

    public get template_filename() : string {
        return Templatizer.template_filename(this.relpath)
    }

    public get target_filename() : string {
        return this.getProcessedText(this.relpath) || this.relpath
    }

    public get header() : string {

        let target_path_line : string

        if ( this.gen_parent_dir ) {
            target_path_line = `to: <%= name %>/` + this.target_filename + "\n"
        } else {
            target_path_line = `to: ${this.target_filename}\n`
        }
        
        let header = ""
        + "---\n"
        + target_path_line
        + "---\n"
        
        return header
    }

    public get numReplacementLines() { 
        return this._replacements.length 
    }
    public get replacements() { 
        return this._replacements 
    }
    public get contentsAfterReplacements() : string {
        return this._lines_after_replacements.join('\n')
    }

    private _replacements: Array<ReplacementInfo> = []
    private _lines : Array<string> = []
    private _lines_after_replacements : Array<string> = []

    public process() {
        if ( this.is_binary ) {
            return
        }
        
        this._lines = this.abspath.contentsBuffer.toString().split('\n')

        let num = 0
        for ( let line of this._lines ) {
            num++
            let line_replacements = this.processLine(line, num)
            if ( line_replacements ) {
                this._replacements.push(line_replacements)
                this._lines_after_replacements.push(line_replacements.new_text)
            } else {
                this._lines_after_replacements.push(line)
            }
        }
    }

    public replacer(to_word:string) {
        return (match:string, p1_pfx:string, p2_words:string, 
//                    p2a_exact:string,
                    p2b_uppercased:string, 
                    p2b_lowercased:string, 
                    p2b_capitalized:string, 
                    p2b_camelized:string, 
                    p2b_camelized_lf:string, 
                    p2b_underscored:string, 
                    p2b_underscored_up:string, 
                    p2b_dasherized:string, 
                    p2b_titlized:string, 
                offset:number, whole_string:string) => {
            let result : string 

            /*if ( p2a_exact ) {
                result = to_word
            } else */ if ( p2b_uppercased ) {
                result = `${to_word}.toUpperCase()`
            } else if ( p2b_lowercased ) {
                result = `${to_word}.toLowerCase()`
            } else if ( p2b_capitalized ) {
                result = `h.capitalize(${to_word})`
            } else if ( p2b_camelized ) {
                result = `h.inflection.camelize(${to_word}, false)`
            } else if ( p2b_camelized_lf ) {
                result = `h.inflection.camelize(${to_word}, true)`
            } else if ( p2b_underscored ) {
                result = `h.inflection.underscore(${to_word}, false)`
            } else if ( p2b_underscored_up ) {
                result = `h.inflection.underscore(${to_word}, false).toUpperCase()`
            } else if ( p2b_dasherized ) {
                result = `h.inflection.transform(${to_word}, ['underscore','dasherize'])`
            } else if ( p2b_titlized ) {
                result = `h.inflection.titlize(${to_word})`
            } else {
                result = "?"
            }
            return `${p1_pfx}<%= ${result} %>`
        }
    }

    public get regex() {
        let from_word = this.using_name
 
        let uppercased = from_word.toUpperCase()
        let lowercased = from_word.toLowerCase()
        let capitalized = inflection.capitalize(from_word)
        let camelized = inflection.camelize(from_word, false)
        let camelized_lf = inflection.camelize(from_word, true)
        let underscored = inflection.underscore(from_word, false)
        let underscored_up = inflection.underscore(from_word, false).toUpperCase()
        let dasherized = inflection.transform(from_word, ['underscore','dasherize'])
        let titlized = inflection.titleize(from_word)

        let combined = ""
//                    +  `(${from_word})`
                    +  `(${uppercased})`
                    +  `|(${lowercased})`
                    +  `|(${capitalized})`
                    +  `|(${camelized})`
                    +  `|(${camelized_lf})`
                    +  `|(${underscored})`
                    +  `|(${underscored_up})`
                    +  `|(${dasherized})`
                    +  `|(${titlized})`

        return new RegExp(`(^|[^a-zA-Z0-9])(${combined})`,'g')
    }

    public getProcessedText(text:string) : string | null {
        let from_word = this.using_name
        let to_word = 'name'
        let regex = this.regex
        
        if ( text.search(regex) == -1 && text.search('<%') == -1 ) return null
        
        return text.replace(/<%/g,'<%%').replace(regex, this.replacer(to_word))
    }

    public processLine(line:string, num:number) : ReplacementInfo | null 
    {
        let new_text = this.getProcessedText(line)
        if ( new_text == null ) return null

        let result : ReplacementInfo = {
            linenum : num,
            old_text : line,
            new_text : new_text
        }
        return result
    }
}

export class Templatizer {
    public static process(relpath: string, abspath:AbsPath, from_name: string, gen_parent_dir: boolean) : TemplateInfo {
        let result = new TemplateInfo(relpath, abspath, from_name, gen_parent_dir)
        result.process()

        return result
    }

    public static template_filename(relpath: string) {
        return relpath.replace(/\//g,'_') + ".ejs.t"
    }
}