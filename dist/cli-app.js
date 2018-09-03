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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2xpLWFwcC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy9jbGktYXBwLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUEscUNBQW9DO0FBRXBDLE1BQXNCLE1BQU07SUFBNUI7UUFHWSxrQkFBYSxHQUFHLEtBQUssQ0FBQTtJQTZDakMsQ0FBQztJQTNDRyw2Q0FBNkM7SUFDN0Msd0JBQXdCO0lBQ2QsTUFBTSxDQUFDLElBQTRCO1FBQ3pDLElBQUksT0FBTyxHQUFHLENBQUMsR0FBRyxJQUFVLEVBQUUsRUFBRTtZQUM1QixJQUFJLENBQUMsYUFBYSxHQUFHLElBQUksQ0FBQTtZQUN6QixJQUFJLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQTtZQUM5QixJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQTtZQUN0QixJQUFJLENBQUMsWUFBWSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQTtRQUNqQyxDQUFDLENBQUE7UUFDRCxPQUFPLE9BQU8sQ0FBQTtJQUNsQixDQUFDO0lBRUQsdUVBQXVFO0lBQzdELEdBQUcsQ0FBQyxJQUFxQixFQUFFLElBQXVCO1FBQ3hELElBQUksT0FBTyxJQUFJLElBQUksV0FBVyxJQUFJLElBQUksSUFBSSxJQUFJLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRTtZQUN2RCxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFBO1NBQzdCO2FBQU0sSUFBSSxDQUFDLENBQUMsSUFBSSxFQUFFO1lBQ2YsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFBO1NBQ2hCO1FBQ0QsT0FBTyxFQUFFLENBQUE7SUFDYixDQUFDO0lBRUQsb0VBQW9FO0lBQzFELGFBQWEsS0FBSSxDQUFDO0lBQ2xCLFlBQVksS0FBSSxDQUFDO0lBRXBCLElBQUk7UUFFUCxJQUFJLENBQUMsS0FBSyxFQUFFLENBQUM7UUFFYixJQUFJO1lBQ0EsT0FBTyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUE7WUFDM0IsSUFBSyxDQUFDLElBQUksQ0FBQyxhQUFhLEVBQUc7Z0JBQ3ZCLE9BQU8sQ0FBQyxJQUFJLEVBQUUsQ0FBQTthQUNqQjtTQUNKO1FBQUMsT0FBTSxDQUFDLEVBQUU7WUFDUCxJQUFLLE9BQU8sQ0FBQyxPQUFPLEVBQUc7Z0JBQ25CLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUE7YUFDakI7aUJBQU07Z0JBQ0gsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUE7YUFDekI7U0FDSjtJQUNMLENBQUM7Q0FDSjtBQWhERCx3QkFnREMifQ==