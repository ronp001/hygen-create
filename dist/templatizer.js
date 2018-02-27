"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const inflection = require("inflection");
class TemplateInfo {
    constructor(relpath, abspath, using_name) {
        this.relpath = relpath;
        this.abspath = abspath;
        this.using_name = using_name;
        this._replacements = [];
        this._lines = [];
        this._lines_after_replacements = [];
        this.is_binary = abspath.isBinaryFile;
    }
    get template_filename() {
        return Templatizer.template_filename(this.relpath);
    }
    get target_filename() {
        return this.getProcessedText(this.relpath) || this.relpath;
    }
    get header() {
        let header = ""
            + "---\n"
            // + this.getProcessedText(`to: ${this.using_name}`) + `/${this.target_filename}\n`
            + `to: <%= name %>/` + this.target_filename + "\n"
            // + `to: <%= name %>/${this.target_filename}\n`
            + "---\n";
        return header;
    }
    get numReplacementLines() {
        return this._replacements.length;
    }
    get replacements() {
        return this._replacements;
    }
    get contentsAfterReplacements() {
        return this._lines_after_replacements.join('\n');
    }
    process() {
        if (this.is_binary) {
            return;
        }
        this._lines = this.abspath.contentsBuffer.toString().split('\n');
        let num = 0;
        for (let line of this._lines) {
            num++;
            let line_replacements = this.processLine(line, num);
            if (line_replacements) {
                this._replacements.push(line_replacements);
                this._lines_after_replacements.push(line_replacements.new_text);
            }
            else {
                this._lines_after_replacements.push(line);
            }
        }
    }
    replacer(to_word) {
        return (match, p1_pfx, p2_words, 
        //                    p2a_exact:string,
        p2b_uppercased, p2b_lowercased, p2b_capitalized, p2b_camelized, p2b_camelized_lf, p2b_underscored, p2b_underscored_up, p2b_dasherized, p2b_titlized, offset, whole_string) => {
            let result;
            /*if ( p2a_exact ) {
                result = to_word
            } else */ if (p2b_uppercased) {
                result = `${to_word}.toUpperCase()`;
            }
            else if (p2b_lowercased) {
                result = `${to_word}.toLowerCase()`;
            }
            else if (p2b_capitalized) {
                result = `h.capitalize(${to_word})`;
            }
            else if (p2b_camelized) {
                result = `h.inflection.camelize(${to_word}, false)`;
            }
            else if (p2b_camelized_lf) {
                result = `h.inflection.camelize(${to_word}, true)`;
            }
            else if (p2b_underscored) {
                result = `h.inflection.underscore(${to_word}, false)`;
            }
            else if (p2b_underscored_up) {
                result = `h.inflection.underscore(${to_word}, false).toUpperCase()`;
            }
            else if (p2b_dasherized) {
                result = `h.inflection.transform(${to_word}, ['underscore','dasherize'])`;
            }
            else if (p2b_titlized) {
                result = `h.inflection.titlize(${to_word})`;
            }
            else {
                result = "?";
            }
            return `${p1_pfx}<%= ${result} %>`;
        };
    }
    get regex() {
        let from_word = this.using_name;
        let uppercased = from_word.toUpperCase();
        let lowercased = from_word.toLowerCase();
        let capitalized = inflection.capitalize(from_word);
        let camelized = inflection.camelize(from_word, false);
        let camelized_lf = inflection.camelize(from_word, true);
        let underscored = inflection.underscore(from_word, false);
        let underscored_up = inflection.underscore(from_word, false).toUpperCase();
        let dasherized = inflection.transform(from_word, ['underscore', 'dasherize']);
        let titlized = inflection.titleize(from_word);
        let combined = ""
            //                    +  `(${from_word})`
            + `(${uppercased})`
            + `|(${lowercased})`
            + `|(${capitalized})`
            + `|(${camelized})`
            + `|(${camelized_lf})`
            + `|(${underscored})`
            + `|(${underscored_up})`
            + `|(${dasherized})`
            + `|(${titlized})`;
        return new RegExp(`(^|[^a-zA-Z0-9])(${combined})`, 'g');
    }
    getProcessedText(text) {
        let from_word = this.using_name;
        let to_word = 'name';
        let regex = this.regex;
        if (text.search(regex) == -1 && text.search('<%') == -1)
            return null;
        return text.replace(/<%/g, '<%%').replace(regex, this.replacer(to_word));
    }
    processLine(line, num) {
        let new_text = this.getProcessedText(line);
        if (new_text == null)
            return null;
        let result = {
            linenum: num,
            old_text: line,
            new_text: new_text
        };
        return result;
    }
}
exports.TemplateInfo = TemplateInfo;
class Templatizer {
    static process(relpath, abspath, from_name) {
        let result = new TemplateInfo(relpath, abspath, from_name);
        result.process();
        return result;
    }
    static template_filename(relpath) {
        return relpath.replace(/\//g, '_') + ".ejs.t";
    }
}
exports.Templatizer = Templatizer;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVtcGxhdGl6ZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvdGVtcGxhdGl6ZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFDQSx5Q0FBd0M7QUFVeEM7SUFHSSxZQUFtQixPQUFlLEVBQVMsT0FBZ0IsRUFBUyxVQUFrQjtRQUFuRSxZQUFPLEdBQVAsT0FBTyxDQUFRO1FBQVMsWUFBTyxHQUFQLE9BQU8sQ0FBUztRQUFTLGVBQVUsR0FBVixVQUFVLENBQVE7UUFvQzlFLGtCQUFhLEdBQTJCLEVBQUUsQ0FBQTtRQUMxQyxXQUFNLEdBQW1CLEVBQUUsQ0FBQTtRQUMzQiw4QkFBeUIsR0FBbUIsRUFBRSxDQUFBO1FBckNsRCxJQUFJLENBQUMsU0FBUyxHQUFHLE9BQU8sQ0FBQyxZQUFZLENBQUE7SUFDekMsQ0FBQztJQUVELElBQVcsaUJBQWlCO1FBQ3hCLE1BQU0sQ0FBQyxXQUFXLENBQUMsaUJBQWlCLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFBO0lBQ3RELENBQUM7SUFFRCxJQUFXLGVBQWU7UUFDdEIsTUFBTSxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksSUFBSSxDQUFDLE9BQU8sQ0FBQTtJQUM5RCxDQUFDO0lBRUQsSUFBVyxNQUFNO1FBR2IsSUFBSSxNQUFNLEdBQUcsRUFBRTtjQUViLE9BQU87WUFDVCxtRkFBbUY7Y0FDakYsa0JBQWtCLEdBQUcsSUFBSSxDQUFDLGVBQWUsR0FBRyxJQUFJO1lBQ2xELGdEQUFnRDtjQUM5QyxPQUFPLENBQUE7UUFFVCxNQUFNLENBQUMsTUFBTSxDQUFBO0lBQ2pCLENBQUM7SUFFRCxJQUFXLG1CQUFtQjtRQUMxQixNQUFNLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxNQUFNLENBQUE7SUFDcEMsQ0FBQztJQUNELElBQVcsWUFBWTtRQUNuQixNQUFNLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQTtJQUM3QixDQUFDO0lBQ0Qs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