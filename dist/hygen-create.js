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
                    let explain = tried.join(", ");
                    if (explain != "")
                        explain = "(because " + explain + ")";
                    return { using: `using ${entry.using} ${explain}`, path: ap };
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
        let result = 0;
        for (let relpath in this.session.files_and_dirs) {
            if (this.session.files_and_dirs[relpath] && this.fileAbsPathFromRelPath(relpath).exists) {
                result++;
            }
        }
        return result;
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
    forEachGeneratedFile(fn) {
        if (this.session == null)
            throw new HygenCreateError.NoSessionInProgress;
        for (let rel_path in this.session.files_and_dirs) {
            if (this.session.files_and_dirs[rel_path]) {
                let src_path = this.fileAbsPathFromRelPath(rel_path);
                if (src_path.isFile && !src_path.isBinaryFile) {
                    let target_path = this.targetDirForGenerator.add(templatizer_1.Templatizer.template_filename(rel_path));
                    let abort = fn(rel_path, src_path, target_path);
                    if (abort)
                        return;
                }
            }
        }
    }
    isGeneratedSameAsExisting() {
        let found_diff = false;
        // fail if the file count is not identical
        let existing_files = this.targetDirForGenerator.dirContents;
        let num_existing_files = existing_files == null ? 0 : existing_files.length;
        if (num_existing_files != this.fileCount)
            return false;
        this.forEachGeneratedFile((rel_path, src_path, target_path) => {
            if (!target_path.isFile) {
                found_diff = true;
                return true;
            }
            let existing_contents = target_path.contentsBuffer.toString();
            let new_contents = this.getTemplateTextFor(rel_path);
            if (existing_contents != new_contents) {
                found_diff = true;
                return true;
            }
            return false;
        });
        return !found_diff;
    }
    generate(compare_to_previous = true) {
        if (this.session == null)
            throw new HygenCreateError.NoSessionInProgress;
        if (this.fileCount == 0)
            throw new HygenCreateError.NothingToGenerate;
        if (!this.targetDirForGenerator.isSet)
            throw new HygenCreateError.TargetPathNotSet(this.targetDirForGeneratorsReason);
        if (compare_to_previous && this.targetDirForGenerator.exists) {
            if (!this.isGeneratedSameAsExisting()) {
                let newname = this.targetDirForGenerator.renameToNextVer();
                this.output(chalk_1.default.red("previous version of generator renamed to", newname));
                this.generate(false);
            }
            else {
                this.output(chalk_1.default.red("generator unchanged - not saving"));
            }
            return;
        }
        this.output("target path for new generator: ", this.targetDirForGenerators.toString());
        for (let file in this.session.files_and_dirs) {
            if (this.session.files_and_dirs[file]) {
                this.generateTemplateForFile(file);
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
