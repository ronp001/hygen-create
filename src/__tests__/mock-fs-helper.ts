import * as mockfs from 'mock-fs'
import * as fs from 'fs'
import * as path from 'path'
import * as _ from 'lodash'
import { AbsPath } from '../path_helper';
import { isString } from 'util';

export class MockFSHelper {

    public constructor(public fs_structure : {[key:string]:any} = {}) {}

    public addSourceDirContents() : MockFSHelper {
        this.addDirContents(this.src_dir)
        return this
    }

    public addFile(file: AbsPath|string) : MockFSHelper {
        if ( isString(file) ) {
            file = new AbsPath(file)
        }
        this.fs_structure[file.abspath] = file.contentsBuffer.toString() 
        return this
    }

    public addDirContents(dir: AbsPath, max_levels : number = 5) : MockFSHelper {
        for ( let entry of dir.dirContents || []) {
            if ( entry.isFile ) { 
                this.fs_structure[entry.abspath] = entry.contentsBuffer.toString() 
            } else if ( entry.isDir && max_levels > 0) {
                this.addDirContents(entry, max_levels-1)
            }
        }
        return this
    }

    public get src_dir() : AbsPath {
        return new AbsPath(__dirname).findUpwards("src", true)
    }

    public addDirs(dirs: Array<string|AbsPath>) : MockFSHelper {
        for ( let dir of dirs ) {
            this.addDirContents(new AbsPath(dir))
        }
        return this
    }

    public static ls(dir: AbsPath|string, max_levels : number = 5, with_contents_of : Array<string> | null = null) : {[key:string]:any} {
        let result = {}
        if ( typeof(dir) == "string") dir = new AbsPath(dir)

        for ( let entry of dir.dirContents || []) {
            // console.log(entry.abspath)
            if ( entry.isFile ) { 
                if ( with_contents_of && (with_contents_of[0] == '*' || _.includes(with_contents_of, entry.abspath))) {
                    result[entry.basename] = entry.contentsBuffer.toString()
                } else {
                    result[entry.basename] = "<file>"
                }
            } else if ( entry.isDir ) {
                if ( max_levels > 0) {
                    result[entry.basename] = this.ls(entry, max_levels - 1, with_contents_of)
                } else {
                    result[entry.basename] = "<dir>"
                }
            }
        }
        return result
    }
}

test('a blank test to quiet down the IDE', () => {
    
})