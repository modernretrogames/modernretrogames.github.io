import * as THREE from 'three';
import { VoxelType } from './voxel-world.js';

const GRAVITY = 9.81;
const SUB_STEPS = 8;
const MAX_FLIGHT_TIME = 30;

export class Projectile {
    constructor() {
        this.position = new THREE.Vector3();
        this.velocity = new THREE.Vector3();
        this.active = false;
        this.weapon = null;
        this.owner = null;
        this.flightTime = 0;
        this.trail = [];
        this.maxTrailLength = 60;
        this.children = [];
        this.isChild = false;
        this.hasPassedApex = false;
    }

    fire(origin, direction, power, weapon, wind) {
        this.position.copy(origin);
        const speed = power * 50 * weapon.projectileSpeed;
        this.velocity.copy(direction).multiplyScalar(speed);
        this.active = true;
        this.weapon = weapon;
        this.flightTime = 0;
        this.trail = [];
        this.children = [];
        this.hasPassedApex = false;
        this.wind = wind || new THREE.Vector2(0, 0);
    }

    update(dt, world, tanks) {
        if (!this.active) return null;

        this.flightTime += dt;
        if (this.flightTime > MAX_FLIGHT_TIME) {
            this.active = false;
            return { type: 'out_of_bounds', position: this.position.clone() };
        }

        const subDt = dt / SUB_STEPS;

        for (let step = 0; step < SUB_STEPS; step++) {
            const prevVelY = this.velocity.y;

            this.velocity.y -= GRAVITY * (this.weapon?.gravityMultiplier || 1) * subDt;

            this.velocity.x += (this.wind?.x || 0) * subDt;
            this.velocity.z += (this.wind?.y || 0) * subDt;

            this.position.addScaledVector(this.velocity, subDt);

            if (!this.hasPassedApex && prevVelY > 0 && this.velocity.y <= 0) {
                this.hasPassedApex = true;
                if (this.weapon?.special === 'cluster' && !this.isChild) {
                    return { type: 'cluster_split', position: this.position.clone(), velocity: this.velocity.clone() };
                }
            }

            if (this.position.y < -5 ||
                this.position.x < -10 || this.position.x > world.sizeX * world.voxelSize + 10 ||
                this.position.z < -10 || this.position.z > world.sizeZ * world.voxelSize + 10) {
                this.active = false;
                return { type: 'out_of_bounds', position: this.position.clone() };
            }

            const vc = world.worldToVoxel(this.position.x, this.position.y, this.position.z);
            const hitVoxel = world.getVoxel(vc.x, vc.y, vc.z);
            if (hitVoxel !== VoxelType.AIR && hitVoxel !== VoxelType.WATER) {
                this.active = false;
                return { type: 'terrain_hit', position: this.position.clone() };
            }

            for (const tank of tanks) {
                if (!tank.alive) continue;
                if (tank.id === this.owner) continue;
                const dx = this.position.x - tank.position.x;
                const dy = this.position.y - (tank.position.y + 0.5);
                const dz = this.position.z - tank.position.z;
                if (Math.abs(dx) < 1.0 && Math.abs(dy) < 1.0 && Math.abs(dz) < 1.2) {
                    this.active = false;
                    return { type: 'tank_hit', position: this.position.clone(), tankId: tank.id };
                }
            }
        }

        this.trail.push(this.position.clone());
        if (this.trail.length > this.maxTrailLength) {
            this.trail.shift();
        }

        return null;
    }
}

export class ProjectileRenderer {
    constructor(scene, particleSystem) {
        this.scene = scene;
        this.particleSystem = particleSystem;
        this.shellGroup = null;
        this.light = null;
        this._smokeTimer = 0;
        this._lastVelocity = new THREE.Vector3();
    }

    show(projectile) {
        if (!this.shellGroup) {
            this.shellGroup = new THREE.Group();

            const bodyGeo = new THREE.CylinderGeometry(0.08, 0.12, 0.5, 8);
            bodyGeo.rotateX(Math.PI / 2);
            const bodyMat = new THREE.MeshPhongMaterial({
                color: 0x888888,
                emissive: 0x222200,
                shininess: 60,
            });
            const body = new THREE.Mesh(bodyGeo, bodyMat);
            body.castShadow = true;
            this.shellGroup.add(body);

            const noseGeo = new THREE.ConeGeometry(0.08, 0.2, 8);
            noseGeo.rotateX(Math.PI / 2);
            noseGeo.translate(0, 0, 0.35);
            const noseMat = new THREE.MeshPhongMaterial({
                color: 0xcc8833,
                emissive: 0x331100,
                shininess: 80,
            });
            this.shellGroup.add(new THREE.Mesh(noseGeo, noseMat));

            this.light = new THREE.PointLight(0xffaa00, 2, 20);
            this.light.position.set(0, 0, -0.3);
            this.shellGroup.add(this.light);

            this.scene.add(this.shellGroup);
        }

        this.shellGroup.visible = true;
        this.shellGroup.position.copy(projectile.position);

        if (projectile.velocity.lengthSq() > 0.01) {
            this._lastVelocity.copy(projectile.velocity);
            const dir = projectile.velocity.clone().normalize();
            const target = projectile.position.clone().add(dir);
            this.shellGroup.lookAt(target);
        }

        this._smokeTimer += 1;
        if (this.particleSystem && this._smokeTimer % 2 === 0) {
            this.particleSystem.emit(projectile.position, 2, {
                color: new THREE.Color(0.7, 0.7, 0.7),
                speed: 1.5,
                spread: 0.3,
                life: 0.8,
                size: 0.15,
                gravity: false,
            });
        }
    }

    hide() {
        if (this.shellGroup) this.shellGroup.visible = false;
        this._smokeTimer = 0;
    }

    dispose() {
        this.hide();
        if (this.shellGroup) {
            this.scene.remove(this.shellGroup);
            this.shellGroup.traverse((obj) => {
                if (obj.geometry) obj.geometry.dispose();
                if (obj.material) obj.material.dispose();
            });
        }
    }
}
