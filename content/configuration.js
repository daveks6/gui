'use strict';

CONTENT.configuration = {
    USER_PIDs: [],
    PRESETS: {},
    legacyChecked: false
};


CONTENT.configuration.initialize = function (callback) {
    var self = this;
    
    self.hwTimeout = 0;
    self.requestTelemetry = false;
    self.telemetry = {};
    self.telemetryTimeout = 0;;
    self.motorWizardEnabled = false;
    self.boardId = 0;
    self.auxes = [0, 0, 0, 0, 0, 0 , 0]; // 7 auxes
    CONTENT.configuration.fcType = "u1";
	self.needsMigration = false;
	self.auxChannel = -1;
	self.auxValue = -1;
	self.mcuid = '';
	
	self.UpdateMixerImage = function(Type, ESCOrientation, Reverse) {
        if (typeof ESCOrientation == 'undefined') ESCOrientation = 0;
        console.log("Updating mixer image: Type=" + Type + " ESCOrientation=" + ESCOrientation + " Reverse=" + Reverse);

        $('.mixerPreview img.main-mixer').attr('src', './images/mixer/' + Type + (ESCOrientation > 0 && (Type == 1 || Type == 2) ? '_' + ESCOrientation : '') + (Reverse == 0 ? '' : '_inv') + ".png");
    };

    self.fcTypePrefix = function() {
    	if (kissProtocol.data[kissProtocol.GET_HARDWARE_INFO] != undefined) {
    		var info = kissProtocol.data[kissProtocol.GET_HARDWARE_INFO];
    		var brd = (info.hardwareVersion & 0xFF00) >> 8;
    		if (brd == 1) {
    			return "u1";
    		} else if (brd == 2) {
    			return "mu1";
    		} else if (brd == 3) {
    			return "u2";
    		} else if (brd == 4) {
    			return "mu2";
    		} else if (brd == 5) {
    			return "u3";
    		} 
    	} 
    	return "u1";
    } 
    
    self.checkMotorWizard = function() {
    	var show = true;
    	if ($('#save').hasClass("saveAct")) show = false;
    	if ((+$("#ESCOutputLayout").val()) != 0) show = false;
    	if ((+$("select[name='mixer']").val()) != 2) show = false; 
    	if ((+$("#outputMode").val()) == 8) show = false;
    	    	
    	if (show) {
    		$("#motor-wizard-button").removeClass("motor-wizard-button-disabled");
    	} else {
    		$("#motor-wizard-button").addClass("motor-wizard-button-disabled");
    	}
    };
    
    function updateMixers() {
    	console.log("Update mixers");
    	var is4Motors = false;
    	if (kissProtocol.data[kissProtocol.GET_HARDWARE_INFO] != undefined) {
      	  var info = kissProtocol.data[kissProtocol.GET_HARDWARE_INFO];
      	  
      	  CONTENT.configuration.fcType = self.fcTypePrefix();
          $("select[name='mixer']").data("help", "mixer-" +   CONTENT.configuration.fcType);
          
      	  var tmp = info.hardwareVersion;
            var rev = tmp & 255;
            var brd = tmp >> 8;
            if (brd == 2 || brd == 4) {
            	is4Motors = true;
            }
    	}
    	
    	if (is4Motors) {
    		console.log("ITS MINI!");
    		var mixerList = [ 4, 5, 6, 9, 10 ];
    		
    		var v = +$("select[name='mixer']").val(); // old value
    		
    		if ($("#outputMode").val() == "8") {
    			 for (var i=0; i<mixerList.length; i++) {
    				 $("option[value='"+mixerList[i]+"']", "select[name='mixer']").show();
    			 }
    		} else {
    			 for (var i=0; i<mixerList.length; i++) {
    				 $("option[value='"+mixerList[i]+"']", "select[name='mixer']").hide();
    				 if (v == mixerList[i]) {
    					 $("select[name='mixer']").val(2);
    				 }
    			 }
    		}
    	}
    }
    
    
    function showNewVersion(version) {
		$("#newVersion").text("⚡ " + version).show().click(function() {
			CONTENT.fc_flasher.goRemote = true;
			CONTENT.fc_flasher.initialize(true);
		});
	}
    
    
    function checkNewFirmware(currentVersion) {
		
		console.log("Current version is: " + currentVersion);
		
		if (CONTENT.configuration.lastRelease === undefined) {
			var repoArray = [];
			loadGithubReleases("https://api.github.com/repos/KissUltra/firmware/releases").then(function (data) {
        			$.each(data, function (index, release) {
						if (!release.prerelease) {
							var repoVersion =  release.name;
							if (repoVersion !== undefined && repoVersion != '') {
								repoArray.push(repoVersion);
							}
						}
					});
					
					if (repoArray.length > 0) {
						repoArray.sort().reverse();
						CONTENT.configuration.lastRelease = repoArray[0];
						console.log("Fetched latest release: " + CONTENT.configuration.lastRelease);
						
						if (currentVersion != ('KISS_ULTRA-' + CONTENT.configuration.lastRelease)) {
							showNewVersion(CONTENT.configuration.lastRelease);
						}
						
					}
        		})
        } else {
			console.log("Cached latest release: " + CONTENT.configuration.lastRelease);
			if (currentVersion != ('KISS_ULTRA-' + CONTENT.configuration.lastRelease)) {
				showNewVersion(CONTENT.configuration.lastRelease);
			}
		}
	}
    
    
    function checkMigration() {
		console.log("Checking migration");
		
		if (self.needsMigration && self.boardId != 0 && self.PRESETS !== undefined) {
			console.log("Migration recommended, eeprom " + self.eeprom);
			self.needsMigration = false;
			CONTENT.configuration.legacyChecked = true;
			
			openRECWizard(0, self.boardId, self.eeprom);
		}
		
	}
    
    function updateInfo() {
    	if (kissProtocol.data[kissProtocol.GET_HARDWARE_INFO] != undefined) {
    	  var info = kissProtocol.data[kissProtocol.GET_HARDWARE_INFO];
    	  var tmp = info.hardwareVersion;
          var rev = tmp & 255;
          var brd = tmp >> 8;
          if (brd == 1) {
          	$("#hwversion").text("FCFC_ULTRA rev. " + rev);
          } else if (brd == 2) {
          	$("#hwversion").text("FCFC_ULTRA_MINI rev. " + rev);
          } else if (brd == 3) {
          	$("#hwversion").text("FCFC_ULTRA_2 rev. " + rev);
          } else if (brd == 4) {
          	$("#hwversion").text("FCFC_ULTRA_MINI2 rev. " + rev);
          } else if (brd == 5) {
          	$("#hwversion").text("FCFC_ULTRA_3 rev. " + rev);
          }else {
          	$("#hwversion").text("UNKNOWN rev. " + rev);
          }
          var tmp = info.bootloaderVersion;
          var minor =  tmp & 255;
          var major = tmp >> 8;
          $("#blversion").text("v" + major + "." + (minor < 10 ? '0'+minor : minor));
    	} else {
    		$("#blversion").text('...');
    		$("#hwversion").text('...');
    	}
    	updateMixers();
    	self.boardId = brd;	 

    	checkMigration();
    } 

    GUI.switchContent('configuration', function () {
    	$("#footer").hide();
        kissProtocol.send(kissProtocol.GET_SETTINGS, [kissProtocol.GET_SETTINGS], function () {
        	
            GUI.load("./content/configuration.html", function () {
                htmlLoaded(kissProtocol.data[kissProtocol.GET_SETTINGS])
                
                console.log("Getting hw info!");
                
                
                self.hwTimeout = window.setTimeout(function () {
                	console.log("No HW info received");
                	kissProtocol.init();
                }, 1000);
                
                if (kissProtocol.data[kissProtocol.GET_HARDWARE_INFO] == undefined) {
                	kissProtocol.send(kissProtocol.GET_HARDWARE_INFO, [kissProtocol.GET_HARDWARE_INFO, 0, 0], function () {
                        updateInfo();
                        if (self.hwTimeout != 0) window.clearTimeout(self.hwTimeout);
                	});
                } else {
                	if (self.hwTimeout != 0) window.clearTimeout(self.hwTimeout);
                	updateInfo();
                }
            });
        });
    });
    
    
    function fcNotCompatible() {
    	$(".modal-overlay").off('click');
    	$(".modal-overlay").on('click', function() {
    		$("#connect").click();
    		$(".modal-overlay").off('click');
    		hideModal();
    	});
    	$(".modal-body").html("<p class='header'>Warning!</p>This GUI is NOT compatible with your flight controller.<br><br>");
    	$(".modal-footer").html("");
    	$(".modal-overlay").show();
    	$(".modal").show();      
    }

    function copyTextToClipboard(text) {
        var copyFrom = $('<textarea/>');
        copyFrom.text(text);
        $('body').append(copyFrom);
        copyFrom.select();
        document.execCommand('copy');
        copyFrom.remove();
    }

	// Make combined json config    
    function makeBackupJson(fcConfig, osdConfig) {
		var config = {  };
		
		if (osdConfig == undefined) {
			config = fcConfig;
		} else {
			config.fc = fcConfig;
			config.osd = osdConfig;
			config.osd.kissultraosd = true;
			config.osd.ver = +config.fc.ver;
		}
							
		var json = JSON.stringify(config, function (k, v) {
    			if (k === 'buffer' || k === 'isActive' || k === 'actKey' || k === 'SN' || k === 'lipoConnected' || k === 'dont_export_me' ) {
    				return undefined;
    			} else {
    				return v;
    			}
    		}, 2);
		return json;
	}
	
	function saveBackupJsonWeb(json) {
		var blob = new Blob([json], {
			type: 'text/plain;charset=utf-8'
		});
		//Check the Browser.
		var isIE = false || !!document.documentMode;
		if (isIE) {
			window.navigator.msSaveBlob(blob, "ultra-backup-"+self.mcuid+".txt");
		} else {
			var url = window.URL || window.webkitURL;
			var link = url.createObjectURL(blob);
			var a = $("<a />");
			a.attr("download", "ultra-backup-"+self.mcuid+".txt");
			a.attr("href", link);
			$("body").append(a);
			a[0].click();
			a.remove();
		}
	}
	
	function saveBackupJsonNative(chosenFileEntry, json) {
		var blob = new Blob([json], {
			type: 'text/plain'
		});

		chosenFileEntry.createWriter(function(writer) {
			writer.onerror = function(e) {
				console.error(e);
			};

			var truncated = false;
			writer.onwriteend = function() {
				if (!truncated) {
					truncated = true;
					writer.truncate(blob.size);
					return;
				}
				console.log('Config has been exported');
			};

			writer.write(blob);
		}, function(e) {
			console.error(e);
		});
	}

    function backupConfig() {
    	if (isNative()) {
    		var chosenFileEntry = null;

    		var accepts = [{
    			extensions: ['txt']
    		}];

    		chrome.fileSystem.chooseEntry({
    			type: 'saveFile',
    			suggestedName: "ultra-backup-"+self.mcuid+".txt",
    			accepts: accepts
    		}, function (fileEntry) {
    			if (chrome.runtime.lastError) {
    				console.error(chrome.runtime.lastError.message);
    				return;
    			}

    			if (!fileEntry) {
    				console.log('No file selected.');
    				return;
    			}

    			chosenFileEntry = fileEntry;

    			chrome.fileSystem.getDisplayPath(chosenFileEntry, function (path) {
    				console.log('Export to file: ' + path);
    			});

    			chrome.fileSystem.getWritableEntry(chosenFileEntry, function (fileEntryWritable) {

    				chrome.fileSystem.isWritableEntry(fileEntryWritable, function (isWritable) {
						if (isWritable) {
							chosenFileEntry = fileEntryWritable;
							if (+kissProtocol.data[kissProtocol.GET_SETTINGS]['ver'] > 129) {
								var tmp = {
									'buffer': new ArrayBuffer(1),
									'chunk': 0
								};
								kissProtocol.send(kissProtocol.GET_OSD_CONFIG, kissProtocol.preparePacket(kissProtocol.GET_OSD_CONFIG, tmp), function() {
									saveBackupJsonNative(chosenFileEntry, makeBackupJson(kissProtocol.data[kissProtocol.GET_SETTINGS], kissProtocol.data[kissProtocol.GET_OSD_CONFIG]));
								});
							} else {
								saveBackupJsonNative(chosenFileEntry, makeBackupJson(kissProtocol.data[kissProtocol.GET_SETTINGS])); // old fw
							}
						} else {
							console.log('Cannot write to read only file.');
						}
					});
    			});
    		});
    	} else {
    		// web
    		if (+kissProtocol.data[kissProtocol.GET_SETTINGS]['ver'] > 129) {
				var tmp = {
					'buffer': new ArrayBuffer(1),
					'chunk': 0
				};
				kissProtocol.send(kissProtocol.GET_OSD_CONFIG, kissProtocol.preparePacket(kissProtocol.GET_OSD_CONFIG, tmp), function () {	
					saveBackupJsonWeb(makeBackupJson(kissProtocol.data[kissProtocol.GET_SETTINGS], kissProtocol.data[kissProtocol.GET_OSD_CONFIG]));
				});
			} else {
				saveBackupJsonWeb(makeBackupJson(kissProtocol.data[kissProtocol.GET_SETTINGS])); // old fw
			}
    	}
    };

    function restoreConfig(callback) {

    	if (isNative()) {
    		var chosenFileEntry = null;

    		var accepts = [{
    			extensions: ['txt']
    		}];

    		chrome.fileSystem.chooseEntry({
    			type: 'openFile',
    			accepts: accepts
    		}, function (fileEntry) {
    			if (chrome.runtime.lastError) {
    				console.error(chrome.runtime.lastError.message);
    				return;
    			}

    			if (!fileEntry) {
    				console.log('No file selected, restore aborted.');
    				return;
    			}

    			chosenFileEntry = fileEntry;

    			chrome.fileSystem.getDisplayPath(chosenFileEntry, function (path) {
    				console.log('Import config from: ' + path);
    			});

    			chosenFileEntry.file(function (file) {
    				var reader = new FileReader();

    				reader.onprogress = function (e) {
    					if (e.total > 16384) {
    						console.log('File limit (16 KB) exceeded, aborting');
    						reader.abort();
    					}
    				};

    				reader.onloadend = function (e) {
    					if (e.total != 0 && e.total == e.loaded) {
    						console.log('Read OK');
    						try {
    							callback(JSON.parse(e.target.result));
    						} catch (e) {
								console.log('Wrong file');
    							return;
    						}
    					}
    				};
    				reader.readAsText(file);
    			});
    		});
    	} else {
    		// web
    	}
    };
    
    
    self.images = [];
    
    self.barResize = function () {
    	$(".meter-bar .label, .meter-bar .fill .label").each(function(index) {
    		$(this).css("margin-left",  ($(this).closest(".meter-bar").width() / 2) - ($(this).width() / 2));
    	});
    };
    
    function fastDataPoll() {
        if (self.requestTelemetry) {
            kissProtocol.send(kissProtocol.GET_TELEMETRY, [kissProtocol.GET_TELEMETRY], function () {
                if (GUI.activeContent == 'configuration') {
                    self.telemetry = kissProtocol.data[kissProtocol.GET_TELEMETRY];
                    self.updateTimeout = window.setTimeout(function () { updateWizard();  updateAUXWizard();}, 20);
                }
            });
            
            self.telemetryTimeout = window.setTimeout(function () { fastDataPoll(); }, 10);
        }
    }

  
    
    function updateWizard() {
		if ($(".motor-wizard").is(":visible")) {
    	var data = self.telemetry;
    	// do label
    	$(".meter-bar .label, .meter-bar .fill .label").each(function(index) {
    		 $(this).text(data['RXcommands'][0].toFixed(0));
    	});
    	// do bar
    	$(".meter-bar .fill").each(function(index) {
    		$(this).css('width', ((data['RXcommands'][0] - 1000) / 10).clamp(0, 100) + '%');
    	});
       
        self.barResize(); 
        
        if (data['RXcommands'][0] > 1024) {
        	$(".motor-wizard .wizard-button").addClass("wizard-button-disabled");
        	$(".motor-wizard-motor-indicator").addClass("active");
        } else {
        	$(".motor-wizard .wizard-button").removeClass("wizard-button-disabled");
        	$(".motor-wizard-motor-indicator").removeClass("active");
        }
        }
    }

    
    function closeMotorWizard() {
    	$(".modal-overlay").off("click");
	  	if (self.telemetryTimeout != 0) window.clearTimeout(self.telemetryTimeout);
    	$(window).off('resize', self.barResize);
	  	$(".modal-overlay").hide();
    	$(".motor-wizard").hide();
    	self.motorWizardEnabled = false;
    	$(".motor-wizard-inner").kissWizard("destroy");
    	self.checkMotorWizard();
    	

	    console.log("For safety reasons, turning off the motors");
	    var tmp = {
	        'buffer': new ArrayBuffer(9),
	        'motorTestEnabled': 0,
	        'motorTest': [0, 0, 0, 0, 0, 0, 0, 0]
	    };
	    kissProtocol.send(kissProtocol.MOTOR_TEST, kissProtocol.preparePacket(kissProtocol.MOTOR_TEST, tmp), function() {
				console.log("Motors turned off");
		});
    }
    
    // wizard
    function openMotorWizard(motor, stage) {
    	  
        $(window).on('resize', self.barResize).resize(); // trigger so labels
        
    	var iid = 0;
    	// preload images
    	for (var i = 0; i < 4; i++) {
    		self.images[iid] = new Image();
    		self.images[iid].src = "images/wizard/"+(i+1)+"cw.png";
    		iid++;
    		self.images[iid] = new Image();
    		self.images[iid].src = "images/wizard/"+(i+1)+"ccw.png";
        }
    	iid++;
    	self.images[iid] = new Image();
		self.images[iid].src = "images/wizard/0.png";
    	
    	var config = kissProtocol.data[kissProtocol.GET_SETTINGS];
   	 	var ct = config.CopterType;
   	 	if (ct == 0) {
   	 		self.motors = 3;
   	 	} else if (ct >=1 && ct<=3 ) {
   	 		self.motors = 4;
   	 	} else if (ct >=4 && ct<=6 ) {
   	 		self.motors = 6;
   	 	} else if (ct >=7 && ct<=8 ) {
   	 		self.motors = 5;
   	 	} else {
   	 		self.motors = 8;
   	 	}    	
   	 	
   	 	self.wizardMotor = motor;
    	self.wizardStage = stage; // 0 - intro; 1 - spin the motor
    	self.wizardESCReset = false;
    	
    	var steps = [{ 
			'template' : 'motor-wizard-welcome-template',
			'type': 'welcome',
			'dataProvider' : {
				'motors': self.motors
			},
			'preload': function(plugin, step) {

			},
			'postload' : function(plugin, step) {
				  	var tmp = {
		                    'buffer': new ArrayBuffer(9),
		                    'motorTestEnabled': 0,
		                    'motorTest': [0, 0, 0, 0, 0, 0, 0, 0]
		            };
				  	kissProtocol.send(kissProtocol.MOTOR_TEST, kissProtocol.preparePacket(kissProtocol.MOTOR_TEST, tmp));
				  	$(".wizard-button-cancel").show();
			}
		}];
    	
    	for (var i = 1; i <= self.motors; i++) {
    		var m1 = { 
    				'template' : 'motor-wizard-motor-spin-template',
    				'type' : 'motor',
    				'dataProvider' : {
    					'motor': i,
    					'mixerImage':  "images/wizard/0.png"
    				},
    				'preload': function(plugin, step) {
    					if (!self.wizardESCReset) {
    						self.wizardESCReset = true;
    						console.log("Resetting ESC to its defaults");
    						var escSettings = [0x10, 0x20, 0x30, 0x40, 0x50, 0x60, 0x70, 0x80]; // Make checksum complex
    				        var tmp = {
    				            'buffer': new ArrayBuffer(8),
    				            'escSettings': escSettings
    				        };
    				        kissProtocol.send(kissProtocol.SET_ESC_SETTINGS, kissProtocol.preparePacket(kissProtocol.SET_ESC_SETTINGS, tmp));
    					}
    				},
    				'postload': function(plugin, step) {
    					
    					  	var tmp = {
    			                    'buffer': new ArrayBuffer(9),
    			                    'motorTestEnabled': 2,
    			                    'motorTest': [0, 0, 0, 0, 0, 0, 0, 0]
    			            };
    			            
    					  	tmp.motorTest[+step.dataProvider.motor - 1] = 1;
      					  	console.log(tmp);
      					  	  					  	
    					  	$(".wizard-button-cancel").hide();
    					  		
    					  	kissProtocol.send(kissProtocol.MOTOR_TEST, kissProtocol.preparePacket(kissProtocol.MOTOR_TEST, tmp));

    						$("#wizard-image", plugin).click(function(e) {
    						  var posX = $(this).offset().left, posY = $(this).offset().top;
    						  var x = e.pageX - posX;
    						  var y = e.pageY - posY;
    						  var m = 0;
    						  if ((x < 150) && y < 100) {
    							  m = 1;
    						  } else if ((x > 150) && y < 100) {
    							  m = 2;
    						  } else if ((x > 150) && y > 100) {
    							  m = 3;
    						  } else if ((x < 150) && y > 100) {
    							  m = 4;
    						  }
    						  
    						  step.dataProvider.newMotor = m;
    						  if (step.dataProvider.currentDirection === undefined) {
    							  step.dataProvider.currentDirection = "cw";
    						  } else {
    							  step.dataProvider.currentDirection = step.dataProvider.currentDirection == "cw" ? "ccw" : "cw";
    						  }
    						  
    						  var pic = "images/wizard/0.png";
    						  if (step.dataProvider.currentDirection !== undefined) {
    							  var pic = "images/wizard/" + step.dataProvider.newMotor + step.dataProvider.currentDirection+".png";
    						  }
    						  $(this).attr("src", pic);
    						});
    					
     						var pic = "images/wizard/0.png";
    						if (step.dataProvider.currentDirection !== undefined) {
							  pic = "images/wizard/" + step.dataProvider.newMotor + step.dataProvider.currentDirection+".png";
    						}
    		
						  $("#wizard-image", plugin).attr("src", pic);
    				}
    		}
    		steps.push(m1);
    	};
    	
    	
    	var m1 = { 
				'template' : 'motor-wizard-motor-layout-template',
				'type': 'layout',
				'dataProvider' : {
					'motors': self.motors
				},
				'preload': function(plugin, step) {
					var steps = $(plugin).kissWizard("steps");
					var map = "";
					$.each(steps, function(key, value) { 
						if (value.type == "motor") {
							map = map + value.dataProvider.newMotor;
						}
					});
					
					console.log("Found motor layout: " + map);
					
					var motorLayouts = [
			    		// kiss
			    		"1234",
			    		"2341",
			    		"4123",
			    		"3412",
			    		"2143",
			    		"3214",
			    		"1432",
			    		"4321",
			    		// betaflight
			    		"3241",
			    		"4312",
			    		"2134",
			    		"1423",
			    		"4132",
			    		"1243",
			    		"3421",
			    		"2314"
			    	];
					
					step.dataProvider.complete = false;
					
					$.each(motorLayouts, function(key, value) { 
						if (value == map) {
							step.dataProvider.layout = key;
							step.dataProvider.brand = key < 8 ? "KISS" : "BLHeli";
							step.dataProvider.layoutName = $("#ESCOutputLayout option[value=" + key + "]").text();
							var pic = "images/mixer/";
							if (key == 0) pic += "2"; else pic += "2_" + key;
							pic+=".png";
							step.dataProvider.mixerImage = pic;
							step.dataProvider.reverseAll = false;
							step.dataProvider.complete = true;
							step.dataProvider.motorMap = value;
						}
					});
					
					if (!step.dataProvider.complete) {
						step.dataProvider.mixerImage = "images/mixer/unknown.png";
					}
				},
				
				'postload': function(plugin, step) {
					
				 	var tmp = {
		                    'buffer': new ArrayBuffer(9),
		                    'motorTestEnabled': 0,
		                    'motorTest': [0, 0, 0, 0, 0, 0, 0, 0]
		            };
				  	
				 	kissProtocol.send(kissProtocol.MOTOR_TEST, kissProtocol.preparePacket(kissProtocol.MOTOR_TEST, tmp));
				  	
 					$(".wizard-button-cancel").hide();
					$("#wizard-image-layout", plugin).click(function(e) {
					 
					  if (step.dataProvider.complete) {
						  step.dataProvider.reverseAll = !step.dataProvider.reverseAll;
						  var pic = "images/mixer/";
						  if (step.dataProvider.layout == 0) pic += "2"; else pic += "2_" + step.dataProvider.layout;
						  if (step.dataProvider.reverseAll) pic += "_inv";
						  pic+=".png";
					  } else {
						  pic = "images/mixer/unknown.png";
					  }
					
					  $(this).attr("src", pic);
					});
				
					var pic = "images/mixer/";
					if (step.dataProvider.complete) {
						if (step.dataProvider.layout == 0) pic += "2"; else pic += "2_" + step.dataProvider.layout;
						if (step.dataProvider.reverseAll) pic += "_inv";
						pic+=".png";
					} else {
						pic += "unknown.png";
					}
					
					$("#wizard-image-layout", plugin).attr("src", pic);
					
					if (step.dataProvider.complete) {
						$(".wizard-button-save").show();
					} else {
						$(".wizard-button-save").hide();
					}
					
					$(".wizard-button-save").off("click").click(function() {
						if (!$(this).hasClass("wizard-button-disabled")) {
							var steps = $(plugin).kissWizard("steps");
							
							var dirmap = [];
							var reverseAll = false;
							var layout = "";
							var escOrientation = 0;
							$.each(steps, function(key, value) { 
								if (value.type == "motor") {
									var realMotor = value.dataProvider.motor - 1;
									dirmap[realMotor] = value.dataProvider.currentDirection;
								} else if (value.type == "layout") {
									reverseAll = value.dataProvider.reverseAll;
									layout = value.dataProvider.motorMap;
									escOrientation = value.dataProvider.layout;
								}
							});
							
							console.log("Current direction map, per output!");
							console.log(dirmap);
							
							var quadmap = []; 
							if (!step.dataProvider.reverseAll) {
								quadmap[0] = "cw";
								quadmap[1] = "ccw";
								quadmap[2] = "cw";
								quadmap[3] = "ccw";
							} else {
								quadmap[0] = "ccw";
								quadmap[1] = "cw";
								quadmap[2] = "ccw";
								quadmap[3] = "cw";
							}
							
							var rightmap = ["","","",""];
							for (i=0; i<4; i++) {
								var m = +layout.charAt(i);
								rightmap[i] = quadmap[m - 1];
							}
							
							console.log("Real direction map, per motor!");
							console.log(rightmap);
													
							var tmp = {
				                    'buffer': new ArrayBuffer(9),
				                    'motorLayout': step.dataProvider.layout,
				                    'escSettings': [0x10, 0x20, 0x30, 0x40, 0x50, 0x60, 0x70, 0x80]
				            };
							
							for (i=0; i<4; i++) {
								tmp.escSettings[i] += (rightmap[i] != dirmap[i] ? 1 : 0);
							}
						
							
							if (reverseAll) {
								tmp.motorLayout |= 0x80;
							}
							
							
							closeMotorWizard();
						 	$("#ESCOutputLayout").val(escOrientation);
						    self.UpdateMixerImage(2, $("#ESCOutputLayout").val(), reverseAll);
						    
						    $("#save,#backup,#restore").addClass("disabled");
						    window.setTimeout(function() {
								 $("#save,#backup,#restore").removeClass("disabled");
							}, escOrientation < 8 ? 1000 : 4000);
						  	kissProtocol.send(kissProtocol.SET_MOTOR_WIZARD, kissProtocol.preparePacket(kissProtocol.SET_MOTOR_WIZARD, tmp), function() {
						  		console.log("ESC Info saved");
						  		console.log(tmp.escSettings);
						  		self.checkMotorWizard();
						  		// set new orientation and close the wizard
						  	});
						}
					});
			
				},
				
				"unload": function(plugin, step) {
					$(".wizard-button-save").hide();
				}
    	}
		
		steps.push(m1);
    	
    	$(".motor-wizard-inner").kissWizard({
    		'buttonsTemplate': 'motor-wizard-buttons-template',
    		'headerTemplate': 'motor-wizard-header-template',
    		steps: steps,
    		name: "Motor Wizard",
    		currentStep: 0
    	});
    	
    	self.motorWizardEnabled = true;
    	
    	$(".modal-overlay").show();
    	$(".motor-wizard").show();
    	
    	self.barResize();
    	
    	self.requestTelemetry = true;
    	if (GUI.activeContent == 'configuration') self.telemetryTimeout = window.setTimeout(function () { fastDataPoll(); }, 10);
    	
    	$(".modal-overlay, .wizard-button-cancel").click(function() {
    		closeMotorWizard();
    	});
    }
    
    
    ////// AUX Wizard
    
     function pwmToAuxRange(pwm) {
		 var chanValue = (pwm - 1500) / 500;
		 if (chanValue<-1) chanValue = -1;
		 if (chanValue>1) chanValue = 1;
		 if (chanValue < -0.5) return 1; // low
		 if (chanValue < 0.5)  return 2; // medium
		 if (chanValue > 0.5)  return 3; // high
	 }
    
    
     function updateAUXWizard() {
		 if ($(".aux-wizard").is(":visible")) {
    	var data = self.telemetry;
    	var changedId = -1;
    	var changedCount = 0;
    	var zeroes = 0;
    	for (var i=0; i<7; i++) {
			var tmp = pwmToAuxRange(data.RXcommands[i + 4]);
			if (tmp != self.auxes[i]) {
				changedCount++;
				changedId = i;
			}
			if (self.auxes[i] == 0) {
				zeroes++;
			}
			self.auxes[i] = tmp;
			
		}
		
		if (changedCount == 1) {
			console.log("Aux " + (changedId+1) + " changed to " + self.auxes[changedId]);
			var ranges = ['','Low','Medium','High'];
			for (var i=0; i<7; i++) {
				var bar = $("#auxbars").children()[i];
    			// do bar
    			
				if (i == changedId) {
					$(bar).css('opacity',1);
					$(bar).find(".label").text(ranges[self.auxes[i]]);
					$(".active-aux-channel").text("AUX" + (i+1));
					$(".active-aux-value").text(ranges[self.auxes[i]]);
					$(".active-aux-message").show();
					self.auxChannel = i;
					self.auxValue = self.auxes[i];
					$(".wizard-button-setaux").text("Set AUX" + (i+1) + " " + ranges[self.auxes[i]]).show();
				} else {
					$(bar).css('opacity',0.1);
					$(bar).find(".label").text(data['RXcommands'][i+4].toFixed(0));
				}
				$(bar).find(".fill").first().css('width', ((data['RXcommands'][i+4] - 1000) / 10).clamp(0, 100) + '%');
			}
		} 
		
		if (zeroes == 7) {
				for (var i=0; i<7; i++) {
				var bar = $("#auxbars").children()[i];
				$(bar).css('opacity',0.1);
				$(bar).find(".label").text(data['RXcommands'][i+4].toFixed(0));
				$(bar).find(".fill").first().css('width', ((data['RXcommands'][i+4] - 1000) / 10).clamp(0, 100) + '%');
			}
		}
       
        self.barResize(); 
        }
    }
    
    function closeAUXWizard() {
    	$(".modal-overlay").off("click");
	  	if (self.telemetryTimeout != 0) window.clearTimeout(self.telemetryTimeout);
    	$(window).off('resize', self.barResize);
	  	$(".modal-overlay").hide();
    	$(".aux-wizard").hide();
    	$(".aux-wizard-inner").kissWizard("destroy");
    	
    	kissProtocol.removePendingRequests();
    }
    

    function openAUXWizard(funcId, funcName, stage) {
    	  
        $(window).on('resize', self.barResize).resize(); // trigger so labels
      

    	var config = kissProtocol.data[kissProtocol.GET_SETTINGS];
   	 	self.wizardFuncId = funcId;
   	 	self.wizardFuncName = funcName;
    	self.wizardStage = stage; // 0 - intro; 1 - spin the motor
    	self.auxChannel = -1;
		self.auxValue = -1;
    	
    	var steps = [{ 
			'template' : 'aux-wizard-welcome-template',
			'type': 'welcome',
			'dataProvider' : {
				funcId: self.wizardFuncId,
				funcName: self.wizardFuncName,
			},
			'preload': function(plugin, step) {

			},
			'postload' : function(plugin, step) {
			    $(".wizard-button-setaux").hide();
			    $(".wizard-button-setaux").on("click", function() {
						closeAUXWizard();
						
						if (self.auxChannel != -1) {
							var val = ((self.auxChannel + 1) & 0x0f) << 4;
							if (self.auxValue == 1) val |= 1;
							if (self.auxValue == 2) val |= 3;
							if (self.auxValue == 3) val |= 5;
						
							$("#aux" + self.wizardFuncId).kissAux('setValue', val);
						}
				});
		    	for (var i=0; i<7; i++) {
					self.auxes[i] = 0;
					var bar = $("#auxbars").children()[i];
					$(bar).css('opacity',0.1);
				}
			}
		}];
    	
    
    	
    // steps.push()';
    	
    	$(".aux-wizard-inner").kissWizard({
    		'buttonsTemplate': 'aux-wizard-buttons-template',
    		'headerTemplate': 'aux-wizard-header-template',
    		steps: steps,
    		name: "AUX Wizard",
    		currentStep: 0
    	});
    	
    
    	
    	self.auxWizardEnabled = true;
    	
    	$(".modal-overlay").show();
    	$(".aux-wizard").show();
    	
    	self.barResize();
    	
    	self.requestTelemetry = true;
    	if (GUI.activeContent == 'configuration') self.telemetryTimeout = window.setTimeout(function () { fastDataPoll(); }, 10);
    	
    	$(".modal-overlay, .wizard-button-cancel").click(function() {
    		closeAUXWizard();
    	});
    	
    }
    
    
    ///// AUX Wizard End
    
    
    
    function isLegacyDefaults(data) {
    	
    	if ((+data['G_P'][0] == 3) &&
    		(+data['G_P'][1] == 3) &&
    		(+data['G_P'][2] == 8) &&
    		(+data['G_I'][0] == 0.035) &&
    		(+data['G_I'][1] == 0.035) &&
    		(+data['G_I'][2] == 0.050) &&
    		(+data['G_D'][0] == 10) &&
    		(+data['G_D'][1] == 10) &&
    		(+data['G_D'][2] == 5) &&
    		(+data['AUX'][0] == 0)) {
    		return true;
    	} 
    	return false;
    }
    
    
    ///// begin recommended wizard
    
     function closeRECWizard() {
    	$(".modal-overlay").off("click");
    	$(window).off('resize', self.barResize);
	  	$(".modal-overlay").hide();
    	$(".rec-wizard").hide();
    	self.recWizardEnabled = false;
    	$(".rec-wizard-inner").kissWizard("destroy");
    	//self.checkRECWizard();
    }
    
    // wizard
    function openRECWizard(stage, boardId, eeprom) {
    	 
    	$(window).on('resize', self.barResize).resize(); // trigger so labels
          
        var ultra = 'u1';
        if (boardId == 3 || boardId == 4) {
			ultra = 'u2';
		}  
		
		if (boardId == 5) {
			ultra = 'u3';
		}  
		
		if (eeprom < 138) { // B46 should be updated.
			ultra = 'u2a';
		}
          
    	var steps = [{ 
			'template' : 'rec-wizard-welcome-template-' + ultra,
			'type': 'welcome',
			'dataProvider' : {
				'boardId': boardId,
				'ultra': ultra
			},
			'preload': function(plugin, step) {
				if (ultra == 'u2a') {
					$(".wizard-button-yes").hide();
					$(".wizard-button-flash").show();
					
				}
			},
			'postload' : function(plugin, step) {
				
				$(".wizard-button-flash").click(function() {
					closeRECWizard();
					CONTENT.fc_flasher.goRemote = true;
					CONTENT.fc_flasher.initialize();
				});
					
				$(".wizard-button-no").click(function() {
					closeRECWizard();
				});
				
				$(".wizard-button-yes").click(function() {
					
					var preset = "default_ultra";
					if ((ultra == 'u2') || (ultra == 'u3')) {
						preset = 'default_ultra_v2_exp';
					}
					
					var tmp = CONTENT.configuration.PRESETS[preset];
					var data = kissProtocol.data[kissProtocol.GET_SETTINGS];
					
					data.G_P[0] = tmp.roll.p;
					data.G_P[1] = tmp.pitch.p;
					data.G_P[2] = tmp.yaw.p;
					data.G_I[0] = tmp.roll.i;
					data.G_I[1] = tmp.pitch.i;
					data.G_I[2] = tmp.yaw.i;
					data.G_D[0] = tmp.roll.d;
					data.G_D[1] = tmp.pitch.d;
					data.G_D[2] = tmp.yaw.d;
					data.softarm_mode = 1;
					data.throttleScaling = 1;
					data.TPABP1 = 25;
					data.TPABP2 = 25;
					data.TPABPI1 = 0;
					data.TPABPI2 = 0;
					data.TPABPI3 = 0;
					data.TPABPI4 = 100;
					data.CustomTPAInfluence = 1;
					
					if ((ultra == 'u2') || (ultra == 'u3')) {
						data.expMode = 1;
					}

					console.log("Applied recommendations");
					console.log(kissProtocol.data[kissProtocol.GET_SETTINGS]);
					
					closeRECWizard();
				
				    kissProtocol.send(kissProtocol.SET_SETTINGS, kissProtocol.preparePacket(kissProtocol.SET_SETTINGS, kissProtocol.data[kissProtocol.GET_SETTINGS]));
                	kissProtocol.send(kissProtocol.GET_SETTINGS, [kissProtocol.GET_SETTINGS], function () {
                	GUI.load("./content/configuration.html", function () {
                         htmlLoaded(kissProtocol.data[kissProtocol.GET_SETTINGS]);
                         updateInfo();
                     });
                 });	

				});
			}
		}];
    
    	
    	
    	$(".rec-wizard-inner").kissWizard({
    		'buttonsTemplate': 'rec-wizard-buttons-template',
    		'headerTemplate': 'rec-wizard-header-template',
    		steps: steps,
    		name: ultra != 'u2a' ? "Recommended Settings" : "",
    		currentStep: 0
    	});
    	
    	self.recWizardEnabled = true;
    	
    	$(".modal-overlay").show();
    	$(".rec-wizard").show();
    	
    	self.barResize();
    	
    	
    	$(".modal-overlay").click(function() {
    		closeRECWizard();
    	});
    }
    
    
    
    ///// end recommended wizard
    
    
    function isLevelPidsVisible(data) {
		var visible = 0;
		if (data['ver'] >= 145) {
			if (data['AUX'][4] >> 4 != 0) visible++; // althold
		}
		if (data['AUX'][1] >> 4 != 0) visible ++; 	 // level
		if (data['AUX'][13] >> 4 != 0) visible ++; 	 // rth
		return visible > 0;
	}
	
	function updateLevelModePids() {
		var data = {};
		data['AUX'] = [];
		var visible = 0;
		if ($("#aux4").is(":visible")) {
			visible += +$("#aux4").find('select').first().val() << 4;
		};
		visible += +$("#aux1").find('select').first().val() << 4;
		visible += +$("#aux13").find('select').first().val() << 4;
		if (visible > 0) {
			$(".level").show();
		} else {
			$(".level").hide();
		}
	}
    
    function htmlLoaded(data) {
    	    	     	
        validateBounds('#content input[type="number"]');
        var settingsFilled = 0;
        
      
        
        $('input[name="3dMode"]').removeAttr("disabled");

        kissProtocol.send(kissProtocol.GET_INFO, [kissProtocol.GET_INFO], function () {
            var info = kissProtocol.data[kissProtocol.GET_INFO];
            $('#version').text(info.firmvareVersion.substr('KISS_ULTRA-'.length));
           
            if (!info.firmvareVersion.includes('ULTRA')) {
            	fcNotCompatible();
            }
            
            checkNewFirmware(info.firmvareVersion);
        });

        $("#presets").change(function() {
        	var c = $(this).val();
        	if (c != "") {
        		console.log('Change to ' + c);
        		var tmp = CONTENT.configuration.PRESETS[c];

        		$('tr.roll input').eq(0).val(tmp.roll.p);
        		$('tr.roll input').eq(1).val(tmp.roll.i);
        		$('tr.roll input').eq(2).val(tmp.roll.d);

        		$('tr.pitch input').eq(0).val(tmp.pitch.p);
        		$('tr.pitch input').eq(1).val(tmp.pitch.i);
        		$('tr.pitch input').eq(2).val(tmp.pitch.d);

        		$('tr.yaw input').eq(0).val(tmp.yaw.p);
        		$('tr.yaw input').eq(1).val(tmp.yaw.i);
        		$('tr.yaw input').eq(2).val(tmp.yaw.d);

        		contentChange();
        	}
        });

        document.getElementById('rxdsm1').style.display = "inline";
        document.getElementById('rxdsm2').style.display = "inline";
        document.getElementById('rxsbus1').style.display = "inline";
        document.getElementById('rxsbus2').style.display = "inline";
        document.getElementById('rxsbus3').style.display = "inline";
        document.getElementById('rxsumd1').style.display = "inline";
        document.getElementById('rxexbus1').style.display = "inline";
        document.getElementById('rxsrxl1').style.display = "inline";
        document.getElementById('rxxbusb1').style.display = "inline";
        document.getElementById('rxcrsf1').style.display = "inline";
        document.getElementById('rxfport1').style.display = "inline";
        document.getElementById('rxfport2').style.display = "inline";
        document.getElementById('rxsbusfast').style.display = "inline";
        document.getElementById('rxghost').style.display = "inline";

        if (data['vtxType'] == 0) {
            $('#aux5').hide();
            $('#aux6').hide();
            $('#aux7').hide();
        }
      
        kissProtocol.send(kissProtocol.GET_INFO, [kissProtocol.GET_INFO], function () {
        	var info = kissProtocol.data[kissProtocol.GET_INFO];
        	var FCinfo = info.firmvareVersion.split(/-/g);

        	switch (FCinfo[0]) {
        	case "KISSFC":
        	case "KISSCC":
        	case "FETTEC_FC_NANO":
        		$("select[name='outputMode'] option[value='6']").remove(); // dshot1200
        		$("select[name='outputMode'] option[value='7']").remove(); // dshot2400
        		$("select[name='outputMode'] option[value='8']").remove(); // onewire
        		$("li[data-name='fc_flasher']").hide(); // v2 flasher
        		break;
        	case "KISSFCV2F7":
        	case "FETTEC_KISSFC":
        		$("li[data-name='fc_flasher']").show();
        		break;
        	default:
        		break;
        	}
        });
    

        var MCUid = '';
        for (var i = 0; i < 4; i++) {
            if (data['SN'][i] < 16) MCUid += '0';
            MCUid += data['SN'][i].toString(16).toUpperCase();
        }
        MCUid += '-';
        for (var i = 4; i < 8; i++) {
            if (data['SN'][i] < 16) MCUid += '0';
            MCUid += data['SN'][i].toString(16).toUpperCase();
        }
        MCUid += '-';
        for (var i = 8; i < 12; i++) {
            if (data['SN'][i] < 16) MCUid += '0';
            MCUid += data['SN'][i].toString(16).toUpperCase();
        }
        
        self.mcuid = MCUid;

        var sntext = MCUid + ' (' + (data['isActive'] ? $.i18n('text.activated') : $.i18n('text.not-activated')) + ')';
        $('#SN').text(sntext);
        $('#eeprom1').text(data['ver']);
        $('#SN2').text($.i18n("text.serial-number") + ": " + MCUid);
        $('#SN').on('click', function (e) {
            copyTextToClipboard(MCUid);
            $('#SN').text($.i18n("text.serial-clipboard"));
            setTimeout(function () {
                $('#SN').text(sntext);
            }, 1000);
        });

        var mixerList = [2, 1, 4, 5, 6, 9, 10];
           
 
        var mixer_list_e = $('select.mixer');
        for (var i = 0; i < mixerList.length; i++) {
            mixer_list_e.append('<option data-i18n="mixer.' + (mixerList[i]) + '" value="' + (mixerList[i]) + '">' + mixerList[i] + '</option>');
        }


        mixer_list_e.on('change', function () {
            var val = parseInt($(this).val());
            contentChange();
            if (val == 0) $(".tricopter").show(); else $(".tricopter").hide();
            self.UpdateMixerImage(val, data['ESCOutputLayout'], data['reverseMotors']);
        });

        // apply configuration values to GUI elements
        // uav type and receiver
        mixer_list_e.val(data['CopterType']).change();
        $('#rxType').val(data['RXType']);

        $('#rxType').on('change', function () {
        	
        	 if (data['ver'] >= 129) {
                          
             	if (+$('#rxType').val() == 17)  {
             		$('#gimbalPTMode').show();
             		
             		if (data['ver'] >= 143) {
             			if (+$('#gimbalPTMode').val() == 0) {
							$('#channelOrder').show();
						} else {
							$('#channelOrder').hide();
						}
					} else {
						$('#channelOrder').hide();  
					}

             	} else {
             		$('#gimbalPTMode').hide();
             		
             		if (data['ver'] >= 143) {
						$('#channelOrder').show();  
					}
             	}
             }
        	 
            contentChange();
        });

        // general settings
        $('input[name="minThrottle"]').val(data['MinThrottle16']);
        $('input[name="minThrottle"]').on('input', function () {
            contentChange();
        });
        $('input[name="maxThrottle"]').val(data['MaxThrottle16']);
        $('input[name="maxThrottle"]').on('input', function () {
            contentChange();
        });
        $('input[name="minCommand"]').val(data['MinCommand16']);
        $('input[name="minCommand"]').on('input', function () {
        	if ($(this).val() == 1000) {
        		$("input[name='throttleScaling']").prop("disabled", false);
        	} else {
        		$("input[name='throttleScaling']").prop("disabled", true);
        	}
            contentChange();
        });
        $('input[name="midCommand"]').val(data['MidCommand16']);
        $('input[name="midCommand"]').on('input', function () {
            contentChange();
        });
        $('input[name="TYmid"]').val(data['TYmid16']);
        $('input[name="TYmid"]').on('input', function () {
            contentChange();
        });
        $('input[name="TYinv"]').prop('checked', data['TYinv8']);
        $('input[name="TYinv"]').on('input', function () {
            contentChange();
        });

        var outputMode = +data['ESConeshot125'];
        
        $("#outputMode").val(outputMode);
        if (data['ver'] >= 145) {
			if (outputMode == 8) {
				$("#fastTelemetry").hide();
			} else {
				$("#fastTelemetry").show();
			}
		}
       
        
        $("#outputMode").on('change', function () {
			if (data['ver'] >= 145) {
				if ($(this).val() == 8) {
					$("#fastTelemetry").hide();
				} else {
					$("#fastTelemetry").show();
				}
			}
            contentChange();
            updateMixers();
        });
        
        
        if (data['ver'] >= 145) {
			$("input[name='fastTelemetry']").on('change', function () {
            	contentChange();
        	});
        	
        	if (+data['fastTelemetry'] == 1) {
				$("input[name='fastTelemetry']").prop('checked', true);
			}
        };

        $('input[name="failsaveseconds"]').val(data['failsaveseconds']);
        $('input[name="failsaveseconds"]').on('input', function () {
            contentChange();
        });
        
     
        // pid and rates
        // roll
        $('tr.roll input').eq(0).val(data['G_P'][0]);
        $('tr.roll input').eq(1).val(data['G_I'][0]);
        $('tr.roll input').eq(2).val(data['G_D'][0]);
        $('tr.roll input').eq(3).val(data['RC_Rate'][0]);
        $('tr.roll input').eq(4).val(data['RPY_Expo'][0]);
        $('tr.roll input').eq(5).val(data['RPY_Curve'][0]);
        for (var i = 0; i < 6; i++) {
            $('tr.roll input').eq(i).on('input', function () {
                contentChange();
            });
        }

        // pitch
        $('tr.pitch input').eq(0).val(data['G_P'][1]);
        $('tr.pitch input').eq(1).val(data['G_I'][1]);
        $('tr.pitch input').eq(2).val(data['G_D'][1]);
        $('tr.pitch input').eq(3).val(data['RC_Rate'][1]);
        $('tr.pitch input').eq(4).val(data['RPY_Expo'][1]);
        $('tr.pitch input').eq(5).val(data['RPY_Curve'][1]);
        for (var i = 0; i < 6; i++) {
            $('tr.pitch input').eq(i).on('input', function () {
                contentChange();
            });
        }

        // yaw
        $('tr.yaw input').eq(0).val(data['G_P'][2]);
        $('tr.yaw input').eq(1).val(data['G_I'][2]);
        $('tr.yaw input').eq(2).val(data['G_D'][2]);
        $('tr.yaw input').eq(3).val(data['RC_Rate'][2]);
        $('tr.yaw input').eq(4).val(data['RPY_Expo'][2]);
        $('tr.yaw input').eq(5).val(data['RPY_Curve'][2]);
        for (var i = 0; i < 6; i++) {
            $('tr.yaw input').eq(i).on('input', function () {
                contentChange();
            });
        }

        //TPA
        /*$('tr.TPA input').eq(0).val(data['TPA'][0]);
        $('tr.TPA input').eq(1).val(data['TPA'][1]);
        $('tr.TPA input').eq(2).val(data['TPA'][2]);
        for (var i = 0; i < 3; i++) {
            $('tr.TPA input').eq(i).on('input', function () {
                contentChange();
            });
        }*/

        // level
        $('tr.level input').eq(0).val(data['A_P']);
        $('tr.level input').eq(1).val(data['A_I']);
        $('tr.level input').eq(2).val(data['A_D']);
        $('tr.level input').eq(3).val(Math.round(data['maxAng']));


  		if (data['ver'] >= 145) {  // todo and althold on a switch
   			// altHold
        	$('tr.altHold input').eq(0).val(data['AH_P']);
        	$('tr.altHold input').eq(1).val(data['AH_I']);
        	$('tr.altHold input').eq(2).val(data['AH_D']);
		}
		
		
		if (isLevelPidsVisible(data)) {
			$(".level").show();
		} else {
			$(".level").hide();
		}

        for (var i = 0; i < 4; i++) {
            $('tr.level input').eq(i).on('input', function () {
                contentChange();
            });
        }

        $("#aux0").kissAux({
            name: $.i18n("column.arm"),
            help: 'arm',
            change: function () { contentChange(); },
            value: data['AUX'][0]
        });
        $("#aux1").kissAux({
            name: $.i18n("column.level"),
            help: 'level',
            change: function () { updateLevelModePids(); contentChange(); },
            value: data['AUX'][1]
        });
        $("#aux2").kissAux({
            name: $.i18n("column.buzzer"),
            help: 'buzzer',
            change: function () { contentChange(); },
            value: data['AUX'][2]
        });
        $("#aux3").kissAux({
            name: $.i18n("column.aux.led-color"),
            help: 'led',
            change: function () { contentChange(); },
            knob: true,
            value: data['AUX'][3]
        });
      

        $("#aux5").kissAux({
            name: $.i18n("column.vtx-power"),
            help: 'vtxPower',
            change: function () { contentChange(); },
            knob: true,
            value: data['AUX'][5]
        });

        $("#aux6").kissAux({
            name: $.i18n("column.vtx-band"),
            help: 'vtxBand',
            change: function () { contentChange(); },
            value: data['AUX'][6]
        });

        $("#aux7").kissAux({
            name: $.i18n("column.vtx-channel"),
            help: 'vtxChannel',
            change: function () { contentChange(); },
            value: data['AUX'][7]
        });


            $("#aux8").kissAux({
                name: $.i18n("column.turtle-mode"),
                help: 'turtle',
                change: function () { contentChange(); },
                value: data['AUX'][8]
            }).show();
            
            if (outputMode < 3) {
                $("#aux8").hide();
            }
     

            $("#aux9").kissAux({
                name: $.i18n("column.runcam-split"),
                help: 'runcam',
                change: function () { contentChange(); },
                value: data['AUX'][9]
            });
            
            $("#aux10").kissAux({
                name: $.i18n("column.aux.led-brightness"),
                help: 'ledBrightness',
                change: function () { contentChange(); },
                value: data['AUX'][10],
                knob: true
            });


			if (data['ver'] >= 145) {
  				$("#aux4").kissAux({
            		name: $.i18n("column.altHold"),
            		help: 'altHold',
            		change: function () { 
					updateLevelModePids();
					if (+$("#aux4").find('select').first().val() == 0) {
            			$(".altHold").hide();
            		} else {
            			$(".altHold").show();
            		}
            
					contentChange(); 
						
					},
            		value: data['AUX'][4]
        		});
        		if ((+data['AUX'][4] >> 4) == 0) {
					$(".altHold").hide();
				} else {
					$(".altHold").show();
				}
				if (+data['ESConeshot125'] != 8) {
					$("#fastTelemetry").show();
				} else {
					$("#fastTelemetry").hide();
				}
        	} else {
				$("#aux4").hide();
				$(".altHold").hide();
				$("#fastTelemetry").hide();
			}

            $("#aux13").kissAux({
                name: $.i18n("column.rth"),
                help: 'rth',
                change: function () { updateLevelModePids(); contentChange(); },
                value: data['AUX'][13]
            });
            
            
            
            if (data['ver'] >= 132) {
            	$("#aux14").kissAux({
            		name: $.i18n("column.prearm"),
            		help: 'prearm',
            		change: function () { contentChange(); },
            		value: data['AUX'][14]
            	});

            	$("#aux14").show();
            	
            	if (data['ver'] >= 134) {
            		$("#aux14").find('select').on('change', function() {
            			if (+$(this).val() == 0) {
            				$("#prearm_mode_row").hide();
            			} else {
            				$("#prearm_mode_row").show();
            			}
            		});
            		if (+$("#aux14").find('select').val() != 0) {
            			$("#prearm_mode_row").show();
            		}
            		
            		$('#prearm_mode').val(+data['prearm_mode']);
            		
            		$('#prearm_mode').on('change', function () {
                     	contentChange();
                    });
            	}
            	
            	if (data['ver'] >= 135) {
            		$("#aux0").append(" &nbsp;<input id='softarm_mode' class='unsafe' type='checkbox' data-help='softArm,top'/> <span class='softarm_mode' data-i18n='column.softarm-mode'>Soft</span>");
            		
            		$('#softarm_mode').prop('checked', data['softarm_mode']);
            		
            		$('#softarm_mode').on('change', function () {
                     	contentChange();
                    });
            	}
            } else {
            	$("#aux14").hide();
            }
            
            // inflight tuning
            if (data['ver'] >= 136) { 
            	$("#aux11").kissAux({
            		name: $.i18n("column.inflight.action"),
            		help: 'inflightAction',
            		change: function () { contentChange(); },
            		value: data['AUX'][11]
            	});

            	$("#aux11").show();
            	
            	$("#aux12").kissAux({
            		name: $.i18n("column.inflight.value"),
            		help: 'inflightValue',
            		change: function () { contentChange(); },
            		knobOnly: true,
            		value: data['AUX'][12]
            	});

            	$("#aux12").show();
            } else {
            	$("#aux11").hide();
            	$("#aux12").hide();
            }
            
              if (data['ver'] >= 141) { 
            	$("input[name='rxCenter']").val(data['rxCenter']);
            	$("#rxCenter").show().on('change', function () {
                 	contentChange();
                });
            } else {
            	$("#rxCenter").hide();
            }
          
          
          
          	
          
          $("#aux_functions").on("detect_start", function(event, value) {
			  console.log("Start detection for: " + JSON.stringify(value));
			  openAUXWizard(value.funcId, value.funcName, 0);
		  });
    

        // Temp fix
        if (typeof androidOTGSerial !== 'undefined') {
            $('#backup').hide();
            $('#restore').hide();
        }

//        if (data.lipoConnected == 1) {
//            $(".unsafe").addClass("unsafe_active");
//        } else {
//            $(".unsafe").removeClass("unsafe_active");
//        }
        
        GUI.processLipo(data.lipoConnected);
   
        // Begin Custom ESC Orientation


            $('select[name="ESCOutputLayout"]').val(data['ESCOutputLayout']);

            if (data['CopterType'] == 1 || data['CopterType'] == 2) {
                $('select[name="ESCOutputLayout"]').removeAttr("disabled");
                $('select[name="ESCOutputLayout"]').val(data['ESCOutputLayout']);
            } else {
                $('select[name="ESCOutputLayout"]').prop('disabled', 'true');
                $('select[name="ESCOutputLayout"]').val(0);
            }

            $('select[name="ESCOutputLayout"]').on('change', function () {
                contentChange();
                self.UpdateMixerImage(data['CopterType'], parseInt($('select[name="ESCOutputLayout"]').val()), data['reverseMotors']);
            })
            
            
            
            if (data['ver'] >= 129) {
            	$('#gimbalPTMode').val(data['gimbalPTMode'] & 0x0f);
            	
            	if (data['ver'] >= 143) {
            		if (+$('#gimbalPTMode').val() > 0) {
						$("#channelOrder").val(1).hide();
					}
				}
            	
            	$('#gimbalPTMode').on('change', function () {
					if (data['ver'] >= 143) {
						if (+$('#gimbalPTMode').val() > 0) {
							$("#channelOrder").val(1).hide();
						} else {
							$("#channelOrder").val(0).show();
						}
					}					
                    contentChange();
                });
            
            	if ($('#rxType').val() == 17)  {
            			$('#gimbalPTMode').show();
            	}
            	
            	$('input[name="throttleScaling"]').prop('checked', data['throttleScaling']);
            	$('.scaling').show();
            	            	
            	if (data['MinCommand16'] == 1000) {
            		$("input[name='throttleScaling']").prop("disabled", false);
            	} else {
            		$("input[name='throttleScaling']").prop("disabled", true);
            	}
            	
            } else {
            	$('.scaling').hide();
            }
            
            if (data['ver'] >= 143) {
			    $('#channelOrder').val((data['gimbalPTMode'] >> 4) & 0x0f);
			    
			    if (+$("#rxType").val() == 17) {
			    	if (+$('#gimbalPTMode').val() > 0) {
						$("#channelOrder").hide();
					} else {
						$("#channelOrder").show();
					}
				} else {
					$("#channelOrder").show();
				}
				
            	
            	$('#channelOrder').on('change', function () {
                    contentChange();
                });
			}
            
            
            if (data['ver'] >= 145) {
				var lm = data['ledMode'];
				if (lm == 0) {
					$("#aux3").show();
				} else {
					$("#aux3").hide();
				}
			}
            
            
       $(".unsafe_active").prop('disabled', true);
       
       if (data['ver'] >= 137) { 
    	    $("#wizard-intro").show();
       		$("#motor-wizard-button").show();
       		self.checkMotorWizard();
       } else {
    	    $("#wizard-intro").hide();
       		$("#motor-wizard-button").hide();
       }

        // END Custom ESC Orientation
        
        console.log("===");
        console.log(data);
        
        if (data['ver'] > MAX_CONFIG_VERSION) {
            $("#navigation").hide();
            $("#gui_version_mismatch").html("The version of your KISS Ultra Firmware is <b>NEWER</b> than GUI can handle.<br><br>Please visit download page and upgrade your GUI.<br><br><br>");
            $("#gui_version_mismatch").kissWarning({
            	href:"https://github.com/KissUltra/gui/releases",
            	button: 'Open download page',
            	target: '_blank',
            	action: function() {
            		$("a.connect").click(); // disconnect
            	}
            });
            $("#gui_version_mismatch").show();
        } else if (data['ver'] < MIN_CONFIG_VERSION) {
            $("#navigation").hide();
            $("#gui_version_mismatch").html("The version of your KISS Ultra Firmware is <b>OLDER</b> than GUI can handle.<br><br>Please visit download page and downgrade your GUI.<br><br><br>");
            $("#gui_version_mismatch").kissWarning({
            	href:"https://github.com/KissUltra/gui/releases",
            	button: 'Open download page',
            	target: '_blank',
            	action: function() {
            		$("a.connect").click(); // disconnect
            	}
            });
            $("#gui_version_mismatch").show();
        } else if (!data['isActive']) {
            $("#navigation").hide();

            $("#activation").kissWarning({
                title: $.i18n("title.warning"),
                button: $.i18n("button.activate"),
                action: function () {
                    // Activation procedure
                    $(".button", "#activation").hide();
                    $.ajax({
                        url: getProxyURL('http://ultraesc.de/KISSFC/getActivation/index.php?SN=' + MCUid + '&VER=' + data['ver']),
                        cache: false,
                        dataType: "text",
                        success: function (key) {
                            console.log('Got activation code ' + key);
                            data['actKey'] = parseInt(key);
                            kissProtocol.send(kissProtocol.SET_SETTINGS, kissProtocol.preparePacket(kissProtocol.SET_SETTINGS, kissProtocol.data[kissProtocol.GET_SETTINGS]));
                            kissProtocol.send(kissProtocol.GET_SETTINGS, [kissProtocol.GET_SETTINGS], function () {
                            	GUI.load("./content/configuration.html", function () {
                                    htmlLoaded(kissProtocol.data[kissProtocol.GET_SETTINGS]);
                                    updateInfo();
                                });
                            });
                        },
                        error: function () {
                            $(".button", "#activation").show();
                            console.log('getting activation code failed');
                            data['actKey'] = 0;
                            $(".button", "#activation").text($.i18n("button.activation-failed"));
                        }
                    });
                }
            });
            $("#activation").show();
            $('#SN2').on('click', function (e) {
                copyTextToClipboard(MCUid);
                $('#SN2text').text($.i18n("text.serial-clipboard"));
                setTimeout(function () {
                    $('#SN2text').text("");
                }, 1000);
            });

        }  else if (isLegacyDefaults(data) && !CONTENT.configuration.legacyChecked) {
        	
        	$("#navigation").show();
        	self.eeprom = data['ver'];
        	self.needsMigration = true;
        	
        	checkMigration();
        	
        
			
        } else {
            $("#navigation").show();
        }

        function grabData() {
        	data['kissultra'] = true;
        	
            // uav type and receiver
            data['CopterType'] = parseInt($('select.mixer').val());
            data['RXType'] = parseInt($('#rxType').val());

            // general settings
            data['MinThrottle16'] = parseInt($('input[name="minThrottle"]').val());
            data['MaxThrottle16'] = parseInt($('input[name="maxThrottle"]').val());
            data['MinCommand16'] = parseInt($('input[name="minCommand"]').val());
            data['MidCommand16'] = parseInt($('input[name="midCommand"]').val());
            data['TYmid16'] = parseInt($('input[name="TYmid"]').val());
            data['TYinv8'] = parseInt($('input[name="TYinv"]').prop('checked') ? 1 : 0);

            var outputMode = 0;

            outputMode = parseInt($('select[name="outputMode"]').val());
            data['ESConeshot125'] = outputMode;
            data['ESConeshot42'] = 0;

            data['Active3DMode'] = parseInt($('input[name="3dMode"]').prop('checked') ? 1 : 0);
            if (data['CopterType'] == 7 || data['CopterType'] == 8) data['Active3DMode'] = 0;
            data['failsaveseconds'] = parseInt($('input[name="failsaveseconds"]').val());
            data['BoardRotation'] = 0;

            // pid and rates
            // roll
            data['G_P'][0] = parseFloat($('tr.roll input').eq(0).val());
            data['G_I'][0] = parseFloat($('tr.roll input').eq(1).val());
            data['G_D'][0] = parseFloat($('tr.roll input').eq(2).val());
            data['RC_Rate'][0] = parseFloat($('tr.roll input').eq(3).val());
            data['RPY_Expo'][0] = parseFloat($('tr.roll input').eq(4).val());
            data['RPY_Curve'][0] = parseFloat($('tr.roll input').eq(5).val());

            // pitch
            data['G_P'][1] = parseFloat($('tr.pitch input').eq(0).val());
            data['G_I'][1] = parseFloat($('tr.pitch input').eq(1).val());
            data['G_D'][1] = parseFloat($('tr.pitch input').eq(2).val());
            data['RC_Rate'][1] = parseFloat($('tr.pitch input').eq(3).val());
            data['RPY_Expo'][1] = parseFloat($('tr.pitch input').eq(4).val());
            data['RPY_Curve'][1] = parseFloat($('tr.pitch input').eq(5).val());

            // yaw
            data['G_P'][2] = parseFloat($('tr.yaw input').eq(0).val());
            data['G_I'][2] = parseFloat($('tr.yaw input').eq(1).val());
            data['G_D'][2] = parseFloat($('tr.yaw input').eq(2).val());
            data['RC_Rate'][2] = parseFloat($('tr.yaw input').eq(3).val());
            data['RPY_Expo'][2] = parseFloat($('tr.yaw input').eq(4).val());
            data['RPY_Curve'][2] = parseFloat($('tr.yaw input').eq(5).val());

            // TPA
            /*data['TPA'][0] = parseFloat($('tr.TPA input').eq(0).val());
            data['TPA'][1] = parseFloat($('tr.TPA input').eq(1).val());
            data['TPA'][2] = parseFloat($('tr.TPA input').eq(2).val());*/

            // level
            data['A_P'] = parseFloat($('tr.level input').eq(0).val());
            data['A_I'] = parseFloat($('tr.level input').eq(1).val());
            data['A_D'] = parseFloat($('tr.level input').eq(2).val());
            data['maxAng'] = parseFloat($('tr.level input').eq(3).val());

            data['AUX'][0] = $("#aux0").kissAux('value');
            data['AUX'][1] = $("#aux1").kissAux('value');
            data['AUX'][2] = $("#aux2").kissAux('value');
            data['AUX'][3] = $("#aux3").kissAux('value');
            data['AUX'][5] = $("#aux5").kissAux('value');
            data['AUX'][6] = $("#aux6").kissAux('value');
            data['AUX'][7] = $("#aux7").kissAux('value');

            if (data['ver'] > 108) {
                data['AUX'][8] = $("#aux8").kissAux('value');
            }

            if (data['ver'] > 109) {
                data['AUX'][9] = $("#aux9").kissAux('value');
                data['AUX'][10] = $("#aux10").kissAux('value');
            }

          
            if (data['ver'] >= 113) {
                data['ESCOutputLayout'] = parseInt($('select[name="ESCOutputLayout"]').val());
                console.log('Store ESCOutputLayout:' + data['ESCOutputLayout']);
            }

            if (data['ver'] >= 121) {
                data['AUX'][13] = $("#aux13").kissAux('value');
            }
            
            if (data['ver'] >= 129) {
                data['throttleScaling'] = +$("input[name='throttleScaling']").prop('checked') ? 1 : 0;
                data['gimbalPTMode'] = +$('#gimbalPTMode').val() & 0x0f;
            }
        
            if (data['ver'] >= 132) {
                data['AUX'][14] = $("#aux14").kissAux('value');
            }
            
            if (data['ver'] >= 134) {
                data['prearm_mode'] = +$("#prearm_mode").val();
            }
            
            if (data['ver'] >= 135) {
                data['softarm_mode'] = +$("#softarm_mode").prop('checked') ? 1 : 0;
            }
            
            if (data['ver'] >= 136) {
        	  data['AUX'][11] = $("#aux11").kissAux('value');
        	  data['AUX'][12] = $("#aux12").kissAux('value');
            }
            
            if (data['ver'] >= 141) {
            	 data['rxCenter'] = parseInt($('input[name="rxCenter"]').val());
            }
            
            if (data['ver'] >= 143) {
                data['gimbalPTMode'] |= ((+$('#channelOrder').val() << 4) & 0xf0);
            }
            
            if (data['ver'] >= 145) {
				data['AUX'][4] = $("#aux4").kissAux('value');
                data['AH_P'] = parseFloat($('tr.altHold input').eq(0).val());
            	data['AH_I'] = parseFloat($('tr.altHold input').eq(1).val());
            	data['AH_D'] = parseFloat($('tr.altHold input').eq(2).val());
            	data["fastTelemetry"] = +$("input[name='fastTelemetry']").prop('checked') ? 1 : 0;
            }
        }
        settingsFilled = 1;

        function contentChange() {
            $('#save').removeAttr("data-i18n");
            $('#save').attr('data-i18n', 'button.save');
            $('#save').text($.i18n("button.save"));
            if (settingsFilled) {
                $('#save').addClass("saveAct");
            }
            self.checkMotorWizard();
        }
        
        function processBackupRestore(fc, osd, callback) {
			if (fc) {
				// save fc, and if saved save osd		
				GUI.load("./content/configuration.html", function () {
        			var v = +kissProtocol.data[kissProtocol.GET_SETTINGS]['ver'];
        			var tmp = $.extend({}, kissProtocol.data[kissProtocol.GET_SETTINGS], self.restore.fc);
        			tmp.ver = v; // fix version to one we get from FCs
        			kissProtocol.data[kissProtocol.GET_SETTINGS] = tmp;
        			htmlLoaded(kissProtocol.data[kissProtocol.GET_SETTINGS]);
        			updateInfo();
        			console.log("Saving FC...");
        			$('#save').click();
        			contentChange();
        			
        			if (osd) {
						console.log("Saving OSD...");
						kissProtocol.sendChunked(kissProtocol.SET_OSD_CONFIG, self.restore.osd, 0,  function() {
							console.log("OSD saved complete!");
							callback();
						});
					} else {
						callback();
					}
        		});		
			} else {
				if (osd) {
					console.log("Saving OSD...");
					kissProtocol.sendChunked(kissProtocol.SET_OSD_CONFIG, self.restore.osd, 0,  function() {
						console.log("OSD saved complete!");
						callback();
					});
				}
			}
		}
        
		function closeRestoreWizard() {
			console.log("Closing restore wizard");
			$(".modal-overlay").off("click");
			$(".modal-overlay").hide();
			$(".restore-wizard").hide();
			$(".restore-wizard-inner").kissWizard("destroy");
		}
        
		function openRestoreWizard() {

			var steps = [{
				'template': 'restore-wizard-welcome-template',
				'type': 'welcome',
				'dataProvider': {
					'config': self.restore
				},
				'preload': function(plugin, step) {
					
				},
				'postload': function(plugin, step) {

					if (self.restore.fc !== undefined) {
						$("#restore-fc").prop("checked", true).removeAttr("disabled");
					} else {
						$("#restore-fc").prop("checked", false).attr("disabled", "disabled");
					}
					if (self.restore.osd !== undefined) {
						$("#restore-osd").prop("checked", true).removeAttr("disabled");
					} else {
						$("#restore-osd").prop("checked", false).attr("disabled", "disabled");
					}
					
					if ($("#restore-fc").is(":checked") || $("#restore-osd").is(":checked")) {
						$(".wizard-button-restore").removeClass("wizard-button-disabled");
					} else {
						$(".wizard-button-restore").addClass("wizard-button-disabled");
					}
				
					$(".restore_checkbox").on("change", function() {
						console.log("checkbock changed");
						if ($("#restore-fc").is(":checked") || $("#restore-osd").is(":checked")) {
							$(".wizard-button-restore").removeClass("wizard-button-disabled");
						} else {
							$(".wizard-button-restore").addClass("wizard-button-disabled");
						}
					});
				
					$(".wizard-button-cancel").click(function() {
						closeRestoreWizard();
					});

					$(".wizard-button-restore").click(function() {
						if (!$(".wizard-button-restore").hasClass("wizard-button-disabled")) {
							console.log("Restoring backup");
							$(".wizard-button-restore").addClass("wizard-button-disabled");
							processBackupRestore($("#restore-fc").is(":checked"), $("#restore-osd").is(":checked"), function() {
								closeRestoreWizard();
							});
						}
					});
				}
			}];

			$(".restore-wizard-inner").kissWizard({
				'buttonsTemplate': 'restore-wizard-buttons-template',
				'headerTemplate': 'restore-wizard-header-template',
				steps: steps,
				name: "Restore wizard",
				currentStep: 0
			});

			$(".modal-overlay").show();
			$(".restore-wizard").show();

		
			$(".modal-overlay").click(function() {
				closeRestoreWizard();
			});
		}
        
        
        function processRestore(json) {
			console.log("Restoring json: " + JSON.stringify(json));
			
			if (json.kissultraosd !== undefined || json.kissultra !== undefined || json.osd !== undefined || json.fc !== undefined) {
				// good backup
				if (json.kissultra !== undefined) {
					console.log("restore ultra backup");
					self.restore =  { "fc" : json };
				} else if (json.kissultraosd !== undefined) {
					console.log("restore osd backup");
					self.restore =  { "osd" : json };
				} else {
					console.log("restore full backup");
					self.restore = json;
				}

				openRestoreWizard();
			
				return;

			} else {
				console.log("Invalid kiss backup detected!");
				$(".modal-overlay").off('click');
				$(".modal-overlay").on('click', function() {
					hideModal();
				});
				$(".modal-body").html("<p class='header'>This backup is not valid.</p>For safety reasons, importing is prohibited.");
				$(".modal-footer").html("");
				$(".modal-overlay").show();
				$(".modal").show();
				return;
			}
		}
        

        function handleFileSelect(evt) {
        	var files = evt.target.files; 
        	for (var i = 0, f; f = files[i]; i++) {
        		var reader = new FileReader();
        		reader.onload = (function(theFile) {
        			return function(e) {
        				processRestore(JSON.parse(e.target.result));
        			};
        		})(f);
        		reader.readAsText(f);
        	}
        }

       var url = isNative() ? 'https://kiss-ultra.com/presets.json' : '/presets.json';
        $.ajax({
            url: url,
            cache: true,
            dataType: 'json',
            success: function (pdata) {
                console.log('presetPIDs request success');
                console.log(pdata);
                self.PRESETS = pdata;
           	 	var presets = $('#presets');
           	 	presets.append('<option value="">User settings</option>');
                $.each(pdata, function(key, value) {
                	
                	var selected = '';
                	
                	if ((+data['G_P'][0] == value.roll.p) &&
                    		(+data['G_P'][1] == value.pitch.p) &&
                    		(+data['G_P'][2] == value.yaw.p) &&
                    		(+data['G_I'][0] == value.roll.i) &&
                    		(+data['G_I'][1] == value.pitch.i) &&
                    		(+data['G_I'][2] == value.yaw.i) &&
                    		(+data['G_D'][0] == value.roll.d) &&
                    		(+data['G_D'][1] == value.pitch.d) &&
                    		(+data['G_D'][2] == value.yaw.d) ) {
                		selected = 'selected';
                	}
                	
                	 presets.append('<option value="' + key + '" ' + selected + '>' + value.name + '</option>');
                });
                $('.presets').show();
                checkMigration();
            },
            error: function () {
                console.log('presetPIDs request failed');
                $('.presets').hide();
            }

        });

        if (!data['isActive']) {
            $.ajax({
                url: getProxyURL('http://ultraesc.de/KISSFC/getActivation/index.php?SN=' + MCUid + '&VER=' + data['ver']),
                cache: false,
                dataType: "text",
                success: function (key) {
                    console.log('Got activation code ' + key);
                    data['actKey'] = parseInt(key);
                },
                error: function () {
                    console.log('getting activation code failed');
                    data['actKey'] = 0;
                }

            });
        }
        
        $('#prePID').change(function () {
            if (document.getElementById('prePID').value == 'preset') {
                document.getElementById('userSel').style.display = 'none';
                document.getElementById('presetSel').style.display = 'inline-block';
                if (document.getElementById('presetSel').value == 'Preset1') {
                    shareButton.innerHTML = 'share';
                }
            } else {
                document.getElementById('presetSel').style.display = 'none';
                document.getElementById('userSel').style.display = 'inline-block';
                shareButton.innerHTML = 'Use';
            }
        });
        $('#presetSel').change(function () {
            if (document.getElementById('presetSel').value == 'Preset1') {
                shareButton.innerHTML = 'share';
            } else {
                shareButton.innerHTML = 'use';
            }
        });
        $('#userSel').change(function () {
            shareButton.innerHTML = 'use';
        });
        
        $(".warning-button").on("click", function () {
            $("#restore-disclaimer").hide();
        });
       
		$('#save').on('click', function() {
			if (!$(this).hasClass("disabled")) {
				console.log("Save clicked");
				grabData();
				$('#save').removeClass("saveAct");
				$('#save').html($.i18n("button.saving"));
				kissProtocol.send(kissProtocol.SET_SETTINGS, kissProtocol.preparePacket(kissProtocol.SET_SETTINGS, kissProtocol.data[kissProtocol.GET_SETTINGS]));
				kissProtocol.send(kissProtocol.GET_SETTINGS, [kissProtocol.GET_SETTINGS], function() {
					GUI.load("./content/configuration.html", function() {
						htmlLoaded(kissProtocol.data[kissProtocol.GET_SETTINGS]);
						updateInfo();
						$('#save').removeAttr("data-i18n");
						$('#save').attr('data-i18n', 'button.saved');

					});
				});
			}
		});

		$('#backup').on('click', function() {
			if (!$(this).hasClass("disabled")) {
				grabData();
				backupConfig();
			}
		});

		$('#restore').on('click', function() {
			if (!$(this).hasClass("disabled")) {
				if (isNative()) {
					restoreConfig(function(config) {
						processRestore(config);
					});
				} else {
					document.getElementById('files').files = new DataTransfer().files;
					$("#files").click();
				}
			}
		});
        
        if (!isNative()) {
            document.getElementById('files').addEventListener('change', handleFileSelect, false);
        }
        
        $("#motor-wizard-button").click(function() {
        	if (!$(this).hasClass("motor-wizard-button-disabled")) {
        		openMotorWizard(1, 0);
        	}
        });
        
        $("#rec-wizard-button").click(function() {
        		openRECWizard(0);
        });
        
        scrollTop();
    }
};

CONTENT.configuration.cleanup = function (callback) {
	if (self.hwTimeout != 0) window.clearTimeout(self.hwTimeout);
	if (self.telemetryTimeout != 0) window.clearTimeout(self.telemetryTimeout);
	
	$(window).off('resize', this.barResize);

	    if (this.motorWizardEnabled) {
			kissProtocol.removePendingRequests();
	        console.log("For safety reasons, turning off the motors");
	        var tmp = {
	            'buffer': new ArrayBuffer(9),
	            'motorTestEnabled': 0,
	            'motorTest': [0, 0, 0, 0, 0, 0, 0, 0]
	        };
	        kissProtocol.send(kissProtocol.MOTOR_TEST, kissProtocol.preparePacket(kissProtocol.MOTOR_TEST, tmp), function() {
				console.log("Motors turned off");
				this.motorWizardEnabled = false;
				if (callback) callback();
			});
	    } else {
			 if (callback) callback();
		}
};