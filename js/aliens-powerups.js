import * as THREE from 'three';

const FALL_SPEED = 5;
const SPIN_SPEED = 2;
const COLLECT_RADIUS = 2.5;
const VOXEL_SIZE = 0.25;
const CUBE_DIM = 4;

const POWERUP_TYPES = [
    { id: 'rapid_fire',  name: 'RAPID FIRE',  color: 0xff8800, duration: 10 },
    { id: 'spread_shot', name: 'SPREAD SHOT', color: 0x8800ff, duration: 10 },
    { id: 'shield',      name: 'SHIELD',      color: 0x00aaff, duration: 0 },
    { id: 'bomb',        name: 'BOMB',        color: 0xff0044, duration: 0 },
    { id: 'extra_life',  name: 'EXTRA LIFE',  color: 0xff3366, duration: 0 },
    { id: 'score_x2',    name: 'SCORE x2',    color: 0xffcc00, duration: 15 },
];

function buildPowerupMesh(color) {
    const geo = new THREE.BoxGeometry(VOXEL_SIZE, VOXEL_SIZE, VOXEL_SIZE);
    const mat = new THREE.MeshPhongMaterial({
        color,
        emissive: new THREE.Color(color).multiplyScalar(0.3),
        shininess: 60,
        transparent: true,
        opacity: 0.9,
    });
    const count = CUBE_DIM * CUBE_DIM * CUBE_DIM;
    const mesh = new THREE.InstancedMesh(geo, mat, count);

    const dummy = new THREE.Object3D();
    let i = 0;
    const half = (CUBE_DIM - 1) / 2;
    for (let y = 0; y < CUBE_DIM; y++) {
        for (let z = 0; z < CUBE_DIM; z++) {
            for (let x = 0; x < CUBE_DIM; x++) {
                dummy.position.set(
                    (x - half) * VOXEL_SIZE,
                    (y - half) * VOXEL_SIZE,
                    (z - half) * VOXEL_SIZE
                );
                dummy.updateMatrix();
                mesh.setMatrixAt(i++, dummy.matrix);
            }
        }
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = true;

    const glow = new THREE.PointLight(color, 1.5, 6);
    mesh.add(glow);

    return mesh;
}

class PowerUp {
    constructor(scene, position, typeIdx) {
        this.typeDef = POWERUP_TYPES[typeIdx];
        this.active = true;
        this.position = position.clone();
        this.mesh = buildPowerupMesh(this.typeDef.color);
        this.mesh.position.copy(this.position);
        scene.add(this.mesh);
        this.scene = scene;
        this._spinAngle = 0;
    }

    update(dt) {
        if (!this.active) return;
        this.position.y -= FALL_SPEED * dt;
        this._spinAngle += SPIN_SPEED * dt;
        this.mesh.position.copy(this.position);
        this.mesh.rotation.y = this._spinAngle;
        this.mesh.rotation.x = Math.sin(this._spinAngle * 0.7) * 0.3;

        if (this.position.y < -2) {
            this.deactivate();
        }
    }

    deactivate() {
        this.active = false;
        this.mesh.visible = false;
    }

    dispose() {
        this.scene.remove(this.mesh);
        this.mesh.geometry.dispose();
        this.mesh.material.dispose();
    }
}

export class PowerUpManager {
    constructor(scene, particleSystem) {
        this.scene = scene;
        this.particles = particleSystem;
        this.powerups = [];
        this.activeEffects = new Map();
    }

    spawn(position) {
        const typeIdx = Math.floor(Math.random() * POWERUP_TYPES.length);
        const pu = new PowerUp(this.scene, position, typeIdx);
        this.powerups.push(pu);
    }

    clear() {
        for (const pu of this.powerups) {
            pu.dispose();
        }
        this.powerups = [];
        this.activeEffects.clear();
    }

    update(dt, player, state, audio) {
        for (const pu of this.powerups) {
            if (!pu.active) continue;
            pu.update(dt);
            if (!pu.active) continue;

            const dist = pu.position.distanceTo(player.camera.position);
            if (dist < COLLECT_RADIUS) {
                this._applyPowerup(pu.typeDef, player, state, audio);
                this.particles.emit(pu.position.clone(), 15, {
                    color: new THREE.Color(pu.typeDef.color),
                    speed: 6,
                    spread: 1,
                    life: 0.6,
                    size: 0.2,
                    gravity: false,
                });
                pu.deactivate();
            }
        }

        for (const [id, timer] of this.activeEffects) {
            const remaining = timer - dt;
            if (remaining <= 0) {
                this._expirePowerup(id, player, state);
                this.activeEffects.delete(id);
            } else {
                this.activeEffects.set(id, remaining);
            }
        }

        this.powerups = this.powerups.filter(pu => pu.active || pu.position.y > -10);
        this._updateHUD();
    }

    _applyPowerup(typeDef, player, state, audio) {
        if (audio) audio.play('powerup');

        switch (typeDef.id) {
            case 'rapid_fire':
                player.rapidFire = true;
                this.activeEffects.set('rapid_fire', typeDef.duration);
                break;
            case 'spread_shot':
                player.spreadShot = true;
                this.activeEffects.set('spread_shot', typeDef.duration);
                break;
            case 'shield':
                player.shielded = true;
                break;
            case 'bomb':
                if (window._alienFormation) {
                    const alive = window._alienFormation.aliens.filter(a => a.alive);
                    const toKill = alive.slice(0, Math.min(10, alive.length));
                    for (const alien of toKill) {
                        const points = window._alienFormation.removeAlien(alien);
                        if (state) state.score += points;
                        if (this.particles) {
                            this.particles.emit(alien.getWorldPos(), 15, {
                                color: new THREE.Color(0xff4400),
                                speed: 8, spread: 1.5, life: 0.6, size: 0.3, gravity: true,
                            });
                        }
                    }
                    if (audio) audio.play('explosion', { radius: 5 });
                }
                break;
            case 'extra_life':
                player.lives = Math.min(player.lives + 1, player.maxLives);
                break;
            case 'score_x2':
                if (state) state._scoreMultiplier = 2;
                this.activeEffects.set('score_x2', typeDef.duration);
                break;
        }
    }

    _expirePowerup(id, player, state) {
        switch (id) {
            case 'rapid_fire':
                player.rapidFire = false;
                break;
            case 'spread_shot':
                player.spreadShot = false;
                break;
            case 'score_x2':
                if (state) state._scoreMultiplier = 1;
                break;
        }
    }

    _updateHUD() {
        const el = document.getElementById('hud-powerup');
        if (!el) return;
        if (this.activeEffects.size === 0) {
            el.classList.add('hidden');
            return;
        }
        el.classList.remove('hidden');
        const parts = [];
        for (const [id, timer] of this.activeEffects) {
            const def = POWERUP_TYPES.find(t => t.id === id);
            if (def) parts.push(`${def.name}: ${Math.ceil(timer)}s`);
        }
        el.textContent = parts.join(' | ');
    }

    dispose() {
        this.clear();
    }
}
