/// <reference path="../../typings/main.d.ts" />

import { expect } from 'chai';
import { Greeter } from '../../src/greeter/greeter';

describe('Greeter', () => {
    describe('when greeting', () => {
        let name = "Pedro";
        let expectedGreeting = "Hi, Pedro!";
        let greeter: Greeter = new Greeter();
        it('should greet the person whose name was given', () => {
            let greeting = greeter.greet(name);
            expect(greeting).to.equal(expectedGreeting);
        });
    });

    describe('when saying goodbye', () => {
        let name = "Pedro";
        let expectedGoodbye = "See ya, Pedro!";
        let greeter: Greeter = new Greeter();
        it('should say goodbye to the person whose name was given', () => {
            let goodbye = greeter.sayGoodbye(name);
            expect(goodbye).to.equal(expectedGoodbye);
        });
    });
});
