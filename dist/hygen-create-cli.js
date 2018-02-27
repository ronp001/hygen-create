"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const program = require("commander");
const inquirer = require("inquirer");
const _ = require("lodash");
const chalk_1 = require("chalk");
const cli_app_1 = require("./cli-app");
const hygen_create_1 = require("./hygen-create");
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
            .version('0.1.0')
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
            console.log(chalk_1.default.redBright(`\nNo word set for templatizging files.  Set using 'hygen-create usename <name>'`));
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
                if (this.hgc.session.templatize_using_name) {
                    tinfo = this.hgc.getTemplate(f, null);
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
            if (this.hgc.session.name) {
                if (this.hgc.targetDirForGenerators.isSet) {
                    console.log(chalk_1.default.green(`Target dir: ${this.hgc.targetDirForGenerators.add(this.hgc.session.name).abspath}`) +
                        (program.verbose ? chalk_1.default.gray(`  HYGEN_CREATE_TMPLS=${this.hgc.targetDirForGenerators.abspath}`) : ""));
                }
                else {
                    console.log(chalk_1.default.red("Target template dir not set (export HYGEN_CREATE_TMPLS= to set it)"));
                }
            }
            else {
                console.log(chalk_1.default.red("Generator name not set (use hygen-create rename <name> to set it)"));
            }
            console.log("");
        }
    }
    generate(options) {
        let force = !!options.force;
        // if ( force ) console.log("FORCE!")
        this.hgc.generate(force);
    }
    inquire() {
        inquirer.prompt([]).then(answers => {
            // Use user feedback for... whatever!!
        });
    }
}
exports.default = HygenCreateCli;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaHlnZW4tY3JlYXRlLWNsaS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy9oeWdlbi1jcmVhdGUtY2xpLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUEscUNBQW9DO0FBQ3BDLHFDQUFvQztBQUVwQyw0QkFBMkI7QUFDM0IsaUNBQXlCO0FBQ3pCLHVDQUFnQztBQUVoQyxpREFBMkQ7QUFHM0Qsb0JBQW9DLFNBQVEsZ0JBQU07SUFBbEQ7O1FBRVksUUFBRyxHQUFpQixJQUFJLDBCQUFXLEVBQUUsQ0FBQztJQXVUbEQsQ0FBQztJQXJUYSxhQUFhO1FBRW5CLEVBQUUsQ0FBQyxDQUFFLE9BQU8sQ0FBQyxPQUFRLENBQUMsQ0FBQyxDQUFDO1lBQ3BCLDJEQUEyRDtZQUMzRCwyQkFBMkI7WUFDM0IsSUFBSSxDQUFDLEdBQUcsQ0FBQyxVQUFVLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQTtRQUNyQyxDQUFDO1FBRUQsSUFBSSxtQkFBbUIsR0FBRyxPQUFPLENBQUMsR0FBRyxFQUFFLENBQUE7UUFDdkMsRUFBRSxDQUFDLENBQUUsT0FBTyxDQUFDLE9BQVEsQ0FBQyxDQUFDLENBQUM7WUFDcEIsSUFBSSxDQUFDLEdBQUcsQ0FBQyxpQkFBaUIsR0FBRyxPQUFPLENBQUMsT0FBTyxDQUFBO1FBQ2hELENBQUM7UUFDRCxJQUFJLENBQUMsR0FBRyxDQUFDLDZCQUE2QixDQUFDLG1CQUFtQixDQUFDLENBQUE7SUFDL0QsQ0FBQztJQUVTLFlBQVk7UUFDbEIsc0NBQXNDO1FBQ3RDLElBQUksQ0FBQyxHQUFHLENBQUMsNkJBQTZCLEVBQUUsQ0FBQTtJQUM1QyxDQUFDO0lBRVMsS0FBSztRQUVYLE9BQU87YUFDTixXQUFXLENBQUMsZ0VBQWdFLENBQUM7YUFDN0UsT0FBTyxDQUFDLE9BQU8sQ0FBQzthQUNoQixNQUFNLENBQUMsZUFBZSxFQUFFLG1CQUFtQixDQUFDO2FBQzVDLE1BQU0sQ0FBQywwQkFBMEIsRUFBRSw4Q0FBOEMsMEJBQVcsQ0FB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