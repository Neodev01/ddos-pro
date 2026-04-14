// import * as THREE from "https://cdn.skypack.dev/three@0.150.1";
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.150.1/build/three.module.js";

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const geometry = new THREE.SphereGeometry(5, 64, 64);
// create earth with texture
const loader = new THREE.TextureLoader();
const earthTexture = loader.load(
    "https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_atmos_2048.jpg",
    () => {
        console.log("✅ Earth texture loaded");
        renderer.render(scene, camera);
    },
    undefined,
    (err) => {
        console.warn("Texture failed, using fallback color:", err.message);
        // fallback to blue color if texture fails
        const canvas = document.createElement('canvas');
        canvas.width = 2048;
        canvas.height = 1024;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#1a5a96';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#0d3d5c';
        for (let i = 0; i < 50; i++) {
            ctx.fillRect(Math.random() * 2048, Math.random() * 1024, Math.random() * 200, Math.random() * 100);
        }
        const fallbackTexture = new THREE.CanvasTexture(canvas);
        material.map = fallbackTexture;
        material.needsUpdate = true;
    }
);

const material = new THREE.MeshStandardMaterial({
    map: earthTexture,
    metalness: 0.1,
    roughness: 0.7,
    wireframe: false
});
const earth = new THREE.Mesh(geometry, material);
scene.add(earth);

// lighting for MeshStandardMaterial
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(5, 3, 5);
scene.add(directionalLight);

camera.position.z = 10;

// Convert lat/lng → 3D position
function latLngToVector3(lat, lng, radius = 5) {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lng + 180) * (Math.PI / 180);

    return new THREE.Vector3(
        radius * Math.sin(phi) * Math.cos(theta),
        radius * Math.cos(phi),
        radius * Math.sin(phi) * Math.sin(theta)
    )
}

// Create arc between two points
function createArc(start, end) {

    const distance = start.distanceTo(end);
    const mid = start.clone().add(end).multiplyScalar(0.5)
    // mid.normalize().multiplyScalar(7) //lift curve
    mid.normalize().multiplyScalar(5 + distance * 0.5)

    const curve = new THREE.QuadraticBezierCurve3(
        start, mid, end
    );

    const points = curve.getPoints(49);

    const geometry = new THREE.BufferGeometry().setFromPoints(points);

    const material = new THREE.LineBasicMaterial({
        color: 0xff3beb
    });

    const line = new THREE.Line(geometry, material);
    scene.add(line);

    setTimeout(() => {
        scene.remove(line);
        // Essential for memory management:
        geometry.dispose();
        material.dispose();
    }, 2000);
}

const ws = new WebSocket(`ws://${location.host}`);

ws.onmessage = (event) => {
    const attack = JSON.parse(event.data);

    const start = latLngToVector3(
        attack.source.lat,
        attack.source.lng
    );

    const end = latLngToVector3(
        attack.target.lat,
        attack.target.lng
    );

    createArc(start, end);
}

function animate() {
    requestAnimationFrame(animate);

    earth.rotation.y += 0.0015;

    renderer.render(scene, camera);
}

animate();