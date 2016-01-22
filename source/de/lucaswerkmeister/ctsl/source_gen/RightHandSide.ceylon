import ceylon.collection {
    LinkedList
}

class RightHandSide(annotation = null) {
    shared String? annotation;
    LinkedList<RightHandSideElement> elementsList = LinkedList<RightHandSideElement>();
    shared {RightHandSideElement*} elements => elementsList;
    shared void addElement(RightHandSideElement element)
            => elementsList.add(element);
    string => " ".join(elements*.string);
}
