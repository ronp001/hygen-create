///<reference types="jest"/>
import {HygenCreate, HygenCreateError, HygenCreateSession} from "../hygen-create"
import * as mockfs from 'mock-fs'
import * as fs from 'fs'
import {MockFSHelper} from "./mock-fs-helper"
import {AbsPath} from "../path_helper"
// let runner = require('hygen')

let path_to_example = new AbsPath(__dirname).findUpwards('example', true)
let path_to_modules = new AbsPath(__dirname).findUpwards('node_modules', true)
let simfs = new MockFSHelper().addSourceDirContents().addDirs([path_to_example, path_to_modules])

beforeEach(async () => {   
    simfs.fs_structure['/output'] = {}
    mockfs(simfs.fs_structure)
    process.env['HYGEN_CREATE_TMPLS'] = '/_templates'
    process.env['HYGEN_TMPLS'] = '/_templates'
})
  
afterEach(async () => {
    mockfs.restore()
})

test('simple', () => {
    expect(path_to_modules).not.toBeNull()

    // create a generator using HygenCreate
    let hpg = new HygenCreate()
    expect(hpg.setPathAndLoadSessionIfExists(path_to_example.toString())).toBeFalsy()
    expect(() => {hpg.startSession('example')}).not.toThrow()
    expect(() => {hpg.add([path_to_example.add('package.json'), path_to_example.add('dist/hello.js')])}).not.toThrow()

    if ( hpg.session == null ) {
        expect(hpg.session).not.toBeNull()
    } else {
        hpg.useName('hello')
        hpg.generate(false)

        // console.log(MockFSHelper.ls('/_templates', 7, ['*']))
        expect(new AbsPath('/_templates/example/new/dist_hello.js.ejs.t').isFile).toBeTruthy()
        expect(new AbsPath('/_templates/example/new/package.json.ejs.t').isFile).toBeTruthy()
    }

    function log(...args:any[]) {
        args.unshift("***")
        console.log(args)
    }

    const { runner } = require('hygen')
    const { render } = require('../../node_modules/hygen/lib/render.js')
    const Logger = require('../test_support/hygen_logger')

    // log("%%%%%")
    // run the generator using Hygen
    const config = {
        templates: '/_templates',
        cwd: '/output',
        debug: true,
        exec: (action, body) => {
            console.log("***** exec")
          const opts = body && body.length > 0 ? { input: body } : {}
          return require('execa').shell(action, opts)
        },
        // logger: new Logger(console.log.bind(console)),
        logger: new Logger(log),
    }

    console.log(MockFSHelper.ls('/', 7, ['?*']))
    runner(['example', 'new'], config)
    console.log(MockFSHelper.ls('/', 7, ['*']))

    expect(new AbsPath('/output/generated').isDir).toBeTruthy()
      // see if the generator created the expected files
})