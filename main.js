(function(){
  function buildMeter(el, count, baseDelay){
    if(!el) return;
    for(let i=0;i<count;i++){
      const bar = document.createElement('i');
      bar.style.animationDelay = (baseDelay + i*0.11) + 's';
      el.appendChild(bar);
    }
  }
  buildMeter(document.getElementById('meterLeft'), 5, 0);
  buildMeter(document.getElementById('meterRight'), 5, 0.25);

  const core = document.getElementById('dialCore');
  if(core){
    core.addEventListener('click', function(){
      core.classList.toggle('is-active');
    });
  }

  const track = document.getElementById('resultsTrack');
  const prevBtn = document.getElementById('resultsPrev');
  const nextBtn = document.getElementById('resultsNext');
  if(track && prevBtn && nextBtn){
    const scrollStep = () => (track.querySelector('.result-card')?.offsetWidth || 260) + 16;
    prevBtn.addEventListener('click', () => track.scrollBy({left: -scrollStep(), behavior:'smooth'}));
    nextBtn.addEventListener('click', () => track.scrollBy({left: scrollStep(), behavior:'smooth'}));
  }

  // --- Modal de detalle de resultado ---
  // Añade rutas de imagen reales en "images" cuando las tengas (3-4 por resultado).
  const RESULTADOS = [
    { name: 'Próximamente', description: 'Aquí irá una descripción breve de qué hace esta web y para quién está pensada.', images: [] },
    { name: 'Próximamente', description: 'Aquí irá una descripción breve de qué hace esta web y para quién está pensada.', images: [] },
    { name: 'Próximamente', description: 'Aquí irá una descripción breve de qué hace esta web y para quién está pensada.', images: [] },
    { name: 'Próximamente', description: 'Aquí irá una descripción breve de qué hace esta web y para quién está pensada.', images: [] },
  ];

  const modal = document.getElementById('resultModal');
  const modalImage = document.getElementById('modalImage');
  const modalTitle = document.getElementById('modalTitle');
  const modalDesc = document.getElementById('modalDesc');
  const modalDots = document.getElementById('modalDots');
  const modalClose = document.getElementById('modalClose');
  const modalPrev = document.getElementById('modalPrev');
  const modalNext = document.getElementById('modalNext');

  let activeResult = null;
  let activeImg = 0;
  let lastFocused = null;

  function renderModalImage(){
    const item = RESULTADOS[activeResult];
    const src = item.images[activeImg];
    modalImage.innerHTML = src
      ? '<img src="' + src + '" alt="">'
      : '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 16V4M12 4l-4 4M12 4l4 4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>';
    modalDots.innerHTML = '';
    const total = Math.max(item.images.length, 1);
    for(let i=0;i<total;i++){
      const dot = document.createElement('span');
      if(i === activeImg) dot.classList.add('is-active');
      modalDots.appendChild(dot);
    }
  }

  function openModal(idx){
    activeResult = idx;
    activeImg = 0;
    const item = RESULTADOS[idx];
    modalTitle.textContent = item.name;
    modalDesc.textContent = item.description;
    renderModalImage();
    lastFocused = document.activeElement;
    modal.hidden = false;
    modalClose.focus();
    document.body.style.overflow = 'hidden';
  }

  function closeModal(){
    modal.hidden = true;
    document.body.style.overflow = '';
    if(lastFocused) lastFocused.focus();
  }

  document.querySelectorAll('.result-card').forEach(card => {
    const idx = Number(card.dataset.idx);
    card.addEventListener('click', () => openModal(idx));
    card.addEventListener('keydown', (e) => {
      if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); openModal(idx); }
    });
  });

  modalClose.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => { if(e.target === modal) closeModal(); });
  document.addEventListener('keydown', (e) => {
    if(modal.hidden) return;
    if(e.key === 'Escape') closeModal();
    if(e.key === 'ArrowRight') stepImage(1);
    if(e.key === 'ArrowLeft') stepImage(-1);
  });

  function stepImage(dir){
    const total = Math.max(RESULTADOS[activeResult].images.length, 1);
    activeImg = (activeImg + dir + total) % total;
    renderModalImage();
  }
  modalPrev.addEventListener('click', () => stepImage(-1));
  modalNext.addEventListener('click', () => stepImage(1));
})();
