/// <reference types="node" />
/**
 * An immutable path object with utility methods to navigate the filesystem, get information and perform
 * operations on the path (read,write,etc.)
 */
export declare class AbsPath {
    readonly abspath: string | null;
    readonly basename: string;
    /**
     * create an absolute path from a string
     *
     * @param pathseg - if an absolute path, ignores basedir
     *                  if relative path, uses basedir as reference point
     * @param basedir - if null: uses process.cwd() as basedir
     */
    static fromStringAllowingRelative(pathseg?: string | null, basedir?: string | null): AbsPath;
    /**
     * returns the relative path to get to this path from basedir
     *
     * @param basedir reference point. if null: process.cwd()
     */
    relativeFrom(basedir?: AbsPath | string | null): string | null;
    /**
     *
     * @param from a string or AbsPath specifying an absolute path, or null
     */
    constructor(from: string | null | undefined | AbsPath);
    /**
     * @returns normalized absolute path.  returns "" if no path set
     */
    toString(): string;
    /**
     * @returns true if path is set, false if it is null
     */
    readonly isSet: boolean;
    /**
     *
     * @param other
     * @param must_be_contained_in_other
     */
    relativeTo(other: AbsPath, must_be_contained_in_other?: boolean): string | null;
    readonly exists: boolean;
    readonly isBinaryFile: boolean;
    readonly isFile: boolean;
    readonly isDir: boolean;
    readonly isSymLink: boolean;
    readonly isRoot: boolean;
    containsFile(filename: string): boolean;
    containsDir(filename: string): boolean;
    readonly parent: AbsPath;
    add(filepath: string | AbsPath): AbsPath;
    static dirHierarchy(filepath: string): Array<AbsPath>;
    readonly dirHierarchy: Array<AbsPath>;
    findUpwards(filename: string, can_be_dir?: boolean): AbsPath;
    readonly contentsBuffer: Buffer;
    readonly contentsLines: Array<string>;
    readonly contentsFromJSON: Object | null;
    readonly symLinkTarget: AbsPath;
    readonly realpath: AbsPath;
    mkdirs(): void;
    saveStrSync(contents: string): void;
    unlinkFile(): void;
    rmFile(): void;
    readonly dirContents: Array<AbsPath> | null;
    foreachEntryInDir(fn: (entry: AbsPath, traversal_direction: "down" | "up" | null) => boolean | void): boolean;
    rmrfdir(must_match: RegExp, remove_self?: boolean): void;
    readonly existingVersions: number[] | null;
    readonly maxVer: number | null;
    renameTo(new_name: string): void;
    renameToNextVer(): string;
}
