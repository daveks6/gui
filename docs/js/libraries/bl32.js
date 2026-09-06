 
     function crc16XmodemUpdate(crc, byte) {
        var poly = 0x1021;
        crc ^= byte << 8;
        for (var i = 0; i < 8; i++) {
            if (crc & 0x8000) {
                crc = (crc << 1) ^ poly;
            } else {
                crc <<= 1;
            }
        }
        return crc & 0xFFFF;
    }
	
	 function createBLPacket(command, data, address) {
        var bufferOut = new ArrayBuffer(7 + data.length);
        var bufferView = new Uint8Array(bufferOut);

        bufferView[0] = 0x2F;
        bufferView[1] = command;
        bufferView[2] = (address >> 8) & 0xFF;
        bufferView[3] = address & 0xFF;
        bufferView[4] = data.length === 256 ? 0 : data.length;

        var outParams = bufferView.subarray(5);
        for (var i = 0; i < data.length; i++) {
            outParams[i] = data[i];
        }

        // Calculate checksum
        var msgWithoutChecksum = bufferView.subarray(0, -2);
        var checksum = msgWithoutChecksum.reduce(crc16XmodemUpdate, 0);

        bufferView[5 + data.length] = (checksum >> 8) & 0xFF;
        bufferView[6 + data.length] = checksum & 0xFF;

        return bufferOut;
    }
	
    
    
function executeBLCommandWithPromise(serialDevice, command, data, address, retry, timeout) {
		var d = $.Deferred();
		var packet = null;
		var receiveBuffer = new ArrayBuffer(512);
		var receiveBufferPos = 0;
		var receiveTimeout = 0;
		var tries = 0;
		var packet = createBLPacket(command, data, address);
		
		var listener = function(info) {
			var view = new Uint8Array(receiveBuffer);
			var view2 = new Uint8Array(info.data);
			for (var i=0; i<info.data.byteLength; i++) {
				view[receiveBufferPos++] = view2[i];
			}
	 
	 		if ((receiveBufferPos > 0) && (view[0] != 0x2E)) {
				 receiveBufferPos = 0;
			}
	 
		 	console.log("Parsing bl response of size " + info.data.byteLength);
		 	if (receiveBufferPos > 7) {
				// 2E 37 00 00 04 06 1F 00 04 00 8D F9  // OK
				// 2E 37 00 00 04 00 00 00 00 0F B2 1E  // NOK
				var tmpLen = view[4];
				if (tmpLen == 0) tmpLen = 256;
				if (view[0] == 0x2E && (receiveBufferPos == (tmpLen + 8))) { // bl response
					console.log(view);
					var msgWithoutChecksum = view.subarray(0, receiveBufferPos - 2);
        			var cs1 = msgWithoutChecksum.reduce(crc16XmodemUpdate, 0);
					var cs2 = (view[receiveBufferPos-2] << 8) | view[receiveBufferPos-1];
     			
     				if (cs1 == cs2) {
						console.log("Checksum: OK");	 
						if (view[receiveBufferPos - 3] != 0) {
							console.log("Status: NOK");	
						} else {
							console.log("Status: OK");	
							clearInterval(receiveTimeout);
							serialDevice.onReceive.removeListener(listener);
							d.resolve(view.subarray(0, receiveBufferPos));
						}
					} else {
						console.log("Checksum: NOK");
					}
				}
		 	}
   	 	};
		
		serialDevice.onReceive.addListener(listener);

		console.log("BL32 Command Sent: " + command);
       	serialDevice.send(packet, function () {});
       	 			
			receiveTimeout = setInterval(function() {
				tries++;
				receiveBufferPos = 0;
				if (tries >= retry) {
					serialDevice.onReceive.removeListener(listener);
					d.reject();
				} else {
					console.log("BL32 Command Sent: " + command);
       	 			serialDevice.send(packet, function () {});
				}
			}, timeout);	   
	
            
    	return d.promise();
	};
