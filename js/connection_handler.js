'use strict';

var bootTimeout;

var kissProtocolHandler = function (info) {
    kissProtocol.read(info);
}

$(document).ready(function () {
	
	
	if (isNative()) {
		$('#portArea a.connect').click(function () {
			var selectedPort = String($('#port').val())

			if (selectedPort != '0') {

				if (GUI.state == "CONNECT") {
					GUI.switchToConnecting();
					console.log('Connecting to: ' + selectedPort);
					GUI.connectingTo = selectedPort;
					serialDevice = getSerialDriverForPort(selectedPort);
					serialDevice.connect(selectedPort, {
						bitrate: 115200
					}, connected);
				} else {
					GUI.switchToConnect();
					GUI.timeoutKillAll();
					GUI.intervalKillAll();
					GUI.contentSwitchCleanup();
					GUI.contentSwitchInProgress = false;
					kissProtocol.removePendingRequests();
					serialDevice.disconnect(function () {
						kissProtocol.disconnectCleanup();
						disconnected();
						GUI.connectedTo = false;
						if (GUI.activeContent != 'firmware') {
							$('#content').empty();
							// load welcome content
							CONTENT.welcome.initialize();
						}
					});
				}
			}
		});
	} else {
		// web

//		navigator.serial.addEventListener("connect", (event) => {
//			console.log("CONNECT!!!");
//		});
//
//		navigator.serial.addEventListener("disconnect", (event) => {
//			console.log("DISCONNECT!!!");
//		});

		var connectButton = document.getElementById('connect');

		connectButton.addEventListener('click', async () => {
			var selectedPort = String($('#port').val());
			try {
				if (GUI.state == "CONNECT") {
					GUI.switchToConnecting();
					console.log('Connecting to: ' + selectedPort);
					GUI.connectingTo = selectedPort;
					
					let device;
					let filters = [{ usbVendorId: 0x0483, usbProductId: 0x5740 }];

					if (typeof navigator.serial !== 'undefined') {
						// Desktop Chrome/Edge: native Web Serial API
						device = await navigator.serial.requestPort({'filters': filters});
					} else if (typeof navigator.usb !== 'undefined') {
						// Android Chrome does not implement navigator.serial, but does
						// support WebUSB. The FC shows up as a standard USB CDC-ACM
						// virtual COM port, so we can talk to it over WebUSB using
						// Google's web-serial-polyfill (js/libraries/web-serial-polyfill.js),
						// which exposes the same SerialPort-shaped object web_serial.js expects.
						//
						// Call navigator.usb.requestDevice() ourselves instead of going
						// through WebSerialPolyfill.serial.requestPort() (which always adds
						// a hard-coded USB interface classCode filter), and without any
						// vendor/product ID filter either -- on Android a vendor/product
						// filtered requestDevice() reliably shows an empty chooser for this
						// device even though the IDs match exactly (confirmed via the
						// unfiltered "Diagnose USB" button, which finds it every time).
						// SerialPort still validates the selected device has the expected
						// CDC-ACM interface structure afterwards and throws clearly if not,
						// so this is safe even without pre-filtering the chooser.
						let usbDevice = await navigator.usb.requestDevice({'filters': []});
						device = new WebSerialPolyfill.SerialPort(usbDevice);
					} else {
						throw new Error('Neither Web Serial nor WebUSB is available in this browser.');
					}

					serialDevice = getSerialDriverForPort(selectedPort);
					serialDevice.connect(device, {
						baudRate: 115200,
						bufferSize: 16384
					}, connected);
				} else {
					GUI.switchToConnect();
					GUI.timeoutKillAll();
					GUI.intervalKillAll();
					GUI.contentSwitchCleanup();
					GUI.contentSwitchInProgress = false;
					kissProtocol.removePendingRequests();
					serialDevice.disconnect(function () {
						kissProtocol.disconnectCleanup();
						disconnected();
						GUI.connectedTo = false;
						if (GUI.activeContent != 'firmware') {
							$('#content').empty();
							// load welcome content
							CONTENT.welcome.initialize();
						}
					});
				}
							
			} catch (error) {
				console.log('Connect error: ' + error.message);
				alert('Connect error: ' + error.name + ': ' + error.message);
				GUI.switchToConnect();
				GUI.connectingTo = false;
			}
		});
	}

    function connected(openInfo) {
    	console.log(openInfo);
        if (openInfo) {
            // update connectedTo
            GUI.connectedTo = GUI.connectingTo;

            // reset connectingTo
            GUI.connectingTo = false;

            // save selected port with chrome.storage if the port differs
            if (typeof chromeSerial !== 'undefined') {
                chrome.storage.local.get('lastUsedPort', function (result) {
                    if (result.lastUsedPort) {
                        if (result.lastUsedPort != GUI.connectedTo) {
                            // last used port doesn't match the one found in
                            // local db, we will store the new one
                            chrome.storage.local.set({
                                'lastUsedPort': GUI.connectedTo
                            });
                        }
                    } else {
                        // variable isn't stored yet, saving
                        chrome.storage.local.set({
                            'lastUsedPort': GUI.connectedTo
                        });
                    }
                });
            }

            GUI.switchToDisconnect();
            kissProtocol.data = [];
            
            var bootloaderListener = function (info) {
                serialDevice.onReceive.removeListener(bootloaderListener);
                if (info.data.byteLength > 0) {
                    var view = new Uint8Array(info.data);
                    if (view.length == 5) {
                        if (view[0] == 81 && view[1] == 255 && view[2] == 255 && view[3] == 125) {
                            // todo: Check for proper loader
                            if (view[4] != 0) {
                                clearTimeout(bootTimeout);
                                $("#portArea").children().addClass('flashing-in-progress');
                                $("#menu").hide();
                                $(".navigation-menu-button").hide(); // hide menu during flashing
                                CONTENT.fc_flasher.initialize();
                            }
                        }
                    }
                }
            }

            serialDevice.onReceive.addListener(bootloaderListener);
            serialDevice.onReceive.addListener(kissProtocolHandler);
            kissProtocol.init();

            var bootloaderCheck = [81, 255, 255, 125, 0];
            var bufferOut = new ArrayBuffer(bootloaderCheck.length);
            var bufferView = new Uint8Array(bufferOut);
            bufferView.set(bootloaderCheck, 0);
            serialDevice.send(bufferOut, function (a) {
                console.log("Bootloader check has been sent");
            });

            var bootTimeout = function () {
                serialDevice.onReceive.removeListener(bootloaderListener);
                CONTENT.configuration.initialize();
            }

            bootTimeout = setTimeout(bootTimeout, 250); // bootloader response in 250ms
        } else {
            console.log('Failed to open serial port');
            GUI.switchToConnect();
        }
    }

    function disconnected(result) {
        if (result) { // All went as expected
        } else { // Something went wrong
        }
    }
    
    
});
