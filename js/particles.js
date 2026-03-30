import * as THREE from 'three';

const MAX_PARTICLES = 4000;

export class ParticleSystem {
    constructor(scene) {
        this.scene = scene;
        this.pool = [];

        for (let i = 0; i < MAX_PARTICLES; i++) {
            this.pool.push({
                position: new THREE.Vector3(),
                velocity: new THREE.Vector3(),
                color: new THREE.Color(),
                life: 0,
                maxLife: 1,
                size: 0.1,
                active: false,
                gravity: true,
            });
        }

        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const material = new THREE.MeshLambertMaterial();

        this.mesh = new THREE.InstancedMesh(geometry, material, MAX_PARTICLES);
        this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.mesh.instanceColor = new THREE.InstancedBufferAttribute(
            new Float32Array(MAX_PARTICLES * 3), 3
        );
        this.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
        this.mesh.frustumCulled = false;
        this.mesh.count = 0;

        scene.add(this.mesh);
        this.activeCount = 0;

        this._dummy = new THREE.Object3D();
        this._color = new THREE.Color();
    }

    emit(position, count, options = {}) {
        const {
            color = new THREE.Color(1, 0.6, 0.2),
            speed = 5,
            spread = 1,
            life = 1.5,
            size = 0.2,
            gravity = true,
        } = options;

        for (let i = 0; i < count; i++) {
            const p = this._getFromPool();
            if (!p) break;

            p.position.copy(position);
            p.velocity.set(
                (Math.random() - 0.5) * speed * spread,
                Math.random() * speed * 0.8 + speed * 0.2,
                (Math.random() - 0.5) * speed * spread
            );
            p.color.copy(color);
            p.life = life * (0.5 + Math.random() * 0.5);
            p.maxLife = p.life;
            p.size = size * (0.5 + Math.random());
            p.active = true;
            p.gravity = gravity;
        }
    }

    _getFromPool() {
        for (const p of this.pool) {
            if (!p.active) return p;
        }
        return null;
    }

    update(dt) {
        let idx = 0;

        for (const p of this.pool) {
            if (!p.active) continue;

            p.life -= dt;
            if (p.life <= 0) {
                p.active = false;
                continue;
            }

            if (p.gravity) {
                p.velocity.y -= 9.81 * dt;
            }
            p.position.addScaledVector(p.velocity, dt);

            const alpha = p.life / p.maxLife;
            const scale = p.size * (0.4 + 0.6 * alpha);

            this._dummy.position.copy(p.position);
            this._dummy.scale.set(scale, scale, scale);
            this._dummy.updateMatrix();
            this.mesh.setMatrixAt(idx, this._dummy.matrix);

            this._color.setRGB(
                p.color.r * alpha,
                p.color.g * alpha,
                p.color.b * alpha
            );
            this.mesh.setColorAt(idx, this._color);

            idx++;
        }

        this.mesh.count = idx;
        this.activeCount = idx;

        if (idx > 0) {
            this.mesh.instanceMatrix.needsUpdate = true;
            this.mesh.instanceColor.needsUpdate = true;
        }
    }
}
