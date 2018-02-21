"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const _ = require("lodash");
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
        return (match, p1_pfx, p2_words, p2a_lower, p2b_upper, offset, whole_string) => {
            let result;
            if (p2a_lower) {
                result = to_word;
            }
            else if (p2b_upper) {
                result = `h.capitalize(${to_word})`;
            }
            else {
                result = "?";
            }
            return `${p1_pfx}<%= ${result} %>`;
        };
    }
    get regex() {
        let from_word = this.using_name;
        return new RegExp(`(^|[^a-zA-Z0-9])((${from_word})|(${_.capitalize(from_word)}))`, 'g');
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVtcGxhdGl6ZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvdGVtcGxhdGl6ZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQSw0QkFBMkI7QUFTM0I7SUFDSSxZQUFtQixPQUFlLEVBQVMsT0FBZ0IsRUFBUyxVQUFrQjtRQUFuRSxZQUFPLEdBQVAsT0FBTyxDQUFRO1FBQVMsWUFBTyxHQUFQLE9BQU8sQ0FBUztRQUFTLGVBQVUsR0FBVixVQUFVLENBQVE7UUE2QjlFLGtCQUFhLEdBQTJCLEVBQUUsQ0FBQTtRQUMxQyxXQUFNLEdBQW1CLEVBQUUsQ0FBQTtRQUMzQiw4QkFBeUIsR0FBbUIsRUFBRSxDQUFBO0lBL0JtQyxDQUFDO0lBRTFGLElBQVcsaUJBQWlCO1FBQ3hCLE1BQU0sQ0FBQyxXQUFXLENBQUMsaUJBQWlCLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFBO0lBQ3RELENBQUM7SUFFRCxJQUFXLGVBQWU7UUFDdEIsTUFBTSxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksSUFBSSxDQUFDLE9BQU8sQ0FBQTtJQUM5RCxDQUFDO0lBRUQsSUFBVyxNQUFNO1FBQ2IsSUFBSSxNQUFNLEdBQUcsRUFBRTtjQUNiLE9BQU87Y0FDUCxtQkFBbUIsSUFBSSxDQUFDLGVBQWUsSUFBSTtjQUMzQyxPQUFPLENBQUE7UUFFVCxNQUFNLENBQUMsTUFBTSxDQUFBO0lBQ2pCLENBQUM7SUFFRCxJQUFXLG1CQUFtQjtRQUMxQixNQUFNLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxNQUFNLENBQUE7SUFDcEMsQ0FBQztJQUNELElBQVcsWUFBWTtRQUNuQixNQUFNLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQTtJQUM3QixDQUFDO0lBQ0QsSUFBVyx5QkFBeUI7UUFDaEMsTUFBTSxDQUFDLElBQUksQ0FBQyx5QkFBeUIsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUE7SUFDcEQs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