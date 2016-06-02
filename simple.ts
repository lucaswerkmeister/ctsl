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
    respondsTo(name: string): boolean;
}
function makeNamed(name: string): Named {
    return { name: name, respondsTo: (n) => n == name };
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
    greet(other: Person): string {
        return `Hello, ${other.name}! I am ${this.name}. How nice to meet you!`;
    }
    respondsTo(name: string): boolean {
        return name == this.name || name == this.firstName;
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
    respondsTo(name: string): boolean {
        return super.respondsTo(name) || name == `${this.title} ${this.lastName}`;
    }
}
function id<V>(v: V): V {
    return v;
}
class NamedAttribute<A> implements Named {
    name: string;
    attribute: A;
    constructor(name: string, attribute: A) {
        this.name = name;
        this.attribute = attribute;
    }
    respondsTo(name: string): boolean {
        return name == this.name;
    }
}
const enum PeopleKind {
    kind = 1,
    rude = 2
}
function invert(b: boolean): boolean {
    return !b;
}
function numberOrString(): number|string {
    return "";
}
class DefaultConstructor {}
class ExplicitDefaultConstructor {
    constructor() {}
}
class HTMLMediaElement {
    canPlayType(mediaType: string): "probably" | "maybe" | "" {
        return "";
    }
}
function getFunctionFromNumberStringBooleanToNumber(): (a: number, b: string, c: boolean) => number {
    return function(a: number, b: string, c: boolean) { return a; };
}
function callWithOneFooTrue(f: (a: number, b: string, c: boolean) => number): number {
    return f(1, "foo", true);
}
function untypedIdentity(x: any): any {
    return x;
}
function make3StringArray(a: string, b: string, c: string): string[] {
    return [a, b, c];
}
function make3Array<T>(a: T, b: T, c: T): T[] {
    return [a, b, c];
}
function make1Array<T>(a: T): Array<T> {
    return [a];
}
type SomeAlias<A,B> = A | B[];
function makeSomeAlias<A,B>(a: A, b: B): SomeAlias<A,B> {
    return a;
}
function parId<V>(v: (V)): (V) {
    return v;
}
interface Killable {
    kill(): void;
}
function namedAndKillable(): Named & Killable {
    return { name: "Wowbagger the Infinitely Prolonged", kill: function() { throw "nuh uh"; } };
}
interface Map<T> {
    [index: string]: T;
}
function makeMap<T>(index: string, element: T): Map<T> {
    return { [index]: element };
}
interface A {
    a: string;
}
interface B {
    b: string;
}
interface AB extends A, B {}
const ab: AB = { a: "a", b: "b" };
interface StringTransformation extends A {
    (s: string): string;
}
function makeAIdentityFunction(): StringTransformation {
    let result = (s: string) => s;
    result.a = "a";
    return result;
}
const stringGetter: () => string = () => "";
