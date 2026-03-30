export const WeaponType = {
    STANDARD: 'standard',
    HEAVY: 'heavy',
    SNIPER: 'sniper',
    CLUSTER: 'cluster',
    EARTHQUAKE: 'earthquake',
    SHOTGUN: 'shotgun',
};

export class Weapon {
    constructor({ name, type, damage, blastRadius, maxAmmo, projectileSpeed, gravityMultiplier, special }) {
        this.name = name;
        this.type = type;
        this.damage = damage;
        this.blastRadius = blastRadius;
        this.maxAmmo = maxAmmo;
        this.projectileSpeed = projectileSpeed || 1.0;
        this.gravityMultiplier = gravityMultiplier || 1.0;
        this.special = special || null;
    }
}

export const WEAPON_DEFS = [
    new Weapon({
        name: 'Standard Shell',
        type: WeaponType.STANDARD,
        damage: 25,
        blastRadius: 3,
        maxAmmo: Infinity,
        projectileSpeed: 1.0,
        gravityMultiplier: 1.0,
    }),
    new Weapon({
        name: 'Heavy Shell',
        type: WeaponType.HEAVY,
        damage: 40,
        blastRadius: 5,
        maxAmmo: 3,
        projectileSpeed: 0.9,
        gravityMultiplier: 1.0,
    }),
    new Weapon({
        name: 'Sniper Shot',
        type: WeaponType.SNIPER,
        damage: 50,
        blastRadius: 1,
        maxAmmo: 2,
        projectileSpeed: 2.0,
        gravityMultiplier: 0.5,
    }),
    new Weapon({
        name: 'Cluster Bomb',
        type: WeaponType.CLUSTER,
        damage: 15,
        blastRadius: 2,
        maxAmmo: 2,
        projectileSpeed: 1.0,
        gravityMultiplier: 1.0,
        special: 'cluster',
    }),
    new Weapon({
        name: 'Earthquake Bomb',
        type: WeaponType.EARTHQUAKE,
        damage: 10,
        blastRadius: 10,
        maxAmmo: 1,
        projectileSpeed: 0.8,
        gravityMultiplier: 1.2,
    }),
    new Weapon({
        name: 'Shotgun Blast',
        type: WeaponType.SHOTGUN,
        damage: 20,
        blastRadius: 1.5,
        maxAmmo: 2,
        projectileSpeed: 1.5,
        gravityMultiplier: 1.0,
        special: 'shotgun',
    }),
];

export function getDefaultAmmo() {
    const ammo = {};
    for (let i = 0; i < WEAPON_DEFS.length; i++) {
        ammo[i] = WEAPON_DEFS[i].maxAmmo;
    }
    return ammo;
}
