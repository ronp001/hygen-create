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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVtcGxhdGl6ZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvdGVtcGxhdGl6ZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFDQSx5Q0FBd0M7QUFVeEM7SUFHSSxZQUFtQixPQUFlLEVBQVMsT0FBZ0IsRUFBUyxVQUFrQixFQUFTLGNBQXVCO1FBQW5HLFlBQU8sR0FBUCxPQUFPLENBQVE7UUFBUyxZQUFPLEdBQVAsT0FBTyxDQUFTO1FBQVMsZUFBVSxHQUFWLFVBQVUsQ0FBUTtRQUFTLG1CQUFjLEdBQWQsY0FBYyxDQUFTO1FBd0M5RyxrQkFBYSxHQUEyQixFQUFFLENBQUE7UUFDMUMsV0FBTSxHQUFtQixFQUFFLENBQUE7UUFDM0IsOEJBQXlCLEdBQW1CLEVBQUUsQ0FBQTtRQXpDbEQsSUFBSSxDQUFDLFNBQVMsR0FBRyxPQUFPLENBQUMsWUFBWSxDQUFBO0lBQ3pDLENBQUM7SUFFRCxJQUFXLGlCQUFpQjtRQUN4QixNQUFNLENBQUMsV0FBVyxDQUFDLGlCQUFpQixDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQTtJQUN0RCxDQUFDO0lBRUQsSUFBVyxlQUFlO1FBQ3RCLE1BQU0sQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLElBQUksQ0FBQyxPQUFPLENBQUE7SUFDOUQsQ0FBQztJQUVELElBQVcsTUFBTTtRQUViLElBQUksZ0JBQXlCLENBQUE7UUFFN0IsRUFBRSxDQUFDLENBQUUsSUFBSSxDQUFDLGNBQWUsQ0FBQyxDQUFDLENBQUM7WUFDeEIsZ0JBQWdCLEdBQUcsa0JBQWtCLEdBQUcsSUFBSSxDQUFDLGVBQWUsR0FBRyxJQUFJLENBQUE7UUFDdkUsQ0FBQztRQUFDLElBQUksQ0FBQyxDQUFDO1lBQ0osZ0JBQWdCLEdBQUcsT0FBTyxJQUFJLENBQUMsZUFBZSxJQUFJLENBQUE7UUFDdEQsQ0FBQztRQUVELElBQUksTUFBTSxHQUFHLEVBQUU7Y0FDYixPQUFPO2NBQ1AsZ0JBQWdCO2NBQ2hCLE9BQU8sQ0FBQTtRQUVULE1BQU0sQ0FBQyxNQUFNLENBQUE7SUFDakIsQ0FBQztJQUVELElBQVcsbUJBQW1CO1FBQzFCLE1BQU0sQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLE1BQU0sQ0FBQTtJQUNwQyxDQUFDO0lBQ0QsSUFBVyxZQUFZO1FBQ25CLE1BQU0sQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFBO0lBQzdCLENBQUM7SUFDRCxJQUFXLHlCQUF5QjtRQUNoQyxNQUFNLENBQUMsSUFBSSxDQUFDLHlCQUF5QixDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQTtJQUNwRCxDQUFDO0lBTU0sT0FBTztRQUNWLEVBQUUsQ0FBQyxDQUFFLElBQUksQ0FBQyxTQUFVLENBQUMsQ0FBQyxDQUFDO1lBQ25CLE1BQU0sQ0FBQTtRQUNWLENBQUM7UUFFRCxJQUFJLENBQUMsTUFBTSxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsY0FBYyxDQUFDLFFBQVEsRUFBRSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQTtRQUVoRSxJQUFJLEdBQUcsR0FBRyxDQUFDLENBQUE7UUFDWCxHQUFHLENBQUMsQ0FBRSxJQUFJLElBQUksSUFBSSxJQUFJLENBQUMsTUFBTyxDQUFDLENBQUMsQ0FBQztZQUM3QixHQUFHLEVBQUUsQ0FBQTtZQUNMLElBQUksaUJBQWlCLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLENBQUE7WUFDbkQsRUFBRSxDQUFDLENBQUUsaUJBQWtCLENBQUMsQ0FBQyxDQUFDO2dCQUN0QixJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxDQUFBO2dCQUMxQyxJQUFJLENBQUMseUJBQXlCLENBQUMsSUFBSSxDQUFDLGlCQUFpQixDQUFDLFFBQVEsQ0FBQyxDQUFBO1lBQ25FLENBQUM7WUFBQyxJQUFJLENBQUMsQ0FBQztnQkFDSixJQUFJLENBQUMseUJBQXlCLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFBO1lBQzdDLENBQUM7UUFDTCxDQUFDO0lBQ0wsQ0FBQztJQUVNLFFBQVEsQ0FBQyxPQUFjO1FBQzFCLE1BQU0sQ0FBQyxDQUFDLEtBQVksRUFBRSxNQUFhLEVBQUUsUUFBZTtRQUM1RCx1Q0FBdUM7UUFDbkIsY0FBcUIsRUFDckIsY0FBcUIsRUFDckIsZUFBc0IsRUFDdEIsYUFBb0IsRUFDcEIsZ0JBQXVCLEVBQ3ZCLGVBQXNCLEVBQ3RCLGtCQUF5QixFQUN6QixjQUFxQixFQUNyQixZQUFtQixFQUN2QixNQUFhLEVBQUUsWUFBbUIsRUFBRSxFQUFFO1lBQzFDLElBQUksTUFBZSxDQUFBO1lBRW5COztxQkFFUyxDQUFDLEVBQUUsQ0FBQyxDQUFFLGNBQWUsQ0FBQyxDQUFDLENBQUM7Z0JBQzdCLE1BQU0sR0FBRyxHQUFHLE9BQU8sZ0JBQWdCLENBQUE7WUFDdkMsQ0FBQztZQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBRSxjQUFlLENBQUMsQ0FBQyxDQUFDO2dCQUMxQixNQUFNLEdBQUcsR0FBRyxPQUFPLGdCQUFnQixDQUFBO1lBQ3ZDLENBQUM7WUFBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUUsZUFBZ0IsQ0FBQyxDQUFDLENBQUM7Z0JBQzNCLE1BQU0sR0FBRyxnQkFBZ0IsT0FBTyxHQUFHLENBQUE7WUFDdkMsQ0FBQztZQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBRSxhQUFjLENBQUMsQ0FBQyxDQUFDO2dCQUN6QixNQUFNLEdBQUcseUJBQXlCLE9BQU8sVUFBVSxDQUFBO1lBQ3ZELENBQUM7WUFBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUUsZ0JBQWlCLENBQUMsQ0FBQyxDQUFDO2dCQUM1QixNQUFNLEdBQUcseUJBQXlCLE9BQU8sU0FBUyxDQUFBO1lBQ3RELENBQUM7WUFBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUUsZUFBZ0IsQ0FBQyxDQUFDLENBQUM7Z0JBQzNCLE1BQU0sR0FBRywyQkFBMkIsT0FBTyxVQUFVLENBQUE7WUFDekQsQ0FBQztZQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBRSxrQkFBbUIsQ0FBQyxDQUFDLENBQUM7Z0JBQzlCLE1BQU0sR0FBRywyQkFBMkIsT0FBTyx3QkFBd0IsQ0FBQTtZQUN2RSxDQUFDO1lBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFFLGNBQWUsQ0FBQyxDQUFDLENBQUM7Z0JBQzFCLE1BQU0sR0FBRywwQkFBMEIsT0FBTywrQkFBK0IsQ0FBQTtZQUM3RSxDQUFDO1lBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFFLFlBQWEsQ0FBQyxDQUFDLENBQUM7Z0JBQ3hCLE1BQU0sR0FBRyx3QkFBd0IsT0FBTyxHQUFHLENBQUE7WUFDL0MsQ0FBQztZQUFDLElBQUksQ0FBQyxDQUFDO2dCQUNKLE1BQU0sR0FBRyxHQUFHLENBQUE7WUFDaEIsQ0FBQztZQUNELE1BQU0sQ0FBQyxHQUFHLE1BQU0sT0FBTyxNQUFNLEtBQUssQ0FBQTtRQUN0QyxDQUFDLENBQUE7SUFDTCxDQUFDO0lBRUQsSUFBVyxLQUFLO1FBQ1osSUFBSSxTQUFTLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQTtRQUUvQixJQUFJLFVBQVUsR0FBRyxTQUFTLENBQUMsV0FBVyxFQUFFLENBQUE7UUFDeEMsSUFBSSxVQUFVLEdBQUcsU0FBUyxDQUFDLFdBQVcsRUFBRSxDQUFBO1FBQ3hDLElBQUksV0FBVyxHQUFHLFVBQVUsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLENBQUE7UUFDbEQsSUFBSSxTQUFTLEdBQUcsVUFBVSxDQUFDLFFBQVEsQ0FBQyxTQUFTLEVBQUUsS0FBSyxDQUFDLENBQUE7UUFDckQsSUFBSSxZQUFZLEdBQUcsVUFBVSxDQUFDLFFBQVEsQ0FBQyxTQUFTLEVBQUUsSUFBSSxDQUFDLENBQUE7UUFDdkQsSUFBSSxXQUFXLEdBQUcsVUFBVSxDQUFDLFVBQVUsQ0FBQyxTQUFTLEVBQUUsS0FBSyxDQUFDLENBQUE7UUFDekQsSUFBSSxjQUFjLEdBQUcsVUFBVSxDQUFDLFVBQVUsQ0FBQyxTQUFTLEVBQUUsS0FBSyxDQUFDLENBQUMsV0FBVyxFQUFFLENBQUE7UUFDMUUsSUFBSSxVQUFVLEdBQUcsVUFBVSxDQUFDLFNBQVMsQ0FBQyxTQUFTLEVBQUUsQ0FBQyxZQUFZLEVBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQTtRQUM1RSxJQUFJLFFBQVEsR0FBRyxVQUFVLENBQUMsUUFBUSxDQUFDLFNBQVMsQ0FBQyxDQUFBO1FBRTdDLElBQUksUUFBUSxHQUFHLEVBQUU7WUFDekIseUNBQXlDO2NBQ2xCLElBQUksVUFBVSxHQUFHO2NBQ2pCLEtBQUssVUFBVSxHQUFHO2NBQ2xCLEtBQUssV0FBVyxHQUFHO2NBQ25CLEtBQUssU0FBUyxHQUFHO2NBQ2pCLEtBQUssWUFBWSxHQUFHO2NBQ3BCLEtBQUssV0FBVyxHQUFHO2NBQ25CLEtBQUssY0FBYyxHQUFHO2NBQ3RCLEtBQUssVUFBVSxHQUFHO2NBQ2xCLEtBQUssUUFBUSxHQUFHLENBQUE7UUFFL0IsTUFBTSxDQUFDLElBQUksTUFBTSxDQUFDLG9CQUFvQixRQUFRLEdBQUcsRUFBQyxHQUFHLENBQUMsQ0FBQTtJQUMxRCxDQUFDO0lBRU0sZ0JBQWdCLENBQUMsSUFBVztRQUMvQixJQUFJLFNBQVMsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFBO1FBQy9CLElBQUksT0FBTyxHQUFHLE1BQU0sQ0FBQTtRQUNwQixJQUFJLEtBQUssR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFBO1FBRXRCLEVBQUUsQ0FBQyxDQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUUsQ0FBQztZQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUE7UUFFdEUsTUFBTSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxFQUFDLEtBQUssQ0FBQyxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFBO0lBQzNFLENBQUM7SUFFTSxXQUFXLENBQUMsSUFBVyxFQUFFLEdBQVU7UUFFdEMsSUFBSSxRQUFRLEdBQUcsSUFBSSxDQUFDLGdCQUFnQixDQUFDLElBQUksQ0FBQyxDQUFBO1FBQzFDLEVBQUUsQ0FBQyxDQUFFLFFBQVEsSUFBSSxJQUFLLENBQUM7WUFBQyxNQUFNLENBQUMsSUFBSSxDQUFBO1FBRW5DLElBQUksTUFBTSxHQUFxQjtZQUMzQixPQUFPLEVBQUcsR0FBRztZQUNiLFFBQVEsRUFBRyxJQUFJO1lBQ2YsUUFBUSxFQUFHLFFBQVE7U0FDdEIsQ0FBQTtRQUNELE1BQU0sQ0FBQyxNQUFNLENBQUE7SUFDakIsQ0FBQztDQUNKO0FBL0pELG9DQStKQztBQUVEO0lBQ1csTUFBTSxDQUFDLE9BQU8sQ0FBQyxPQUFlLEVBQUUsT0FBZSxFQUFFLFNBQWlCLEVBQUUsY0FBdUI7UUFDOUYsSUFBSSxNQUFNLEdBQUcsSUFBSSxZQUFZLENBQUMsT0FBTyxFQUFFLE9BQU8sRUFBRSxTQUFTLEVBQUUsY0FBYyxDQUFDLENBQUE7UUFDMUUsTUFBTSxDQUFDLE9BQU8sRUFBRSxDQUFBO1FBRWhCLE1BQU0sQ0FBQyxNQUFNLENBQUE7SUFDakIsQ0FBQztJQUVNLE1BQU0sQ0FBQyxpQkFBaUIsQ0FBQyxPQUFlO1FBQzNDLE1BQU0sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLEtBQUssRUFBQyxHQUFHLENBQUMsR0FBRyxRQUFRLENBQUE7SUFDaEQsQ0FBQztDQUNKO0FBWEQsa0NBV0MifQ==