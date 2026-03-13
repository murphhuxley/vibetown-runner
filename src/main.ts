const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

canvas.width = 896;  // 28 tiles * 32px
canvas.height = 544; // 17 tiles * 32px (16 rows + 1 for UI)

ctx.fillStyle = '#F2EDE8';
ctx.fillRect(0, 0, canvas.width, canvas.height);
ctx.fillStyle = '#141414';
ctx.font = '24px monospace';
ctx.fillText('Vibetown Runner', 320, 272);

console.log('Vibetown Runner initialized');
