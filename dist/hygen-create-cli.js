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
        }
    }
    generate(options) {
        let force = !!options.force;
        // if ( force ) console.log("FORCE!")
        this.hgc.generate(force);
    }
}
exports.default = HygenCreateCli;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaHlnZW4tY3JlYXRlLWNsaS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy9oeWdlbi1jcmVhdGUtY2xpLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUEscUNBQW9DO0FBRXBDLDRCQUEyQjtBQUMzQixpQ0FBeUI7QUFDekIsdUNBQWdDO0FBRWhDLGlEQUEyRDtBQUczRCxvQkFBb0MsU0FBUSxnQkFBTTtJQUFsRDs7UUFFWSxRQUFHLEdBQWlCLElBQUksMEJBQVcsRUFBRSxDQUFDO0lBdVRsRCxDQUFDO0lBclRhLGFBQWE7UUFFbkIsRUFBRSxDQUFDLENBQUUsT0FBTyxDQUFDLE9BQVEsQ0FBQyxDQUFDLENBQUM7WUFDcEIsMkRBQTJEO1lBQzNELDJCQUEyQjtZQUMzQixJQUFJLENBQUMsR0FBRyxDQUFDLFVBQVUsR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFBO1FBQ3JDLENBQUM7UUFFRCxJQUFJLG1CQUFtQixHQUFHLE9BQU8sQ0FBQyxHQUFHLEVBQUUsQ0FBQTtRQUN2QyxFQUFFLENBQUMsQ0FBRSxPQUFPLENBQUMsT0FBUSxDQUFDLENBQUMsQ0FBQztZQUNwQixJQUFJLENBQUMsR0FBRyxDQUFDLGlCQUFpQixHQUFHLE9BQU8sQ0FBQyxPQUFPLENBQUE7UUFDaEQsQ0FBQztRQUNELElBQUksQ0FBQyxHQUFHLENBQUMsNkJBQTZCLENBQUMsbUJBQW1CLENBQUMsQ0FBQTtJQUMvRCxDQUFDO0lBRVMsWUFBWTtRQUNsQixzQ0FBc0M7UUFDdEMsSUFBSSxDQUFDLEdBQUcsQ0FBQyw2QkFBNkIsRUFBRSxDQUFBO0lBQzVDLENBQUM7SUFFUyxLQUFLO1FBRVgsT0FBTzthQUNOLFdBQVcsQ0FBQyxnRUFBZ0UsQ0FBQzthQUM3RSxPQUFPLENBQUMsT0FBTyxDQUFDO2FBQ2hCLE1BQU0sQ0FBQyxlQUFlLEVBQUUsbUJBQW1CLENBQUM7YUFDNUMsTUFBTSxDQUFDLDBCQUEwQixFQUFFLDhDQUE4QywwQkFBVyxDQUFDLHlCQUF5QixHQUFHLENBQUMsQ0FBQTtRQUUzSCwyQkFBMkI7UUFDM0IsbUJBQW1CO1FBQ25CLDJCQUEyQjtRQUMzQixPQUFPLENBQUMsT0FBTyxDQUFDLHdCQUF3QixDQUFDO2FBQ3hDLFdBQVcsQ0FBQyxrRUFBa0UsQ0FBQzthQUMvRSxNQUFNLENBQUMsc0JBQXNCLEVBQUUsK0JBQStCLENBQUM7YUFDL0QsTUFBTSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7UUFFakMsT0FBTyxDQUFDLE9BQU8sQ0FBQyx5QkFBeUIsQ0FBQzthQUN6QyxXQUFXLENBQUMsNkRBQTZELENBQUM7YUFDMUUsTUFBTSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7UUFFbEMsMkJBQTJCO1FBQzNCLDBCQUEwQjtRQUMxQiwyQkFBMkI7UUFDM0IsT0FBTyxDQUFDLE9BQU8sQ0FBQyw4QkFBOEIsQ0FBQzthQUM5QyxXQUFXLENBQUMsNENBQTRDLENBQUM7YUFDekQsTUFBTSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7UUFFL0IsT0FBTyxDQUFDLE9BQU8sQ0FBQyxpQ0FBaUMsQ0FBQzthQUNqRCxLQUFLLENBQUMsSUFBSSxDQUFDO2FBQ1gsV0FBVyxDQUFDLCtDQUErQyxDQUFDO2FBQzVELE1BQU0sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDO1FBRWxDLDJCQUEyQjtRQUMzQixnQ0FBZ0M7UUFDaEMsMkJBQTJCO1FBQzNCLE9BQU8sQ0FBQyxPQUFPLENBQUMsZ0JBQWdCLENBQUM7YUFDaEMsV0FBVyxDQUFDLHdDQUF3QyxDQUFDO2FBQ3JELE1BQU0sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFBO1FBRWxDLDJCQUEyQjtRQUMzQixnQkFBZ0I7UUFDaEIsMkJBQTJCO1FBQzNCLE9BQU8sQ0FBQyxPQUFPLENBQUMsMEJBQTBCLENBQUM7YUFDMUMsS0FBSyxDQUFDLEdBQUcsQ0FBQzthQUNWLE1BQU0sQ0FBQyxnQkFBZ0IsRUFBRSwyQkFBMkIsQ0FBQzthQUNyRCxXQUFXLENBQUMsdURBQXVELENBQUM7YUFDcEUsTUFBTSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUE7UUFFL0IsMkJBQTJCO1FBQzNCLHVCQUF1QjtRQUN2QiwyQkFBMkI7UUFDM0IsT0FBTyxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUM7YUFDMUIsS0FBSyxDQUFDLEdBQUcsQ0FBQzthQUNWLFdBQVcsQ0FBQywyQ0FBMkMsQ0FBQzthQUN4RCxNQUFNLENBQUMsYUFBYSxFQUFFLDhDQUE4QyxDQUFDO2FBQ3JFLE1BQU0sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDO0lBRXhDLENBQUM7SUFFTyxLQUFLLENBQUMsSUFBWSxFQUFFLE9BQVc7UUFDbkMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLENBQUE7UUFDM0IsT0FBTyxDQUFDLEdBQUcsQ0FBQyxVQUFVLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFBO1FBQ3BELEVBQUUsQ0FBQyxDQUFFLE9BQU8sQ0FBQyxPQUFRLENBQUMsQ0FBQyxDQUFDO1lBQ3BCLElBQUksQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsQ0FBQTtRQUNyQyxDQUFDO0lBQ0wsQ0FBQztJQUVPLE1BQU0sQ0FBQyxJQUFZO1FBQ3ZCLElBQUksQ0FBQyxHQUFHLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxDQUFBO0lBQ2hDLENBQUM7SUFFTyxHQUFHLENBQUMsU0FBZ0IsRUFBRSxnQkFBeUI7UUFDbkQsSUFBSSxRQUFRLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLEVBQUUsZ0JBQWdCLENBQUMsQ0FBQTtRQUNwRCxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsQ0FBQTtJQUMxQixDQUFDO0lBRU8sTUFBTSxDQUFDLFNBQWdCLEVBQUUsZ0JBQXlCO1FBQ3RELElBQUksUUFBUSxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxFQUFFLGdCQUFnQixDQUFDLENBQUE7UUFDcEQsSUFBSSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLENBQUE7SUFDN0IsQ0FBQztJQUVPLGlCQUFpQixDQUFDLEtBQW1CO1FBQ3pDLElBQUksS0FBSyxHQUFHLEtBQUssQ0FBQyxPQUFPLENBQUMsYUFBYSxDQUFBO1FBQ3ZDLElBQUksaUJBQWlCLEdBQUcsS0FBSyxDQUFDLFlBQVksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxHQUFFLE1BQU0sQ0FBQyxDQUFDLENBQUMsT0FBTyxHQUFDLENBQUMsQ0FBQSxDQUFBLENBQUMsQ0FBQyxDQUFBO1FBQzNFLGtDQUFrQztRQUNsQyxpQ0FBaUM7UUFFakMsRUFBRSxDQUFBLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUM7WUFDakIsT0FBTyxDQUFDLEdBQUcsQ0FBQyxlQUFlLENBQUMsQ0FBQTtZQUM1QixNQUFNLENBQUE7UUFDVixDQUFDO1FBQ0QsaUNBQWlDO1FBQ2pDLDJCQUEyQjtRQUMzQixpQ0FBaUM7UUFDakMsT0FBTyxDQUFDLEdBQUcsQ0FBQyx1QkFBdUIsR0FBRyxlQUFLLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLENBQUE7UUFFMUUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUE7UUFFekIsaUNBQWlDO1FBQ2pDLDRDQUE0QztRQUM1QyxpQ0FBaUM7UUFFakMsSUFBSyxNQUE4QjtRQUFuQyxXQUFLLE1BQU07WUFBRyx5Q0FBTyxDQUFBO1lBQUUsbUNBQUksQ0FBQTtZQUFFLG1DQUFJLENBQUE7UUFBQyxDQUFDLEVBQTlCLE1BQU0sS0FBTixNQUFNLFFBQXdCO1FBRW5DLDRCQUE0QixPQUFjO1lBQ3RDLElBQUksS0FBSyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLFlBQVksRUFBRSxFQUFDLE9BQU8sRUFBRSxPQUFPLEdBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQTtZQUM1RCxFQUFFLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQztnQkFBQyxNQUFNLENBQUMsS0FBSyxDQUFBO1lBQ3hCLE1BQU0sQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFBO1FBQ3pCLENBQUM7UUFFRCxzQkFBc0IsWUFBbUI7WUFDckMsSUFBSSxHQUFHLEdBQUcsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxpQkFBaUIsRUFBRyxZQUFtQixDQUFDLENBQUE7WUFDaEUsSUFBSSxhQUFhLEdBQUcsaUJBQWlCLENBQUMsR0FBRyxHQUFDLENBQUMsQ0FBQyxLQUFLLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxZQUFZLEdBQUcsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLGlCQUFpQixDQUFDLEdBQUcsR0FBQyxDQUFDLENBQUMsQ0FBQTtZQUM3RyxJQUFJLGtCQUFrQixHQUFHLGlCQUFpQixDQUFDLEdBQUcsQ0FBQyxLQUFLLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxZQUFZLEdBQUcsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLGlCQUFpQixDQUFDLEdBQUcsQ0FBQyxDQUFBO1lBQzlHLHdEQUF3RDtZQUN4RCxJQUFJLElBQUksR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsYUFBYSxHQUFHLFlBQVksQ0FBQyxFQUFFLElBQUksQ0FBQyxHQUFHLENBQUMsa0JBQWtCLEdBQUcsWUFBWSxDQUFDLENBQUMsQ0FBQTtZQUN4RywwTUFBME07WUFFMU0sRUFBRSxDQUFDLENBQUUsSUFBSSxJQUFJLENBQUUsQ0FBQztnQkFBQyxNQUFNLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQTtZQUN0QyxFQUFFLENBQUMsQ0FBRSxJQUFJLEdBQUcsQ0FBQyxJQUFJLElBQUksR0FBRyxDQUFDLENBQUM7Z0JBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUE7WUFFN0MsRUFBRSxDQUFDLENBQUUsWUFBWSxHQUFHLENBQUMsQ0FBQztnQkFBQyxNQUFNLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQTtZQUN6QyxFQUFFLENBQUMsQ0FBRSxLQUFLLENBQUMsTUFBTSxHQUFHLFlBQVksR0FBRyxDQUFDLENBQUM7Z0JBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUE7WUFFeEQsTUFBTSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUE7UUFDdEIsQ0FBQztRQUVELGtCQUFrQixJQUFXO1lBQ3pCLElBQUksSUFBSSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsWUFBWSxDQUFDLENBQUE7WUFDbkMsNkJBQTZCO1lBQzdCLElBQUksTUFBTSxHQUFHLEVBQUUsQ0FBQTtZQUNmLEdBQUcsQ0FBQyxDQUFFLElBQUksTUFBTSxHQUFHLENBQUMsRUFBRSxNQUFNLEdBQUcsSUFBSSxDQUFDLE1BQU0sRUFBRSxNQUFNLEVBQUUsRUFBRyxDQUFDO2dCQUNwRCxzQkFBc0I7Z0JBQ3RCLEVBQUUsQ0FBQyxDQUFFLE1BQU0sR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztvQkFDbkIsTUFBTSxJQUFJLGVBQUssQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUE7b0JBQ25DLHlDQUF5QztnQkFDN0MsQ0FBQztnQkFBQyxJQUFJLENBQUMsQ0FBQztvQkFDSixNQUFNLElBQUksSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFBO2dCQUMxQixDQUFDO1lBQ0wsQ0FBQztZQUNELE1BQU0sQ0FBQyxNQUFNLENBQUE7UUFDakIsQ0FBQztRQUVELElBQUksUUFBUSxHQUFhLEtBQUssQ0FBQTtRQUM5QixJQUFJLEdBQUcsR0FBRyxLQUFLLENBQUMsTUFBTSxDQUFBO1FBQ3RCLEdBQUcsQ0FBQyxDQUFFLElBQUksT0FBTyxHQUFHLENBQUMsRUFBRSxPQUFPLEdBQUcsR0FBRyxFQUFFLE9BQU8sRUFBRSxFQUFHLENBQUM7WUFDL0MsSUFBSSxNQUFNLEdBQUcsWUFBWSxDQUFDLE9BQU8sQ0FBQyxDQUFBO1lBRWxDLE1BQU0sQ0FBQSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7Z0JBQ1osS0FBSyxNQUFNLENBQUMsT0FBTztvQkFDZixPQUFPLENBQUMsR0FBRyxDQUFDLGVBQUssQ0FBQyxHQUFHLENBQUMsV0FBVyxDQUFDLEVBQUUsT0FBTyxFQUFFLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQTtvQkFDOUQsT0FBTyxDQUFDLEdBQUcsQ0FBQyxlQUFLLENBQUMsS0FBSyxDQUFDLFdBQVcsQ0FBQyxFQUFFLE9BQU8sRUFBRSxRQUFRLENBQUMsa0JBQWtCLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFBO29CQUNyRixRQUFRLEdBQUcsS0FBSyxDQUFBO29CQUNoQixLQUFLLENBQUE7Z0JBQ1QsS0FBSyxNQUFNLENBQUMsSUFBSTtvQkFDWixPQUFPLENBQUMsR0FBRyxDQUFDLFdBQVcsRUFBRSxPQUFPLEVBQUUsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUE7b0JBQ2pELFFBQVEsR0FBRyxLQUFLLENBQUE7b0JBQ2hCLEtBQUssQ0FBQTtnQkFDVCxLQUFLLE1BQU0sQ0FBQyxJQUFJO29CQUNaLEVBQUUsQ0FBQyxDQUFFLENBQUMsUUFBUyxDQUFDLENBQUMsQ0FBQzt3QkFDZCxRQUFRLEdBQUcsSUFBSSxDQUFBO3dCQUNmLE9BQU8sQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUE7b0JBQ3RCLENBQUM7b0JBQ0QsS0FBSyxDQUFBO1lBQ2IsQ0FBQztZQUNELCtCQUErQjtRQUNuQyxDQUFDO1FBRUQsT0FBTyxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQTtJQUN2QixDQUFDO0lBRU8sT0FBTyxDQUFDLElBQVc7UUFDdkIsSUFBSSxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUE7UUFDdEIsSUFBSSxNQUFNLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUE7UUFFL0IsSUFBSSxLQUFLLEdBQUcsQ0FBQyxDQUFBO1FBQ2IsR0FBRyxDQUFBLENBQUMsSUFBSSxLQUFLLElBQUksTUFBTSxDQUFDLENBQUMsQ0FBQztZQUN0QixLQUFLLElBQUksS0FBSyxDQUFDLFlBQVksQ0FBQyxNQUFNLENBQUE7UUFDdEMsQ0FBQztRQUVELHNCQUFzQjtRQUN0QixPQUFPLENBQUMsR0FBRyxDQUFDLEdBQUcsS0FBSyw0QkFBNEIsTUFBTSxDQUFDLE1BQU0saUJBQWlCLENBQUMsQ0FBQTtJQUNuRixDQUFDO0lBRU8sSUFBSSxDQUFDLFNBQTBCLEVBQUUsZ0JBQW1DO1FBQ3hFLEVBQUUsQ0FBQyxDQUFFLElBQUksQ0FBQyxHQUFHLENBQUMsT0FBTyxJQUFJLElBQUssQ0FBQztZQUFDLE1BQU0sSUFBSSwrQkFBZ0IsQ0FBQyxtQkFBbUIsQ0FBQTtRQUU5RSxJQUFJLE1BQU0sR0FBRyxDQUFFLFNBQVMsSUFBSSxTQUFTLENBQUUsQ0FBQTtRQUV2QyxJQUFJLFFBQVEsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsRUFBRSxnQkFBZ0IsQ0FBQyxDQUFBO1FBQ3BELElBQUksSUFBSSxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsV0FBVyxDQUFDLFFBQVEsRUFBRSxPQUFPLENBQUMsT0FBTyxDQUFDLENBQUE7UUFHMUQsRUFBRSxDQUFDLENBQUUsSUFBSSxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMscUJBQXNCLENBQUMsQ0FBQyxDQUFDO1lBQzNDLE9BQU8sQ0FBQyxHQUFHLENBQUMsZUFBSyxDQUFBLDZCQUE2QixJQUFJLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxxQkFBcUIscUVBQXFFLENBQUMsQ0FBQTtRQUM5SixDQUFDO1FBQUMsSUFBSSxDQUFDLENBQUM7WUFDSixPQUFPLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxDQUFBO1lBQ2YsT0FBTyxDQUFDLEdBQUcsQ0FBQyxlQUFLLENBQUMsU0FBUyxDQUFDLGlGQUFpRixDQUFDLENBQUMsQ0FBQTtZQUMvRyxPQUFPLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxDQUFBO1FBQ25CLENBQUM7UUFFRCxFQUFFLENBQUMsQ0FBRSxPQUFPLFNBQVMsSUFBSSxXQUFZLENBQUMsQ0FBQyxDQUFDO1lBQ3BDLEVBQUUsQ0FBQyxDQUFFLElBQUksQ0FBQyxNQUFNLElBQUksQ0FBRSxDQUFDLENBQUMsQ0FBQztnQkFDckIsT0FBTyxDQUFDLEdBQUcsQ0FBQyxlQUFLLENBQUMsR0FBRyxDQUFDLG9DQUFvQyxDQUFDLENBQUMsQ0FBQTtZQUNoRSxDQUFDO1lBQUMsSUFBSSxDQUFDLENBQUM7Z0JBQ0osT0FBTyxDQUFDLEdBQUcsQ0FBQyxzREFBc0QsQ0FBQyxDQUFBO1lBQ3ZFLENBQUM7UUFDTCxDQUFDO1FBRUQsR0FBRyxDQUFDLENBQUUsSUFBSSxLQUFLLElBQUksSUFBSyxDQUFDLENBQUMsQ0FBQztZQUN2QixJQUFJLENBQUMsR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFBO1lBQ2xCLElBQUksQ0FBQyxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUMsWUFBWSxFQUFFLENBQUE7WUFFakMsRUFBRSxDQUFDLENBQUUsQ0FBQyxJQUFJLElBQUssQ0FBQztnQkFBQyxNQUFNLElBQUksS0FBSyxDQUFDLDREQUE0RCxDQUFDLENBQUMsUUFBUSxFQUFFLEVBQUUsQ0FBQyxDQUFBO1lBRTVHLElBQUksSUFBYSxDQUFBO1lBQ2pCLElBQUksS0FBYyxDQUFBO1lBQ2xCLElBQUksS0FBMkIsQ0FBQTtZQUMvQixJQUFJLHFCQUFxQixHQUFZLENBQUMsQ0FBQTtZQUV0QyxJQUFJLEtBQUssR0FBeUIsSUFBSSxDQUFBO1lBRXRDLEVBQUUsQ0FBQyxDQUFFLENBQUMsQ0FBQyxDQUFDLE1BQU8sQ0FBQyxDQUFDLENBQUM7Z0JBQ2QsS0FBSyxHQUFHLEdBQUcsQ0FBQyxjQUFjLENBQUE7Z0JBQzFCLEtBQUssR0FBRyxlQUFLLENBQUMsUUFBUSxDQUFBO1lBQzFCLENBQUM7WUFBQyxJQUFJLENBQUMsQ0FBQztnQkFDSixFQUFFLENBQUMsQ0FBRSxDQUFDLENBQUMsS0FBTSxDQUFDLENBQUMsQ0FBQztvQkFDWixLQUFLLEdBQUcsR0FBRyxDQUFDLEdBQUcsQ0FBQTtvQkFDZixLQUFLLEdBQUcsZUFBSyxDQUFDLElBQUksQ0FBQTtnQkFDdEIsQ0FBQztnQkFBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUUsQ0FBQyxDQUFDLFNBQVUsQ0FBQyxDQUFDLENBQUM7b0JBQ3ZCLEtBQUssR0FBRyxHQUFHLENBQUMsR0FBRyxDQUFBO29CQUNmLEtBQUssR0FBRyxlQUFLLENBQUMsT0FBTyxDQUFBO2dCQUN6QixDQUFDO2dCQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBRSxDQUFDLENBQUMsTUFBTyxDQUFDLENBQUMsQ0FBQztvQkFDcEIsS0FBSyxHQUFHLEdBQUcsQ0FBQyxFQUFFLENBQUE7b0JBQ2QsS0FBSyxHQUFHLGVBQUssQ0FBQyxLQUFLLENBQUE7Z0JBQ3ZCLENBQUM7Z0JBQUMsSUFBSSxDQUFDLENBQUM7b0JBQ0osS0FBSyxHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUE7b0JBQ2pCLEtBQUssR0FBRyxlQUFLLENBQUMsSUFBSSxDQUFBO2dCQUN0QixDQUFDO2dCQUVELEVBQUUsQ0FBQyxDQUFFLElBQUksQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLHFCQUFzQixDQUFDLENBQUMsQ0FBQztvQkFDM0MsS0FBSyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsV0FBVyxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQTtvQkFDckMscUJBQXFCLEdBQUcsS0FBSyxDQUFDLG1CQUFtQixDQUFBO2dCQUNyRCxDQUFDO1lBQ0wsQ0FBQztZQUVELEVBQUUsQ0FBQyxDQUFFLEtBQUssQ0FBQyxRQUFTLENBQUMsQ0FBQyxDQUFDO2dCQUNuQixJQUFJLEdBQUcsZUFBSyxDQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsR0FBRyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUE7Z0JBQ2pELEVBQUUsQ0FBQyxDQUFFLEtBQUssQ0FBQyxTQUFVLENBQUMsQ0FBQyxDQUFDO29CQUNwQixJQUFJLEdBQUcsZUFBSyxDQUFDLEdBQUcsQ0FBQyxnQkFBZ0IsS0FBSyxnQkFBZ0IsQ0FBQyxDQUFBO2dCQUMzRCxDQUFDO1lBQ0wsQ0FBQztZQUFDLElBQUksQ0FBQyxDQUFDO2dCQUNKLElBQUksR0FBRyxlQUFLLENBQUMsSUFBSSxDQUFDLGdCQUFnQixLQUFLLEVBQUUsQ0FBQyxDQUFBO1lBQzlDLENBQUM7WUFFRCxFQUFFLENBQUMsQ0FBRSxxQkFBcUIsR0FBRyxDQUFFLENBQUMsQ0FBQyxDQUFDO2dCQUM5QixJQUFJLElBQUksZUFBSyxDQUFDLElBQUksQ0FBQyxLQUFLLHFCQUFxQix1QkFBdUIsQ0FBQyxDQUFBO1lBQ3pFLENBQUM7WUFDRCxPQUFPLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFBO1lBRWpCLEVBQUUsQ0FBQyxDQUFFLENBQUMsT0FBTyxDQUFDLE9BQU8sSUFBSSxPQUFPLENBQUMsUUFBUSxDQUFFLElBQUksS0FBTSxDQUFDLENBQUMsQ0FBQztnQkFDcEQsSUFBSSxDQUFDLGlCQUFpQixDQUFDLEtBQUssQ0FBQyxDQUFBO1lBQ2pDLENBQUM7UUFDTCxDQUFDO1FBR0QsRUFBRSxDQUFDLENBQUUsQ0FBQyxNQUFPLENBQUMsQ0FBQyxDQUFDO1lBQ1osT0FBTyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQTtZQUNmLEVBQUUsQ0FBQyxDQUFFLElBQUksQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLElBQUssQ0FBQyxDQUFDLENBQUM7Z0JBQzFCLEVBQUUsQ0FBQyxDQUFFLElBQUksQ0FBQyxHQUFHLENBQUMsc0JBQXNCLENBQUMsS0FBTSxDQUFDLENBQUMsQ0FBQztvQkFDMUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxlQUFLLENBQUMsS0FBSyxDQUFDLGVBQWUsSUFBSSxDQUFDLEdBQUcsQ0FBQyxzQkFBc0IsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsT0FBTyxFQUFFLENBQUM7d0JBQ3BGLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsZUFBSyxDQUFDLElBQUksQ0FBQyx3QkFBd0IsSUFBSSxDQUFDLEdBQUcsQ0FBQyxzQkFBc0IsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FDekcsQ0FBQTtnQkFDekIsQ0FBQztnQkFBQyxJQUFJLENBQUMsQ0FBQztvQkFDSixPQUFPLENBQUMsR0FBRyxDQUFDLGVBQUssQ0FBQyxHQUFHLENBQUMsb0VBQW9FLENBQUMsQ0FBQyxDQUFBO2dCQUNoRyxDQUFDO1lBQ0wsQ0FBQztZQUFDLElBQUksQ0FBQyxDQUFDO2dCQUNKLE9BQU8sQ0FBQyxHQUFHLENBQUMsZUFBSyxDQUFDLEdBQUcsQ0FBQyxtRUFBbUUsQ0FBQyxDQUFDLENBQUE7WUFDL0YsQ0FBQztZQUNELE9BQU8sQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUE7UUFDbkIsQ0FBQztJQUVMLENBQUM7SUFFTyxRQUFRLENBQUMsT0FBVztRQUN4QixJQUFJLEtBQUssR0FBYSxDQUFDLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQTtRQUNyQyxxQ0FBcUM7UUFDckMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUE7SUFDNUIsQ0FBQztDQUNKO0FBelRELGlDQXlUQyJ9