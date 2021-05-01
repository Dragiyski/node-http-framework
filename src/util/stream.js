import { Duplex } from 'node:stream';

export function createDelegatedDuplexStream(source) {
    const target = new Duplex({
        allowHalfOpen: true,
        decodeStrings: true,
        objectMode: false,
        readable: true,
        writable: true,
        read() {
            source.resume();
        },
        destroy(error, callback) {
            source.off('error', onError);
            callback(error);
        },
        write(chunk, encoding, callback) {
            target.emit('write', chunk, source);
            source.write(chunk, encoding, callback);
        },
        final(callback) {
            source.off('end', onEnd);
            source.end(callback);
        }
    });
    source
        .on('data', onData)
        .once('end', onEnd)
        .once('error', onError)
        .once('close', onClose)
        .pause();
    return target;

    function onData(data) {
        target.emit('read', data, source);
        if (!target.push(data)) {
            source.pause();
        }
    }

    function onEnd() {
        source.off('data', onData);
        target.push(null);
    }

    function onError(error) {
        if (!target.destroyed) {
            target.destroy(error);
        }
    }

    function onClose() {
        source
            .off('data', onData)
            .off('end', onEnd)
            .off('error', onError);
    }
}
