function msp2_crc(data, start, end) {
        var crc = 0;
        for (var i = start; i < end; i++) {
            var ch = data[i];
            crc ^= ch;
            for (var j = 0; j < 8; j++) {
                if (crc & 0x80) {
                    crc = ((crc << 1) & 0xFF) ^ 0xD5;
                } else {
                    crc = (crc << 1) & 0xFF;
                }
            }
        }
        return crc;
        
    }

function createMSPPacketV1(command, data) {

        var size = 6 + data.length;
        var bufferOut = new ArrayBuffer(size);
        var bufView = new Uint8Array(bufferOut);

        bufView[0] = 36; // $
        bufView[1] = 77; // M
        bufView[2] = 60; // <
        bufView[3] = data.length;
        bufView[4] = command;

        if (data.length > 0) {
            var checksum = bufView[3] ^ bufView[4];

            for (var i = 0; i < data.length; i += 1) {
                bufView[i + 5] = data[i];
                checksum ^= bufView[i + 5];
            }

            bufView[5 + data.length] = checksum;
        } else {
            bufView[5] = bufView[3] ^ bufView[4]; // Checksum
        }

        return bufferOut;
    }
    
    function createMSPPacketV2(command, data) {
        var dataLength = data.length;
        var size = 9 + dataLength;
        var bufferOut = new ArrayBuffer(size);
        var bufView = new Uint8Array(bufferOut);

        bufView[0] = 36; // $
        bufView[1] = 88; // X
        bufView[2] = 60; // <
        bufView[3] = 0; // flag
        bufView[4] = command & 0xFF;
        bufView[5] = (command >> 8) & 0xFF;
        bufView[6] = dataLength & 0xFF;
        bufView[7] = (dataLength >> 8) & 0xFF;

        for (var i = 0; i < dataLength; i++) {
            bufView[8 + i] = data[i];
        }

        bufView[size - 1] = msp2_crc(bufView, 3, size - 1);

        return bufferOut;
    }
    
    
function executeMSPCommandWithPromise(serialDevice, command, data, version, retry, timeout) {
		var d = $.Deferred();
		var packet = null;
		var receiveBuffer = new ArrayBuffer(512);
		var receiveBufferPos = 0;
		var receiveTimeout = 0;
		var tries = 0;
		
		if (version == 1) {
			packet = createMSPPacketV1(command, data);
		} else {
			packet = createMSPPacketV2(command, data);
		} 
		
		// Listener
		var listener = function(info) {

			console.log("Listener called");
			console.log(info.data);
			var view = new Uint8Array(receiveBuffer);
			var view2 = new Uint8Array(info.data);
		
			for (var i=0; i<info.data.byteLength; i++) {
				view[receiveBufferPos++] = view2[i];
			}
			
			if ((receiveBufferPos > 0) && (view[0] != 36)) {
				 receiveBufferPos = 0;
			}
			
			if ((receiveBufferPos > 1) && ((view[1] != 77) && (view[1] != 88))) {
				 receiveBufferPos = 0;
			}
			
			if ((receiveBufferPos > 2) && (view[2] != 62)) {
				 receiveBufferPos = 0;
			}

		 	if (receiveBufferPos > 4) {
				if (view[1] == 77) { // v1
					if ((receiveBufferPos == (view[3] + 6)) && (view[0] == 36) && (view[1] == 77) && (view[2] == 62))  {
						var checksum = view[3] ^ view[4]; // data len and command
            			for (var i = 0; i < view[3]; i++) {
                			checksum ^= view[i + 5];
            			}
            			if (checksum == view[view[3] + 5]) {
							console.log("Checksum OK");
							clearInterval(receiveTimeout);
							serialDevice.onReceive.removeListener(listener);
							d.resolve(view.subarray(0, receiveBufferPos));
						} else {
							console.log("Checksum NOK");
						}
					}
				} else { // v2
			    	// 24 58 3E 00 03 30 00 00 E4 
					if ((receiveBufferPos == (view[6] + (view[7] << 8) + 9)) && (view[0] == 36) && (view[1] == 88) && (view[2] == 62))  {
						var dataLen = view[6] | (view[7] << 8);
						var checksum = msp2_crc(view, 3, dataLen + 8);
						if (checksum == view[dataLen + 8]) {
							console.log("Checksum OK");
							clearInterval(receiveTimeout);
							serialDevice.onReceive.removeListener(listener);
							d.resolve(view.subarray(0, receiveBufferPos));
						} else {
							console.log("Checksum NOK");
						}
					} 
				}
		 	}
		}; // end of listener
		
		
		serialDevice.onReceive.addListener(listener);

		console.log("MSP" + version + " Command Sent: " + command);
       	serialDevice.send(packet, function () {});
       	 			
			receiveTimeout = setInterval(function() {
				tries++;
				receiveBufferPos = 0;
				if (tries >= retry) {
					serialDevice.onReceive.removeListener(listener);
					d.reject();
				} else {
					console.log("MSP" + version + " Command Sent: " + command);
       	 			serialDevice.send(packet, function () {});
				}
			}, timeout);	   
            
    	return d.promise();
	};