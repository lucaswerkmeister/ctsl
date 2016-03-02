function greeting(name: string): string {
    return `Hello, ${name}, from TypeScript!`;
}
function twice(num: number): number {
    return 2 * num;
}
function concatenate(s1: string, s2: string): string {
    return s1 + s2;
}
interface Named {
    name: string;
}
function makeNamed(name: string): Named {
    return { name: name };
}
class Person {
    firstName: string;
    lastName: string;
    constructor(firstName: string, lastName: string) {
        this.firstName = firstName;
        this.lastName = lastName;
    }
}
function makePerson(firstName: string, lastName: string): Person {
    return new Person(firstName, lastName);
}
