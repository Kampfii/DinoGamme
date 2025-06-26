// Adresse des WebRooms-Servers
const webRoomsWebSocketServerAddr = 'wss://nosch.uber.space/web-rooms/';

// Raumname für das Spiel
const roomName = "dino-game";
const socket = new WebSocket(webRoomsWebSocketServerAddr);

let clientId = null;
let players = {};
let clientCount = 0;

// Canvas vorbereiten
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// Dino-Bild laden 
const dinoImg = new Image();
dinoImg.src = "dino.png";

const cactusImg = new Image();
cactusImg.src = "kaktus.png";

// Name abfragen
const name = prompt("Dein Name?");
alert(`Willkommen, ${name}! Viel Spaß beim Spiel!`);

// Eigener Spieler
let myPlayer = {
  id: null,
  name: name,
  x: 60 + Math.random() * 20, // Start ganz links, leicht versetzt
  y: 210,
  jumping: false,
  jumpSpeed: 0,
  color: '#' + Math.floor(Math.random() * 16777215).toString(16)
};

// Hilfsfunktion zum Senden von Nachrichten
function sendRequest(...msg) {
  socket.send(JSON.stringify(msg));
}

// Verbindung öffnen: Raum betreten und Name setzen
socket.addEventListener('open', () => {
  sendRequest('*enter-room*', roomName);
  sendRequest('*subscribe-client-count*');
  sendRequest('*set-data*', `name-${name}`, name);
  setInterval(() => socket.send(''), 30000); // Ping, damit Verbindung bleibt
});

// Nachrichten vom Server empfangen
socket.addEventListener('message', (event) => {
  const data = JSON.parse(event.data);
  const selector = data[0];

  switch (selector) {
    case '*client-id*':
      clientId = data[1];
      myPlayer.id = clientId;
      players[clientId] = myPlayer; // Eigener Spieler in die Liste eintragen!
      break;

    case 'player-update': {
      const playerData = data[1];
      players[playerData.id] = playerData;
      draw();
      break;
    }

    case 'jump': {
      const jumpId = data[1];
      if (players[jumpId]) {
        players[jumpId].jumping = true;
        players[jumpId].jumpSpeed = -10;
      }
      break;
    }

    case 'start-game':
      gameStarted = true;
      startBtn.style.display = "none";
      obstacles = [];
      nextObstacleIn = 0;
      gameTime = 0;
      break;

    case '*client-count*':
      clientCount = data[1];
      // Begrenzung auf 15 Spieler
      if (clientCount > 15 && !myPlayer.joinedChecked) {
        alert("Der Raum ist voll! Maximal 15 Spieler erlaubt.");
        socket.close();
        canvas.style.display = "none";
        myPlayer.joinedChecked = true; // Damit die Meldung nur einmal kommt
      }
      break;

    case '*error*':
      console.warn('server error:', ...data.slice(1));
      break;
  }
});

// Hindernisse als Beispiel (am Anfang leer)
let obstacles = [];

// Hindernis-Parameter
const obstacleWidth = 30;
const obstacleHeight = 50;
const baseObstacleSpeed = 4; // Anfangsgeschwindigkeit erhöht
let obstacleSpeed = baseObstacleSpeed;
const minDistance = 300;
const maxDistance = 600;

let nextObstacleIn = 0;
let gameTime = 0; // Zeit in Sekunden seit Spielstart

let gameStarted = false;

const startBtn = document.getElementById("startBtn");
startBtn.addEventListener("click", () => {
  sendRequest('*broadcast-message*', ['start-game']);
  // Spiel auch lokal starten:
  gameStarted = true;
  startBtn.style.display = "none";
  obstacles = [];
  nextObstacleIn = 0;
  gameTime = 0;
  score = 0; // Score zurücksetzen!
});

// Game-Loop 
setInterval(() => {
  if (!gameStarted) {
    draw(); // Nur das Spielfeld zeichnen, keine Bewegenung
    return;
  }

  // Zeit erhöhen
  gameTime += 1 / 60;

  // Geschwindigkeit langsam erhöhen (z.B. alle 10 Sekunden +0.5)
  obstacleSpeed = baseObstacleSpeed + Math.floor(gameTime / 10) * 0.5;

  // Hindernisse bewegen und entfernen, wenn sie raus sind
  obstacles.forEach(obs => {
    obs.x -= obstacleSpeed;

    // Wenn das Hindernis gerade den Dino passiert hat
    if (!obs.passed && obs.x + obs.width < myPlayer.x) {
      obs.passed = true;
      score++;
      if (score > highscore) {
        highscore = score;
        localStorage.setItem("dinoHighscore", highscore);
      }
    }
  });
  obstacles = obstacles.filter(obs => obs.x + obs.width > 0);

  // Neues Hindernis zufällig erzeugen
  if (nextObstacleIn <= 0) {
    obstacles.push({
      x: canvas.width,
      y: 220,
      width: obstacleWidth,
      height: obstacleHeight,
      speed: obstacleSpeed
    });
    nextObstacleIn = Math.random() * (maxDistance - minDistance) + minDistance;
  } else {
    nextObstacleIn -= obstacleSpeed;
  }

  // Eigene Sprung-Logik
  if (myPlayer.jumping) {
    myPlayer.y += myPlayer.jumpSpeed;
    myPlayer.jumpSpeed += 0.5;
    if (myPlayer.y >= 210) {
      myPlayer.y = 210;
      myPlayer.jumping = false;
    }
  }

  // Kollisionserkennung
  let hit = false;
  obstacles.forEach(obs => {
    // Rechteck-Kollision: Dino (myPlayer.x, myPlayer.y, 40, 60)
    // Hindernis: (obs.x, obs.y, obs.width, obs.height)
    if (
      myPlayer.x < obs.x + obs.width &&
      myPlayer.x + 40 > obs.x &&
      myPlayer.y < obs.y + obs.height &&
      myPlayer.y + 60 > obs.y
    ) {
      hit = true;
    }
  });
  if (hit) {
    alert("Kollision! Spiel vorbei.");
    // Optional: Spiel stoppen
    gameStarted = false;
    startBtn.style.display = "block";
    score = 0; // Score zurücksetzen!
  }

  draw();
}, 1000 / 60);

// Spielfeld zeichnen
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Boden zeichnen (z.B. 40px hoch, sandgelb)
  ctx.fillStyle = "#e2c275";
  ctx.fillRect(0, 270, canvas.width, 40);

  // Hindernisse zeichnen
  ctx.fillStyle = "#444";
  obstacles.forEach(obs => {
    if (cactusImg.complete && cactusImg.naturalWidth > 0) {
      ctx.drawImage(cactusImg, obs.x, obs.y, obs.width, obs.height);
    } else {
      // Fallback: Rechteck zeichnen, falls Bild noch nicht geladen
      ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
    }
  });

  // Spieler zeichnen
  Object.values(players).forEach(player => {
    ctx.save();
    // Spiegeln an der Y-Achse (horizontal)
    ctx.translate(player.x + 40, player.y); // 40 = Breite des Dinos
    ctx.scale(-1, 1);
    ctx.drawImage(dinoImg, 0, 0, 40, 60);
    ctx.restore();

    ctx.fillStyle = "#000";
    ctx.font = "16px Arial";
    ctx.fillText(player.name, player.x, player.y - 10);
  });

  ctx.fillStyle = "#1a8917";
  ctx.font = "bold 20px Arial";
  ctx.fillText("Score: " + score, 20, 30);
  ctx.fillText("Highscore: " + highscore, 20, 60);
}

// Sprung auslösen
document.addEventListener('keydown', (e) => {
  if (e.code === "Space" && !myPlayer.jumping) {
    myPlayer.jumping = true;
    myPlayer.jumpSpeed = -10;
    sendRequest('*broadcast-message*', ['jump', myPlayer.id]);
  }
});
canvas.addEventListener('touchstart', () => {
  if (!myPlayer.jumping) {
    myPlayer.jumping = true;
    myPlayer.jumpSpeed = -10;
    sendRequest('*broadcast-message*', ['jump', myPlayer.id]);
  }
});

// Eigene Position und Sprung regelmäßig an andere senden
setInterval(() => {
  sendRequest('*broadcast-message*', ['player-update', myPlayer]);
}, 16); // ca. 60x pro Sekunde

let score = 0;
let highscore = localStorage.getItem("dinoHighscore") || 0;
