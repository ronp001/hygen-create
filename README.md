# hypergen
Simplifies creation of [hygen](http://www.hygen.io) templates from existing projects

## Why

Because creating templates from existing projects is annoying

## In a nutshell

`hypergen` takes a set of existing project files and uses them to create
`hygen` template files, replacing a selected word with appropriate <%= name %> (or <%= h.capitalize(name) %>) entries.

The resulting template files can be used as is (using the `hygen <generator> new` command - assuming [hygen](http://www.hygen.io) is installed).  They can also be manually edited and changed as desired.


## Installation

Install globally using yarn or npm:

```
$ npm -g hypergen
```
or
```
$ yarn global add hypergen
```

## Generating a generator

There are several steps to generating a generator:

1. Start a hypergen session: `hypergen start <generator-name>`
1. Choose files to templatize:  `hypergen add <file>...`
1. Indicate which word to replace with <%= name %> placeholders: `hypergen usename <name>`
1. (Optionally) view information about replacements to be made: `hypergen status`
1. Specify target _templates folder: `export HYPERGEN_TMPLS=<path>`
1. Initiate generation: `hypergen generate`

## Example session

Just to give a sense of how `hypergen` works, let's suppose we have a small project that we'd like to reuse as a starting point for other projects.

Our directory hierarchy is:

```
/projects/hello
 |-package.json
 |-dist
    |-hello.js
```

The contents of `package.json`:

```json
{
  "name": "hello",
  "version": "1.0.0",
  "description": "an application that prints hello",
  "scripts" : {
    "hello": "node dist/hello.js"
  }
}
```

The contents of `dist/hello.js`:

```js
// This is hello.js
console.log("Hello!")
```

Although quite simple (and frankly, useless), this is a fully-functioning package 
and we can run the `hello` script by typing `npm run hello`:

```bash
$ npm run hello

> hello@1.0.0 hello /example
> node dist/hello.js

Hello!
```

Let's now use `hypergen` to generate a `greeter generator` from this project.

We'll first start a `hypergen` session:
```
$ hypergen start greeter
created hypergen.json
```

Now let's add our files:

```
$ hypergen add package.json dist/hello.js 
adding:  package.json
adding:  dist/hello.js
```

If we take a look at `hypergen.json`, we'll see the added files are listed there:

```
$ cat hypergen.json 
{
  "about": "This is a hypergen definitions file. The hypergen utility creates generators that can be executed using hygen.",
  "hypergen_version": "0.1.0",
  "name": "greeter",
  "files_and_dirs": {
    "hypergen.json": true,
    "package.json": true,
    "dist/hello.js": true
  },
  "templatize_using_name": null
}
```

You might notice that `hypergen` automatically added `hypergen.json` even though
we did not add it explicitly.  The addition of `hypergen.json` to the generator
makes it easy to iteratively improve the generator we're creating, as we'll see later on.

Now let's tell `hypergen` that it should turn the word `hello` into the `name` parameter
of the generator:

```
$ hypergen usename hello
using 'hello' as templatization word
6 matching lines found in 3 included files
```

We can check the status of the session by typing `hypergen status`:
```
$ hypergen status 

Using the string "hello" to templatize files (Change using 'hypergen usename <name>')

The following files are included in the generator:
[included] - hypergen.json [2 lines parameterized]
[included] - package.json [3 lines parameterized]
[included] - dist/hello.js [2 lines parameterized]

Target template dir not set (export HYPERGEN_TMPLS= to set it)
```

If we'd like to see how each file will be templatized, we can use `hypergen status -v <file>` to check that out.

So typing ```$ hypergen status -v package.json``` will output:
![Alt example](example/example_status.png)

This shows us what the resulting template file will look like (in [hygen template format](http://www.hygen.io/templates)), including a diff of the lines that undergo parameterization. 

### [TODO:  finish the example session]
---

## List of availble commands:
```
$ hypergen --help

  Usage: hypergen [options] [command]

  hypergen - create hygen templates from an existing project


  Options:

    -V, --version  output the version number
    -v, --verbose  provide more info
    -h, --help     output usage information


  Commands:

    start [options] <generator-name>      initiate a definition session for the generator <generator-name>
    rename <generator-name>               change the name of the target generator to <generator-name>
    add <file|dir> [file|dir...]          add files or directories to be templatized
    remove|rm <file|dir> [file|dir...]    do not templatize specified files/directories
    usename <name>                        set <name> as the templatization param
    status|s [options] [file] [files...]  show replacements to be made in (all|specified) files
    generate|g [options]                  generate a generator from the added files
```

---


<style>
H,HIGH,M,MED { 
    background-color: #eee; 
    padding: 2px; margin-right: 2px;
} 
H::before,HIGH::before,M::before,MED:before {
    font-weight: bold; 
    margin-right: 5px; 
    padding: 2px;
    color: white
}
H::before,HIGH::before {
    content: "HIGH PRIORITY"; 
    background-color: red; 
} 
M::before,MED::before {
    content: "MEDIUM PRIORITY"; 
    background-color: green; 
    font-weight: normal;
    font-size: .85em
}

R {
    border-radius: 4px;
    background-color: #eee;
    padding: 5px;
    font-size: 1.2em;
    color: red;
    font-style: italic;
}
R.important::before {
    content: "!";
    color: white;
    background-color: red;
    border-radius: 25px;
    padding-right: 7px;
    padding-left: 5px;
}
</style>

## Copyright
(C) 2018 Ron Perry. [MIT License](LICENSE.txt).