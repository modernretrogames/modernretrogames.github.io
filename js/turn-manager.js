export class TurnManager {
    constructor() {
        this.players = [];
        this.currentPlayerIndex = 0;
        this.currentTankIndex = 0;
        this.round = 1;
        this._tanksPlayedThisRound = 0;
        this._totalAliveTanks = 0;
    }

    init(players) {
        this.players = players;
        this.currentPlayerIndex = 0;
        this.currentTankIndex = 0;
        this.round = 1;
        this._findFirstAliveTank();
    }

    _findFirstAliveTank() {
        for (let p = 0; p < this.players.length; p++) {
            const player = this.players[p];
            for (let t = 0; t < player.tanks.length; t++) {
                if (player.tanks[t].alive) {
                    this.currentPlayerIndex = p;
                    this.currentTankIndex = t;
                    return true;
                }
            }
        }
        return false;
    }

    getCurrentPlayer() {
        return this.players[this.currentPlayerIndex];
    }

    getCurrentTank() {
        const player = this.getCurrentPlayer();
        return player ? player.tanks[this.currentTankIndex] : null;
    }

    nextTurn() {
        const startPlayer = this.currentPlayerIndex;
        const startTank = this.currentTankIndex;

        let pi = this.currentPlayerIndex;
        let ti = this.currentTankIndex + 1;

        const totalPlayers = this.players.length;
        let attempts = 0;
        const maxAttempts = totalPlayers * 10;

        while (attempts < maxAttempts) {
            const player = this.players[pi];

            if (ti >= player.tanks.length) {
                ti = 0;
                pi = (pi + 1) % totalPlayers;
                if (pi === 0) {
                    this.round++;
                }
            }

            if (player.tanks[ti] && player.tanks[ti].alive && player.hasAliveTanks()) {
                this.currentPlayerIndex = pi;
                this.currentTankIndex = ti;
                return true;
            }

            ti++;
            attempts++;
        }

        return false;
    }

    checkWinCondition() {
        const playersWithTanks = this.players.filter(p => p.hasAliveTanks());
        if (playersWithTanks.length <= 1) {
            return playersWithTanks[0] || null;
        }
        return false;
    }
}
