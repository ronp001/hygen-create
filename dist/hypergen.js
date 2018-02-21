"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const path_helper_1 = require("./path_helper");
const templatizer_1 = require("./templatizer");
const chalk_1 = require("chalk");
class HypergenError extends Error {
    constructor(msg) {
        super(msg);
        this.msg = msg;
    }
    get message() { return "hypergen - " + this.msg; }
}
exports.HypergenError = HypergenError;
(function (HypergenError) {
    class NoSessionInProgress extends HypergenError {
        constructor() { super("no hypergen session definitions file found ('hypergen start' to create one)"); }
    }
    HypergenError.NoSessionInProgress = NoSessionInProgress;
    class FromNameNotDefined extends HypergenError {
        constructor() { super("'name word' not specified (run 'hypergen usename' to set)"); }
    }
    HypergenError.FromNameNotDefined = FromNameNotDefined;
    class CantParseSessionFile extends HypergenError {
        constructor(file) { super(`can't parse session file - ${file}`); }
    }
    HypergenError.CantParseSessionFile = CantParseSessionFile;
    class SessionInProgress extends HypergenError {
        constructor() { super("hypergen session already in progress"); }
    }
    HypergenError.SessionInProgress = SessionInProgress;
    class NothingToGenerate extends HypergenError {
        constructor() { super("nothing to generate"); }
    }
    HypergenError.NothingToGenerate = NothingToGenerate;
    class NoFilesAdded extends HypergenError {
        constructor() { super("no files added"); }
    }
    HypergenError.NoFilesAdded = NoFilesAdded;
    class TargetPathNotSet extends HypergenError {
        constructor() { super("target path for templates not set (use 'export HYPERGEN_TMPLS=')"); }
    }
    HypergenError.TargetPathNotSet = TargetPathNotSet;
    class NoSuchPath extends HypergenError {
        constructor(file) { super(`can't find path ${file}`); }
    }
    HypergenError.NoSuchPath = NoSuchPath;
    class FileNotFound extends HypergenError {
        constructor(file) { super(`file not found: ${file}`); }
    }
    HypergenError.FileNotFound = FileNotFound;
    class InvalidSessionFile extends HypergenError {
        constructor(file) { super(`invalid session file -- [${file}]`); }
    }
    HypergenError.InvalidSessionFile = InvalidSessionFile;
    class InvalidSessionFileVersion extends HypergenError {
        constructor(file, version) { super(`invalid session file version (${version})-- ${file}`); }
    }
    HypergenError.InvalidSessionFileVersion = InvalidSessionFileVersion;
    class TryingToStartSessionWithoutPath extends HypergenError {
        constructor() { super(`session can only be started after valid path is set`); }
    }
    HypergenError.TryingToStartSessionWithoutPath = TryingToStartSessionWithoutPath;
    class AddedFileMustBeUnderBaseDir extends HypergenError {
        constructor(file, basedir) { super(`cannot add ${file} - not under base dir (${basedir})`); }
    }
    HypergenError.AddedFileMustBeUnderBaseDir = AddedFileMustBeUnderBaseDir;
})(HypergenError = exports.HypergenError || (exports.HypergenError = {}));
class HypergenSession {
    constructor() {
        this.about = "This is a hypergen definitions file. The hypergen utility creates generators that can be executed using hygen.";
        this.hypergen_version = "0.1.0";
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
exports.HypergenSession = HypergenSession;
class Hypergen {
    constructor() {
        this.session = null;
        this.session_file_name = Hypergen.default_session_file_name;
        this.session_file_path = new path_helper_1.AbsPath(null);
        this.session_base_dir = new path_helper_1.AbsPath(null);
        this.orig_session_json = ""; // used to check if the state was changed and needs saving
        this._debug_on = false;
        this.output = console.log;
        this.debug = this.noOutput;
    }
    get targetDirForGenerators() {
        return new path_helper_1.AbsPath(process.env.HYPERGEN_TMPLS);
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
     * binds the Hypergen instance to a specific path.
     * if a session already exists for this path (i.e., a session file exists in this directory or in one
     * of its ancestors) loads the session. the location of the session file marks the topmost directory
     * in the interactive session.
     *
     * @param for_path: <directory | file>
     *
     *                  if directory: indicates where to start looking for the hypergen session file.
     *                  if no session file found this is where a new one should be created if necessary
     *
     *                  if file: path to a session file
     */
    setPathAndLoadSessionIfExists(for_path) {
        this.debug("Hypergen starting:", for_path);
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
                throw new HypergenError.CantParseSessionFile(p.abspath);
            }
            // verify the structure
            let versionstr = sessionfile_contents['hypergen_version'];
            if (!versionstr || !versionstr.split)
                throw new HypergenError.InvalidSessionFile(p.abspath);
            let version = sessionfile_contents['hypergen_version'].split('.').map((n) => { return parseInt(n); });
            if (isNaN(version[0]) || isNaN(version[1]) || isNaN(version[2])) {
                if (this.debugOn) {
                    console.log("hypergen_version", sessionfile_contents['hypergen_version']);
                    console.log("version", version);
                    console.log("sessionfile contents", sessionfile_contents);
                }
                throw new HypergenError.InvalidSessionFile(p.abspath);
            }
            if (version[0] > 0 || version[1] > 1) {
                throw new HypergenError.InvalidSessionFileVersion(p.abspath, version);
            }
            // convert arrays to hashes if necessary
            if (sessionfile_contents.files_and_dirs instanceof Array) {
                sessionfile_contents.files_and_dirs = HypergenSession.arrayToFilesHash(sessionfile_contents.files_and_dirs);
            }
            // create the session object
            this.session = Object.assign(new HypergenSession, sessionfile_contents);
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
            throw new HypergenError.NoSuchPath(p.abspath);
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
            throw new HypergenError.SessionInProgress;
        if (!this.session_base_dir.isDir)
            throw new HypergenError.TryingToStartSessionWithoutPath;
        this.session = new HypergenSession;
        this.session.name = name;
        this.session.files_and_dirs[this.session_file_name] = true;
    }
    renameSession(name) {
        if (this.session == null)
            throw new HypergenError.NoSessionInProgress;
        this.session.name = name;
    }
    /**
     * cancel the current session and delete the session file
     */
    abort() {
        if (this.session == null)
            throw new HypergenError.NoSessionInProgress;
        this.session = null;
        if (this.session_file_path.isFile) {
            this.session_file_path.rmFile();
        }
    }
    add(files_and_dirs, recursive = false, in_subdir = false) {
        if (this.session == null)
            throw new HypergenError.NoSessionInProgress;
        if (this.session_base_dir == null)
            throw new HypergenError.NoSessionInProgress;
        for (let file of files_and_dirs) {
            let p = path_helper_1.AbsPath.fromStringAllowingRelative(file);
            if (!p.exists) {
                throw new HypergenError.FileNotFound(p.toString());
            }
            let relpath = p.relativeTo(this.session_base_dir, true);
            if (relpath == null) {
                throw new HypergenError.AddedFileMustBeUnderBaseDir(p.toString(), this.session_base_dir.toString());
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
            throw new HypergenError.NoSessionInProgress;
        if (this.session_base_dir == null)
            throw new HypergenError.NoSessionInProgress;
        for (let file of files) {
            let p = path_helper_1.AbsPath.fromStringAllowingRelative(file);
            let relpath = p.relativeTo(this.session_base_dir, true);
            if (relpath == null) {
                throw new HypergenError.AddedFileMustBeUnderBaseDir(p.toString(), this.session_base_dir.toString());
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
            throw new HypergenError.NoSessionInProgress;
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
            throw new HypergenError.NoSessionInProgress;
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
            throw new HypergenError.NoSessionInProgress;
        if (using_name == null) {
            if (this.session.templatize_using_name == null)
                throw new HypergenError.FromNameNotDefined;
            using_name = this.session.templatize_using_name;
        }
        let abspath = this.fileAbsPathFromRelPath(relpath);
        let tinfo = templatizer_1.Templatizer.process(relpath, abspath, using_name);
        return tinfo;
    }
    get templates() {
        if (this.session == null)
            throw new HypergenError.NoSessionInProgress;
        if (this.session.templatize_using_name == null)
            throw new HypergenError.FromNameNotDefined;
        return this.getTemplatesUsingName(this.session.templatize_using_name);
    }
    useName(name) {
        if (this.session == null)
            throw new HypergenError.NoSessionInProgress;
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
            throw new HypergenError.NoSessionInProgress;
        if (this.session_base_dir == null)
            throw new HypergenError.NoSessionInProgress;
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
            throw new HypergenError.NoSessionInProgress;
        if (this.fileCount == 0)
            throw new HypergenError.NothingToGenerate;
        if (!this.targetDirForGenerator.isSet)
            throw new HypergenError.TargetPathNotSet;
        this.output("target path: ", this.targetDirForGenerators.toString());
        for (let file in this.session.files_and_dirs) {
            if (this.session.files_and_dirs[file]) {
                this.generateTemplateForFile(file, force);
            }
        }
    }
    generateTemplateForFile(relpath, force = false) {
        if (this.session == null)
            throw new HypergenError.NoSessionInProgress;
        if (!this.targetDirForGenerator.isSet)
            throw new HypergenError.TargetPathNotSet;
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
Hypergen.default_session_file_name = "hypergen.json";
exports.Hypergen = Hypergen;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaHlwZXJnZW4uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvaHlwZXJnZW4udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQSwrQ0FBcUM7QUFDckMsK0NBQXVEO0FBQ3ZELGlDQUF5QjtBQUl6QixtQkFBMkIsU0FBUSxLQUFLO0lBQ3BDLFlBQW1CLEdBQVc7UUFBRyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUE7UUFBeEIsUUFBRyxHQUFILEdBQUcsQ0FBUTtJQUFhLENBQUM7SUFDNUMsSUFBVyxPQUFPLEtBQUssTUFBTSxDQUFDLGFBQWEsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFBLENBQUMsQ0FBQztDQUMzRDtBQUhELHNDQUdDO0FBRUQsV0FBaUIsYUFBYTtJQUMxQix5QkFBaUMsU0FBUSxhQUFhO1FBQUcsZ0JBQWdCLEtBQUssQ0FBQyw2RUFBNkUsQ0FBQyxDQUFBLENBQUUsQ0FBQztLQUFFO0lBQXJKLGlDQUFtQixzQkFBa0ksQ0FBQTtJQUNsSyx3QkFBZ0MsU0FBUSxhQUFhO1FBQUcsZ0JBQWdCLEtBQUssQ0FBQywyREFBMkQsQ0FBQyxDQUFBLENBQUUsQ0FBQztLQUFFO0lBQWxJLGdDQUFrQixxQkFBZ0gsQ0FBQTtJQUMvSSwwQkFBa0MsU0FBUSxhQUFhO1FBQUcsWUFBWSxJQUFnQixJQUFJLEtBQUssQ0FBQyw4QkFBOEIsSUFBSSxFQUFFLENBQUMsQ0FBQSxDQUFFLENBQUM7S0FBRTtJQUE3SCxrQ0FBb0IsdUJBQXlHLENBQUE7SUFDMUksdUJBQStCLFNBQVEsYUFBYTtRQUFHLGdCQUFnQixLQUFLLENBQUMsc0NBQXNDLENBQUMsQ0FBQSxDQUFFLENBQUM7S0FBRTtJQUE1RywrQkFBaUIsb0JBQTJGLENBQUE7SUFDekgsdUJBQStCLFNBQVEsYUFBYTtRQUFHLGdCQUFnQixLQUFLLENBQUMscUJBQXFCLENBQUMsQ0FBQSxDQUFFLENBQUM7S0FBRTtJQUEzRiwrQkFBaUIsb0JBQTBFLENBQUE7SUFDeEcsa0JBQTBCLFNB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