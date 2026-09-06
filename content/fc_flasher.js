'use strict';

CONTENT.fc_flasher = {

};

var fcFirmwares2 = [];
var fcFirmwareMap2 = {};
var BLOCK_SIZE = 2048;

var fcFlasherReadHandler = function (info) {
    var self = CONTENT.fc_flasher;
    if (info.data.byteLength > 0) {
        var view = new Uint8Array(info.data);
        if (self.rxState == 0) {
			
			for (var i = 0; i < view.length; i++) self.receiveBuffer.push(view[i]);
			if (self.receiveBuffer.length >= 5) {
				if (self.receiveBuffer[0] == 81 && self.receiveBuffer[1] == 255 && self.receiveBuffer[2] == 255 && self.receiveBuffer[3] == 125) {
                    if (self.receiveBuffer[4] != 0) self.flasherAvailable = true;
                }
                
                if (!self.flasherAvailable) {
					self.receiveBuffer = [];
				}
			}
			
        } else if (self.rxState == 1) { // receive page back
            for (var i = 0; i < view.length; i++) self.receiveBuffer.push(view[i]);
            if (self.receiveBuffer.length >= (BLOCK_SIZE + 5)) {
                var matched = true;
                for (var i = 0; i < (self.pages[self.curPage].length - 1); i++) {
                    if (self.pages[self.curPage][i] != self.receiveBuffer[i]) {
                        matched = false;
                        break;
                    }
                }
                if (self.receiveBuffer[BLOCK_SIZE + 5 - 1] == 0) matched = false;
                if (matched) {
                    console.log("Packet accepted, lets flash it");
                    self.rxState = 2;
                    self.Write([81, 255, 255, 255, 0], 0);
                }
            }
        } else if (self.rxState == 2) {
        	
        	 for (var i = 0; i < view.length; i++) self.receiveBuffer.push(view[i]);
             if (self.receiveBuffer.length >= 5) {
            	 var l = self.receiveBuffer.length;
            	 if (self.receiveBuffer[l-5] == 81 && self.receiveBuffer[l-4] == 255 && self.receiveBuffer[l-3] == 255 && self.receiveBuffer[l-2] == 255 && self.receiveBuffer[l-1] != 0) {
                     if (self.retryTimeout != null) clearTimeout(self.retryTimeout);
                     self.curPage--;
                     self.retryCount = 0;
                     self.WritePage();
                 }
             }
        }
    }
}


var fcFlasherReadErrorHandler = function (info) {
	var self = CONTENT.fc_flasher;
	
	
	console.log("Error handler: " + JSON.stringify(info));
	
	if (info.error == "device_lost" || info.error.code == 19) {
		console.log("Serial port lost during flashing, Ultra went to bootloader mode. Reconnecting...");
		
		if (isNative()) {
			serialDevice.reconnect(2000, function(connectionInfo) {
				serialDevice.onReceive.addListener(fcFlasherReadHandler);
				console.log("Reconnected...");
				self.reconnected = true;
			});
		} else {
			// show reconnect button!
			$(".modal-body").html("<p class='header'>BOOTLOADER</p>Your KISS ULTRA is ready for flashing. Click <b>Reconnect</b> button to continue.<br><span id=bootloader_timer>&nbsp;<span>");
        	$(".modal-footer").html("<a class='u-button' id='flash_serial_reconnect'>Reconnect</a>");
        	
        	$(".modal-overlay").show();
        	$(".modal").show();
        	
        	$("#flash_serial_reconnect").removeClass('disabled').show();
        	
        	$(".modal-overlay").off('click'); 
        
        	var connectButton = document.getElementById('flash_serial_reconnect');

        	connectButton.addEventListener('click', async () => {

        

        		if (!$("#flash_serial_reconnect").hasClass('disabled')) {
        			
        			$("#flash_serial_reconnect").addClass('disabled');
        		

        			var selectedPort = String($('#port').val());
        			try {
        				let device = null;

        				if (isCapacitorNative()) {
        					// See js/connection_handler.js for why this needs no
        					// browser device-picker step at all.
        				} else {
        					// See js/connection_handler.js for why this falls back on any
        					// navigator.serial failure rather than trusting its existence.
        					try {
        						if (typeof navigator.serial === 'undefined') {
        							throw new Error('navigator.serial is not available');
        						}
        						device = await navigator.serial.requestPort({'filters': []});
        					} catch (serialError) {
        						if (typeof navigator.usb === 'undefined') {
        							throw serialError;
        						}
        						let usbDevice = await navigator.usb.requestDevice({'filters': []});
        						device = new WebSerialPolyfill.SerialPort(usbDevice);
        					}
        				}

        				serialDevice = getSerialDriverForPort(selectedPort);
        				serialDevice.connect(device, {
        					baudRate: 115200,
        					bufferSize: 16384
        				}, function() {
        					serialDevice.onReceive.addListener(fcFlasherReadHandler);
        					console.log("Reconnected...");
        					self.reconnected = true;
        					$(".modal-overlay").hide();
        					$(".modal").hide();
        				});
        			} catch (error) {
        				$("#flash_serial_reconnect").removeClass('disabled');
        				console.log('Connect error: ' + error.message);
        				alert('Connect error: ' + error.name + ': ' + error.message);
        			}
        		}
        	});
		}
	}
}

CONTENT.fc_flasher.initialize = function (callback) {
    var self = this;
    self.receiveBuffer = [];
    self.pages = [];
    self.curPage = 0;
    self.flasherAvailable = false;
    self.flashing = false;
    self.rxState = 0;
    self.timeout = null;
    self.retryCounter = 0;
    
    
    GUI.switchContent('fc_flasher', function () {
        GUI.load("./content/fc_flasher.html", htmlLoaded);
    });

    self.Write = function (data, offset) {
        var tmp = [];
        var i = offset;
        while (i < data.length && tmp.length < 256) tmp.push(data[i++]);
        if (tmp.length > 0) {
            var bufferOut = new ArrayBuffer(tmp.length);
            var bufferView = new Uint8Array(bufferOut);
            bufferView.set(tmp);
            tmp = [];
            serialDevice.send(bufferOut, function (a) {
                if (i < data.length) setTimeout(function () { self.Write(data, i) }, 50);
            });
        }
    }

    function alignHexBlocks(hex, blockSize) {
        var ret = [];
        if (hex.data.length > 0) {
            for (var block = 0; block < hex.data.length; block++) {
                var tailBytes = 0;
                if ((hex.data.length > 0) && ((block + 1) < hex.data.length)) tailBytes = hex.data[block + 1].address - hex.data[block].address - hex.data[block].data.length;
                ret.push.apply(ret, hex.data[block].data);
                for (var i = 0; i < tailBytes; i++) ret.push(0xff);
            }
        }
        var oldSize = ret.length;
        var s = oldSize % blockSize;
        if (s > 0 && s < blockSize) {
            while (s < blockSize) { ret.push(0xff); s++ };
        }
        return ret;
    }

    function parsePages(hex, blockSize) {
        self.pages = []
        var data = alignHexBlocks(self.parsed_hex, blockSize);
        for (var page = 0; page < (data.length / blockSize); page++) {
            var flashBlock = []
            flashBlock.push(80);
            flashBlock.push((page & 0xff));
            flashBlock.push((page >> 8) & 0xff);
            flashBlock.push((page == ((data.length / blockSize) - 1)) ? 0xff : 0);
            flashBlock = flashBlock.concat(data.slice(page * blockSize, (page + 1) * blockSize));
            flashBlock.push(0);
            self.pages.push(flashBlock);
        }
    }

    self.WritePage = function () {
        if (self.curPage < 0) {
            self.flashing = false;
            console.log('Done.');
            $("#status").html($.i18n("text.fc-flasher-success"));
 			//$("#progress").hide();
            setTimeout(function() {
            	$("#portArea").show();
            	GUI.switchToConnect();
            	CONTENT.welcome.initialize(function() {});
            }, 2000);
     
            return;
        } else {
            self.receiveBuffer = [];
            if (!self.flashing) {
            	serialDevice.onReceiveError.removeListener(fcFlasherReadErrorHandler);
            }
            self.flashing = true;
            var percentage = 100 - 100 * (self.curPage / self.pages.length);
            $("#status").html($.i18n("text.fc-flasher-progress", Math.floor(percentage + 0.5)));
            $("#progress").css("width","calc(5px + " + percentage + "%)").show();
            self.rxState = 1;
            self.retryCount++;
            console.log("Flashing page " + (self.curPage + 1) + " retry " + self.retryCount);
            self.Write(self.pages[self.curPage], 0);
            self.retryTimeout = setTimeout(function () {
                if (self.retryCount >= 3) {
                    console.log("Failed 3 times, aborting");
                    $("#status").html("FAILURE: No response from bootloader!");
                    $("#progress").css("width", 0);
                    resetUI();
                } else {
                    self.WritePage();
                }
            }, self.curPage == (self.pages.length - 1) ? 15000 : 5000);
        }
    }

    function resetUI() {
        $("#flash").removeClass('disabled');
        $("#select_file").removeClass('disabled');
        $("#download_file").removeClass('disabled');
        $("#download_url").removeClass('disabled');
    }

    
    function handleFileSelect(evt) {
    	var files = evt.target.files; 
    	for (var i = 0, f; f = files[i]; i++) {
    		var reader = new FileReader();

    		reader.onprogress = function (e) {
    			if (e.total > 1048576) {
    				console.log('File limit (1 MB) exceeded, aborting');
    				reader.abort();
    			}
    		};

    		reader.onload = (function(theFile) {
    			return function(e) {

    				if (e.total != 0 && e.total == e.loaded) {
    					console.log('File loaded');
    					var intel_hex = e.target.result;
    					self.parsed_hex = read_hex_file(intel_hex);

    					var max  = 262144;
    				
    					if (files[0].name.search("-BLU") > 1) {
							max = 10000;
						}
    					
    					
    					if (self.parsed_hex && (self.parsed_hex.bytes_total > max)) {
    						console.log("HEX OK " + self.parsed_hex.bytes_total + " bytes");
    						$("#file_info").html($.i18n("text.fc-flasher-loaded", self.parsed_hex.bytes_total, theFile.name));
    						$("#flashp").show();
    					} else {
    						console.log("Corrupted firmware file");
    						$("#file_info").html($.i18n("text.fc-flasher-invalid-firmware"));
    						$("#flashp").hide();
    					}
    				}
    			};
    		})(f);
    		reader.readAsText(f);

    	}
    }
    
    // reset wizard begin
    function openFactoryResetWizard() {
  	  
    	var steps = [{ 
			'template' : 'factory-wizard-welcome-template',
			'type': 'welcome',
			'dataProvider' : {
				
			},
			'preload': function(plugin, step) {

			},
			'postload' : function(plugin, step) {
				$(".wizard-button-save").hide();

			}
		},
		{ 
			'template' : 'factory-wizard-done-template',
			'type': 'done',
			'dataProvider' : {
				
			},
			'preload': function(plugin, step) {
				
			},
			'postload' : function(plugin, step) {
				$("#factory-wizard-reset-input").val("").on("keyup keydown change", function() {
					var conf = $(this).val().toUpperCase();
					if (conf == "ULTRA") {
						$(".wizard-button-save").show();
					} else {
						$(".wizard-button-save").hide();
					}
				});
				
				$(".wizard-button-save").off("click").click(function() {
				  	var tmp = {
				  			'buffer': new ArrayBuffer(10),
				  			'code': [65, 34, 122, 244, 62, 176,	137, 55, 67, 87]
				  	};
				  	kissProtocol.send(kissProtocol.FACTORY_RESET, kissProtocol.preparePacket(kissProtocol.FACTORY_RESET, tmp));
				  	
				  	setTimeout(function() {
				  		closeFactoryWizard();
				  		GUI.switchToConnect();
				  		GUI.timeoutKillAll();
				  		GUI.intervalKillAll();
				  		GUI.contentSwitchCleanup();
				  		GUI.contentSwitchInProgress = false;
				  		kissProtocol.removePendingRequests();
				  		kissProtocol.disconnectCleanup();
				  		GUI.connectedTo = false;
				  		$('#content').empty();
				  		// load welcome content
				  		CONTENT.welcome.initialize();
				  	}, 1000);
				  	
				});
			}
		}];

    	
    	$(".factory-wizard-inner").kissWizard({
    		'buttonsTemplate': 'factory-wizard-buttons-template',
    		'headerTemplate': 'factory-wizard-header-template',
    		steps: steps,
    		name: "Factory Reset Wizard",
    		currentStep: 0
    	});
    	
    	$(".modal-overlay").show();
    	$(".factory-wizard").show();
    	
    
    	$(".modal-overlay").click(function() {
    		closeFactoryWizard();
    	});
    }
        
    function closeFactoryWizard() {
    	$(".modal-overlay").off("click");
	  	$(".modal-overlay").hide();
    	$(".factory-wizard").hide();
    	$(".factory-wizard").kissWizard("destroy");
    }
    
    // reset wizard end
    
    function htmlLoaded() {

        serialDevice.onReceive.removeListener(fcFlasherReadHandler);
        serialDevice.onReceive.addListener(fcFlasherReadHandler);
        serialDevice.onReceiveError.removeListener(fcFlasherReadErrorHandler);
        serialDevice.onReceiveError.addListener(fcFlasherReadErrorHandler);
        
        $("#dont-tab").hide();

        $("#factory_reset").hide();
        
        if (!$(".portSelector").hasClass("flashing-in-progress")) {
        	kissProtocol.send(kissProtocol.GET_SETTINGS, [kissProtocol.GET_SETTINGS], function () {
        		var config = kissProtocol.data[kissProtocol.GET_SETTINGS];
        		if (config.ver >= 139) {
        			 kissProtocol.send(kissProtocol.GET_TELEMETRY, [kissProtocol.GET_TELEMETRY], function () {
        				var telemetry = kissProtocol.data[kissProtocol.GET_TELEMETRY];
        				 console.log("LIPO: " + telemetry.LiPoVolt);
        				 $("#factory_reset").show();
        				 if (telemetry.LiPoVolt >= 0.6) {
        					 $("#factory_reset").addClass('disabled');
        				 }
        			 });
        		} 
        	});
        }
        
        if (!isNative()) {
            document.getElementById('fcfiles').addEventListener('change', handleFileSelect, false);
        }
        
        var selectedPort = String($('#port').val());

        if ((selectedPort == KISSFC_WIFI) || (selectedPort == ANDROID_OTG_SERIAL)) {
            $("#select_file").hide();
        }

        $("#fw_version").on("change", function () {
            var asset = fcFirmwareMap2[$("#fc_type").val()][$(this).val()];
            $("#fw_notes").text(asset.info);
            $("#file_info").html("");
            $("#flashp").hide();
            $("#status").hide();
            $("#progress").hide();
        });

        $("#fc_type").on("change", function () {
            var value = fcFirmwareMap2[$(this).val()];
            $("#fw_version").empty();
            $.each(value, function (index, asset) {
                $("#fw_version").append("<option value='" + index + "'>" + asset.release + " (" + asset.size + " bytes)</option>");
            });
            $("#fcimage").attr("src", "images/"+$(this).val()+".png");
            $("#fw_version").trigger("change");
            $("#file_info").html("");
            $("#flashp").hide();
            $("#status").hide();
            $("#progress").hide();
        });
        
        $("#factory_reset").on("click", function () {
        	if (!$(this).hasClass('disabled')) {
        		openFactoryResetWizard();
        	}
        });
        		

        $("#download_url").on("click", function () {
        	if (!$(this).hasClass('disabled')) {
        		$("#loader2").show();
        		var asset = fcFirmwareMap2[$("#fc_type").val()][$("#fw_version").val()];
        		var url = asset.url;
        		console.log("Loading " + url);
        		$("#file_info").html("");
        		$("#flashp").hide();
        		$("#status").hide();
        		$("#progress").hide();

        		$.get(getProxyURL(url), function (intel_hex) {
        			console.log("Loaded ULTRA hex file");
        			self.parsed_hex = read_hex_file(intel_hex);

        			$("#loader2").hide();
        			if (self.parsed_hex && (self.parsed_hex.bytes_total > 262144)) {
        				console.log("HEX OK " + self.parsed_hex.bytes_total + " bytes");
        				$("#file_info").html($.i18n("text.fc-flasher-loaded", self.parsed_hex.bytes_total, url));
        				$("#flashp").show();
        			} else {
        				console.log("Corrupted firmware file");
        				$("#file_info").html($.i18n("text.fc-flasher-invalid-firmware"));
        				$("#flashp").hide();
        			}
        		});
        	}
        });

        $("#download_file").on("click", function () {
        	if (!$(this).hasClass('disabled')) {
        		$("#file_info").html("");
        		$("#flashp").hide();
        		fcFirmwares2 = [];
        		$("#remote_fw").hide();
        		$("#loader1").show();
        		loadGithubReleases("https://api.github.com/repos/KissUltra/firmware/releases").then(function (data) {
        			$("#loader1").hide();
        			console.log("DONE");
        			console.log(data);
        			$("#remote_fw").show();
        			fcFirmwareMap2 = {};
        			$.each(data, function (index, release) {
        				console.log("Processing firmware: " + release.name);
        				$.each(release.assets, function (index2, asset) {
        					if (asset.name.endsWith(".hex")) {
        						console.log("Processing asset: " + asset.name);
        						var p = asset.name.indexOf("-");
        						var board = asset.name.substr(0, p).toUpperCase().trim();
        						console.log("Board: " + board);

        						if (fcFirmwareMap2[board] == undefined) {
        							fcFirmwareMap2[board] = [];
        						}
        						var file = {
        								release: release.name,
        								date: release.created_at,
        								url: asset.browser_download_url,
        								size: asset.size,
        								info: release.body
        						}
        						fcFirmwareMap2[board].push(file);
        					}
        				});
        				$("#fc_type").empty();
        				$("#fw_version").empty();
        				var fc2BoardNames = {
        						'KISS_ULTRA': "FCFC_ULTRA"
        				};
        				$.each(fcFirmwareMap2, function (board, assets) {
        					var add = true;
        					if (add) $("#fc_type").append("<option value='" + board + "'>" + board + " - " + fc2BoardNames[board] + "</option>");
        				});
        				$("#fc_type").trigger("change");
        			});
        		})
        	}

        });
        
        $("#select_file").on("click", function () {
        	if (!$(this).hasClass("disabled")) {
        		$("#status").html("");
        		 $("#progress").hide();


        		if (isNative()) {


        			chrome.fileSystem.chooseEntry({ type: 'openFile', accepts: [{ extensions: ['hex'] }] }, function (fileEntry) {
        				if (chrome.runtime.lastError) {
        					console.error(chrome.runtime.lastError.message);
        					return;
        				}

        				chrome.fileSystem.getDisplayPath(fileEntry, function (path) {
        					console.log('Loading ultra firmware from: ' + path);
        					fileEntry.file(function (file) {
        						var reader = new FileReader();
        						reader.onprogress = function (e) {
        							if (e.total > 1048576) {
        								console.log('File limit (1 MB) exceeded, aborting');
        								reader.abort();
        							}
        						};
        						reader.onloadend = function (e) {
        							if (e.total != 0 && e.total == e.loaded) {
        								console.log('File loaded');
        								var intel_hex = e.target.result;
        								self.parsed_hex = read_hex_file(intel_hex);

        								if (self.parsed_hex) {
        									console.log("HEX OK " + self.parsed_hex.bytes_total + " bytes");
        									$("#file_info").html($.i18n("text.fc-flasher-loaded", self.parsed_hex.bytes_total, path));
        									$("#flashp").show();
        								} else {
        									console.log("Corrupted firmware file");
        									$("#file_info").html($.i18n("text.fc-flasher-invalid-firmware"));
        									$("#flashp").hide();
        								}
        							}
        						}
        						reader.readAsText(file);
        					});
        				});
        			});

        		} else {
        			$("#remote_fw").hide();
        		    $("#file_info").html("");
        	        $("#flashp").hide();
        	        $("#status").hide();
        	        $("#progress").hide();
        	        $("#fcfiles").val('');
        			$("#fcfiles").click();
        		}
        	}
        });
        
      

        $("#flash").on("click", function () {
            if (!$(this).hasClass('disabled')) {
				
				// prevent gui disconnect
				forceDisconnect = false;

                self.flashing = false;

                // prepare data to flash 
                parsePages(self.parsed_hex, BLOCK_SIZE);
                console.log(self.pages);

                $("#status").show().html("");
                 $("#progress").show().css("width", 0);
                $("#flash").addClass('disabled');
                $("#select_file").addClass('disabled');
                $("#download_file").addClass('disabled');
                $("#download_url").addClass('disabled');
                $("#factory_reset").addClass('disabled');
                
                if (!isNative()) {
                    $("#dont-tab").show();
                }

                self.flasherAvailable = false;
            	self.reconnected = false;
            	
                console.log('Resetting FC...');
                self.Write([79, 72, 82, 69, 83, 69, 84], 0); // reset fc
                
                self.rxState = 0;
                self.receiveBuffer = []; // clean up
                console.log('Checking bootloader...');
                
                self.intcnt = isNative() ? 20 : 60;
               
                self.Write([81, 255, 255, 125, 0], 0);       // check bootloader
                
                self.interval = setInterval(function() {
                	var self = CONTENT.fc_flasher;
                	console.log('Waiting for bootloader response ' + self.intcnt);
                	self.intcnt--;
                	if (self.intcnt < 0) {
                		clearInterval(self.interval);
                		console.log('got no answer. check your com port selection and see if you have the fc with bootloader.');
                        $("#status").html("FAILURE: No response from bootloader!");
                         $("#progress").hide();
                         
                        if (!isNative()) {
                        	$(".modal-overlay").hide();
    			        	$(".modal").hide();
    			        	
    			           	GUI.switchToConnect();
    						GUI.contentSwitchCleanup();
        					GUI.contentSwitchInProgress = false;
        					kissProtocol.removePendingRequests();
        		
        					GUI.timeoutKillAll();
        					GUI.intervalKillAll();
        						
        					kissProtocol.disconnectCleanup();
    					   	
    						$('#content').empty();
    						// load welcome content
    						CONTENT.welcome.initialize();
                        }
                        
                    
						
                	} else {
                		
                		$("#bootloader_timer").text("You have " + (self.intcnt >> 1) + " seconds left.");
                		
                		 if (self.flasherAvailable) {
                			 clearInterval(self.interval);
                             console.log("Bootloader available, lets flash");
                             $("#portArea").hide();
                             //$("#menu").hide();
                            // $(".navigation-menu-button").hide(); // hide menu during flashing
                             self.retryCount = 0;
                             self.curPage = self.pages.length - 1;
                             self.WritePage();
                         } else {
                        	 if (self.reconnected) {
                        		 console.log("Retry bootloader");
                        		 self.Write([81, 255, 255, 125, 0], 0);       // check bootloader
                        	 } else {
                        		 console.log("Not yet reconnected");
                        	 }
                		 }	
                	}
                }, 500);
            }
        });
        
        scrollTop();
        
        console.log("---");
        console.log(CONTENT.fc_flasher);
        if (CONTENT.fc_flasher.goRemote === true) {
			$("#download_file").click();
			CONTENT.fc_flasher.goRemote = false;
		}
		
		
		///// LOG
		
/*		var log = document.querySelector('#log');
['log','debug','info','warn','error'].forEach(function (verb) {
    console[verb] = (function (method, verb, log) {
        return function () {
            method.apply(console, arguments);
            var msg = document.createElement('div');
            msg.classList.add(verb);
            msg.textContent = verb + ': ' + Array.prototype.slice.call(arguments).join(' ');
            log.appendChild(msg);
        };
    })(console[verb], verb, log);
});*/
		
		
		//// LOG
		
		
		
    };
}

CONTENT.fc_flasher.cleanup = function (callback) {
    console.log("cleanup flasher");
    $("#portArea").children().removeClass('flashing-in-progress');
    serialDevice.onReceive.removeListener(fcFlasherReadHandler);
    serialDevice.onReceiveError.removeListener(fcFlasherReadErrorHandler);    
    if (callback) callback();
};