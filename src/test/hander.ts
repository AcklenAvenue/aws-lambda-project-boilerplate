import Greeter from './test';

export function handler(data: { name: string }, context: any, callback: Function) {
    const greeter: Greeter = new Greeter();
    const greeting: string = greeter.greet(data.name);
    callback(null, greeting);
};
