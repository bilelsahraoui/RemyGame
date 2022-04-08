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
      case 37: // left
        this.keys.left = true;
        break;
      case 40: // back
        this.keys.backward = true;
        break;
      case 39: // right
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
      case 37: // left
        this.keys.left = false;
        break;
      case 40: // back
        this.keys.backward = false;
        break;
      case 39: // right
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


class WebSite {
  constructor() {
    this.Initialize();
  }

  Initialize() {
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
    light.shadow.camera.near = 0.1;
    light.shadow.camera.far = 500.0;
    light.shadow.camera.near = 0.5;
    light.shadow.camera.far = 500.0;
    light.shadow.camera.left = 50;
    light.shadow.camera.right = -50;
    light.shadow.camera.top = 50;
    light.shadow.camera.bottom = -50;
    this.scene.add(light);

    light = new THREE.AmbientLight(0xFFFFFF, 0.25);
    this.scene.add(light);

    const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(100, 100, 10, 10),
        new THREE.MeshStandardMaterial({
            color: 0x808080,
          }));
    plane.castShadow = false;
    plane.receiveShadow = true;
    plane.rotation.x = -Math.PI / 2;
    this.scene.add(plane);

    this.mixers = [];
    this.previousRAF = null;

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

  Step(timeElapsed) {
    const timeElapsedS = timeElapsed * 0.001;
    if (this.mixers) {
      this.mixers.map(m => m.update(timeElapsedS));
    }

    if (this.controls) {
      this.controls.Update(timeElapsedS);
    }

    this.thirdPersonCamera.Update(timeElapsedS);
  }
}


let APP = null;

window.addEventListener('DOMContentLoaded', () => {
  APP = new WebSite();
});