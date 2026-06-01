/* ==========================================================================
   GRIDLOCK GAME SYSTEM - Tactical Grid Conquest (Step 3 & 4)
   ========================================================================== */

// Game State Object
const state = {
  board: [], // 6x6 grid, each cell: { player: null, power: 0, r: row, c: col }
  currentPlayer: 1, // 1 = Red (Ruby Vanguard), 2 = Blue (Cobalt Storm)
  scores: {
    1: { cells: 1, power: 1 },
    2: { cells: 1, power: 1 }
  },
  gameOver: false,
  gridSize: 6,
  soundEnabled: true,
  gameMode: 'menu', // 'menu', 'local', 'ai', 'online'
  aiLock: false, // locks input when AI is thinking
  language: 'en', // 'en' or 'sk'
  socket: null,
  myColor: null, // 1 = Red (Ruby Vanguard), 2 = Blue (Cobalt Storm)
  roomId: null,
  isLoggedIn: false,
  username: null
};

// Web Audio API Synthesizer (Premium Futuristic Sounds)
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playSound(type, pitchModifier = 1) {
  if (!state.soundEnabled) return;
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }

  const osc = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();
  osc.connect(gainNode);
  gainNode.connect(audioCtx.destination);

  const now = audioCtx.currentTime;

  switch (type) {
    case 'occupy':
      // Short digital laser click
      osc.type = 'sine';
      osc.frequency.setValueAtTime(400 * pitchModifier, now);
      osc.frequency.exponentialRampToValueAtTime(100, now + 0.15);
      gainNode.gain.setValueAtTime(0.15, now);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
      osc.start(now);
      osc.stop(now + 0.15);
      break;

    case 'reinforce':
      // Ascending sleek synth note
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(300 + (pitchModifier * 50), now);
      osc.frequency.exponentialRampToValueAtTime(600 + (pitchModifier * 100), now + 0.2);
      gainNode.gain.setValueAtTime(0.15, now);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.2);
      break;

    case 'attack': {
      // Dramatic sweep-down distortion sound
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(150, now + 0.35);
      
      const filter = audioCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1000, now);
      filter.frequency.linearRampToValueAtTime(200, now + 0.35);
      
      osc.disconnect(gainNode);
      osc.connect(filter);
      filter.connect(gainNode);
      
      gainNode.gain.setValueAtTime(0.2, now);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
      osc.start(now);
      osc.stop(now + 0.35);
      break;
    }

    case 'invalid':
      // Low dual-tone buzzer
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(120, now);
      gainNode.gain.setValueAtTime(0.15, now);
      gainNode.gain.linearRampToValueAtTime(0.01, now + 0.25);
      osc.start(now);
      osc.stop(now + 0.25);
      break;

    case 'victory': {
      // Retro triumphant arpeggio
      const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50]; // C Major
      notes.forEach((freq, idx) => {
        const subOsc = audioCtx.createOscillator();
        const subGain = audioCtx.createGain();
        subOsc.connect(subGain);
        subGain.connect(audioCtx.destination);
        
        subOsc.type = 'sine';
        subOsc.frequency.setValueAtTime(freq, now + (idx * 0.08));
        subGain.gain.setValueAtTime(0.1, now + (idx * 0.08));
        subGain.gain.exponentialRampToValueAtTime(0.005, now + (idx * 0.08) + 0.4);
        
        subOsc.start(now + (idx * 0.08));
        subOsc.stop(now + (idx * 0.08) + 0.4);
      });
      break;
    }
  }
}

// Custom Cyberpunk Notification Toasts
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  
  const toast = document.createElement('div');
  toast.className = `toast ${type === 'error' ? 'error' : ''}`;

  let icon = '<i class="fa-solid fa-circle-info"></i>';
  if (type === 'success') {
    icon = '<i class="fa-solid fa-circle-check" style="color: #00f0ff;"></i>';
  } else if (type === 'error') {
    icon = '<i class="fa-solid fa-triangle-exclamation" style="color: #ff007f;"></i>';
  }

  toast.innerHTML = `${icon} <span>${message}</span>`;
  container.appendChild(toast);

  // Automatically remove toast after CSS fadeout finishes (4s total)
  setTimeout(() => {
    toast.remove();
  }, 4000);
}

/* ==========================================================================
   LOCALIZATION / TRANSLATION DICTIONARY
   ========================================================================== */
const translations = {
  en: {
    headerLogin: "Sign In / Save Progress",
    headerLoggedIn: "Logged in as ",
    menuTitle: "SELECT COMBAT MODE",
    modeAiTitle: "Player vs. Computer (AI)",
    modeAiDesc: "Face off against the tactical algorithm Cobalt AI",
    modeLocalTitle: "Local Multiplayer",
    modeLocalDesc: "Two-player battlefield on a single screen",
    modeOnlineTitle: "Play with a Friend (Online)",
    modeOnlineDesc: "Create a custom room and share a match connection link",
    p1Name: "Player 1",
    p1ColorTitle: "Ruby Vanguard",
    p2Name: "Player 2",
    p2ColorTitle: "Cobalt Storm",
    p2TitleAi: "Tactical Engine",
    cellsOwned: "Cells Owned",
    totalPower: "Total Power",
    activeTurn: "Active Turn",
    rulesBtn: "Rules",
    menuBtn: "Menu",
    resetBtn: "Reset",
    rulesTitle: "Tactical Intel",
    rulesIntro: "<strong>Gridlock</strong> is a highly tactical turn-based territorial conquest played on a 6x6 grid. Your goal is to dominate the grid and lock down your opponent.",
    rulesSubtitle: "Action Options (Choose one per turn):",
    occupyTitle: "Occupy",
    occupyDesc: "Click any unoccupied <strong>gray cell</strong> adjacent to a cell you already control. It starts with <strong>Power 1</strong>.",
    reinforceTitle: "Reinforce",
    reinforceDesc: "Click any cell <strong>you currently control</strong> to increase its power by <strong>+1</strong>.",
    attackTitle: "Attack",
    attackDesc: "Click any <strong>adjacent opponent's cell</strong>. Capture it if your attacking cell has **STRICTLY GREATER** power than the defender! Captured cell resets to <strong>Power 1</strong>.",
    victoryText: "<strong>Victory:</strong> Ends when board is full or a player has 0 cells. Player controlling the most cells wins the match.",
    understoodBtn: "Understood",
    awaitingCompetitor: "Awaiting Competitor",
    awaitingDesc: "Share this encrypted invite link with your friend to initiate the tactical dual:",
    copyBtn: "Copy",
    copiedBtn: "Copied!",
    awaitingStatus: "Awaiting secondary connection link connection...",
    progressionBackup: "Progression Backup",
    loginDesc: "Log in to save your 3-day streak and enter the global leaderboards!",
    challengeModalTitle: "<i class=\"fa-solid fa-crosshairs fa-fade\"></i> CHALLENGE RECEIVED",
    challengeModalDesc: "You have been challenged to an online Gridlock duel!",
    challengeRoomLabel: "Room Code:",
    btnAcceptChallenge: "Accept Duel",
    btnDeclineChallenge: "Decline",
    toastConnecting: "Establishing secure battlefield connection...",
    googleSignIn: "<i class=\"fa-brands fa-google\"></i> Google Sign In",
    discordSignIn: "<i class=\"fa-brands fa-discord\"></i> Discord Sign In",
    promoTitle: "<i class=\"fa-solid fa-ranking-star\"></i> This match advanced your global standing!",
    promoDesc: "Secure your progress and preserve your Daily Streak.",
    rematchBtn: "Initiate Rematch",
    toastAiStart: "AI match started. Good luck! 🤖",
    toastLocalStart: "Local match started! ⚔️",
    toastInvalidAction: "Invalid Action! Read Rules. ⚠️",
    toastGoogleSuccess: "Simulated Google Login successful! Streak saved! 🚀",
    toastDiscordSuccess: "Simulated Discord Login successful! Progression backed up! 👾",
    statusTurnP1: "turn. Choose action.",
    statusTurnP2: "turn. Choose action.",
    statusTurnAi: "is calculating move...",
    statusVictory: "WINS!",
    statusWinnerMsg: "Dominating the tactical grid with {cells} cells and {power} total power!",
    statusDraw: "IT'S A DRAW!",
    statusDrawMsg: "Perfect tactical equilibrium. Both players have {cells} cells and {power} power.",
    statusByPower: "WINS! (BY POWER)",
    statusByPowerMsg: "Both control {cells} cells, but {winner} has higher total power ({power1} vs {power2})!",
    onlineMatchStart: "Opponent joined! The battle begins! 🌐",
    onlineWaiting: "Room created! Waiting for opponent. 📡",
    inviteCopied: "Invite link copied to clipboard! 📋",
    notYourTurn: "Not your turn! 🚫",
    invalidMove: "Invalid move! ❌",
    opponentDisconnected: "Opponent disconnected. Returning to menu... 🔌",
    p1NameOnline: "Red Vanguard (You)",
    p1NameOnlineOpp: "Red Vanguard (Opponent)",
    p2NameOnline: "Cobalt Storm (You)",
    p2NameOnlineOpp: "Cobalt Storm (Opponent)",
    btnLangSK: "SK",
    btnLangEN: "EN"
  },
  sk: {
    headerLogin: "Prihlásiť sa / Uložiť progres",
    headerLoggedIn: "Prihlásený ako ",
    menuTitle: "VYBERTE REŽIM BOJA",
    modeAiTitle: "Hráč vs. Počítač (AI)",
    modeAiDesc: "Zmerajte si sily s taktickým algoritmom Cobalt AI",
    modeLocalTitle: "Lokálny Multiplayer",
    modeLocalDesc: "Bojisko pre dvoch hráčov na jednej obrazovke",
    modeOnlineTitle: "Hrať s priateľom (Online)",
    modeOnlineDesc: "Vytvorte si vlastnú miestnosť a zdieľajte pripojovací odkaz",
    p1Name: "Hráč 1",
    p1ColorTitle: "Ruby Vanguard",
    p2Name: "Hráč 2",
    p2ColorTitle: "Cobalt Storm",
    p2TitleAi: "Taktický algoritmus",
    cellsOwned: "Obsadené políčka",
    totalPower: "Celková sila",
    activeTurn: "Na ťahu",
    rulesBtn: "Pravidlá",
    menuBtn: "Menu",
    resetBtn: "Reset",
    rulesTitle: "Taktické pokyny",
    rulesIntro: "<strong>Gridlock</strong> je vysoko taktická ťahová hra na obsadzovanie územia na mriežke 6x6. Vaším cieľom je ovládnuť mriežku a zablokovať súpera.",
    rulesSubtitle: "Možnosti akcie (Vyberte jednu za ťah):",
    occupyTitle: "Obsadiť",
    occupyDesc: "Kliknite na ľubovoľné voľné sivé políčko susediace s políčkom, ktoré kontrolujete. Začína so silou 1.",
    reinforceTitle: "Posilniť",
    reinforceDesc: "Kliknite na ľubovoľné políčko, ktoré už kontrolujete, aby ste zvýšili jeho silu o +1.",
    attackTitle: "Útok",
    attackDesc: "Kliknite na susedné políčko súpera. Obsadíte ho, ak má vaše útočiace políčko PRÍSNE VÄČŠIU silu než obranca! Obsadené políčko sa resetuje na silu 1.",
    victoryText: "<strong>Víťazstvo:</strong> Hra končí, keď je mriežka plná alebo hráč nemá žiadne políčka. Hráč s väčším počtom políčok vyhráva.",
    understoodBtn: "Rozumiem",
    awaitingCompetitor: "Čakanie na protihráča",
    awaitingDesc: "Zdieľajte tento šifrovaný pozývací odkaz s priateľom na začatie taktického súboja:",
    copyBtn: "Kopírovať",
    copiedBtn: "Kopírované!",
    awaitingStatus: "Čakanie na pripojenie druhého hráča...",
    progressionBackup: "Záloha progresu",
    loginDesc: "Prihláste sa, aby ste si uložili svoj 3-dňový streak a dostali sa do globálneho rebríčka!",
    challengeModalTitle: "<i class=\"fa-solid fa-crosshairs fa-fade\"></i> PRIJATÁ VÝZVA",
    challengeModalDesc: "Boli ste vyzvaní na online súboj v hre Gridlock!",
    challengeRoomLabel: "Kód miestnosti:",
    btnAcceptChallenge: "Prijať súboj",
    btnDeclineChallenge: "Odmietnuť",
    toastConnecting: "Nadväzujem zabezpečené spojenie s bojiskom...",
    googleSignIn: "<i class=\"fa-brands fa-google\"></i> Prihlásiť sa cez Google",
    discordSignIn: "<i class=\"fa-brands fa-discord\"></i> Prihlásiť sa cez Discord",
    promoTitle: "<i class=\"fa-solid fa-ranking-star\"></i> Tento zápas ťa posunul v globálnom rebríčku!",
    promoDesc: "Ulož si svoje štatistiky a udrž si Daily Streak.",
    rematchBtn: "Nový zápas",
    toastAiStart: "AI zápas zahájený. Veľa šťastia! 🤖",
    toastLocalStart: "Lokálny zápas zahájený! ⚔️",
    toastInvalidAction: "Neplatná akcia! Prečítajte si pravidlá. ⚠️",
    toastGoogleSuccess: "Simulované prihlásenie cez Google úspešné! Streak zachovaný! 🚀",
    toastDiscordSuccess: "Simulované prihlásenie cez Discord úspešné! Progres zálohovaný! 👾",
    statusTurnP1: "je na ťahu. Zvoľte akciu.",
    statusTurnP2: "je na ťahu. Zvoľte akciu.",
    statusTurnAi: "počíta ťah...",
    statusVictory: "VYHRÁVA!",
    statusWinnerMsg: "Ovládol taktickú mriežku s {cells} políčkami a celkovou silou {power}!",
    statusDraw: "REMIZA!",
    statusDrawMsg: "Dokonalá taktická rovnováha. Obaja hráči majú {cells} políčok a {power} silu.",
    statusByPower: "VYHRÁVA! (NA SILU)",
    statusByPowerMsg: "Obaja kontrolujú {cells} políčok, ale {winner} má vyššiu celkovú silu ({power1} vs {power2})!",
    onlineMatchStart: "Súper sa pripojil! Bitka začína! 🌐",
    onlineWaiting: "Miestnosť vytvorená! Čaká sa na súpera. 📡",
    inviteCopied: "Pozývací odkaz skopírovaný do schránky! 📋",
    notYourTurn: "Nie ste na ťahu! 🚫",
    invalidMove: "Neplatný ťah! ❌",
    opponentDisconnected: "Súper sa odpojil. Návrat do menu... 🔌",
    p1NameOnline: "Red Vanguard (Vy)",
    p1NameOnlineOpp: "Red Vanguard (Súper)",
    p2NameOnline: "Cobalt Storm (Vy)",
    p2NameOnlineOpp: "Cobalt Storm (Súper)",
    btnLangSK: "SK",
    btnLangEN: "EN"
  }
};

function updateLanguageDOM() {
  const lang = state.language;
  const dict = translations[lang];

  // Button switcher text (if en, show 'SK', if sk, show 'EN')
  document.getElementById('btn-lang').textContent = lang === 'en' ? 'SK' : 'EN';

  // Translate static texts
  const elMap = {
    'menu-title': dict.menuTitle,
    'mode-ai-title': dict.modeAiTitle,
    'mode-ai-desc': dict.modeAiDesc,
    'mode-local-title': dict.modeLocalTitle,
    'mode-local-desc': dict.modeLocalDesc,
    'mode-online-title': dict.modeOnlineTitle,
    'mode-online-desc': dict.modeOnlineDesc,
    'p1-color-title': dict.p1ColorTitle,
    'p1-stat-cells': dict.cellsOwned,
    'p1-stat-power': dict.totalPower,
    'p2-stat-cells': dict.cellsOwned,
    'p2-stat-power': dict.totalPower,
    'btn-rules-text': dict.rulesBtn,
    'btn-menu-text': dict.menuBtn,
    'btn-reset-text': dict.resetBtn,
    'rules-title': dict.rulesTitle,
    'rules-intro': dict.rulesIntro,
    'rules-subtitle': dict.rulesSubtitle,
    'rules-occupy-desc': dict.occupyDesc,
    'rules-reinforce-desc': dict.reinforceDesc,
    'rules-attack-desc': dict.attackDesc,
    'rules-victory-text': dict.victoryText,
    'btn-close-rules': dict.understoodBtn,
    'waiting-modal-title': dict.awaitingCompetitor,
    'waiting-modal-desc': dict.awaitingDesc,
    'copy-btn-text': dict.copyBtn,
    'waiting-status-text': dict.awaitingStatus,
    'login-modal-title': dict.progressionBackup,
    'login-modal-desc': dict.loginDesc,
    'modal-google-login': dict.googleSignIn,
    'modal-discord-login': dict.discordSignIn,
    'promo-title': dict.promoTitle,
    'promo-desc': dict.promoDesc,
    'btn-rematch-text': dict.rematchBtn,
    'challenge-modal-title': dict.challengeModalTitle,
    'challenge-modal-desc': dict.challengeModalDesc,
    'challenge-room-label': dict.challengeRoomLabel,
    'btn-accept-text': dict.btnAcceptChallenge,
    'btn-decline-text': dict.btnDeclineChallenge
  };

  for (const [id, text] of Object.entries(elMap)) {
    const el = document.getElementById(id);
    if (el) {
      if (text.includes('<')) {
        el.innerHTML = text;
      } else {
        el.textContent = text;
      }
    }
  }

  // Handle badges in rules list (Occupy, Reinforce, Attack badges)
  const occupyBadges = document.querySelectorAll('.action-badge.occupy');
  occupyBadges.forEach(el => el.textContent = dict.occupyTitle);
  const reinforceBadges = document.querySelectorAll('.action-badge.reinforce');
  reinforceBadges.forEach(el => el.textContent = dict.reinforceTitle);
  const attackBadges = document.querySelectorAll('.action-badge.attack');
  attackBadges.forEach(el => el.textContent = dict.attackTitle);

  // Update dynamic values
  updatePlayerNamesInPanel();
  updateStatusMessage();
  updateHeaderLoginDisplay();
}

function updatePlayerNamesInPanel() {
  const lang = state.language;
  const dict = translations[lang];
  
  const p1NameDisplay = document.getElementById('p1-name-display');
  const p2NameDisplay = document.getElementById('p2-name-display');
  const p2ColorTitle = document.getElementById('p2-color-title');
  const p2Avatar = document.getElementById('p2-avatar-el');

  if (state.gameMode === 'online') {
    if (state.myColor === 1) {
      p1NameDisplay.textContent = dict.p1NameOnline;
      p2NameDisplay.textContent = dict.p2NameOnlineOpp;
    } else {
      p1NameDisplay.textContent = dict.p1NameOnlineOpp;
      p2NameDisplay.textContent = dict.p2NameOnline;
    }
    p2ColorTitle.textContent = dict.p2ColorTitle;
    p2Avatar.innerHTML = '<i class="fa-solid fa-bolt-lightning"></i>';
  } else if (state.gameMode === 'ai') {
    p1NameDisplay.textContent = dict.p1Name;
    p2NameDisplay.textContent = "Cobalt (AI)";
    p2ColorTitle.textContent = dict.p2TitleAi;
    p2Avatar.innerHTML = '<i class="fa-solid fa-microchip"></i>';
  } else {
    // local or menu
    p1NameDisplay.textContent = dict.p1Name;
    p2NameDisplay.textContent = dict.p2Name;
    p2ColorTitle.textContent = dict.p2ColorTitle;
    p2Avatar.innerHTML = '<i class="fa-solid fa-bolt-lightning"></i>';
  }
}

function updateHeaderLoginDisplay() {
  const lang = state.language;
  const dict = translations[lang];
  const headerLoginText = document.getElementById('header-login-text');
  
  if (state.isLoggedIn) {
    headerLoginText.textContent = dict.headerLoggedIn + (state.username || "Commander");
    document.getElementById('btn-login-header').style.borderColor = "var(--p2-color)";
    document.getElementById('btn-login-header').style.boxShadow = "0 0 10px rgba(0, 240, 255, 0.35)";
  } else {
    headerLoginText.textContent = dict.headerLogin;
    document.getElementById('btn-login-header').style.borderColor = "";
    document.getElementById('btn-login-header').style.boxShadow = "";
  }
}

function updateStatusMessage() {
  const statusEl = document.getElementById('game-status');
  if (!statusEl) return;
  const lang = state.language;
  const dict = translations[lang];

  if (state.aiLock) {
    statusEl.innerHTML = `<i class="fa-solid fa-microchip fa-spin" style="color: var(--p2-color)"></i> <strong style="color: var(--p2-color)">Cobalt (AI)</strong> ${dict.statusTurnAi}`;
    return;
  }

  let p1Html = `<strong style="color: var(--p1-color)">${dict.p1ColorTitle} (P1)</strong>`;
  let p2Html = `<strong style="color: var(--p2-color)">${dict.p2ColorTitle} (P2)</strong>`;

  if (state.gameMode === 'online') {
    if (state.myColor === 1) {
      p1Html = `<strong style="color: var(--p1-color)">${dict.p1NameOnline}</strong>`;
      p2Html = `<strong style="color: var(--p2-color)">${dict.p2NameOnlineOpp}</strong>`;
    } else {
      p1Html = `<strong style="color: var(--p1-color)">${dict.p1NameOnlineOpp}</strong>`;
      p2Html = `<strong style="color: var(--p2-color)">${dict.p2NameOnline}</strong>`;
    }
  } else if (state.gameMode === 'ai') {
    p2Html = `<strong style="color: var(--p2-color)">Cobalt (AI)</strong>`;
  }

  if (state.currentPlayer === 1) {
    statusEl.innerHTML = `<i class="fa-solid fa-circle-play" style="color: var(--p1-color)"></i> ${p1Html} ${dict.statusTurnP1}`;
  } else {
    statusEl.innerHTML = `<i class="fa-solid fa-circle-play" style="color: var(--p2-color)"></i> ${p2Html} ${dict.statusTurnP2}`;
  }
}

/* ==========================================================================
   SOCKET.IO ONLINE MULTIPLAYER CLIENT LOGIC
   ========================================================================== */
function connectSocket() {
  if (state.socket) return Promise.resolve(state.socket);

  return new Promise((resolve, reject) => {
    if (typeof io === 'undefined') {
      showToast('Socket.io client script not loaded! ⚠️', 'error');
      reject(new Error('Socket.io library missing'));
      return;
    }

    // Connect to the server that served this page (works both locally and in production)
    state.socket = io();

    state.socket.on('connect', () => {
      console.log(`[Socket] Connected as client: ${state.socket.id}`);
      resolve(state.socket);
    });

    state.socket.on('connect_error', (error) => {
      console.error('[Socket] Connection failed:', error);
      showToast('Failed to connect to matchmaking server.', 'error');
      reject(error);
    });

    // Wire up all server handlers
    setupSocketListeners();
  });
}

// Global cached board state for checking differences to play spatial synthesizer move SFX
let lastStateBoard = null;

function setupSocketListeners() {
  const socket = state.socket;

  // 1. Room Successfully Created
  socket.on('roomCreated', ({ roomId }) => {
    state.roomId = roomId;
    state.myColor = 1; // Host is always Player 1
    
    // Assemble Invite parameter link
    const inviteLink = `${window.location.origin}/?room=${roomId}`;
    document.getElementById('invite-link-input').value = inviteLink;
    
    // Open loading matcher modal overlay
    document.getElementById('waiting-modal').classList.add('open');
    
    const lang = state.language;
    showToast(translations[lang].onlineWaiting, 'success');
  });

  // 2. Both players in room, battle start!
  socket.on('gameStart', ({ roomId, board, currentPlayer, scores, player1Socket, player2Socket }) => {
    state.roomId = roomId;
    state.board = board;
    state.currentPlayer = currentPlayer;
    state.scores = scores;
    state.gameOver = false;
    state.aiLock = false;
    state.gameMode = 'online';

    // Assign playing client color role based on socket connection ID
    if (socket.id === player1Socket) {
      state.myColor = 1;
    } else if (socket.id === player2Socket) {
      state.myColor = 2;
    }

    // Initialize board caching
    lastStateBoard = JSON.parse(JSON.stringify(board));

    // Hide matches loader modal, hide landing cards, show core arena
    document.getElementById('waiting-modal').classList.remove('open');
    document.getElementById('main-menu').classList.add('hidden');
    document.getElementById('game-arena').classList.remove('hidden');

    const lang = state.language;
    showToast(translations[lang].onlineMatchStart, 'success');

    // Sync elements
    renderBoard();
    updateLanguageDOM();
    updateUI();
  });

  // 3. State update from server
  socket.on('stateUpdate', ({ board, currentPlayer, scores }) => {
    state.board = board;
    state.currentPlayer = currentPlayer;
    state.scores = scores;

    // Analyze differences to play local sound effects
    playSoundEffectFromStateDiff();

    renderBoard();
    updateUI();
  });

  // 4. Server ends game authoritatively
  socket.on('gameOver', ({ board, scores }) => {
    state.board = board;
    state.scores = scores;
    renderBoard();
    updateUI();
    endGame();
  });

  // 5. Opponent disconnects during match
  socket.on('opponentDisconnected', ({ message }) => {
    const lang = state.language;
    showToast(translations[lang].opponentDisconnected, 'error');
    
    // Shut down overlays and return to menu
    document.getElementById('waiting-modal').classList.remove('open');
    document.getElementById('gameover-overlay').classList.remove('open');
    initGame();
  });

  // 6. Generic errors
  socket.on('errorMsg', ({ message }) => {
    showToast(message, 'error');
  });
}

function playSoundEffectFromStateDiff() {
  if (!lastStateBoard) {
    lastStateBoard = JSON.parse(JSON.stringify(state.board));
    return;
  }

  let moveType = null;
  let powerVal = 1;

  for (let r = 0; r < state.gridSize; r++) {
    for (let c = 0; c < state.gridSize; c++) {
      const prev = lastStateBoard[r][c];
      const curr = state.board[r][c];

      if (prev.player !== curr.player || prev.power !== curr.power) {
        if (prev.player === null && curr.player !== null) {
          moveType = 'occupy';
        } else if (prev.player !== null && curr.player !== null && prev.player !== curr.player) {
          moveType = 'attack';
        } else if (prev.player === curr.player && curr.power > prev.power) {
          moveType = 'reinforce';
          powerVal = curr.power;
        }
      }
    }
  }

  if (moveType) {
    playSound(moveType, powerVal);
  }

  // update cache
  lastStateBoard = JSON.parse(JSON.stringify(state.board));
}

/* ==========================================================================
   CORE GAMEPLAY FUNCTIONS (LOCAL / AI / ONLINE WRAPPERS)
   ========================================================================== */

function initGame(mode) {
  state.board = [];
  state.currentPlayer = 1;
  state.gameOver = false;
  state.aiLock = false;

  // Build empty 6x6 coordinate boards
  for (let r = 0; r < state.gridSize; r++) {
    const row = [];
    for (let c = 0; c < state.gridSize; c++) {
      row.push({
        row: r,
        col: c,
        player: null,
        power: 0
      });
    }
    state.board.push(row);
  }

  // Red Vanguard start
  state.board[0][0].player = 1;
  state.board[0][0].power = 1;

  // Cobalt Storm start
  state.board[state.gridSize - 1][state.gridSize - 1].player = 2;
  state.board[state.gridSize - 1][state.gridSize - 1].power = 1;

  // Reset metrics
  state.scores[1] = { cells: 1, power: 1 };
  state.scores[2] = { cells: 1, power: 1 };

  const lang = state.language;
  const dict = translations[lang];

  if (mode) {
    state.gameMode = mode;
    
    // UI Panels Layout Toggle
    document.getElementById('main-menu').classList.add('hidden');
    document.getElementById('game-arena').classList.remove('hidden');

    if (mode === 'ai') {
      showToast(dict.toastAiStart, 'success');
    } else if (mode === 'local') {
      showToast(dict.toastLocalStart, 'success');
    } else if (mode === 'online') {
      state.gameOver = true; // locked until matching signals
      connectSocket()
        .then(socket => {
          socket.emit('createRoom');
        })
        .catch(err => {
          console.error('[Online Init] Failed:', err);
          initGame(); // return to main menu
        });
    }
  } else {
    // Resets layout back to landing main menu
    state.gameMode = 'menu';
    document.getElementById('main-menu').classList.remove('hidden');
    document.getElementById('game-arena').classList.add('hidden');
    
    // Disconnect active multiplayer socket to clear room listings
    if (state.socket) {
      state.socket.disconnect();
      state.socket = null;
    }
  }

  // Render & dynamic translations updates
  renderBoard();
  updateLanguageDOM();
  updateUI();
}

function renderBoard() {
  const boardEl = document.getElementById('board');
  if (!boardEl) return;
  boardEl.innerHTML = '';

  for (let r = 0; r < state.gridSize; r++) {
    for (let c = 0; c < state.gridSize; c++) {
      const cellData = state.board[r][c];
      
      const cellEl = document.createElement('button');
      cellEl.className = 'grid-cell';
      cellEl.dataset.row = r;
      cellEl.dataset.col = c;
      cellEl.setAttribute('aria-label', `Cell Row ${r + 1} Column ${c + 1}`);

      // Apply occupied colors classes
      if (cellData.player === 1) {
        cellEl.classList.add('player1');
      } else if (cellData.player === 2) {
        cellEl.classList.add('player2');
      }

      // Inject power level badge orb inside occupied cells
      if (cellData.power > 0) {
        const orb = document.createElement('div');
        orb.className = 'power-orb';
        if (cellData.power >= 4) {
          orb.classList.add('power-high');
        }
        orb.textContent = cellData.power;
        cellEl.appendChild(orb);
      }

      // Click and Hover listeners
      cellEl.addEventListener('click', () => handleCellClick(r, c, cellEl));
      cellEl.addEventListener('mouseenter', () => handleCellMouseEnter(r, c, cellEl));
      cellEl.addEventListener('mouseleave', () => handleCellMouseLeave(cellEl));

      boardEl.appendChild(cellEl);
    }
  }
}

function getNeighbors(r, c) {
  const neighbors = [];
  const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];

  for (const [dr, dc] of dirs) {
    const nr = r + dr;
    const nc = c + dc;
    if (nr >= 0 && nr < state.gridSize && nc >= 0 && nc < state.gridSize) {
      neighbors.push(state.board[nr][nc]);
    }
  }
  return neighbors;
}

function checkMoveValidity(r, c, player) {
  const cell = state.board[r][c];
  const neighbors = getNeighbors(r, c);

  // 1. REINFORCE: click owned cell
  if (cell.player === player) {
    return { valid: true, type: 'reinforce' };
  }

  // 2. OCCUPY: click empty cell adjacent to owned
  if (cell.player === null) {
    const hasOwnNeighbor = neighbors.some(n => n.player === player);
    if (hasOwnNeighbor) {
      return { valid: true, type: 'occupy' };
    }
  }

  // 3. ATTACK: click enemy cell adjacent to owned with strictly greater power
  if (cell.player !== null && cell.player !== player) {
    const canAttack = neighbors.some(n => n.player === player && n.power > cell.power);
    if (canAttack) {
      return { valid: true, type: 'attack' };
    }
  }

  return { valid: false, type: 'invalid' };
}

function handleCellClick(r, c, cellEl) {
  if (state.gameOver || state.aiLock) return;

  const lang = state.language;

  // Handle Online Turn emissions
  if (state.gameMode === 'online') {
    if (!state.socket) return;
    
    // Block clicks if it is not our turn
    if (state.currentPlayer !== state.myColor) {
      playSound('invalid');
      showToast(translations[lang].notYourTurn, 'error');
      return;
    }

    // Block invalid moves on client to avoid unnecessary server traffic
    const validity = checkMoveValidity(r, c, state.myColor);
    if (!validity.valid) {
      playSound('invalid');
      cellEl.classList.add('invalid-click');
      setTimeout(() => cellEl.classList.remove('invalid-click'), 400);
      showToast(translations[lang].invalidMove, 'error');
      return;
    }

    // Emit valid coordinates to server
    state.socket.emit('makeMove', { r, c });
    return;
  }

  // Handle Local Hotseat & AI Clicks
  const player = state.currentPlayer;
  const validity = checkMoveValidity(r, c, player);

  if (!validity.valid) {
    playSound('invalid');
    cellEl.classList.add('invalid-click');
    setTimeout(() => cellEl.classList.remove('invalid-click'), 400);
    
    const statusEl = document.getElementById('game-status');
    statusEl.innerHTML = `<span style="color: #ff0055;"><i class="fa-solid fa-triangle-exclamation"></i> ${translations[lang].toastInvalidAction}</span>`;
    setTimeout(updateStatusMessage, 2000);
    return;
  }

  executeMove(r, c, validity.type, player);
}

function executeMove(r, c, type, player) {
  const cell = state.board[r][c];

  if (type === 'occupy') {
    cell.player = player;
    cell.power = 1;
    playSound('occupy');
  } 
  else if (type === 'reinforce') {
    cell.power += 1;
    playSound('reinforce', cell.power);
  } 
  else if (type === 'attack') {
    cell.player = player;
    cell.power = 1; // resets captured cell power to 1
    playSound('attack');
  }

  recalculateScores();
  renderBoard();
  
  if (checkGameOver()) {
    endGame();
  } else {
    state.currentPlayer = state.currentPlayer === 1 ? 2 : 1;
    updateUI();

    // Trigger AI calculations if AI mode is selected and it is turn 2
    if (state.gameMode === 'ai' && state.currentPlayer === 2) {
      triggerAITurn();
    }
  }
}

function triggerAITurn() {
  state.aiLock = true;
  updateStatusMessage();

  setTimeout(() => {
    executeAIMove();
  }, 500); // 500ms digital latency simulation
}

function executeAIMove() {
  const aiPlayer = 2;
  const myCells = [];
  const validAttacks = [];
  const validOccupations = [];

  for (let r = 0; r < state.gridSize; r++) {
    for (let c = 0; c < state.gridSize; c++) {
      const cell = state.board[r][c];
      
      if (cell.player === aiPlayer) {
        myCells.push(cell);
      }

      const validity = checkMoveValidity(r, c, aiPlayer);
      if (validity.valid) {
        if (validity.type === 'attack') {
          validAttacks.push({ r, c });
        } else if (validity.type === 'occupy') {
          validOccupations.push({ r, c });
        }
      }
    }
  }

  // Decision Tree Strategy
  if (validAttacks.length > 0) {
    const randomAttack = validAttacks[Math.floor(Math.random() * validAttacks.length)];
    executeMove(randomAttack.r, randomAttack.c, 'attack', aiPlayer);
    state.aiLock = false;
    return;
  }

  if (validOccupations.length > 0) {
    const randomOccupy = validOccupations[Math.floor(Math.random() * validOccupations.length)];
    executeMove(randomOccupy.r, randomOccupy.c, 'occupy', aiPlayer);
    state.aiLock = false;
    return;
  }

  if (myCells.length > 0) {
    const randomReinforce = myCells[Math.floor(Math.random() * myCells.length)];
    executeMove(randomReinforce.row, randomReinforce.col, 'reinforce', aiPlayer);
    state.aiLock = false;
    return;
  }

  // Backup fallback
  state.aiLock = false;
  state.currentPlayer = 1;
  updateUI();
}

function handleCellMouseEnter(r, c, cellEl) {
  if (state.gameOver || state.aiLock) return;

  const activeColor = state.gameMode === 'online' ? state.myColor : state.currentPlayer;
  
  // Lock hover feedback in online mode if it is not client's active turn
  if (state.gameMode === 'online' && state.currentPlayer !== state.myColor) return;

  const validity = checkMoveValidity(r, c, activeColor);
  if (!validity.valid) return;

  if (validity.type === 'occupy') {
    cellEl.classList.add(activeColor === 1 ? 'preview-occupy-p1' : 'preview-occupy-p2');
  } else if (validity.type === 'reinforce') {
    cellEl.classList.add('preview-reinforce');
  } else if (validity.type === 'attack') {
    cellEl.classList.add('preview-attack');
  }
}

function handleCellMouseLeave(cellEl) {
  cellEl.classList.remove('preview-occupy-p1', 'preview-occupy-p2', 'preview-reinforce', 'preview-attack');
}

function recalculateScores() {
  let p1Cells = 0, p1Power = 0, p2Cells = 0, p2Power = 0;

  for (let r = 0; r < state.gridSize; r++) {
    for (let c = 0; c < state.gridSize; c++) {
      const cell = state.board[r][c];
      if (cell.player === 1) {
        p1Cells++;
        p1Power += cell.power;
      } else if (cell.player === 2) {
        p2Cells++;
        p2Power += cell.power;
      }
    }
  }

  state.scores[1] = { cells: p1Cells, power: p1Power };
  state.scores[2] = { cells: p2Cells, power: p2Power };
}

function checkGameOver() {
  if (state.scores[1].cells === 0 || state.scores[2].cells === 0) {
    return true;
  }

  let isFull = true;
  for (let r = 0; r < state.gridSize; r++) {
    for (let c = 0; c < state.gridSize; c++) {
      if (state.board[r][c].player === null) {
        isFull = false;
        break;
      }
    }
    if (!isFull) break;
  }
  return isFull;
}

function endGame() {
  state.gameOver = true;
  playSound('victory');

  const p1Cells = state.scores[1].cells;
  const p2Cells = state.scores[2].cells;
  const lang = state.language;
  const dict = translations[lang];

  let winnerName = "";
  let winnerMsg = "";

  const name1 = dict.p1ColorTitle;
  let name2 = dict.p2ColorTitle;
  if (state.gameMode === 'online') {
    name2 = state.myColor === 2 ? dict.p2NameOnline : dict.p2NameOnlineOpp;
  } else if (state.gameMode === 'ai') {
    name2 = 'Cobalt (AI)';
  }

  if (p1Cells > p2Cells) {
    winnerName = `${name1.toUpperCase()} ${dict.statusVictory}`;
    winnerMsg = dict.statusWinnerMsg.replace('{cells}', p1Cells).replace('{power}', state.scores[1].power);
  } else if (p2Cells > p1Cells) {
    winnerName = `${name2.toUpperCase()} ${dict.statusVictory}`;
    winnerMsg = dict.statusWinnerMsg.replace('{cells}', p2Cells).replace('{power}', state.scores[2].power);
  } else {
    const p1Power = state.scores[1].power;
    const p2Power = state.scores[2].power;

    if (p1Power > p2Power) {
      winnerName = `${name1.toUpperCase()} ${dict.statusByPower}`;
      winnerMsg = dict.statusByPowerMsg
        .replace('{cells}', p1Cells)
        .replace('{winner}', name1)
        .replace('{power1}', p1Power)
        .replace('{power2}', p2Power);
    } else if (p2Power > p1Power) {
      winnerName = `${name2.toUpperCase()} ${dict.statusByPower}`;
      winnerMsg = dict.statusByPowerMsg
        .replace('{cells}', p2Cells)
        .replace('{winner}', name2)
        .replace('{power1}', p2Power)
        .replace('{power2}', p1Power);
    } else {
      winnerName = dict.statusDraw;
      winnerMsg = dict.statusDrawMsg.replace('{cells}', p1Cells).replace('{power}', p1Power);
    }
  }

  // Display Game Over Modal
  const overlay = document.getElementById('gameover-overlay');
  const titleEl = document.getElementById('winner-title');
  const msgEl = document.getElementById('winner-message');

  titleEl.textContent = winnerName;
  msgEl.textContent = winnerMsg;
  
  overlay.className = 'modal-overlay open';
}

function updateUI() {
  document.getElementById('p1-cells').textContent = state.scores[1].cells;
  document.getElementById('p1-power').textContent = state.scores[1].power;
  document.getElementById('p2-cells').textContent = state.scores[2].cells;
  document.getElementById('p2-power').textContent = state.scores[2].power;

  const p1Panel = document.getElementById('panel-p1');
  const p2Panel = document.getElementById('panel-p2');

  if (state.currentPlayer === 1) {
    p1Panel.classList.add('active');
    p2Panel.classList.remove('active');
  } else {
    p2Panel.classList.add('active');
    p1Panel.classList.remove('active');
  }

  updateStatusMessage();
}

/* ==========================================================================
   DOM BINDINGS & COMPONENT MOUNT LISTENERS
   ========================================================================== */

// Rules Popup Interactions
const rulesModal = document.getElementById('rules-modal');
const btnRules = document.getElementById('btn-rules');
const rulesClose = document.getElementById('rules-close');
const btnCloseRules = document.getElementById('btn-close-rules');

btnRules.addEventListener('click', () => {
  rulesModal.classList.add('open');
});

[rulesClose, btnCloseRules].forEach(btn => {
  btn.addEventListener('click', () => {
    rulesModal.classList.remove('open');
  });
});

// Awaiting Modal close trigger
const waitingModal = document.getElementById('waiting-modal');
const waitingClose = document.getElementById('waiting-close');

if (waitingClose) {
  waitingClose.addEventListener('click', () => {
    waitingModal.classList.remove('open');
    if (state.gameMode === 'online' || state.socket) {
      initGame(); // Disbands room and resets state
    }
  });
}

// Incoming Challenge Modal Interactions
const challengeModal = document.getElementById('challenge-modal');
const challengeClose = document.getElementById('challenge-close');
const btnAcceptChallenge = document.getElementById('btn-accept-challenge');
const btnDeclineChallenge = document.getElementById('btn-decline-challenge');

let incomingRoomId = null;

if (challengeClose) {
  challengeClose.addEventListener('click', () => {
    challengeModal.classList.remove('open');
    // clean up URL search parameters to avoid re-triggering modal
    window.history.replaceState({}, document.title, window.location.pathname);
    initGame(); // standard menu
  });
}

if (btnDeclineChallenge) {
  btnDeclineChallenge.addEventListener('click', () => {
    challengeModal.classList.remove('open');
    // clean up URL search parameters to avoid re-triggering modal
    window.history.replaceState({}, document.title, window.location.pathname);
    initGame(); // standard menu
  });
}

if (btnAcceptChallenge) {
  btnAcceptChallenge.addEventListener('click', () => {
    if (!incomingRoomId) return;
    
    challengeModal.classList.remove('open');
    const lang = state.language;
    showToast(translations[lang].toastConnecting, 'success');
    
    // Accept match invitation explicitly by connecting socket and joining
    connectSocket()
      .then(socket => {
        socket.emit('joinRoom', { roomId: incomingRoomId });
        // Clean URL parameter to avoid loop connections
        window.history.replaceState({}, document.title, window.location.pathname);
      })
      .catch(err => {
        console.error('[Challenge Accept] Connect failed:', err);
        showToast('Connection failed. Returning to menu.', 'error');
        initGame(); // fallback
      });
  });
}

// Copy invite matching code connection links to clipboard
const btnCopy = document.getElementById('btn-copy-link');
if (btnCopy) {
  btnCopy.addEventListener('click', () => {
    const input = document.getElementById('invite-link-input');
    input.select();
    input.setSelectionRange(0, 99999);
    
    navigator.clipboard.writeText(input.value)
      .then(() => {
        const lang = state.language;
        const dict = translations[lang];
        
        // Visual button copy confirmation state
        const originalText = document.getElementById('copy-btn-text').textContent;
        document.getElementById('copy-btn-text').textContent = dict.copiedBtn;
        btnCopy.querySelector('i').className = "fa-solid fa-check";
        
        showToast(dict.inviteCopied, 'success');
        
        setTimeout(() => {
          document.getElementById('copy-btn-text').textContent = originalText;
          btnCopy.querySelector('i').className = "fa-solid fa-copy";
        }, 2000);
      })
      .catch(err => {
        console.error('Copy mismatch error:', err);
      });
  });
}

// Restart Game interactions
document.getElementById('btn-restart').addEventListener('click', () => {
  if (state.gameMode === 'online') {
    if (state.socket) {
      state.socket.emit('resetGame');
    }
  } else {
    initGame(state.gameMode);
  }
});

document.getElementById('btn-rematch').addEventListener('click', () => {
  document.getElementById('gameover-overlay').classList.remove('open');
  if (state.gameMode === 'online') {
    if (state.socket) {
      state.socket.emit('resetGame');
    }
  } else {
    initGame(state.gameMode);
  }
});

// Back to menu action
document.getElementById('btn-back-menu').addEventListener('click', () => {
  document.getElementById('gameover-overlay').classList.remove('open');
  initGame();
});

// Language Switch Event
document.getElementById('btn-lang').addEventListener('click', () => {
  const nextLang = state.language === 'en' ? 'sk' : 'en';
  state.language = nextLang;
  updateLanguageDOM();
});

// OAuth Modal / login panels simulation listeners
const loginModal = document.getElementById('login-modal');
const loginClose = document.getElementById('login-close');

document.getElementById('btn-login-header').addEventListener('click', () => {
  const lang = state.language;
  if (state.isLoggedIn) {
    state.isLoggedIn = false;
    state.username = null;
    updateHeaderLoginDisplay();
    showToast(lang === 'en' ? 'Logged out successfully.' : 'Odhlásenie úspešné.', 'info');
  } else {
    loginModal.classList.add('open');
  }
});

if (loginClose) {
  loginClose.addEventListener('click', () => {
    loginModal.classList.remove('open');
  });
}

function triggerMockLogin(provider) {
  const lang = state.language;
  const dict = translations[lang];
  
  state.isLoggedIn = true;
  state.username = provider === 'google' ? 'GoogleCommander' : 'DiscordGladiator';
  
  loginModal.classList.remove('open');
  updateHeaderLoginDisplay();
  
  const successToast = provider === 'google' ? dict.toastGoogleSuccess : dict.toastDiscordSuccess;
  showToast(successToast, 'success');
}

document.getElementById('modal-google-login').addEventListener('click', () => {
  triggerMockLogin('google');
});

document.getElementById('modal-discord-login').addEventListener('click', () => {
  triggerMockLogin('discord');
});

document.getElementById('btn-google-login').addEventListener('click', () => {
  triggerMockLogin('google');
});

document.getElementById('btn-discord-login').addEventListener('click', () => {
  triggerMockLogin('discord');
});

// Main menu options bindings
document.getElementById('btn-mode-ai').addEventListener('click', () => {
  initGame('ai');
});

document.getElementById('btn-mode-local').addEventListener('click', () => {
  initGame('local');
});

document.getElementById('btn-mode-online').addEventListener('click', () => {
  initGame('online');
});

// Bootstrapper / room analyzer
window.addEventListener('DOMContentLoaded', () => {
  // Check URL query parameters for invitation rooms
  const params = new URLSearchParams(window.location.search);
  const roomId = params.get('room');

  if (roomId) {
    console.log('[Challenge Invite Detected] Room code:', roomId);
    incomingRoomId = roomId;
    
    // Set active translation templates immediately
    updateLanguageDOM();

    // Populate the challenge modal room code element
    const codeEl = document.getElementById('challenge-room-code');
    if (codeEl) {
      codeEl.textContent = roomId;
    }

    // Open challenge invite modal instead of immediately joining!
    // This blocks automatic bot/monitor pings from filling rooms
    const challengeModal = document.getElementById('challenge-modal');
    if (challengeModal) {
      challengeModal.classList.add('open');
    }
  } else {
    initGame(); // starts at standard menu
  }
});
