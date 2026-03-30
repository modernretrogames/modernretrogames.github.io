import * as THREE from 'three';
import { clamp, lerp } from './utils.js';

export class CameraController {
    constructor() {
        this.camera = new THREE.PerspectiveCamera(
            60,
            window.innerWidth / window.innerHeight,
            0.1,
            800
        );

        this.target = new THREE.Vector3(0, 0, 0);
        this._targetGoal = new THREE.Vector3(0, 0, 0);
        this._transitioning = false;
        this._transitionSpeed = 3.0;

        this.distance = 60;
        this.minDistance = 5;
        this.maxDistance = 200;
        this.phi = Math.PI / 4;
        this.theta = Math.PI / 4;
        this.minPhi = 0.1;
        this.maxPhi = Math.PI / 2 - 0.05;

        this._dragging = false;
        this._panning = false;
        this._lastMouse = { x: 0, y: 0 };
        this._rotateSpeed = 0.005;
        this._panSpeed = 0.05;

        this._followTank = null;
        this._followActive = false;

        this._updatePosition();
        this._bindEvents();

        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
        });
    }

    _bindEvents() {
        const canvas = document.getElementById('game-canvas');

        canvas.addEventListener('mousedown', (e) => {
            if (e.button === 0) this._dragging = true;
            if (e.button === 2) this._panning = true;
            this._lastMouse.x = e.clientX;
            this._lastMouse.y = e.clientY;
        });

        window.addEventListener('mouseup', (e) => {
            if (e.button === 0) this._dragging = false;
            if (e.button === 2) this._panning = false;
        });

        window.addEventListener('mousemove', (e) => {
            const dx = e.clientX - this._lastMouse.x;
            const dy = e.clientY - this._lastMouse.y;
            this._lastMouse.x = e.clientX;
            this._lastMouse.y = e.clientY;

            if (this._dragging) {
                this.theta -= dx * this._rotateSpeed;
                this.phi = clamp(
                    this.phi - dy * this._rotateSpeed,
                    this.minPhi,
                    this.maxPhi
                );
            }

            if (this._panning) {
                const right = new THREE.Vector3();
                const up = new THREE.Vector3(0, 1, 0);
                right.crossVectors(
                    this.camera.getWorldDirection(new THREE.Vector3()),
                    up
                ).normalize();

                this.target.addScaledVector(right, -dx * this._panSpeed);
                this.target.y += dy * this._panSpeed;
                this._targetGoal.copy(this.target);
            }
        });

        canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            this.distance *= 1 + e.deltaY * 0.001;
            this.distance = clamp(this.distance, this.minDistance, this.maxDistance);
        }, { passive: false });

        canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    setTarget(position) {
        this._targetGoal.copy(position);
        this._transitioning = true;
    }

    setFollowTank(tank) {
        this._followTank = tank;
        this._followActive = true;
    }

    clearFollowTank() {
        if (!this._followTank) return;
        const tank = this._followTank;
        this._followActive = false;
        this._followTank = null;

        const abovePos = tank.position.clone().add(new THREE.Vector3(0, 3, 0));
        this.target.copy(abovePos);
        this._targetGoal.copy(abovePos);
        this._transitioning = false;
        this.distance = 20;
        this.phi = Math.PI / 5;
    }

    get isFollowing() {
        return this._followActive && this._followTank;
    }

    update(dt) {
        if (this._followActive && this._followTank) {
            this._updateFollowCamera();
            return;
        }

        if (this._transitioning) {
            this.target.lerp(this._targetGoal, clamp(this._transitionSpeed * dt, 0, 1));
            if (this.target.distanceTo(this._targetGoal) < 0.01) {
                this.target.copy(this._targetGoal);
                this._transitioning = false;
            }
        }

        this._updatePosition();
    }

    _updateFollowCamera() {
        const tank = this._followTank;
        const turretHeight = 1.2;
        const camOffset = new THREE.Vector3(0, turretHeight, 0);
        camOffset.applyQuaternion(tank.hullQuaternion);
        const camPos = tank.position.clone().add(camOffset);

        const dir = tank.getFireDirection();
        const lookTarget = camPos.clone().add(dir.multiplyScalar(20));

        this.camera.position.copy(camPos);
        this.camera.lookAt(lookTarget);
    }

    _updatePosition() {
        const x = this.target.x + this.distance * Math.sin(this.phi) * Math.cos(this.theta);
        const y = this.target.y + this.distance * Math.cos(this.phi);
        const z = this.target.z + this.distance * Math.sin(this.phi) * Math.sin(this.theta);

        this.camera.position.set(x, Math.max(y, 1), z);
        this.camera.lookAt(this.target);
    }
}
