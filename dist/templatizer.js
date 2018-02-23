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
            + `to: <%= name %>/${this.target_filename}\n`
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
        return (match, p1_pfx, p2_words, p2a_exact, p2b_uppercased, p2b_lowercased, p2b_capitalized, p2b_camelized, p2b_camelized_lf, p2b_underscored, p2b_underscored_up, p2b_dasherized, p2b_titlized, offset, whole_string) => {
            let result;
            if (p2a_exact) {
                result = to_word;
            }
            else if (p2b_uppercased) {
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
        let combined = `(${from_word})`
            + `|(${uppercased})`
            + `|(${lowercased})`
            + `|(${capitalized})`
            + `|(${camelized})`
            + `|(${camelized_lf})`
            + `|(${underscored})`
            + `|(${underscored_up})`
            + `|(${dasherized})`
            + `|(${titlized})`;
        return new RegExp(`(^|[^a-zA-Z0-9])(${combined})`, 'g');
        // return new RegExp(`(^|[^a-zA-Z0-9])((${from_word})|(${_.capitalize(from_word)}))`,'g')
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVtcGxhdGl6ZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvdGVtcGxhdGl6ZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFDQSx5Q0FBd0M7QUFVeEM7SUFDSSxZQUFtQixPQUFlLEVBQVMsT0FBZ0IsRUFBUyxVQUFrQjtRQUFuRSxZQUFPLEdBQVAsT0FBTyxDQUFRO1FBQVMsWUFBTyxHQUFQLE9BQU8sQ0FBUztRQUFTLGVBQVUsR0FBVixVQUFVLENBQVE7UUE2QjlFLGtCQUFhLEdBQTJCLEVBQUUsQ0FBQTtRQUMxQyxXQUFNLEdBQW1CLEVBQUUsQ0FBQTtRQUMzQiw4QkFBeUIsR0FBbUIsRUFBRSxDQUFBO0lBL0JtQyxDQUFDO0lBRTFGLElBQVcsaUJBQWlCO1FBQ3hCLE1BQU0sQ0FBQyxXQUFXLENBQUMsaUJBQWlCLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFBO0lBQ3RELENBQUM7SUFFRCxJQUFXLGVBQWU7UUFDdEIsTUFBTSxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksSUFBSSxDQUFDLE9BQU8sQ0FBQTtJQUM5RCxDQUFDO0lBRUQsSUFBVyxNQUFNO1FBQ2IsSUFBSSxNQUFNLEdBQUcsRUFBRTtjQUNiLE9BQU87Y0FDUCxtQkFBbUIsSUFBSSxDQUFDLGVBQWUsSUFBSTtjQUMzQyxPQUFPLENBQUE7UUFFVCxNQUFNLENBQUMsTUFBTSxDQUFBO0lBQ2pCLENBQUM7SUFFRCxJQUFXLG1CQUFtQjtRQUMxQixNQUFNLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxNQUFNLENBQUE7SUFDcEMsQ0FBQztJQUNELElBQVcsWUFBWTtRQUNuQixNQUFNLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQTtJQUM3QixDQUFDO0lBQ0QsSUFBVyx5QkFBeUI7UUFDaEMsTUFBTSxDQUFDLElBQUksQ0FBQyx5QkFBeUIsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUE7SUFDcEQs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