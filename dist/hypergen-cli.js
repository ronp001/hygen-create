"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const program = require("commander");
const inquirer = require("inquirer");
const _ = require("lodash");
const chalk_1 = require("chalk");
const cli_app_1 = require("./cli-app");
const hypergen_1 = require("./hypergen");
class HypergenCli extends cli_app_1.CliApp {
    constructor() {
        super(...arguments);
        this.hpg = new hypergen_1.Hypergen();
    }
    beforeCommand() {
        if (program.verbose) {
            // console.log("beforeCommand - project:", program.project)
            // this.hpg.activateDebug()
            this.hpg.outputFunc = console.log;
        }
        this.hpg.setPathAndLoadSessionIfExists(process.cwd());
    }
    afterCommand() {
        // this.hpg.outputFunc("afterCommand")
        this.hpg.saveSessionIfActiveAndChanged();
    }
    _init() {
        program
            .description('hypergen - create hygen templates from an existing project')
            .version('0.1.0')
            .option('-v, --verbose', "provide more info");
        // .option('-p, --project <path>', "path to project file (default: scan up from current dir)")
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
            .option('-f, --force', "overwrite generator files even if they exist")
            .action(this.action(this.generate));
    }
    start(name, options) {
        this.hpg.startSession(name);
        console.log("created " + this.hpg.session_file_name);
        if (options.usename) {
            this.hpg.useName(options.usename);
        }
    }
    rename(name) {
        this.hpg.renameSession(name);
    }
    add(fileOrDir, otherFilesOrDirs) {
        let allfiles = this.fix(fileOrDir, otherFilesOrDirs);
        this.hpg.add(allfiles);
    }
    remove(fileOrDir, otherFilesOrDirs) {
        let allfiles = this.fix(fileOrDir, otherFilesOrDirs);
        this.hpg.remove(allfiles);
    }
    printTemplateInfo(tinfo) {
        let lines = tinfo.abspath.contentsLines;
        let replacement_lines = tinfo.replacements.map((e) => { return e.linenum - 1; });
        // console.log(tinfo.replacements)
        // console.log(replacement_lines)
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
        this.hpg.useName(name);
        let tinfos = this.hpg.templates;
        let count = 0;
        for (let tinfo of tinfos) {
            count += tinfo.replacements.length;
        }
        // console.log(tinfos)
        console.log(`${count} matching lines found in ${tinfos.length} included files`);
    }
    show(fileOrDir, otherFilesOrDirs) {
        if (this.hpg.session == null)
            throw new hypergen_1.HypergenError.NoSessionInProgress;
        let single = (fileOrDir != undefined);
        let allfiles = this.fix(fileOrDir, otherFilesOrDirs);
        let info = this.hpg.getFileInfo(allfiles, program.verbose);
        if (this.hpg.session.templatize_using_name) {
            console.log(chalk_1.default `\nUsing the string "{bold ${this.hpg.session.templatize_using_name}}" to templatize files (Change using 'hypergen usename <name>')`);
        }
        else {
            console.log("");
            console.log(chalk_1.default.redBright(`\nNo word set for templatizging files.  Set using 'hypergen usename <name>'`));
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
        for (let finfo of info) {
            let p = finfo.path;
            let f = finfo.path.relativeFrom();
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
                if (this.hpg.session.templatize_using_name) {
                    tinfo = this.hpg.getTemplate(f, null);
                    num_replacement_lines = tinfo.numReplacementLines;
                }
            }
            if (finfo.included) {
                line = chalk_1.default.blue('[included] - ') + color(fname);
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
            if (this.hpg.session.name) {
                if (this.hpg.targetDirForGenerators.isSet) {
                    console.log(chalk_1.default.green(`Target dir: ${this.hpg.targetDirForGenerators.add(this.hpg.session.name).abspath}`) +
                        (program.verbose ? chalk_1.default.gray(`  HYPERGEN_TMPLS=${this.hpg.targetDirForGenerators.abspath}`) : ""));
                }
                else {
                    console.log(chalk_1.default.red("Target template dir not set (export HYPERGEN_TMPLS= to set it)"));
                }
            }
            else {
                console.log(chalk_1.default.red("Generator name not set (use hypergen rename <name> to set it)"));
            }
            console.log("");
        }
    }
    generate(options) {
        let force = !!options.force;
        // if ( force ) console.log("FORCE!")
        this.hpg.generate(force);
    }
    inquire() {
        inquirer.prompt([]).then(answers => {
            // Use user feedback for... whatever!!
        });
    }
}
exports.default = HypergenCli;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaHlwZXJnZW4tY2xpLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vc3JjL2h5cGVyZ2VuLWNsaS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFBLHFDQUFvQztBQUNwQyxxQ0FBb0M7QUFFcEMsNEJBQTJCO0FBQzNCLGlDQUF5QjtBQUN6Qix1Q0FBZ0M7QUFDaEMseUNBQWlEO0FBR2pELGlCQUFpQyxTQUFRLGdCQUFNO0lBQS9DOztRQUVZLFFBQUcsR0FBYyxJQUFJLG1CQUFRLEVBQUUsQ0FBQztJQW9UNUMsQ0FBQztJQWxUYSxhQUFhO1FBRW5CLEVBQUUsQ0FBQyxDQUFFLE9BQU8sQ0FBQyxPQUFRLENBQUMsQ0FBQyxDQUFDO1lBQ3BCLDJEQUEyRDtZQUMzRCwyQkFBMkI7WUFDM0IsSUFBSSxDQUFDLEdBQUcsQ0FBQyxVQUFVLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQTtRQUNyQyxDQUFDO1FBRUQsSUFBSSxDQUFDLEdBQUcsQ0FBQyw2QkFBNkIsQ0FBQyxPQUFPLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQTtJQUN6RCxDQUFDO0lBRVMsWUFBWTtRQUNsQixzQ0FBc0M7UUFDdEMsSUFBSSxDQUFDLEdBQUcsQ0FBQyw2QkFBNkIsRUFBRSxDQUFBO0lBQzVDLENBQUM7SUFFUyxLQUFLO1FBRVgsT0FBTzthQUNOLFdBQVcsQ0FBQyw0REFBNEQsQ0FBQzthQUN6RSxPQUFPLENBQUMsT0FBTyxDQUFDO2FBQ2hCLE1BQU0sQ0FBQyxlQUFlLEVBQUUsbUJBQW1CLENBQUMsQ0FBQTtRQUM3Qyw4RkFBOEY7UUFFOUYsMkJBQTJCO1FBQzNCLG1CQUFtQjtRQUNuQiwyQkFBMkI7UUFDM0IsT0FBTyxDQUFDLE9BQU8sQ0FBQyx3QkFBd0IsQ0FBQzthQUN4QyxXQUFXLENBQUMsa0VBQWtFLENBQUM7YUFDL0UsTUFBTSxDQUFDLHNCQUFzQixFQUFFLCtCQUErQixDQUFDO2FBQy9ELE1BQU0sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FB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