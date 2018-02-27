"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const fs = require("fs");
/**
 * An immutable path object with utility methods to navigate the filesystem, get information and perform
 * operations on the path (read,write,etc.)
 */
class AbsPath {
    get basename() {
        if (this.abspath == null)
            return "";
        return path.basename(this.abspath);
    }
    /**
     * create an absolute path from a string
     *
     * @param pathseg - if an absolute path, ignores basedir
     *                  if relative path, uses basedir as reference point
     * @param basedir - if null: uses process.cwd() as basedir
     */
    static fromStringAllowingRelative(pathseg = null, basedir = null) {
        if (basedir == null) {
            basedir = process.cwd();
        }
        if (pathseg) {
            if (path.isAbsolute(pathseg)) {
                return new AbsPath(pathseg);
            }
            else {
                return new AbsPath(path.join(basedir, pathseg));
            }
        }
        else {
            return new AbsPath(basedir);
        }
    }
    /**
     * returns the relative path to get to this path from basedir
     *
     * @param basedir reference point. if null: process.cwd()
     */
    relativeFrom(basedir = null) {
        if (this.abspath == null)
            return null;
        if (basedir == null)
            basedir = process.cwd();
        let result = path.relative(basedir.toString(), this.abspath);
        if (result == "") {
            if (this.isDir) {
                result = ".";
            }
        }
        return result;
    }
    /**
     *
     * @param from a string or AbsPath specifying an absolute path, or null
     */
    constructor(from) {
        if (from == null || typeof from == "undefined") {
            this.abspath = null;
        }
        else if (from instanceof AbsPath) {
            this.abspath = from.abspath;
        }
        else {
            if (path.isAbsolute(from)) {
                this.abspath = path.normalize(from);
            }
            else {
                throw new Error(`not an absolute path (${from})`);
            }
        }
    }
    /**
     * @returns normalized absolute path.  returns "" if no path set
     */
    toString() {
        if (this.abspath == null)
            return "";
        return this.abspath;
    }
    /**
     * @returns true if path is set, false if it is null
     */
    get isSet() {
        return (this.abspath != null);
    }
    /**
     *
     * @param other
     * @param must_be_contained_in_other
     */
    relativeTo(other, must_be_contained_in_other = false) {
        if (this.abspath == null)
            return null;
        if (other.abspath == null)
            return null;
        if (must_be_contained_in_other) {
            if (!this.abspath.startsWith(other.abspath))
                return null;
        }
        return path.relative(other.abspath, this.abspath);
    }
    get exists() {
        if (this.abspath == null)
            return false;
        try {
            fs.lstatSync(this.abspath);
            return true;
        }
        catch (e) {
            return false;
        }
    }
    get isFile() {
        if (this.abspath == null)
            return false;
        try {
            return fs.lstatSync(this.abspath).isFile();
        }
        catch (e) {
            return false;
        }
    }
    get isDir() {
        if (this.abspath == null)
            return false;
        try {
            return fs.lstatSync(this.abspath).isDirectory();
        }
        catch (e) {
            return false;
        }
    }
    get isSymLink() {
        if (this.abspath == null)
            return false;
        try {
            return fs.lstatSync(this.abspath).isSymbolicLink();
        }
        catch (e) {
            return false;
        }
    }
    get isRoot() {
        if (this.abspath == null)
            return false;
        return (this.abspath == path.parse(this.abspath).root);
    }
    containsFile(filename) {
        if (this.abspath == null)
            return false;
        return this.add(filename).isFile;
    }
    containsDir(filename) {
        if (this.abspath == null)
            return false;
        return this.add(filename).isDir;
    }
    get parent() {
        if (this.abspath == null)
            return this;
        let parent_dir = path.dirname(this.abspath);
        return new AbsPath(parent_dir);
    }
    add(filepath) {
        if (this.abspath == null)
            return this;
        return new AbsPath(path.join(this.abspath, filepath.toString()));
    }
    static dirHierarchy(filepath) {
        return new AbsPath(filepath).dirHierarchy;
    }
    get dirHierarchy() {
        let current = this;
        let result = [];
        let allowed_depth = 30;
        do {
            result.push(current);
            current = current.parent;
        } while (allowed_depth-- > 0 && !current.isRoot && current.abspath != current.parent.abspath);
        result.push(current.parent);
        return result;
    }
    findUpwards(filename, can_be_dir = false) {
        for (let dir of this.dirHierarchy) {
            if (dir.containsFile(filename)) {
                return dir.add(filename);
            }
            else if (can_be_dir && dir.containsDir(filename)) {
                return dir.add(filename);
            }
        }
        return new AbsPath(null);
    }
    get contentsBuffer() {
        if (this.abspath == null || !this.isFile)
            return new Buffer(0);
        return fs.readFileSync(this.abspath);
    }
    get contentsLines() {
        return this.contentsBuffer.toString().split('\n');
    }
    get contentsFromJSON() {
        if (this.abspath == null || !this.isFile)
            return null;
        let buf = this.contentsBuffer;
        try {
            return JSON.parse(buf.toString());
        }
        catch (e) {
            return null;
        }
    }
    mkdirs() {
        if (this.abspath == null)
            throw new Error("can't mkdirs for null abspath");
        if (this.exists)
            return;
        if (this.isRoot)
            return;
        let parent = this.parent;
        if (parent.exists) {
            if (!parent.isDir)
                throw new Error(`${parent.toString()} exists and is not a directory`);
        }
        else {
            parent.mkdirs();
        }
        fs.mkdirSync(this.abspath);
    }
    saveStrSync(contents) {
        if (this.abspath == null) {
            throw new Error("can't save - abspath is null");
        }
        try {
            this.parent.mkdirs();
        }
        catch (e) {
            throw new Error(`can't save ${this.toString()} - ${e.message}`);
        }
        fs.writeFileSync(this.abspath, contents);
    }
    unlinkFile() {
        this.rmFile();
    }
    rmFile() {
        if (this.abspath == null) {
            throw new Error(`rmFile - path is not set`);
        }
        if (!this.isFile) {
            throw new Error(`rmFile - {$this.filepath} is not a file`);
        }
        fs.unlinkSync(this.abspath);
    }
    get dirContents() {
        if (this.abspath == null)
            return null;
        if (!this.isDir)
            return null;
        let result = [];
        for (let entry of fs.readdirSync(this.abspath)) {
            result.push(this.add(entry));
        }
        return result;
    }
    foreachEntryInDir(fn) {
        let entries = this.dirContents;
        if (entries == null)
            return;
        for (let entry of entries) {
            if (entry.isDir) {
                fn(entry, "down");
                entry.foreachEntryInDir(fn);
                fn(entry, "up");
            }
            else {
                fn(entry, null);
            }
        }
    }
    rmrfdir(must_match, remove_self = false) {
        if (this.abspath == null)
            return;
        if (!this.isDir)
            return;
        if (remove_self && !this.abspath.match(must_match)) {
            throw new Error(`${this.abspath} does not match ${must_match} - aborting delete operation`);
        }
        this.foreachEntryInDir((p, direction) => {
            if (p.abspath == null)
                return;
            if (!p.abspath.match(must_match)) {
                throw new Error(`${p.abspath} does not match ${must_match} - aborting delete operation`);
            }
            if (direction == "up" || direction == null) {
                if (p.isDir) {
                    fs.rmdirSync(p.abspath);
                }
                else {
                    fs.unlinkSync(p.abspath);
                }
            }
        });
        if (remove_self) {
            fs.rmdirSync(this.abspath);
        }
    }
}
exports.AbsPath = AbsPath;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGF0aF9oZWxwZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvcGF0aF9oZWxwZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQSw2QkFBNEI7QUFDNUIseUJBQXdCO0FBRXhCOzs7R0FHRztBQUNIO0lBR0ksSUFBVyxRQUFRO1FBQ2YsRUFBRSxDQUFDLENBQUUsSUFBSSxDQUFDLE9BQU8sSUFBSSxJQUFLLENBQUM7WUFBQyxNQUFNLENBQUMsRUFBRSxDQUFBO1FBQ3JDLE1BQU0sQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQTtJQUN0QyxDQUFDO0lBQ0Q7Ozs7OztPQU1HO0lBQ0ksTUFBTSxDQUFDLDBCQUEwQixDQUFDLFVBQXlCLElBQUksRUFBRSxVQUF1QixJQUFJO1FBQy9GLEVBQUUsQ0FBQyxDQUFFLE9BQU8sSUFBSSxJQUFLLENBQUMsQ0FBQyxDQUFDO1lBQ3BCLE9BQU8sR0FBRyxPQUFPLENBQUMsR0FBRyxFQUFFLENBQUE7UUFDM0IsQ0FBQztRQUNELEVBQUUsQ0FBQyxDQUFFLE9BQVEsQ0FBQyxDQUFDLENBQUM7WUFDWixFQUFFLENBQUMsQ0FBRSxJQUFJLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBRSxDQUFDLENBQUMsQ0FBQztnQkFDN0IsTUFBTSxDQUFDLElBQUksT0FBTyxDQUFDLE9BQU8sQ0FBQyxDQUFBO1lBQy9CLENBQUM7WUFBQyxJQUFJLENBQUMsQ0FBQztnQkFDSixNQUFNLENBQUMsSUFBSSxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsT0FBTyxDQUFDLENBQUMsQ0FBQTtZQUNuRCxDQUFDO1FBQ0wsQ0FBQztRQUFDLElBQUksQ0FBQyxDQUFDO1lBQ0osTUFBTSxDQUFDLElBQUksT0FBTyxDQUFDLE9BQU8sQ0FBQyxDQUFBO1FBQy9CLENBQUM7SUFDTCxDQUFDO0lBRUQ7Ozs7T0FJRztJQUNJLFlBQVksQ0FBQyxVQUFtQyxJQUFJ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