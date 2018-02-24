import * as path from 'path'
import * as fs from 'fs'

/**
 * An immutable path object with utility methods to navigate the filesystem, get information and perform 
 * operations on the path (read,write,etc.)
 */
export class AbsPath {
    public readonly abspath : string | null

    public get basename() : string {
        if ( this.abspath == null ) return ""
        return path.basename(this.abspath)
    }
    /**
     * create an absolute path from a string
     * 
     * @param pathseg - if an absolute path, ignores basedir
     *                  if relative path, uses basedir as reference point
     * @param basedir - if null: uses process.cwd() as basedir
     */
    public static fromStringAllowingRelative(pathseg: string | null = null, basedir: string|null = null) : AbsPath {
        if ( basedir == null ) {
            basedir = process.cwd()
        }
        if ( pathseg ) {
            if ( path.isAbsolute(pathseg) ) {
                return new AbsPath(pathseg)
            } else {
                return new AbsPath(path.join(basedir, pathseg))
            }
        } else {
            return new AbsPath(basedir)
        }
    }

    /**
     * returns the relative path to get to this path from basedir
     * 
     * @param basedir reference point. if null: process.cwd()
     */
    public relativeFrom(basedir: AbsPath | string | null = null) : string | null {
        if ( this.abspath == null ) return null
        if ( basedir == null ) basedir = process.cwd()

        let result = path.relative(basedir.toString(), this.abspath)
        if ( result == "" ) {
            if ( this.isDir ) {
                result = "."
            } 
        }

        return result
    }

    /**
     * 
     * @param from a string or AbsPath specifying an absolute path, or null
     */
    constructor(from: string|null|undefined|AbsPath) {
        if ( from == null || typeof from == "undefined" ) {
            this.abspath = null
        } else if ( from instanceof AbsPath ) {
            this.abspath = from.abspath
        } else {
            if ( path.isAbsolute(from)) {
                this.abspath = path.normalize(from)
            } else {
                throw new Error(`not an absolute path (${from})`)
            }
        }
    }
    
    /**
     * @returns normalized absolute path.  returns "" if no path set
     */
    public toString() : string {
        if ( this.abspath == null ) return ""
        return this.abspath
    }

    /**
     * @returns true if path is set, false if it is null
     */
    public get isSet() : boolean {
        return ( this.abspath != null )
    }

    /**
     * 
     * @param other 
     * @param must_be_contained_in_other 
     */
    public relativeTo(other:AbsPath, must_be_contained_in_other : boolean = false) : string | null {
        if ( this.abspath == null ) return null
        if ( other.abspath == null ) return null

        if ( must_be_contained_in_other ) {
            if ( !this.abspath.startsWith(other.abspath) ) return null
        }
        return path.relative(other.abspath, this.abspath)
    }
    
    public get exists() : boolean {
        if ( this.abspath == null ) return false
        try {
            fs.lstatSync(this.abspath)
            return true
        } catch ( e ) {
            return false
        }
    }
    public get isFile() : boolean {
        if ( this.abspath == null ) return false
        try {
            return fs.lstatSync(this.abspath).isFile()
        } catch ( e ) {
            return false
        }
    }

    public get isDir() : boolean {
        if ( this.abspath == null ) return false
        try {
            return fs.lstatSync(this.abspath).isDirectory()
        } catch ( e ) {
            return false
        }
    }

    public get isSymLink() : boolean {
        if ( this.abspath == null ) return false
        try {
            return fs.lstatSync(this.abspath).isSymbolicLink()
        } catch ( e ) {
            return false
        }
    }

    public get isRoot() : boolean {
        if ( this.abspath == null ) return false
        return ( this.abspath == path.parse(this.abspath).root )
    }

    public containsFile(filename: string) {
        if (this.abspath == null ) return false;
        return this.add(filename).isFile
    }
    public containsDir(filename: string) {
        if (this.abspath == null ) return false;
        return this.add(filename).isDir
    }
    public get parent() : AbsPath {
        if (this.abspath == null) return this
        let parent_dir = path.dirname(this.abspath)
        return new AbsPath(parent_dir)
    }
    public add(filepath: string|AbsPath) : AbsPath {
        if ( this.abspath == null) return this
        return new AbsPath(path.join(this.abspath, filepath.toString()))
    }
    public static dirHierarchy(filepath: string) : Array<AbsPath> {
        return new AbsPath(filepath).dirHierarchy
    }

    public get dirHierarchy() : Array<AbsPath> {
        let current : AbsPath = this
        let result : Array<AbsPath> = []
        let allowed_depth = 30
        do {
            result.push(current)
            current = current.parent
        } while ( allowed_depth-- > 0 && !current.isRoot && current.abspath != current.parent.abspath )
        result.push(current.parent)

        return result
    }

    public findUpwards(filename: string, can_be_dir: boolean = false) : AbsPath {
        for ( let dir of this.dirHierarchy ) {
            if ( dir.containsFile(filename) ) {
                return dir.add(filename);
            } else if ( can_be_dir && dir.containsDir(filename)) {
                return dir.add(filename);
            }
        }
        return new AbsPath(null);
    }

    public get contentsBuffer() : Buffer {
        if ( this.abspath == null || !this.isFile ) return new Buffer(0)

        return fs.readFileSync(this.abspath)
    }

    public get contentsLines() : Array<string> {
        return this.contentsBuffer.toString().split('\n')
    }
    
    public get contentsFromJSON() : Object | null {
        if ( this.abspath == null || !this.isFile ) return null
        let buf = this.contentsBuffer
        try {
            return JSON.parse(buf.toString())
        } catch ( e ) {
            return null
        }
    }

    public mkdirs() {
        if ( this.abspath == null ) throw new Error("can't mkdirs for null abspath")
        if ( this.exists ) return
        if ( this.isRoot ) return

        let parent = this.parent        
        if ( parent.exists ) {
            if ( !parent.isDir ) throw new Error(`${parent.toString()} exists and is not a directory`)
        } else {
            parent.mkdirs()
        }

        fs.mkdirSync(this.abspath)
    }

    public saveStrSync(contents:string) {
        if ( this.abspath == null ) {
            throw new Error("can't save - abspath is null")
        }
        try {
            this.parent.mkdirs()
        } catch( e ){
            throw new Error(`can't save ${this.toString()} - ${e.message}`)
        }
        fs.writeFileSync(this.abspath, contents)
    }

    public unlinkFile() {
        this.rmFile()
    }

    public rmFile() {
        if ( this.abspath == null ) {
            throw new Error(`rmFile - path is not set`)
        }
        if ( !this.isFile ) {
            throw new Error(`rmFile - {$this.filepath} is not a file`)
        }
        fs.unlinkSync(this.abspath)
    }

    public get dirContents() : Array<AbsPath> | null {
        if (this.abspath == null ) return null
        if (!this.isDir ) return null

        let result : Array<AbsPath> = []

        for( let entry of fs.readdirSync(this.abspath) ) {
            result.push(this.add(entry))
        }
        return result
    }

    public foreachEntryInDir(fn:(entry:AbsPath,traversal_direction:"down"|"up"|null) => void) {
        let entries = this.dirContents
        if ( entries == null ) return

        for ( let entry of entries ) {
            if ( entry.isDir ) {
                fn(entry, "down")
                entry.foreachEntryInDir(fn)
                fn(entry, "up")
            } else {
                fn(entry, null)
            }
        }
    }

    public rmrfdir(must_match:RegExp, remove_self:boolean=false) {
        if ( this.abspath == null ) return
        if ( !this.isDir ) return
        if ( remove_self && !this.abspath.match(must_match) ) {
            throw new Error(`${this.abspath} does not match ${must_match} - aborting delete operation`)
        }
        this.foreachEntryInDir((p:AbsPath, direction:"down"|"up"|null) => {
            if ( p.abspath == null) return
            if ( !p.abspath.match(must_match) ) {
                throw new Error(`${p.abspath} does not match ${must_match} - aborting delete operation`)
            }
            if ( direction == "up" || direction == null) {
                if ( p.isDir ) {
                    fs.rmdirSync(p.abspath)
                } else {
                    fs.unlinkSync(p.abspath)
                }
            }
        })
        if ( remove_self ) {
            fs.rmdirSync(this.abspath)
        }
    }
}