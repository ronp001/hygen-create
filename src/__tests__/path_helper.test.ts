///<reference types="jest"/>
import * as mockfs from 'mock-fs'
import * as fs from 'fs'
import * as path from 'path'
import {AbsPath} from "../path_helper"
import {MockFSHelper} from "./mock-fs-helper"


let simfs = new MockFSHelper({
    '/base': {
        'file1' : "this is file1",
        'file2' : "this is file2",
        'symlink_to_file1': mockfs.symlink({ path: 'file1 '}),
        'f' : "f in /",
        'inner' : {
            'file-in-inner': 'this is root/inner/file-in-inner'
        }
    },
    '/dir1' : {
        '1file1' : "this is 1file1",
        'f' : "f in /dir1"
    },
    '/dir1/dir11' : {
        '11file1' : "this is 11file1",
        '11file2' : "this is 11file2",
        'f' : "f in /dir1/dir11",
    },
    '/dir1/dir12' : {
        '12file1' : "this is 12file1",
        '12file2' : "this is 12file2",
        'f' : "f in /dir1/dir12",
    },
})

// Prepare path_helper.ts for inclusion in the mocked filesystem
// so that exceptions are displayed properly by jest
simfs.addFile(__dirname + "/../path_helper.ts")


beforeEach(async () => {
    mockfs(simfs.fs_structure)
})
  
afterEach(async () => {
    mockfs.restore()
})

test('mockfs({}) adds the current directory', () => {
    mockfs({})
    expect(AbsPath.fromStringAllowingRelative().isDir).toBeTruthy()
})

test('path_helper is in the mocked fs', () => {
    expect(new AbsPath(__dirname + "/../path_helper.ts").isFile).toBeTruthy()
})

test('binary file recognition', () => {
    mockfs.restore()
    expect(new AbsPath(__dirname + "../../../example/example_status.png").isFile).toBeTruthy()
    expect(new AbsPath(__dirname + "../../../example/example_status.png").isBinaryFile).toBeTruthy()

    expect(new AbsPath(__dirname + "../../../example/package.json").isFile).toBeTruthy()
    expect(new AbsPath(__dirname + "../../../example/package.json").isBinaryFile).toBeFalsy()
})

test.skip('traversal', () => {
    let p = new AbsPath('/')
    p.foreachEntryInDir((e:AbsPath, direction:"down"|"up"|null) => {
        console.log(e.toString(), direction)
    })
})

test('rmrfdir', () => {
    let p = new AbsPath('/base')
    expect(p.exists).toBeTruthy()

    expect(() => {p.rmrfdir(/not_base/, true)}).toThrow(/does not match/)
    expect(() => {p.rmrfdir(/^\/base/, true)}).not.toThrow()
    expect(p.exists).toBeFalsy()
})


test('node.js path functions are working as I think they do', () => {
    expect(path.normalize('/')).toEqual('/')
    expect(path.normalize('/..')).toEqual('/')
    expect(path.normalize('a')).toEqual('a')
    expect(path.normalize('a/b/c/../d')).toEqual('a/b/d')
    expect(path.normalize('a/b/c/../d/')).toEqual('a/b/d/')
})

test('file mocks are working properly', () => {
    let contents = fs.readFileSync('/base/file1')
    expect(contents.toString()).toEqual("this is file1")
    expect(new AbsPath('/base/file1').isFile).toBeTruthy()

    // replace the fs mock
    mockfs({
        '/test2' : 'test 2'
    })

    expect(fs.readFileSync('/test2').toString()).toEqual("test 2")
    expect(new AbsPath('/base/file1').isFile).toBeFalsy()
})


test('isFile and isDir', () => {
    expect(new AbsPath('/dir1').isDir).toBeTruthy()
    expect(new AbsPath('/dir1').isFile).toBeFalsy()

    expect(new AbsPath('/dir1/f').isFile).toBeTruthy()
    expect(new AbsPath('/dir1/f').isDir).toBeFalsy()

    expect(new AbsPath('/base/symlink_to_file1').exists).toBeTruthy()
    expect(new AbsPath('/base/symlink_to_file1').isSymLink).toBeTruthy()
    expect(new AbsPath('/base/symlink_to_file1').isDir).toBeFalsy()
    expect(new AbsPath('/base/symlink_to_file1').isFile).toBeFalsy()
})

test('construction', () => {
    let ph = new AbsPath('/');
    expect(ph).toBeInstanceOf(AbsPath)
});

test('fs mocks', () => {
    expect(fs.lstatSync('/base/file1').isFile()).toBeTruthy()
    expect(fs.lstatSync('/base/file2').isFile()).toBeTruthy()
    expect(fs.lstatSync('/dir1').isDirectory()).toBeTruthy()
    expect(fs.lstatSync('/dir1').isFile()).toBeFalsy()
    expect(fs.lstatSync('/dir1/1file1').isFile()).toBeTruthy()
})

test('parent', () => {
    let ph = new AbsPath('/dir1/dir11')
    expect(ph.toString()).toEqual("/dir1/dir11")
    expect(ph.parent.toString()).toEqual("/dir1")
    expect(ph.parent.parent.toString()).toEqual("/")
    expect(ph.parent.parent.parent.toString()).toEqual("/")
})

test('relativeTo', () => {
    let ph = new AbsPath('/dir1/dir11')
    expect(ph.relativeTo(new AbsPath('/dir1'))).toEqual("dir11")
    expect(ph.relativeTo(new AbsPath('/dir1'), true)).toEqual("dir11")
    expect(ph.relativeTo(new AbsPath('/dir2'))).toEqual("../dir1/dir11")
    expect(ph.relativeTo(new AbsPath('/dir2'), true)).toBeNull()
})


test('containsFile', () => {
    let ph = new AbsPath('/base');
    expect(ph.containsFile('f')).toBeTruthy()
    expect(ph.containsFile('g')).toBeFalsy()
    
    ph = new AbsPath('/dir1')
    expect(ph.containsFile('f')).toBeTruthy()
    
    ph = new AbsPath(null)
    expect(ph.containsFile('f')).toBeFalsy()
});

test('exists', () => {
    expect(new AbsPath('/').exists).toBeTruthy()
    expect(new AbsPath('/dir1').exists).toBeTruthy()
    expect(new AbsPath('/nosuchfile').exists).toBeFalsy()
})


test('is root', () => {
    expect(new AbsPath('/').isRoot).toBeTruthy()
    expect(new AbsPath('/dir1').isRoot).toBeFalsy()
    expect(new AbsPath('/dir1').parent.isRoot).toBeTruthy()
})

test('dir hierarchy', () => {
    expect(new AbsPath('/dir1/dir11').dirHierarchy).toEqual([new AbsPath('/dir1/dir11'), new AbsPath('/dir1'), new AbsPath('/')])
    expect(AbsPath.dirHierarchy('/dir1/dir11')).toEqual([new AbsPath('/dir1/dir11'), new AbsPath('/dir1'), new AbsPath('/')])
})

test('path to file', () => {
    let p = new AbsPath('/dir1/dir12')
    expect(p.findUpwards('f').toString()).toEqual('/dir1/dir12/f')
    expect(p.findUpwards('1file1').toString()).toEqual('/dir1/1file1')
    expect(p.findUpwards('g')).toEqual(new AbsPath(null))
    expect(p.findUpwards('g').toString()).toEqual("")
})

test('dir contents', () => {
    mockfs({
        '/dir1': 'f1',
        '/base': 'f2'
    },{createCwd: false, createTmp: false})

    let p = new AbsPath('/')
    expect(p.dirContents).toEqual([
        new AbsPath('/base'), new AbsPath('/dir1')
    ])
})

test('null path', () => {
    let p = new AbsPath(null)
    expect(p.isSet).toBeFalsy()
    let p2 = new AbsPath('/')
    expect(p2.isSet).toBeTruthy()
})

test('mkdirs', () => {
    let p = new AbsPath("/l1/l2/l3/l4/l5")
    expect(p.isDir).toBeFalsy()
    expect(()=>{p.mkdirs()}).not.toThrow()
    expect(p.parent.toString()).toEqual("/l1/l2/l3/l4")
    expect(p.parent.isDir).toBeTruthy()
    expect(p.isDir).toBeTruthy()
    
    let f = p.add('file')
    f.saveStrSync('contents')
    
    let p2 = new AbsPath("/l1/l2/l3/l4/l5/file/l6")
    expect(()=>{p2.mkdirs()}).toThrow(/exists and is not a directory/)
})

