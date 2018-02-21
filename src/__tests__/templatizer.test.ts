///<reference types="jest"/>
import * as mockfs from 'mock-fs'
import * as fs from 'fs'
import * as path from 'path'
import {AbsPath} from "../path_helper"
import { Templatizer, TemplateInfo } from '../templatizer';

// Prepare path_helper.ts for inclusion in the mocked filesystem
// so that exceptions are displayed properly by jest
let path_to_ts = __dirname + "/../templatizer.ts"
let ts_contents = fs.readFileSync(path_to_ts)

beforeEach(async () => {
    // Creates an in-memory file system 
    let simfs : {[key:string]: any} = {
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
        let t = new TemplateInfo('', new AbsPath(null), 'line')
        
        let ri = t.processLine("this is a simple line", 1)
        if ( ri == null ) {
            expect(ri).not.toBeNull()
            return
        }
        expect(ri.linenum).toEqual(1)
        expect(ri.old_text).toEqual("this is a simple line")
        expect(ri.new_text).toEqual("this is a simple <%= name %>")        

        ri = t.processLine("line line line spline", 1)
        if ( ri == null ) {
            expect(ri).not.toBeNull()
            return
        }
        expect(ri.linenum).toEqual(1)
        expect(ri.old_text).toEqual("line line line spline")
        expect(ri.new_text).toEqual("<%= name %> <%= name %> <%= name %> spline")
    })

    test('non-matching line', () => {
        let t = new TemplateInfo('', new AbsPath(null), 'no-such-word')
        
        let ri = t.processLine("this is a simple line", 1)
        expect(ri).toBeNull()
    })

    test('embedded ejs template', () => {
        let t = new TemplateInfo('', new AbsPath(null), 'word')
        
        let ri = t.processLine("<% an_ejs_template %> word <% another %>", 1)
        if ( ri == null ) {
            expect(ri).not.toBeNull()
            return
        }
        expect(ri.linenum).toEqual(1)
        expect(ri.old_text).toEqual("<% an_ejs_template %> word <% another %>")
        expect(ri.new_text).toEqual("<%% an_ejs_template %> <%= name %> <%% another %>")
    })

    test('capitlized', () => {
        let t = new TemplateInfo('', new AbsPath(null), 'word')
        
        let ri = t.processLine("Word", 1)
        if ( ri == null ) {
            expect(ri).not.toBeNull()
            return
        }
        expect(ri.new_text).toEqual("<%= h.capitalize(name) %>")        

        ri = t.processLine("word Word words", 1)
        if ( ri == null ) {
            expect(ri).not.toBeNull()
            return
        }
        expect(ri.new_text).toEqual("<%= name %> <%= h.capitalize(name) %> <%= name %>s")
    })
    
})

test('template filename', () => {
    let t = Templatizer.process('file1.txt', new AbsPath('/file1.txt'), 'line')
    expect(t.template_filename).toEqual('file1.txt.ejs.t')

    t = Templatizer.process('file1.txt', new AbsPath('/some/dir/file1.txt'), 'line')
    expect(t.template_filename).toEqual('file1.txt.ejs.t')

    t = Templatizer.process('src/file1.txt', new AbsPath('/src/file1.txt'), 'line')
    expect(t.template_filename).toEqual('src_file1.txt.ejs.t')

    t = Templatizer.process('src/inner/file1.txt', new AbsPath('/src/inner/file1.txt'), 'line')
    expect(t.template_filename).toEqual('src_inner_file1.txt.ejs.t')

})

test('simple', () => {
    let t = Templatizer.process('file1.txt', new AbsPath('/file1.txt'), 'line')

    expect(t.replacements[0].old_text).toMatch(/the word "line" appears several times in this file/)
    expect(t.replacements[0].new_text).toMatch(/the word "<%= name %>" appears several times in this file/)
    expect(t.replacements[1].old_text).toMatch(/there is even a line in which the word Line appears multiple times/)
    expect(t.replacements[1].new_text).toMatch(/there is even a <%= name %> in which the word <%= h.capitalize\(name\) %> appears multiple times/)
})