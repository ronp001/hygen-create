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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2xpLWFwcC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy9jbGktYXBwLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUEscUNBQW9DO0FBRXBDO0lBQUE7UUFHWSxrQkFBYSxHQUFHLEtBQUssQ0FBQTtJQTZDakMsQ0FBQztJQTNDRyw2Q0FBNkM7SUFDN0Msd0JBQXdCO0lBQ2QsTUFBTSxDQUFDLElBQTRCO1FBQ3pDLElBQUksT0FBTyxHQUFHLENBQUMsR0FBRyxJQUFVLEVBQUUsRUFBRTtZQUM1QixJQUFJLENBQUMsYUFBYSxHQUFHLElBQUksQ0FBQTtZQUN6QixJQUFJLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQTtZQUM5QixJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQTtZQUN0QixJQUFJLENBQUMsWUFBWSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQTtRQUNqQyxDQUFDLENBQUE7UUFDRCxNQUFNLENBQUMsT0FBTyxDQUFBO0lBQ2xCLENBQUM7SUFFRCx1RUFBdUU7SUFDN0QsR0FBRyxDQUFDLElBQXFCLEVBQUUsSUFBdUI7UUFDeEQsRUFBRSxDQUFDLENBQUMsT0FBTyxJQUFJLElBQUksV0FBVyxJQUFJLElBQUksSUFBSSxJQUFJLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDeEQsTUFBTSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFBO1FBQzlCLENBQUM7UUFBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7WUFDaEIsTUFBTSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUE7UUFDakIsQ0FBQztRQUNELE1BQU0sQ0FBQyxFQUFFLENBQUE7SUFDYixDQUFDO0lBRUQsb0VBQW9FO0lBQzFELGFBQWEsS0FBSSxDQUFDO0lBQ2xCLFlBQVksS0FBSSxDQUFDO0lBRXBCLElBQUk7UUFFUCxJQUFJLENBQUMsS0FBSyxFQUFFLENBQUM7UUFFYixJQUFJLENBQUM7WUFDRCxPQUFPLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQTtZQUMzQixFQUFFLENBQUMsQ0FBRSxDQUFDLElBQUksQ0FBQyxhQUFjLENBQUMsQ0FBQyxDQUFDO2dCQUN4QixPQUFPLENBQUMsSUFBSSxFQUFFLENBQUE7WUFDbEIsQ0FBQztRQUNMLENBQUM7UUFBQyxLQUFLLENBQUEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ1IsRUFBRSxDQUFDLENBQUUsT0FBTyxDQUFDLE9BQVEsQ0FBQyxDQUFDLENBQUM7Z0JBQ3BCLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUE7WUFDbEIsQ0FBQztZQUFDLElBQUksQ0FBQyxDQUFDO2dCQUNKLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFBO1lBQzFCLENBQUM7UUFDTCxDQUFDO0lBQ0wsQ0FBQztDQUNKO0FBaERELHdCQWdEQyJ9