function greeting(name: string): string {
    return `Hello, ${name}, from TypeScript!`;
}
function twice(num: number): number {
    return 2 * num;
}
function concatenate(s1: string, s2: string): string {
    return s1 + s2;
}
class Person {
    firstName: string;
    lastName: string;
    constructor(firstName: string, lastName: string) {
        this.firstName = firstName;
        this.lastName = lastName;
    }
}
