'use strict';

/*
    Serial driver backed by the native KissSerial Capacitor plugin
    (mobile/android/app/src/main/java/com/kissultra/gui/KissSerialPlugin.java),
    used only when running inside the Capacitor-wrapped Android app (see
    isCapacitorNative() in main.js). Same approach Betaflight Configurator
    uses: Android Chrome's WebUSB/Web Serial support isn't reliable enough
    for this device, so the native app talks to Android's UsbManager
    directly via usb-serial-for-android instead of the WebView's browser
    APIs. Mirrors the same driver shape as chromeSerial/webSerial
    (connect/disconnect/send/onReceive/onReceiveError) so it plugs into the
    existing getSerialDriverForPort() dispatch untouched.
*/

function base64ToUint8Array(base64) {
    var binary = atob(base64);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

function uint8ArrayToBase64(bytes) {
    var binary = '';
    for (var i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

// Resolved lazily (at connect-time) rather than once when this script
// parses, in case Capacitor's bridge hasn't finished initializing yet at
// script-load time -- by the time the user actually taps Connect, well
// after the page has fully loaded, it certainly has. Throws with a
// specific, alertable reason instead of silently returning something that
// fails later with a confusing "not a function" error.
function getKissSerialPlugin() {
    if (typeof Capacitor === 'undefined') {
        throw new Error('window.Capacitor is not defined -- not running inside the Capacitor WebView?');
    }
    var existing = Capacitor.Plugins && Capacitor.Plugins.KissSerial;
    if (existing && typeof existing.addListener === 'function') {
        return existing;
    }
    if (typeof Capacitor.registerPlugin !== 'function') {
        throw new Error('Capacitor.registerPlugin is not a function (typeof: ' + typeof Capacitor.registerPlugin + ')');
    }
    return Capacitor.registerPlugin('KissSerial');
}

var capacitorSerial = {
    connectionId: false,
    bitrate: 0,
    bytesReceived: 0,
    bytesSent: 0,
    transmitting: false,
    outputBuffer: [],
    dataListenerHandle: null,
    errorListenerHandle: null,

    connect: function (device, options, callback) {
        var self = this;
        var plugin;
        try {
            plugin = getKissSerialPlugin();
        } catch (error) {
            console.log('KissSerial plugin unavailable: ' + error.message);
            alert('KissSerial plugin unavailable: ' + error.message);
            if (callback) callback(false);
            return;
        }

        plugin.connect({ baudRate: options.baudRate || 115200 }).then(function () {
            self.connectionId = true;
            self.bitrate = options.baudRate;
            self.bytesReceived = 0;
            self.bytesSent = 0;

            plugin.addListener('dataReceived', function (event) {
                var bytes = base64ToUint8Array(event.data);
                self.bytesReceived += bytes.length;
                for (var i = (self.onReceive.listeners.length - 1); i >= 0; i--) {
                    self.onReceive.listeners[i]({ connectionId: 1, data: bytes.buffer });
                }
            }).then(function (handle) {
                self.dataListenerHandle = handle;
            });

            plugin.addListener('serialError', function (event) {
                console.log('KissSerial error: ' + event.message);
                for (var i = (self.onReceiveError.listeners.length - 1); i >= 0; i--) {
                    self.onReceiveError.listeners[i]({ connectionId: 1, error: event });
                }
            }).then(function (handle) {
                self.errorListenerHandle = handle;
            });

            if (callback) callback(true);
        }).catch(function (error) {
            console.log('KissSerial connect failed: ' + error.message);
            alert('Connect error: ' + error.message);
            if (callback) callback(false);
        });
    },

    disconnect: function (callback) {
        var self = this;
        var plugin;
        try {
            plugin = getKissSerialPlugin();
        } catch (error) {
            console.log('KissSerial plugin unavailable: ' + error.message);
            self.connectionId = false;
            self.bitrate = 0;
            if (callback) callback({});
            return;
        }

        if (self.dataListenerHandle) { self.dataListenerHandle.remove(); self.dataListenerHandle = null; }
        if (self.errorListenerHandle) { self.errorListenerHandle.remove(); self.errorListenerHandle = null; }

        self.emptyOutputBuffer();

        plugin.disconnect().then(function () {
            self.connectionId = false;
            self.bitrate = 0;
            if (callback) callback({});
        }).catch(function () {
            self.connectionId = false;
            self.bitrate = 0;
            if (callback) callback({});
        });
    },

    send: function (data, callback) {
        var self = this;
        self.outputBuffer.push({ data: data, callback: callback });

        function send() {
            var item = self.outputBuffer[0];
            var bytes = new Uint8Array(item.data);
            var base64Data = uint8ArrayToBase64(bytes);

            getKissSerialPlugin().write({ data: base64Data }).then(function () {
                self.bytesSent += bytes.length;

                if (item.callback) item.callback({});

                self.outputBuffer.shift();

                if (self.outputBuffer.length) {
                    if (self.outputBuffer.length > 100) {
                        var counter = 0;
                        while (self.outputBuffer.length > 100) {
                            self.outputBuffer.pop();
                            counter++;
                        }
                        console.log('SERIAL: Send buffer overflowing, dropped: ' + counter + ' entries');
                    }
                    send();
                } else {
                    self.transmitting = false;
                }
            }).catch(function (error) {
                console.log('KissSerial write failed: ' + error.message);
                self.transmitting = false;
            });
        }

        if (!self.transmitting) {
            self.transmitting = true;
            send();
        }
    },

    getDevices: function (callback) {
        callback([CAPACITOR_SERIAL]);
    },
    getInfo: function (callback) {
        if (callback) callback();
    },
    getControlSignals: function (callback) {
        if (callback) callback();
    },
    setControlSignals: function (signals, callback) {
        if (callback) callback();
    },
    onReceive: {
        listeners: [],
        addListener: function (functionReference) {
            this.listeners.push(functionReference);
        },
        removeListener: function (functionReference) {
            for (var i = (this.listeners.length - 1); i >= 0; i--) {
                if (this.listeners[i] == functionReference) {
                    this.listeners.splice(i, 1);
                }
            }
        }
    },
    onReceiveError: {
        listeners: [],
        addListener: function (functionReference) {
            this.listeners.push(functionReference);
        },
        removeListener: function (functionReference) {
            for (var i = (this.listeners.length - 1); i >= 0; i--) {
                if (this.listeners[i] == functionReference) {
                    this.listeners.splice(i, 1);
                    break;
                }
            }
        }
    },
    emptyOutputBuffer: function () {
        this.outputBuffer = [];
        this.transmitting = false;
    },
    reconnect: function (timeout, callback) {
        var self = this;
        var bitrate = self.bitrate;
        self.disconnect(function () {
            window.setTimeout(function () {
                self.connect(null, { baudRate: bitrate }, function (ok) {
                    callback(ok);
                });
            }, timeout);
        });
    }
};
