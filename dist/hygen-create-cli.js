"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const program = require("commander");
const _ = require("lodash");
const chalk_1 = require("chalk");
const cli_app_1 = require("./cli-app");
// import { AbsPath } from "@ronp001/ts-utils/dist/path_helper"
const hygen_create_1 = require("./hygen-create");
const ts_utils_1 = require("@ronp001/ts-utils");
class HygenCreateCli extends cli_app_1.CliApp {
    constructor() {
        super(...arguments);
        this.hgc = new hygen_create_1.HygenCreate();
    }
    beforeCommand() {
        if (program.verbose) {
            // console.log("beforeCommand - project:", program.project)
            // this.hpg.activateDebug()
            this.hgc.outputFunc = console.log;
        }
        let project_search_path = process.cwd();
        if (program.project) {
            this.hgc.session_file_name = program.project;
        }
        this.hgc.setPathAndLoadSessionIfExists(project_search_path);
    }
    afterCommand() {
        // this.hpg.outputFunc("afterCommand")
        this.hgc.saveSessionIfActiveAndChanged();
    }
    _init() {
        program
            .description('hygen-create - create hygen templates from an existing project')
            .version('0.2.0')
            .option('-v, --verbose', "provide more info")
            .option('-p, --project <filename>', `name of session definitions file (default: ${hygen_create_1.HygenCreate.default_session_file_name})`);
        //-------------------------
        // Control commands
        //-------------------------
        program.command('start <generator-name>')
            .description("initiate a definition session for the generator <generator-name>")
            .option('-n, --usename <name>', "templatize files using <name>")
            .action(this.action(this.start));
        program.command('rename <generator-name>')
            .description("change the name of the target generator to <generator-name>")
            .action(this.action(this.rename));
        //-------------------------
        // File selection commands
        //-------------------------
        program.command('add <file|dir> [file|dir...]')
            .description("add files or directories to be templatized")
            .action(this.action(this.add));
        program.command('remove <file|dir> [file|dir...]')
            .alias('rm')
            .description("do not templatize specified files/directories")
            .action(this.action(this.remove));
        //-------------------------
        // Parameter definition commands
        //-------------------------
        program.command('usename <name>')
            .description("set <name> as the templatization param")
            .action(this.action(this.usename));
        program.command('setopt')
            .description("configure options for the generator")
            .option('--gen-parent-dir', "the resulting generator will create a parent directory (using the hygen --name param)")
            .option('--no-parent-dir', "the resulting generator will not create a parent directory for the content")
            .action(this.action(this.setopt));
        //-------------------------
        // Info commands
        //-------------------------
        program.command('status [file] [files...]')
            .alias('s')
            .option('-l, --detailed', "show detailed information")
            .description("show replacements to be made in (all|specified) files")
            .action(this.action(this.show));
        //-------------------------
        // Generator generation
        //-------------------------
        program.command('generate')
            .alias('g')
            .description("generate a generator from the added files")
            // .option('-f, --force', "overwrite generator files even if they exist")
            .action(this.action(this.generate));
    }
    setopt(options) {
        if (this.hgc.session == null)
            throw new hygen_create_1.HygenCreateError.NoSessionInProgress;
        if (options.genParentDir == true) {
            this.hgc.session.gen_parent_dir = true;
            console.log("parent dir generation is now on");
        }
        else if (options.parentDir == false) {
            this.hgc.session.gen_parent_dir = false;
            console.log("parent dir generation is now off");
        }
        else {
            console.log("no options specified");
        }
    }
    start(name, options) {
        this.hgc.startSession(name);
        console.log("created " + this.hgc.session_file_name);
        if (options.usename) {
            this.hgc.useName(options.usename);
        }
    }
    rename(name) {
        this.hgc.renameSession(name);
    }
    add(fileOrDir, otherFilesOrDirs) {
        let allfiles = this.fix(fileOrDir, otherFilesOrDirs);
        this.hgc.add(allfiles);
    }
    remove(fileOrDir, otherFilesOrDirs) {
        let allfiles = this.fix(fileOrDir, otherFilesOrDirs);
        this.hgc.remove(allfiles);
    }
    printTemplateInfo(tinfo) {
        let lines = tinfo.abspath.contentsLines;
        let replacement_lines = tinfo.replacements.map((e) => { return e.linenum - 1; });
        // console.log(tinfo.replacements)
        // console.log(replacement_lines)
        if (tinfo.is_binary) {
            console.log("<binary file>");
            return;
        }
        //-------------------------------
        // show the template header
        //-------------------------------
        console.log("hygen template file: " + chalk_1.default.bold(tinfo.template_filename));
        console.log(tinfo.header);
        //-------------------------------
        // compare the template to the original file
        //-------------------------------
        let Action;
        (function (Action) {
            Action[Action["Explain"] = 0] = "Explain";
            Action[Action["Show"] = 1] = "Show";
            Action[Action["Hide"] = 2] = "Hide";
        })(Action || (Action = {}));
        function getReplacementLine(linenum) {
            let entry = _.find(tinfo.replacements, { linenum: linenum + 1 });
            if (!entry)
                return "???";
            return entry.new_text;
        }
        function chooseAction(for_line_num) {
            let idx = _.sortedIndex(replacement_lines, for_line_num);
            let prev_line_num = replacement_lines[idx - 1] === undefined ? (for_line_num - 1000) : replacement_lines[idx - 1];
            let following_line_num = replacement_lines[idx] === undefined ? (for_line_num + 1000) : replacement_lines[idx];
            // console.log('following_line_num', following_line_num)
            let dist = Math.min(Math.abs(prev_line_num - for_line_num), Math.abs(following_line_num - for_line_num));
            // console.log('for_line_num', for_line_num, 'l', replacement_lines, 'l[idx]', replacement_lines[idx], 'idx', idx, 'prev_line_num', prev_line_num, 'following_line_num', following_line_num, 'dist', dist)
            if (dist == 0)
                return Action.Explain;
            if (dist < 4 && dist > 0)
                return Action.Show;
            if (for_line_num < 2)
                return Action.Show;
            if (lines.length - for_line_num < 3)
                return Action.Show;
            return Action.Hide;
        }
        function colorize(line) {
            let segs = line.split(/(<%=.*?%>)/);
            // console.log("segs:", segs)
            let result = "";
            for (let segnum = 0; segnum < segs.length; segnum++) {
                // console.log(segnum)
                if (segnum % 2 == 1) {
                    result += chalk_1.default.green(segs[segnum]);
                    // console.log(chalk.green(segs[segnum]))
                }
                else {
                    result += segs[segnum];
                }
            }
            return result;
        }
        let did_hide = false;
        let len = lines.length;
        for (let linenum = 0; linenum < len; linenum++) {
            let action = chooseAction(linenum);
            switch (action) {
                case Action.Explain:
                    console.log(chalk_1.default.red("%d -   %s"), linenum, (lines[linenum]));
                    console.log(chalk_1.default.green("%d +   %s"), linenum, colorize(getReplacementLine(linenum)));
                    did_hide = false;
                    break;
                case Action.Show:
                    console.log("%d     %s", linenum, lines[linenum]);
                    did_hide = false;
                    break;
                case Action.Hide:
                    if (!did_hide) {
                        did_hide = true;
                        console.log("...");
                    }
                    break;
            }
            // console.log(linenum, action)
        }
        console.log("----");
    }
    usename(name) {
        this.hgc.useName(name);
        let tinfos = this.hgc.templates;
        let count = 0;
        for (let tinfo of tinfos) {
            count += tinfo.replacements.length;
        }
        // console.log(tinfos)
        console.log(`${count} matching lines found in ${tinfos.length} included files`);
    }
    show(fileOrDir, otherFilesOrDirs) {
        if (this.hgc.session == null)
            throw new hygen_create_1.HygenCreateError.NoSessionInProgress;
        let single = (fileOrDir != undefined);
        let allfiles = this.fix(fileOrDir, otherFilesOrDirs);
        let info = this.hgc.getFileInfo(allfiles, program.verbose);
        if (this.hgc.session.templatize_using_name) {
            console.log(chalk_1.default `\nUsing the string "{bold ${this.hgc.session.templatize_using_name}}" to templatize files (Change using 'hygen-create usename <name>')`);
        }
        else {
            console.log("");
            console.log(chalk_1.default.redBright(`\nNo word set for templatizing files.  Set using 'hygen-create usename <name>'`));
            console.log("");
        }
        if (typeof fileOrDir == "undefined") {
            if (info.length == 0) {
                console.log(chalk_1.default.red("No files included in the generator"));
            }
            else {
                console.log("\nThe following files are included in the generator:");
            }
        }
        const currentDir = new ts_utils_1.AbsPath(".");
        for (let finfo of info) {
            let p = finfo.path;
            let f = finfo.path.relativeFrom(currentDir);
            if (f == null)
                throw new Error(`unexpected error - could not calculate relative path for ${p.toString()}`);
            let line;
            let fname;
            let color;
            let num_replacement_lines = 0;
            let tinfo = null;
            if (!p.exists) {
                fname = `${f} (not found)`;
                color = chalk_1.default.bgYellow;
            }
            else {
                if (p.isDir) {
                    fname = `${f}/`;
                    color = chalk_1.default.blue;
                }
                else if (p.isSymLink) {
                    fname = `${f}@`;
                    color = chalk_1.default.magenta;
                }
                else if (p.isFile) {
                    fname = `${f}`;
                    color = chalk_1.default.green;
                }
                else {
                    fname = `${f}???`;
                    color = chalk_1.default.cyan;
                }
                if (this.hgc.session.templatize_using_name) {
                    tinfo = this.hgc.getTemplate(f, null);
                    num_replacement_lines = tinfo.numReplacementLines;
                }
            }
            if (finfo.included) {
                line = chalk_1.default.blue('[included] - ') + color(fname);
                if (finfo.is_binary) {
                    line = chalk_1.default.red(`[ignored ] - ${fname} (binary file)`);
                }
            }
            else {
                line = chalk_1.default.gray(`[excluded] - ${fname}`);
            }
            if (num_replacement_lines > 0) {
                line += chalk_1.default.blue(` [${num_replacement_lines} lines parameterized]`);
            }
            console.log(line);
            if ((program.verbose || program.detailed) && tinfo) {
                this.printTemplateInfo(tinfo);
            }
        }
        if (!single) {
            console.log("");
            if (this.hgc.session.name) {
                if (this.hgc.targetDirForGenerators.isSet) {
                    console.log(chalk_1.default.green(`Target dir: ${this.hgc.targetDirForGenerators.add(this.hgc.session.name).abspath}`) +
                        (chalk_1.default.gray(`  ${this.hgc.targetDirForGeneratorsReason}`)));
                }
                else {
                    console.log(chalk_1.default.red(`No target dir: ${this.hgc.targetDirForGeneratorsReason}`));
                }
            }
            else {
                console.log(chalk_1.default.red("Generator name not set (use hygen-create rename <name> to set it)"));
            }
            console.log("");
            if (this.hgc.session.gen_parent_dir) {
                console.log(`Parent dir generation: ON  (the resulting generator will create a <name> directory as parent for the content)`);
            }
            else {
                console.log("Parent dir generation: OFF (the resulting generator will add content to the current directory)");
            }
            console.log("");
        }
    }
    generate(options) {
        let force = !!options.force;
        // if ( force ) console.log("FORCE!")
        this.hgc.generate();
    }
}
exports.default = HygenCreateCli;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaHlnZW4tY3JlYXRlLWNsaS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy9oeWdlbi1jcmVhdGUtY2xpLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUEscUNBQW9DO0FBRXBDLDRCQUEyQjtBQUMzQixpQ0FBeUI7QUFDekIsdUNBQWtDO0FBQ2xDLCtEQUErRDtBQUMvRCxpREFBOEQ7QUFFOUQsZ0RBQTRDO0FBRTVDLE1BQXFCLGNBQWUsU0FBUSxnQkFBTTtJQUFsRDs7UUFFWSxRQUFHLEdBQWdCLElBQUksMEJBQVcsRUFBRSxDQUFDO0lBb1ZqRCxDQUFDO0lBbFZhLGFBQWE7UUFFbkIsSUFBSSxPQUFPLENBQUMsT0FBTyxFQUFFO1lBQ2pCLDJEQUEyRDtZQUMzRCwyQkFBMkI7WUFDM0IsSUFBSSxDQUFDLEdBQUcsQ0FBQyxVQUFVLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQTtTQUNwQztRQUVELElBQUksbUJBQW1CLEdBQUcsT0FBTyxDQUFDLEdBQUcsRUFBRSxDQUFBO1FBQ3ZDLElBQUksT0FBTyxDQUFDLE9BQU8sRUFBRTtZQUNqQixJQUFJLENBQUMsR0FBRyxDQUFDLGlCQUFpQixHQUFHLE9BQU8sQ0FBQyxPQUFPLENBQUE7U0FDL0M7UUFDRCxJQUFJLENBQUMsR0FBRyxDQUFDLDZCQUE2QixDQUFDLG1CQUFtQixDQUFDLENBQUE7SUFDL0QsQ0FBQztJQUVTLFlBQVk7UUFDbEIsc0NBQXNDO1FBQ3RDLElBQUksQ0FBQyxHQUFHLENBQUMsNkJBQTZCLEVBQUUsQ0FBQTtJQUM1QyxDQUFDO0lBRVMsS0FBSztRQUVYLE9BQU87YUFDRixXQUFXLENBQUMsZ0VBQWdFLENBQUM7YUFDN0UsT0FBTyxDQUFDLE9BQU8sQ0FBQzthQUNoQixNQUFNLENBQUMsZUFBZSxFQUFFLG1CQUFtQixDQUFDO2FBQzVDLE1BQU0sQ0FBQywwQkFBMEIsRUFBRSw4Q0FBOEMsMEJBQVcsQ0FBQyx5QkFBeUIsR0FBRyxDQUFDLENBQUE7UUFFL0gsMkJBQTJCO1FBQzNCLG1CQUFtQjtRQUNuQiwyQkFBMkI7UUFDM0IsT0FBTyxDQUFDLE9BQU8sQ0FBQyx3QkFBd0IsQ0FBQzthQUNwQyxXQUFXLENBQUMsa0VBQWtFLENBQUM7YUFDL0UsTUFBTSxDQUFDLHNCQUFzQixFQUFFLCtCQUErQixDQUFDO2FBQy9ELE1BQU0sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO1FBRXJDLE9BQU8sQ0FBQyxPQUFPLENBQUMseUJBQXlCLENBQUM7YUFDckMsV0FBVyxDQUFDLDZEQUE2RCxDQUFDO2FBQzFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDO1FBRXRDLDJCQUEyQjtRQUMzQiwwQkFBMEI7UUFDMUIsMkJBQTJCO1FBQzNCLE9BQU8sQ0FBQyxPQUFPLENBQUMsOEJBQThCLENBQUM7YUFDMUMsV0FBVyxDQUFDLDRDQUE0QyxDQUFDO2FBQ3pELE1BQU0sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO1FBRW5DLE9BQU8sQ0FBQyxPQUFPLENBQUMsaUNBQWlDLENBQUM7YUFDN0MsS0FBSyxDQUFDLElBQUksQ0FBQzthQUNYLFdBQVcsQ0FBQywrQ0FBK0MsQ0FBQzthQUM1RCxNQUFNLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQztRQUV0QywyQkFBMkI7UUFDM0IsZ0NBQWdDO1FBQ2hDLDJCQUEyQjtRQUMzQixPQUFPLENBQUMsT0FBTyxDQUFDLGdCQUFnQixDQUFDO2FBQzVCLFdBQVcsQ0FBQyx3Q0FBd0MsQ0FBQzthQUNyRCxNQUFNLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQTtRQUV0QyxPQUFPLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQzthQUNwQixXQUFXLENBQUMscUNBQXFDLENBQUM7YUFDbEQsTUFBTSxDQUFDLGtCQUFrQixFQUFFLHVGQUF1RixDQUFDO2FBQ25ILE1BQU0sQ0FBQyxpQkFBaUIsRUFBRSw0RUFBNEUsQ0FBQzthQUN2RyxNQUFNLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQTtRQUVyQywyQkFBMkI7UUFDM0IsZ0JBQWdCO1FBQ2hCLDJCQUEyQjtRQUMzQixPQUFPLENBQUMsT0FBTyxDQUFDLDBCQUEwQixDQUFDO2FBQ3RDLEtBQUssQ0FBQyxHQUFHLENBQUM7YUFDVixNQUFNLENBQUMsZ0JBQWdCLEVBQUUsMkJBQTJCLENBQUM7YUFDckQsV0FBVyxDQUFDLHVEQUF1RCxDQUFDO2FBQ3BFLE1BQU0sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFBO1FBRW5DLDJCQUEyQjtRQUMzQix1QkFBdUI7UUFDdkIsMkJBQTJCO1FBQzNCLE9BQU8sQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDO2FBQ3RCLEtBQUssQ0FBQyxHQUFHLENBQUM7YUFDVixXQUFXLENBQUMsMkNBQTJDLENBQUM7WUFDekQseUVBQXlFO2FBQ3hFLE1BQU0sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDO0lBRTVDLENBQUM7SUFFTyxNQUFNLENBQUMsT0FBWTtRQUN2QixJQUFJLElBQUksQ0FBQyxHQUFHLENBQUMsT0FBTyxJQUFJLElBQUk7WUFBRSxNQUFNLElBQUksK0JBQWdCLENBQUMsbUJBQW1CLENBQUE7UUFFNUUsSUFBSSxPQUFPLENBQUMsWUFBWSxJQUFJLElBQUksRUFBRTtZQUM5QixJQUFJLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxjQUFjLEdBQUcsSUFBSSxDQUFBO1lBQ3RDLE9BQU8sQ0FBQyxHQUFHLENBQUMsaUNBQWlDLENBQUMsQ0FBQTtTQUNqRDthQUFNLElBQUksT0FBTyxDQUFDLFNBQVMsSUFBSSxLQUFLLEVBQUU7WUFDbkMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsY0FBYyxHQUFHLEtBQUssQ0FBQTtZQUN2QyxPQUFPLENBQUMsR0FBRyxDQUFDLGtDQUFrQyxDQUFDLENBQUE7U0FDbEQ7YUFBTTtZQUNILE9BQU8sQ0FBQyxHQUFHLENBQUMsc0JBQXNCLENBQUMsQ0FBQTtTQUN0QztJQUNMLENBQUM7SUFFTyxLQUFLLENBQUMsSUFBWSxFQUFFLE9BQVk7UUFDcEMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLENBQUE7UUFDM0IsT0FBTyxDQUFDLEdBQUcsQ0FBQyxVQUFVLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFBO1FBQ3BELElBQUksT0FBTyxDQUFDLE9BQU8sRUFBRTtZQUNqQixJQUFJLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLENBQUE7U0FDcEM7SUFDTCxDQUFDO0lBRU8sTUFBTSxDQUFDLElBQVk7UUFDdkIsSUFBSSxDQUFDLEdBQUcsQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLENBQUE7SUFDaEMsQ0FBQztJQUVPLEdBQUcsQ0FBQyxTQUFpQixFQUFFLGdCQUEwQjtRQUNyRCxJQUFJLFFBQVEsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsRUFBRSxnQkFBZ0IsQ0FBQyxDQUFBO1FBQ3BELElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxDQUFBO0lBQzFCLENBQUM7SUFFTyxNQUFNLENBQUMsU0FBaUIsRUFBRSxnQkFBMEI7UUFDeEQsSUFBSSxRQUFRLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLEVBQUUsZ0JBQWdCLENBQUMsQ0FBQTtRQUNwRCxJQUFJLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsQ0FBQTtJQUM3QixDQUFDO0lBRU8saUJBQWlCLENBQUMsS0FBbUI7UUFDekMsSUFBSSxLQUFLLEdBQUcsS0FBSyxDQUFDLE9BQU8sQ0FBQyxhQUFhLENBQUE7UUFDdkMsSUFBSSxpQkFBaUIsR0FBRyxLQUFLLENBQUMsWUFBWSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLEdBQUcsT0FBTyxDQUFDLENBQUMsT0FBTyxHQUFHLENBQUMsQ0FBQSxDQUFDLENBQUMsQ0FBQyxDQUFBO1FBQy9FLGtDQUFrQztRQUNsQyxpQ0FBaUM7UUFFakMsSUFBSSxLQUFLLENBQUMsU0FBUyxFQUFFO1lBQ2pCLE9BQU8sQ0FBQyxHQUFHLENBQUMsZUFBZSxDQUFDLENBQUE7WUFDNUIsT0FBTTtTQUNUO1FBQ0QsaUNBQWlDO1FBQ2pDLDJCQUEyQjtRQUMzQixpQ0FBaUM7UUFDakMsT0FBTyxDQUFDLEdBQUcsQ0FBQyx1QkFBdUIsR0FBRyxlQUFLLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLENBQUE7UUFFMUUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUE7UUFFekIsaUNBQWlDO1FBQ2pDLDRDQUE0QztRQUM1QyxpQ0FBaUM7UUFFakMsSUFBSyxNQUE4QjtRQUFuQyxXQUFLLE1BQU07WUFBRyx5Q0FBTyxDQUFBO1lBQUUsbUNBQUksQ0FBQTtZQUFFLG1DQUFJLENBQUE7UUFBQyxDQUFDLEVBQTlCLE1BQU0sS0FBTixNQUFNLFFBQXdCO1FBRW5DLFNBQVMsa0JBQWtCLENBQUMsT0FBZTtZQUN2QyxJQUFJLEtBQUssR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxZQUFZLEVBQUUsRUFBRSxPQUFPLEVBQUUsT0FBTyxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUE7WUFDaEUsSUFBSSxDQUFDLEtBQUs7Z0JBQUUsT0FBTyxLQUFLLENBQUE7WUFDeEIsT0FBTyxLQUFLLENBQUMsUUFBUSxDQUFBO1FBQ3pCLENBQUM7UUFFRCxTQUFTLFlBQVksQ0FBQyxZQUFvQjtZQUN0QyxJQUFJLEdBQUcsR0FBRyxDQUFDLENBQUMsV0FBVyxDQUFDLGlCQUFpQixFQUFFLFlBQW1CLENBQUMsQ0FBQTtZQUMvRCxJQUFJLGFBQWEsR0FBRyxpQkFBaUIsQ0FBQyxHQUFHLEdBQUcsQ0FBQyxDQUFDLEtBQUssU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLFlBQVksR0FBRyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsaUJBQWlCLENBQUMsR0FBRyxHQUFHLENBQUMsQ0FBQyxDQUFBO1lBQ2pILElBQUksa0JBQWtCLEdBQUcsaUJBQWlCLENBQUMsR0FBRyxDQUFDLEtBQUssU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLFlBQVksR0FBRyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsaUJBQWlCLENBQUMsR0FBRyxDQUFDLENBQUE7WUFDOUcsd0RBQXdEO1lBQ3hELElBQUksSUFBSSxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxhQUFhLEdBQUcsWUFBWSxDQUFDLEVBQUUsSUFBSSxDQUFDLEdBQUcsQ0FBQyxrQkFBa0IsR0FBRyxZQUFZLENBQUMsQ0FBQyxDQUFBO1lBQ3hHLDBNQUEwTTtZQUUxTSxJQUFJLElBQUksSUFBSSxDQUFDO2dCQUFFLE9BQU8sTUFBTSxDQUFDLE9BQU8sQ0FBQTtZQUNwQyxJQUFJLElBQUksR0FBRyxDQUFDLElBQUksSUFBSSxHQUFHLENBQUM7Z0JBQUUsT0FBTyxNQUFNLENBQUMsSUFBSSxDQUFBO1lBRTVDLElBQUksWUFBWSxHQUFHLENBQUM7Z0JBQUUsT0FBTyxNQUFNLENBQUMsSUFBSSxDQUFBO1lBQ3hDLElBQUksS0FBSyxDQUFDLE1BQU0sR0FBRyxZQUFZLEdBQUcsQ0FBQztnQkFBRSxPQUFPLE1BQU0sQ0FBQyxJQUFJLENBQUE7WUFFdkQsT0FBTyxNQUFNLENBQUMsSUFBSSxDQUFBO1FBQ3RCLENBQUM7UUFFRCxTQUFTLFFBQVEsQ0FBQyxJQUFZO1lBQzFCLElBQUksSUFBSSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsWUFBWSxDQUFDLENBQUE7WUFDbkMsNkJBQTZCO1lBQzdCLElBQUksTUFBTSxHQUFHLEVBQUUsQ0FBQTtZQUNmLEtBQUssSUFBSSxNQUFNLEdBQUcsQ0FBQyxFQUFFLE1BQU0sR0FBRyxJQUFJLENBQUMsTUFBTSxFQUFFLE1BQU0sRUFBRSxFQUFFO2dCQUNqRCxzQkFBc0I7Z0JBQ3RCLElBQUksTUFBTSxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUU7b0JBQ2pCLE1BQU0sSUFBSSxlQUFLLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFBO29CQUNuQyx5Q0FBeUM7aUJBQzVDO3FCQUFNO29CQUNILE1BQU0sSUFBSSxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUE7aUJBQ3pCO2FBQ0o7WUFDRCxPQUFPLE1BQU0sQ0FBQTtRQUNqQixDQUFDO1FBRUQsSUFBSSxRQUFRLEdBQVksS0FBSyxDQUFBO1FBQzdCLElBQUksR0FBRyxHQUFHLEtBQUssQ0FBQyxNQUFNLENBQUE7UUFDdEIsS0FBSyxJQUFJLE9BQU8sR0FBRyxDQUFDLEVBQUUsT0FBTyxHQUFHLEdBQUcsRUFBRSxPQUFPLEVBQUUsRUFBRTtZQUM1QyxJQUFJLE1BQU0sR0FBRyxZQUFZLENBQUMsT0FBTyxDQUFDLENBQUE7WUFFbEMsUUFBUSxNQUFNLEVBQUU7Z0JBQ1osS0FBSyxNQUFNLENBQUMsT0FBTztvQkFDZixPQUFPLENBQUMsR0FBRyxDQUFDLGVBQUssQ0FBQyxHQUFHLENBQUMsV0FBVyxDQUFDLEVBQUUsT0FBTyxFQUFFLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQTtvQkFDOUQsT0FBTyxDQUFDLEdBQUcsQ0FBQyxlQUFLLENBQUMsS0FBSyxDQUFDLFdBQVcsQ0FBQyxFQUFFLE9BQU8sRUFBRSxRQUFRLENBQUMsa0JBQWtCLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFBO29CQUNyRixRQUFRLEdBQUcsS0FBSyxDQUFBO29CQUNoQixNQUFLO2dCQUNULEtBQUssTUFBTSxDQUFDLElBQUk7b0JBQ1osT0FBTyxDQUFDLEdBQUcsQ0FBQyxXQUFXLEVBQUUsT0FBTyxFQUFFLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFBO29CQUNqRCxRQUFRLEdBQUcsS0FBSyxDQUFBO29CQUNoQixNQUFLO2dCQUNULEtBQUssTUFBTSxDQUFDLElBQUk7b0JBQ1osSUFBSSxDQUFDLFFBQVEsRUFBRTt3QkFDWCxRQUFRLEdBQUcsSUFBSSxDQUFBO3dCQUNmLE9BQU8sQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUE7cUJBQ3JCO29CQUNELE1BQUs7YUFDWjtZQUNELCtCQUErQjtTQUNsQztRQUVELE9BQU8sQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUE7SUFDdkIsQ0FBQztJQUVPLE9BQU8sQ0FBQyxJQUFZO1FBQ3hCLElBQUksQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFBO1FBQ3RCLElBQUksTUFBTSxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFBO1FBRS9CLElBQUksS0FBSyxHQUFHLENBQUMsQ0FBQTtRQUNiLEtBQUssSUFBSSxLQUFLLElBQUksTUFBTSxFQUFFO1lBQ3RCLEtBQUssSUFBSSxLQUFLLENBQUMsWUFBWSxDQUFDLE1BQU0sQ0FBQTtTQUNyQztRQUVELHNCQUFzQjtRQUN0QixPQUFPLENBQUMsR0FBRyxDQUFDLEdBQUcsS0FBSyw0QkFBNEIsTUFBTSxDQUFDLE1BQU0saUJBQWlCLENBQUMsQ0FBQTtJQUNuRixDQUFDO0lBRU8sSUFBSSxDQUFDLFNBQTZCLEVBQUUsZ0JBQXNDO1FBQzlFLElBQUksSUFBSSxDQUFDLEdBQUcsQ0FBQyxPQUFPLElBQUksSUFBSTtZQUFFLE1BQU0sSUFBSSwrQkFBZ0IsQ0FBQyxtQkFBbUIsQ0FBQTtRQUU1RSxJQUFJLE1BQU0sR0FBRyxDQUFDLFNBQVMsSUFBSSxTQUFTLENBQUMsQ0FBQTtRQUVyQyxJQUFJLFFBQVEsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsRUFBRSxnQkFBZ0IsQ0FBQyxDQUFBO1FBQ3BELElBQUksSUFBSSxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsV0FBVyxDQUFDLFFBQVEsRUFBRSxPQUFPLENBQUMsT0FBTyxDQUFDLENBQUE7UUFHMUQsSUFBSSxJQUFJLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxxQkFBcUIsRUFBRTtZQUN4QyxPQUFPLENBQUMsR0FBRyxDQUFDLGVBQUssQ0FBQSw2QkFBNkIsSUFBSSxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMscUJBQXFCLHFFQUFxRSxDQUFDLENBQUE7U0FDN0o7YUFBTTtZQUNILE9BQU8sQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUE7WUFDZixPQUFPLENBQUMsR0FBRyxDQUFDLGVBQUssQ0FBQyxTQUFTLENBQUMsZ0ZBQWdGLENBQUMsQ0FBQyxDQUFBO1lBQzlHLE9BQU8sQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUE7U0FDbEI7UUFFRCxJQUFJLE9BQU8sU0FBUyxJQUFJLFdBQVcsRUFBRTtZQUNqQyxJQUFJLElBQUksQ0FBQyxNQUFNLElBQUksQ0FBQyxFQUFFO2dCQUNsQixPQUFPLENBQUMsR0FBRyxDQUFDLGVBQUssQ0FBQyxHQUFHLENBQUMsb0NBQW9DLENBQUMsQ0FBQyxDQUFBO2FBQy9EO2lCQUFNO2dCQUNILE9BQU8sQ0FBQyxHQUFHLENBQUMsc0RBQXNELENBQUMsQ0FBQTthQUN0RTtTQUNKO1FBRUQsTUFBTSxVQUFVLEdBQUcsSUFBSSxrQkFBTyxDQUFDLEdBQUcsQ0FBQyxDQUFBO1FBQ25DLEtBQUssSUFBSSxLQUFLLElBQUksSUFBSSxFQUFFO1lBQ3BCLElBQUksQ0FBQyxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUE7WUFDbEIsSUFBSSxDQUFDLEdBQUcsS0FBSyxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsVUFBVSxDQUFDLENBQUE7WUFFM0MsSUFBSSxDQUFDLElBQUksSUFBSTtnQkFBRSxNQUFNLElBQUksS0FBSyxDQUFDLDREQUE0RCxDQUFDLENBQUMsUUFBUSxFQUFFLEVBQUUsQ0FBQyxDQUFBO1lBRTFHLElBQUksSUFBWSxDQUFBO1lBQ2hCLElBQUksS0FBYSxDQUFBO1lBQ2pCLElBQUksS0FBNkIsQ0FBQTtZQUNqQyxJQUFJLHFCQUFxQixHQUFXLENBQUMsQ0FBQTtZQUVyQyxJQUFJLEtBQUssR0FBd0IsSUFBSSxDQUFBO1lBRXJDLElBQUksQ0FBQyxDQUFDLENBQUMsTUFBTSxFQUFFO2dCQUNYLEtBQUssR0FBRyxHQUFHLENBQUMsY0FBYyxDQUFBO2dCQUMxQixLQUFLLEdBQUcsZUFBSyxDQUFDLFFBQVEsQ0FBQTthQUN6QjtpQkFBTTtnQkFDSCxJQUFJLENBQUMsQ0FBQyxLQUFLLEVBQUU7b0JBQ1QsS0FBSyxHQUFHLEdBQUcsQ0FBQyxHQUFHLENBQUE7b0JBQ2YsS0FBSyxHQUFHLGVBQUssQ0FBQyxJQUFJLENBQUE7aUJBQ3JCO3FCQUFNLElBQUksQ0FBQyxDQUFDLFNBQVMsRUFBRTtvQkFDcEIsS0FBSyxHQUFHLEdBQUcsQ0FBQyxHQUFHLENBQUE7b0JBQ2YsS0FBSyxHQUFHLGVBQUssQ0FBQyxPQUFPLENBQUE7aUJBQ3hCO3FCQUFNLElBQUksQ0FBQyxDQUFDLE1BQU0sRUFBRTtvQkFDakIsS0FBSyxHQUFHLEdBQUcsQ0FBQyxFQUFFLENBQUE7b0JBQ2QsS0FBSyxHQUFHLGVBQUssQ0FBQyxLQUFLLENBQUE7aUJBQ3RCO3FCQUFNO29CQUNILEtBQUssR0FBRyxHQUFHLENBQUMsS0FBSyxDQUFBO29CQUNqQixLQUFLLEdBQUcsZUFBSyxDQUFDLElBQUksQ0FBQTtpQkFDckI7Z0JBRUQsSUFBSSxJQUFJLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxxQkFBcUIsRUFBRTtvQkFDeEMsS0FBSyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsV0FBVyxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQTtvQkFDckMscUJBQXFCLEdBQUcsS0FBSyxDQUFDLG1CQUFtQixDQUFBO2lCQUNwRDthQUNKO1lBRUQsSUFBSSxLQUFLLENBQUMsUUFBUSxFQUFFO2dCQUNoQixJQUFJLEdBQUcsZUFBSyxDQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsR0FBRyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUE7Z0JBQ2pELElBQUksS0FBSyxDQUFDLFNBQVMsRUFBRTtvQkFDakIsSUFBSSxHQUFHLGVBQUssQ0FBQyxHQUFHLENBQUMsZ0JBQWdCLEtBQUssZ0JBQWdCLENBQUMsQ0FBQTtpQkFDMUQ7YUFDSjtpQkFBTTtnQkFDSCxJQUFJLEdBQUcsZUFBSyxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsS0FBSyxFQUFFLENBQUMsQ0FBQTthQUM3QztZQUVELElBQUkscUJBQXFCLEdBQUcsQ0FBQyxFQUFFO2dCQUMzQixJQUFJLElBQUksZUFBSyxDQUFDLElBQUksQ0FBQyxLQUFLLHFCQUFxQix1QkFBdUIsQ0FBQyxDQUFBO2FBQ3hFO1lBQ0QsT0FBTyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQTtZQUVqQixJQUFJLENBQUMsT0FBTyxDQUFDLE9BQU8sSUFBSSxPQUFPLENBQUMsUUFBUSxDQUFDLElBQUksS0FBSyxFQUFFO2dCQUNoRCxJQUFJLENBQUMsaUJBQWlCLENBQUMsS0FBSyxDQUFDLENBQUE7YUFDaEM7U0FDSjtRQUdELElBQUksQ0FBQyxNQUFNLEVBQUU7WUFDVCxPQUFPLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxDQUFBO1lBQ2YsSUFBSSxJQUFJLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUU7Z0JBQ3ZCLElBQUksSUFBSSxDQUFDLEdBQUcsQ0FBQyxzQkFBc0IsQ0FBQyxLQUFLLEVBQUU7b0JBQ3ZDLE9BQU8sQ0FBQyxHQUFHLENBQUMsZUFBSyxDQUFDLEtBQUssQ0FBQyxlQUFlLElBQUksQ0FBQyxHQUFHLENBQUMsc0JBQXNCLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLE9BQU8sRUFBRSxDQUFDO3dCQUN4RyxDQUFDLGVBQUssQ0FBQyxJQUFJLENBQUMsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLDRCQUE0QixFQUFFLENBQUMsQ0FBQyxDQUM3RCxDQUFBO2lCQUNKO3FCQUFNO29CQUNILE9BQU8sQ0FBQyxHQUFHLENBQUMsZUFBSyxDQUFDLEdBQUcsQ0FBQyxrQkFBa0IsSUFBSSxDQUFDLEdBQUcsQ0FBQyw0QkFBNEIsRUFBRSxDQUFDLENBQUMsQ0FBQTtpQkFDcEY7YUFDSjtpQkFBTTtnQkFDSCxPQUFPLENBQUMsR0FBRyxDQUFDLGVBQUssQ0FBQyxHQUFHLENBQUMsbUVBQW1FLENBQUMsQ0FBQyxDQUFBO2FBQzlGO1lBQ0QsT0FBTyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQTtZQUdmLElBQUksSUFBSSxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsY0FBYyxFQUFFO2dCQUNqQyxPQUFPLENBQUMsR0FBRyxDQUFDLCtHQUErRyxDQUFDLENBQUE7YUFDL0g7aUJBQU07Z0JBQ0gsT0FBTyxDQUFDLEdBQUcsQ0FBQyxnR0FBZ0csQ0FBQyxDQUFBO2FBQ2hIO1lBQ0QsT0FBTyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQTtTQUNsQjtJQUVMLENBQUM7SUFFTyxRQUFRLENBQUMsT0FBWTtRQUN6QixJQUFJLEtBQUssR0FBWSxDQUFDLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQTtRQUNwQyxxQ0FBcUM7UUFDckMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxRQUFRLEVBQUUsQ0FBQTtJQUN2QixDQUFDO0NBQ0o7QUF0VkQsaUNBc1ZDIn0=