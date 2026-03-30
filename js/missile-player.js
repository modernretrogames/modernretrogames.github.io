import * as THREE from 'three';
import { clamp } from './utils.js';

const MOVE_SPEED = 10;
const MOUSE_SENSITIVITY = 0.002;
const PLAYER_HEIGHT = 8;

export class MissilePlayer {
    constructor(canvas, world) {
        this.world = world;
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 800);

        this.position = new THREE.Vector3(0, 0, 0);
        this.yaw = 0;
        this.pitch = 0.5;

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

    reset(spawnPos) {
        this.position.copy(spawnPos);
        this.yaw = 0;
        this.pitch = 0.5;
        this._keys = { w: false, a: false, s: false, d: false };
    }

    getTerrainHeight(wx, wz) {
        const v = this.world.worldToVoxel(wx, 0, wz);
        const topY = this.world.getHighestSolidY(v.x, v.z);
        if (topY < 0) return 0;
        const wp = this.world.voxelToWorld(0, topY + 1, 0);
        return wp.y;
    }

    getAimTarget() {
        const dir = new THREE.Vector3(0, 0, -1);
        dir.applyQuaternion(this.camera.quaternion);
        dir.normalize();

        if (dir.y > 0.01) {
            const targetAlt = this.camera.position.y + dir.y * 200;
            const t = (targetAlt - this.camera.position.y) / dir.y;
            return new THREE.Vector3(
                this.camera.position.x + dir.x * t,
                targetAlt,
                this.camera.position.z + dir.z * t
            );
        }

        return this.camera.position.clone().add(dir.multiplyScalar(100));
    }

    getFireDirection() {
        const dir = new THREE.Vector3(0, 0, -1);
        dir.applyQuaternion(this.camera.quaternion);
        return dir.normalize();
    }

    update(dt) {
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

        const worldHalfX = (this.world.sizeX * this.world.voxelSize) / 2;
        const worldHalfZ = (this.world.sizeZ * this.world.voxelSize) / 2;
        this.position.x = clamp(this.position.x, -worldHalfX + 2, worldHalfX - 2);
        this.position.z = clamp(this.position.z, -worldHalfZ + 2, worldHalfZ - 2);

        const terrainH = this.getTerrainHeight(
            this.position.x + worldHalfX,
            this.position.z + worldHalfZ
        );
        this.position.y = terrainH;

        this.camera.position.set(this.position.x, this.position.y + PLAYER_HEIGHT, this.position.z);

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
