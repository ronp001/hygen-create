///<reference types="jest"/>
import {HygenCreate, HygenCreateError, HygenCreateSession} from "../hygen-create"
import * as mockfs from 'mock-fs'
import * as fs from 'fs'
import {AbsPath} from "../path_helper"
// let runner = require('hygen')

let path_to_example = new AbsPath(__dirname).findUpwards('example', true)
let path_to_output = new AbsPath(__dirname).findUpwards('example_output', true)
let path_to_templates = path_to_output.add('_templates')
let path_to_generated = path_to_output.add('generated')

beforeEach(async () => {   
    process.env['HYGEN_CREATE_TMPLS'] = path_to_templates.toString()
    process.env['HYGEN_TMPLS'] = path_to_templates.toString()

    path_to_generated.rmrfdir(/\/example_output\/generated\//, false)
    path_to_templates.rmrfdir(/\/example_output\/_templates\//, false)
})
  
afterEach(async () => {
    mockfs.restore()
})

test('simple', async () => {

    // create a generator using HygenCreate
    let hpg = new HygenCreate()
    hpg.session_file_name = 'example_session.json'
    expect(hpg.setPathAndLoadSessionIfExists(path_to_example.toString())).toBeFalsy()
    expect(() => {hpg.startSession('greeter')}).not.toThrow()
    expect(() => {hpg.add([path_to_example.add('package.json'), path_to_example.add('dist/hello.js')])}).not.toThrow()

    if ( hpg.session == null ) {
        expect(hpg.session).not.toBeNull()
    } else {
        hpg.useName('hello')
        hpg.generate(false)

        // console.log(MockFSHelper.ls('/_templates', 7, ['*']))
        expect(path_to_templates.add('greeter/new/dist_hello.js.ejs.t').isFile).toBeTruthy()
        expect(path_to_templates.add('greeter/new/package.json.ejs.t').isFile).toBeTruthy()
    }

    function log(...args:any[]) {
        console.log(args)
    }

    const { runner } = require('hygen')
    const { render } = require('../../node_modules/hygen/lib/render.js')
    const execute = require('../../node_modules/hygen/lib/execute');
    const Logger = require('../test_support/hygen_logger')

    const config = {
        templates: path_to_templates.toString(),
        cwd: path_to_generated.toString(),
        debug: true,
        exec: (action:any, body:any) => {
          const opts = body && body.length > 0 ? { input: body } : {}
          return require('execa').shell(action, opts)
        },
        // logger: new Logger(console.log.bind(console)),
        logger: new Logger(log),
    }

    await runner(['greeter', 'new', '--name', 'hola'], config)

    // see if the generator created the expected files
    expect(path_to_generated.add('hola/dist/hola.js').isFile).toBeTruthy()
})