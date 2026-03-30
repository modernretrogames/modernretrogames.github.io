# Voxel Artillery

A 3D voxel-based artillery game built with Three.js. Destroy terrain and defeat AI opponents in turn-based tank combat on procedurally generated landscapes.

## Features

- Procedurally generated voxel terrain with hills and valleys
- Turn-based artillery gameplay (single player vs AI)
- 6 weapon types: Standard Shell, Heavy Shell, Sniper Shot, Cluster Bomb, Earthquake Bomb, Shotgun Blast
- Destructible terrain with realistic crater formation
- Tank physics: gravity, fall damage, knockback
- 3 AI difficulty levels
- Configurable map size and voxel resolution
- Synthesized sound effects (no external assets needed)
- Dark/light theme support

## Running Locally

No build step required. Just serve the files with any static HTTP server:

```bash
# Python
python3 -m http.server 8080

# Node.js
npx serve .

# Or just open index.html in a browser (some browsers may block ES modules from file://)
```

Then open http://localhost:8080 in your browser.

## Controls

| Action | Input |
|--------|-------|
| Orbit camera | Left mouse drag |
| Pan camera | Right mouse drag |
| Zoom | Mouse wheel |
| Adjust azimuth | Left/Right arrow keys |
| Adjust elevation | Up/Down arrow keys |
| Adjust power | +/- keys |
| Select weapon | Number keys 1-6 |
| Fire | Spacebar or Fire button |
| Skip turn | Escape |

Hold Shift with arrow keys for fine-grained aiming (1-degree steps).

## Deployment

### GitHub Pages

Push the repository to GitHub and enable Pages from Settings > Pages > Source: main branch.

### Docker

```bash
docker build -t voxel-artillery .
docker run -p 3000:80 voxel-artillery
```

Then open http://localhost:3000.

## Tech Stack

- **Three.js** (via CDN) - 3D rendering
- **Plain HTML/CSS/JS** - no frameworks, no build tools
- **Web Audio API** - synthesized sound effects
- **ES6 Modules** - clean code organisation without bundlers
