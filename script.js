document.addEventListener('DOMContentLoaded', () => {
  // 线号切换
  document.querySelectorAll('.line-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.line-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      document.getElementById('title').textContent = 'HCQuick';
      document.getElementById('brand-grid').innerHTML = '<span class="hint">请先同步数据</span>';
      document.getElementById('spec-grid').innerHTML = '';
    });
  });

  // 初始状态
  document.getElementById('brand-grid').innerHTML = '<span class="hint">请先同步数据</span>';
});
