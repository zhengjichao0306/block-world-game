// 一、准备世界。每个小格子是 32 × 32 像素。
const canvas = document.querySelector('#game');
const ctx = canvas.getContext('2d');
const statusText = document.querySelector('#status');
const SIZE = 32;
const COLS = canvas.width / SIZE;
const ROWS = canvas.height / SIZE;
const SPEED = 240;       // 每秒走多少像素，试着改成 300。
const JUMP = 520;        // 起跳速度，数字越大跳得越高。
const GRAVITY = 1400;    // 重力，让跳起的人落回地面。
const keys = new Set();
const player = { x: 96, y: 0, width: 24, height: 44, vy: 0, grounded: false };
let world = [];
let mode = 'place';
let hover = null;

function resetWorld() {
  // 0 是空气，1 是草方块，2 是泥土。数组就像一张格子地图。
  world = Array.from({ length: ROWS }, (_, row) =>
    Array.from({ length: COLS }, () => row === 14 ? 1 : row > 14 ? 2 : 0));
  player.x = 96;
  player.y = 14 * SIZE - player.height;
  player.vy = 0;
  player.grounded = false;
  keys.clear();
  statusText.textContent = '点击空格子放置方块，试着搭一座小楼梯吧！';
}

// 二、键盘输入。只在游戏画布获得焦点时控制角色。
const gameKeys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'KeyA', 'KeyD', 'KeyW', 'Space'];
canvas.addEventListener('keydown', event => {
  if (!gameKeys.includes(event.code)) return;
  event.preventDefault(); // 防止空格、方向键让网页滚动。
  keys.add(event.code);
  if (['Space', 'ArrowUp', 'KeyW'].includes(event.code) && !event.repeat && player.grounded) {
    player.vy = -JUMP;
    player.grounded = false;
  }
});
window.addEventListener('keyup', event => keys.delete(event.code));
canvas.addEventListener('blur', () => keys.clear());
window.addEventListener('blur', () => keys.clear());

// 三、碰撞检测：两个长方形重叠，就表示碰到了。
function overlaps(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x &&
    a.y < b.y + b.height && a.y + a.height > b.y;
}

function forEachBlock(action) {
  world.forEach((line, row) => line.forEach((type, col) => {
    if (type) action({ x: col * SIZE, y: row * SIZE, width: SIZE, height: SIZE }, type);
  }));
}

function update(dt) {
  const left = keys.has('ArrowLeft') || keys.has('KeyA');
  const right = keys.has('ArrowRight') || keys.has('KeyD');
  const dx = (Number(right) - Number(left)) * SPEED * dt;
  // 先横着走，再处理上下运动，这样碰撞更容易理解。
  player.x += dx;
  player.x = Math.max(0, Math.min(canvas.width - player.width, player.x));
  forEachBlock(block => {
    if (!overlaps(player, block)) return;
    if (dx > 0) player.x = block.x - player.width;
    if (dx < 0) player.x = block.x + block.width;
  });
  player.vy += GRAVITY * dt;
  player.y += player.vy * dt;
  player.grounded = false;
  forEachBlock(block => {
    if (!overlaps(player, block)) return;
    if (player.vy > 0) {
      player.y = block.y - player.height;
      player.grounded = true;
    } else if (player.vy < 0) {
      player.y = block.y + block.height;
    }
    player.vy = 0;
  });
  if (player.y < 0) { player.y = 0; player.vy = 0; }
}

// 四、鼠标建造。画布显示尺寸变小时，需要换算鼠标坐标。
function getCell(event) {
  const rect = canvas.getBoundingClientRect();
  const x = (event.clientX - rect.left - canvas.clientLeft) * canvas.width / canvas.clientWidth;
  const y = (event.clientY - rect.top - canvas.clientTop) * canvas.height / canvas.clientHeight;
  return { col: Math.floor(x / SIZE), row: Math.floor(y / SIZE) };
}
function editBlock(event) {
  if (event.button !== 0 && event.button !== 2) return;
  event.preventDefault();
  canvas.focus({ preventScroll: true });
  const { col, row } = getCell(event);
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return;
  if (row === ROWS - 1) {
    statusText.textContent = '最底层是世界的地基，要留着它哦！';
    return;
  }
  if (event.button === 2 || mode === 'remove') {
    world[row][col] = 0;
    statusText.textContent = '方块已删除。试着改造你的世界！';
  } else {
    const block = { x: col * SIZE, y: row * SIZE, width: SIZE, height: SIZE };
    if (overlaps(player, block)) {
      statusText.textContent = '这里站着小伙伴，换一个格子放吧！';
      return;
    }
    world[row][col] = 1;
    statusText.textContent = '方块已放好！可以跳上去看看。';
  }
}
canvas.addEventListener('mousedown', editBlock);
canvas.addEventListener('contextmenu', event => event.preventDefault());
canvas.addEventListener('mousemove', event => { hover = getCell(event); });
canvas.addEventListener('mouseleave', () => { hover = null; });
['place', 'remove'].forEach(name => {
  document.querySelector('#' + name).addEventListener('click', () => {
    mode = name;
    ['place', 'remove'].forEach(tool => {
      const button = document.querySelector('#' + tool);
      button.classList.toggle('selected', tool === mode);
      button.setAttribute('aria-pressed', String(tool === mode));
    });
    statusText.textContent = name === 'place' ? '放置模式：点击空格子，搭出你的想象。' : '删除模式：点击方块，就能移除它。';
    canvas.focus({ preventScroll: true });
  });
});
document.querySelector('#reset').addEventListener('click', () => {
  resetWorld();
  canvas.focus({ preventScroll: true });
});

// 五、绘画。只用长方形和圆形，不需要下载图片。
function draw() {
  ctx.fillStyle = '#bce5ed';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#fff2b6';
  ctx.beginPath(); ctx.arc(805, 86, 36, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffffffb8';
  [[150, 100], [430, 65], [665, 160]].forEach(([x, y]) => {
    ctx.fillRect(x, y, 110, 20);
    ctx.fillRect(x + 20, y - 20, 60, 20);
  });
  // 淡淡的网格，方便看清要放在哪个格子。
  ctx.strokeStyle = '#ffffff25';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= canvas.width; x += SIZE) { ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); }
  for (let y = 0; y <= canvas.height; y += SIZE) { ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); }
  ctx.stroke();
  forEachBlock((block, type) => {
    ctx.fillStyle = '#ad8058'; ctx.fillRect(block.x, block.y, SIZE, SIZE);
    ctx.fillStyle = '#c2946a';
    ctx.fillRect(block.x + 6, block.y + 15, 6, 5);
    ctx.fillRect(block.x + 22, block.y + 25, 4, 4);
    if (type === 1) {
      ctx.fillStyle = '#70ad58'; ctx.fillRect(block.x, block.y, SIZE, 9);
      ctx.fillStyle = '#91c76a'; ctx.fillRect(block.x, block.y, SIZE, 4);
    }
    ctx.strokeStyle = '#70553730'; ctx.strokeRect(block.x + .5, block.y + .5, SIZE - 1, SIZE - 1);
  });
  // 玩家：帽子、脸、衣服和鞋子。
  const x = Math.round(player.x), y = Math.round(player.y);
  ctx.fillStyle = '#ed9b46'; ctx.fillRect(x, y, 24, 8);
  ctx.fillStyle = '#ffe0ae'; ctx.fillRect(x + 2, y + 8, 20, 14);
  ctx.fillStyle = '#324a42'; ctx.fillRect(x + 6, y + 12, 3, 3); ctx.fillRect(x + 16, y + 12, 3, 3);
  ctx.fillStyle = '#427d77'; ctx.fillRect(x, y + 22, 24, 16);
  ctx.fillStyle = '#314d50'; ctx.fillRect(x + 2, y + 38, 8, 6); ctx.fillRect(x + 14, y + 38, 8, 6);
  if (hover && hover.row >= 0 && hover.row < ROWS && hover.col >= 0 && hover.col < COLS) {
    ctx.fillStyle = mode === 'place' ? '#ffffff44' : '#ef755e55';
    ctx.fillRect(hover.col * SIZE, hover.row * SIZE, SIZE, SIZE);
    ctx.strokeStyle = mode === 'place' ? '#ffffff' : '#b74937';
    ctx.lineWidth = 2;
    ctx.strokeRect(hover.col * SIZE + 1, hover.row * SIZE + 1, SIZE - 2, SIZE - 2);
  }
}

// 六、游戏循环。固定小步更新，让不同电脑上的速度接近一致。
let lastTime = 0;
let remaining = 0;
function loop(time) {
  remaining += Math.min((time - lastTime) / 1000, 0.05);
  lastTime = time;
  while (remaining >= 1 / 120) {
    update(1 / 120);
    remaining -= 1 / 120;
  }
  draw();
  requestAnimationFrame(loop);
}
resetWorld();
requestAnimationFrame(loop);
