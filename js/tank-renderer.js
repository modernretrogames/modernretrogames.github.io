import * as THREE from 'three';
import { clamp } from './utils.js';

export class TankRenderer {
    constructor(tank) {
        this.tank = tank;
        this.group = new THREE.Group();
        this._active = false;
        this._pulseTime = 0;

        const c = new THREE.Color(tank.color);
        const bodyMat = new THREE.MeshPhongMaterial({ color: c, emissive: 0x000000 });
        const darkMat = new THREE.MeshPhongMaterial({ color: c.clone().multiplyScalar(0.6), emissive: 0x000000 });
        const barrelMat = new THREE.MeshLambertMaterial({ color: 0x444444 });
        this._bodyMat = bodyMat;
        this._darkMat = darkMat;

        const hullGeo = new THREE.BoxGeometry(1.6, 0.5, 2.2);
        this.hull = new THREE.Mesh(hullGeo, bodyMat);
        this.hull.position.y = 0.25;
        this.hull.castShadow = true;
        this.hull.receiveShadow = true;
        this.group.add(this.hull);

        const trackGeoL = new THREE.BoxGeometry(0.3, 0.4, 2.4);
        const trackL = new THREE.Mesh(trackGeoL, darkMat);
        trackL.position.set(-0.95, 0.2, 0);
        trackL.castShadow = true;
        this.group.add(trackL);

        const trackR = new THREE.Mesh(trackGeoL, darkMat);
        trackR.position.set(0.95, 0.2, 0);
        trackR.castShadow = true;
        this.group.add(trackR);

        this.turretGroup = new THREE.Group();
        this.turretGroup.position.y = 0.5;

        const turretGeo = new THREE.BoxGeometry(1.0, 0.5, 1.0);
        const turret = new THREE.Mesh(turretGeo, bodyMat);
        turret.position.y = 0.25;
        turret.castShadow = true;
        this.turretGroup.add(turret);

        this.barrelPivot = new THREE.Group();
        this.barrelPivot.position.set(0, 0.35, 0);

        const barrelGeo = new THREE.CylinderGeometry(0.08, 0.08, 2.0, 8);
        barrelGeo.translate(0, 1.0, 0);
        barrelGeo.rotateX(Math.PI / 2);
        this.barrel = new THREE.Mesh(barrelGeo, barrelMat);
        this.barrel.castShadow = true;
        this.barrelPivot.add(this.barrel);

        this.turretGroup.add(this.barrelPivot);
        this.group.add(this.turretGroup);

        this.healthBarGroup = new THREE.Group();
        const bgGeo = new THREE.PlaneGeometry(2, 0.2);
        const bgMat = new THREE.MeshBasicMaterial({ color: 0x333333, side: THREE.DoubleSide });
        this.healthBg = new THREE.Mesh(bgGeo, bgMat);
        this.healthBarGroup.add(this.healthBg);

        const fgGeo = new THREE.PlaneGeometry(2, 0.2);
        this.healthFgMat = new THREE.MeshBasicMaterial({ color: 0x00ff00, side: THREE.DoubleSide });
        this.healthFg = new THREE.Mesh(fgGeo, this.healthFgMat);
        this.healthBarGroup.add(this.healthFg);

        this.healthBarGroup.position.y = 2.5;
        this.group.add(this.healthBarGroup);

        const ringGeo = new THREE.RingGeometry(1.6, 2.0, 32);
        ringGeo.rotateX(-Math.PI / 2);
        this._ringMat = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0,
            side: THREE.DoubleSide,
            depthWrite: false,
        });
        this._ring = new THREE.Mesh(ringGeo, this._ringMat);
        this._ring.position.y = 0.5;
        this._ring.visible = false;
        this.group.add(this._ring);

        this.setTurretAngle(tank.turretAngle);
        this.setBarrelElevation(tank.barrelElevation);
    }

    setTurretAngle(radians) {
        this.turretGroup.rotation.y = radians;
    }

    setBarrelElevation(radians) {
        const clamped = clamp(radians, 0, Math.PI * 80 / 180);
        this.barrelPivot.rotation.x = -clamped;
    }

    updateHealthBar(camera) {
        const ratio = this.tank.health / this.tank.maxHealth;
        this.healthFg.scale.x = Math.max(ratio, 0);
        this.healthFg.position.x = -(1 - ratio);

        if (ratio > 0.6) this.healthFgMat.color.setHex(0x00ff00);
        else if (ratio > 0.3) this.healthFgMat.color.setHex(0xffaa00);
        else this.healthFgMat.color.setHex(0xff0000);

        if (camera) {
            const invGroup = this.group.quaternion.clone().invert();
            this.healthBarGroup.quaternion.copy(invGroup).multiply(camera.quaternion);
        }
    }

    syncToTank() {
        this.group.position.copy(this.tank.position);
        this.group.quaternion.copy(this.tank.hullQuaternion);
        this.setTurretAngle(this.tank.turretAngle);
        this.setBarrelElevation(this.tank.barrelElevation);
    }

    setActive(active) {
        if (this._active === active) return;
        this._active = active;
        this._ring.visible = active;
        if (!active) {
            this._bodyMat.emissive.setHex(0x000000);
            this._darkMat.emissive.setHex(0x000000);
            this._ringMat.opacity = 0;
        }
    }

    updateActiveEffect(dt) {
        if (!this._active) return;
        this._pulseTime += dt * 3;
        const pulse = 0.5 + 0.5 * Math.sin(this._pulseTime);

        const baseColor = new THREE.Color(this.tank.color);
        this._bodyMat.emissive.copy(baseColor).multiplyScalar(0.25 * pulse);
        this._darkMat.emissive.copy(baseColor).multiplyScalar(0.15 * pulse);

        this._ringMat.color.copy(baseColor);
        this._ringMat.opacity = 0.3 + 0.4 * pulse;
    }

    setVisible(visible) {
        this.group.visible = visible;
    }

    dispose(scene) {
        scene.remove(this.group);
        this.group.traverse((obj) => {
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) obj.material.dispose();
        });
    }
}
