"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const fs = require("fs");
var isBinaryFile = require("isbinaryfile");
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
                this.abspath = path.normalize(path.join(process.cwd(), from));
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
    get isBinaryFile() {
        if (this.abspath == null)
            return false;
        if (!this.isFile)
            return false;
        return isBinaryFile.sync(this.abspath);
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
    get symLinkTarget() {
        if (this.abspath == null)
            return this;
        if (!this.isSymLink)
            return this;
        return new AbsPath(fs.readlinkSync(this.abspath).toString());
    }
    get realpath() {
        if (this.abspath == null)
            return this;
        return new AbsPath(fs.realpathSync(this.abspath));
    }
    mkdirs() {
        if (this.abspath == null)
            throw new Error("can't mkdirs for null abspath");
        if (this.exists)
            return;
        if (this.isRoot)
            return;
        let parent = this.parent;
        if (parent.exists && !parent.isDir && !parent.isSymLink) {
            throw new Error(`${parent.toString()} exists and is not a directory or symlink`);
        }
        else {
            parent.mkdirs();
        }
        fs.mkdirSync(this.parent.realpath.add(this.basename).toString());
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGF0aF9oZWxwZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvcGF0aF9oZWxwZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQSw2QkFBNEI7QUFDNUIseUJBQXdCO0FBQ3hCLElBQUksWUFBWSxHQUFHLE9BQU8sQ0FBQyxjQUFjLENBQUMsQ0FBQTtBQUUxQzs7O0dBR0c7QUFDSDtJQUdJLElBQVcsUUFBUTtRQUNmLEVBQUUsQ0FBQyxDQUFFLElBQUksQ0FBQyxPQUFPLElBQUksSUFBSyxDQUFDO1lBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQTtRQUNyQyxNQUFNLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUE7SUFDdEMsQ0FBQztJQUNEOzs7Ozs7T0FNRztJQUNJLE1BQU0sQ0FBQywwQkFBMEIsQ0FBQyxVQUF5QixJQUFJLEVBQUUsVUFBdUIsSUFBSTtRQUMvRixFQUFFLENBQUMsQ0FBRSxPQUFPLElBQUksSUFBSyxDQUFDLENBQUMsQ0FBQztZQUNwQixPQUFPLEdBQUcsT0FBTyxDQUFDLEdBQUcsRUFBRSxDQUFBO1FBQzNCLENBQUM7UUFDRCxFQUFFLENBQUMsQ0FBRSxPQUFRLENBQUMsQ0FBQyxDQUFDO1lBQ1osRUFBRSxDQUFDLENBQUUsSUFBSSxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUUsQ0FBQyxDQUFDLENBQUM7Z0JBQzdCLE1BQU0sQ0FBQyxJQUFJLE9BQU8sQ0FBQyxPQUFPLENBQUMsQ0FBQTtZQUMvQixDQUFDO1lBQUMsSUFBSSxDQUFDLENBQUM7Z0JBQ0osTUFBTSxDQUFDLElBQUksT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLE9BQU8sQ0FBQyxDQUFDLENBQUE7WUFDbkQsQ0FBQztRQUNMLENBQUM7UUFBQyxJQUFJLENBQUMsQ0FBQztZQUNKLE1BQU0sQ0FBQyxJQUFJLE9BQU8sQ0FBQyxPQUFPLENBQUMsQ0FBQTtRQUMvQixDQUFDO0lB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