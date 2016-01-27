import ceylon.regular {
    Regular,
    lit,
    not,
    where
}
import ceylon.unicode {
    ...
}

Regular anyUnicodeIdStart = where(compose({ letterUppercase, letterLowercase, letterTitlecase, letterModifier, letterOther, numberLetter }.contains, generalCategory));
Regular anyUnicodeIdContinue = anyUnicodeIdStart.or(where(compose({ markNonspacing, markCombiningSpacing, numberDecimalDigit, punctuationConnector }.contains, generalCategory)));
Regular anyUnicodeSpaceSeparator = where(compose(separatorSpace.equals, generalCategory));
Regular empty = lit("");
Regular noLineTerminatorHere = not(lineTerminator);
