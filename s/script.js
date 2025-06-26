const suits = ['♠', '♥', '♦', '♣'];
const ranks = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const tableauEl = document.getElementById('tableau');
const stockEl = document.getElementById('stock');
const wasteEl = document.getElementById('waste');
const flipSound = document.getElementById('flip-sound');
const flipSound1 = document.getElementById('flip-sound1');
const winsound = document.getElementById('win-sound');
flipSound.volume = 1.0;
flipSound1.volume = 1.0;
winsound.volume = 1.0;
const foundationEls = [
  document.getElementById('foundation0'),
  document.getElementById('foundation1'),
  document.getElementById('foundation2'),
  document.getElementById('foundation3'),
];

// --- Ghost Stack ---
let dragX = 0;
let dragY = 0;
const ghostStack = document.createElement('div');
ghostStack.id = 'ghost-stack';
ghostStack.style.position = 'fixed';
ghostStack.style.pointerEvents = 'none';
ghostStack.style.zIndex = '9999';
ghostStack.style.display = 'none';
document.body.appendChild(ghostStack);

document.addEventListener('drag', e => {
    dragX = e.clientX;
    dragY = e.clientY;
  
    const offsetX = parseFloat(ghostStack.dataset.offsetX) || 0;
    const offsetY = parseFloat(ghostStack.dataset.offsetY) || 0;
  
    ghostStack.style.left = `${dragX - offsetX - 50}px`;
    ghostStack.style.top = `${dragY - offsetY - 50}px`;
});
  

document.addEventListener('dragover', e => {
  if (e.target.classList.contains('pile')) e.preventDefault();
});

function checkWinCondition() {
  const count = foundationEls.reduce((sum, pile) => sum + pile.querySelectorAll('.card').length, 0);
  if (count === 52) {
    winsound.currentTime = 0; // rewind in case it's mid-play
    winsound.play();
    setTimeout(() => alert('🎉 You win!'), 100);
  }
}

let deck = [];
let gameState = null;

// === HELPERS ===
function rankValue(r) {
  return ranks.indexOf(r);
}

function isRed(suit) {
  return ['♥','♦'].includes(suit);
}

// === SOLVABILITY CHECK ===
function simulateBasicSolvability(state) {
  state = JSON.parse(JSON.stringify(state)); // clone so we don't mutate real game

  let moved;
  do {
    moved = false;
    state.tableau.forEach((pile, pIndex) => {
      const i = pile.findIndex(card => card.faceUp);
      if (i === -1) return;

      const top = pile[pile.length - 1];
      if (!top.faceUp) return;

      const foundation = state.foundations.find(f =>
        f.length === 0
          ? top.rank === 'A'
          : f[f.length - 1].suit === top.suit &&
            rankValue(top.rank) === rankValue(f[f.length - 1].rank) + 1
      );

      if (foundation) {
        foundation.push(top);
        pile.pop();
        if (pile.length && !pile[pile.length - 1].faceUp) {
          pile[pile.length - 1].faceUp = true;
        }
        moved = true;
      }
    });
  } while (moved);

  const totalCards = state.foundations.reduce((sum, pile) => sum + pile.length, 0);
  return totalCards === 52;
}

function snapshotGameState() {
    return {
      tableau: Array.from(document.querySelectorAll('.pile')).map(pile =>
        Array.from(pile.children).map(card => ({
          rank: card.dataset.rank,
          suit: card.dataset.suit,
          faceUp: !card.classList.contains('face-down')
        }))
      ),
      foundations: [[], [], [], []],
      stock: [] // Can be expanded later
    };
}

// === DEALING ===
function createDeck() {
    deck = [];
  
    // Step 1: Build the full deck
    const fullDeck = [];
    suits.forEach(suit => {
      ranks.forEach(rank => {
        const card = document.createElement('div');
        card.className = 'card face-down';
        card.dataset.rank = rank;
        card.dataset.suit = suit;
        card.draggable = true;
        card.innerHTML = `
          <span class="corner-symbol top">${rank}${suit}</span>
          <span class="corner-symbol bottom">${rank}${suit}</span>
        `;
        card.classList.add(['♦','♥'].includes(suit) ? 'red' : 'black');
        fullDeck.push(card);
      });
    });
  
    // Step 2: Slightly rig the shuffle by pulling a few Aces to the top
    const aces = fullDeck.filter(card => card.dataset.rank === 'A');
    const nonAces = fullDeck.filter(card => card.dataset.rank !== 'A');

    // Pull 2 Aces into known positions for tableau
    const forcedAces = aces.splice(0, 2);

    // Now build the start of deck like this
    deck = [
    ...forcedAces,                   // these will land in tableau
    ...nonAces.slice(0, 20),         // some randomness
    ...aces,                         // leftover Aces
    ...nonAces.slice(20)             // rest of deck
    ].sort(() => Math.random() - 0.5);
}
  
function deal() {
  tableauEl.innerHTML = '';
  for (let i = 0; i < 7; i++) {
    const pile = document.createElement('div');
    pile.className = 'pile';
    pile.style.position = 'relative';
    for (let j = 0; j <= i; j++) {
      const card = deck.pop();
      if (j === i) card.classList.remove('face-down');
      card.style.position = 'absolute';
      card.style.top = `${j * 30}px`;
      card.style.left = '0px';
      card.style.zIndex = j;
      pile.appendChild(card);
    }
    tableauEl.appendChild(pile);
  }

  stockEl.innerHTML = '';
  wasteEl.innerHTML = '';
  deck.forEach(card => {
    card.style.position = 'absolute';
    card.style.top = '0px';
    card.style.left = '0px';
    card.style.zIndex = 0;
    stockEl.appendChild(card);
  });

    // 🧠 Solvability check
    gameState = snapshotGameState();
    simulateBasicSolvability(gameState);
    const statusEl = document.getElementById('solvability');
    const difficulty = estimateDifficulty(gameState);
    if (statusEl) statusEl.textContent = difficulty + ' — Estimated Difficulty';
}

document.querySelectorAll('.foundation').forEach(pile => {
  pile.addEventListener('dragover', e => e.preventDefault());

  pile.addEventListener('drop', e => {
    e.preventDefault();
    const dragging = document.querySelector('.dragging');
    if (!dragging) return;

    const topCard = [...pile.children]
      .reverse()
      .find(c => c.classList.contains('card') && !c.classList.contains('face-down'));

    if (isValidFoundationMove(dragging, topCard, pile)) {
      const sourcePile = dragging.parentElement;
      const cardsInPile = Array.from(sourcePile.children);
      const startIndex = cardsInPile.indexOf(dragging);
      const stackToMove = cardsInPile.slice(startIndex);
      const baseOffset = pile.querySelectorAll('.card').length;

      stackToMove.forEach((card, i) => {
        card.style.top = `${(baseOffset + i) - 1}px`;
        card.style.left = '0px';
        card.style.zIndex = baseOffset + i;
      });

      stackToMove.forEach(card => {
        pile.appendChild(card);
      });

      // 🔁 Flip next card in source pile
      setTimeout(() => {
        const cards = Array.from(sourcePile.children);
        const topCard = cards[cards.length - 1];
        if (topCard && topCard.classList.contains('face-down')) {
          topCard.classList.remove('face-down');
          flipSound.currentTime = 0; // rewind in case it's mid-play
          flipSound.play();
        }
      }, 0);
      checkWinCondition();
    }
  });
});

function isValidFoundationMove(dragCard, topCard) {
  const r1 = dragCard.dataset.rank;
  const s1 = dragCard.dataset.suit;
  const val = r => ranks.indexOf(r);

  if (!topCard) return r1 === 'A';

  const r2 = topCard.dataset.rank;
  const s2 = topCard.dataset.suit;

  return s1 === s2 && val(r1) === val(r2) + 1;
}

stockEl.addEventListener('click', () => {
  if (stockEl.children.length === 0) {
    // ♻️ Move all waste cards back to stock
    const wasteCards = Array.from(wasteEl.children);
    wasteEl.innerHTML = '';

    wasteCards.reverse().forEach((card, i) => {
      card.classList.add('face-down');
      card.style.top = '0px';
      card.style.left = '0px';
      card.style.zIndex = i;
      stockEl.appendChild(card);
    });
    flipSound1.currentTime = 0; // rewind in case it's mid-play
    flipSound1.play();
  } else {
    // 🎯 Draw top card from stock to waste
    const top = stockEl.lastElementChild;
    if (top) {
      top.classList.remove('face-down');
      top.style.position = 'absolute';
      top.style.top = '0';
      top.style.left = '0';
      top.style.zIndex = wasteEl.children.length;

      wasteEl.appendChild(top);
      flipSound.currentTime = 0; // rewind in case it's mid-play
      flipSound.play();
    }
  }
});

document.getElementById('reset').addEventListener('click', () => {
  createDeck();
  deal();
});

document.addEventListener('dragstart', e => {
  if (e.target.classList.contains('card') && !e.target.classList.contains('face-down')) {
    const pile = e.target.parentElement;
    const cardsInPile = Array.from(pile.children);
    const startIndex = cardsInPile.indexOf(e.target);
    const stack = cardsInPile.slice(startIndex);

    // Create the ghost stack
    ghostStack.innerHTML = '';
    ghostStack.style.display = 'block';

    stack.forEach((originalCard, i) => {
        const clone = originalCard.cloneNode(true);
        clone.style.position = 'absolute';
        clone.style.top = `${i * 30}px`;
        clone.style.left = '0px';
        clone.style.zIndex = i;
        ghostStack.appendChild(clone);
    });

    // ⏳ Now that it's in the DOM, measure it
    requestAnimationFrame(() => {
        const bounds = ghostStack.getBoundingClientRect();
        ghostStack.dataset.offsetX = bounds.width / 2;
        ghostStack.dataset.offsetY = bounds.height / stack.length / 2;
        ghostStack.style.left = `${dragX - ghostStack.dataset.offsetX}px`;
        ghostStack.style.top = `${dragY - ghostStack.dataset.offsetY}px`;
    });

    stack.forEach((card, i) => {
      const clone = card.cloneNode(true);
      clone.style.position = 'absolute';
      clone.style.top = `${i * 30}px`;
      clone.style.left = '0px';
      clone.style.zIndex = i;
      ghostStack.appendChild(clone);
    });

    e.target.dataset.stackSize = stack.length;
    e.target.dataset.lastPile = pile.id;
    e.dataTransfer.setData('text/plain', '');
    stack.forEach(card => card.classList.add('dragging'));
    stack.forEach(card => card.style.opacity = '0');
  }
});

document.addEventListener('dragend', e => {
  const pile = e.target.parentElement;
  const cardsInPile = Array.from(pile.children);
  const startIndex = cardsInPile.indexOf(e.target);
  const stack = cardsInPile.slice(startIndex);
  
  if (e.target.classList.contains('card')) {
    ghostStack.style.display = 'none';
    ghostStack.innerHTML = '';
    stack.forEach(card => card.classList.remove('dragging'));
    stack.forEach(card => card.style.opacity = '');
  }
});

document.addEventListener('drop', e => {
  const dragging = document.querySelector('.dragging');
  if (!dragging) return;

  const targetPile = e.target.closest('.pile');
  if (!targetPile) return;

  const topCard = [...targetPile.children]
    .reverse()
    .find(c => c.classList.contains('card') && !c.classList.contains('face-down'));

  if (isValidDrop(dragging, topCard, targetPile)) {
    const sourcePile = dragging.parentElement;
    const cardsInPile = Array.from(sourcePile.children);
    const startIndex = cardsInPile.indexOf(dragging);
    const stackToMove = cardsInPile.slice(startIndex);
    const baseOffset = targetPile.querySelectorAll('.card').length;

    stackToMove.forEach((card, i) => {
      card.style.top = `${(baseOffset + i) * 30}px`;
      card.style.left = '0px';
      card.style.zIndex = baseOffset + i;
    });

    stackToMove.forEach(card => {
      targetPile.appendChild(card);
    });

    setTimeout(() => {
      const remaining = Array.from(sourcePile.children);
      const topCard = remaining[remaining.length - 1];
      if (topCard && topCard.classList.contains('face-down')) {
        topCard.classList.remove('face-down');
        flipSound.currentTime = 0; // rewind in case it's mid-play
        flipSound.play();
      }
    }, 0);
    checkWinCondition();
  }
});

function isValidDrop(dragCard, topCard) {
  const val = r => ranks.indexOf(r);
  const r1 = dragCard.dataset.rank;
  const s1 = dragCard.dataset.suit;
  const c1 = ['♦','♥'].includes(s1) ? 'red' : 'black';

  if (!topCard) return r1 === 'K';

  const r2 = topCard.dataset.rank;
  const s2 = topCard.dataset.suit;
  const c2 = ['♦','♥'].includes(s2) ? 'red' : 'black';

  return c1 !== c2 && val(r1) === val(r2) - 1;
}

// estimate difficulty
function estimateDifficulty(state) {
    let score = 0;
  
    // Boost for every face-up card
    const faceUp = state.tableau.reduce((sum, pile) =>
      sum + pile.filter(c => c.faceUp).length, 0);
    score += faceUp * 4;
  
    // Big bonus for visible Aces
    const visibleAces = state.tableau.flat().filter(
      c => c.faceUp && c.rank === 'A'
    ).length;
    score += visibleAces * 8;
  
    // Soft penalty for locked piles (not face-up until 3rd+ position)
    const locked = state.tableau.filter(pile =>
      pile.findIndex(c => c.faceUp) > 2
    ).length;
    score -= locked * 2;
  
    // Bonus for short piles (3 cards or fewer)
    const short = state.tableau.filter(p => p.length <= 3).length;
    score += short * 1.5;
  
    // Minimal penalty for buried cards
    const buried = state.tableau.reduce((sum, pile) =>
      sum + pile.filter(c => !c.faceUp).length, 0);
    score -= Math.floor(buried * 0.2);
  
    score = Math.round(score);
  
    if (score >= 40) return '🟢 Easy';
    if (score >= 25) return '🟡 Medium';
    return '🔴 Hard';
}    

// Initialize game
createDeck();
deal();