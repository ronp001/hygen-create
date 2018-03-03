import * as program from 'commander'  
import * as fs from "fs"
import * as _ from "lodash"
import chalk from 'chalk'
import {CliApp} from "./cli-app"
import {AbsPath} from "./path_helper"
import {HygenCreate,HygenCreateError} from './hygen-create'
import {TemplateInfo} from './templatizer'

export default class HygenCreateCli extends CliApp {
    
    private hgc : HygenCreate = new HygenCreate();

    protected beforeCommand() {
        
        if ( program.verbose ) {
            // console.log("beforeCommand - project:", program.project)
            // this.hpg.activateDebug()
            this.hgc.outputFunc = console.log
        }

        let project_search_path = process.cwd()
        if ( program.project ) {
            this.hgc.session_file_name = program.project
        }
        this.hgc.setPathAndLoadSessionIfExists(project_search_path)
    }

    protected afterCommand() {
        // this.hpg.outputFunc("afterCommand")
        this.hgc.saveSessionIfActiveAndChanged()
    }

    protected _init() {

        program
        .description('hygen-create - create hygen templates from an existing project')
        .version('0.1.0')
        .option('-v, --verbose', "provide more info")
        .option('-p, --project <filename>', `name of session definitions file (default: ${HygenCreate.default_session_file_name})`)

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
        .action(this.action(this.usename))

        program.command('setopt')
        .description("configure options for the generator")
        .option('--gen-parent-dir', "the resulting generator will create a parent directory (using the hygen --name param)")
        .option('--no-parent-dir', "the resulting generator will not create a parent directory for the content")
        .action(this.action(this.setopt))

        //-------------------------
        // Info commands
        //-------------------------
        program.command('status [file] [files...]')
        .alias('s')
        .option('-l, --detailed', "show detailed information")
        .description("show replacements to be made in (all|specified) files")
        .action(this.action(this.show))

        //-------------------------
        // Generator generation
        //-------------------------
        program.command('generate')
        .alias('g')
        .description("generate a generator from the added files")
        // .option('-f, --force', "overwrite generator files even if they exist")
        .action(this.action(this.generate));
        
    }

    private setopt(options:any) {
        if ( this.hgc.session == null ) throw new HygenCreateError.NoSessionInProgress

        if ( options.genParentDir == true) {
            this.hgc.session.gen_parent_dir = true
            console.log("parent dir generation is now on")
        } else if ( options.parentDir == false ) {
            this.hgc.session.gen_parent_dir = false
            console.log("parent dir generation is now off")
        } else {
            console.log("no options specified")
        }
    }

    private start(name: string, options:any) {
        this.hgc.startSession(name)
        console.log("created " + this.hgc.session_file_name)
        if ( options.usename ) {
            this.hgc.useName(options.usename)
        }
    }

    private rename(name: string) {
        this.hgc.renameSession(name)
    }

    private add(fileOrDir:string, otherFilesOrDirs:string[]) {
        let allfiles = this.fix(fileOrDir, otherFilesOrDirs)
        this.hgc.add(allfiles)
    }

    private remove(fileOrDir:string, otherFilesOrDirs:string[]) {
        let allfiles = this.fix(fileOrDir, otherFilesOrDirs)
        this.hgc.remove(allfiles)
    }

    private printTemplateInfo(tinfo: TemplateInfo) {        
        let lines = tinfo.abspath.contentsLines
        let replacement_lines = tinfo.replacements.map((e) => {return e.linenum-1})
        // console.log(tinfo.replacements)
        // console.log(replacement_lines)
        
        if(tinfo.is_binary) {
            console.log("<binary file>")
            return
        }
        //-------------------------------
        // show the template header
        //-------------------------------
        console.log("hygen template file: " + chalk.bold(tinfo.template_filename))

        console.log(tinfo.header)

        //-------------------------------
        // compare the template to the original file
        //-------------------------------

        enum Action { Explain, Show, Hide }

        function getReplacementLine(linenum:number) : string {
            let entry = _.find(tinfo.replacements, {linenum: linenum+1})
            if (!entry) return "???"
            return entry.new_text
        }

        function chooseAction(for_line_num:number) : Action {
            let idx = _.sortedIndex(replacement_lines,  for_line_num as any) 
            let prev_line_num = replacement_lines[idx-1] === undefined ? (for_line_num - 1000) : replacement_lines[idx-1]
            let following_line_num = replacement_lines[idx] === undefined ? (for_line_num + 1000) : replacement_lines[idx]
            // console.log('following_line_num', following_line_num)
            let dist = Math.min(Math.abs(prev_line_num - for_line_num), Math.abs(following_line_num - for_line_num))
            // console.log('for_line_num', for_line_num, 'l', replacement_lines, 'l[idx]', replacement_lines[idx], 'idx', idx, 'prev_line_num', prev_line_num, 'following_line_num', following_line_num, 'dist', dist)

            if ( dist == 0 ) return Action.Explain
            if ( dist < 4 && dist > 0) return Action.Show

            if ( for_line_num < 2) return Action.Show
            if ( lines.length - for_line_num < 3) return Action.Show

            return Action.Hide
        }

        function colorize(line:string) : string {
            let segs = line.split(/(<%=.*?%>)/)
            // console.log("segs:", segs)
            let result = ""
            for ( let segnum = 0; segnum < segs.length; segnum++ ) {
                // console.log(segnum)
                if ( segnum % 2 == 1) {
                    result += chalk.green(segs[segnum])
                    // console.log(chalk.green(segs[segnum]))
                } else {
                    result += segs[segnum]
                }
            }
            return result
        }
        
        let did_hide : boolean = false
        let len = lines.length
        for ( let linenum = 0; linenum < len; linenum++ ) {
            let action = chooseAction(linenum)

            switch(action) {
                case Action.Explain:
                    console.log(chalk.red("%d -   %s"), linenum, (lines[linenum]))
                    console.log(chalk.green("%d +   %s"), linenum, colorize(getReplacementLine(linenum)))
                    did_hide = false
                    break
                case Action.Show:
                    console.log("%d     %s", linenum, lines[linenum])
                    did_hide = false
                    break
                case Action.Hide:
                    if ( !did_hide ) {
                        did_hide = true
                        console.log("...")
                    }
                    break
            }
            // console.log(linenum, action)
        }

        console.log("----")
    }

    private usename(name:string) {
        this.hgc.useName(name)
        let tinfos = this.hgc.templates
        
        let count = 0
        for(let tinfo of tinfos) {
            count += tinfo.replacements.length
        }

        // console.log(tinfos)
        console.log(`${count} matching lines found in ${tinfos.length} included files`)
    }

    private show(fileOrDir:string|undefined, otherFilesOrDirs:string[]|undefined) {
        if ( this.hgc.session == null ) throw new HygenCreateError.NoSessionInProgress

        let single = ( fileOrDir != undefined ) 

        let allfiles = this.fix(fileOrDir, otherFilesOrDirs)
        let info = this.hgc.getFileInfo(allfiles, program.verbose)

        
        if ( this.hgc.session.templatize_using_name ) {
            console.log(chalk`\nUsing the string "{bold ${this.hgc.session.templatize_using_name}}" to templatize files (Change using 'hygen-create usename <name>')`)
        } else {
            console.log("")
            console.log(chalk.redBright(`\nNo word set for templatizging files.  Set using 'hygen-create usename <name>'`))
            console.log("")
        }

        if ( typeof fileOrDir == "undefined" ) {
            if ( info.length == 0 ) {
                console.log(chalk.red("No files included in the generator"))
            } else {
                console.log("\nThe following files are included in the generator:")
            }
        }

        for ( let finfo of info ) {
            let p = finfo.path
            let f = finfo.path.relativeFrom()

            if ( f == null ) throw new Error(`unexpected error - could not calculate relative path for ${p.toString()}`)

            let line : string
            let fname : string
            let color : (param:any)=>string
            let num_replacement_lines : number = 0

            let tinfo : TemplateInfo | null = null

            if ( !p.exists ) {
                fname = `${f} (not found)`
                color = chalk.bgYellow
            } else {
                if ( p.isDir ) {
                    fname = `${f}/`
                    color = chalk.blue
                } else if ( p.isSymLink ) {
                    fname = `${f}@`
                    color = chalk.magenta
                } else if ( p.isFile ) {
                    fname = `${f}`
                    color = chalk.green
                } else {
                    fname = `${f}???`
                    color = chalk.cyan
                }

                if ( this.hgc.session.templatize_using_name ) {
                    tinfo = this.hgc.getTemplate(f, null)
                    num_replacement_lines = tinfo.numReplacementLines
                }
            }

            if ( finfo.included ) {
                line = chalk.blue('[included] - ') + color(fname)
                if ( finfo.is_binary ) {
                    line = chalk.red(`[ignored ] - ${fname} (binary file)`)
                }
            } else {
                line = chalk.gray(`[excluded] - ${fname}`)
            }

            if ( num_replacement_lines > 0 ) {
                line += chalk.blue(` [${num_replacement_lines} lines parameterized]`)
            }
            console.log(line)

            if ( (program.verbose || program.detailed ) && tinfo ) {
                this.printTemplateInfo(tinfo)
            }
        }

        
        if ( !single ) {
            console.log("")
            if ( this.hgc.session.name ) {
                if ( this.hgc.targetDirForGenerators.isSet ) {
                    console.log(chalk.green(`Target dir: ${this.hgc.targetDirForGenerators.add(this.hgc.session.name).abspath}`) +  
                                            (chalk.gray(`  ${this.hgc.targetDirForGeneratorsReason}`)) 
                                        )
                } else {
                    console.log(chalk.red(`No target dir: ${this.hgc.targetDirForGeneratorsReason}`))
                }
            } else {
                console.log(chalk.red("Generator name not set (use hygen-create rename <name> to set it)"))
            }    
            console.log("")


            if ( this.hgc.session.gen_parent_dir ) {
                console.log(`Parent dir generation: ON  (the resulting generator will create a <name> directory as parent for the content)`)
            } else {
                console.log("Parent dir generation: OFF (the resulting generator will add content to the current directory)")
            }
            console.log("")
        }
 
    }

    private generate(options:any) {
        let force : boolean = !!options.force
        // if ( force ) console.log("FORCE!")
        this.hgc.generate()
    }
}