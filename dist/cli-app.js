"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const program = require("commander");
class CliApp {
    constructor() {
        this._did_exec_cmd = false;
    }
    // utility to generate action functions to be
    // called from commander
    action(func) {
        let newfunc = (...args) => {
            this._did_exec_cmd = true;
            this.beforeCommand.apply(this);
            func.apply(this, args);
            this.afterCommand.apply(this);
        };
        return newfunc;
    }
    // canonize the input received from commander's variadic args mechanism
    fix(arg1, arg2) {
        if (typeof arg1 != "undefined" && arg2 && arg2.length > 0) {
            return [arg1].concat(arg2);
        }
        else if (!!arg1) {
            return [arg1];
        }
        return [];
    }
    // override to get access to the args before any command is executed
    beforeCommand() { }
    afterCommand() { }
    main() {
        this._init();
        try {
            program.parse(process.argv);
            if (!this._did_exec_cmd) {
                program.help();
            }
        }
        catch (e) {
            if (program.verbose) {
                console.log(e);
            }
            else {
                console.log(e.message);
            }
        }
    }
}
exports.CliApp = CliApp;
