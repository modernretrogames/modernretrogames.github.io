import * as THREE from 'three';
import { clamp } from './utils.js';

const MOVE_SPEED = 12;
const MOUSE_SENSITIVITY = 0.002;
const ARENA_HALF = 48;
const PLAYER_HEIGHT = 1.7;

export class Player {
    constructor(canvas) {
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 500);
        this.camera.position.set(0, PLAYER_HEIGHT, 0);

        this.position = new THREE.Vector3(0, 0, 0);
        this.yaw = 0;
        this.pitch = 0.4;
        this.lives = 3;
        this.maxLives = 5;
        this.alive = true;
        this.invulnerable = false;
        this.invulnerableTimer = 0;
        this.shielded = false;

        this.fireCooldown = 0;
        this.baseCooldown = 0.4;
        this.rapidFire = false;
        this.spreadShot = false;

        this._keys = { w: false, a: false, s: false, d: false };
        this._locked = false;
        this._canvas = canvas;

        this._onKeyDown = this._onKeyDown.bind(this);
        this._onKeyUp = this._onKeyUp.bind(this);
        this._onMouseMove = this._onMouseMove.bind(this);
        this._onLockChange = this._onLockChange.bind(this);

        document.addEventListener('keydown', this._onKeyDown);
        document.addEventListener('keyup', this._onKeyUp);
        document.addEventListener('mousemove', this._onMouseMove);
        document.addEventListener('pointerlockchange', this._onLockChange);

        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
        });
    }

    requestPointerLock() {
        this._canvas.requestPointerLock();
    }

    exitPointerLock() {
        if (document.pointerLockElement) {
            document.exitPointerLock();
        }
    }

    get isLocked() {
        return this._locked;
    }

    reset() {
        this.position.set(0, 0, 0);
        this.yaw = 0;
        this.pitch = 0.4;
        this.lives = 3;
        this.alive = true;
        this.invulnerable = false;
        this.invulnerableTimer = 0;
        this.shielded = false;
        this.fireCooldown = 0;
        this.rapidFire = false;
        this.spreadShot = false;
        this._keys = { w: false, a: false, s: false, d: false };
    }

    hit() {
        if (this.invulnerable) return false;
        if (this.shielded) {
            this.shielded = false;
            this.invulnerable = true;
            this.invulnerableTimer = 1.0;
            return false;
        }
        this.lives--;
        if (this.lives <= 0) {
            this.alive = false;
        }
        this.invulnerable = true;
        this.invulnerableTimer = 2.0;
        return true;
    }

    canFire() {
        return this.fireCooldown <= 0 && this.alive;
    }

    getFireOrigin() {
        return new THREE.Vector3(
            this.position.x,
            PLAYER_HEIGHT + 0.2,
            this.position.z
        );
    }

    getFireDirection() {
        const dir = new THREE.Vector3(0, 0, -1);
        dir.applyQuaternion(this.camera.quaternion);
        return dir.normalize();
    }

    fire() {
        this.fireCooldown = this.rapidFire ? this.baseCooldown / 3 : this.baseCooldown;
    }

    update(dt) {
        if (this.fireCooldown > 0) {
            this.fireCooldown -= dt;
        }

        if (this.invulnerable) {
            this.invulnerableTimer -= dt;
            if (this.invulnerableTimer <= 0) {
                this.invulnerable = false;
            }
        }

        if (!this._locked) return;

        const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
        const right = new THREE.Vector3(-forward.z, 0, forward.x);

        const move = new THREE.Vector3();
        if (this._keys.w) move.add(forward);
        if (this._keys.s) move.sub(forward);
        if (this._keys.a) move.sub(right);
        if (this._keys.d) move.add(right);

        if (move.lengthSq() > 0) {
            move.normalize().multiplyScalar(MOVE_SPEED * dt);
            this.position.add(move);
        }

        this.position.x = clamp(this.position.x, -ARENA_HALF, ARENA_HALF);
        this.position.z = clamp(this.position.z, -ARENA_HALF, ARENA_HALF);

        this.camera.position.set(this.position.x, PLAYER_HEIGHT, this.position.z);

        const euler = new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ');
        this.camera.quaternion.setFromEuler(euler);
    }

    _onKeyDown(e) {
        const key = e.key.toLowerCase();
        if (key in this._keys) this._keys[key] = true;
    }

    _onKeyUp(e) {
        const key = e.key.toLowerCase();
        if (key in this._keys) this._keys[key] = false;
    }

    _onMouseMove(e) {
        if (!this._locked) return;
        this.yaw -= e.movementX * MOUSE_SENSITIVITY;
        this.pitch -= e.movementY * MOUSE_SENSITIVITY;
        this.pitch = clamp(this.pitch, -Math.PI / 2 + 0.05, Math.PI / 2 - 0.05);
    }

    _onLockChange() {
        this._locked = document.pointerLockElement === this._canvas;
    }

    dispose() {
        document.removeEventListener('keydown', this._onKeyDown);
        document.removeEventListener('keyup', this._onKeyUp);
        document.removeEventListener('mousemove', this._onMouseMove);
        document.removeEventListener('pointerlockchange', this._onLockChange);
    }
}
