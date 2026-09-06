'use strict';

function setBackground(background) {
	if (window.localStorage) {
		window.localStorage.setItem('background', background);
	} else {
		chrome.storage.local.set({'background': background});
	}
}

function getBackground(callback) {
	if (window.localStorage) {
		var result = window.localStorage.getItem('background');
		if ((result != null)) {
            callback(result);
        } else {
            callback('images/osd/video1.mp4');
        }
	} else {
	  chrome.storage.local.get('background', function (result) {
          if ((result !== undefined) && (result.background !== undefined)) {
              callback(result.background);
          } else {
              callback('images/osd/video1.mp4');
          }
      });
	}
}

function setMode(mode) {
	if (window.localStorage) {
		window.localStorage.setItem('hdmode', mode);
	} else {
		chrome.storage.local.set({'hdmode': mode});
	}
}

function getMode(callback) {
	if (window.localStorage) {
		var result = window.localStorage.getItem('hdmode');
		if ((result != null)) {
            callback(result);
        } else {
            callback("16:9");
        }
	} else {
	  chrome.storage.local.get('hdmode', function (result) {
          if ((result !== undefined) && (result.hdmode !== undefined)) {
              callback(result.hdmode);
          } else {
              callback("16:9");
          }
      });
	}
}

CONTENT.osd = {

};

CONTENT.osd.initialize = function (callback) {
    var self = this;

    self.startedUIupdate = 0;
    self.updateTimeout;
    self.interval;
    self.frame = 0;
    self.address = 0xffff;
    self.chunkSize = 240;
    self.flags = 0;
    self.nvcounter = 0;
    self.videoRunning = true;
    self.blackLevel = 0;
    self.whiteLevel = 255;
    self.analog = true;
    self.fontLoaded = false;
    self.resize = false;
    self.extendedFond = true;
    self.events = new Queue();
    self.width = 0;
    self.height = 0;
    
    self.mouseIn = false;
    self.mouseDown = false;
    self.mouseX = -1;
    self.mouseY = -1;
    	    
	var Buffer = require('buffer').Buffer
	self.compressedBuffer = Buffer.alloc(128*288); // max osd in bytes
	
	
	GUI.switchContent('osd', function () {
		GUI.load("./content/osd.html", function () {

			kissProtocol.send(kissProtocol.GET_SETTINGS, [kissProtocol.GET_SETTINGS], function () {
				var config = kissProtocol.data[kissProtocol.GET_SETTINGS];
				self.config = config;

				htmlLoaded({});
				
				var titles = ['', 'HDZero', 'DJI WTF', 'Avatar', 'DJI O3', 'DJI O3 HD', 'DJI O3 WTF'];
				if (+self.config.mspCanvas > 0) {
					$("#osdtitle").text($("#osdtitle").text() + " - " + titles[+self.config.mspCanvas]);
				}

				while (!self.events.isEmpty()) { self.events.dequeue(); };

				$(window).on("keydown", function(e) {
					e.stopPropagation();
					if (!event.repeat) {
						self.enqueue({e:1, x:e.keyCode, y:0});
					}
				});

				$(window).on("keyup", function(e) {
					e.stopPropagation();
					self.enqueue({e:2, x:e.keyCode, y:0});
				});

				$(window).on("keypress", function(e) {
					e.stopPropagation();
				});

				$("#osd").on("mouseenter", function(e) {
					self.mouseIn = true;
					self.mouseDown = false;
					self.mouseX = 0;
					self.mouseY = 0;
				});

				$("#osd").on("mouseleave", function(e) {
					self.mouseIn = false;
					self.mouseDown = false;
					self.enqueue({e:6, x:Math.floor(self.mouseX), y:Math.floor(self.mouseY)});
					self.mouseX = 0;
					self.mouseY = 0;
				});

				$("#osd").on("mousedown", function(e) {
					if (self.mouseIn) {
						var x = e.pageX - $(this).offset().left;
						var y = e.pageY - $(this).offset().top;
						self.mouseX = x;
						self.mouseY = y;
						self.enqueue({e:4, x:Math.floor(x), y:Math.floor(y)});
					}
					self.mouseDown = true;
				});

				$("#osd").on("mousemove", function(e) {
					if (self.mouseIn) {
						var x = e.pageX - $(this).offset().left;
						var y = e.pageY - $(this).offset().top;
						if ((self.mouseX != x) || (self.mouseY != y)) {
							self.mouseX = x;
							self.mouseY = y;
							self.enqueue({e:5, x:Math.floor(x), y:Math.floor(y)});
						}
					}
				});

				$("#osd").on("mouseup", function(e) {
					if (self.mouseIn) {
						var x = e.pageX - $(this).offset().left;
						var y = e.pageY - $(this).offset().top;
						self.mouseX = x;
						self.mouseY = y;
						self.enqueue({e:6, x:Math.floor(x), y:Math.floor(y)});
					}
					self.mouseDown = false;
				});

				$("#osdground").on("click", function(e) {
					$(this).blur();
					e.stopPropagation();
					self.enqueue({e:10, x:0, y:0});
				});

				$("#osdcontext").on("click", function(e) {
					$(this).blur();
					e.stopPropagation();
					self.enqueue({e:11, x:0, y:0});
				});

				$("#osdleft").on("click", function(e) {
					$(this).blur();
					e.stopPropagation();
					self.enqueue({e:12, x:0, y:0});
				});

				if (kissProtocol.data[kissProtocol.GET_SETTINGS].ver > 127) {
					$("#osdkc").show();
				}
			});

		});
	});
	

	self.interval = window.setInterval(function() { self.nvcounter = 1 - self.nvcounter }, 500);
	
	/*
	 * ffmpeg -i src.m4v -vf scale=-1:288 tmp1.mp4
	 * ffmpeg -i tmp1.mp4 -filter:v "crop=370:288:64:0" dst.mp4	
	 */
	self.backgrounds = [
		"images/osd/video1.mp4",
		"images/osd/video3.mp4",
		"images/osd/video2.mp4",
		"images/osd/video4.mp4",
		"images/osd/video5.mp4"
	];
	
	function grabData() {
		
	}
	
	self.enqueue = function(event) {
		self.events.enqueue(event);
	}
	  
	function htmlLoaded(data) {
		
		self.changeMode = function(mode, store) {
			self.mode = mode;
			if (store) {
				setMode(mode);
			};
			if (mode == "16:9" || self.analog) { // wide
				$("#ratio169").removeClass("inactive");
				$("#ratio43").addClass("inactive");
				$("#BackgroundVideo-0").width("100%").css("left", "0px");
				
			} else {
				$("#ratio169").addClass("inactive");
				$("#ratio43").removeClass("inactive");
				if (+self.config.mspCanvas == 2) { // wtf
					$("#BackgroundVideo-0").width("75%").css("left", "90px");
				} else if (+self.config.mspCanvas == 1) { // hd0
					$("#BackgroundVideo-0").width("80%").css("left", "60px");
				} else if (+self.config.mspCanvas == 3) { // ws
					$("#BackgroundVideo-0").width("87%").css("left", "42px");
				} else if (+self.config.mspCanvas == 5) { // dji o3 hd
					$("#BackgroundVideo-0").width("77.5%").css("left", "72px");
				} else if (+self.config.mspCanvas == 6) { // dji o3 hd
					$("#BackgroundVideo-0").width("77.5%").css("left", "72px");
				} else { // dji o3
					$("#BackgroundVideo-0").width("100%").css("left", "0px");
				}
			}
		}
		
		getBackground(function(bg) {
			
			self.video = new BackgroundVideo({
				container: "osdframe",
				zIndex: "1000",
			    video: [
			        {
			        	file: bg
			        }
			    ]
			});
			
			self.playing = true;
			$.each(self.backgrounds, function( index, value ) {
				 $(".osd-backgrounds-thimbnails").append('<li><img data-idx="'+index+'" src="'+value.replace('.mp4','.png')+'" '+(value === bg ? 'class="bgtn active"' : 'class="bgtn"')+'></li>');
			});

			$("img.bgtn").on('click', function() {
				$("img.bgtn").removeClass('active');
				$(this).addClass('active');
				var src = self.backgrounds[$(this).data('idx')];
				setBackground(src);
				
				$("#BackgroundVideo-0").remove();
				
				self.video = new BackgroundVideo({
					container: "osdframe",
					zIndex: "1000",
				    video: [
				        {
				        	file: src
				        }
				    ]
				}, function() {
					self.changeMode(self.mode, false);
				});
				
				if (self.videoRunning) self.video.play(); else self.video.pause();
				
			});
			
			getMode(function(mode) {
				console.log("Stored mode: " + mode);
				self.changeMode(mode, false);
			});
		});

		self.startedUIupdate = 0;
		window.clearTimeout(self.updateTimeout);

		$(window).on('resize', self.osdResize).resize();
		
		
		$("#ratio169").click(function() {
			self.changeMode("16:9", true);
		});
		
		$("#ratio43").click(function() {
			self.changeMode("4:3", true);
		});
		
		function updateUI() {
			//console.log("Update UI");
			var osd = kissProtocol.data[kissProtocol.GET_OSD];

			if (osd) {
				var lineData = new Uint8Array(osd.buffer);
				var addr = 256*lineData[0] + lineData[1];
				var len  = 256*lineData[2] + lineData[3];
				
				if (addr == 0xffff) {
					self.compressedSize = len;
					self.address = 0;
					
					var width  = lineData[9]  + 256 * lineData[8]; // only hd
					var height = lineData[11] + 256 * lineData[10]; // only hd
					
					if ((self.width != width) || (self.height != height)) {
						self.resize = true;
					}
					
					self.width  = width;
					self.height = height;
					
					self.whiteLevel = lineData[15];
					self.blackLevel = lineData[13];
					self.flags  = lineData[16];
				} else {
					if (len == 0) {
						
						self.address = 0xffff; // Info request
						
						var LZ4 = require('lz4');
						var uncompressedBuffer = Buffer.alloc(128*288);
						var decoded = LZ4.decodeBlock(self.compressedBuffer, uncompressedBuffer, 0, self.compressedSize);
						
						if (decoded >0) {
							
						var c = document.getElementById("osd");
						var ctx = c.getContext("2d");
						var scr = new Uint8Array(uncompressedBuffer);
						
						var newAnalog = (self.flags & 0x8) == 0;
						
						var mouse = (self.flags & 0x40) == 0x40;
						
						var nav = (self.flags & 0x80) == 0x80;
						
						if ((self.flags & 0x01) == 0x01) {
							$("#osdcontext").show();
						} else {
							$("#osdcontext").hide();
						}
						
						if (mouse) {
							$("#osdmc").show();
						} else {
							$("#osdmc").hide();
						}
						
						if (nav) {
							$("#osdnav").show();
						} else {
							$("#osdnav").hide();
						}
						
						var newExtended = ((self.flags & 0x20) == 0x20);
						if ((newExtended != self.extendedFont) || !self.fontLoaded) {
							self.fontLoaded = false;
							self.extendedFont = newExtended;
							self.font = new Image();
							
							if ((self.config.mspCanvas == 4) || ((self.config.mspCanvas == 5))) {
								self.font.src = 'images/osd/o3_12.png'; // O3 hack
							} else {
								self.font.src = 'images/osd/ultra_12'+(self.extendedFont ? '_extended' : '') + '.png';
							}
							self.font.onload = function () {
								self.fontLoaded = true;
							}
						}
						
						if ((newAnalog != self.analog) || (self.resize)) {
							self.analog = newAnalog;
							// Switch mode!
							
							if (self.analog) {
								$("#osd_column").width(380).height(334);
								$("#osd_block").width(380).height(334);
								$("#osd_outer").width(370).height(299);
								$("#osdframe").width(370).height(299);
								$("#osd43").hide();
							} else {
								$("#osd_column").width(self.width*12 + 30).height(self.height * 18 + 40);
								$("#osd_block").width(self.width*12 + 10).height(self.height * 18 + 36);
								$("#osd_outer").width(self.width*12 + 20).height(self.height * 18 + 40);
								$("#osdframe").width(self.width*12).height(self.height * 18);
								if (self.width > 30) { // no soup for O3 :)
									$("#osd43").show();
									self.changeMode(self.mode, false);
								}
							}
							self.resize = false;
							
						}
						
						// analog start
						
						if (self.analog) {
							var p = ctx.createImageData(512, 288);
							var wl = (self.whiteLevel - 60) * 1.83; if (wl>255) wl = 255; if (wl<0) wl = 0;
							var bl = (self.blackLevel - 60) * 1.83; if (bl>255) bl = 255; if (bl<0) bl = 0;
							for (var y=0; y<288; y++) {
								for (var x=0; x<512; x++) {
									var pixaddr = y*128 + (x >> 2);
									var dstaddr = 4* (y*512 + x);
									var c = scr[pixaddr];
									c <<= (2*(x & 3));
									var col = c & 0xc0;

									if (col == 0x80) {
										p.data[dstaddr + 0]	=	wl;
										p.data[dstaddr + 1]	=	wl;
										p.data[dstaddr + 2]	=	wl;
										p.data[dstaddr + 3]	=	255;
									} else if (col == 0x40) {
										p.data[dstaddr + 0]	=	bl;
										p.data[dstaddr + 1]	=	bl;
										p.data[dstaddr + 2]	=	bl;
										p.data[dstaddr + 3]	=	255;
									} else if (col == 0xc0) {
										p.data[dstaddr + 0]	=	0;
										p.data[dstaddr + 1]	=	0;
										p.data[dstaddr + 2]	=	0;
										p.data[dstaddr + 3]	=	127;
									}
								}
							}
							ctx.putImageData(p, -36, 3);
							if ((self.flags & 0x2) == 0) { // updateTimeout

								ctx.font="20px Monaco";
								ctx.fillStyle = "lime";
								ctx.textAlign = "center";
								ctx.globalAlpha = 0.4;
								ctx.fillText("NO SIGNAL", 185, 270);
							}
							
						
						} else {
							// Ultra in HD canvas mode
							if (self.fontLoaded) {
								ctx.clearRect(0, 0, 720, 396);

									
								
								for (var y=0; y<self.height; y++) {
									for (var x=0; x<self.width; x++) {
										var charaddr = y * 60 * 2 + (x * 2);
										var c = scr[charaddr] + 256 * scr[charaddr + 1];
										var sx = 0;
										var sh = 18;
										var sy = sh * c;
										var sw = 12;
										var dw = 12;
										var dh = 18;
										
										
										var dx = x * dw;
										var dy = y * dh;
										
										if ((self.flags & 0x10) == 0x10) { // draw grid
											ctx.fillStyle = "#FFFFFF";
											ctx.globalAlpha = 0.15;
											ctx.fillRect(dx, dy, dw-1, dh-1);
										}
										ctx.globalAlpha = 1.0;
										ctx.drawImage(self.font, sx, sy, sw, sh, dx, dy, dw, dh);
									}
								}
								
								ctx.strokeStyle = "#333333";
								ctx.globalAlpha = 1;
								ctx.lineWidth = 2;
								ctx.strokeRect(0, 0, 720, 396);
							}
						}
						
						var inFlight = true;
						if ((self.flags & 0x4) == 0x4) { // menu
							inFlight = false;
						}
						
						if (self.videoRunning) {
							if (inFlight != self.playing) {
								self.playing = inFlight;
								if (self.playing) {
									self.video.play();
								} else {
									self.video.pause();
								}
							}
						}
					}
						
					} else {
						for (var i=0; i<len; i++) {
							self.compressedBuffer.writeUInt8(lineData[i + 4], addr + i );
						}
						self.address = addr + len; // next one
					}
				}
			}
		}
		
		// setup graph
		$(window).on('resize', self.resizeCanvas).resize();

		function fastDataPoll() {
			self.updateTimeout = window.setTimeout(function () {
				fastDataPoll();
			}, 50); // Just restart if needed
			var tmp = {
					 'buffer': new ArrayBuffer(3),
	                 'address': self.address,
	                 'chunkSize': self.chunkSize
	        };
			
			if (kissProtocol.data[kissProtocol.GET_SETTINGS].ver > 127) {
				if (!self.events.isEmpty()) {
					tmp.event = self.events.dequeue();
				}
			}
				             
			kissProtocol.send(kissProtocol.GET_OSD, kissProtocol.preparePacket(kissProtocol.GET_OSD, tmp), function () {
				if (GUI.activeContent == 'osd') {
					if (self.startedUIupdate == 0) {
						updateUI();
					}
					window.clearTimeout(self.updateTimeout);
					self.updateTimeout = window.setTimeout(function () {
						fastDataPoll();
					}, 1);
				}
			});
		}
		
		if (+kissProtocol.data[kissProtocol.GET_SETTINGS]['ver'] > 129) {
			$(".footer").show();
		} else {
			$(".footer").hide();
		}
        
		$(window).on('resize', self.resizeOSD).resize();

		fastDataPoll();
		
	    scrollTop();
	}
};


CONTENT.osd.resizeOSD = function () {

}

CONTENT.osd.cleanup = function (callback) {
  //  $(window).off('resize', this.osdResize);
    window.clearTimeout(this.updateTimeout);
	window.clearInterval(this.interval);
	$(window).off("keydown,keyup,keypress");
    if (callback) callback();
    
    
};