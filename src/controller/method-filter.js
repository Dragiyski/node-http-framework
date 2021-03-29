export default function MethodFilter(...methods) {
    methods = methods.map(method => String(method).toUpperCase());
    return function (request) {
        return methods.includes(request.method);
    };
}
