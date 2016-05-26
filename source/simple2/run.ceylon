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
shared void boolean() {
    Boolean b1 = true;
    Boolean b2 = invert(b1);
    assertEquals {
        expected = false;
        actual = b2;
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

test
shared void classReference() {
    assertEquals {
        expected = "Lucas";
        actual = makePerson("Lucas", "Werkmeister").firstName;
    };
    assertEquals {
        expected = "Werkmeister";
        actual = makePerson { firstName = "Lucas"; lastName = "Werkmeister"; }.lastName;
    };
    Person p1 = makePerson("Lucas", "Werkmeister");
    assertEquals {
        expected = "Lucas";
        actual = p1.firstName;
    };
    Person p2 = makePerson { firstName = "Lucas"; lastName = "Werkmeister"; };
    assertEquals {
        expected = "Werkmeister";
        actual = p2.lastName;
    };
}

test
shared void intrface() {
    Named named = makeNamed("Lucas Werkmeister");
    assertEquals {
        expected = "Lucas Werkmeister";
        actual = named.name;
    };
}

test
shared void superclass() {
    Person person = NoblePerson { title = "Grand Moff"; "Wilhuff"; "Tarkin"; };
    assertEquals { expected = "Wilhuff"; actual = person.firstName; };
    assertEquals { expected = "Tarkin"; actual = person.lastName; };
}

test
shared void satisfiedInterface() {
    Named named = Person("Lucas", "Werkmeister");
    assertEquals { expected = "Lucas Werkmeister"; actual = named.name; };
    Person person = Person("Lucas", "Werkmeister");
    assertEquals { expected = "Lucas Werkmeister"; actual = person.name; };
}

test
shared void functionTypeParameters() {
    String string = id("Hello, World!");
    Integer integer = id(42);
    Person person = id(Person("Lucas", "Werkmeister"));
    Named named = id<Named>(person);
    assertEquals { expected = "Hello, World!"; actual = string; };
    assertEquals { expected = 42; actual = integer; };
    assertEquals { expected = "Lucas Werkmeister"; actual = person.name; };
    assertEquals { expected = "Lucas Werkmeister"; actual = named.name; };
}

test
shared void classTypeParameters() {
    NamedAttribute<String> stringAttribute = NamedAttribute("Lucas Werkmeister", "Hello, World!");
    NamedAttribute<Integer> integerAttribute = NamedAttribute("Lucas Werkmeister", 42);
    String string = stringAttribute.attribute;
    Integer integer = integerAttribute.attribute;
    assertEquals { expected = "Hello, World!"; actual = string; };
    assertEquals { expected = 42; actual = integer; };
    assertEquals { expected = "Lucas Werkmeister"; actual = stringAttribute.name; };
    assertEquals { expected = "Lucas Werkmeister"; actual = integerAttribute.name; };
}

test
shared void enum() {
    PeopleKind peopleKind = PeopleKind.kind;
    switch (peopleKind)
    case (PeopleKind.kind) {
        // ok
    }
    case (PeopleKind.rude) {
        fail("Why you gotta be so rude :-(");
    }
    assertEquals {
        expected = PeopleKind.kind;
        actual = peopleKind;
    };
}

test
shared void classMethod() {
    value me = Person("Lucas", "Werkmeister");
    value you = Person("Gavin", "King");
    assertEquals {
        expected = "Hello, Gavin King! I am Lucas Werkmeister. How nice to meet you!";
        actual = me.greet(you);
    };
}

test
shared void interfaceMethod() {
    assertTrue(Person("Lucas", "Werkmeister").respondsTo("Lucas"));
    assertTrue(makeNamed("dis mah name").respondsTo("dis mah name"));
    Named named = NoblePerson { title = "Grand Moff"; "Wilhuff"; "Tarkin"; };
    assertTrue(named.respondsTo("Grand Moff Tarkin"));
}

test
ignore ("compile-time only test")
suppressWarnings ("unusedDeclaration")
shared void unionType() {
    Integer|Float|String ifs = numberOrString();
    String|Float|Integer sfi = numberOrString();
}

test
shared void defaultConstructor() {
    assertEquals {
        expected = DefaultConstructor();
        actual = DefaultConstructor();
    };
}

test
shared void explicitDefaultConstructor() {
    assertEquals {
        expected = ExplicitDefaultConstructor();
        actual = ExplicitDefaultConstructor();
    };
}

test
ignore ("compile-time only test")
suppressWarnings ("unusedDeclaration")
shared void stringLiteralType() {
    String s = HTMLMediaElement().canPlayType("mp3");
}

test
shared void functionType() {
    <Integer|Float>(Integer|Float,String,Boolean) f = getFunctionFromNumberStringBooleanToNumber();
    Integer|Float n = callWithOneFooTrue(f);
    assertEquals {
        expected = 1;
        actual = n;
    };
}

test
ignore ("compile-time only test")
suppressWarnings ("unusedDeclaration")
shared void anyType() {
    Anything a = untypedIdentity(1);
    Anything b = untypedIdentity(a);
}

test
shared void arrayType() {
    Array<String> stringArray = make3StringArray("1", "2", "3");
    variable value n = 1;
    for (s in stringArray) {
        assertEquals {
            expected = (n++).string;
            actual = s;
        };
    }
    Array<Integer> intArray = make3Array(1, 2, 3);
    n = 1;
    for (i in intArray) {
        assertEquals {
            expected = n++;
            actual = i;
        };
    }
    Array<Integer> intArray2 = make1Array(1);
    n = 1;
    for (i in intArray2) {
        assertEquals {
            expected = n++;
            actual = i;
        };
    }
}

test
ignore ("compile-time only test")
suppressWarnings ("unusedDeclaration", "expressionTypeNothing")
shared void typeAlias() {
    Integer|Array<String> a = makeSomeAlias<Integer,String>(1, "");
    SomeAlias<Integer,String> b = a;
    Integer|Array<String> c = b;
    Array<String> d = makeSomeAlias<Nothing,String>(nothing, "");
}

test
shared void parenthesizedType() {
    String e = "x";
    String a = parId(e);
    assertEquals {
        expected = e;
        actual = a;
    };
}

test
ignore ("compile-time only test")
suppressWarnings ("unusedDeclaration")
shared void intersectionType() {
    Named&Killable nk = namedAndKillable();
    Named n = namedAndKillable();
    Killable k = namedAndKillable();
}

Value withDressedMap<Value>(Value fun()) {
    dynamic { eval("Object.prototype.$_get = function(k) { return this[k]; };"); }
    Value ret = fun();
    dynamic { eval("delete Object.prototype.$_get;"); }
    return ret;
}

test
shared void indexSignature() {
    assertEquals {
        expected = "bar";
        actual = withDressedMap(() => makeMap("foo", "bar")["foo"]);
    };
    assertEquals {
        expected = 1;
        actual = withDressedMap(() => makeMap("", 1)[""]);
    };
}

test
shared void interfaceInheritance() {
    AB ab = makeAB();
    A a = ab;
    B b = ab;
    assertEquals {
        expected = "a";
        actual = a.a;
    };
    assertEquals {
        expected = "a";
        actual = ab.a;
    };
    assertEquals {
        expected = "b";
        actual = b.b;
    };
    assertEquals {
        expected = "b";
        actual = ab.b;
    };
}
