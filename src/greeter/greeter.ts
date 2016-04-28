export class Greeter {
    constructor() {
    };

    public greet(name: string): string {
        return `Hi, ${name}!`;
    };

    public sayGoodbye(name: string): string {
        return `See ya, ${name}!`;
    };
};

export default Greeter;