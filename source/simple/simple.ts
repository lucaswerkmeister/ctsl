interface Named {
    name: string;
}
class Person implements Named {
    firstName: string;
    lastName: string;
    name: string;
    constructor(firstName: string, lastName: string) {
        this.firstName = firstName;
        this.lastName = lastName;
        this.name = firstName + " " + lastName;
    }
}
