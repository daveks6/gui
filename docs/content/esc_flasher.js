'use strict';

CONTENT.esc_flasher = {

};

var escFirmwares = [];
var escFirmwareMap = {};
var escDetected = "";

CONTENT.esc_flasher.initialize = function (callback) {
    var self = this;

    self.pages = [];
    self.flasherAvailable = false;
    self.pollEscInfo = false;
    
    self.escInfoCounter = 0;

    GUI.switchContent('esc_flasher', function () {
        GUI.load("./content/esc_flasher.html", htmlLoaded);
    });

    function Write(data) {
        var bufferOut = new ArrayBuffer(data.length);
        var bufferView = new Uint8Array(bufferOut);
        bufferView.set(data, 0);
        serialDevice.send(bufferOut, function (a) {

        });
    }

    function Read(info) {
        if (info.data.byteLength > 0) {
            var view = new Uint8Array(info.data);
            self.flasherAvailable = (view[0] == 65);
        }
    }

    function WritePage(actPage) {
        if (actPage < 0) {
            var startApp = [83, 83, 83];
            Write(startApp);
            console.log('done.');
            $("#status").html($.i18n("text.esc-flasher-success"));
            $("#esc-flasher-complete").show();
            serialDevice.disconnect();
            return;
        } else {
            var percentage = 100 - 100 * (actPage / self.pages.length);
            $("#status").html($.i18n("text.esc-flasher-progress", Math.floor(percentage + 0.5)));
            $("#progress").css("width", "calc(5px + "+percentage+"%)").show();
            console.log('Sending block ' + (actPage + 1));
            Write(self.pages[actPage]);
            var timeout = (actPage == (self.pages.length - 1) ? 3000 : 100);
            setTimeout(function () { WritePage(actPage - 1); }, timeout);
        }
    }

    function contentChange() {
        //$('#save').addClass("ui-info-");
    }

    function pollEscInfo() {
        if (self.pollEscInfo) {
            $("#escInfoDiv").show();

            console.log("REQUEST INFO");
            kissProtocol.send(kissProtocol.GET_INFO, [kissProtocol.GET_INFO], function () {
                var info = kissProtocol.data[kissProtocol.GET_INFO];
                
                console.log("GOT INFO");
                console.log(JSON.stringify(info));
                var found = 0;
				try {
					$("#escInfo").empty();
					if (info['escInfoCount'] === undefined || info['escInfoCount'] == 0) {
						self.pollEscInfo = false;
					} else {
						$("#escInfoDiv").show();
						for (var i = 0; i < info.escInfoCount; i++) {
							if (info.escInfo[i] !== undefined) {
								if (escDetected == "") {
									escDetected = info.escInfo[i].type.replace(/\s/g, '').toUpperCase().trim();
									console.log("Esc: " + escDetected);
								}
								var li = $("<li/>").html((i + 1) + ": " + info.escInfo[i].fullType + " " + info.escInfo[i].version + " " + $.i18n("text.sn") + " " + info.escInfo[i].SN);

								if (info.escInfo[i].type == 'ULTRAESC') {
									$("#advanced_config").show();
								}

								if (info.escInfo[i].type == 'BLHELI32') {
									$("#select_file,#download_file").hide();
									$("#status").html("Please use BLHeli Suite to flash these ESC.");
									$("#progress").hide();
									$("#escSettingsDiv").hide();
								} else {
									$("#escSettingsDiv").show();
								}
								
								$("#save").removeClass("u-button-red");
									
								found++;
							} else {
								var li = $("<li/>").html((i + 1) + ": --");
							}
							$("#escInfo").append(li);

							$(".escSettings tbody tr:nth-child(" + (i + 1) + ")").show();
							if (info.escInfo[i] !== undefined) {
								$(".direction").eq(i).prop("checked", (info.escInfo[i].Settings[0] == 1)).removeAttr("disabled");	
							}
						}
						
						if (found < info.escInfoCount) {
							console.log("Found " + found + " escs from " + info.escInfoCount);
							self.escInfoCounter++;
							var data = kissProtocol.data[kissProtocol.GET_SETTINGS];
							if (self.escInfoCounter < 5) {
								// retry
								setTimeout(function() {
									console.log("Retrying " + self.escInfoCounter);
                    				kissProtocol.send(kissProtocol.ESC_INFO, [kissProtocol.ESC_INFO], function () { self.pollEscInfo = true; pollEscInfo(); } );
                    			}, 500);
							}
						}
					}
				} catch (e) {
					console.log("Error occured");
					console.log(e);
				}
            });
        }

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

                        self.pages = parseBootloaderHexFile(intel_hex);

                        if (self.pages !== undefined) {
                            console.log("HEX OS OK " + self.pages.length + " blocks loaded");
                            $("#file_info").html($.i18n("text.esc-flasher-loaded", self.pages.length, theFile.name));
                            $("#flashp").show();
                        } else {
                            console.log("Corrupted esc firmware file");
                            $("#file_info").html($.i18n("text.esc-flasher-invalid-firmware"));
                            $("#flashp").hide();
                        }
                    }
    			};
    		})(f);
    		reader.readAsText(f);

    	}
    }
    

 	function fastDataPoll(callback) {
		 var tmp = { command: 1 };
		 console.log("Sending resque command");
	     kissProtocol.send(kissProtocol.ESC_RESQUE_MODE, kissProtocol.preparePacket(kissProtocol.ESC_RESQUE_MODE, tmp), function () {
            var data = kissProtocol.data[kissProtocol.ESC_RESQUE_MODE];
            var volts = data['LiPoVolt'] * 10;
            console.log("Voltage " + volts);
            if (volts > 6) {
				callback();
			} else {
				window.setTimeout(function () { fastDataPoll(callback); }, 10);
			}
         });
	}

    function htmlLoaded() {
    	
        $("#dont-tab").hide();
        
        self.escInfoCounter = 0;
        
        var data = kissProtocol.data[kissProtocol.GET_SETTINGS];
        if (data.lipoConnected == 1) {
         	$("#rescue").hide();
            $("#escInfoDiv").show();
        }
        
        if (+kissProtocol.data[kissProtocol.GET_SETTINGS]['ver'] < 146) {
			$("#rescue").hide();
		}
        
        if (!isNative()) {
            document.getElementById('escfiles').addEventListener('change', handleFileSelect, false);
        }

        var selectedPort = String($('#port').val());

        if ((selectedPort == KISSFC_WIFI) || (selectedPort == ANDROID_OTG_SERIAL)) {
            $("#select_file").hide();
        }

        $(".warning-button").on("click", function () {
            kissProtocol.send(kissProtocol.GET_SETTINGS, [kissProtocol.GET_SETTINGS], function () {
                $("#esc-flasher-disclaimer").hide();
                var data = kissProtocol.data[kissProtocol.GET_SETTINGS];
                $("#escInfo").empty();
                if (data.lipoConnected == 1) {
                    kissProtocol.send(kissProtocol.ESC_INFO, [kissProtocol.ESC_INFO], function () { self.pollEscInfo = true; pollEscInfo(); } );
                }
            });
        });
        
        $("#advanced_config").on("click", function() {
			CONTENT.uesc_config.initialize(function() {
				console.log("Switching active content to " + newContent);
			});
		});
		
	
		$("[type=checkbox").on("change", function() {
			$("#save").addClass("u-button-red");
		});
        
        // disable all
        $(".direction").attr("disabled", "disabled");
		$(".3d").attr("disabled", "disabled");

        $("#esc-flasher-disclaimer").show();

        $("#fw_version").on("change", function () {
            var asset = escFirmwareMap[$("#fc_type").val()][$(this).val()];
            $("#fw_notes").text(asset.info);
            $("#file_info").html("");
            $("#flashp").hide();
            $("#status").hide();
            $("#progress").hide();
        });
        
        $("#esc_reload").on("click", function() {
			if (!$(this).hasClass("disabled")) {
			 	self.escInfoCounter = 0;
             	$("#escInfo").empty();
             	$("#save").removeClass("u-button-red");
             	kissProtocol.send(kissProtocol.ESC_INFO, [kissProtocol.ESC_INFO], function () { 
					 self.pollEscInfo = true; 
					 pollEscInfo(); 
             		
             	} );
             }
		});

        $("#fc_type").on("change", function () {
            if ($(this).val() != null) {
                console.log("Change for " + $(this).val());
                var value = escFirmwareMap[$(this).val()];
                console.log(value);
                $("#fw_version").empty();
                $.each(value, function (index, asset) {
                    $("#fw_version").append("<option value='" + index + "'>" + asset.release + " (" + asset.size + " bytes)</option>");
                });
                $("#fw_version").trigger("change");
                $("#file_info").html("");
                $("#flashp").hide();
                $("#status").hide();
                $("#progress").hide();
            };
        });

        $("#download_url").on("click", function () {
            $("#loader2").show();
            var asset = escFirmwareMap[$("#fc_type").val()][$("#fw_version").val()];
            var url = asset.url;
            console.log("Loading " + url);
            $("#file_info").html("");
            $("#flashp").hide();
            $("#status").hide();
            $("#progress").hide();

            $.get(getProxyURL(url), function (intel_hex) {
                console.log("Loaded ESC hex file");
                self.pages = parseBootloaderHexFile(intel_hex);

                $("#loader2").hide();

                if (self.pages !== undefined) {
                    console.log("HEX OS OK " + self.pages.length + " blocks loaded");
                    $("#file_info").html($.i18n("text.esc-flasher-loaded", self.pages.length, url));
                    $("#flashp").show();
                } else {
                    console.log("Corrupted esc firmware file");
                    $("#file_info").html($.i18n("text.esc-flasher-invalid-firmware"));
                    $("#flashp").hide();
                }
            });
        });

        $("#download_file").on("click", function () {
            $("#file_info").html("");
            $("#flashp").hide();
            escFirmwares = [];
            $("#remote_fw").hide();
            $("#loader1").show();
            escFirmwareMap = {};
            $("#fc_type").empty();
			$("#fw_version").empty();
			
			$.when( loadGithubReleases('https://api.github.com/repos/KissUltra/ultraesc/releases'),
				    loadGithubReleases('https://api.github.com/repos/flyduino/kissesc-firmware/releases'), 
					loadGithubReleases('https://api.github.com/repos/voltararc/firmware/releases')).done(
			function (ultraFirmwares, kissFirmwares, voltaraFirmwares) {
				var data = kissFirmwares.concat(voltaraFirmwares).concat(ultraFirmwares);
				const voltaraRegexp = new RegExp('VOLTARA([0-9]{1,2})A');
				const ultraRegexp = new RegExp('ULTRAESC([0-9]{1,2})A');

					$("#loader1").hide();
					console.log(data);
					$("#remote_fw").show();
					$.each(data, function(index, release) {
						console.log("Processing firmware: " + release.name);
						$.each(release.assets, function(index2, asset) {
							if (asset.name.endsWith(".hex")) {
								console.log("Processing asset: " + asset.name);
								var p = asset.name.indexOf("_");
								if (p<0) p = asset.name.indexOf("-");
								var board = asset.name.substr(0, p).toUpperCase().trim();
								if (voltaraRegexp.test(board)) {
									board = "VOLTARA";	// map VOLTARA70A to VOLTARA
								}
								if (ultraRegexp.test(board)) {
									board = "ULTRAESC";	
								}
								
								console.log("Board: " + board);
								
								if (escFirmwareMap[board] == undefined) {
									escFirmwareMap[board] = [];
								}
								var file = {
									release: release.name,
									date: release.created_at,
									url: asset.browser_download_url,
									size: asset.size,
									info: release.body
								}
								escFirmwareMap[board].push(file);
							}
						});
					});
										
					$.each(escFirmwareMap, function(board, assets) {

						console.log("Checking board " + board);

						var add = true;
						if (escDetected != "" && board != escDetected) add = false;
						var escBoardNames = {
							'KISS32A': "Kiss Racing 32A ESC",
							'KISS24A': "Kiss Racing 24A ESC",
							'KISS16A': "Kiss AIOv2 ESC",
							'KISS8A': "Kiss AIOv1 ESC",
							'KISSLOGIC25A': "Kiss Racing 25A ESC (Single + 4in1)",
							'KISSLOCIG25A': "Kiss Racing 25A ESC (Single + 4in1)",
							'KISS25A': "Kiss Racing 25A ESC (Single + 4in1)",
							'KISS50A': "Kiss 50A ESC",
							'VOLTARA': "Voltara ESC",
							'ULTRAESC': "Ultra ESC"
						};
						
						console.log("escDetected: " + escDetected);
						console.log("board: " + board);
						console.log(escFirmwareMap);
						console.log(escBoardNames);
						if (add) $("#fc_type").append("<option value='" + board + "'>" + board + " - " + escBoardNames[board] + "</option>");
					});
					$("#fc_type").trigger("change");
			});
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
        					console.log('Loading esc firmware from: ' + path);
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

        								self.pages = parseBootloaderHexFile(intel_hex);

        								if (self.pages !== undefined) {
        									console.log("HEX OS OK " + self.pages.length + " blocks loaded");
        									$("#file_info").html($.i18n("text.esc-flasher-loaded", self.pages.length, path));
        									$("#flashp").show();
        								} else {
        									console.log("Corrupted esc firmware file");
        									$("#file_info").html($.i18n("text.esc-flasher-invalid-firmware"));
        									$("#flashp").hide();
        								}
        							}
        						};
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
        	        $("#escfiles").val('');
        			$("#escfiles").click();
        		}
        	};
        });


        $("#flash").on("click", function () {
            if (!$(this).hasClass('disabled')) {
                self.pollEscInfo = false;

                $("#status").show().html("");
                $("#progress").hide();
                $("#flash").addClass('disabled');
                $("#select_file").addClass('disabled');
                $("#download_file").addClass('disabled');
                $("#download_url").addClass('disabled');
                $("#esc_reload").addClass('disabled');
                $("#boot").addClass('unsafe').addClass('unsafe_active');
                
                $("#escInfoDiv").hide();
                $("#escSettingsDiv").hide();
                
                
                if (!isNative()) {
                    $("#dont-tab").show();
                }
                
                var inBoot = $("#boot").prop("checked");
                
                self.flasherAvailable = false;
                console.log('Setting Ultra FC to ESC write mode');
                var flasherAvailable = false;
                
                if (inBoot) {
					console.log("Waiting for voltage");
					$("#rescue-tab").show();
					$("#boot").attr("disabled","disabled");
					
					setTimeout(function () { fastDataPoll(
						function() {
							$("#rescue-tab").hide();
							serialDevice.onReceive.addListener(Read);
                			Write([65]);
                			console.log('Waiting for FC');
                			setTimeout(function () {
                    			serialDevice.onReceive.removeListener(Read);
                    			if (self.flasherAvailable) {
                        			console.log("Flasher available, lets flash");
                        			$("#portArea").children().addClass('flashing-in-progress');
                        			$("#menu").hide();
                        			$(".navigation-menu-button").hide(); // hide menu during flashing
                        	
									WritePage(self.pages.length - 1);
                        			                       			
                        			
                    			} else {
                        			console.log('got no answer. check your com port selection and see if you have the lastest KISSFC version.');
                        			$("#status").html("FAILURE: No response from FC!");
                        			$("#progress").hide();
                    			}
                			}, 	250); 
						}
						
					); }, 10);
					
					
					
					
				} else {
                	serialDevice.onReceive.addListener(Read);
                	Write([65]);
                	console.log('Waiting for FC');
                	setTimeout(function () {
                    	serialDevice.onReceive.removeListener(Read);
                    	if (self.flasherAvailable) {
                        	console.log("Flasher available, lets flash");
                        	$("#portArea").children().addClass('flashing-in-progress');
                        	$("#menu").hide();
                        	$(".navigation-menu-button").hide(); // hide menu during flashing
                        	WritePage(self.pages.length - 1);
                    	} else {
                        	console.log('got no answer. check your com port selection and see if you have the lastest Ultra firmware version.');
                        	$("#status").html("FAILURE: No response from FC!");
                        	$("#progress").hide();
                    	}
                	}, 3000); // was 3000
                }
            }
        });

        $("input[type=checkbox]").on("change", function () {
            contentChange();
        })

        if (GUI.activeContent == 'esc_flasher') {
            // TODO: May be give up after 2 * escCount seconds.
            escDetected = "";
            if (data.lipoConnected == 1) { setTimeout(function () { pollEscInfo(); }, 2000) }
        }

        $("#save").on("click", function () {
            var escSettings = [0x10, 0x20, 0x30, 0x40, 0x50, 0x60, 0x70, 0x80]; // Make CS complex
            $(".direction").each(function (motor, elm) {
                escSettings[motor] += $(elm).is(':checked') ? 1 : 0;
            });
            $(".3d").each(function (motor, elm) {
                escSettings[motor] += 0;
            });
            var tmp = {
                'buffer': new ArrayBuffer(8),
                'escSettings': escSettings
            };
            $('#save').removeClass("saveAct");
            kissProtocol.send(kissProtocol.SET_ESC_SETTINGS, kissProtocol.preparePacket(kissProtocol.SET_ESC_SETTINGS, tmp), function() {
				 $("#save").removeClass("u-button-red");
			});
        });
        
        scrollTop();

    };
}

CONTENT.esc_flasher.cleanup = function (callback) {
    if (callback) callback();
};