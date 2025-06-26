const canvas = document.getElementById('tetris');
canvas.width = 12 * 20;
canvas.height = 20 * 20;
const context = canvas.getContext('2d');
context.scale(20, 20);

const nextCanvas = document.getElementById('next');
nextCanvas.width = 6 * 20;
nextCanvas.height = 4 * 20;
const nextContext = nextCanvas.getContext('2d');
nextContext.scale(20, 20);

const scoreElement = document.getElementById('score');
const levelInfo = document.getElementById('level-info');
const difficultyPopup = document.getElementById('difficulty-popup');

const colors = [
  null,
  '#FF0D72',
  '#0DC2FF',
  '#0DFF72',
  '#F538FF',
  '#FF8E0D',
  '#FFE138',
  '#3877FF',
];

function createMatrix(w, h) {
  const matrix = [];
  while (h--) {
    matrix.push(new Array(w).fill(0));
  }
  return matrix;
}

function createPiece(type) {
  switch (type) {
    case 'T':
      return [
        [0, 0, 0],
        [1, 1, 1],
        [0, 1, 0],
      ];
    case 'O':
      return [
        [2, 2],
        [2, 2],
      ];
    case 'L':
      return [
        [0, 3, 0],
        [0, 3, 0],
        [0, 3, 3],
      ];
    case 'J':
      return [
        [0, 4, 0],
        [0, 4, 0],
        [4, 4, 0],
      ];
    case 'I':
      return [
        [0, 5, 0, 0],
        [0, 5, 0, 0],
        [0, 5, 0, 0],
        [0, 5, 0, 0],
      ];
    case 'S':
      return [
        [0, 6, 6],
        [6, 6, 0],
        [0, 0, 0],
      ];
    case 'Z':
      return [
        [7, 7, 0],
        [0, 7, 7],
        [0, 0, 0],
      ];
  }
}

function drawMatrix(matrix, offset, ctx = context, ghost = false) {
  matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value !== 0) {
        ctx.fillStyle = ghost ? `rgba(200,200,200,0.3)` : colors[value];
        ctx.fillRect(x + offset.x, y + offset.y, 1, 1);
        if (!ghost) {
          ctx.strokeStyle = '#222';
          ctx.lineWidth = 0.07;
          ctx.strokeRect(x + offset.x, y + offset.y, 1, 1);
        }
      }
    });
  });
}

function merge(arena, player) {
  player.matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value !== 0) {
        arena[y + player.pos.y][x + player.pos.x] = value;
      }
    });
  });
}

function collide(arena, player) {
  const m = player.matrix;
  const o = player.pos;
  for (let y = 0; y < m.length; ++y) {
    for (let x = 0; x < m[y].length; ++x) {
      if (
        m[y][x] !== 0 &&
        (arena[y + o.y] && arena[y + o.y][x + o.x]) !== 0
      ) {
        return true;
      }
    }
  }
  return false;
}

function arenaSweep() {
  let rowCount = 1;
  outer: for (let y = arena.length - 1; y >= 0; --y) {
    for (let x = 0; x < arena[y].length; ++x) {
      if (arena[y][x] === 0) {
        continue outer;
      }
    }

    const row = arena.splice(y, 1)[0].fill(0);
    arena.unshift(row);
    y++;

    player.score += rowCount * 10;
    rowCount *= 2;

    linesCleared++;
    if (linesCleared % 5 === 0) {
      level++;
      dropInterval = Math.max(100, dropInterval - 50);
      showDifficultyPopup();
    }
  }
}

function showDifficultyPopup() {
  difficultyPopup.style.display = 'block';
  difficultyPopup.textContent = `Level ${level} - Speed: ${dropInterval}ms`;
  setTimeout(() => {
    difficultyPopup.style.display = 'none';
  }, 2000);
}

function draw() {
  context.fillStyle = '#111';
  context.fillRect(0, 0, canvas.width, canvas.height);

  drawGhostPiece();

  drawMatrix(arena, { x: 0, y: 0 });
  drawMatrix(player.matrix, player.pos);

  drawNext();
}

function drawNext() {
  nextContext.fillStyle = '#111';
  nextContext.fillRect(0, 0, nextCanvas.width, nextCanvas.height);

  drawMatrix(next.matrix, { x: 1, y: 1 }, nextContext);
}

function playerDrop() {
  player.pos.y++;
  if (collide(arena, player)) {
    player.pos.y--;
    merge(arena, player);
    playerReset();
    arenaSweep();
    updateScore();
    dropCounter = 0;
  }
}

function updateScore() {
  scoreElement.textContent = player.score;
  levelInfo.textContent = `Level: ${level} Speed: ${dropInterval}`;
}

function playerReset() {
  const pieces = 'TJLOSZI';
  player.matrix = createPiece(pieces[(pieces.length * Math.random()) | 0]);
  player.pos.y = 0;
  player.pos.x = ((arena[0].length / 2) | 0) - ((player.matrix[0].length / 2) | 0);

  if (collide(arena, player)) {
    arena.forEach(row => row.fill(0));
    player.score = 0;
    level = 1;
    dropInterval = 1000;
    linesCleared = 0;
    updateScore();
  }

  next.matrix = createPiece(pieces[(pieces.length * Math.random()) | 0]);
}

function rotate(matrix, dir) {
  for (let y = 0; y < matrix.length; ++y) {
    for (let x = 0; x < y; ++x) {
      [matrix[x][y], matrix[y][x]] = [matrix[y][x], matrix[x][y]];
    }
  }
  if (dir > 0) {
    matrix.forEach(row => row.reverse());
  } else {
    matrix.reverse();
  }
}

function playerRotate(dir) {
  const pos = player.pos.x;
  let offset = 1;
  rotate(player.matrix, dir);
  while (collide(arena, player)) {
    player.pos.x += offset;
    offset = -(offset + (offset > 0 ? 1 : -1));
    if (offset > player.matrix[0].length) {
      rotate(player.matrix, -dir);
      player.pos.x = pos;
      return;
    }
  }
}

function hardDrop() {
  while (!collide(arena, player)) {
    player.pos.y++;
  }
  player.pos.y--;
  merge(arena, player);
  playerReset();
  arenaSweep();
  updateScore();
  dropCounter = 0;
}

function playerMove(dir) {
  player.pos.x += dir;
  if (collide(arena, player)) {
    player.pos.x -= dir;
  }
}

function drawGhostPiece() {
  let ghostY = player.pos.y;
  while (!collide(arena, { pos: { x: player.pos.x, y: ghostY + 1 }, matrix: player.matrix })) {
    ghostY++;
  }
  drawMatrix(player.matrix, { x: player.pos.x, y: ghostY }, context, true);
}

let dropCounter = 0;
let dropInterval = 1000;

let lastTime = 0;

let level = 1;
let linesCleared = 0;

const arena = createMatrix(12, 20);

const player = {
  pos: { x: 0, y: 0 },
  matrix: null,
  score: 0,
};

const next = {
  matrix: null,
};

function update(time = 0) {
  const deltaTime = time - lastTime;
  lastTime = time;

  dropCounter += deltaTime;
  if (dropCounter > dropInterval) {
    playerDrop();
    dropCounter = 0;
  }

  draw();
  requestAnimationFrame(update);
}

document.addEventListener('keydown', event => {
  if (event.code === 'ArrowLeft') {
    playerMove(-1);
  } else if (event.code === 'ArrowRight') {
    playerMove(1);
  } else if (event.code === 'ArrowDown') {
    playerDrop();
  } else if (event.code === 'ArrowUp') {
    playerRotate(1);
  } else if (event.code === 'Space') {
    event.preventDefault();
    hardDrop();
  }
});

playerReset();
updateScore();
update();