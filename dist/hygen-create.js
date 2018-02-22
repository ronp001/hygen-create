"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const path_helper_1 = require("./path_helper");
const templatizer_1 = require("./templatizer");
const chalk_1 = require("chalk");
class HygenCreateError extends Error {
    constructor(msg) {
        super(msg);
        this.msg = msg;
    }
    get message() { return "hygen-create - " + this.msg; }
}
exports.HygenCreateError = HygenCreateError;
(function (HygenCreateError) {
    class NoSessionInProgress extends HygenCreateError {
        constructor() { super("no hygen-create session definitions file found ('hygen-create start' to create one)"); }
    }
    HygenCreateError.NoSessionInProgress = NoSessionInProgress;
    class FromNameNotDefined extends HygenCreateError {
        constructor() { super("'name word' not specified (run 'hygen-create usename' to set)"); }
    }
    HygenCreateError.FromNameNotDefined = FromNameNotDefined;
    class CantParseSessionFile extends HygenCreateError {
        constructor(file) { super(`can't parse session file - ${file}`); }
    }
    HygenCreateError.CantParseSessionFile = CantParseSessionFile;
    class SessionInProgress extends HygenCreateError {
        constructor() { super("hygen-create session already in progress"); }
    }
    HygenCreateError.SessionInProgress = SessionInProgress;
    class NothingToGenerate extends HygenCreateError {
        constructor() { super("nothing to generate"); }
    }
    HygenCreateError.NothingToGenerate = NothingToGenerate;
    class NoFilesAdded extends HygenCreateError {
        constructor() { super("no files added"); }
    }
    HygenCreateError.NoFilesAdded = NoFilesAdded;
    class TargetPathNotSet extends HygenCreateError {
        constructor() { super("target path for templates not set (use 'export HYGEN_CREATE_TMPLS=')"); }
    }
    HygenCreateError.TargetPathNotSet = TargetPathNotSet;
    class NoSuchPath extends HygenCreateError {
        constructor(file) { super(`can't find path ${file}`); }
    }
    HygenCreateError.NoSuchPath = NoSuchPath;
    class FileNotFound extends HygenCreateError {
        constructor(file) { super(`file not found: ${file}`); }
    }
    HygenCreateError.FileNotFound = FileNotFound;
    class InvalidSessionFile extends HygenCreateError {
        constructor(file) { super(`invalid session file -- [${file}]`); }
    }
    HygenCreateError.InvalidSessionFile = InvalidSessionFile;
    class InvalidSessionFileVersion extends HygenCreateError {
        constructor(file, version) { super(`invalid session file version (${version})-- ${file}`); }
    }
    HygenCreateError.InvalidSessionFileVersion = InvalidSessionFileVersion;
    class TryingToStartSessionWithoutPath extends HygenCreateError {
        constructor() { super(`session can only be started after valid path is set`); }
    }
    HygenCreateError.TryingToStartSessionWithoutPath = TryingToStartSessionWithoutPath;
    class AddedFileMustBeUnderBaseDir extends HygenCreateError {
        constructor(file, basedir) { super(`cannot add ${file} - not under base dir (${basedir})`); }
    }
    HygenCreateError.AddedFileMustBeUnderBaseDir = AddedFileMustBeUnderBaseDir;
})(HygenCreateError = exports.HygenCreateError || (exports.HygenCreateError = {}));
class HygenCreateSession {
    constructor() {
        this.about = "This is a hygen-create definitions file. The hygen-create utility creates generators that can be executed using hygen.";
        this.hygen_create_version = "0.1.0";
        this.name = "";
        this.files_and_dirs = {};
        this.templatize_using_name = null;
    }
    static arrayToFilesHash(arr) {
        let result = {};
        for (let f of arr) {
            result[f] = true;
        }
        return result;
    }
}
exports.HygenCreateSession = HygenCreateSession;
class HygenCreate {
    constructor() {
        this.session = null;
        this.session_file_name = HygenCreate.default_session_file_name;
        this.session_file_path = new path_helper_1.AbsPath(null);
        this.session_base_dir = new path_helper_1.AbsPath(null);
        this.orig_session_json = ""; // used to check if the state was changed and needs saving
        this._debug_on = false;
        this.output = console.log;
        this.debug = this.noOutput;
    }
    get targetDirForGenerators() {
        return new path_helper_1.AbsPath(process.env.HYGEN_CREATE_TMPLS);
    }
    get targetDirForGenerator() {
        if (this.session == null)
            return new path_helper_1.AbsPath(null);
        if (this.session.name == "")
            return new path_helper_1.AbsPath(null);
        return this.targetDirForGenerators.add(this.session.name).add('new');
    }
    get fileCount() {
        if (this.session == null)
            return 0;
        return Object.keys(this.session.files_and_dirs).length;
    }
    /**
     * Where to find the current session file
     *
     * @return AbsPath object pointing to the file.  If not set, AbsPath(null).
     */
    get pathToCurrentSessionFile() {
        return this.session_file_path;
    }
    get debugOn() {
        return this._debug_on;
    }
    activateDebug() {
        this.debug = console.log;
    }
    noOutput(...args) { }
    set outputFunc(out_func) {
        this.output = out_func;
    }
    get outputFunc() { return this.output; }
    set debugFunc(out_func) {
        this.debug = out_func;
    }
    /**
     * binds the HygenCreate instance to a specific path.
     * if a session already exists for this path (i.e., a session file exists in this directory or in one
     * of its ancestors) loads the session. the location of the session file marks the topmost directory
     * in the interactive session.
     *
     * @param for_path: <directory | file>
     *
     *                  if directory: indicates where to start looking for the hygen-create session file.
     *                  if no session file found this is where a new one should be created if necessary
     *
     *                  if file: path to a session file
     */
    setPathAndLoadSessionIfExists(for_path) {
        this.debug("HygenCreate starting:", for_path);
        let p = new path_helper_1.AbsPath(for_path);
        if (p.isDir) {
            let path_to_file = p.findUpwards(this.session_file_name);
            if (path_to_file.isFile) {
                p = path_to_file;
            }
        }
        if (p.isFile) {
            // load the session file
            let sessionfile_contents = p.contentsFromJSON;
            if (sessionfile_contents == null) {
                throw new HygenCreateError.CantParseSessionFile(p.abspath);
            }
            // verify the structure
            let versionstr = sessionfile_contents['hygen_create_version'];
            if (!versionstr || !versionstr.split)
                throw new HygenCreateError.InvalidSessionFile(p.abspath);
            let version = sessionfile_contents['hygen_create_version'].split('.').map((n) => { return parseInt(n); });
            if (isNaN(version[0]) || isNaN(version[1]) || isNaN(version[2])) {
                if (this.debugOn) {
                    console.log("hygen_create_version", sessionfile_contents['hygen_create_version']);
                    console.log("version", version);
                    console.log("sessionfile contents", sessionfile_contents);
                }
                throw new HygenCreateError.InvalidSessionFile(p.abspath);
            }
            if (version[0] > 0 || version[1] > 1) {
                throw new HygenCreateError.InvalidSessionFileVersion(p.abspath, version);
            }
            // convert arrays to hashes if necessary
            if (sessionfile_contents.files_and_dirs instanceof Array) {
                sessionfile_contents.files_and_dirs = HygenCreateSession.arrayToFilesHash(sessionfile_contents.files_and_dirs);
            }
            // create the session object
            this.session = Object.assign(new HygenCreateSession, sessionfile_contents);
            this.session_file_path = p;
            this.session_base_dir = p.parent;
            this.orig_session_json = JSON.stringify(this.session);
            return true;
        }
        else if (p.isDir) {
            this.session_base_dir = p;
            this.session_file_path = this.session_base_dir.add(this.session_file_name);
            return false;
        }
        else {
            throw new HygenCreateError.NoSuchPath(p.abspath);
        }
    }
    /**
     * returns true if a session was started - either by loading one (when setPathAndLoadSessionIfExists was called)
     * or via start()
     */
    get isSessionActive() {
        return this.session != null;
    }
    /**
     * @returns true if there is an active session and it has been modified since loaded, or if it's new
     */
    get doesSessionNeedSaving() {
        this.debug("this.session", JSON.stringify(this.session));
        this.debug("this.orig_session_json", this.orig_session_json);
        if (!this.session)
            return false;
        return JSON.stringify(this.session) != this.orig_session_json;
    }
    /**
     * @returns true if session required saving, false otherwise
     */
    saveSessionIfActiveAndChanged() {
        if (this.doesSessionNeedSaving) {
            this.debug("saving session");
            this.session_file_path.saveStrSync(JSON.stringify(this.session, null, 2));
            return true;
        }
        this.debug("session does not need saving");
        return false;
    }
    /**
     * start a new session
     *
     * throws error if another session is already in progress
     */
    startSession(name) {
        if (this.session != null)
            throw new HygenCreateError.SessionInProgress;
        if (!this.session_base_dir.isDir)
            throw new HygenCreateError.TryingToStartSessionWithoutPath;
        this.session = new HygenCreateSession;
        this.session.name = name;
        this.session.files_and_dirs[this.session_file_name] = true;
    }
    renameSession(name) {
        if (this.session == null)
            throw new HygenCreateError.NoSessionInProgress;
        this.session.name = name;
    }
    /**
     * cancel the current session and delete the session file
     */
    abort() {
        if (this.session == null)
            throw new HygenCreateError.NoSessionInProgress;
        this.session = null;
        if (this.session_file_path.isFile) {
            this.session_file_path.rmFile();
        }
    }
    add(files_and_dirs, recursive = false, in_subdir = false) {
        if (this.session == null)
            throw new HygenCreateError.NoSessionInProgress;
        if (this.session_base_dir == null)
            throw new HygenCreateError.NoSessionInProgress;
        for (let file of files_and_dirs) {
            let p = path_helper_1.AbsPath.fromStringAllowingRelative(file);
            if (!p.exists) {
                throw new HygenCreateError.FileNotFound(p.toString());
            }
            let relpath = p.relativeTo(this.session_base_dir, true);
            if (relpath == null) {
                throw new HygenCreateError.AddedFileMustBeUnderBaseDir(p.toString(), this.session_base_dir.toString());
            }
            if (p.isFile || p.isSymLink) {
                if (this.session.files_and_dirs[relpath]) {
                    this.output("already added:", relpath);
                }
                else {
                    this.output("adding: ", relpath);
                    this.session.files_and_dirs[relpath] = true;
                    this.debug("session after add", this.session);
                }
            }
            else if (p.isDir) {
                if (in_subdir && !recursive) {
                    this.debug("not recursive - ignoring subdir", relpath);
                }
                else {
                    let contents = p.dirContents;
                    if (contents == null || contents == []) {
                        this.output("not adding empty directory: ", relpath);
                    }
                    else {
                        this.output("adding directory: ", relpath);
                        this.add(contents.map(e => e.toString()), recursive, true);
                    }
                }
            }
            else {
                this.output("not adding", relpath, "-- illegal file type");
            }
        }
    }
    remove(files) {
        if (this.session == null)
            throw new HygenCreateError.NoSessionInProgress;
        if (this.session_base_dir == null)
            throw new HygenCreateError.NoSessionInProgress;
        for (let file of files) {
            let p = path_helper_1.AbsPath.fromStringAllowingRelative(file);
            let relpath = p.relativeTo(this.session_base_dir, true);
            if (relpath == null) {
                throw new HygenCreateError.AddedFileMustBeUnderBaseDir(p.toString(), this.session_base_dir.toString());
            }
            if (this.session.files_and_dirs[relpath] == true) {
                this.output("removing from generator:", relpath);
                delete (this.session.files_and_dirs[relpath]);
            }
            else {
                this.output("was not previously added: ", relpath);
            }
        }
    }
    /**
     * get the definition of param
     *
     * @param param the param to query
     * @returns word that is converted into this param, or null if param is not defined
     */
    getWordConversion(word) {
        if (this.session == null)
            throw new HygenCreateError.NoSessionInProgress;
        return this.session.templatize_using_name;
    }
    /**
     * generate templates for all files that are included in the current session
     *
     * @param from_name the word to replace with <%= name %> in the included files
     * @returns information about the would-be generated templates
     */
    getTemplatesUsingName(from_name) {
        if (this.session == null)
            throw new HygenCreateError.NoSessionInProgress;
        let result = [];
        for (let file in this.session.files_and_dirs) {
            if (this.session.files_and_dirs[file]) {
                result.push(this.getTemplate(file, from_name));
            }
        }
        return result;
    }
    /**
     * generate a template from a single file
     *
     * @param relpath relative path to the original file
     * @param using_name word to use for templatization of the <%= name %> variable
     */
    getTemplate(relpath, using_name) {
        if (this.session == null)
            throw new HygenCreateError.NoSessionInProgress;
        if (using_name == null) {
            if (this.session.templatize_using_name == null)
                throw new HygenCreateError.FromNameNotDefined;
            using_name = this.session.templatize_using_name;
        }
        let abspath = this.fileAbsPathFromRelPath(relpath);
        let tinfo = templatizer_1.Templatizer.process(relpath, abspath, using_name);
        return tinfo;
    }
    get templates() {
        if (this.session == null)
            throw new HygenCreateError.NoSessionInProgress;
        if (this.session.templatize_using_name == null)
            throw new HygenCreateError.FromNameNotDefined;
        return this.getTemplatesUsingName(this.session.templatize_using_name);
    }
    useName(name) {
        if (this.session == null)
            throw new HygenCreateError.NoSessionInProgress;
        if (this.session.templatize_using_name == name) {
            this.output(`already using '${name}' to templatize files`);
        }
        else {
            let prev = this.session.templatize_using_name;
            this.session.templatize_using_name = name;
            if (prev) {
                this.output(`using '${name}' as templatization word (instead of '${prev}')`);
            }
            else {
                this.output(`using '${name}' as templatization word`);
            }
        }
    }
    paramInfo(param) {
        if (param) {
            return `details for ${param}`;
        }
        else {
            return "details for all params";
        }
    }
    fileAbsPathFromRelPath(relpath) {
        return path_helper_1.AbsPath.fromStringAllowingRelative(relpath, this.session_base_dir.toString());
    }
    getFileInfo(files, verbose) {
        if (this.session == null)
            throw new HygenCreateError.NoSessionInProgress;
        if (this.session_base_dir == null)
            throw new HygenCreateError.NoSessionInProgress;
        let result = [];
        if (files instanceof Array && files.length == 0) {
            let existing_files = this.session.files_and_dirs;
            for (let file in existing_files) {
                let abspath = this.fileAbsPathFromRelPath(file);
                files.push(abspath.toString());
            }
        }
        for (let file of files) {
            let p = path_helper_1.AbsPath.fromStringAllowingRelative(file);
            let relpath_from_top = p.relativeFrom(this.session_base_dir.toString());
            let included = false;
            let found = false;
            if (relpath_from_top != null) {
                found = true;
                included = this.session.files_and_dirs[relpath_from_top] == true;
            }
            let fileinfo = {
                path: p,
                included: included,
                found: found
            };
            result.push(fileinfo);
        }
        return result;
    }
    generate(force = false) {
        if (this.session == null)
            throw new HygenCreateError.NoSessionInProgress;
        if (this.fileCount == 0)
            throw new HygenCreateError.NothingToGenerate;
        if (!this.targetDirForGenerator.isSet)
            throw new HygenCreateError.TargetPathNotSet;
        this.output("target path: ", this.targetDirForGenerators.toString());
        for (let file in this.session.files_and_dirs) {
            if (this.session.files_and_dirs[file]) {
                this.generateTemplateForFile(file, force);
            }
        }
    }
    generateTemplateForFile(relpath, force = false) {
        if (this.session == null)
            throw new HygenCreateError.NoSessionInProgress;
        if (!this.targetDirForGenerator.isSet)
            throw new HygenCreateError.TargetPathNotSet;
        let input_file = this.fileAbsPathFromRelPath(relpath);
        if (!input_file.isFile) {
            this.output(`generate ${input_file.toString()}: only regular files are currently supported`);
            return;
        }
        // let output_file = this.targetDirForGenerator.add(relpath.replace('/','_') + ".ejs.t")
        let output_file = this.targetDirForGenerator.add(templatizer_1.Templatizer.template_filename(relpath));
        if (!force && output_file.exists) {
            this.output("file exists (not overwriting):", output_file.abspath);
        }
        else {
            if (force) {
                this.output(chalk_1.default.red("overwriting: " + output_file.abspath));
            }
            else {
                this.output("generating:", output_file.abspath);
            }
            // this.output(this.getTemplateTextFor(relpath, input_file))
            output_file.saveStrSync(this.getTemplateTextFor(relpath));
        }
    }
    getTemplateTextFor(relpath) {
        let tinfo = this.getTemplate(relpath, null);
        return tinfo.header + tinfo.contentsAfterReplacements;
    }
}
HygenCreate.default_session_file_name = "hygen-create.json";
exports.HygenCreate = HygenCreate;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaHlnZW4tY3JlYXRlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vc3JjL2h5Z2VuLWNyZWF0ZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFBLCtDQUFxQztBQUNyQywrQ0FBdUQ7QUFDdkQsaUNBQXlCO0FBSXpCLHNCQUE4QixTQUFRLEtBQUs7SUFDdkMsWUFBbUIsR0FBVztRQUFHLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQTtRQUF4QixRQUFHLEdBQUgsR0FBRyxDQUFRO0lBQWEsQ0FBQztJQUM1QyxJQUFXLE9BQU8sS0FBSyxNQUFNLENBQUMsaUJBQWlCLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQSxDQUFDLENBQUM7Q0FDL0Q7QUFIRCw0Q0FHQztBQUVELFdBQWlCLGdCQUFnQjtJQUM3Qix5QkFBaUMsU0FBUSxnQkFBZ0I7UUFBRyxnQkFBZ0IsS0FBSyxDQUFDLHFGQUFxRixDQUFDLENBQUEsQ0FBRSxDQUFDO0tBQUU7SUFBaEssb0NBQW1CLHNCQUE2SSxDQUFBO0lBQzdLLHdCQUFnQyxTQUFRLGdCQUFnQjtRQUFHLGdCQUFnQixLQUFLLENBQUMsK0RBQStELENBQUMsQ0FBQSxDQUFFLENBQUM7S0FBRTtJQUF6SSxtQ0FBa0IscUJBQXVILENBQUE7SUFDdEosMEJBQWtDLFNBQVEsZ0JBQWdCO1FBQUcsWUFBWSxJQUFnQixJQUFJLEtBQUssQ0FBQyw4QkFBOEIsSUFBSSxFQUFFLENBQUMsQ0FBQSxDQUFFLENBQUM7S0FBRTtJQUFoSSxxQ0FBb0IsdUJBQTRHLENBQUE7SUFDN0ksdUJBQStCLFNBQVEsZ0JBQWdCO1FBQUcsZ0JBQWdCLEtBQUssQ0FBQywwQ0FBMEMsQ0FBQyxDQUFBLENBQUUsQ0FBQztLQUFFO0lBQW5ILGtDQUFpQixvQkFBa0csQ0FBQTtJQUNoSSx1QkFBK0IsU0FBUSxnQkFBZ0I7UUFBRyxnQkFBZ0IsS0FBSyxDQUFDLHFCQUFxQixDQUFDLENBQUEsQ0FBRSxDQUFDO0tBQUU7SUFBOUYsa0NBQWlCLG9CQUE2RSxDQUFBO0lBQzNHLGtCQUEwQixTQUFRLGdCQUFnQjtRQUFHLGdCQUFnQixLQUFLLENBQUMsZ0JBQWdCLENBQUMsQ0FBQSxDQUFFLENBQUM7S0FBRTtJQUFwRiw2QkFBWSxlQUF3RSxDQUFBO0lBQ2pHLHNCQUE4QixTQUFRLGdCQUFnQjtRQUFHLGdCQUFnQixLQUFLLENBQUMsc0VBQXNFLENBQUMsQ0FBQSxDQUFFLENBQUM7S0FBRTtJQUE5SSxpQ0FBZ0IsbUJBQThILENBQUE7SUFDM0osZ0JBQXdCLFNBQVEsZ0JBQWdCO1FBQUcsWUFBWSxJQUFnQixJQUFJLEtBQUssQ0FBQyxtQkFBbUIsSUFBSSxFQUFFLENBQUMsQ0FBQSxDQUFFLENBQUM7S0FBRTtJQUEzRywyQkFBVSxhQUFpRyxDQUFBO0lBQ3hILGtCQUEwQixTQUFRLGdCQUFnQjtRQUFHLFlBQVksSUFBZ0IsSUFBSSxLQUFLLENBQUMsbUJBQW1CLElBQUksRUFBRSxDQUFDLENBQUEsQ0FBRSxDQUFDO0tBQUU7SUFBN0csNkJBQVksZUFBaUcsQ0FBQTtJQUMxSCx3QkFBZ0MsU0FBUSxnQkFBZ0I7UUFBRyxZQUFZLElBQWdCLElBQUksS0FBSyxDQUFDLDRCQUE0QixJQUFJLEdBQUcsQ0FBQyxDQUFBLENBQUUsQ0FBQztLQUFFO0lBQTdILG1DQUFrQixxQkFBMkcsQ0FBQTtJQUMxSSwrQkFBdUMsU0FBUSxnQkFBZ0I7UUFBRyxZQUFZLElBQWdCLEVBQUUsT0FBYyxJQUFJLEtBQUssQ0FBQyxpQ0FBaUMsT0FBTyxPQUFPLElBQUksRUFBRSxDQUFDLENBQUEsQ0FBRSxDQUFDO0tBQUU7SUFBdEssMENBQXlCLDRCQUE2SSxDQUFBO0lBQ25MLHFDQUE2QyxTQUFRLGdCQUFnQjtRQUFHLGdCQUFnQixLQUFLLENBQUMscURBQXFELENBQUMsQ0FBQSxDQUFFLENBQUM7S0FBRTtJQUE1SSxnREFBK0Isa0NBQTZHLENBQUE7SUFDekosaUNBQXlDLFNBQVEsZ0JBQWdCO1FBQUcsWUFBWSxJQUFXLEVBQUUsT0FBZSxJQUFJLEtBQUssQ0FBQyxjQUFjLElBQUksMEJBQTBCLE9BQU8sR0FBRyxDQUFDLENBQUEsQ0FBQyxDQUFDO0tBQUU7SUFBcEssNENBQTJCLDhCQUF5SSxDQUFBO0FBQ3JMLENBQUMsRUFkZ0IsZ0JBQWdCLEdBQWhCLHdCQUFnQixLQUFoQix3QkFBZ0IsUUFjaEM7QUFJRDtJQUFBO1FBQ0ksVUFBSyxHQUFXLHdIQUF3SCxDQUFBO1FBQ3hJLHlCQUFvQixHQUFXLE9BQU8sQ0FBQTtRQUN0QyxTQUFJLEdBQVcsRUFBRSxDQUFBO1FBQ2pCLG1CQUFjLEdBQWMsRUFBRSxDQUFBO1FBQzlCLDBCQUFxQixHQUFrQixJQUFJLENBQUE7SUFVL0MsQ0FBQztJQVBVLE1BQU0sQ0FBQyxnQkFBZ0IsQ0FBQyxHQUFpQjtRQUM1QyxJQUFJLE1BQU0sR0FBZSxFQUFFLENBQUE7UUFDM0IsR0FBRyxDQUFDLENBQUUsSUFBSSxDQUFDLElBQUksR0FBSSxDQUFDLENBQUMsQ0FBQztZQUNsQixNQUFNLENBQUMsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFBO1FBQ3BCLENBQUM7UUFDRCxNQUFNLENBQUMsTUFBTSxDQUFBO0lBQ2pCLENBQUM7Q0FDSjtBQWZELGdEQWVDO0FBU0Q7SUFBQTtRQUVXLFlBQU8sR0FBK0IsSUFBSSxDQUFBO1FBRTFDLHNCQUFpQixHQUFZLFdBQVcsQ0FBQyx5QkFBeUIsQ0FBQTtRQUNqRSxzQkFBaUIsR0FBYSxJQUFJLHFCQUFPLENBQUMsSUFBSSxDQUFDLENBQUE7UUFDL0MscUJBQWdCLEdBQWEsSUFBSSxxQkFBTyxDQUFDLElBQUksQ0FBQyxDQUFBO1FBQzlDLHNCQUFpQixHQUFZLEVBQUUsQ0FBQSxDQUFFLDBEQUEwRDtRQXlCM0YsY0FBUyxHQUFHLEtBQUssQ0FBQTtRQVVqQixXQUFNLEdBQTJCLE9BQU8sQ0FBQyxHQUFHLENBQUE7UUFDNUMsVUFBSyxHQUEyQixJQUFJLENBQUMsUUFBUSxDQUFBO0lBOFd6RCxDQUFDO0lBaFpHLElBQVcsc0JBQXNCO1FBQzdCLE1BQU0sQ0FBQyxJQUFJLHFCQUFPLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxrQkFBa0IsQ0FBQyxDQUFBO0lBQ3RELENBQUM7SUFDRCxJQUFXLHFCQUFxQjtRQUM1QixFQUFFLENBQUMsQ0FBRSxJQUFJLENBQUMsT0FBTyxJQUFJLElBQUssQ0FBQztZQUFDLE1BQU0sQ0FBQyxJQUFJLHFCQUFPLENBQUMsSUFBSSxDQUFDLENBQUE7UUFDcEQsRUFBRSxDQUFDLENBQUUsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLElBQUksRUFBRyxDQUFDO1lBQUMsTUFBTSxDQUFDLElBQUkscUJBQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQTtRQUN2RCxNQUFNLENBQUMsSUFBSSxDQUFDLHNCQUFzQixDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQTtJQUN4RSxDQUFDO0lBRUQsSUFBVyxTQUFTO1FBQ2hCLEVBQUUsQ0FBQyxDQUFFLElBQUksQ0FBQyxPQUFPLElBQUksSUFBSyxDQUFDO1lBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQTtRQUNwQyxNQUFNLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLGNBQWMsQ0FBQyxDQUFDLE1BQU0sQ0FBQTtJQUMxRCxDQUFDO0lBRUQ7Ozs7T0FJRztJQUNILElBQVcsd0JBQXdCO1FBQy9CLE1BQU0sQ0FBQyxJQUFJLENBQUMsaUJBQWlCLENBQUE7SUFDakMsQ0FBQztJQUdELElBQVcsT0FBTztRQUNkLE1BQU0sQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFBO0lBQ3pCLENBQUM7SUFDTSxhQUFhO1FBQ2hCLElBQUksQ0FBQyxLQUFLLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQTtJQUM1QixDQUFDO0lBRU8sUUFBUSxDQUFDLEdBQUcsSUFBVSxJQUFHLENBQUM7SUFLbEMsSUFBVyxVQUFVLENBQUMsUUFBZ0M7UUFDbEQsSUFBSSxDQUFDLE1BQU0sR0FBRyxRQUFRLENBQUE7SUFDMUIsQ0FBQztJQUNELElBQVcsVUFBVSxLQUFLLE1BQU0sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFBLENBQUMsQ0FBQztJQUU5QyxJQUFXLFNBQVMsQ0FBQyxRQUFnQztRQUNqRCxJQUFJLENBQUMsS0FBSyxHQUFHLFFBQVEsQ0FBQTtJQUN6QixDQUFDO0lBRUQ7Ozs7Ozs7Ozs7OztPQVlHO0lBQ0ksNkJBQTZCLENBQUMsUUFBZ0I7UUFDakQsSUFBSSxDQUFDLEtBQUssQ0FBQyx1QkFBdUIsRUFBRSxRQUFRLENBQUMsQ0FBQTtRQUU3QyxJQUFJLENBQUMsR0FBRyxJQUFJLHFCQUFPLENBQUMsUUFBUSxDQUFDLENBQUE7UUFFN0IsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7WUFDVixJQUFJLFlBQVksR0FBRyxDQUFDLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxDQUFBO1lBQ3hELEVBQUUsQ0FBQyxDQUFFLFlBQVksQ0FBQyxNQUFPLENBQUMsQ0FBQyxDQUFDO2dCQUN4QixDQUFDLEdBQUcsWUFBWSxDQUFBO1lBQ3BCLENBQUM7UUFDTCxDQUFDO1FBRUQsRUFBRSxDQUFDLENBQUUsQ0FBQyxDQUFDLE1BQU8sQ0FBQyxDQUFDLENBQUM7WUFDYix3QkFBd0I7WUFDeEIsSUFBSSxvQkFBb0IsR0FBUyxDQUFDLENBQUMsZ0JBQWdCLENBQUE7WUFDbkQsRUFBRSxDQUFDLENBQUUsb0JBQW9CLElBQUksSUFBSyxDQUFDLENBQUMsQ0FBQztnQkFDakMsTUFBTSxJQUFJLGdCQUFnQixDQUFDLG9CQUFvQixDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQTtZQUM5RCxDQUFDO1lBRUQsdUJBQXVCO1lBQ3ZCLElBQUksVUFBVSxHQUFHLG9CQUFvQixDQUFDLHNCQUFzQixDQUFDLENBQUE7WUFDN0QsRUFBRSxDQUFDLENBQUMsQ0FBQyxVQUFVLElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDO2dCQUFDLE1BQU0sSUFBSSxnQkFBZ0IsQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUE7WUFDOUYsSUFBSSxPQUFPLEdBQUcsb0JBQW9CLENBQUMsc0JBQXNCLENBQUMsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBUSxFQUFFLEVBQUUsR0FBRSxNQUFNLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFBLENBQUEsQ0FBQyxDQUFDLENBQUE7WUFFN0csRUFBRSxDQUFDLENBQUUsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFFLENBQUMsQ0FBQyxDQUFDO2dCQUNoRSxFQUFFLENBQUMsQ0FBRSxJQUFJLENBQUMsT0FBUSxDQUFDLENBQUMsQ0FBQztvQkFDakIsT0FBTyxDQUFDLEdBQUcsQ0FBQyxzQkFBc0IsRUFBRSxvQkFBb0IsQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDLENBQUE7b0JBQ2pGLE9BQU8sQ0FBQyxHQUFHLENBQUMsU0FBUyxFQUFFLE9BQU8sQ0FBQyxDQUFBO29CQUMvQixPQUFPLENBQUMsR0FBRyxDQUFDLHNCQUFzQixFQUFFLG9CQUFvQixDQUFDLENBQUE7Z0JBQzdELENBQUM7Z0JBQ0QsTUFBTSxJQUFJLGdCQUFnQixDQUFDLGtCQUFrQixDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQTtZQUM1RCxDQUFDO1lBQ0QsRUFBRSxDQUFDLENBQUUsT0FBTyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxPQUFPLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBRSxDQUFDLENBQUMsQ0FBQztnQkFDckMsTUFBTSxJQUFJLGdCQUFnQixDQUFDLHlCQUF5QixDQUFDLENBQUMsQ0FBQyxPQUFPLEVBQUUsT0FBTyxDQUFDLENBQUE7WUFDNUUsQ0FBQztZQUVELHdDQUF3QztZQUN4QyxFQUFFLENBQUEsQ0FBQyxvQkFBb0IsQ0FBQyxjQUFjLFlBQVksS0FBSyxDQUFDLENBQUMsQ0FBQztnQkFDdEQsb0JBQW9CLENBQUMsY0FBYyxHQUFHLGtCQUFrQixDQUFDLGdCQUFnQixDQUFDLG9CQUFvQixDQUFDLGNBQWMsQ0FBQyxDQUFBO1lBQ2xILENBQUM7WUFFRCw0QkFBNEI7WUFDNUIsSUFBSSxDQUFDLE9BQU8sR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDLElBQUksa0JBQWtCLEVBQUUsb0JBQW9CLENBQUMsQ0FBQTtZQUMxRSxJQUFJLENBQUMsaUJBQWlCLEdBQUcsQ0FBQyxDQUFBO1lBQzFCLElBQUksQ0FBQyxnQkFBZ0IsR0FBRyxDQUFDLENBQUMsTUFBTSxDQUFBO1lBQ2hDLElBQUksQ0FBQyxpQkFBaUIsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQTtZQUNyRCxNQUFNLENBQUMsSUFBSSxDQUFBO1FBQ2YsQ0FBQztRQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBRSxDQUFDLENBQUMsS0FBTSxDQUFDLENBQUMsQ0FBQztZQUNuQixJQUFJLENBQUMsZ0JBQWdCLEdBQUcsQ0FBQyxDQUFBO1lBQ3pCLElBQUksQ0FBQyxpQkFBaUIsR0FBRyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxDQUFBO1lBQzFFLE1BQU0sQ0FBQyxLQUFLLENBQUE7UUFDaEIsQ0FBQztRQUFDLElBQUksQ0FBQyxDQUFDO1lBQ0osTUFBTSxJQUFJLGdCQUFnQixDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUE7UUFDcEQsQ0FBQztJQUNMLENBQUM7SUFFRDs7O09BR0c7SUFDSCxJQUFXLGVBQWU7UUFDdEIsTUFBTSxDQUFDLElBQUksQ0FBQyxPQUFPLElBQUksSUFBSSxDQUFBO0lBQy9CLENBQUM7SUFFRDs7T0FFRztJQUNILElBQVcscUJBQXFCO1FBQzVCLElBQUksQ0FBQyxLQUFLLENBQUMsY0FBYyxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUE7UUFDeEQsSUFBSSxDQUFDLEtBQUssQ0FBQyx3QkFBd0IsRUFBRSxJQUFJLENBQUMsaUJBQWlCLENBQUMsQ0FBQTtRQUM1RCxFQUFFLENBQUMsQ0FBRSxDQUFDLElBQUksQ0FBQyxPQUFRLENBQUM7WUFBQyxNQUFNLENBQUMsS0FBSyxDQUFBO1FBQ2pDLE1BQU0sQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxJQUFJLENBQUMsaUJBQWlCLENBQUE7SUFDakUsQ0FBQztJQUVEOztPQUVHO0lBQ0ksNkJBQTZCO1FBQ2hDLEVBQUUsQ0FBQyxDQUFFLElBQUksQ0FBQyxxQkFBc0IsQ0FBQyxDQUFDLENBQUM7WUFDL0IsSUFBSSxDQUFDLEtBQUssQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFBO1lBQzVCLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFDLElBQUksRUFBQyxDQUFDLENBQUMsQ0FBQyxDQUFBO1lBQ3ZFLE1BQU0sQ0FBQyxJQUFJLENBQUE7UUFDZixDQUFDO1FBQ0QsSUFBSSxDQUFDLEtBQUssQ0FBQyw4QkFBOEIsQ0FBQyxDQUFBO1FBQzFDLE1BQU0sQ0FBQyxLQUFLLENBQUE7SUFDaEIsQ0FBQztJQUVEOzs7O09BSUc7SUFDSSxZQUFZLENBQUMsSUFBWTtRQUM1QixFQUFFLENBQUMsQ0FBRSxJQUFJLENBQUMsT0FBTyxJQUFJLElBQUssQ0FBQztZQUFDLE1BQU0sSUFBSSxnQkFBZ0IsQ0FBQyxpQkFBaUIsQ0FBQTtRQUN4RSxFQUFFLENBQUMsQ0FBRSxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxLQUFNLENBQUM7WUFBQyxNQUFNLElBQUksZ0JBQWdCLENBQUMsK0JBQStCLENBQUE7UUFDOUYsSUFBSSxDQUFDLE9BQU8sR0FBRyxJQUFJLGtCQUFrQixDQUFBO1FBQ3JDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQTtRQUN4QixJQUFJLENBQUMsT0FBTyxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsaUJBQWlCLENBQUMsR0FBRyxJQUFJLENBQUE7SUFDOUQsQ0FBQztJQUVNLGFBQWEsQ0FBQyxJQUFZO1FBQzdCLEVBQUUsQ0FBQyxDQUFFLElBQUksQ0FBQyxPQUFPLElBQUksSUFBSyxDQUFDO1lBQUMsTUFBTSxJQUFJLGdCQUFnQixDQUFDLG1CQUFtQixDQUFBO1FBQzFFLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQTtJQUM1QixDQUFDO0lBRUQ7O09BRUc7SUFDSSxLQUFLO1FBQ1IsRUFBRSxDQUFDLENBQUUsSUFBSSxDQUFDLE9BQU8sSUFBSSxJQUFLLENBQUM7WUFBQyxNQUFNLElBQUksZ0JBQWdCLENBQUMsbUJBQW1CLENBQUE7UUFDMUUsSUFBSSxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUE7UUFDbkIsRUFBRSxDQUFDLENBQUUsSUFBSSxDQUFDLGlCQUFpQixDQUFDLE1BQU8sQ0FBQyxDQUFDLENBQUM7WUFDbEMsSUFBSSxDQUFDLGlCQUFpQixDQUFDLE1BQU0sRUFBRSxDQUFBO1FBQ25DLENBQUM7SUFDTCxDQUFDO0lBRU0sR0FBRyxDQUFDLGNBQXdCLEVBQUUsWUFBc0IsS0FBSyxFQUFFLFlBQXNCLEtBQUs7UUFDekYsRUFBRSxDQUFDLENBQUUsSUFBSSxDQUFDLE9BQU8sSUFBSSxJQUFLLENBQUM7WUFBQyxNQUFNLElBQUksZ0JBQWdCLENBQUMsbUJBQW1CLENBQUE7UUFDMUUsRUFBRSxDQUFDLENBQUUsSUFBSSxDQUFDLGdCQUFnQixJQUFJLElBQUssQ0FBQztZQUFDLE1BQU0sSUFBSSxnQkFBZ0IsQ0FBQyxtQkFBbUIsQ0FBQTtRQUVuRixHQUFHLENBQUMsQ0FBRSxJQUFJLElBQUksSUFBSSxjQUFlLENBQUMsQ0FBQyxDQUFDO1lBQ2hDLElBQUksQ0FBQyxHQUFHLHFCQUFPLENBQUMsMEJBQTBCLENBQUMsSUFBSSxDQUFDLENBQUE7WUFDaEQsRUFBRSxDQUFDLENBQUUsQ0FBQyxDQUFDLENBQUMsTUFBTyxDQUFDLENBQUMsQ0FBQztnQkFDZCxNQUFNLElBQUksZ0JBQWdCLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFBO1lBQ3pELENBQUM7WUFFRCxJQUFJLE9BQU8sR0FBRyxDQUFDLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsRUFBRSxJQUFJLENBQUMsQ0FBQTtZQUN2RCxFQUFFLENBQUMsQ0FBRSxPQUFPLElBQUksSUFBSyxDQUFDLENBQUMsQ0FBQztnQkFDcEIsTUFBTSxJQUFJLGdCQUFnQixDQUFDLDJCQUEyQixDQUFDLENBQUMsQ0FBQyxRQUFRLEVBQUUsRUFBRSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQTtZQUMxRyxDQUFDO1lBQ0QsRUFBRSxDQUFDLENBQUUsQ0FBQyxDQUFDLE1BQU0sSUFBSSxDQUFDLENBQUMsU0FBVSxDQUFDLENBQUMsQ0FBQztnQkFDNUIsRUFBRSxDQUFDLENBQUUsSUFBSSxDQUFDLE9BQU8sQ0FBQyxjQUFjLENBQUMsT0FBTyxDQUFFLENBQUMsQ0FBQyxDQUFDO29CQUN6QyxJQUFJLENBQUMsTUFBTSxDQUFDLGdCQUFnQixFQUFFLE9BQU8sQ0FBQyxDQUFBO2dCQUMxQyxDQUFDO2dCQUFDLElBQUksQ0FBQyxDQUFDO29CQUNKLElBQUksQ0FBQyxNQUFNLENBQUMsVUFBVSxFQUFFLE9BQU8sQ0FBQyxDQUFBO29CQUNoQyxJQUFJLENBQUMsT0FBTyxDQUFDLGNBQWMsQ0FBQyxPQUFPLENBQUMsR0FBRyxJQUFJLENBQUE7b0JBQzNDLElBQUksQ0FBQyxLQUFLLENBQUMsbUJBQW1CLEVBQUUsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFBO2dCQUNqRCxDQUFDO1lBQ0wsQ0FBQztZQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBRSxDQUFDLENBQUMsS0FBTSxDQUFDLENBQUMsQ0FBQztnQkFDbkIsRUFBRSxDQUFDLENBQUUsU0FBUyxJQUFJLENBQUMsU0FBVSxDQUFDLENBQUMsQ0FBQztvQkFDNUIsSUFBSSxDQUFDLEtBQUssQ0FBQyxpQ0FBaUMsRUFBRSxPQUFPLENBQUMsQ0FBQTtnQkFDMUQsQ0FBQztnQkFBQyxJQUFJLENBQUMsQ0FBQztvQkFDSixJQUFJLFFBQVEsR0FBRyxDQUFDLENBQUMsV0FBVyxDQUFBO29CQUM1QixFQUFFLENBQUMsQ0FBRSxRQUFRLElBQUksSUFBSSxJQUFJLFFBQVEsSUFBSSxFQUFHLENBQUMsQ0FBQyxDQUFDO3dCQUN2QyxJQUFJLENBQUMsTUFBTSxDQUFDLDhCQUE4QixFQUFFLE9BQU8sQ0FBQyxDQUFBO29CQUN4RCxDQUFDO29CQUFDLElBQUksQ0FBQyxDQUFDO3dCQUNKLElBQUksQ0FBQyxNQUFNLENBQUMsb0JBQW9CLEVBQUUsT0FBTyxDQUFDLENBQUE7d0JBQzFDLElBQUksQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxFQUFFLFNBQVMsRUFBRSxJQUFJLENBQUMsQ0FBQTtvQkFDOUQsQ0FBQztnQkFDTCxDQUFDO1lBQ0wsQ0FBQztZQUFDLElBQUksQ0FBQyxDQUFDO2dCQUNKLElBQUksQ0FBQyxNQUFNLENBQUMsWUFBWSxFQUFFLE9BQU8sRUFBRSxzQkFBc0IsQ0FBQyxDQUFBO1lBQzlELENBQUM7UUFDTCxDQUFDO0lBQ0wsQ0FBQztJQUVNLE1BQU0sQ0FBQyxLQUFlO1FBQ3pCLEVBQUUsQ0FBQyxDQUFFLElBQUksQ0FBQyxPQUFPLElBQUksSUFBSyxDQUFDO1lBQUMsTUFBTSxJQUFJLGdCQUFnQixDQUFDLG1CQUFtQixDQUFBO1FBQzFFLEVBQUUsQ0FBQyxDQUFFLElBQUksQ0FBQyxnQkFBZ0IsSUFBSSxJQUFLLENBQUM7WUFBQyxNQUFNLElBQUksZ0JBQWdCLENBQUMsbUJBQW1CLENBQUE7UUFFbkYsR0FBRyxDQUFDLENBQUUsSUFBSSxJQUFJLElBQUksS0FBTSxDQUFDLENBQUMsQ0FBQztZQUN2QixJQUFJLENBQUMsR0FBRyxxQkFBTyxDQUFDLDBCQUEwQixDQUFDLElBQUksQ0FBQyxDQUFBO1lBRWhELElBQUksT0FBTyxHQUFHLENBQUMsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLGdCQUFnQixFQUFFLElBQUksQ0FBQyxDQUFBO1lBQ3ZELEVBQUUsQ0FBQyxDQUFFLE9BQU8sSUFBSSxJQUFLLENBQUMsQ0FBQyxDQUFDO2dCQUNwQixNQUFNLElBQUksZ0JBQWdCLENBQUMsMkJBQTJCLENBQUMsQ0FBQyxDQUFDLFFBQVEsRUFBRSxFQUFFLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFBO1lBQzFHLENBQUM7WUFDRCxFQUFFLENBQUMsQ0FBRSxJQUFJLENBQUMsT0FBTyxDQUFDLGNBQWMsQ0FBQyxPQUFPLENBQUMsSUFBSSxJQUFLLENBQUMsQ0FBQyxDQUFDO2dCQUNqRCxJQUFJLENBQUMsTUFBTSxDQUFDLDBCQUEwQixFQUFFLE9BQU8sQ0FBQyxDQUFBO2dCQUNoRCxPQUFNLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxjQUFjLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQTtZQUNoRCxDQUFDO1lBQUMsSUFBSSxDQUFDLENBQUM7Z0JBQ0osSUFBSSxDQUFDLE1BQU0sQ0FBQyw0QkFBNEIsRUFBRSxPQUFPLENBQUMsQ0FBQTtZQUN0RCxDQUFDO1FBQ0wsQ0FBQztJQUNMLENBQUM7SUFFRDs7Ozs7T0FLRztJQUNJLGlCQUFpQixDQUFDLElBQVc7UUFDaEMsRUFBRSxDQUFDLENBQUUsSUFBSSxDQUFDLE9BQU8sSUFBSSxJQUFLLENBQUM7WUFBQyxNQUFNLElBQUksZ0JBQWdCLENBQUMsbUJBQW1CLENBQUE7UUFFMUUsTUFBTSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMscUJBQXFCLENBQUE7SUFDN0MsQ0FBQztJQUVEOzs7OztPQUtHO0lBQ0kscUJBQXFCLENBQUMsU0FBZ0I7UUFDekMsRUFBRSxDQUFDLENBQUUsSUFBSSxDQUFDLE9BQU8sSUFBSSxJQUFLLENBQUM7WUFBQyxNQUFNLElBQUksZ0JBQWdCLENBQUMsbUJBQW1CLENBQUE7UUFDMUUsSUFBSSxNQUFNLEdBQUcsRUFBRSxDQUFBO1FBRWYsR0FBRyxDQUFDLENBQUUsSUFBSSxJQUFJLElBQUksSUFBSSxDQUFDLE9BQU8sQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDO1lBQzVDLEVBQUUsQ0FBQyxDQUFFLElBQUksQ0FBQyxPQUFPLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBRSxDQUFDLENBQUMsQ0FBQztnQkFDdEMsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksRUFBRSxTQUFTLENBQUMsQ0FBQyxDQUFBO1lBQ2xELENBQUM7UUFDTCxDQUFDO1FBQ0QsTUFBTSxDQUFDLE1BQU0sQ0FBQTtJQUNqQixDQUFDO0lBRUQ7Ozs7O09BS0c7SUFDSSxXQUFXLENBQUMsT0FBZSxFQUFFLFVBQXlCO1FBQ3pELEVBQUUsQ0FBQyxDQUFFLElBQUksQ0FBQyxPQUFPLElBQUksSUFBSyxDQUFDO1lBQUMsTUFBTSxJQUFJLGdCQUFnQixDQUFDLG1CQUFtQixDQUFBO1FBRTFFLEVBQUUsQ0FBQyxDQUFFLFVBQVUsSUFBSSxJQUFLLENBQUMsQ0FBQyxDQUFDO1lBQ3ZCLEVBQUUsQ0FBQyxDQUFFLElBQUksQ0FBQyxPQUFPLENBQUMscUJBQXFCLElBQUksSUFBSyxDQUFDO2dCQUFDLE1BQU0sSUFBSSxnQkFBZ0IsQ0FBQyxrQkFBa0IsQ0FBQTtZQUMvRixVQUFVLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxxQkFBcUIsQ0FBQTtRQUNuRCxDQUFDO1FBQ0QsSUFBSSxPQUFPLEdBQUcsSUFBSSxDQUFDLHNCQUFzQixDQUFDLE9BQU8sQ0FBQyxDQUFBO1FBQ2xELElBQUksS0FBSyxHQUFHLHlCQUFXLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRSxPQUFPLEVBQUUsVUFBVSxDQUFDLENBQUE7UUFDN0QsTUFBTSxDQUFDLEtBQUssQ0FBQTtJQUNoQixDQUFDO0lBRUQsSUFBVyxTQUFTO1FBQ2hCLEVBQUUsQ0FBQyxDQUFFLElBQUksQ0FBQyxPQUFPLElBQUksSUFBSyxDQUFDO1lBQUMsTUFBTSxJQUFJLGdCQUFnQixDQUFDLG1CQUFtQixDQUFBO1FBQzFFLEVBQUUsQ0FBQyxDQUFFLElBQUksQ0FBQyxPQUFPLENBQUMscUJBQXFCLElBQUksSUFBSyxDQUFDO1lBQUMsTUFBTSxJQUFJLGdCQUFnQixDQUFDLGtCQUFrQixDQUFBO1FBRS9GLE1BQU0sQ0FBQyxJQUFJLENBQUMscUJBQXFCLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxxQkFBcUIsQ0FBQyxDQUFBO0lBQ3pFLENBQUM7SUFFTSxPQUFPLENBQUMsSUFBVztRQUN0QixFQUFFLENBQUMsQ0FBRSxJQUFJLENBQUMsT0FBTyxJQUFJLElBQUssQ0FBQztZQUFDLE1BQU0sSUFBSSxnQkFBZ0IsQ0FBQyxtQkFBbUIsQ0FBQTtRQUUxRSxFQUFFLENBQUMsQ0FBRSxJQUFJLENBQUMsT0FBTyxDQUFDLHFCQUFxQixJQUFJLElBQUssQ0FBQyxDQUFDLENBQUM7WUFDL0MsSUFBSSxDQUFDLE1BQU0sQ0FBQyxrQkFBa0IsSUFBSSx1QkFBdUIsQ0FBQyxDQUFBO1FBQzlELENBQUM7UUFBQyxJQUFJLENBQUMsQ0FBQztZQUNKLElBQUksSUFBSSxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMscUJBQXFCLENBQUE7WUFDN0MsSUFBSSxDQUFDLE9BQU8sQ0FBQyxxQkFBcUIsR0FBRyxJQUFJLENBQUE7WUFDekMsRUFBRSxDQUFDLENBQUUsSUFBSyxDQUFDLENBQUMsQ0FBQztnQkFDVCxJQUFJLENBQUMsTUFBTSxDQUFDLFVBQVUsSUFBSSx5Q0FBeUMsSUFBSSxJQUFJLENBQUMsQ0FBQTtZQUNoRixDQUFDO1lBQUMsSUFBSSxDQUFDLENBQUM7Z0JBQ0osSUFBSSxDQUFDLE1BQU0sQ0FBQyxVQUFVLElBQUksMEJBQTBCLENBQUMsQ0FBQTtZQUN6RCxDQUFDO1FBQ0wsQ0FBQztJQUNMLENBQUM7SUFFTSxTQUFTLENBQUMsS0FBaUI7UUFDOUIsRUFBRSxDQUFDLENBQUUsS0FBTSxDQUFDLENBQUMsQ0FBQztZQUNWLE1BQU0sQ0FBQyxlQUFlLEtBQUssRUFBRSxDQUFBO1FBQ2pDLENBQUM7UUFBQyxJQUFJLENBQUMsQ0FBQztZQUNKLE1BQU0sQ0FBQyx3QkFBd0IsQ0FBQTtRQUNuQyxDQUFDO0lBQ0wsQ0FBQztJQUVNLHNCQUFzQixDQUFDLE9BQWM7UUFDeEMsTUFBTSxDQUFDLHFCQUFPLENBQUMsMEJBQTBCLENBQUMsT0FBTyxFQUFFLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFBO0lBQ3hGLENBQUM7SUFFTSxXQUFXLENBQUMsS0FBYyxFQUFFLE9BQXlCO1FBQ3hELEVBQUUsQ0FBQyxDQUFFLElBQUksQ0FBQyxPQUFPLElBQUksSUFBSyxDQUFDO1lBQUMsTUFBTSxJQUFJLGdCQUFnQixDQUFDLG1CQUFtQixDQUFBO1FBQzFFLEVBQUUsQ0FBQyxDQUFFLElBQUksQ0FBQyxnQkFBZ0IsSUFBSSxJQUFLLENBQUM7WUFBQyxNQUFNLElBQUksZ0JBQWdCLENBQUMsbUJBQW1CLENBQUE7UUFFbkYsSUFBSSxNQUFNLEdBQXFCLEVBQUUsQ0FBQTtRQUVqQyxFQUFFLENBQUMsQ0FBRSxLQUFLLFlBQVksS0FBSyxJQUFJLEtBQUssQ0FBQyxNQUFNLElBQUksQ0FBRSxDQUFDLENBQUMsQ0FBQztZQUNoRCxJQUFJLGNBQWMsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLGNBQWMsQ0FBQTtZQUNoRCxHQUFHLENBQUMsQ0FBQyxJQUFJLElBQUksSUFBSSxjQUFlLENBQUMsQ0FBQyxDQUFDO2dCQUMvQixJQUFJLE9BQU8sR0FBRyxJQUFJLENBQUMsc0JBQXNCLENBQUMsSUFBSSxDQUFDLENBQUE7Z0JBQy9DLEtBQUssQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUE7WUFDbEMsQ0FBQztRQUNMLENBQUM7UUFFRCxHQUFHLENBQUMsQ0FBRSxJQUFJLElBQUksSUFBSSxLQUFNLENBQUMsQ0FBQyxDQUFDO1lBQ3ZCLElBQUksQ0FBQyxHQUFHLHFCQUFPLENBQUMsMEJBQTBCLENBQUMsSUFBSSxDQUFDLENBQUE7WUFDaEQsSUFBSSxnQkFBZ0IsR0FBRyxDQUFDLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFBO1lBRXZFLElBQUksUUFBUSxHQUFhLEtBQUssQ0FBQTtZQUM5QixJQUFJLEtBQUssR0FBYSxLQUFLLENBQUE7WUFFM0IsRUFBRSxDQUFDLENBQUUsZ0JBQWdCLElBQUksSUFBSyxDQUFDLENBQUMsQ0FBQztnQkFDN0IsS0FBSyxHQUFHLElBQUksQ0FBQTtnQkFDWixRQUFRLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxjQUFjLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxJQUFJLENBQUE7WUFDcEUsQ0FBQztZQUVELElBQUksUUFBUSxHQUFHO2dCQUNYLElBQUksRUFBRSxDQUFDO2dCQUNQLFFBQVEsRUFBRSxRQUFRO2dCQUNsQixLQUFLLEVBQUUsS0FBSzthQUNmLENBQUE7WUFFRCxNQUFNLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFBO1FBQ3pCLENBQUM7UUFFRCxNQUFNLENBQUMsTUFBTSxDQUFBO0lBQ2pCLENBQUM7SUFFTSxRQUFRLENBQUMsUUFBZ0IsS0FBSztRQUNqQyxFQUFFLENBQUMsQ0FBRSxJQUFJLENBQUMsT0FBTyxJQUFJLElBQUssQ0FBQztZQUFDLE1BQU0sSUFBSSxnQkFBZ0IsQ0FBQyxtQkFBbUIsQ0FBQTtRQUMxRSxFQUFFLENBQUMsQ0FBRSxJQUFJLENBQUMsU0FBUyxJQUFJLENBQUUsQ0FBQztZQUFDLE1BQU0sSUFBSSxnQkFBZ0IsQ0FBQyxpQkFBaUIsQ0FBQTtRQUN2RSxFQUFFLENBQUMsQ0FBRSxDQUFDLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxLQUFNLENBQUM7WUFBQyxNQUFNLElBQUksZ0JBQWdCLENBQUMsZ0JBQWdCLENBQUE7UUFFcEYsSUFBSSxDQUFDLE1BQU0sQ0FBQyxlQUFlLEVBQUUsSUFBSSxDQUFDLHNCQUFzQixDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUE7UUFFcEUsR0FBRyxDQUFDLENBQUUsSUFBSSxJQUFJLElBQUksSUFBSSxDQUFDLE9BQU8sQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDO1lBQzVDLEVBQUUsQ0FBQyxDQUFFLElBQUksQ0FBQyxPQUFPLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBRSxDQUFDLENBQUMsQ0FBQztnQkFDdEMsSUFBSSxDQUFDLHVCQUF1QixDQUFDLElBQUksRUFBRSxLQUFLLENBQUMsQ0FBQTtZQUM3QyxDQUFDO1FBQ0wsQ0FBQztJQUNMLENBQUM7SUFFTSx1QkFBdUIsQ0FBQyxPQUFlLEVBQUUsUUFBaUIsS0FBSztRQUNsRSxFQUFFLENBQUMsQ0FBRSxJQUFJLENBQUMsT0FBTyxJQUFJLElBQUssQ0FBQztZQUFDLE1BQU0sSUFBSSxnQkFBZ0IsQ0FBQyxtQkFBbUIsQ0FBQTtRQUMxRSxFQUFFLENBQUMsQ0FBRSxDQUFDLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxLQUFNLENBQUM7WUFBQyxNQUFNLElBQUksZ0JBQWdCLENBQUMsZ0JBQWdCLENBQUE7UUFFcEYsSUFBSSxVQUFVLEdBQUcsSUFBSSxDQUFDLHNCQUFzQixDQUFDLE9BQU8sQ0FBQyxDQUFBO1FBRXJELEVBQUUsQ0FBQyxDQUFFLENBQUMsVUFBVSxDQUFDLE1BQU8sQ0FBQyxDQUFDLENBQUM7WUFDdkIsSUFBSSxDQUFDLE1BQU0sQ0FBQyxZQUFZLFVBQVUsQ0FBQyxRQUFRLEVBQUUsOENBQThDLENBQUMsQ0FBQTtZQUM1RixNQUFNLENBQUE7UUFDVixDQUFDO1FBRUQsd0ZBQXdGO1FBQ3hGLElBQUksV0FBVyxHQUFHLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxHQUFHLENBQUMseUJBQVcsQ0FBQyxpQkFBaUIsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFBO1FBQ3hGLEVBQUUsQ0FBQyxDQUFFLENBQUMsS0FBSyxJQUFJLFdBQVcsQ0FBQyxNQUFPLENBQUMsQ0FBQyxDQUFDO1lBQ2pDLElBQUksQ0FBQyxNQUFNLENBQUMsZ0NBQWdDLEVBQUUsV0FBVyxDQUFDLE9BQU8sQ0FBQyxDQUFBO1FBQ3RFLENBQUM7UUFBQyxJQUFJLENBQUMsQ0FBQztZQUNKLEVBQUUsQ0FBQyxDQUFFLEtBQU0sQ0FBQyxDQUFDLENBQUM7Z0JBQ1YsSUFBSSxDQUFDLE1BQU0sQ0FBQyxlQUFLLENBQUMsR0FBRyxDQUFDLGVBQWUsR0FBRyxXQUFXLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQTtZQUNqRSxDQUFDO1lBQUMsSUFBSSxDQUFDLENBQUM7Z0JBQ0osSUFBSSxDQUFDLE1BQU0sQ0FBQyxhQUFhLEVBQUUsV0FBVyxDQUFDLE9BQU8sQ0FBQyxDQUFBO1lBQ25ELENBQUM7WUFDRCw0REFBNEQ7WUFDNUQsV0FBVyxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsa0JBQWtCLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQTtRQUM3RCxDQUFDO0lBQ0wsQ0FBQztJQUVNLGtCQUFrQixDQUFDLE9BQWU7UUFDckMsSUFBSSxLQUFLLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQyxPQUFPLEVBQUUsSUFBSSxDQUFDLENBQUE7UUFFM0MsTUFBTSxDQUFDLEtBQUssQ0FBQyxNQUFNLEdBQUcsS0FBSyxDQUFDLHlCQUF5QixDQUFBO0lBQ3pELENBQUM7O0FBclphLHFDQUF5QixHQUFZLG1CQUFtQixDQUFBO0FBSDFFLGtDQXlaQyJ9