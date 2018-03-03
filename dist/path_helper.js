"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const fs = require("fs");
const _ = require("lodash");
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
            return true;
        for (let entry of entries) {
            if (entry.isDir) {
                let abort;
                abort = fn(entry, "down");
                if (abort)
                    return true;
                abort = entry.foreachEntryInDir(fn);
                if (abort)
                    return true;
                abort = fn(entry, "up");
                if (abort)
                    return true;
            }
            else {
                let abort = fn(entry, null);
                if (abort)
                    return true;
            }
        }
        return false;
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
    get existingVersions() {
        if (this.abspath == null)
            return null;
        if (!this.exists)
            return null;
        let regex = new RegExp(`${this.abspath}\.([0-9]+)`);
        let existing = this.parent.dirContents;
        let matching = _.map(existing, (el) => {
            let matches = el.toString().match(regex);
            if (matches == null)
                return null;
            return parseInt(matches[1]);
        });
        let nums = _.filter(matching, (e) => { return e != null; });
        return _.sortBy(nums);
    }
    get maxVer() {
        let existing_versions = this.existingVersions;
        if (existing_versions == null)
            return null;
        let max = _.max(existing_versions);
        if (max == undefined)
            return null;
        return max;
    }
    renameTo(new_name) {
        if (this.abspath == null)
            return;
        if (!this.exists)
            return;
        fs.renameSync(this.abspath, new_name);
    }
    renameToNextVer() {
        let current_max_ver = this.maxVer;
        let newname;
        if (current_max_ver == null) {
            newname = this.abspath + ".1";
        }
        else {
            newname = this.abspath + `.${current_max_ver + 1}`;
        }
        this.renameTo(newname);
        return newname;
    }
}
exports.AbsPath = AbsPath;
