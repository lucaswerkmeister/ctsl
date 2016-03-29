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
class Person implements Named {
    firstName: string;
    lastName: string;
    name: string;
    constructor(firstName: string, lastName: string) {
        this.firstName = firstName;
        this.lastName = lastName;
        this.name = firstName + ' ' + lastName;
    }
}
function makePerson(firstName: string, lastName: string): Person {
    return new Person(firstName, lastName);
}
class NoblePerson extends Person {
    title: string;
    constructor(firstName: string, lastName: string, title: string) {
        super(firstName, lastName);
        this.title = title;
    }
}
function id<V>(v: V): V {
    return v;
}
