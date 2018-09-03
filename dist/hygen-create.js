"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ts_utils_1 = require("@ronp001/ts-utils");
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
        this.session_file_path = new ts_utils_1.AbsPath(null);
        this.session_base_dir = new ts_utils_1.AbsPath(null);
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
                let ap = new ts_utils_1.AbsPath(entry.value);
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
        return { using: tried.join(", "), path: new ts_utils_1.AbsPath(null) };
    }
    get targetDirForGenerators() {
        return this.targetDirWithInfo.path;
    }
    get targetDirForGeneratorsReason() {
        return this.targetDirWithInfo.using;
    }
    get targetDirForGenerator() {
        if (this.session == null)
            return new ts_utils_1.AbsPath(null);
        if (this.session.name == "")
            return new ts_utils_1.AbsPath(null);
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
        let p = new ts_utils_1.AbsPath(for_path);
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
            if (version[0] == 0 && version[1] == 1 && !this.session.gen_parent_dir) { // backwards compatibility
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
            let p = ts_utils_1.AbsPath.fromStringAllowingRelative(file.toString());
            if (!p.exists) {
                throw new HygenCreateError.FileNotFound(p.toString());
            }
            let relpath = p.relativeFrom(this.session_base_dir, true);
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
            let p = ts_utils_1.AbsPath.fromStringAllowingRelative(file);
            let relpath = p.relativeFrom(this.session_base_dir, true);
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
        return ts_utils_1.AbsPath.fromStringAllowingRelative(relpath, this.session_base_dir.toString());
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
            let p = ts_utils_1.AbsPath.fromStringAllowingRelative(file);
            let relpath_from_top = p.relativeFrom(this.session_base_dir);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaHlnZW4tY3JlYXRlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vc3JjL2h5Z2VuLWNyZWF0ZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFBLGdEQUEyQztBQUMzQywrQ0FBeUQ7QUFDekQsaUNBQXlCO0FBSXpCLE1BQU0sV0FBVyxHQUFHLE9BQU8sQ0FBQTtBQUUzQixNQUFhLGdCQUFpQixTQUFRLEtBQUs7SUFDdkMsWUFBbUIsR0FBVztRQUFJLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQTtRQUF6QixRQUFHLEdBQUgsR0FBRyxDQUFRO0lBQWUsQ0FBQztJQUM5QyxJQUFXLE9BQU8sS0FBSyxPQUFPLGlCQUFpQixHQUFHLElBQUksQ0FBQyxHQUFHLENBQUEsQ0FBQyxDQUFDO0NBQy9EO0FBSEQsNENBR0M7QUFFRCxXQUFpQixnQkFBZ0I7SUFDN0IsTUFBYSxtQkFBb0IsU0FBUSxnQkFBZ0I7UUFBRyxnQkFBZ0IsS0FBSyxDQUFDLHFGQUFxRixDQUFDLENBQUEsQ0FBQyxDQUFDO0tBQUU7SUFBL0osb0NBQW1CLHNCQUE0SSxDQUFBO0lBQzVLLE1BQWEsa0JBQW1CLFNBQVEsZ0JBQWdCO1FBQUcsZ0JBQWdCLEtBQUssQ0FBQywrREFBK0QsQ0FBQyxDQUFBLENBQUMsQ0FBQztLQUFFO0lBQXhJLG1DQUFrQixxQkFBc0gsQ0FBQTtJQUNySixNQUFhLG9CQUFxQixTQUFRLGdCQUFnQjtRQUFHLFlBQVksSUFBbUIsSUFBSSxLQUFLLENBQUMsOEJBQThCLElBQUksRUFBRSxDQUFDLENBQUEsQ0FBQyxDQUFDO0tBQUU7SUFBbEkscUNBQW9CLHVCQUE4RyxDQUFBO0lBQy9JLE1BQWEsaUJBQWtCLFNBQVEsZ0JBQWdCO1FBQUcsZ0JBQWdCLEtBQUssQ0FBQywwQ0FBMEMsQ0FBQyxDQUFBLENBQUMsQ0FBQztLQUFFO0lBQWxILGtDQUFpQixvQkFBaUcsQ0FBQTtJQUMvSCxNQUFhLGlCQUFrQixTQUFRLGdCQUFnQjtRQUFHLGdCQUFnQixLQUFL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