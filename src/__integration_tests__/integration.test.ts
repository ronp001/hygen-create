///<reference types="jest"/>
import { HygenCreate, HygenCreateError, HygenCreateSession } from "../hygen-create"
import * as mockfs from 'mock-fs'
import * as fs from 'fs'
import { AbsPath } from "@ronp001/ts-utils"
import { Templatizer } from "../templatizer"

// let runner = require('hygen')

let path_to_output = new AbsPath(__dirname).findUpwards('example_output', true)
let path_to_templates = path_to_output.add('_templates')
let path_to_generated = path_to_output.add('generated')
let examples_path = new AbsPath(__dirname).findUpwards('example', true)

beforeAll(async () => {
    process.env['HYGEN_CREATE_TMPLS'] = path_to_templates.toString()
    process.env['HYGEN_TMPLS'] = path_to_templates.toString()

    path_to_generated.rmrfdir(/\/example_output\/generated\//, false)
    path_to_templates.rmrfdir(/\/example_output\/_templates\//, false)
})

afterAll(async () => {
    mockfs.restore()
})

async function runHygen(hygen_args: string[], template_path: AbsPath, output_path: AbsPath) {
    function log(...args: any[]) {
        console.log(args)
    }

    const { runner } = require('hygen')
    const { render } = require('../../node_modules/hygen/lib/render.js')
    const execute = require('../../node_modules/hygen/lib/execute');
    const Logger = require('../test_support/hygen_logger')

    const config = {
        templates: template_path.toString(),
        cwd: output_path.toString(),
        debug: true,
        exec: (action: any, body: any) => {
            const opts = body && body.length > 0 ? { input: body } : {}
            return require('execa').shell(action, opts)
        },
        // logger: new Logger(console.log.bind(console)),
        logger: new Logger(log),
    }

    await runner(hygen_args, config)
}

function runHygenGenerate(source_path: AbsPath, file_repaths: Array<string>, generator_name: string, usename: string, gen_parent_dir: boolean) {
    let hpg = new HygenCreate()
    hpg.session_file_name = 'example_session.json'
    expect(hpg.setPathAndLoadSessionIfExists(source_path.toString())).toBeFalsy()
    expect(() => { hpg.startSession(generator_name) }).not.toThrow()

    let files_abspaths: Array<AbsPath> = []
    for (let file of file_repaths) {
        files_abspaths.push(source_path.add(file))
    }

    expect(() => { hpg.add(files_abspaths) }).not.toThrow()

    if (hpg.session == null) {
        expect(hpg.session).not.toBeNull()
        return
    }

    hpg.useName(usename)
    hpg.setGenParentDir(gen_parent_dir)
    hpg.generate(false)

    for (let relpath of file_repaths) {
        let generated = path_to_templates.add(generator_name).add('new').add(Templatizer.template_filename(relpath))
        console.log("checking if generated: ", generated.toString())
        expect(generated.isFile).toBeTruthy()
    }
}

test('simple', async () => {
    let source_path = new AbsPath(__dirname).findUpwards('example', true)

    // create a generator using HygenCreate
    runHygenGenerate(source_path, ['package.json', 'dist/hello.js'], 'greeter', 'hello', false)

    // run the generator
    let outdir = path_to_generated.add('hola-greeter')
    outdir.mkdirs()
    await runHygen(['greeter', 'new', '--name', 'hola'], path_to_templates, outdir)

    // see if the generator created the expected files
    expect(path_to_generated.add('hola-greeter/dist/hola.js').isFile).toBeTruthy()
})

test.skip('test strings - single word', async () => {
    let source_path = new AbsPath(__dirname).findUpwards('example', true)

    // create a generator using HygenCreate
    runHygenGenerate(source_path, ['test_strings.json'], 'test-generator-single', 'word', false)

    // run the generator
    await runHygen(['test-generator-single', 'new', '--name', 'result'], path_to_templates, path_to_generated)

    // see if the generator created the expected files
    expect(path_to_generated.add('result/test_strings.json').isFile).toBeTruthy()
})

test.skip('test strings - double word', async () => {

    // create a generator using HygenCreate
    runHygenGenerate(examples_path, ['test_strings.json'], 'test-generator-double', 'DoubleWord', false)

    // run the generator
    await runHygen(['test-generator-double', 'new', '--name', 'TheResult'], path_to_templates, path_to_generated)

    // see if the generator created the expected files
    expect(path_to_generated.add('TheResult/test_strings.json').isFile).toBeTruthy()
})

test('section: plain', async () => {
    await run_test_strings_file_comparison('plain')
})
test('section: plain (generating parent dir)', async () => {
    await run_test_strings_file_comparison('plain', true)
})
test('section: doubled-no-sfx', async () => {
    await run_test_strings_file_comparison('doubled-no-sfx')
})
test('section: doubled-with-sfx', async () => {
    await run_test_strings_file_comparison('doubled-with-sfx')
})

async function run_test_strings_file_comparison(section: string, gen_parent_dir: boolean = false) {
    let test_strings_path = new AbsPath(__dirname).findUpwards('example', true).add('test_strings.json')

    let parsed: any = test_strings_path.contentsFromJSON
    if (parsed == null) {
        console.log(`can't parse test_strings.json`)
        expect(parsed).not.toBeNull()
        return
    }

    if (parsed[section] == null) {
        console.log(`can't find section '${section}' in test_strings.json`)
        expect(parsed[section]).not.toBeNull()
        return
    }

    let comparisons: { [key: string]: Array<string> } = parsed[section]['comparisons']
    let defs: { [key: string]: string } = parsed[section]['defs']

    if (comparisons == null || defs == null) {
        expect(comparisons).not.toBeNull()
        expect(defs).not.toBeNull()
        return
    }

    // create a generator using HygenCreate
    let generator_name = `test-generator-${section}`
    if (gen_parent_dir) {
        generator_name += "-with-parentdir"
    }
    let usename = defs["hygen-create usename"]
    let hygen_name = defs["hygen --name"]
    runHygenGenerate(examples_path, ['test_strings.json'], generator_name, usename, gen_parent_dir)

    // run the generator
    let subdir = section
    if (!gen_parent_dir) {
        subdir += `-${hygen_name}`
    }
    await runHygen([generator_name, 'new', '--name', hygen_name], path_to_templates, path_to_generated.add(subdir))

    // load the resulting file
    let generated_file: AbsPath
    if (gen_parent_dir) {
        generated_file = path_to_generated.add(`${subdir}/${hygen_name}/test_strings.json`)
    } else {
        generated_file = path_to_generated.add(`${subdir}/test_strings.json`)
    }
    expect(generated_file.isFile).toBeTruthy()

    // compare the generated strings to the expected strings

    let generated_contents: any = generated_file.contentsFromJSON
    let generated_comparisons: { [key: string]: Array<string> } = generated_contents[section]['comparisons']

    if (generated_comparisons == null) {
        console.log(`could not find comparisons in section ${section} of the generated file ${generated_file.toString()}`)
        expect(generated_comparisons).not.toBeNull()
    }

    for (let desc in generated_comparisons) {
        expect(`${desc}: ` + generated_comparisons[desc][0]).toEqual(`${desc}: ` + generated_comparisons[desc][1])
    }

}