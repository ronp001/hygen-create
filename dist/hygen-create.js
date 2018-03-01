"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const path_helper_1 = require("./path_helper");
const templatizer_1 = require("./templatizer");
const chalk_1 = require("chalk");
const APP_VERSION = "0.2.0";
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
        constructor(file, version) { super(`session file version too high (${version}) -- ${file}: consider upgrading hygen-create`); }
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
        this.hygen_create_version = APP_VERSION;
        this.name = "";
        this.files_and_dirs = {};
        this.templatize_using_name = null;
        this.gen_parent_dir = false;
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
        this.loaded_session_version = null;
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
    // private debug : (...args:any[])=>void = this.output
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
     *
     * @returns true if existing session file loaded, false if not
     * @throws error if encountered problem trying to load the file
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
            if (version[0] > 0 || version[1] > 2) {
                throw new HygenCreateError.InvalidSessionFileVersion(p.abspath, version);
            }
            this.loaded_session_version = version;
            // convert arrays to hashes if necessary
            if (sessionfile_contents.files_and_dirs instanceof Array) {
                sessionfile_contents.files_and_dirs = HygenCreateSession.arrayToFilesHash(sessionfile_contents.files_and_dirs);
            }
            // create the session object
            this.session = Object.assign(new HygenCreateSession, sessionfile_contents);
            if (this.session == null) {
                throw new HygenCreateError.InvalidSessionFile(p.abspath);
            }
            this.orig_session_json = JSON.stringify(this.session);
            if (version[0] == 0 && version[1] == 1 && !this.session.gen_parent_dir) {
                this.session.gen_parent_dir = true;
                this.output(chalk_1.default.red("Note: the session was started using hygen-create v0.1.x.  Parent dir generation is turned on for compatibility.\nUse 'hygen-create setopt --no-parent-dir' to turn off"));
            }
            this.session_file_path = p;
            this.session_base_dir = p.parent;
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
        if (this.session && this.doesSessionNeedSaving) {
            this.debug("saving session");
            this.session.hygen_create_version = APP_VERSION;
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
            let p = path_helper_1.AbsPath.fromStringAllowingRelative(file.toString());
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
                    if (p.isBinaryFile) {
                        this.output(chalk_1.default.red("not adding binary file: " + relpath));
                    }
                    else {
                        this.output("adding: ", relpath);
                        this.session.files_and_dirs[relpath] = true;
                        this.debug("session after add", this.session);
                    }
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
        let tinfo = templatizer_1.Templatizer.process(relpath, abspath, using_name, this.session.gen_parent_dir);
        return tinfo;
    }
    get templates() {
        if (this.session == null)
            throw new HygenCreateError.NoSessionInProgress;
        if (this.session.templatize_using_name == null)
            throw new HygenCreateError.FromNameNotDefined;
        return this.getTemplatesUsingName(this.session.templatize_using_name);
    }
    setGenParentDir(value) {
        if (this.session == null)
            throw new HygenCreateError.NoSessionInProgress;
        this.session.gen_parent_dir = value;
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
            let is_binary = p.isBinaryFile;
            if (relpath_from_top != null) {
                found = true;
                included = this.session.files_and_dirs[relpath_from_top] == true;
            }
            let fileinfo = {
                path: p,
                included: included,
                found: found,
                is_binary: is_binary
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
        if (tinfo.is_binary) {
            return "<binary file>";
        }
        return tinfo.header + tinfo.contentsAfterReplacements;
    }
}
HygenCreate.default_session_file_name = "hygen-create.json";
exports.HygenCreate = HygenCreate;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaHlnZW4tY3JlYXRlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vc3JjL2h5Z2VuLWNyZWF0ZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFBLCtDQUFxQztBQUNyQywrQ0FBdUQ7QUFDdkQsaUNBQXlCO0FBSXpCLE1BQU0sV0FBVyxHQUFHLE9BQU8sQ0FBQTtBQUUzQixzQkFBOEIsU0FBUSxLQUFLO0lBQ3ZDLFlBQW1CLEdBQVc7UUFBRyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUE7UUFBeEIsUUFBRyxHQUFILEdBQUcsQ0FBUTtJQUFhLENBQUM7SUFDNUMsSUFBVyxPQUFPLEtBQUssTUFBTSxDQUFDLGlCQUFpQixHQUFHLElBQUksQ0FBQyxHQUFHLENBQUEsQ0FBQyxDQUFDO0NBQy9EO0FBSEQsNENBR0M7QUFFRCxXQUFpQixnQkFBZ0I7SUFDN0IseUJBQWlDLFNBQVEsZ0JBQWdCO1FBQUcsZ0JBQWdCLEtBQUssQ0FBQyxxRkFBcUYsQ0FBQyxDQUFBLENBQUUsQ0FBQztLQUFFO0lBQWhLLG9DQUFtQixzQkFBNkksQ0FBQTtJQUM3Syx3QkFBZ0MsU0FBUSxnQkFBZ0I7UUFBRyxnQkFBZ0IsS0FBSyxDQUFDLCtEQUErRCxDQUFDLENBQUEsQ0FBRSxDQUFDO0tBQUU7SUFBekksbUNBQWtCLHFCQUF1SCxDQUFBO0lBQ3RKLDBCQUFrQyxTQUFRLGdCQUFnQjtRQUFHLFlBQVksSUFBZ0IsSUFBSSxLQUFLLENBQUMsOEJBQThCLElBQUksRUFBRSxDQUFDLENBQUEsQ0FBRSxDQUFDO0tBQUU7SUFBaEkscUNBQW9CLHVCQUE0RyxDQUFBO0lBQzdJLHVCQUErQixTQUFRLGdCQUFnQjtRQUFHLGdCQUFnQixLQUFLLENBQUMsMENBQTBDLENBQUMsQ0FBQSxDQUFFLENBQUM7S0FBRTtJQUFuSCxrQ0FBaUIsb0JBQWtHLENBQUE7SUFDaEksdUJBQStCLFNBQVEsZ0JBQWdCO1FBQUcsZ0JBQWdCLEtBQUssQ0FBQyxxQkFBcUIsQ0FBQyxDQUFBLENB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