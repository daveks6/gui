(function($) {
	var PLUGIN_NAME = 'ultra.esc',
        pluginData = function(obj) {
            return obj.data(PLUGIN_NAME);
        };

    var privateMethods = {
    		build : function(self) {
    			var data = pluginData(self);
    			$(self).html("");
    			var c = "<div class='block'>";
					c+="<div class='title' data-i18n='title.general-settings'>"+data.title+"</div>";
					c+="<div class='body'>";
					c+="Loading...";
					c+="</div>";
				var elem = $(c);
    	        $(self).append(elem);
    	        $(self).addClass("ultraesc");
    	        $(self).show();
    		}
    };

    var publicMethods = {
        init : function(options) {
            return this.each(function() {
                var self = $(this),
                    data = pluginData(self);
                if (!data) {
                    self.data(PLUGIN_NAME, $.extend(true, {
                    	title: 'Ultra ESC #',
                    }, options));
                    data = pluginData(self);
                }
                privateMethods.build(self);
            });
        },
        
        disableSave : function () {
			 var self = $(this);
			 $(self).find("[name=save]").addClass("disabled");
		},
		
		enableSave : function () {
			 var self = $(this);
			 $(self).find("[name=save]").removeClass("disabled");
		},
		
		/*
			*(dest++) = config->direction;
		*(dest++) = config->slowStart;
		*(dest++) = config->currentLimit;
		*(dest++) = config->tempLimit;
		*(dest++) = config->currentCalib;
		*(dest++) = config->voltageCalib;
		*(dest++) = config->beeperVolume;
		*(dest++) = config->beaconDelay;
		*(dest++) = config->rampupPower;
		*/
		
		getData : function() {
			 var self = $(this);
			 var data = pluginData(self);
			 var bufferOut = new ArrayBuffer(256);
			 var bufView = new Uint8Array(bufferOut);
			 
			 for (var i=0; i<256; i++) bufView[i] = 0;
			 bufView[0]  = data.esc.config.eeprom;
			 bufView[1]  = +$(self).find("[name=direction]").val();	 
			 bufView[2]  = +$(self).find("[name=slowStart]").val();	
			 bufView[3]  = +$(self).find("[name=currentLimit]").val();
			 bufView[4]  = +$(self).find("[name=tempLimit]").val();
			 bufView[5]  = +$(self).find("[name=currentCalib]").val();
			 bufView[6]  = +$(self).find("[name=voltageCalib]").val();
			 bufView[7]  = +$(self).find("[name=beeperVolume]").val();
			 bufView[8]  = +$(self).find("[name=beaconDelay]").val();
			 bufView[9]  = +$(self).find("[name=rampupPower]").val();
			 
			 return bufferOut;
		},
		
        update : function (escData) {
            var self = $(this);
            var data = pluginData(self);
   
        	var hexChar = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "A", "B", "C", "D", "E", "F"];
        	
        	var MIN_CURRENT = [10]; // minimum allowed
			var MAX_CURRENT = [80]; // maximum allowed
	 		var MAX_TEMPERATURE = [100]; // max temperature
			var platforms = ["ENOUGH"];

			var ret = {};
			var config = {};
			config.eeprom = 		escData[0];
			config.direction = 		escData[1]
			config.slowStart = 		escData[2];
			config.currentLimit = 	escData[3];
			config.tempLimit = 		escData[4];
			config.currentCalib = 	escData[5];
			config.voltageCalib = 	escData[6];
			config.beeperVolume = 	escData[7];
			config.beaconDelay = 	escData[8];
			config.rampupPower = 	escData[9];
			var info = {};
			info.eeprom = escData[0 + 256];
			info.type = escData[1 + 256];
			info.hw = escData[2 + 256] + "." + escData[3 + 256];
			info.bl = escData[4 + 256] + "." + escData[5 + 256];
			var mj = Math.floor(escData[7 + 256] / 100);
			var mn = escData[7 + 256] % 100;
			if (mn < 10) mn = "0" + mn;
			info.fw = mj + "." + mn;
			info.sn = "";
			for (var i = 0; i < 12; i++) {
				if ((i > 0) && ((i % 4) == 0)) info.sn += "-";
				var byte = escData[i + 8 + 256];
				info.sn +=  hexChar[(byte >> 4) & 0x0f] + hexChar[byte & 0x0f];
			}
			
			var platformId = 0; // one esc to rule them all
		
			
			info.name = (platformId >= platforms.length) ? "n/a" : platforms[platformId];
			
			
			ret.config = config;
			ret.info = info;
			data.esc = ret;
            
            	$(self).html("");
    			
    			var c = "<div class='block econfig'>";
					c+="<div class='title' data-i18n='title.general-settings'>"+data.title+"</div>";
					c+="<div class='body'>";
					c+="<dl><dt ><span data-help='direction'>Rotation Direction</span></dt><dd><select data-help='direction' name='direction'><option value='0'>Normal</option><option value='1'>Reverse</option></select></dd></dl>";
					
					c+="<dl><dt ><span data-help='start'>Slow Start</span></dt><dd><select class='linked' name='slowStart' data-help='start'><option value='0'>No</option><option value='1'>Yes</option></select></dd></dl>";
					c+="<dl><dt><span data-i18n='currentLimit' data-help='currentLimit'>Current Limit</span></dt><dd><input  class='linked' type='number' lang='en-150' step='1' name='currentLimit' data-step='1' min='"+MIN_CURRENT[platformId]+"' max='"+MAX_CURRENT[platformId]+"' value='"+data.esc.config.currentLimit+"' data-help='currentLimit'>&nbsp;A</dd></dl>";
					c+="<dl><dt><span data-i18n='tempLimit' data-help='tempLimit'>Temperature Limit</span></dt><dd><input  class='linked' type='number' lang='en-150' step='1' name='tempLimit' data-step='1' min='0' max='"+MAX_TEMPERATURE[platformId]+"' value='"+data.esc.config.tempLimit+"' data-help='tempLimit'>&nbsp;C</dd></dl>";
					c+="<dl><dt><span data-i18n='currentCalib' data-help='currentCalib'>Current Calibration</span></dt><dd><input  class='linked' type='number' lang='en-150' step='1' name='currentCalib' data-step='1' min='0' max='200' value='"+data.esc.config.currentCalib+"' data-help='currentCalib'>&nbsp;%</dd></dl>";
					c+="<dl><dt><span data-i18n='voltageCalib' data-help='voltageCalib'>Voltage Calibration</span></dt><dd><input  class='linked' type='number' lang='en-150' step='1' name='voltageCalib' data-step='1' min='0' max='200' value='"+data.esc.config.voltageCalib+"' data-help='voltageCalib'>&nbsp;%</dd></dl>";
					c+="<dl><dt><span data-i18n='beeperVolume' data-help='beeperVolume'>Beeper Volume</span></dt><dd><input class='linked' type='number' lang='en-150' step='1' name='beeperVolume' data-step='1' min='0' max='200' value='"+data.esc.config.beeperVolume+"' data-help='beeperVolume'>&nbsp;%</dd></dl>";
					c+="<dl><dt><span data-i18n='beaconDelay' data-help='beaconDelay'>Beacon Timeout</span></dt><dd><input class='linked' type='number' lang='en-150' step='1' name='beaconDelay' data-step='1' min='0' max='200' value='"+data.esc.config.beaconDelay+"' data-help='beaconDelay'>&nbsp;M</dd></dl>";
					c+="<dl><dt><span data-i18n='rampupPower' data-help='rampupPower'>Rampup power</span></dt><dd><input class='linked' type='number' lang='en-150' step='1' name='rampupPower' data-step='1' min='0' max='100' value='"+data.esc.config.rampupPower+"' data-help='rampupPower'>&nbsp;%</dd></dl>";
				
					c+="<dl style='display:none'><dt></dt><dd><a name='save' class='u-button' style='min-width: 53px; display:none' data-i18n='button.save'>Save</a></dd></dl>";
				
					c+="</div>";
					
					var str = "Ultra ESC " + data.esc.info.name + ", FW:" + data.esc.info.fw +", HW:"+ data.esc.info.hw + ", BL:" + data.esc.info.bl;
					c+="<span style='padding-left: 5px; color: rgb(153, 153, 153); font-size: 12px;'>"+str+"</span><br>";
					c+="<span style='padding-left: 5px; color: rgb(153, 153, 153); font-size: 12px;'>Serial: " + data.esc.info.sn+"</span><br>";
					
					c+="</div>";
					
				var elem = $(c);
    	     
    	        try {
    	        	$(elem).find("select[name='slowStart']").val(data.esc.config.slowStart);
    	        	$(elem).find("select[name='slowSpinup']").val(data.esc.config.slowSpinup);
    	          	$(elem).find("select[name='direction']").val(data.esc.config.direction);
    	          	
    	          	$(elem).find("select, input").on("change", function() {
						console.log("Changed!");	
						$(elem).find("[name=save]").addClass("saveAct");  
						
						$(window).trigger( "valueChanged", [  data.motor, $(this).attr('name'), $(this).val()] );
					});
					
					$(elem).find("[name=save]").on("click", function() {
						if ($(this).hasClass("saveAct") && !$(this).hasClass("disabled")) {
							$(window).trigger( "save", [  data.motor ] );
						} else {
							//alert("No need");
						}
					});
					
					if (+$("#configMode").val() == 1) {
						$(elem).find("[name=save]").show();
					}
    	       } catch (e) {
				   console.log(e);
			   }
			   
			   var options = {
   					allowNumeric: true, // is numbers allowed [0-9]
    				allowText: false,   // is text allowed [a-z|A-Z]
    				allowEnter: false,   // is Enter allowed
    				allowCustom: [],    // Array of chars to allow
    				regex: null,        // Regular expression of allowed chars
    				maxLength: null,    // Numeric value representing the maximum number of chars permitted
    				actionLog: false    // Log actions
				}
			   
			   $(elem).find("input[type=number]").inputfilter(options);
			   
			   $(self).addClass("ultraesc");
    	       $(self).append(elem);
    	       $(self).removeClass("blur");
        },
        
        
        reload : function () {
            var self = $(this);
       		$(self).addClass("blur");
        },

        error : function (message) {
            var self = $(this);
        	$(self).find(".body").html(message);
        	$(self).removeClass("blur");
        	$(self).show();
        },
        
        
        
        destroy : function() {
            return this.each(function() {
                $(this).removeData(PLUGIN_NAME);
            });
        },
    };

    $.fn.ultraESC = function(method) {
        if (publicMethods[method]) {
            return publicMethods[method].apply(this, Array.prototype.slice.call(arguments, 1));
        } else if (typeof method === 'object' || !method) {
            return publicMethods.init.apply(this, arguments);
        } else {
            $.error('Method [' +  method + '] not available in $.ultraESC');
        }
    };
})(jQuery);