import * as _ from 'lodash'
import {AbsPath} from './path_helper'

export interface ReplacementInfo {
    linenum: number
    old_text: string
    new_text: string
}

export class TemplateInfo {
    constructor(public relpath: string, public abspath: AbsPath, public using_name: string) {}

    public get template_filename() : string {
        return Templatizer.template_filename(this.relpath)
    }

    public get target_filename() : string {
        return this.getProcessedText(this.relpath) || this.relpath
    }

    public get header() : string {
        let header = ""
        + "---\n"
        + `to: <%= name %>/${this.target_filename}\n`
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
        return (match:string, p1_pfx:string, p2_words:string, p2a_lower:string, p2b_upper:string, offset:number, whole_string:string) => {
            let result : string 

            if ( p2a_lower ) {
                result = to_word
            } else if ( p2b_upper ) {
                result = `h.capitalize(${to_word})`
            } else {
                result = "?"
            }
            return `${p1_pfx}<%= ${result} %>`
        }
    }

    public get regex() {
        let from_word = this.using_name
        return new RegExp(`(^|[^a-zA-Z0-9])((${from_word})|(${_.capitalize(from_word)}))`,'g')
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
    public static process(relpath: string, abspath:AbsPath, from_name: string) : TemplateInfo {
        let result = new TemplateInfo(relpath, abspath, from_name)
        result.process()

        return result
    }

    public static template_filename(relpath: string) {
        return relpath.replace(/\//g,'_') + ".ejs.t"
    }
}