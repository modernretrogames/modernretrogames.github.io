import * as THREE from 'three';
import { VoxelType } from './voxel-world.js';
import { SeededRandom } from './utils.js';

export function createExplosion(world, impactPoint, radius, particleSystem) {
    const voxelRadius = Math.ceil(radius / world.voxelSize);
    const center = world.worldToVoxel(impactPoint.x, impactPoint.y, impactPoint.z);
    const rng = new SeededRandom(Math.floor(impactPoint.x * 1000 + impactPoint.z));
    let removedCount = 0;

    for (let dy = -voxelRadius; dy <= voxelRadius; dy++) {
        for (let dz = -voxelRadius; dz <= voxelRadius; dz++) {
            for (let dx = -voxelRadius; dx <= voxelRadius; dx++) {
                const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
                if (dist > voxelRadius) continue;

                const edgeFraction = dist / voxelRadius;
                if (edgeFraction > 0.8 && rng.next() > (1 - edgeFraction) * 5) continue;

                const vx = center.x + dx;
                const vy = center.y + dy;
                const vz = center.z + dz;

                const oldType = world.getVoxel(vx, vy, vz);
                if (oldType !== VoxelType.AIR) {
                    world.setVoxel(vx, vy, vz, VoxelType.AIR);
                    removedCount++;
                }
            }
        }
    }

    scorchCrater(world, center, voxelRadius);

    if (particleSystem) {
        particleSystem.emit(impactPoint, Math.min(removedCount * 2, 200), {
            color: new THREE.Color(0.6, 0.4, 0.2),
            speed: radius * 2,
            spread: 1,
            life: 2,
            size: 0.15,
        });

        particleSystem.emit(impactPoint, 40, {
            color: new THREE.Color(1, 0.8, 0.2),
            speed: radius * 2.5,
            spread: 0.6,
            life: 0.6,
            size: 0.35,
        });
        particleSystem.emit(impactPoint, 25, {
            color: new THREE.Color(1, 0.3, 0.05),
            speed: radius * 1.8,
            spread: 0.8,
            life: 1,
            size: 0.4,
        });

        particleSystem.emit(impactPoint, 50, {
            color: new THREE.Color(0.35, 0.35, 0.35),
            speed: radius * 1.2,
            spread: 1.2,
            life: 3.5,
            size: 0.5,
            gravity: false,
        });

        particleSystem.emit(impactPoint, Math.min(removedCount, 60), {
            color: new THREE.Color(0.45, 0.3, 0.15),
            speed: radius * 3,
            spread: 1.5,
            life: 2.5,
            size: 0.12,
        });
    }

    return removedCount;
}

function scorchCrater(world, center, voxelRadius) {
    const scorchRadius = voxelRadius + 2;
    for (let dy = -scorchRadius; dy <= scorchRadius; dy++) {
        for (let dz = -scorchRadius; dz <= scorchRadius; dz++) {
            for (let dx = -scorchRadius; dx <= scorchRadius; dx++) {
                const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
                if (dist > scorchRadius || dist < voxelRadius - 1) continue;

                const vx = center.x + dx;
                const vy = center.y + dy;
                const vz = center.z + dz;

                const type = world.getVoxel(vx, vy, vz);
                if (type === VoxelType.GRASS) {
                    world.setVoxel(vx, vy, vz, VoxelType.BURNED_GRASS);
                } else if (type === VoxelType.DIRT) {
                    world.setVoxel(vx, vy, vz, VoxelType.BURNED_DIRT);
                }
            }
        }
    }
}

export function calculateDamage(tankPosition, impactPoint, weapon) {
    const dist = tankPosition.distanceTo(impactPoint);
    const blastWorldRadius = weapon.blastRadius;

    if (dist > blastWorldRadius) return 0;

    const falloff = 1 - (dist / blastWorldRadius);
    return Math.round(weapon.damage * falloff);
}

export function createExplosionVisual(scene, position, radius) {
    const group = new THREE.Group();
    group.position.copy(position);
    scene.add(group);

    const flashLight = new THREE.PointLight(0xffcc44, 6, radius * 10);
    group.add(flashLight);

    const voxelCount = Math.min(Math.floor(radius * 25), 150);
    const geometry = new THREE.BoxGeometry(1, 1, 1);

    const fireColors = [
        new THREE.Color(1, 1, 0.9),
        new THREE.Color(1, 0.85, 0.2),
        new THREE.Color(1, 0.5, 0.1),
        new THREE.Color(1, 0.25, 0.05),
        new THREE.Color(0.7, 0.1, 0),
    ];

    const voxels = [];
    for (let i = 0; i < voxelCount; i++) {
        const colorIdx = Math.floor(Math.random() * fireColors.length);
        const material = new THREE.MeshBasicMaterial({
            color: fireColors[colorIdx].clone(),
            transparent: true,
            opacity: 1,
        });

        const size = 0.15 + Math.random() * 0.3;
        const mesh = new THREE.Mesh(geometry, material);
        mesh.scale.set(size, size, size);

        const dir = new THREE.Vector3(
            (Math.random() - 0.5),
            (Math.random() - 0.15) * 0.9,
            (Math.random() - 0.5)
        ).normalize();
        const speed = (0.3 + Math.random() * 0.7) * radius * 3;

        voxels.push({
            mesh,
            velocity: dir.multiplyScalar(speed),
            rotSpeed: new THREE.Vector3(
                (Math.random() - 0.5) * 10,
                (Math.random() - 0.5) * 10,
                (Math.random() - 0.5) * 10
            ),
            material,
            size,
        });

        group.add(mesh);
    }

    const totalDuration = 1.0;
    let elapsed = 0;
    const darkColor = new THREE.Color(0.06, 0.01, 0);

    return {
        group,
        update(dt) {
            elapsed += dt;
            const t = Math.min(elapsed / totalDuration, 1);

            const flashFade = Math.min(elapsed / 0.12, 1);
            flashLight.intensity = 6 * (1 - flashFade);

            for (const v of voxels) {
                v.velocity.y -= 7 * dt;
                v.velocity.multiplyScalar(1 - 2 * dt);
                v.mesh.position.addScaledVector(v.velocity, dt);
                v.mesh.rotation.x += v.rotSpeed.x * dt;
                v.mesh.rotation.y += v.rotSpeed.y * dt;
                v.mesh.rotation.z += v.rotSpeed.z * dt;

                v.material.opacity = Math.max(0, 1 - t * t);
                v.material.color.lerp(darkColor, dt * 2.5);

                const shrink = 1 - t * 0.5;
                const s = v.size * shrink;
                v.mesh.scale.set(s, s, s);
            }

            return t >= 1;
        },
        dispose() {
            scene.remove(group);
            geometry.dispose();
            for (const v of voxels) {
                v.material.dispose();
            }
        }
    };
}
