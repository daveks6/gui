'use strict';

CONTENT.uesc_config = {
	
};

CONTENT.uesc_config.initialize = function (callback) {
    var self = this;
	
	self.dialogState = 0;
	self.currentMotor = 0;
	self.totalMotors = 0;
	self.motorData = new ArrayBuffer(512);
	self.commandInterval = 0;
	self.reloadAllMotors = true;  
	self.blDelay = 500;
	self.blRetry = 3;
	self.saveAll = false;
	

    GUI.switchContent('uesc_config', function () {
        GUI.load("./content/uesc_config.html", htmlLoaded);
    });
 	
	function addMotor(motor, data) {
		$("#esc"+motor).ultraESC("update", data);
		
		if (!self.reloadAllMotors) {
			$(".ultraesc").ultraESC("enableSave");
		}
	}
	
	function removeMotor(motor) {
		$("#esc"+motor).ultraESC("reload");
	}
	
	function nextMotor() {
		self.currentMotor ++;
		if (self.currentMotor >= self.totalMotors) {
			$("#saveAll,#reloadAll").removeClass("disabled");
		}
		self.changeState(self.currentMotor >= self.totalMotors ? -1 : 3);
	}
	
	function writeDone(success) {
		console.log("Writing done. success=" + success);
	}
	

	
	function commandHandler() {
		kissProtocol.removePendingRequests();
		var state = self.dialogState;
		self.changeState(0);
		switch (state) {
			case 1:
				    self.currentMotor = 0;
				    
				         kissProtocol.send(kissProtocol.GET_INFO, [kissProtocol.GET_INFO], function () {
                			var info = kissProtocol.data[kissProtocol.GET_INFO];
                			self.totalMotors = info.escInfoCount;
                			console.log("FC has " + self.totalMotors + " motors");
				    
				    		for (var motor = 0; motor < self.totalMotors; motor++) {
								$("#esc"+motor).ultraESC({  motor: motor, title: 'ESC ' + (motor + 1) }); // loading
							}
				    		// switch to config mode
				    		kissProtocol.send(kissProtocol.ESC_CONFIG_MODE, kissProtocol.preparePacket(kissProtocol.ESC_CONFIG_MODE, {}), function (data) {
								serialDevice.onReceive.removeListener(kissProtocolHandler);
                				setTimeout(function() {self.changeState(8);}, 500);
           	 				});
           	 			});
				    
				  
				break;
				
				case 8:
					executeMSPCommandWithPromise(serialDevice, 0x01, [], 1, 3, 1000).then(function(response) {
            			console.log("Got " +  response);
						setTimeout(function() {self.changeState(2);}, 100);
					}, function(e) {
						
						setTimeout(function() {self.changeState(2);}, 100);
					});
				break;	
				
			case 2:
					executeMSPCommandWithPromise(serialDevice, 0xF5, [], 1, 3, 1000).then(function(response) {
			 			self.totalMotors = response[5];
            			console.log("Got " + self.totalMotors + " motors on this quad");
           			 	
						setTimeout(function() {self.changeState(3);}, 200);
					}, function(e) {
						console.log("Unable to set esc passthrough, already in?");
						for (var motor = 0; motor < self.totalMotors; motor++) {
							$("#esc"+motor).ultraESC({  motor: motor, title: 'ESC ' + (motor + 1) }); // loading
						}
						setTimeout(function() {self.changeState(3);}, 200);
					});
				break;	
				
			// reading	
			case 3:
				  console.log("==== Connecting to motor " + self.currentMotor +" ===="); // currentMotor
				  executeBLCommandWithPromise(serialDevice, 0x37, [self.currentMotor], 0, 2 * self.blRetry, 3 * self.blDelay).then(function(response) {
					  	console.log(response);
					  	//46, 55, 0, 0, 4, 0, 0, 0, 4, 15, 126, 218 when error
					  	if ((response[1] == 0x37) && (response[5] == 0x06) && (response[6] == 0x1f) && 
            			    (response[7] == 0x0) && (response[8] == 0x04) && (response[9] == 0x0)) {
							 self.changeState(4);
						} else {
							$("#esc"+self.currentMotor).ultraESC("error", "Unable to connect...");
					  		nextMotor();
						}
				  }, function (e) {
					  $("#esc"+self.currentMotor).ultraESC("error", "Unable to connect...");
					  nextMotor();
				  });
				break;
				
			case 4:
				    executeBLCommandWithPromise(serialDevice, 0x3A, [0], 0x0000, self.blRetry, self.blDelay).then(function(response) { // deviceRead
            			if ((response.byteLength != 9) && (response[1] == 0x3A)) {
							console.log("Got config for motor " + self.currentMotor);
						
							for (var i=0; i<256; i++) {
								self.motorData[i] = response[5 + i];
							}
							self.changeState(5);
						}
					}, function(e) {
						$("#esc"+self.currentMotor).ultraESC("error", "Unable to connect...");
						if (self.reloadAllMotors) nextMotor();
					});
				break;
				
			case 5:
				   executeBLCommandWithPromise(serialDevice, 0x3A, [0], 0x1000, self.blRetry, self.blDelay).then(function(response) { // deviceRead
            			//2E 3A 00 00 01 00 0F 33 2F 
            			if ((response.byteLength != 9) && (response[1] == 0x3A)) {
							console.log("Got info for motor " + self.currentMotor);
							
							for (var i=0; i<256; i++) {
								self.motorData[i + 256] = response[5 + i];
							}
							addMotor(self.currentMotor, self.motorData);
							
							if (self.saveAll) {
								self.changeState(6);
							} else {
								if (self.reloadAllMotors) nextMotor(); else self.changeState(20);
							}
						}
					}, function (e) {
							console.log("Unable to send DeviceInitFlash, error " + e);
							$("#esc"+self.currentMotor).ultraESC("error", "Unable to connect...");
							if (self.reloadAllMotors) nextMotor(); else  self.changeState(20);
					});
				break;
				
			// writing
			case 6:
				   console.log("Save all is " + self.saveAll + " on request 6");
				  // if we have save all request, find all esc that needs saving
				  if (self.saveAll) {
					 
					  var save = false;
					  // checking motor if needs saving
					  for (var motor=0; motor<self.totalMotors; motor++) {
					  	var m = $("#esc" + motor);
					  	var sb = $("[name='save']", m);
					  	if (sb !== undefined) {
					  		if ($(sb).hasClass('saveAct')) {
							  console.log("Motor " + motor + " needs saving");
						  	  $(sb).removeClass('saveAct');
						      save = true;
						      self.currentMotor = motor;
						      break; // for loop
					  	  	} else {
								$("#esc" + motor).removeClass("blur");	
						    }
					  	}
					  }
					  
					  if (!save) {
						  	$("#saveAll").removeClass("saveAct");
						  	$("#saveAll,#reloadAll").removeClass("disabled");
						  	self.changeState(20);
						  	break;
					  }
				  }	
				
				
				  console.log("==== Connecting to motor " + self.currentMotor +" ===="); // currentMotor
				  executeBLCommandWithPromise(serialDevice, 0x37, [self.currentMotor], 0, self.blRetry, 3 * self.blDelay).then( function(response) { // deviceInitFlash (motor as param!)
            			if ((response[1] == 0x37) && (response[5] == 0x06) && (response[6] == 0x1f) && 
            			    (response[7] == 0x0) && (response[8] == 0x04) && (response[9] == 0x0)) {
							  self.changeState(7);
						} else {
							writeDone(false);
						}
 					}, function (e) { 
 							console.log("Unable to send DeviceInitFlash, error 1");
							$("#esc"+self.currentMotor).ultraESC("error", "Unable to connect...");
							writeDone(false);
					});
 				break;
				
			case 7:
				     executeBLCommandWithPromise(serialDevice, 0x3B, new Uint8Array($("#esc" + self.currentMotor).ultraESC("getData")), 0x0000, self.blRetry, self.blDelay).then(function(response) { // writeFlash
            			//2E 3B 00 00 01 00 00 87 60 
            			if ((response.byteLength == 9) && (response[1] == 0x3B) && (response[6] == 0)) {
							console.log("Saved config " + self.currentMotor);
							self.reloadAllMotors = false;
							removeMotor(self.currentMotor);
							self.changeState(3);
						}
					}, function (e) {
							console.log("Unable to send DeviceInitFlash, error 1");
							$("#esc"+self.currentMotor).ultraESC("error", "Unable to connect...");
							self.changeState(-1);
					});
				break;
			default: 
			break;
		}
	}
	
	self.changeState = function(newState) {
		self.dialogState = newState;
		if (newState == 20) {
			$("#saveAll,#reloadAll").removeClass("disabled");
			  GUI.rebuildHints();
		}
		
		if (newState > 0) {
			console.log("Changing state to " + newState);
		} else if (newState == -1) {
			  GUI.rebuildHints();
			console.log("Dialog failed");			
		} 
	}
	
	function log(message) {
		$("#log").append(message + "<br/>");
	} 


    function htmlLoaded() {
		
		//$("#pt_exit").on("click", function() {
		//	exitPassthrough();
		//});
		
		$('[data-name="esc_flasher"]').addClass('active-menu');
		
		$("#reload").show().on("click", function() {
			self.currentMotor = 0;
			self.reloadAllMotors = true;
			for (var i=0; i<self.totalMotors; i++) {
			  	$("#esc"+i).ultraESC({ motor: i,  title: 'ESC ' + (i + 1) }); // loading
			}
      		self.changeState(3);
  		});
  		
  		$("#configMode").on('change', function() {
			if (+$(this).val()==0) {
				// multiple
				$("[name='save']").hide();
				//$("#saveAll").show();
			} else {
				//$("#saveAll").hide();
				$("[name='save']").show();
			}	  
		});
		
		$("#saveAll").on('click', function() {
			if (!$(this).hasClass("disabled") && $(this).hasClass("saveAct")) {
				console.log('Saving all escs that were changed');
				self.saveAll = true;
				$(".ultraesc").ultraESC("disableSave");
				$(".ultraesc").ultraESC("reload");
				// disable save all
				//self.currentMotor = 0;
				$("#saveAll,#reloadAll").addClass("disabled");
				self.changeState(6);
			}
		});
		
		$("#reloadAll").on('click', function() {
			if (!$(this).hasClass("disabled")) {
				console.log('Reloading esc configuration');
				self.saveAll = false;
				self.currentMotor = 0;
				for (var motor = 0; motor < self.totalMotors; motor++) {
					$("#esc"+motor).ultraESC({  motor: motor, title: 'ESC ' + (motor + 1) }); // loading
				}
				self.reloadAllMotors = true;
				$("#saveAll,#reloadAll").addClass("disabled");
				$("#saveAll").removeClass("saveAct");
				self.changeState(3);
			}
		});
		
		$(window).on("save", function(event, motor) {
			console.log("Saving single esc " + motor);
			self.saveAll = false;
			$(".ultraesc").ultraESC("disableSave");
			self.currentMotor = motor;
			self.changeState(6);
		});
		
		$(window).on("valueChanged", function(event, motor, name, value) {
			console.log("Value " + name + " changed on motor " + motor + " to " + value);
			$("#saveAll").addClass("saveAct");
			
				
			if ($("#configMode").val() == 0) {
				if (name !== "direction") {
					$(".ultraesc").find("[name='"+name+"']").val(value);
					$(".ultraesc").find("[name='save']").addClass('saveAct');
					$(".ultraesc").find("[name='"+name+"']").addClass('changed');
				} else {
					$("#esc" + motor).find("[name='"+name+"']").addClass('changed');
				}
			} else {
				$("#esc" + motor).find("[name='"+name+"']").addClass('changed');
			}
		});

        scrollTop();
    
		self.reloadAllMotors = true;
      	self.changeState(1);
      	$("#saveAll,#reloadAll").addClass("disabled");
      	self.commandInterval = window.setInterval(function() {
			commandHandler();
			if (self.dialogState == -1) {
				window.clearInterval(self.commandInterval);
			}  
		}, 100);

    };
}

CONTENT.uesc_config.cleanup = function (callback) {
	var self = this;
	if (self.commandInterval != 0) {
		window.clearInterval(self.commandInterval);
	}
	 var bufferOut = new ArrayBuffer(10);
       	var bufView = new Uint8Array(bufferOut);
        bufView[0] = 0x2b; 
        bufView[1] = 0x2b 
        bufView[2] = 0x2b; 
        bufView[3] = 0x45; 
        bufView[4] = 0x58;
        bufView[5] = 0x49;
        bufView[6] = 0x54;
        bufView[7] = 0x2b;
        bufView[8] = 0x2b;
        bufView[9] = 0x2b;
	  	serialDevice.send(bufferOut, function () {
			console.log("PT Exit Sent");
			//serialDevice.onReceive.addListener(kissProtocolHandler);
            //kissProtocol.init();	
			if (callback) {
				setTimeout(function() {
					kissProtocol.init();
					serialDevice.onReceive.addListener(kissProtocolHandler);
					callback();
				}, 1000);  
			};
		});
};