import simple { ... }
import ceylon.test { ... }

test
shared void string() {
    assertEquals {
        expected = "Hello, Lucas, from TypeScript!";
        actual = greeting("Lucas");
    };
}

test
shared void parameters() {
    assertEquals {
        expected = "foobar";
        actual = concatenate("foo", "bar");
    };
}

test
shared void numbers() {
    assertEquals {
        expected = 2;
        actual = twice(1);
    };
    assertEquals {
        expected = 2.0;
        actual = twice(1.0);
    };
}

test
shared void klass() {
    assertEquals {
        expected = "Lucas";
        actual = Person("Lucas", "Werkmeister").firstName;
    };
    assertEquals {
        expected = "Werkmeister";
        actual = Person { firstName = "Lucas"; lastName = "Werkmeister"; }.lastName;
    };
}
