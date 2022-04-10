import './style.css'
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.118/build/three.module.js';

import {FBXLoader} from 'https://cdn.jsdelivr.net/npm/three@0.118.1/examples/jsm/loaders/FBXLoader.js';

class BasicCharacterControllerProxy {
  constructor(animations) {
    this._animations = animations;
  }

  get animations() {
    return this._animations;
  }
};


class BasicCharacterController {
  constructor(params) {
    this.Init(params);
  }

  Init(params) {
    this.params = params;
    this.decceleration = new THREE.Vector3(-0.0005, -0.0001, -5.0);
    this.acceleration = new THREE.Vector3(1, 0.25, 90.0);
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.position = new THREE.Vector3();

    this.animations = {};
    this.input = new BasicCharacterControllerInput();
    this.stateMachine = new CharacterFSM(
        new BasicCharacterControllerProxy(this.animations));

    this.LoadModels();
  }

  LoadModels() {
    const loader = new FBXLoader();
    loader.setPath('./assets/Remy/');
    loader.load('Remy.fbx', (fbx) => {
      fbx.scale.setScalar(0.1);
      fbx.traverse(c => {
        c.castShadow = true;
      });

      this.target = fbx;
      this.params.scene.add(this.target);
      // this.target.position.set(0, 20, 0); //position du joueur

      this.mixer = new THREE.AnimationMixer(this.target);

      this.manager = new THREE.LoadingManager();
      this.manager.onLoad = () => {
        this.stateMachine.SetState('idle');
      };

      const OnLoad = (animName, anim) => {
        const clip = anim.animations[0];
        const action = this.mixer.clipAction(clip);
  
        this.animations[animName] = {
          clip: clip,
          action: action,
        };
      };

      const loader = new FBXLoader(this.manager);
      loader.setPath('./assets/Remy/');
      loader.load('Walking.fbx', (a) => { OnLoad('walk', a); });
      loader.load('Run Forward.fbx', (a) => { OnLoad('run', a); });
      loader.load('Happy Idle.fbx', (a) => { OnLoad('idle', a); });
      loader.load('Jump.fbx', (a) => { OnLoad('jump', a); });
    });
  }

  get Position() {
    return this.position;
  }

  get Rotation() {
    if (!this.target) {
      return new THREE.Quaternion();
    }
    return this.target.quaternion;
  }

  Update(timeInSeconds) {
    if (!this.stateMachine.currentState) {
      return;
    }

    this.stateMachine.Update(timeInSeconds, this.input);

    const velocity = this.velocity;
    const frameDecceleration = new THREE.Vector3(
        velocity.x * this.decceleration.x,
        velocity.y * this.decceleration.y,
        velocity.z * this.decceleration.z
    );
    frameDecceleration.multiplyScalar(timeInSeconds);
    frameDecceleration.z = Math.sign(frameDecceleration.z) * Math.min(
        Math.abs(frameDecceleration.z), Math.abs(velocity.z));

    velocity.add(frameDecceleration);

    const controlObject = this.target;
    const Q = new THREE.Quaternion();
    const A = new THREE.Vector3();
    const R = controlObject.quaternion.clone();

    const acc = this.acceleration.clone();
    if (this.input.keys.shift) {
      acc.multiplyScalar(2.0);
    }

    if (this.stateMachine.currentState.Name == 'jump') {
      acc.multiplyScalar(0.0);
    }

    if (this.input.keys.forward) {
      velocity.z += acc.z * timeInSeconds;
    }
    if (this.input.keys.backward) {
      velocity.z -= acc.z * timeInSeconds;
    }
    if (this.input.keys.left) {
      A.set(0, 1, 0);
      Q.setFromAxisAngle(A, 4.0 * Math.PI * timeInSeconds * this.acceleration.y);
      R.multiply(Q);
    }
    if (this.input.keys.right) {
      A.set(0, 1, 0);
      Q.setFromAxisAngle(A, 4.0 * -Math.PI * timeInSeconds * this.acceleration.y);
      R.multiply(Q);
    }

    controlObject.quaternion.copy(R);

    const oldPosition = new THREE.Vector3();
    oldPosition.copy(controlObject.position);

    const forward = new THREE.Vector3(0, 0, 1);
    forward.applyQuaternion(controlObject.quaternion);
    forward.normalize();

    const sideways = new THREE.Vector3(1, 0, 0);
    sideways.applyQuaternion(controlObject.quaternion);
    sideways.normalize();

    sideways.multiplyScalar(velocity.x * timeInSeconds);
    forward.multiplyScalar(velocity.z * timeInSeconds);

    controlObject.position.add(forward);
    controlObject.position.add(sideways);

    this.position.copy(controlObject.position);

    if (this.mixer) {
      this.mixer.update(timeInSeconds);
    }
  }
};

class BasicCharacterControllerInput {
  constructor() {
    this.Init();    
  }

  Init() {
    this.keys = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      space: false,
      shift: false,
    };
    document.addEventListener('keydown', (e) => this.onKeyDown(e), false);
    document.addEventListener('keyup', (e) => this.onKeyUp(e), false);
  }

  onKeyDown(event) {
    switch (event.keyCode) {
      case 38: // up
        this.keys.forward = true;
        break;
      case 90: // z
        this.keys.forward = true;
        break;
      case 37: // left
        this.keys.left = true;
        break;
      case 81: // q
        this.keys.left = true;
        break;
      case 40: // back
        this.keys.backward = true;
        break;
      case 83: // s
        this.keys.backward = true;
        break;
      case 39: // right
        this.keys.right = true;
        break;
      case 68: // d
        this.keys.right = true;
        break;
      case 32: // SPACE
        this.keys.space = true;
        break;
      case 16: // SHIFT
        this.keys.shift = true;
        break;
    }
  }

  onKeyUp(event) {
    switch(event.keyCode) {
      case 38: // up
        this.keys.forward = false;
        break;
      case 90: // z
        this.keys.forward = false;
        break;
      case 37: // left
        this.keys.left = false;
        break;
      case 81: // q
        this.keys.left = false;
        break;
      case 40: // back
        this.keys.backward = false;
        break;
      case 83: // s
        this.keys.backward = false;
        break;
      case 39: // right
        this.keys.right = false;
        break;
      case 68: // d
        this.keys.right = false;
        break;
      case 32: // SPACE
        this.keys.space = false;
        break;
      case 16: // SHIFT
        this.keys.shift = false;
        break;
    }
  }
};


class FiniteStateMachine {
  constructor() {
    this.states = {};
    this.currentState = null;
  }

  AddState(name, type) {
    this.states[name] = type;
  }

  SetState(name) {
    const prevState = this.currentState;
    
    if (prevState) {
      if (prevState.Name == name) {
        return;
      }
      prevState.Exit();
    }

    const state = new this.states[name](this);

    this.currentState = state;
    state.Enter(prevState);
  }

  Update(timeElapsed, input) {
    if (this.currentState) {
      this.currentState.Update(timeElapsed, input);
    }
  }
};


class CharacterFSM extends FiniteStateMachine {
  constructor(proxy) {
    super();
    this.proxy = proxy;
    this.Init();
  }

  Init() {
    this.AddState('idle', IdleState);
    this.AddState('walk', WalkState);
    this.AddState('run', RunState);
    this.AddState('jump', DanceState);
  }
};

class State {
  constructor(parent) {
    this.parent = parent;
  }

  Enter() {}
  Exit() {}
  Update() {}
};


class DanceState extends State {
  constructor(parent) {
    super(parent);

    this.FinishedCallback = () => {
      this.Finished();
    }
  }

  get Name() {
    return 'jump';
  }

  Enter(prevState) {
    const curAction = this.parent.proxy.animations['jump'].action;
    const mixer = curAction.getMixer();
    mixer.addEventListener('finished', this.FinishedCallback);

    if (prevState) {
      const prevAction = this.parent.proxy.animations[prevState.Name].action;

      curAction.reset();  
      curAction.setLoop(THREE.LoopOnce, 1);
      curAction.clampWhenFinished = true;
      curAction.crossFadeFrom(prevAction, 0.2, true);
      curAction.play();
    } else {
      curAction.play();
    }
  }

  Finished() {
    this.Cleanup();
    this.parent.SetState('idle');
  }

  Cleanup() {
    const action = this.parent.proxy.animations['jump'].action;
    
    action.getMixer().removeEventListener('finished', this.CleanupCallback);
  }

  Exit() {
    this.Cleanup();
  }

  Update(_) {
  }
};


class WalkState extends State {
  constructor(parent) {
    super(parent);
  }

  get Name() {
    return 'walk';
  }

  Enter(prevState) {
    const curAction = this.parent.proxy.animations['walk'].action;
    if (prevState) {
      const prevAction = this.parent.proxy.animations[prevState.Name].action;

      curAction.enabled = true;

      if (prevState.Name == 'run') {
        const ratio = curAction.getClip().duration / prevAction.getClip().duration;
        curAction.time = prevAction.time * ratio;
      } else {
        curAction.time = 0.0;
        curAction.setEffectiveTimeScale(1.0);
        curAction.setEffectiveWeight(1.0);
      }

      curAction.crossFadeFrom(prevAction, 0.5, true);
      curAction.play();
    } else {
      curAction.play();
    }
  }

  Exit() {
  }

  Update(timeElapsed, input) {
    if (input.keys.forward || input.keys.backward) {
      if (input.keys.shift) {
        this.parent.SetState('run');
      }
      return;
    }

    this.parent.SetState('idle');
  }
};


class RunState extends State {
  constructor(parent) {
    super(parent);
  }

  get Name() {
    return 'run';
  }

  Enter(prevState) {
    const curAction = this.parent.proxy.animations['run'].action;
    if (prevState) {
      const prevAction = this.parent.proxy.animations[prevState.Name].action;

      curAction.enabled = true;

      if (prevState.Name == 'walk') {
        const ratio = curAction.getClip().duration / prevAction.getClip().duration;
        curAction.time = prevAction.time * ratio;
      } else {
        curAction.time = 0.0;
        curAction.setEffectiveTimeScale(1.0);
        curAction.setEffectiveWeight(1.0);
      }

      curAction.crossFadeFrom(prevAction, 0.5, true);
      curAction.play();
    } else {
      curAction.play();
    }
  }

  Exit() {
  }

  Update(timeElapsed, input) {
    if (input.keys.forward || input.keys.backward) {
      if (!input.keys.shift) {
        this.parent.SetState('walk');
      }
      return;
    }

    this.parent.SetState('idle');
  }
};


class IdleState extends State {
  constructor(parent) {
    super(parent);
  }

  get Name() {
    return 'idle';
  }

  Enter(prevState) {
    const idleAction = this.parent.proxy.animations['idle'].action;
    if (prevState) {
      const prevAction = this.parent.proxy.animations[prevState.Name].action;
      idleAction.time = 0.0;
      idleAction.enabled = true;
      idleAction.setEffectiveTimeScale(1.0);
      idleAction.setEffectiveWeight(1.0);
      idleAction.crossFadeFrom(prevAction, 0.5, true);
      idleAction.play();
    } else {
      idleAction.play();
    }
  }

  Exit() {
  }

  Update(_, input) {
    if (input.keys.forward || input.keys.backward) {
      this.parent.SetState('walk');
    } else if (input.keys.space) {
      this.parent.SetState('jump');
    }
  }
};


class ThirdPersonCamera {
  constructor(params) {
    this.params = params;
    this.camera = params.camera;

    this.currentPosition = new THREE.Vector3();
    this.currentLookat = new THREE.Vector3();
  }

  CalculateIdealOffset() {
    const idealOffset = new THREE.Vector3(-15, 30, -30);
    idealOffset.applyQuaternion(this.params.target.Rotation);
    idealOffset.add(this.params.target.Position);
    return idealOffset;
  }

  CalculateIdealLookat() {
    const idealLookat = new THREE.Vector3(0, 10, 50);
    idealLookat.applyQuaternion(this.params.target.Rotation);
    idealLookat.add(this.params.target.Position);
    return idealLookat;
  }

  Update(timeElapsed) {
    const idealOffset = this.CalculateIdealOffset();
    const idealLookat = this.CalculateIdealLookat();

    const t = 1.0 - Math.pow(0.001, timeElapsed);

    this.currentPosition.lerp(idealOffset, t);
    this.currentLookat.lerp(idealLookat, t);

    this.camera.position.copy(this.currentPosition);
    this.camera.lookAt(this.currentLookat);
  }
}

class RigidBody {
  constructor() {
  }

  setRestitution(val) {
    this.body.setRestitution(val);
  }

  setFriction(val) {
    this.body.setFriction(val);
  }

  setRollingFriction(val) {
    this.body.setRollingFriction(val);
  }

  createBox(mass, pos, quat, size) {
    this.transform = new Ammo.btTransform();
    this.transform.setIdentity();
    this.transform.setOrigin(new Ammo.btVector3(pos.x, pos.y, pos.z));
    this.transform.setRotation(new Ammo.btQuaternion(quat.x, quat.y, quat.z, quat.w));
    this.motionState = new Ammo.btDefaultMotionState(this.transform);

    const btSize = new Ammo.btVector3(size.x * 0.5, size.y * 0.5, size.z * 0.5);
    this.shape = new Ammo.btBoxShape(btSize);
    this.shape.setMargin(0.05);

    this.inertia = new Ammo.btVector3(0, 0, 0);
    if (mass > 0) {
      this.shape.calculateLocalInertia(mass, this.inertia);
    }

    this.info = new Ammo.btRigidBodyConstructionInfo(
        mass, this.motionState, this.shape, this.inertia);
    this.body = new Ammo.btRigidBody(this.info);

    Ammo.destroy(btSize);
  }

  createSphere(mass, pos, size) {
    this.transform = new Ammo.btTransform();
    this.transform.setIdentity();
    this.transform.setOrigin(new Ammo.btVector3(pos.x, pos.y, pos.z));
    this.transform.setRotation(new Ammo.btQuaternion(0, 0, 0, 1));
    this.motionState = new Ammo.btDefaultMotionState(this.transform);

    this.shape = new Ammo.btSphereShape(size);
    this.shape.setMargin(0.05);

    this.inertia = new Ammo.btVector3(0, 0, 0);
    if(mass > 0) {
      this.shape.calculateLocalInertia(mass, this.inertia);
    }

    this.info = new Ammo.btRigidBodyConstructionInfo(mass, this.motionState, this.shape, this.inertia);
    this.body = new Ammo.btRigidBody(this.info);
  }
}



class WebSite {
  constructor() {
    this.Initialize();
  }

  Initialize() {

    this.collisionConfiguration = new Ammo.btDefaultCollisionConfiguration();
    this.dispatcher = new Ammo.btCollisionDispatcher(this.collisionConfiguration);
    this.broadphase = new Ammo.btDbvtBroadphase();
    this.solver = new Ammo.btSequentialImpulseConstraintSolver();
    this.physicsWorld = new Ammo.btDiscreteDynamicsWorld(
        this.dispatcher, this.broadphase, this.solver, this.collisionConfiguration);
    this.physicsWorld.setGravity(new Ammo.btVector3(0, -10, 0));

    this.threejs = new THREE.WebGLRenderer({
      antialias: true,
    });
    this.threejs.outputEncoding = THREE.sRGBEncoding;
    this.threejs.shadowMap.enabled = true;
    this.threejs.shadowMap.type = THREE.PCFSoftShadowMap;
    this.threejs.setPixelRatio(window.devicePixelRatio);
    this.threejs.setSize(window.innerWidth, window.innerHeight);

    document.body.appendChild(this.threejs.domElement);

    window.addEventListener('resize', () => {
      this.OnWindowResize();
    }, false);

    const fov = 75;
    const aspect = window.innerWidth / window.innerHeight;
    const near = 1.0;
    const far = 1000.0;
    this.camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
    this.camera.position.set(25, 10, 25);

    this.scene = new THREE.Scene();

    let light = new THREE.DirectionalLight(0xFFFFFF, 1.0);
    light.position.set(-100, 100, 100);
    light.target.position.set(0, 0, 0);
    light.castShadow = true;
    light.shadow.bias = -0.001;
    light.shadow.mapSize.width = 4096;
    light.shadow.mapSize.height = 4096;
    light.shadow.camera.near = 0.5;
    light.shadow.camera.far = 500.0;
    light.shadow.camera.left = 500;
    light.shadow.camera.right = -500;
    light.shadow.camera.top = 500; // Distance shadow
    light.shadow.camera.bottom = -500; // Distance shadow
    this.scene.add(light);

    light = new THREE.AmbientLight(0xFFFFFF, 0.25);
    this.scene.add(light);

    const ground = new THREE.Mesh(
      new THREE.BoxGeometry(100, 1, 100),
      new THREE.MeshStandardMaterial({color: 0x404040}));
    ground.castShadow = false;
    ground.receiveShadow = true;
    this.scene.add(ground);


    const rbground = new RigidBody();
    rbground.createBox(0, ground.position, ground.quaternion, new THREE.Vector3(100, 1, 100));
    rbground.setRestitution(0.99);
    this.physicsWorld.addRigidBody(rbground.body);

    this.rigidBodies = [];

    const box = new THREE.Mesh(
    new THREE.BoxGeometry(4, 4, 4),
    new THREE.MeshStandardMaterial({color: 0x808080}));
    box.position.set(10, 150, 10);
    box.castShadow = true;
    box.receiveShadow = true;
    this.scene.add(box);
      
    const rbBox = new RigidBody();
    rbBox.createBox(1, box.position, box.quaternion, new THREE.Vector3(4, 4, 4));
    rbBox.setRestitution(0.25);
    rbBox.setFriction(1);
    rbBox.setRollingFriction(5);
    this.physicsWorld.addRigidBody(rbBox.body);
          
    this.rigidBodies.push({mesh: box, rigidBody: rbBox});

    this.tmpTransform = new Ammo.btTransform();
    this.mixers = [];
    this.previousRAF = null;

    //Background
    this.spaceTexture = new THREE.TextureLoader().load('./assets/scene/space.jpg');
    this.scene.background = this.spaceTexture;
    //this.scene.background = new THREE.Color( 0xff0000 );

    this.LoadAnimatedModel();
    this.RAF();
    
  }

  LoadAnimatedModel() {
    const params = {
      camera: this.camera,
      scene: this.scene,
    }
    
    this.controls = new BasicCharacterController(params);

    this.thirdPersonCamera = new ThirdPersonCamera({
      camera: this.camera,
      target: this.controls,
    });
  }

  OnWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.threejs.setSize(window.innerWidth, window.innerHeight);
  }

  RAF() {
    requestAnimationFrame((t) => {
      if (this.previousRAF === null) {
        this.previousRAF = t;
      }

      this.RAF();

      this.threejs.render(this.scene, this.camera);
      this.Step(t - this.previousRAF);
      this.previousRAF = t;
    });
  }

  spawn() {
    const scale = Math.random() * 4 + 4;
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(scale, scale, scale),
      new THREE.MeshStandardMaterial({
          color: 0x808080,
      }));
    box.position.set(Math.random() * 2 - 1, 200.0, Math.random() * 2 - 1);
    box.quaternion.set(0, 0, 0, 1);
    box.castShadow = true;
    box.receiveShadow = true;

    const rb = new RigidBody();
    rb.createBox(10, box.position, box.quaternion, new THREE.Vector3(scale, scale, scale), null);
    rb.setRestitution(0.125);
    rb.setFriction(1);
    rb.setRollingFriction(5);

    this.physicsWorld.addRigidBody(rb.body);

    this.rigidBodies.push({mesh: box, rigidBody: rb});

    const playerBody = new THREE.Mesh(
      new THREE.BoxGeometry(13, 75, 20),
      new THREE.MeshStandardMaterial({color: 0xff0000}));
      this.scene.add(playerBody);

    this.scene.add(box);
  }


  Step(timeElapsed) {
    const timeElapsedS = timeElapsed * 0.001;
    if (this.mixers) {
      this.mixers.map(m => m.update(timeElapsedS));
    }

    if (this.controls) {
      this.controls.Update(timeElapsedS);
    }

    this.physicsWorld.stepSimulation(timeElapsedS, 10);

    this.thirdPersonCamera.Update(timeElapsedS);

    this.countdown -= timeElapsedS;
    if (this.countdown < 0 && this.count < 10) {
      this.countdown = 0.25;
      this.count += 1;
      this.spawn();
    }

    this.physicsWorld.stepSimulation(timeElapsedS, 10);

    for (let i = 0; i < this.rigidBodies.length; ++i) {
      this.rigidBodies[i].rigidBody.motionState.getWorldTransform(this.tmpTransform);
      const pos = this.tmpTransform.getOrigin();
      const quat = this.tmpTransform.getRotation();
      const pos3 = new THREE.Vector3(pos.x(), pos.y(), pos.z());
      const quat3 = new THREE.Quaternion(quat.x(), quat.y(), quat.z(), quat.w());

      this.rigidBodies[i].mesh.position.copy(pos3);
      this.rigidBodies[i].mesh.quaternion.copy(quat3);
    }
  }
}


let APP = null;

window.addEventListener('DOMContentLoaded', async () => {
  Ammo().then((lib) =>{
    Ammo = lib;
    APP = new WebSite();
  });
});