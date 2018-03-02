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
        constructor(reason) { super(`no target path for generator: ${reason}`); }
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
    get targetDirWithInfo() {
        let tried = [];
        for (let entry of [
            { using: "HYGEN_CREATE_TMPLS", value: process.env.HYGEN_CREATE_TMPLS },
            { using: "HYGEN_TMPLS", value: process.env.HYGEN_TMPLS },
            { using: "local dir", value: './_templates' }
        ]) {
            if (entry.value) {
                let ap = new path_helper_1.AbsPath(entry.value);
                if (ap.isDir) {
                    return { using: `using ${entry.using} -- ${tried.join(",")}`, path: ap };
                }
                else if (ap.exists) {
                    tried.push(`${entry.using} (${entry.value}) exists but is not a directory`);
                }
                else {
                    tried.push(`${entry.using} (${entry.value}) does not exist`);
                }
            }
            else {
                tried.push(`${entry.using} not set`);
            }
        }
        return { using: tried.join(", "), path: new path_helper_1.AbsPath(null) };
    }
    get targetDirForGenerators() {
        return this.targetDirWithInfo.path;
    }
    get targetDirForGeneratorsReason() {
        return this.targetDirWithInfo.using;
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
            throw new HygenCreateError.TargetPathNotSet(this.targetDirForGeneratorsReason);
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
            throw new HygenCreateError.TargetPathNotSet(this.targetDirForGeneratorsReason);
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