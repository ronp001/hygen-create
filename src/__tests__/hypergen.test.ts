///<reference types="jest"/>
import {Hypergen, HypergenError, HypergenSession} from "../hypergen"
import * as mockfs from 'mock-fs'
import * as fs from 'fs'

// Prepare hypergen.ts for inclusion in the mocked filesystem
// so that exceptions are displayed properly by jest
let path_to_hypergen = __dirname + "/../hypergen.ts"
let hypergen_contents = fs.readFileSync(path_to_hypergen)

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
        }
    }
    simfs[`/active_project/${Hypergen.default_session_file_name}`] = JSON.stringify({hypergen_version: "0.1.0", extra: 1, files_and_dirs: ['f1','f2','f3']})
    simfs[`/active_project/${Hypergen.default_session_file_name}.high_version`] = JSON.stringify({hypergen_version: "100.0.0", extra: 1})
    
    simfs[`/project2/${Hypergen.default_session_file_name}`] = JSON.stringify({hypergen_version: "0.1.0"})
    
    // make sure exceptions are displayed properly by jest
    simfs[path_to_hypergen] = hypergen_contents
    
    mockfs(simfs)
})
  
afterEach(async () => {
    mockfs.restore()
})

test('construction', () => {
    let hpg = new Hypergen();
    expect(hpg).toBeInstanceOf(Hypergen)
});

describe("loading sessions", () => {
    test('does not load session when loadOrCreateSession path is a directory hierarchy without a hypergen session file', () => {
    let hpg = new Hypergen()
        expect(hpg.setPathAndLoadSessionIfExists('/')).toBeFalsy()
        expect(hpg.isSessionActive).toBeFalsy()
    })
    
    test('loads session when loadOrCreateSession path is a directory with a hypergen.json file', () => {
        let hpg = new Hypergen()
        expect(hpg.setPathAndLoadSessionIfExists('/active_project')).toBeTruthy()
        expect(hpg.isSessionActive).toBeTruthy()
        expect((hpg.session as HypergenSession).extra).toEqual(1)
    })
    
    test('loads session when loadOrCreateSession path is a directory inside a session hierarchy', () => {
        let hpg = new Hypergen()
        expect(hpg.setPathAndLoadSessionIfExists('/active_project/subdir')).toBeTruthy()
        expect(hpg.isSessionActive).toBeTruthy()
        expect((hpg.session as HypergenSession).extra).toEqual(1)
    
        expect(hpg.doesSessionNeedSaving).toBeFalsy()
    })
    
    test('throws the correct exception when pointed to invalid session file', () => {
        let hpg = new Hypergen()
        expect(() => {hpg.setPathAndLoadSessionIfExists('/active_project/subdir/file1')}).toThrowError(HypergenError.CantParseSessionFile)
        expect(() => {hpg.setPathAndLoadSessionIfExists('/active_project/subdir/package.json')}).toThrowError(HypergenError.InvalidSessionFile)
        expect(() => {hpg.setPathAndLoadSessionIfExists('/active_project/subdir/nosuchfile')}).toThrowError(HypergenError.NoSuchPath)
        expect(() => {hpg.setPathAndLoadSessionIfExists(`/active_project/${Hypergen.default_session_file_name}.high_version`)}).toThrowError(HypergenError.InvalidSessionFileVersion)
    })    
})

describe('Creating sessions', () => {
    test('throws error if trying to create session without setting path first',() => {
        let hpg = new Hypergen()
        expect(() => {hpg.startSession('test')}).toThrowError(HypergenError.TryingToStartSessionWithoutPath)
    })

    test('starting a session twice', () => {
        let hpg = new Hypergen();
        hpg.setPathAndLoadSessionIfExists('/newproj')
        hpg.startSession('test')
        expect(() => {hpg.startSession('test')}).toThrowError(HypergenError.SessionInProgress)
        expect(hpg.isSessionActive).toBeTruthy()
    })
    

    test('creates saveable session',() => {
        let hpg = new Hypergen()
        expect(hpg.setPathAndLoadSessionIfExists('/newproj')).toBeFalsy()
        expect(hpg.saveSessionIfActiveAndChanged()).toBeFalsy()
        expect(hpg.isSessionActive).toBeFalsy()
        hpg.startSession('test')
        expect(hpg.isSessionActive).toBeTruthy()
        expect(hpg.doesSessionNeedSaving).toBeTruthy()
        expect(hpg.saveSessionIfActiveAndChanged()).toBeTruthy()
    
        let contents = fs.readFileSync(`/newproj/${Hypergen.default_session_file_name}`)
        let parsed = JSON.parse(contents.toString()) as HypergenSession
        expect(parsed.hypergen_version).toEqual("0.1.0")
    })
})

describe('loading and saving sessions', () => {

    test('loading previously saved version', () => {
        let hpg1 = new Hypergen()
        expect(hpg1.setPathAndLoadSessionIfExists('/newproj')).toBeFalsy()
        expect(() => {hpg1.startSession('test')}).not.toThrow()
        expect(hpg1.saveSessionIfActiveAndChanged()).toBeTruthy()
        
        let hpg2 = new Hypergen()
        expect(() => {hpg2.setPathAndLoadSessionIfExists('/newproj')}).not.toThrow()
    })

    test('loading a somewhat malformed session', () => {
        let hpg = new Hypergen()
        expect(hpg.setPathAndLoadSessionIfExists('/active_project')).toBeTruthy()
        if ( hpg.session == null ) {
            expect(hpg.session).not.toBeNull()
        } else {
            expect(hpg.session.files_and_dirs).toEqual({'f1':true, 'f2':true, 'f3':true})
            expect(hpg.session.templatize_using_name).toBeNull()
        }
    })

    test('does not overwite a non-session file', () => {
        let hpg = new Hypergen()
    
        let file1str = fs.readFileSync('/active_project/subdir/file1').toString()
        let pkgstr = fs.readFileSync('/active_project/subdir/package.json').toString()
    
        expect(() => {hpg.setPathAndLoadSessionIfExists('/active_project/subdir/file1')}).toThrowError(HypergenError.CantParseSessionFile)
        expect(() => {hpg.startSession('test')}).toThrowError(HypergenError.TryingToStartSessionWithoutPath)
        expect(() => {hpg.setPathAndLoadSessionIfExists('/active_project/subdir/package.json')}).toThrowError(HypergenError.InvalidSessionFile)
        expect(() => {hpg.startSession('test')}).toThrowError(HypergenError.TryingToStartSessionWithoutPath)
        expect(hpg.saveSessionIfActiveAndChanged()).toBeFalsy()
    
        expect(fs.readFileSync('/active_project/subdir/file1').toString()).toEqual(file1str)
        expect(fs.readFileSync('/active_project/subdir/package.json').toString()).toEqual(pkgstr)
    })
    
    
    test('starting a session after stopping a session', () => {
        let hpg = new Hypergen();
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
        let hpg = new Hypergen();
        hpg.setPathAndLoadSessionIfExists('/project2')
        
        expect(() => {hpg.add(['/project2/package.json'])}).not.toThrow()
        expect(() => {hpg.add(['/project2/src/main.ts'])}).not.toThrow()
        expect(() => {hpg.add(['/project2/src/nosuchfile'])}).toThrow(HypergenError.FileNotFound)
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
        
        // now load in a different Hypergen object
        let hpg2 = new Hypergen()
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
        let hpg1 = new Hypergen()
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

        // now load in a different Hypergen object
        let hpg2 = new Hypergen()
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
        let hpg = new Hypergen();
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
            expect(tpl[l++]).toEqual('{"name":"<%= name %>"}')
        }
    })
    test('template for multiline file', () => {
        let hpg = new Hypergen();
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
            expect(tpl[l++]).toEqual('to: <%= name %>/src/<%= name %>.ts')
            expect(tpl[l++]).toEqual('---')
            expect(tpl[l++]).toEqual('class <%= h.capitalize(name) %>')
            expect(tpl[l++]).toEqual('{constructor(){')
            expect(tpl[l++]).toEqual('console.log("This is <%= name %>")')
            expect(tpl[l++]).toEqual('}')
            expect(tpl[l++]).toEqual('}')
        }
    })
})

describe('additional tests', () => {
    test('adding entire directories', () => {
        let hpg = new Hypergen();
        hpg.setPathAndLoadSessionIfExists('/project2')
        
        expect(() => {hpg.add(['/project2'])}).not.toThrow()
        if ( hpg.session == null ) {
            expect(hpg.session).not.toBeNull()
        } else {
            expect(hpg.session.files_and_dirs['package.json']).toBeTruthy()
            expect(hpg.session.files_and_dirs['another_file']).toBeTruthy()
            expect(hpg.session.files_and_dirs['hypergen.json']).toBeTruthy() // the session file is included by default
            expect(hpg.session.files_and_dirs['src']).toBeUndefined()
            expect(hpg.session.files_and_dirs['dist']).toBeUndefined()
            expect(hpg.fileCount).toEqual(3) 
        }
        
    })

    test('get info', () => {
        let hpg = new Hypergen();
        hpg.setPathAndLoadSessionIfExists('/project2')
        
        expect(() => {hpg.add(['/project2'])}).not.toThrow()
        if ( hpg.session == null ) {
            expect(hpg.session).not.toBeNull()
        } else {
            let info = hpg.getFileInfo([],false)
            expect(info.length).toEqual(3)
            expect(info[0].path.toString()).toEqual("/project2/another_file")
            expect(info[1].path.toString()).toEqual("/project2/hypergen.json") // this should have been created by the 'add' command
            expect(info[2].path.toString()).toEqual("/project2/package.json")
            expect(info[0].included).toBeTruthy()
            expect(info[1].included).toBeTruthy()
        }        
    })
})

