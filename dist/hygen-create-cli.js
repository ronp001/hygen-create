"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const program = require("commander");
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
            .option('-f, --force', "overwrite generator files even if they exist")
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
            if (this.hgc.session.gen_parent_dir) {
                console.log(`Parent dir generation: ON  (the generator will create a <name> directory as parent for the content)`);
            }
            else {
                console.log("Parent dir generation: OFF (the generator will add content to the current directory)");
            }
            console.log("");
        }
    }
    generate(options) {
        let force = !!options.force;
        // if ( force ) console.log("FORCE!")
        this.hgc.generate(force);
    }
}
exports.default = HygenCreateCli;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaHlnZW4tY3JlYXRlLWNsaS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy9oeWdlbi1jcmVhdGUtY2xpLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUEscUNBQW9DO0FBRXBDLDRCQUEyQjtBQUMzQixpQ0FBeUI7QUFDekIsdUNBQWdDO0FBRWhDLGlEQUEyRDtBQUczRCxvQkFBb0MsU0FBUSxnQkFBTTtJQUFsRDs7UUFFWSxRQUFHLEdBQWlCLElBQUksMEJBQVcsRUFBRSxDQUFDO0lBbVZsRCxDQUFDO0lBalZhLGFBQWE7UUFFbkIsRUFBRSxDQUFDLENBQUUsT0FBTyxDQUFDLE9BQVEsQ0FBQyxDQUFDLENBQUM7WUFDcEIsMkRBQTJEO1lBQzNELDJCQUEyQjtZQUMzQixJQUFJLENBQUMsR0FBRyxDQUFDLFVBQVUsR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFBO1FBQ3JDLENBQUM7UUFFRCxJQUFJLG1CQUFtQixHQUFHLE9BQU8sQ0FBQyxHQUFHLEVBQUUsQ0FBQTtRQUN2QyxFQUFFLENBQUMsQ0FBRSxPQUFPLENBQUMsT0FBUSxDQUFDLENBQUMsQ0FBQztZQUNwQixJQUFJLENBQUMsR0FBRyxDQUFDLGlCQUFpQixHQUFHLE9BQU8sQ0FBQyxPQUFPLENBQUE7UUFDaEQsQ0FBQztRQUNELElBQUksQ0FBQyxHQUFHLENBQUMsNkJBQTZCLENBQUMsbUJBQW1CLENBQUMsQ0FBQTtJQUMvRCxDQUFDO0lBRVMsWUFBWTtRQUNsQixzQ0FBc0M7UUFDdEMsSUFBSSxDQUFDLEdBQUcsQ0FBQyw2QkFBNkIsRUFBRSxDQUFBO0lBQzVDLENBQUM7SUFFUyxLQUFLO1FBRVgsT0FBTzthQUNOLFdBQVcsQ0FBQyxnRUFBZ0UsQ0FBQzthQUM3RSxPQUFPLENBQUMsT0FBTyxDQUFDO2FBQ2hCLE1BQU0sQ0FBQyxlQUFlLEVBQUUsbUJBQW1CLENBQUM7YUFDNUMsTUFBTSxDQUFDLDBCQUEwQixFQUFFLDhDQUE4QywwQkFBVyxDQUFDLHlCQUF5QixHQUFH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