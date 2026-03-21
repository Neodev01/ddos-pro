const express = require("express");
const http = require("http");
const WebSocketServer = require("websocket").server;

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ httpServer: server });

wss.on("request", (request) => {
    const connection = request.accept(null, request.origin);
    console.log("✅ Client connected");
});

app.use(express.static("public"));

const attackTypes = ["DDoS", "Botnet", "Malware", "Phishing"];

function randomCoord() {
    return {
        lat: (Math.random() * 180) - 90,
        lng: (Math.random() * 360) - 180
    }
}

function generateAttack() {
    return {
        source: randomCoord(),
        target: randomCoord(),
        type: attackTypes[Math.floor(Math.random() * attackTypes.length)],
        time: Date.now()
    }
}

setInterval(() => {
    const attack = generateAttack();

    wss.connections.forEach(connection => {
        if (connection.connected) {
            connection.sendUTF(JSON.stringify(attack));
        }
    })
}, 800);

server.listen(3000, () => {
    console.log("🔥Running at http://localhost:3000");
});