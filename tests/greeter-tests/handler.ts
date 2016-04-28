/// <reference path="../../typings/main.d.ts" />

import * as chai from 'chai';
import * as sinonChai from 'sinon-chai';
import * as sinon from 'sinon';
let expect = chai.expect;
chai.use(sinonChai);

import { Greeter } from '../../src/greeter/greeter';
import handler from '../../src/greeter/handler';

describe('handler', () => {
    describe('when handling a greet event', () => {
        let greeterMock: sinon.SinonMock;
        let name: string = "Mark";
        let greeting: string = `Well, hello there, ${name}`;
        before(() => {
            greeterMock = sinon.mock(Greeter.prototype);
            greeterMock.expects("greet").withExactArgs(name).returns(greeting);
        });

        it("should greet the person whose name is in the event", () => {
            let callback: sinon.SinonSpy = sinon.spy();
            handler({ name: name }, {}, callback);

            expect(callback).to.have.been.calledWith(null, greeting);
        });

        after(() => {
            greeterMock.restore();
        });
    })
});