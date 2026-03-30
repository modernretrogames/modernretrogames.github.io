import { Tank } from './tank.js';

const PLAYER_COLORS = [0x2196f3, 0xf44336, 0x4caf50, 0xff9800];

export class Player {
    constructor(id, name, isAI = false) {
        this.id = id;
        this.name = name;
        this.color = PLAYER_COLORS[id % PLAYER_COLORS.length];
        this.isAI = isAI;
        this.tanks = [];
        this.score = 0;
    }

    createTanks(count) {
        for (let i = 0; i < count; i++) {
            this.tanks.push(new Tank(this.id, this.color));
        }
    }

    hasAliveTanks() {
        return this.tanks.some(t => t.alive);
    }

    getAliveTanks() {
        return this.tanks.filter(t => t.alive);
    }
}
