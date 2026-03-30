import * as THREE from 'three';

const PLAYER_LASER_SPEED = 80;
const ALIEN_LASER_SPEED = 30;
const LASER_MAX_Y = 80;
const LASER_MIN_Y = -2;
const POOL_SIZE = 30;
const PLAYER_LASER_COLOR = 0x00ff88;
const ALIEN_LASER_COLOR = 0xff4422;
const LASER_LENGTH = 1.5;
const LASER_WIDTH = 0.08;

class Laser {
    constructor() {
        const geo = new THREE.BoxGeometry(LASER_WIDTH, LASER_LENGTH, LASER_WIDTH);
        this.meshPlayer = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
            color: PLAYER_LASER_COLOR,
            transparent: true,
            opacity: 0.9,
        }));
        this.meshAlien = new THREE.Mesh(geo.clone(), new THREE.MeshBasicMaterial({
            color: ALIEN_LASER_COLOR,
            transparent: true,
            opacity: 0.9,
        }));
        this.meshPlayer.visible = false;
        this.meshAlien.visible = false;

        this.glowPlayer = new THREE.PointLight(PLAYER_LASER_COLOR, 2, 8);
        this.glowAlien = new THREE.PointLight(ALIEN_LASER_COLOR, 2, 8);
        this.meshPlayer.add(this.glowPlayer);
        this.meshAlien.add(this.glowAlien);

        this.position = new THREE.Vector3();
        this.direction = new THREE.Vector3();
        this.speed = 0;
        this.active = false;
        this.isPlayer = true;
    }

    fire(position, direction, isPlayer) {
        this.position.copy(position);
        this.direction.copy(direction).normalize();
        this.isPlayer = isPlayer;
        this.speed = isPlayer ? PLAYER_LASER_SPEED : ALIEN_LASER_SPEED;
        this.active = true;

        const mesh = isPlayer ? this.meshPlayer : this.meshAlien;
        mesh.visible = true;
        mesh.position.copy(position);

        if (this.direction.lengthSq() > 0) {
            const up = new THREE.Vector3(0, 1, 0);
            const quat = new THREE.Quaternion();
            quat.setFromUnitVectors(up, this.direction);
            mesh.quaternion.copy(quat);
        }

        (isPlayer ? this.meshAlien : this.meshPlayer).visible = false;
    }

    update(dt) {
        if (!this.active) return;
        this.position.addScaledVector(this.direction, this.speed * dt);
        const mesh = this.isPlayer ? this.meshPlayer : this.meshAlien;
        mesh.position.copy(this.position);

        if (this.position.y > LASER_MAX_Y || this.position.y < LASER_MIN_Y ||
            Math.abs(this.position.x) > 80 || Math.abs(this.position.z) > 80) {
            this.deactivate();
        }
    }

    deactivate() {
        this.active = false;
        this.meshPlayer.visible = false;
        this.meshAlien.visible = false;
    }
}

export class LaserManager {
    constructor(scene, particleSystem, audio) {
        this.scene = scene;
        this.particles = particleSystem;
        this.audio = audio;
        this.pool = [];

        for (let i = 0; i < POOL_SIZE; i++) {
            const laser = new Laser();
            scene.add(laser.meshPlayer);
            scene.add(laser.meshAlien);
            this.pool.push(laser);
        }
    }

    _getFromPool() {
        for (const l of this.pool) {
            if (!l.active) return l;
        }
        return null;
    }

    firePlayerLaser(origin, direction) {
        const laser = this._getFromPool();
        if (!laser) return;
        laser.fire(origin, direction, true);
        if (this.audio) this.audio.play('laser');
    }

    firePlayerSpread(origin, direction) {
        const angles = [-0.08, 0, 0.08];
        for (const angle of angles) {
            const laser = this._getFromPool();
            if (!laser) return;
            const dir = direction.clone();
            dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
            laser.fire(origin, dir, true);
        }
        if (this.audio) this.audio.play('laser');
    }

    fireAlienLaser(origin, targetPos) {
        const laser = this._getFromPool();
        if (!laser) return;

        let dir;
        if (targetPos) {
            dir = new THREE.Vector3().subVectors(targetPos, origin).normalize();
            const inaccuracy = 0.12;
            dir.x += (Math.random() - 0.5) * inaccuracy;
            dir.z += (Math.random() - 0.5) * inaccuracy;
            dir.normalize();
        } else {
            dir = new THREE.Vector3(0, -1, 0);
        }

        laser.fire(origin, dir, false);
        if (this.audio) this.audio.play('alienLaser');
    }

    clear() {
        for (const l of this.pool) {
            l.deactivate();
        }
    }

    update(dt, alienFormation, shieldManager, player, powerUpManager, state) {
        let playerHit = false;
        let scoreAdded = false;

        if (alienFormation && alienFormation.pendingShots) {
            const targetPos = player ? player.camera.position.clone() : null;
            for (const pos of alienFormation.pendingShots) {
                this.fireAlienLaser(pos, targetPos);
            }
            alienFormation.pendingShots = [];
        }

        for (const laser of this.pool) {
            if (!laser.active) continue;
            laser.update(dt);
            if (!laser.active) continue;

            if (laser.isPlayer && alienFormation) {
                const alien = alienFormation.getAlienAt(laser.position, 0.5);
                if (alien) {
                    const points = alienFormation.removeAlien(alien);
                    const multiplier = (state && state._scoreMultiplier) ? state._scoreMultiplier : 1;
                    if (state) state.score += points * multiplier;
                    scoreAdded = true;

                    this.particles.emit(laser.position.clone(), 20, {
                        color: new THREE.Color().copy(ALIEN_TYPES_COLORS[alien.type] || new THREE.Color(0x00ff66)),
                        speed: 10,
                        spread: 1.2,
                        life: 0.8,
                        size: 0.25,
                        gravity: true,
                    });
                    if (this.audio) this.audio.play('alienDeath');

                    if (powerUpManager && Math.random() < 0.15) {
                        powerUpManager.spawn(alien.getWorldPos());
                    }

                    laser.deactivate();
                    continue;
                }
            }

            if (!laser.isPlayer && player && player.alive && !player.invulnerable) {
                const dist = laser.position.distanceTo(player.camera.position);
                if (dist < 1.2) {
                    playerHit = true;
                    laser.deactivate();
                    continue;
                }
            }

            if (shieldManager) {
                const hit = shieldManager.checkLaserHit(laser.position, 0.3);
                if (hit) {
                    this.particles.emit(laser.position.clone(), 8, {
                        color: new THREE.Color(0x00ff88),
                        speed: 4,
                        spread: 1,
                        life: 0.5,
                        size: 0.15,
                        gravity: false,
                    });
                    laser.deactivate();
                    continue;
                }
            }
        }

        return { playerHit, scoreAdded };
    }

    dispose() {
        for (const laser of this.pool) {
            this.scene.remove(laser.meshPlayer);
            this.scene.remove(laser.meshAlien);
            laser.meshPlayer.geometry.dispose();
            laser.meshPlayer.material.dispose();
            laser.meshAlien.geometry.dispose();
            laser.meshAlien.material.dispose();
        }
    }
}

const ALIEN_TYPES_COLORS = {
    squid: new THREE.Color(0x00ff66),
    crab: new THREE.Color(0x00ccff),
    octopus: new THREE.Color(0xff44cc),
};
