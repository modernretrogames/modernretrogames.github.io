import * as THREE from 'three';

const MAX_INTERCEPTORS = 30;
const MAX_BLASTS = 20;
const GRAVITY = 9.81;
const LAUNCH_SPEED = 40;
const TRAIL_LENGTH = 12;

const BLAST_GROW_TIME = 0.4;
const BLAST_HOLD_TIME = 0.8;
const BLAST_FADE_TIME = 0.4;
const BLAST_MAX_RADIUS = 12;

const DETECTION_RADIUS = 20;
const STEER_RATE = 2.5;
const PROXIMITY_FUSE_DIST = 8;
const SEEK_CONE_DOT = 0.3;

export class Battery {
    constructor(worldX, worldY, worldZ, name) {
        this.position = new THREE.Vector3(worldX, worldY, worldZ);
        this.name = name;
        this.maxAmmo = 10;
        this.ammo = this.maxAmmo;
    }

    refill() {
        this.ammo = this.maxAmmo;
    }

    canFire() {
        return this.ammo > 0;
    }

    consume() {
        this.ammo--;
    }
}

export class InterceptorManager {
    constructor(scene, particleSystem, audioManager) {
        this.scene = scene;
        this.particleSystem = particleSystem;
        this.audio = audioManager;
        this.warheadManager = null;

        this.batteries = [];
        this.interceptors = [];
        this.blasts = [];

        this._initPool();
        this._initBlastPool();
    }

    setBatteries(batteries) {
        this.batteries = batteries;
    }

    setWarheadManager(wm) {
        this.warheadManager = wm;
    }

    _initPool() {
        const trailGeo = new THREE.BufferGeometry();
        const trailPositions = new Float32Array(MAX_INTERCEPTORS * TRAIL_LENGTH * 3);
        const trailColors = new Float32Array(MAX_INTERCEPTORS * TRAIL_LENGTH * 3);
        trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
        trailGeo.setAttribute('color', new THREE.BufferAttribute(trailColors, 3));
        trailGeo.setDrawRange(0, 0);

        const trailMat = new THREE.LineBasicMaterial({
            vertexColors: true,
            transparent: true,
            opacity: 0.9,
            linewidth: 2,
        });
        this.trailLines = new THREE.LineSegments(trailGeo, trailMat);
        this.trailLines.frustumCulled = false;
        this.scene.add(this.trailLines);

        const tipGeo = new THREE.SphereGeometry(0.15, 6, 4);
        const tipMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        this.tipMesh = new THREE.InstancedMesh(tipGeo, tipMat, MAX_INTERCEPTORS);
        this.tipMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.tipMesh.count = 0;
        this.tipMesh.frustumCulled = false;
        this.scene.add(this.tipMesh);

        for (let i = 0; i < MAX_INTERCEPTORS; i++) {
            this.interceptors.push({
                active: false,
                position: new THREE.Vector3(),
                velocity: new THREE.Vector3(),
                target: new THREE.Vector3(),
                trail: [],
                age: 0,
                maxAge: 5,
                batteryIndex: -1,
                seeking: false,
                seekTarget: null,
            });
        }
    }

    _initBlastPool() {
        const blastGeo = new THREE.SphereGeometry(1, 24, 16);
        const blastMat = new THREE.MeshBasicMaterial({
            color: 0xff6644,
            transparent: true,
            opacity: 0.4,
            side: THREE.DoubleSide,
            depthWrite: false,
        });

        for (let i = 0; i < MAX_BLASTS; i++) {
            const mesh = new THREE.Mesh(blastGeo.clone(), blastMat.clone());
            mesh.visible = false;
            this.scene.add(mesh);

            const glowLight = new THREE.PointLight(0xff4422, 0, 30);
            this.scene.add(glowLight);

            this.blasts.push({
                active: false,
                position: new THREE.Vector3(),
                mesh,
                light: glowLight,
                age: 0,
                radius: 0,
                phase: 'grow',
            });
        }
    }

    fire(batteryIndex, target) {
        if (batteryIndex < 0 || batteryIndex >= this.batteries.length) return false;
        const battery = this.batteries[batteryIndex];
        if (!battery.canFire()) return false;

        const interceptor = this._getFromPool();
        if (!interceptor) return false;

        battery.consume();

        interceptor.active = true;
        interceptor.position.copy(battery.position);
        interceptor.target.copy(target);
        interceptor.trail = [battery.position.clone()];
        interceptor.age = 0;
        interceptor.batteryIndex = batteryIndex;
        interceptor.seeking = false;
        interceptor.seekTarget = null;

        const toTarget = new THREE.Vector3().subVectors(target, battery.position);
        const dist = toTarget.length();
        const flightTime = dist / LAUNCH_SPEED;
        interceptor.maxAge = Math.min(flightTime, 5);

        const vx = toTarget.x / flightTime;
        const vz = toTarget.z / flightTime;
        const vy = (toTarget.y / flightTime) + (0.5 * GRAVITY * flightTime);

        interceptor.velocity.set(vx, vy, vz);

        return true;
    }

    fireTowardAim(playerPos, aimTarget) {
        let closestIdx = -1;
        let closestDist = Infinity;
        for (let i = 0; i < this.batteries.length; i++) {
            const b = this.batteries[i];
            if (!b.canFire()) continue;
            const d = b.position.distanceTo(playerPos);
            if (d < closestDist) {
                closestDist = d;
                closestIdx = i;
            }
        }
        if (closestIdx < 0) return false;
        return this.fire(closestIdx, aimTarget);
    }

    _getFromPool() {
        for (const m of this.interceptors) {
            if (!m.active) return m;
        }
        return null;
    }

    _spawnBlast(position) {
        for (const b of this.blasts) {
            if (!b.active) {
                b.active = true;
                b.position.copy(position);
                b.mesh.position.copy(position);
                b.mesh.visible = true;
                b.mesh.scale.set(0.01, 0.01, 0.01);
                b.mesh.material.opacity = 0.5;
                b.mesh.material.color.setHex(0xff6644);
                b.light.position.copy(position);
                b.light.intensity = 3;
                b.age = 0;
                b.radius = 0;
                b.phase = 'grow';
                return b;
            }
        }
        return null;
    }

    update(dt) {
        this._updateInterceptors(dt);
        this._updateBlasts(dt);
        this._rebuildTrails();
    }

    _updateInterceptors(dt) {
        const dummy = new THREE.Object3D();
        let tipCount = 0;

        for (const m of this.interceptors) {
            if (!m.active) continue;

            if (this.warheadManager) {
                this._updateSeeking(m, dt);
            }

            if (m.seeking) {
                m.velocity.y -= GRAVITY * 0.3 * dt;
                this._steerTowardTarget(m, dt);
            } else {
                m.velocity.y -= GRAVITY * dt;
            }

            m.position.addScaledVector(m.velocity, dt);
            m.age += dt;

            m.trail.push(m.position.clone());
            if (m.trail.length > TRAIL_LENGTH) m.trail.shift();

            if (this._checkProximityFuse(m)) {
                this._detonate(m);
                continue;
            }

            if (!m.seeking) {
                const distToTarget = m.position.distanceTo(m.target);
                if (m.age >= m.maxAge || distToTarget < 5) {
                    this._detonate(m);
                    continue;
                }
            } else if (m.age >= m.maxAge) {
                this._detonate(m);
                continue;
            }

            if (m.position.y < 0) {
                this._detonate(m);
                continue;
            }

            dummy.position.copy(m.position);
            dummy.scale.set(1, 1, 1);
            dummy.updateMatrix();
            this.tipMesh.setMatrixAt(tipCount, dummy.matrix);
            tipCount++;
        }

        this.tipMesh.count = tipCount;
        if (tipCount > 0) {
            this.tipMesh.instanceMatrix.needsUpdate = true;
        }
    }

    _updateSeeking(m, dt) {
        if (m.seekTarget && (!m.seekTarget.active ||
            m.position.distanceTo(m.seekTarget.position) > DETECTION_RADIUS * 1.5)) {
            m.seekTarget = null;
            m.seeking = false;
        }

        if (!m.seekTarget) {
            const fwd = m.velocity.clone().normalize();
            let closestDist = DETECTION_RADIUS;
            let closest = null;
            for (const w of this.warheadManager.warheads) {
                if (!w.active) continue;
                const toW = new THREE.Vector3().subVectors(w.position, m.position);
                const dist = toW.length();
                if (dist >= closestDist) continue;
                const dot = toW.normalize().dot(fwd);
                if (dot < SEEK_CONE_DOT) continue;
                closestDist = dist;
                closest = w;
            }
            if (closest) {
                m.seekTarget = closest;
                m.seeking = true;
                m.maxAge = Math.max(m.maxAge, m.age + 3);
            }
        }
    }

    _steerTowardTarget(m, dt) {
        if (!m.seekTarget) return;

        const toWarhead = new THREE.Vector3().subVectors(m.seekTarget.position, m.position);
        const dist = toWarhead.length();
        const speed = m.velocity.length();
        const timeToReach = dist / Math.max(speed, 1);

        const leadPoint = m.seekTarget.position.clone()
            .addScaledVector(m.seekTarget.velocity, Math.min(timeToReach * 0.5, 1.5));

        const desiredDir = new THREE.Vector3().subVectors(leadPoint, m.position).normalize();
        const currentDir = m.velocity.clone().normalize();

        const steerAmount = Math.min(STEER_RATE * dt, 0.8);
        currentDir.lerp(desiredDir, steerAmount);
        currentDir.normalize();

        m.velocity.copy(currentDir).multiplyScalar(speed);
    }

    _checkProximityFuse(m) {
        if (!this.warheadManager) return false;
        for (const w of this.warheadManager.warheads) {
            if (!w.active) continue;
            if (m.position.distanceTo(w.position) < PROXIMITY_FUSE_DIST) {
                return true;
            }
        }
        return false;
    }

    _detonate(interceptor) {
        interceptor.active = false;

        this._spawnBlast(interceptor.position.clone());

        if (this.particleSystem) {
            this.particleSystem.emit(interceptor.position, 30, {
                color: new THREE.Color(1, 0.5, 0.2),
                speed: 8,
                spread: 1,
                life: 0.8,
                size: 0.25,
                gravity: false,
            });
            this.particleSystem.emit(interceptor.position, 15, {
                color: new THREE.Color(1, 1, 0.8),
                speed: 4,
                spread: 0.5,
                life: 0.3,
                size: 0.4,
                gravity: false,
            });
        }

        if (this.audio) {
            this.audio.play('interceptDetonate');
        }
    }

    _updateBlasts(dt) {
        for (const b of this.blasts) {
            if (!b.active) continue;

            b.age += dt;

            if (b.phase === 'grow') {
                const t = b.age / BLAST_GROW_TIME;
                b.radius = BLAST_MAX_RADIUS * this._easeOutQuad(Math.min(t, 1));
                if (b.age >= BLAST_GROW_TIME) {
                    b.phase = 'hold';
                    b.age = 0;
                }
            } else if (b.phase === 'hold') {
                b.radius = BLAST_MAX_RADIUS;
                if (b.age >= BLAST_HOLD_TIME) {
                    b.phase = 'fade';
                    b.age = 0;
                }
            } else if (b.phase === 'fade') {
                const t = b.age / BLAST_FADE_TIME;
                b.radius = BLAST_MAX_RADIUS * (1 - t * 0.3);
                b.mesh.material.opacity = 0.5 * (1 - t);
                b.light.intensity = 3 * (1 - t);
                if (b.age >= BLAST_FADE_TIME) {
                    b.active = false;
                    b.mesh.visible = false;
                    b.light.intensity = 0;
                    continue;
                }
            }

            const s = Math.max(b.radius, 0.01);
            b.mesh.scale.set(s, s, s);

            const pulse = 1 + Math.sin(b.age * 15) * 0.05;
            b.mesh.scale.multiplyScalar(pulse);

            const hue = 0.05 + Math.sin(b.age * 8) * 0.03;
            b.mesh.material.color.setHSL(hue, 1, 0.6);
        }
    }

    _easeOutQuad(t) {
        return t * (2 - t);
    }

    _rebuildTrails() {
        const positions = this.trailLines.geometry.attributes.position.array;
        const colors = this.trailLines.geometry.attributes.color.array;
        let segIdx = 0;

        for (const m of this.interceptors) {
            if (!m.active || m.trail.length < 2) continue;

            for (let i = 0; i < m.trail.length - 1; i++) {
                const a = m.trail[i];
                const b = m.trail[i + 1];
                const alpha = (i + 1) / m.trail.length;

                const idx = segIdx * 6;
                positions[idx] = a.x;
                positions[idx + 1] = a.y;
                positions[idx + 2] = a.z;
                positions[idx + 3] = b.x;
                positions[idx + 4] = b.y;
                positions[idx + 5] = b.z;

                const cidx = segIdx * 6;
                colors[cidx] = 1 * alpha;
                colors[cidx + 1] = 0.6 * alpha;
                colors[cidx + 2] = 0.2 * alpha;
                colors[cidx + 3] = 1 * alpha;
                colors[cidx + 4] = 0.6 * alpha;
                colors[cidx + 5] = 0.2 * alpha;

                segIdx++;
            }
        }

        this.trailLines.geometry.setDrawRange(0, segIdx * 2);
        this.trailLines.geometry.attributes.position.needsUpdate = true;
        this.trailLines.geometry.attributes.color.needsUpdate = true;
    }

    getActiveBlasts() {
        return this.blasts.filter(b => b.active);
    }

    refillAllBatteries() {
        for (const b of this.batteries) {
            b.refill();
        }
    }

    clear() {
        for (const m of this.interceptors) {
            m.active = false;
        }
        for (const b of this.blasts) {
            b.active = false;
            b.mesh.visible = false;
            b.light.intensity = 0;
        }
        this.trailLines.geometry.setDrawRange(0, 0);
    }

    getTotalAmmo() {
        let total = 0;
        for (const b of this.batteries) {
            total += b.ammo;
        }
        return total;
    }
}
