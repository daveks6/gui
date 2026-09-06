'use strict';

var CONTENT = {}; // filled by individual content js file

var GUI = {
    connectingTo: false,
    connectedTo: false,
    activeContent: null,
    contentSwitchInProgress: false,
    intervalArray: [],
    timeoutArray: [],
    state: "CONNECT"
};

GUI.intervalAdd = function (name, code, interval, first) {
    var data = {
        'name': name,
        'timer': null,
        'code': code,
        'interval': interval,
        'fired': 0,
        'paused': false
    };

    if (first == true) {
        code(); // execute code

        data.fired++; // increment counter
    }

    data.timer = setInterval(function () {
        code(); // execute code

        data.fired++; // increment counter
    }, interval);

    this.intervalArray.push(data); // push to primary interval array

    return data;
};

GUI.intervalRemove = function (name) {
    for (var i = 0; i < this.intervalArray.length; i++) {
        if (this.intervalArray[i].name == name) {
            clearInterval(this.intervalArray[i].timer); // stop timer

            this.intervalArray.splice(i, 1); // remove element/object from
            // array

            return true;
        }
    }

    return false;
};

GUI.intervalKillAll = function (keepArray) {
    var self = this;
    var timersKilled = 0;

    for (var i = (this.intervalArray.length - 1); i >= 0; i--) { // reverse
        // iteration
        var keep = false;
        if (keepArray) { // only run through the array if it exists
            keepArray.forEach(function (name) {
                if (self.intervalArray[i].name == name) {
                    keep = true;
                }
            });
        }

        if (!keep) {
            clearInterval(this.intervalArray[i].timer); // stop timer

            this.intervalArray.splice(i, 1); // remove element/object from
            // array

            timersKilled++;
        }
    }

    return timersKilled;
};

GUI.timeoutAdd = function (name, code, timeout) {
    var self = this;
    var data = {
        'name': name,
        'timer': null,
        'timeout': timeout
    };

    // start timer with "cleaning" callback
    data.timer = setTimeout(function () {
        code(); // execute code

        // remove object from array
        var index = self.timeoutArray.indexOf(data);
        if (index > -1)
            self.timeoutArray.splice(index, 1);
    }, timeout);

    this.timeoutArray.push(data); // push to primary timeout array

    return data;
};

GUI.timeoutRemove = function (name) {
    for (var i = 0; i < this.timeoutArray.length; i++) {
        if (this.timeoutArray[i].name == name) {
            clearTimeout(this.timeoutArray[i].timer); // stop timer

            this.timeoutArray.splice(i, 1); // remove element/object from array

            return true;
        }
    }

    return false;
};

GUI.timeoutKillAll = function () {
    var timersKilled = 0;

    for (var i = 0; i < this.timeoutArray.length; i++) {
        clearTimeout(this.timeoutArray[i].timer); // stop timer

        timersKilled++;
    }

    this.timeoutArray = []; // drop objects

    return timersKilled;
};

GUI.contentSwitchCleanup = function (callback) {
	console.log("GUI.contentSwitchCleanup");
    GUI.intervalKillAll(); // all intervals (mostly data pulling) needs to be
    // removed on tab switch
    GUI.removeHints();
    CONTENT[this.activeContent].cleanup(callback);
};

GUI.switchContent = function (newContent, callback) {
	console.log("GUI.switchContent");
    if (GUI.activeContent != newContent) {
        console.log('Switching active content to ' + newContent);
        GUI.removeHints();
        
        $("#navigation button").removeClass("active-menu");

        $("#navigation button[data-name='" + newContent + "']").addClass('active-menu')

        GUI.activeContent = newContent;
          
        kissProtocol.clearPendingRequests(function () {
        	console.log("Requests cleared");
            callback();
        });
        
        GUI.hints();
        
    } else {
    	console.log("Just a callback");
        callback();
        GUI.rebuildHints();
    }
}

GUI.addHints = function() {
	GUI.jbox = new jBox('Tooltip', {
		attach: '*[data-help]',
		trigger: 'mouseenter',
		position: { x: 'center', y: 'top' },
	
		onOpen: function () {
			var arr = this.source.data("help").split(',');
			var model = {'help' : arr[0]};
			
			if (CONTENT.advanced !== undefined) {
				model.fcType = CONTENT.advanced.fcType;
			}
			
			if (CONTENT.configuration !== undefined) {
				model.fcType = CONTENT.configuration.fcType;
			}
				
			var content = $.Mustache.render(arr[0]+"-help",  model);
			if (content == "") {
				content = "Missing: " + arr[0]+"-help";
			}

			if (this.source.hasClass("unsafe_active")) {
				content += $.Mustache.render("unsafe-help",  model);
			}

			this.setContent(content);
		},
	});
}

GUI.removeHints = function() {
	console.log("Removing hints");
	if (GUI.jbox !== undefined) {
		GUI.jbox.destroy();
		
	}
	// attach to help button
	console.log("Add hint to help button only");
		GUI.jbox = new jBox('Tooltip', {
					attach: '#hints',
					trigger: 'mouseenter',
					position: { x: 'center', y: 'top' },
				
					onOpen: function () {
						var arr = this.source.data("help").split(',');
						var model = {'help' : arr[0]};
						var content = $.Mustache.render(arr[0]+"-help",  model);
						if (content == "") {
							content = "Missing: " + arr[0]+"-help";
						}
						if (this.source.hasClass("unsafe_active")) {
							content += $.Mustache.render("unsafe-help",  model);
						}
						this.setContent(content);
					},
				});
}

GUI.rebuildHints = function() {
	console.log("Rebuilding hints");
	GUI.removeHints();
	GUI.hints();
}

GUI.processLipo = function(status) {
	if (status == 1) {
	    $(".unsafe").each(function(index, elem) {
	    	$(elem).addClass("unsafe_active").wrap("<div class='unsafe unsafe_active' style='display:inline-block;'></div>");
	    	$(elem).attr('disabled', 'disabled');
	    	if ($(elem).attr('data-help')) {
	    		$(elem).parent().attr('data-help', $(elem).attr('data-help'));
	    		//$(elem).removeAttr('data-help');
	    		//$(elem).attr('disabled', 'disabled');
	    	}
	    });
	} else {
	    $(".unsafe").removeClass("unsafe_active");
	}	 
}

GUI.hints = function() {
	console.log("Adding hints");
	getHints(function(hints) {
		if (hints !== "off") {
			GUI.addHints();
			$(".u-button-help").removeClass("inactive");
		} else {
			GUI.removeHints();
			$(".u-button-help").addClass("inactive");
		}
	});
	
	$(".u-button-help").off("click", null).on("click", function() {
		console.log("Clicked");
	
		$(".u-button-help").toggleClass("inactive");
		if ($(".u-button-help").hasClass("inactive")) {
			setHints("off");
			GUI.removeHints();
		} else {
			setHints("on");
			GUI.addHints();
		}
	});
}

function setHints(hints) {
	if (window.localStorage) {
		window.localStorage.setItem('hints', hints);
	} else {
		chrome.storage.local.set({'hints': hints});
	}
}

function getHints(callback) {
	if (window.localStorage) {
		var result = window.localStorage.getItem('hints');
		if ((result != null)) {
            callback(result);
        } else {
            callback("on");
        }
	} else {
	  chrome.storage.local.get('hints', function (result) {
          if ((result !== undefined) && (result.hints !== undefined)) {
              callback(result.hints);
          } else {
              callback("on");
          }
      });
	}
}

GUI.load = function (url, callback) {
  
    $('#content').load(url, function () {
        callback();
    	$("#content").scrollTop(0);
        $("*", "#content").i18n();
        GUI.hints();
    });
}

GUI.switchToConnect = function () {
    // set button to connect
    // unlock port select
    $('#port').prop('disabled', false);
    $('a.connect').text($.i18n('menu.connect'));
    $('a.connect').removeClass('active');
    $('#navigation button:not([data-name="welcome"])').removeClass('unlocked');
    $('#navigation').show();
    hideModal();
	CONTENT.configuration.legacyChecked = false;
    GUI.state = "CONNECT";
}

GUI.switchToConnecting = function () {
    // set button to connecting
    $('#port').prop('disabled', true);
    $('a.connect').text($.i18n("menu.connecting"));
    GUI.state = "CONNECTING";
    GUI.removeHints();
}

GUI.switchToDisconnect = function () {
    // set button to disconnect
    $('a.connect').text($.i18n("menu.disconnect")).addClass('active');
    $('#navigation button').addClass('unlocked');
    hideModal();
    GUI.state = "DISCONNECT";
    GUI.removeHints();
}
