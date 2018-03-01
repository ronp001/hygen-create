///<reference types="jest"/>
import {HygenCreate, HygenCreateError, HygenCreateSession} from "../hygen-create"
import * as mockfs from 'mock-fs'
import * as fs from 'fs'
import { AbsPath } from "../path_helper";

// Prepare hygen_create.ts for inclusion in the mocked filesystem
// so that exceptions are displayed properly by jest
let path_to_hygen_create = __dirname + "/../hygen-create.ts"
let hygen_create_contents = fs.readFileSync(path_to_hygen_create)

beforeEach(async () => {
    
    // Create an in-memory file system
    
    let simfs : {[key:string]: any} = {
        '/test': {
            'note.md': 'hello world!'
        },
        '/active_project/subdir' : {
            'file1' : 'this is file1',
            'file2' : 'this is file2',
            'package.json' : '{"name":"any name"}'
        },
        '/newproj' : {
            'just_a_file.txt' : 'nothing interesting here'
        },
        '/not_a_project/subdir' : {
            'file1' : 'this is file1 (in not active)'
        },
        '/project2' : {
            'package.json' : JSON.stringify({name: 'pkg1'}),
            'src' : {
                'main.ts' : 'class Main\n{constructor(){\nconsole.log("This is main")\n}\n}'
            },
            'another_file' : 'just some text',
            'dist' : {}
        },
        '/out' : {}
    }
    simfs[`/active_project/${HygenCreate.default_session_file_name}`] = JSON.stringify({hygen_create_version: "0.1.0", extra: 1, files_and_dirs: ['f1','f2','f3']})
    simfs[`/active_project/${HygenCreate.default_session_file_name}.high_version`] = JSON.stringify({hygen_create_version: "100.0.0", extra: 1})
    
    simfs[`/project2/${HygenCreate.default_session_file_name}`] = JSON.stringify({hygen_create_version: "0.1.0"})
    
    // make sure exceptions are displayed properly by jest
    simfs[path_to_hygen_create] = hygen_create_contents
    
    mockfs(simfs)
})
  
afterEach(async () => {
    mockfs.restore()
})

test('construction', () => {
    let hpg = new HygenCreate();
    expect(hpg).toBeInstanceOf(HygenCreate)
});

describe("loading sessions", () => {
    test('does not load session when loadOrCreateSession path is a directory hierarchy without a hygen-create session file', () => {
    let hpg = new HygenCreate()
        expect(hpg.setPathAndLoadSessionIfExists('/')).toBeFalsy()
        expect(hpg.isSessionActive).toBeFalsy()
    })
    
    test('loads session when loadOrCreateSession path is a directory with a hygen-create.json file', () => {
        let hpg = new HygenCreate()
        expect(hpg.setPathAndLoadSessionIfExists('/active_project')).toBeTruthy()
        expect(hpg.isSessionActive).toBeTruthy()
        expect((hpg.session as HygenCreateSession).extra).toEqual(1)
    })
    
    test('loads session when loadOrCreateSession path is a directory inside a session hierarchy', () => {
        let hpg = new HygenCreate()
        expect(hpg.setPathAndLoadSessionIfExists('/active_project/subdir')).toBeTruthy()
        expect(hpg.isSessionActive).toBeTruthy()
        expect((hpg.session as HygenCreateSession).extra).toEqual(1)
    
        expect(hpg.doesSessionNeedSaving).toBeFalsy()
    })
    
    test('throws the correct exception when pointed to invalid session file', () => {
        let hpg = new HygenCreate()
        expect(() => {hpg.setPathAndLoadSessionIfExists('/active_project/subdir/file1')}).toThrowError(HygenCreateError.CantParseSessionFile)
        expect(() => {hpg.setPathAndLoadSessionIfExists('/active_project/subdir/package.json')}).toThrowError(HygenCreateError.InvalidSessionFile)
        expect(() => {hpg.setPathAndLoadSessionIfExists('/active_project/subdir/nosuchfile')}).toThrowError(HygenCreateError.NoSuchPath)
        expect(() => {hpg.setPathAndLoadSessionIfExists(`/active_project/${HygenCreate.default_session_file_name}.high_version`)}).toThrowError(HygenCreateError.InvalidSessionFileVersion)
    })    
})

describe('Creating sessions', () => {
    test('throws error if trying to create session without setting path first',() => {
        let hpg = new HygenCreate()
        expect(() => {hpg.startSession('test')}).toThrowError(HygenCreateError.TryingToStartSessionWithoutPath)
    })

    test('starting a session twice', () => {
        let hpg = new HygenCreate();
        hpg.setPathAndLoadSessionIfExists('/newproj')
        hpg.startSession('test')
        expect(() => {hpg.startSession('test')}).toThrowError(HygenCreateError.SessionInProgress)
        expect(hpg.isSessionActive).toBeTruthy()
    })
    

    test('creates saveable session',() => {
        let hpg = new HygenCreate()
        expect(hpg.setPathAndLoadSessionIfExists('/newproj')).toBeFalsy()
        expect(hpg.saveSessionIfActiveAndChanged()).toBeFalsy()
        expect(hpg.isSessionActive).toBeFalsy()
        hpg.startSession('test')
        expect(hpg.isSessionActive).toBeTruthy()
        expect(hpg.doesSessionNeedSaving).toBeTruthy()
        expect(hpg.saveSessionIfActiveAndChanged()).toBeTruthy()
    
        let contents = fs.readFileSync(`/newproj/${HygenCreate.default_session_file_name}`)
        let parsed = JSON.parse(contents.toString()) as HygenCreateSession
        expect(parsed.hygen_create_version).toEqual("0.1.0")
    })
})

describe('loading and saving sessions', () => {

    test('loading previously saved version', () => {
        let hpg1 = new HygenCreate()
        expect(hpg1.setPathAndLoadSessionIfExists('/newproj')).toBeFalsy()
        expect(() => {hpg1.startSession('test')}).not.toThrow()
        expect(hpg1.saveSessionIfActiveAndChanged()).toBeTruthy()
        
        let hpg2 = new HygenCreate()
        expect(() => {hpg2.setPathAndLoadSessionIfExists('/newproj')}).not.toThrow()
    })

    test('loading a somewhat malformed session', () => {
        let hpg = new HygenCreate()
        expect(hpg.setPathAndLoadSessionIfExists('/active_project')).toBeTruthy()
        if ( hpg.session == null ) {
            expect(hpg.session).not.toBeNull()
        } else {
            expect(hpg.session.files_and_dirs).toEqual({'f1':true, 'f2':true, 'f3':true})
            expect(hpg.session.templatize_using_name).toBeNull()
        }
    })

    test('does not overwite a non-session file', () => {
        let hpg = new HygenCreate()
    
        let file1str = fs.readFileSync('/active_project/subdir/file1').toString()
        let pkgstr = fs.readFileSync('/active_project/subdir/package.json').toString()
    
        expect(() => {hpg.setPathAndLoadSessionIfExists('/active_project/subdir/file1')}).toThrowError(HygenCreateError.CantParseSessionFile)
        expect(() => {hpg.startSession('test')}).toThrowError(HygenCreateError.TryingToStartSessionWithoutPath)
        expect(() => {hpg.setPathAndLoadSessionIfExists('/active_project/subdir/package.json')}).toThrowError(HygenCreateError.InvalidSessionFile)
        expect(() => {hpg.startSession('test')}).toThrowError(HygenCreateError.TryingToStartSessionWithoutPath)
        expect(hpg.saveSessionIfActiveAndChanged()).toBeFalsy()
    
        expect(fs.readFileSync('/active_project/subdir/file1').toString()).toEqual(file1str)
        expect(fs.readFileSync('/active_project/subdir/package.json').toString()).toEqual(pkgstr)
    })
    
    
    test('starting a session after stopping a session', () => {
        let hpg = new HygenCreate();
        hpg.setPathAndLoadSessionIfExists('/newproj')
        let sessionpath = hpg.pathToCurrentSessionFile
        
        hpg.startSession('test')
        expect(hpg.isSessionActive).toBeTruthy()
        
        hpg.saveSessionIfActiveAndChanged()
        expect(sessionpath.isFile).toBeTruthy()  // session file should have been created
        
        hpg.abort()
        expect(hpg.isSessionActive).toBeFalsy()
        expect(() => {hpg.startSession('test')}).not.toThrow()
        expect(hpg.isSessionActive).toBeTruthy()
        expect(sessionpath.isFile).toBeFalsy()  // session file should have been deleted
    })    
})

describe('Adding files, directories and symlinks', () => {
    test('adding files and dirs', () => {
        let hpg = new HygenCreate();
        hpg.setPathAndLoadSessionIfExists('/project2')
        
        expect(() => {hpg.add(['/project2/package.json'])}).not.toThrow()
        expect(() => {hpg.add(['/project2/src/main.ts'])}).not.toThrow()
        expect(() => {hpg.add(['/project2/src/nosuchfile'])}).toThrow(HygenCreateError.FileNotFound)
        expect(() => {hpg.add(['/project2/dist'])}).not.toThrow()
        
        if ( hpg.session == null ) {
            expect(hpg.session).not.toBeNull()
        } else {
            expect(hpg.session.files_and_dirs['package.json']).not.toBeUndefined()
            expect(hpg.session.files_and_dirs['src/main.ts']).not.toBeUndefined()
            expect(hpg.session.files_and_dirs['dist']).toBeUndefined()
        }
        
        expect(hpg.doesSessionNeedSaving).toBeTruthy()
        expect(hpg.saveSessionIfActiveAndChanged()).toBeTruthy()
        
        // now load in a different HygenCreate object
        let hpg2 = new HygenCreate()
        hpg2.setPathAndLoadSessionIfExists('/project2')
        if ( hpg2.session == null ) {
            expect(hpg2.session).not.toBeNull()
        } else {
            expect(hpg2.session.files_and_dirs['package.json']).not.toBeUndefined()
            expect(hpg2.session.files_and_dirs['src/main.ts']).not.toBeUndefined()
            expect(hpg2.session.files_and_dirs['dist']).toBeUndefined()
        }
    })
    
    test('removing files/dirs', () => {
        let hpg1 = new HygenCreate()
        expect(hpg1.setPathAndLoadSessionIfExists('/active_project')).toBeTruthy()
        if ( hpg1.session == null ) {
            expect(hpg1.session).not.toBeNull()
        } else {
            expect(hpg1.session.files_and_dirs).toEqual({'f1':true, 'f2':true, 'f3':true})
            expect(hpg1.fileCount).toEqual(3)
            expect(() => {hpg1.remove(['/active_project/f1'])}).not.toThrow()
            expect(hpg1.fileCount).toEqual(2)
            expect(hpg1.session.files_and_dirs['f1']).toBeUndefined()
            expect(hpg1.session.files_and_dirs['f2']).toBeTruthy()
        }
        hpg1.saveSessionIfActiveAndChanged()

        // now load in a different HygenCreate object
        let hpg2 = new HygenCreate()
        hpg2.setPathAndLoadSessionIfExists('/active_project')
        if ( hpg2.session == null ) {
            expect(hpg2.session).not.toBeNull()
        } else {
            expect(hpg2.session.files_and_dirs['f1']).toBeUndefined()
            expect(hpg2.session.files_and_dirs['f2']).toBeTruthy()
        }
    })
})

describe('templatizations', () => {
    test('template for an included file', () => {
        let hpg = new HygenCreate();
        hpg.setPathAndLoadSessionIfExists('/project2')
        
        expect(() => {hpg.add(['/project2/package.json'])}).not.toThrow()
        if ( hpg.session == null ) {
            expect(hpg.session).not.toBeNull()
        } else {
            hpg.useName('pkg1')
            let tpl = hpg.getTemplateTextFor('package.json').split('\n')
            let l=0
            expect(tpl.length).toEqual(4)
            expect(tpl[l++]).toEqual('---')
            expect(tpl[l++]).toEqual('to: <%= name %>/package.json')
            expect(tpl[l++]).toEqual('---')
            expect(tpl[l++]).toEqual('{"name":"<%= name.toLowerCase() %>"}')
        }
    })
    test('template for multiline file', () => {
        let hpg = new HygenCreate();
        hpg.setPathAndLoadSessionIfExists('/project2')
        
        expect(() => {hpg.add(['/project2/src/main.ts'])}).not.toThrow()
        if ( hpg.session == null ) {
            expect(hpg.session).not.toBeNull()
        } else {
            hpg.useName('main')
            let tpl = hpg.getTemplateTextFor('src/main.ts').split('\n')
            let l=0
            expect(tpl.length).toEqual(8)
            expect(tpl[l++]).toEqual('---')
            expect(tpl[l++]).toEqual('to: <%= name %>/src/<%= name.toLowerCase() %>.ts')
            expect(tpl[l++]).toEqual('---')
            expect(tpl[l++]).toEqual('class <%= h.capitalize(name) %>')
            expect(tpl[l++]).toEqual('{constructor(){')
            expect(tpl[l++]).toEqual('console.log("This is <%= name.toLowerCase() %>")')
            expect(tpl[l++]).toEqual('}')
            expect(tpl[l++]).toEqual('}')
        }
    })
})

describe('additional tests', () => {
    test('adding entire directories', () => {
        let hpg = new HygenCreate();
        hpg.setPathAndLoadSessionIfExists('/project2')
        
        expect(() => {hpg.add(['/project2'])}).not.toThrow()
        if ( hpg.session == null ) {
            expect(hpg.session).not.toBeNull()
        } else {
            expect(hpg.session.files_and_dirs['package.json']).toBeTruthy()
            expect(hpg.session.files_and_dirs['another_file']).toBeTruthy()
            expect(hpg.session.files_and_dirs['hygen-create.json']).toBeTruthy() // the session file is included by default
            expect(hpg.session.files_and_dirs['src']).toBeUndefined()
            expect(hpg.session.files_and_dirs['dist']).toBeUndefined()
            expect(hpg.fileCount).toEqual(3) 
        }
        
    })

    test('get info', () => {
        let hpg = new HygenCreate();
        hpg.setPathAndLoadSessionIfExists('/project2')
        
        expect(() => {hpg.add(['/project2'])}).not.toThrow()
        if ( hpg.session == null ) {
            expect(hpg.session).not.toBeNull()
        } else {
            let info = hpg.getFileInfo([],false)
            expect(info.length).toEqual(3)
            expect(info[0].path.toString()).toEqual("/project2/another_file")
            expect(info[1].path.toString()).toEqual("/project2/hygen-create.json") // this should have been created by the 'add' command
            expect(info[2].path.toString()).toEqual("/project2/package.json")
            expect(info[0].included).toBeTruthy()
            expect(info[1].included).toBeTruthy()
        }        
    })
})

describe('generating', () => {
    function add_and_generate() {
        let source_path = '/newproj'
        let hpg = new HygenCreate()
        expect(hpg.setPathAndLoadSessionIfExists(source_path.toString())).toBeFalsy()
        expect(() => {hpg.startSession('testgen')}).not.toThrow()
    
        expect(() => {hpg.add(['/newproj/just_a_file.txt'])}).not.toThrow()
        
        if ( hpg.session == null ) {
            expect(hpg.session).not.toBeNull()
            return
        }
        
        hpg.useName('name')
        hpg.generate(false)
    }
    test('using an absolute path', () => {
        expect(new AbsPath('/out').isDir).toBeTruthy()
        
        process.env['HYGEN_CREATE_TMPLS'] = '/out'
        expect(new AbsPath('/out/testgen/new/just_a_file.txt.ejs.t').isFile).toBeFalsy()
        add_and_generate()
        expect(new AbsPath('/out/testgen/new/just_a_file.txt.ejs.t').isFile).toBeTruthy()
    })

    test('using a relative path', () => {
        expect(new AbsPath('/out').isDir).toBeTruthy()
        
        process.chdir('/test')
        process.env['HYGEN_CREATE_TMPLS'] = '../out'
        expect(new AbsPath('/out/testgen/new/just_a_file.txt.ejs.t').isFile).toBeFalsy()
        add_and_generate()
        expect(new AbsPath('/out/testgen/new/just_a_file.txt.ejs.t').isFile).toBeTruthy()
    })

    test('path not set', () => {
        expect(new AbsPath('/out').isDir).toBeTruthy()
        
        delete(process.env['HYGEN_CREATE_TMPLS'])
        expect(() => { add_and_generate()}).toThrow(/HYGEN_CREATE_TMPLS/)
        expect(new AbsPath('/out/testgen/new/just_a_file.txt.ejs.t').isFile).toBeFalsy()
        
    })
})