export default {
    apply(Class, thisArg, argumentList) {
        return new Class(...argumentList);
    }
};
