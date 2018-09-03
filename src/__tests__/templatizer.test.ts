///<reference types="jest"/>
import * as mockfs from 'mock-fs'
import * as fs from 'fs'
import * as path from 'path'
import * as inflection from 'inflection'
import { AbsPath } from "@ronp001/ts-utils"
import { Templatizer, TemplateInfo } from '../templatizer'

// Prepare path_helper.ts for inclusion in the mocked filesystem
// so that exceptions are displayed properly by jest
let path_to_ts = __dirname + "/../templatizer.ts"
let ts_contents = fs.readFileSync(path_to_ts)

beforeEach(async () => {
    // Creates an in-memory file system 
    let simfs: { [key: string]: any } = {
        '/file1.txt': `this is a text file
            the word "line" appears several times in this file
            there is even a line in which the word Line appears multiple times 
        `
    }
    // make sure exceptions are displayed properly by jest
    simfs[path_to_ts] = ts_contents
    mockfs(simfs)
})

afterEach(async () => {
    mockfs.restore()
})

describe('line processing', () => {
    test('single line', () => {
        let t = new TemplateInfo('', new AbsPath(null), 'line', false)

        let ri = t.processLine("this is a simple line", 1)
        if (ri == null) {
            expect(ri).not.toBeNull()
            return
        }
        expect(ri.linenum).toEqual(1)
        expect(ri.old_text).toEqual("this is a simple line")
        expect(ri.new_text).toEqual("this is a simple <%= name.toLowerCase() %>")

        ri = t.processLine("line line line spline", 1)
        if (ri == null) {
            expect(ri).not.toBeNull()
            return
        }
        expect(ri.linenum).toEqual(1)
        expect(ri.old_text).toEqual("line line line spline")
        expect(ri.new_text).toEqual("<%= name.toLowerCase() %> <%= name.toLowerCase() %> <%= name.toLowerCase() %> spline")
    })

    test('non-matching line', () => {
        let t = new TemplateInfo('', new AbsPath(null), 'no-such-word', false)

        let ri = t.processLine("this is a simple line", 1)
        expect(ri).toBeNull()
    })

    test('embedded ejs template', () => {
        let t = new TemplateInfo('', new AbsPath(null), 'word', false)

        let ri = t.processLine("<% an_ejs_template %> Word <% another %>", 1)
        if (ri == null) {
            expect(ri).not.toBeNull()
            return
        }
        expect(ri.linenum).toEqual(1)
        expect(ri.old_text).toEqual("<% an_ejs_template %> Word <% another %>")
        expect(ri.new_text).toEqual("<%% an_ejs_template %> <%= h.capitalize(name) %> <%% another %>")
    })

    test('capitlized', () => {
        let t = new TemplateInfo('', new AbsPath(null), 'word', false)

        let ri = t.processLine("Word", 1)
        if (ri == null) {
            expect(ri).not.toBeNull()
            return
        }
        expect(ri.new_text).toEqual("<%= h.capitalize(name) %>")

        ri = t.processLine("WORD Word words", 1)
        if (ri == null) {
            expect(ri).not.toBeNull()
            return
        }
        expect(ri.new_text).toEqual("<%= name.toUpperCase() %> <%= h.capitalize(name) %> <%= name.toLowerCase() %>s")
    })

})

test('template filename', () => {
    let t = Templatizer.process('file1.txt', new AbsPath('/file1.txt'), 'line', false)
    expect(t.template_filename).toEqual('file1.txt.ejs.t')

    t = Templatizer.process('file1.txt', new AbsPath('/some/dir/file1.txt'), 'line', false)
    expect(t.template_filename).toEqual('file1.txt.ejs.t')

    t = Templatizer.process('src/file1.txt', new AbsPath('/src/file1.txt'), 'line', false)
    expect(t.template_filename).toEqual('src_file1.txt.ejs.t')

    t = Templatizer.process('src/inner/file1.txt', new AbsPath('/src/inner/file1.txt'), 'line', false)
    expect(t.template_filename).toEqual('src_inner_file1.txt.ejs.t')

})

test('simple', () => {
    let t = Templatizer.process('file1.txt', new AbsPath('/file1.txt'), 'line', false)

    expect(t.replacements[0].old_text).toMatch(/the word "line" appears several times in this file/)
    expect(t.replacements[0].new_text).toMatch(/the word "<%= name.toLowerCase\(\) %>" appears several times in this file/)
    expect(t.replacements[1].old_text).toMatch(/there is even a line in which the word Line appears multiple times/)
    expect(t.replacements[1].new_text).toMatch(/there is even a <%= name.toLowerCase\(\) %> in which the word <%= h.capitalize\(name\) %> appears multiple times/)
})

test('inflections', () => {
    expect(inflection.camelize('word_word')).toEqual('WordWord')
    expect(inflection.transform('word-word', ['camelize'])).toEqual('Word-word')
    expect(inflection.transform('word-word'.replace('-', '_'), ['camelize'])).toEqual('WordWord')
    expect(inflection.transform('word'.replace('-', '_'), ['camelize'])).toEqual('Word')
    expect(inflection.transform('Word'.replace('-', '_'), ['camelize'])).toEqual('Word')
    expect(inflection.transform('Word-Word'.replace('-', '_'), ['classify'])).toEqual('WordWord')
})

test('with case changes', () => {
    let str = "DoubleWord doubleWord double-word double_word DOUBLE_WORD"
    let p = new AbsPath('/file2.txt')
    p.saveStrSync(str)

    let t = Templatizer.process('file2.txt', new AbsPath('/file2.txt'), 'DoubleWord', false)

    expect(t.replacements[0].old_text).toEqual("DoubleWord doubleWord double-word double_word DOUBLE_WORD")
    expect(t.replacements[0].new_text).toEqual("<%= h.inflection.camelize(name, false) %> <%= h.inflection.camelize(name, true) %> <%= h.inflection.transform(name, ['underscore','dasherize']) %> <%= h.inflection.underscore(name, false) %> <%= h.inflection.underscore(name, false).toUpperCase() %>")
})