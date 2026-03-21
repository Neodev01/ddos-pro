const map = L.map('map', {
    zoomControl: false,
    attributionControl: false
}).setView([20, 0], 2);

L.tileLayer(
    'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
).addTo(map);

const ws = new WebSocket(`ws://${location.host}`);

let total = 0;
let lastSecond = 0;

const totalEl = document.getElementById('total');
const rateEl = document.getElementById('rate');
const logs = document.getElementById('logs');

ws.onerror = function (error) {
    console.error('WebSocket error:', error);
    addLog('❌ Connection error');
};

ws.onopen = function () {
    console.log('WebSocket connected');
    addLog('✅ Connected to server');
};

ws.onclose = function () {
    console.warn('WebSocket disconnected');
    addLog('⚠️ Disconnected from server');
};

setInterval(() => {
    rateEl.innerText = "Rate: " + lastSecond + "/sec";
    lastSecond = 0;
}, 1000);

function addLog(text) {
    const el = document.createElement("div");
    el.textContent = "> " + text;
    logs.prepend(el);

    if (logs.children.length > 20) {
        logs.removeChild(logs.lastChild);
    }
}

// Calculate Great Circle points for curved lines, clipped to map bounds
function getGreatCirclePoints(start, end, numPoints = 50) {
    const points = [];
    const startLat = start.lat * Math.PI / 180;
    const startLng = start.lng * Math.PI / 180;
    const endLat = end.lat * Math.PI / 180;
    const endLng = end.lng * Math.PI / 180;

    const d = 2 * Math.asin(Math.sqrt(
        Math.sin((startLat - endLat) / 2) ** 2 +
        Math.cos(startLat) * Math.cos(endLat) * Math.sin((startLng - endLng) / 2) ** 2
    ));

    // If points are too close, return straight line
    if (d < 0.1) {
        return [[start.lat, start.lng], [end.lat, end.lng]];
    }

    // For very long distances (crossing hemispheres), use intermediate routing
    const lngDiff = Math.abs(end.lng - start.lng);
    if (lngDiff > 180) {
        // Use shorter path across the map
        const intermediateLng = start.lng + (end.lng > start.lng ? -360 : 360) + (end.lng - start.lng) / 2;
        const intermediateLat = (start.lat + end.lat) / 2;

        // Create two segments
        const segment1 = getGreatCirclePoints(start, { lat: intermediateLat, lng: intermediateLng }, numPoints / 2);
        const segment2 = getGreatCirclePoints({ lat: intermediateLat, lng: intermediateLng }, end, numPoints / 2);

        return [...segment1.slice(0, -1), ...segment2]; // Remove duplicate intermediate point
    }

    // Generate Great Circle points
    const rawPoints = [];
    for (let i = 0; i <= numPoints; i++) {
        const f = i / numPoints;
        const A = Math.sin((1 - f) * d) / Math.sin(d);
        const B = Math.sin(f * d) / Math.sin(d);

        const x = A * Math.cos(startLat) * Math.cos(startLng) + B * Math.cos(endLat) * Math.cos(endLng);
        const y = A * Math.cos(startLat) * Math.sin(startLng) + B * Math.cos(endLat) * Math.sin(endLng);
        const z = A * Math.sin(startLat) + B * Math.sin(endLat);

        const lat = Math.atan2(z, Math.sqrt(x * x + y * y)) * 180 / Math.PI;
        let lng = Math.atan2(y, x) * 180 / Math.PI;

        // Normalize longitude to -180 to 180 range
        while (lng > 180) lng -= 360;
        while (lng < -180) lng += 360;

        rawPoints.push([lat, lng]);
    }

    // Clip points to current map bounds to prevent lines from going off-screen
    const bounds = map.getBounds();
    const north = bounds.getNorth();
    const south = bounds.getSouth();
    const east = bounds.getEast();
    const west = bounds.getWest();

    return rawPoints.map(([lat, lng]) => {
        // Clip latitude to map bounds with small padding
        const clippedLat = Math.max(south - 5, Math.min(north + 5, lat));

        // Handle longitude wrapping for lines that cross the date line
        let clippedLng = lng;
        if (Math.abs(lng - start.lng) > 180) {
            clippedLng = lng > 0 ? lng - 360 : lng + 360;
        }
        clippedLng = Math.max(west - 10, Math.min(east + 10, clippedLng));

        return [clippedLat, clippedLng];
    });
}

ws.onmessage = function (event) {
    const attack = JSON.parse(event.data);

    total++;
    lastSecond++;

    totalEl.innerText = "Total: " + total;

    const colorMap = {
        DDoS: "#ff3b3b",
        Botnet: "#ffaa00",
        Malware: "#00ffcc",
        Phishing: "#ff00ff"
    }
    const color = colorMap[attack.type];

    // Create curved Great Circle line
    const linePoints = getGreatCirclePoints(attack.source, attack.target);
    const line = L.polyline(linePoints, {
        color: color,
        weight: 2,
        opacity: 0.7,
        className: 'attack-line'
    }).addTo(map);

    const sourceMarker = L.circleMarker(
        [attack.source.lat, attack.source.lng],
        { radius: 3, color, opacity: 0.8 }
    ).addTo(map);

    const targetMarker = L.circleMarker(
        [attack.target.lat, attack.target.lng],
        { radius: 3, color }
    ).addTo(map);

    addLog(`${attack.type} → (${attack.target.lat.toFixed(2)}, ${attack.target.lng.toFixed(2)})`);
    setTimeout(() => map.removeLayer(line), 3000);
    setTimeout(() => map.removeLayer(sourceMarker), 3000);
    setTimeout(() => map.removeLayer(targetMarker), 3000);
}
