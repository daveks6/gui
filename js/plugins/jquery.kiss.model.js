(function ($) {
    var PLUGIN_NAME = 'kiss.model',
        pluginData = function (obj) {
            return obj.data(PLUGIN_NAME);
        };
    var
        ARM_LENGTH = 1.0,
        HUB_RADIUS = 0.2,
        CRAFT_DEPTH = 0.03,
        AXIS = {
            roll: new THREE.Vector3(1, 0, 0),
            pitch: new THREE.Vector3(0, 1, 0),
            yaw: new THREE.Vector3(0, 0, 1)
        },
        MIXER_LIST = [{
        	// tricopter
        }, {
            name: 'Quad +',
            arms: 4,
            colors: [0, 1, 0, 1],
            arrowRotation: -Math.PI / 2,
        }, {
            name: 'Quad X',
            arms: 4,
            rotation: -Math.PI / 4,
            arrowRotation: -Math.PI / 4,
            colors: [1, 0, 1, 0]
        }, {
           // y4
        }, {
            name: 'Y6',
            arms: 3,
            rotation: -Math.PI / 3,
            arrowRotation:  -Math.PI / 2 + Math.PI/3,
            colors: [0, 1, 0, 1, 1, 0],
            motors: [
                [0, -1],
                [2, -3],
                [4, -5]
            ]
        }, {
            name: 'Hexa +',
            arms: 6,
            arrowRotation:  -Math.PI / 2,
            colors: [1, 0, 1, 0, 1, 0]
        }, {
            name: 'Hexa X',
            arms: 6,
            rotation: -Math.PI / 6,
            arrowRotation: -2 * Math.PI / 6,
            colors: [1, 0, 1, 0, 1, 0]
        }, {
          
        }, {
          
        }, {
            name: 'Octo Flat',
            arms: 8,
            rotation: -Math.PI / 8,
            arrowRotation: -3 * Math.PI / 8,
            colors: [0, 1, 0, 1, 0, 1, 0, 1],
            armLength: 1.22
        }, {
            name: 'Octo X',
            arms: 4,
            rotation: -Math.PI / 4,
            arrowRotation: -Math.PI / 4,
            colors: [1, 0, 0, 1, 1, 0, 0, 1],
            motors: [
                [0, -1],
                [2, -3],
                [4, -5],
                [6, -7]
            ]
        }];

    var privateMethods = {
        makeMotor: function (self, propColor) {
        	var motor = {};
            var motorParent = new THREE.Object3D();
            motor.mesh = motorParent;
            
            var motorMaterial = new THREE.MeshPhongMaterial({
                color: 0x000000,
                specular: 0x202020,
                shininess: 100
            });
            var propMaterial = new THREE.MeshPhongMaterial({
                color: propColor,
                shininess: 0
            });
            var propDiskMaterial = new THREE.MeshPhongMaterial({
                color: propColor,
                shininess: 0,
                transparent: false,
                opacity: 0.8
            });
            var motorBase = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.08, 0.02, 16), motorMaterial);
            var motorBell = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.09, 16), motorMaterial);
            var motorTop = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.02, 16), motorMaterial);
            var motorShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.27, 16), motorMaterial);
            var motorNut = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.03, 6), motorMaterial);
            var propHub = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.05, 16), propMaterial);
            
            
            var propDisk = new THREE.Mesh(new THREE.CylinderGeometry(0.0, 0.0, 0.01, 32), propDiskMaterial);
            var geomBlade = new THREE.BoxGeometry(0.1,0.03, 0.45);

            var a = 0.45/2;
            for (var i=0; i<360; i+=120) {
            	var blade = new THREE.Mesh(geomBlade, propDiskMaterial);
            	blade.position.set(Math.sin( i * Math.PI / 180) * a, 0, Math.cos( i * Math.PI / 180) * a);
            	blade.rotation.y = i * Math.PI/180;
            	blade.rotation.z = 10 * Math.PI/180; // pitch
            	propDisk.add(blade);
            }
           
            motorBell.position.y = 0.07;
            motorTop.position.y = 0.125;
            motorShaft.position.y = 0.12;
            propHub.position.y = 0.16;
            motorNut.position.y = 0.20;
            
            propDisk.position.y = 0.165;
            motorParent.add(motorBase);
            motorParent.add(motorBell);
            motorParent.add(motorTop);
            motorParent.add(motorShaft);
            motorParent.add(propHub);
            motorParent.add(motorNut);
            motorParent.add(propDisk);
            
            motor.propeller = propDisk;
            return motor;
        },
        build: function (self) {
            var data = pluginData(self);
            data.mixerData = MIXER_LIST[data.mixer];
            data.props = [];
            data.scene = new THREE.Scene();
            
            var al = ARM_LENGTH;
            if (data.mixerData.armLength) {
            	al = data.mixerData.armLength;
            }

            privateMethods.initCamera(self);
            privateMethods.initRenderer(self);

            var path = new THREE.Path(),
                ARM_WIDTH_RADIANS = 0.15,
                MOTOR_MOUNT_WIDTH_RATIO = 2.5,
                MOTOR_MOUNT_LENGTH_RATIO = 0.08,
                MOTOR_BEVEL_DEPTH_RATIO = 0.08,
                ARM_WIDTH = 2 * Math.sin(ARM_WIDTH_RADIANS) * HUB_RADIUS,
                texture = THREE.ImageUtils.loadTexture(data.texture);

            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            texture.repeat.set(12, 24);


            var arrowMaterial = new THREE.MeshPhongMaterial({
                specular: 0xffffff,
                shininess: 100
            });
            
            var craftMaterial = new THREE.MeshPhongMaterial({
                map: texture,
                specular: 0x202020,
                shininess: 100
            }),
                craft = new THREE.Object3D();

            for (i = 0; i < data.mixerData.arms; i++) {
                var
                    armStart = i / data.mixerData.arms * Math.PI * 2 - ARM_WIDTH_RADIANS,
                    armEnd = armStart + ARM_WIDTH_RADIANS * 2;

                if (i === 0) {
                    path.moveTo(Math.cos(armStart) * HUB_RADIUS, Math.sin(armStart) * HUB_RADIUS);
                } else {
                    path.lineTo(Math.cos(armStart) * HUB_RADIUS, Math.sin(armStart) * HUB_RADIUS);
                }

                var
                    armVectorX = Math.cos(armStart + ARM_WIDTH_RADIANS),
                    armVectorY = Math.sin(armStart + ARM_WIDTH_RADIANS),
                    crossArmX = -armVectorY * ARM_WIDTH * 0.5,
                    crossArmY = armVectorX * ARM_WIDTH * 0.5,

                    armPoints = [{
                        length: 1 - MOTOR_MOUNT_LENGTH_RATIO - MOTOR_BEVEL_DEPTH_RATIO,
                        width: 1
                    }, {
                        length: 1 - MOTOR_MOUNT_LENGTH_RATIO,
                        width: MOTOR_MOUNT_WIDTH_RATIO
                    }, {
                        length: 1 + MOTOR_MOUNT_LENGTH_RATIO,
                        width: MOTOR_MOUNT_WIDTH_RATIO
                    }, {
                        length: 1 + MOTOR_MOUNT_LENGTH_RATIO + MOTOR_BEVEL_DEPTH_RATIO,
                        width: 1
                    }];

                armVectorX *= al;
                armVectorY *= al;

                for (var j = 0; j < armPoints.length; j++) {
                    var point = armPoints[j];
                    path.lineTo(point.length * armVectorX - point.width * crossArmX, point.length * armVectorY - point.width * crossArmY);
                }

                for (var j = armPoints.length - 1; j >= 0; j--) {
                    var point = armPoints[j];
                    path.lineTo(point.length * armVectorX + point.width * crossArmX, point.length * armVectorY + point.width * crossArmY);
                }

                path.lineTo(
                    Math.cos(armEnd) * HUB_RADIUS,
                    Math.sin(armEnd) * HUB_RADIUS
                );
                
            
                var motors = [i];
                if (data.mixerData.motors !== undefined) {
                    motors = data.mixerData.motors[i];
                }

                for (var k = 0; k < motors.length; k++) {
                	var c = data.mixerData.colors[Math.abs(motors[k])];
                	if (data.reverse) c = 1 - c;
                	
                    var motorObj = privateMethods.makeMotor(self, data.propColors[c]);
                    var motor = motorObj.mesh;
                    motor.position.x = armVectorX
                    motor.position.y = armVectorY
                    if (motors[k] >= 0) {
                        motor.position.z = CRAFT_DEPTH;
                        motor.rotateOnAxis(AXIS.roll, Math.PI / 2);
                    } else {
                        motor.rotateOnAxis(AXIS.roll, -Math.PI / 2);
                    }
                    craft.add(motor);
                    data.props.push(motorObj.propeller);
                }
            }

            var
                shape = path.toShapes(true, false),
                extrudeSettings = {
                    amount: CRAFT_DEPTH,
                    steps: 1,
                    bevelEnabled: false
                },
                geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings),
                craftMesh = new THREE.Mesh(geometry, craftMaterial);

            craft.add(craftMesh);
            
            // arrow
            
            const arrowShape = new THREE.Shape();
            arrowShape.moveTo(0.0, -0.1);
            arrowShape.lineTo(-0.3, -0.3);
            arrowShape.lineTo(0.0, 0.3);
            arrowShape.lineTo(0.3, -0.3);
            arrowShape.lineTo(0.0, -0.1);
         
            
            var arrowExtrudeSettings = {
                amount: 0.03,
                steps: 1,
                bevelEnabled: false
            };
            
            var arrowGeometry = new THREE.ExtrudeGeometry(arrowShape, arrowExtrudeSettings);
            var arrowMesh = new THREE.Mesh(arrowGeometry, arrowMaterial);
            
            
            arrowMesh.scale.set(0.4,0.4,1);
            arrowMesh.position.z=+0.02;
            
            if (data.mixerData.arrowRotation !== undefined) {
                arrowMesh.rotateOnAxis(AXIS.yaw, data.mixerData.arrowRotation);
            }
            
            craft.add(arrowMesh);

            craft.position.z = -CRAFT_DEPTH / 2;
            
            craft.rotation.x =  -Math.PI / 2;
            craft.rotation.y = 0;
            craft.rotation.z =  Math.PI / 2; 
            
            if (data.mixerData.rotation !== undefined) {
               craft.rotation.z  += data.mixerData.rotation;
            }
 
            var directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
            directionalLight.position.set(0, 0, 1);
            data.scene.add(directionalLight);
          
        	var group = new THREE.Group();
        	
        	group.add(craft);
        	data.group = group;
        	var outerGroup = new THREE.Group();
        	//outerGroup.add(new THREE.AxisHelper( 20 ) );
        	data.outerGroup = outerGroup;
        	outerGroup.add(group);
            data.scene.add(data.outerGroup);
            data.craft = craft;
            self.append(data.renderer.domElement);
        },
        initCamera: function (self) {
            var data = pluginData(self);
            data.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 1000);
            data.camera.position.set(0, 100, 300);
            data.camera.position.y = 0;
            data.camera.position.z = 5;
        },
        initRenderer: function (self) {
            var data = pluginData(self);
            data.renderer = new THREE.WebGLRenderer({
                antialias: true,
                alpha: true,
           
            });
            data.renderer.setSize(data.width, data.height); // w/h
            data.renderer.setClearColor(data.backgroundColor, 0);
        }
    };

    var publicMethods = {
        init: function (options) {
            return this.each(function () {
                var self = $(this),
                    data = pluginData(self);
                if (!data) {
                    self.data(PLUGIN_NAME, $.extend(true, {
                        rate: {
                            roll: 0,
                            pitch: 0,
                            yaw: 0
                        },
                        reverse: false,
                        scene: null,
                        renderer: null,
                        camera: null,
                        speed: 0,
                        model: null,
                        width: 200,
                        height: 200,
                        mixer: 6,
                        mixerData: {},
                        backgroundColor: 0x000000,
                        propColors: [0xFB921A, 0x00FCFC],
                        texture: 'images/cf.png'
                    }, options));
                    data = pluginData(self);
                }
                privateMethods.build(self);
            });
        },
        destroy: function () {
			console.log("Destroying plugin");
			var self = $(this);
			var data = pluginData(self);
			if (data) {
				if (data.renderer) {
					data.renderer.forceContextLoss();
        			//data.renderer.dispose();
        		}
        		data.renderer = null;
        	}
            return this.each(function () {
                $(this).removeData(PLUGIN_NAME);
            });
        },
        updateAngle: function (angle) {
            var self = $(this);
            var data = pluginData(self);
            data.angle = angle;
            data.group.rotation.x = data.angle.pitch;
            data.group.rotation.y = 0;
            data.group.rotation.z = data.angle.roll;
            data.outerGroup.rotation.y = data.angle.yaw;
        },
         updateRate: function (angle) {
            var self = $(this);
            var data = pluginData(self);
            data.angle = angle;
            data.group.rotateX(data.angle.pitch);
            data.group.rotateY(data.angle.yaw);
            data.group.rotateZ(data.angle.roll);
            data.outerGroup.rotation.x = Math.PI / 2;
        },
        updateSpeed: function (speed) {
            var self = $(this);
            var data = pluginData(self);
            data.speed = speed;
        },
        reset: function () {
            var data = pluginData($(this));
            // nothing to do
        },
        refresh: function () {
            var data = pluginData($(this));
            
            for (i = 0; i < data.mixerData.arms; i++) {
            	var motors = [i];
            	if (data.mixerData.motors !== undefined) {
            		motors = data.mixerData.motors[i];
            	}

            	for (var k = 0; k < motors.length; k++) {
            		var c = data.mixerData.colors[Math.abs(motors[k])];
            		if (motors[k]<0) c = 1 - c;
            		if (data.reverse) c = 1 - c;
            		var maxSpeed = 0.8;
            		var minSpeed = 0.2;
            		var s = (maxSpeed - minSpeed) * data.speed + minSpeed;
            		if ( c == 1) {
            		  	data.props[Math.abs(motors[k])].rotation.y += s;
            		} else {
            			data.props[Math.abs(motors[k])].rotation.y -= s;
            		}
            	}
            }
            
            data.renderer.render(data.scene, data.camera);
        }
    };

    $.fn.kissModel = function (method) {
        if (publicMethods[method]) {
            return publicMethods[method].apply(this, Array.prototype.slice.call(arguments, 1));
        } else if (typeof method === 'object' || !method) {
            return publicMethods.init.apply(this, arguments);
        } else {
            $.error('Method [' + method + '] not available in $.kissModel');
        }
    };
})(jQuery);