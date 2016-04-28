import Greeter from './greeter';

export default function handle(data: { name: string }, context: any, callback: Function) {
    let greeter: Greeter = new Greeter();
    let greeting: string = greeter.greet(data.name);
    callback(null, greeting);
};