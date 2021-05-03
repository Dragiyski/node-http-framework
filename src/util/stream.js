import { Duplex } from 'node:stream';

/**
 * Creates a delegated duplex stream.
 *
 * The returned stream will have the same data as the source stream provided.
 * Additionally, there will be two new events: "read" and "write".
 * The "read" event will be emitted when new data arrives from the source stream.
 * The "write" event will be emitted when new data is written to the target stream.
 *
 * @param {Duplex} source The source stream from which data is read from or written to.
 * @returns {Duplex} A delegated stream which can be used as replacement of source stream.
 */
export function createDelegatedDuplexStream(source) {
    if (!(source instanceof Duplex)) {
        throw new TypeError('Invalid arguments[0]: expected a duplex stream');
    }
    if (!source.readable || !source.writable) {
        throw new TypeError('The duplex stream must be readable and writable. Ended/Destroyed streams cannot be delegated');
    }
    let sourceDestroyed = false;
    let targetDestroyed = false;
    const target = new Duplex({
        allowHalfOpen: true,
        readableObjectMode: source.readableObjectMode,
        readableHighWaterMark: source.readableHighWaterMark,
        writableObjectMode: source.writableObjectMode,
        writableHighWaterMark: source.writableHighWaterMark,
        defaultEncoding: source._writableState.defaultEncoding,
        emitClose: true,
        autoDestroy: true,
        decodeStrings: true,
        objectMode: false,
        readable: true,
        writable: true,
        read() {
            source.resume();
        },
        destroy(error, callback) {
            if (!sourceDestroyed && !source.destroyed) {
                sourceDestroyed = true;
                source.destroy(error);
            }
            callback(error);
        },
        write(chunk, encoding, callback) {
            target.emit('write', chunk, source);
            source.write(chunk, encoding, callback);
        },
        final(callback) {
            source.end(callback);
        }
    });
    source
        .on('data', onData)
        .once('end', onEnd)
        .once('error', onError)
        .once('close', onClose)
        .pause();
    source._readableState.emitClose = true;
    source._writableState.emitClose = true;
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
        if (!targetDestroyed && !target.destroyed) {
            targetDestroyed = true;
            target.destroy();
        }
    }
}
