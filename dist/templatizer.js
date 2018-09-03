"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const inflection = require("inflection");
class TemplateInfo {
    constructor(relpath, abspath, using_name, gen_parent_dir) {
        this.relpath = relpath;
        this.abspath = abspath;
        this.using_name = using_name;
        this.gen_parent_dir = gen_parent_dir;
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
        let target_path_line;
        if (this.gen_parent_dir) {
            target_path_line = `to: <%= name %>/` + this.target_filename + "\n";
        }
        else {
            target_path_line = `to: ${this.target_filename}\n`;
        }
        let header = ""
            + "---\n"
            + target_path_line
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
    static process(relpath, abspath, from_name, gen_parent_dir) {
        let result = new TemplateInfo(relpath, abspath, from_name, gen_parent_dir);
        result.process();
        return result;
    }
    static template_filename(relpath) {
        return relpath.replace(/\//g, '_') + ".ejs.t";
    }
}
exports.Templatizer = Templatizer;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVtcGxhdGl6ZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvdGVtcGxhdGl6ZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFDQSx5Q0FBd0M7QUFVeEMsTUFBYSxZQUFZO0lBR3JCLFlBQW1CLE9BQWUsRUFBUyxPQUFnQixFQUFTLFVBQWtCLEVBQVMsY0FBdUI7UUFBbkcsWUFBTyxHQUFQLE9BQU8sQ0FBUTtRQUFTLFlBQU8sR0FBUCxPQUFPLENBQVM7UUFBUyxlQUFVLEdBQVYsVUFBVSxDQUFRO1FBQVMsbUJBQWMsR0FBZCxjQUFjLENBQVM7UUF3QzlHLGtCQUFhLEdBQTJCLEVBQUUsQ0FBQTtRQUMxQyxXQUFNLEdBQWtCLEVBQUUsQ0FBQTtRQUMxQiw4QkFBeUIsR0FBa0IsRUFBRSxDQUFBO1FBekNqRCxJQUFJLENBQUMsU0FBUyxHQUFHLE9BQU8sQ0FBQyxZQUFZLENBQUE7SUFDekMsQ0FBQztJQUVELElBQVcsaUJBQWlCO1FBQ3hCLE9BQU8sV0FBVyxDQUFDLGlCQUFpQixDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQTtJQUN0RCxDQUFDO0lBRUQsSUFBVyxlQUFlO1FBQ3RCLE9BQU8sSUFBSSxDQUFDLGdCQUFnQixDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxJQUFJLENBQUMsT0FBTyxDQUFBO0lBQzlELENBQUM7SUFFRCxJQUFXLE1BQU07UUFFYixJQUFJLGdCQUF3QixDQUFBO1FBRTVCLElBQUksSUFBSSxDQUFDLGNBQWMsRUFBRTtZQUNyQixnQkFBZ0IsR0FBRyxrQkFBa0IsR0FBRyxJQUFJLENBQUMsZUFBZSxHQUFHLElBQUksQ0FBQTtTQUN0RTthQUFNO1lBQ0gsZ0JBQWdCLEdBQUcsT0FBTyxJQUFJLENBQUMsZUFBZSxJQUFJLENBQUE7U0FDckQ7UUFFRCxJQUFJLE1BQU0sR0FBRyxFQUFFO2NBQ1QsT0FBTztjQUNQLGdCQUFnQjtjQUNoQixPQUFPLENBQUE7UUFFYixPQUFPLE1BQU0sQ0FB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