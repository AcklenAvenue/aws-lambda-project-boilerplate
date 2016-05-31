"use strict";
var greeter_1 = require('./greeter');
function handle(data, context, callback) {
    var greeter = new greeter_1["default"]();
    var greeting = greeter.greet(data.name);
    callback(null, greeting);
}
exports.__esModule = true;
exports["default"] = handle;
