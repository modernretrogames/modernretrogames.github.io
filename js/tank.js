import * as THREE from 'three';

let nextTankId = 0;

export class Tank {
    constructor(playerId, color) {
        this.id = nextTankId++;
        this.playerId = playerId;
        this.position = new THREE.Vector3();
        this.health = 100;
        this.maxHealth = 100;
        this.turretAngle = 0;
        this.barrelElevation = Math.PI / 6;
        this.activeWeaponIndex = 0;
        this.alive = true;
        this.color = color;
        this.falling = false;
        this.fallVelocity = 0;
        this.fallStartY = 0;

        this.ammo = {};
        this.hullQuaternion = new THREE.Quaternion();

        this.moving = false;
        this.moveDirection = new THREE.Vector3();
        this.moveDistanceRemaining = 0;
    }

    takeDamage(amount) {
        if (!this.alive) return;
        this.health = Math.max(0, this.health - amount);
        if (this.health <= 0) {
            this.alive = false;
        }
    }

    getBarrelTip() {
        const barrelLength = 2.0;
        const turretHeight = 0.8;
        const dir = new THREE.Vector3(
            Math.sin(this.turretAngle) * Math.cos(this.barrelElevation),
            Math.sin(this.barrelElevation),
            Math.cos(this.turretAngle) * Math.cos(this.barrelElevation)
        );
        const offset = new THREE.Vector3(
            dir.x * barrelLength,
            turretHeight + dir.y * barrelLength,
            dir.z * barrelLength
        );
        offset.applyQuaternion(this.hullQuaternion);
        return this.position.clone().add(offset);
    }

    getFireDirection() {
        return new THREE.Vector3(
            Math.sin(this.turretAngle) * Math.cos(this.barrelElevation),
            Math.sin(this.barrelElevation),
            Math.cos(this.turretAngle) * Math.cos(this.barrelElevation)
        ).normalize().applyQuaternion(this.hullQuaternion);
    }

    getMoveDirection() {
        return new THREE.Vector3(
            Math.sin(this.turretAngle),
            0,
            Math.cos(this.turretAngle)
        ).normalize();
    }
}
