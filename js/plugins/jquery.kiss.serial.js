(function ($) {
    var PLUGIN_NAME = 'kiss.serial',
        pluginData = function (obj) {
            return obj.data(PLUGIN_NAME);
        };

    var privateMethods = {
		
		functionAllowed: function(self, func) {
			var data = pluginData(self);
			for (i=0; i<data.allowedFunctions.length; i++) {
				if (data.allowedFunctions[i] == func) {
					return true;
				}
			}
			return false;
		},
		
        build: function (self) {
            var data = pluginData(self);
            var c = "";
            c += '<dt class="kiss-serial-function"><span data-help="'+data.help+'">' + data.name + '</span></dt>';
            c += '<dd class="kiss-serial-function">';

            c += '<select class="kiss-serial-mode unsafe" style="width:200px" data-help="'+data.help+'">';
            if (privateMethods.functionAllowed(self, 0)) c += '<option value="0" data-i18n="serialtype.0">Kiss Protocol</option>';
            if (privateMethods.functionAllowed(self, 1)) c += '<option value="1" data-i18n="serialtype.1">Logger</option>';
            if (privateMethods.functionAllowed(self, 2)) c += '<option value="2" data-i18n="serialtype.2">Receiver</option>';
            if (privateMethods.functionAllowed(self, 3)) c += '<option value="3" data-i18n="serialtype.3">VTX</option>';
            if (privateMethods.functionAllowed(self, 4)) c += '<option value="4" data-i18n="serialtype.4">ESC TLM / Onewire</option>';
            if (privateMethods.functionAllowed(self, 5)) c += '<option value="5" data-i18n="serialtype.5">Runcam</option>';
            if (data.version >= 118)
               if (privateMethods.functionAllowed(self, 7)) c += '<option value="7" data-i18n="serialtype.7">GPS</option>';
            if (data.version >= 120) {
                if (privateMethods.functionAllowed(self, 8)) c += '<option value="8" data-i18n="serialtype.8">MSP OSD (HD)</option>';
                if (privateMethods.functionAllowed(self, 9)) c += '<option value="9" data-i18n="serialtype.9">DISABLED</option>';
            }
            c += '</select></dd>';
            self.empty();
            self.append(c);

            $("select", self).on("change", function () {
                data.value = parseInt($(".kiss-serial-mode", self).val());
                privateMethods.changeModeState(self);
                
                // temporary fix for changing serials
                $("input[name='altLimit']").trigger("change");
                
            });
            if (data.change !== undefined) $("select", self).on("change", data.change);
            privateMethods.changeValue(self);
        },
        changeValue: function (self) {
            var data = pluginData(self);
            if (data.value !== undefined && privateMethods.functionAllowed(self, data.value)) {
                $(".kiss-serial-mode", self).val(data.value);
                privateMethods.changeModeState(self);
            } else {
				 $(".kiss-serial-mode", self).val(9);
                privateMethods.changeModeState(self);
			}
        },
        changeModeState: function (self) {
            var data = pluginData(self);
            if (data.value == 0xf) {
                self.hide();
            } else {
                self.show();
            }
        }
    };

    var publicMethods = {
        init: function (options) {
            return this.each(function () {
                var self = $(this),
                    data = pluginData(self);
                if (!data) {
                    self.data(PLUGIN_NAME, $.extend(true, {
                        name: '',
                        value: 0,
                        allowedFunctions: [0, 8]
                    }, options));
                    data = pluginData(self);
                }
                privateMethods.build(self);

            });
        },
        destroy: function () {
            return this.each(function () {
                $(this).removeData(PLUGIN_NAME);
            });
        },
        value: function () {
            var self = $(this),
                data = pluginData(self);
            return data.value;
        },
        setValue: function (newValue) {
            var self = $(this);
            var data = pluginData(self);
            data.value = newValue;
            privateMethods.changeValue(self);
        }
    };

    $.fn.kissSerial = function (method) {
        if (publicMethods[method]) {
            return publicMethods[method].apply(this, Array.prototype.slice.call(arguments, 1));
        } else if (typeof method === 'object' || !method) {
            return publicMethods.init.apply(this, arguments);
        } else {
            $.error('Method [' + method + '] not available in $.kissSerial');
        }
    };
})(jQuery);