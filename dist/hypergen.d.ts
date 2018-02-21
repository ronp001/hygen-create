import { AbsPath } from './path_helper';
import { TemplateInfo } from './templatizer';
export declare class HypergenError extends Error {
    msg: string;
    constructor(msg: string);
    readonly message: string;
}
export declare namespace HypergenError {
    class NoSessionInProgress extends HypergenError {
        constructor();
    }
    class FromNameNotDefined extends HypergenError {
        constructor();
    }
    class CantParseSessionFile extends HypergenError {
        constructor(file: string | null);
    }
    class SessionInProgress extends HypergenError {
        constructor();
    }
    class NothingToGenerate extends HypergenError {
        constructor();
    }
    class NoFilesAdded extends HypergenError {
        constructor();
    }
    class TargetPathNotSet extends HypergenError {
        constructor();
    }
    class NoSuchPath extends HypergenError {
        constructor(file: string | null);
    }
    class FileNotFound extends HypergenError {
        constructor(file: string | null);
    }
    class InvalidSessionFile extends HypergenError {
        constructor(file: string | null);
    }
    class InvalidSessionFileVersion extends HypergenError {
        constructor(file: string | null, version: number);
    }
    class TryingToStartSessionWithoutPath extends HypergenError {
        constructor();
    }
    class AddedFileMustBeUnderBaseDir extends HypergenError {
        constructor(file: string, basedir: string);
    }
}
export interface FilesHash {
    [key: string]: boolean;
}
export declare class HypergenSession {
    about: string;
    hypergen_version: string;
    name: string;
    files_and_dirs: FilesHash;
    templatize_using_name: string | null;
    extra?: any;
    static arrayToFilesHash(arr: Array<string>): FilesHash;
}
export interface FileInfo {
    path: AbsPath;
    included: boolean;
    found: boolean;
}
export declare class Hypergen {
    session: HypergenSession | null;
    static default_session_file_name: string;
    session_file_name: string;
    private session_file_path;
    private session_base_dir;
    private orig_session_json;
    readonly targetDirForGenerators: AbsPath;
    readonly targetDirForGenerator: AbsPath;
    readonly fileCount: number;
    /**
     * Where to find the current session file
     *
     * @return AbsPath object pointing to the file.  If not set, AbsPath(null).
     */
    readonly pathToCurrentSessionFile: AbsPath;
    private _debug_on;
    readonly debugOn: boolean;
    activateDebug(): void;
    private noOutput(...args);
    private output;
    private debug;
    outputFunc: (...args: any[]) => void;
    debugFunc: (...args: any[]) => void;
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
    setPathAndLoadSessionIfExists(for_path: string): boolean;
    /**
     * returns true if a session was started - either by loading one (when setPathAndLoadSessionIfExists was called)
     * or via start()
     */
    readonly isSessionActive: boolean;
    /**
     * @returns true if there is an active session and it has been modified since loaded, or if it's new
     */
    readonly doesSessionNeedSaving: boolean;
    /**
     * @returns true if session required saving, false otherwise
     */
    saveSessionIfActiveAndChanged(): boolean;
    /**
     * start a new session
     *
     * throws error if another session is already in progress
     */
    startSession(name: string): void;
    renameSession(name: string): void;
    /**
     * cancel the current session and delete the session file
     */
    abort(): void;
    add(files_and_dirs: string[], recursive?: boolean, in_subdir?: boolean): void;
    remove(files: string[]): void;
    /**
     * get the definition of param
     *
     * @param param the param to query
     * @returns word that is converted into this param, or null if param is not defined
     */
    getWordConversion(word: string): string | null;
    /**
     * generate templates for all files that are included in the current session
     *
     * @param from_name the word to replace with <%= name %> in the included files
     * @returns information about the would-be generated templates
     */
    getTemplatesUsingName(from_name: string): Array<TemplateInfo>;
    /**
     * generate a template from a single file
     *
     * @param relpath relative path to the original file
     * @param using_name word to use for templatization of the <%= name %> variable
     */
    getTemplate(relpath: string, using_name: string | null): TemplateInfo;
    readonly templates: Array<TemplateInfo>;
    useName(name: string): void;
    paramInfo(param: string | null): string;
    fileAbsPathFromRelPath(relpath: string): AbsPath;
    getFileInfo(files: string[], verbose: boolean | undefined): Array<FileInfo>;
    generate(force?: boolean): void;
    generateTemplateForFile(relpath: string, force?: boolean): void;
    getTemplateTextFor(relpath: string): string;
}
