import { 
    buscarPrompts, criarPrompt, editarPrompt, deletarPrompt, 
    buscarAnotacoes, criarAnotacao, editarAnotacao, deletarAnotacao,
    uploadImagem
} from './supabase.js';

// ===================== ESTADO =====================
let state = {
    prompts: [],
    anotacoes: [],
    activeTab: 'prompts',
    promptFilter: 'TODOS',
    anotacaoFilter: 'Todos',
    categories: ['TODOS', 'ARTE', 'FOTOGRAFIA', 'ESCRITA', 'CÓDIGO', 'MARKETING', 'NEGÓCIOS', 'EDUCAÇÃO'],
    tags: ['Todos', 'Ângulos', 'Iluminação', 'Composição', 'Dicas', 'Estilos', 'Câmera', 'links']
};

// ===================== SELETORES DOM =====================
const elements = {
    navPrompts: document.getElementById('nav-prompts'),
    navAnotacoes: document.getElementById('nav-anotacoes'),
    sectionPrompts: document.getElementById('section-prompts'),
    sectionAnotacoes: document.getElementById('section-anotacoes'),
    promptsGrid: document.getElementById('prompts-grid'),
    anotacoesGrid: document.getElementById('anotacoes-grid'),
    promptFilters: document.getElementById('prompt-filters'),
    anotacaoFilters: document.getElementById('anotacao-filters'),
    promptCounter: document.getElementById('prompt-counter'),
    anotacaoCounter: document.getElementById('anotacao-counter'),
    modalPrompt: document.getElementById('modal-prompt'),
    modalAnotacao: document.getElementById('modal-anotacao'),
    modalViewPrompt: document.getElementById('modal-view-prompt'),
    modalConfirm: document.getElementById('modal-confirm'),
    modalInput: document.getElementById('modal-input'),
    btnNewPrompt: document.getElementById('btn-new-prompt'),
    btnNewAnotacao: document.getElementById('btn-new-anotacao'),
    toastContainer: document.getElementById('toast-container'),
};

// ===================== INICIALIZAÇÃO =====================
window.addEventListener('DOMContentLoaded', async () => {
    setupEventListeners();
    // Mostrar skeletons enquanto dados carregam
    renderSkeletons(elements.promptsGrid, 8);
    renderSkeletons(elements.anotacoesGrid, 6);
    await fetchData();
    renderAll();
});

async function fetchData() {
    try {
        state.prompts = await buscarPrompts();
        state.anotacoes = await buscarAnotacoes();
        
        const customCats = state.prompts
            .map(p => p.categoria)
            .filter(c => c && !state.categories.includes(c));
        state.categories = [...new Set([...state.categories, ...customCats])];

        const customTags = state.anotacoes
            .map(a => a.tag)
            .filter(t => t && !state.tags.includes(t));
        state.tags = [...new Set([...state.tags, ...customTags])];
    } catch (error) {
        console.error("Erro ao carregar dados:", error);
        showToast('Erro ao carregar dados. Verifique sua conexão.', 'error');
    }
}

// ===================== TOAST SYSTEM =====================
function showToast(message, type = 'success') {
    const icons = { success: '✓', error: '✕', info: 'ℹ' };
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span class="toast-icon">${icons[type] || '•'}</span><span>${message}</span>`;
    elements.toastContainer.appendChild(toast);

    const remove = () => {
        toast.classList.add('hiding');
        toast.addEventListener('animationend', () => toast.remove(), { once: true });
    };
    setTimeout(remove, 3200);
}

// ===================== MODAL DE CONFIRMAÇÃO =====================
function showConfirm(message) {
    return new Promise(resolve => {
        document.getElementById('modal-confirm-msg').textContent = message;
        elements.modalConfirm.classList.add('active');

        const onOk = () => { cleanup(); resolve(true); };
        const onCancel = () => { cleanup(); resolve(false); };

        const btnOk = document.getElementById('modal-confirm-ok');
        const btnCancel = document.getElementById('modal-confirm-cancel');

        function cleanup() {
            elements.modalConfirm.classList.remove('active');
            btnOk.removeEventListener('click', onOk);
            btnCancel.removeEventListener('click', onCancel);
        }

        btnOk.addEventListener('click', onOk, { once: true });
        btnCancel.addEventListener('click', onCancel, { once: true });
    });
}

// ===================== MODAL DE INPUT =====================
function showInputModal(label, placeholder = '') {
    return new Promise(resolve => {
        document.getElementById('modal-input-label').textContent = label;
        const field = document.getElementById('modal-input-field');
        field.placeholder = placeholder;
        field.value = '';
        elements.modalInput.classList.add('active');
        setTimeout(() => field.focus(), 50);

        const onOk = () => { cleanup(); resolve(field.value.trim() || null); };
        const onCancel = () => { cleanup(); resolve(null); };
        const onKey = (e) => { if (e.key === 'Enter') onOk(); if (e.key === 'Escape') onCancel(); };

        const btnOk = document.getElementById('modal-input-ok');
        const btnCancel = document.getElementById('modal-input-cancel');

        function cleanup() {
            elements.modalInput.classList.remove('active');
            btnOk.removeEventListener('click', onOk);
            btnCancel.removeEventListener('click', onCancel);
            field.removeEventListener('keydown', onKey);
        }

        btnOk.addEventListener('click', onOk, { once: true });
        btnCancel.addEventListener('click', onCancel, { once: true });
        field.addEventListener('keydown', onKey);
    });
}

// ===================== SKELETON LOADERS =====================
function renderSkeletons(grid, count) {
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < count; i++) {
        const el = document.createElement('div');
        el.className = 'skeleton-card';
        el.innerHTML = `
            <div class="skel-image skeleton"></div>
            <div class="skel-body">
                <div class="skel-badge skeleton"></div>
                <div class="skel-title skeleton"></div>
                <div class="skel-desc skeleton"></div>
            </div>`;
        fragment.appendChild(el);
    }
    grid.innerHTML = '';
    grid.appendChild(fragment);
}

// ===================== RENDERIZAÇÃO =====================
function renderAll() {
    renderFilters();
    renderPromptsGrid();
    renderAnotacoesGrid();
    updateCounters();
}

function renderFilters() {
    elements.promptFilters.innerHTML = state.categories.map(cat => `
        <button class="filter-tag ${state.promptFilter === cat ? 'active' : ''}" 
                onclick="window.setPromptFilter('${cat}')">
            ${cat}
        </button>
    `).join('');

    elements.anotacaoFilters.innerHTML = state.tags.map(tag => `
        <button class="filter-tag ${state.anotacaoFilter === tag ? 'active' : ''}" 
                onclick="window.setAnotacaoFilter('${tag}')">
            ${tag}
        </button>
    `).join('');
}

function buildPromptCard(prompt, animate = false) {
    const div = document.createElement('div');
    div.className = `card${animate ? ' card-entering' : ''}`;
    div.id = `card-${prompt.id}`;
    div.onclick = () => window.copyPrompt(prompt.id);

    const imgHtml = prompt.imagem_url
        ? `<img src="${prompt.imagem_url}" loading="lazy" class="loading" 
              alt="${prompt.titulo}"
              onload="this.classList.remove('loading')"
              onerror="this.parentElement.innerHTML='<span class=\\'card-fallback\\'>Sem Imagem</span>'">`
        : `<span class="card-fallback">Sem Imagem</span>`;

    div.innerHTML = `
        <div class="card-image">${imgHtml}</div>
        <div class="card-content">
            <span class="card-badge">${prompt.categoria || 'GERAL'}</span>
            <h3 class="card-title">${prompt.titulo}</h3>
            <p class="card-desc">${prompt.descricao || ''}</p>
        </div>
        <div class="card-actions">
            <button class="btn-action" title="Ver" onclick="event.stopPropagation(); window.viewPrompt('${prompt.id}')">👁</button>
            <button class="btn-action" title="Editar" onclick="event.stopPropagation(); window.editPrompt('${prompt.id}')">✎</button>
            <button class="btn-action" title="Excluir" onclick="event.stopPropagation(); window.deletePromptHandler('${prompt.id}')">×</button>
        </div>
        <div class="copy-overlay">✓ Copiado!</div>
    `;
    return div;
}

function buildNotaCard(nota, animate = false) {
    const div = document.createElement('div');
    div.className = `card nota-card${animate ? ' card-entering' : ''}`;
    div.id = `card-nota-${nota.id}`;

    div.innerHTML = `
        <div class="card-content">
            <span class="card-badge">${nota.tag || 'Dicas'}</span>
            <h3 class="card-title">${nota.titulo || 'Sem Título'}</h3>
            <div class="card-desc" style="-webkit-line-clamp: 6; line-clamp: 6;">
                ${formatContent(nota.conteudo)}
            </div>
        </div>
        <div class="card-actions">
            <button class="btn-action" title="Editar" onclick="event.stopPropagation(); window.editAnotacao('${nota.id}')">✎</button>
            <button class="btn-action" title="Excluir" onclick="event.stopPropagation(); window.deleteAnotacaoHandler('${nota.id}')">×</button>
        </div>
    `;
    return div;
}

function renderPromptsGrid() {
    const filtered = state.promptFilter === 'TODOS'
        ? state.prompts
        : state.prompts.filter(p => p.categoria === state.promptFilter);

    elements.promptsGrid.innerHTML = '';

    if (filtered.length === 0) {
        elements.promptsGrid.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🗂</div>
                <p class="empty-state-title">Nenhum prompt aqui</p>
                <p class="empty-state-sub">Tente outro filtro ou adicione um novo prompt.</p>
            </div>`;
        return;
    }

    const fragment = document.createDocumentFragment();
    filtered.forEach((prompt, i) => {
        const card = buildPromptCard(prompt);
        card.style.animationDelay = `${i * 45}ms`;
        card.classList.add('card-entering');
        fragment.appendChild(card);
    });
    elements.promptsGrid.appendChild(fragment);
}

function renderAnotacoesGrid() {
    const filtered = state.anotacaoFilter === 'Todos'
        ? state.anotacoes
        : state.anotacoes.filter(a => a.tag === state.anotacaoFilter);

    elements.anotacoesGrid.innerHTML = '';

    if (filtered.length === 0) {
        elements.anotacoesGrid.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📝</div>
                <p class="empty-state-title">Nenhuma anotação aqui</p>
                <p class="empty-state-sub">Tente outra tag ou crie uma nova anotação.</p>
            </div>`;
        return;
    }

    const fragment = document.createDocumentFragment();
    filtered.forEach((nota, i) => {
        const card = buildNotaCard(nota);
        card.style.animationDelay = `${i * 45}ms`;
        card.classList.add('card-entering');
        fragment.appendChild(card);
    });
    elements.anotacoesGrid.appendChild(fragment);
}

function updateCounters() {
    elements.promptCounter.innerText = `${state.prompts.length} prompts salvos`;
    elements.anotacaoCounter.innerText = `${state.anotacoes.length} anotações salvas`;
}

// Formata links clicáveis
function formatContent(text) {
    if (!text) return '';
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.replace(urlRegex, url => `<a href="${url}" target="_blank" rel="noopener" onclick="event.stopPropagation()">${url}</a>`);
}

// ===================== FILTROS =====================
window.setPromptFilter = (cat) => {
    state.promptFilter = cat;
    renderFilters();
    renderPromptsGrid();
};

window.setAnotacaoFilter = (tag) => {
    state.anotacaoFilter = tag;
    renderFilters();
    renderAnotacoesGrid();
};

// ===================== EVENT LISTENERS =====================
function setupEventListeners() {
    elements.navPrompts.addEventListener('click', () => switchTab('prompts'));
    elements.navAnotacoes.addEventListener('click', () => switchTab('anotacoes'));

    elements.btnNewPrompt.addEventListener('click', () => openModal('prompt'));
    elements.btnNewAnotacao.addEventListener('click', () => openModal('anotacao'));

    // Fechar modal ao clicar no backdrop
    [elements.modalPrompt, elements.modalAnotacao, elements.modalViewPrompt].forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
    });

    // Fechar com Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModal();
    });

    // Botões de fechar modal
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', closeModal);
    });

    // Submits
    document.getElementById('form-prompt').addEventListener('submit', handlePromptSubmit);
    document.getElementById('form-anotacao').addEventListener('submit', handleAnotacaoSubmit);

    // Adicionar Categorias/Tags (sem prompt() nativo)
    document.getElementById('btn-add-cat').addEventListener('click', async () => {
        const newCat = await showInputModal('Nova Categoria:', 'Ex: ARQUITETURA');
        if (newCat && !state.categories.includes(newCat.toUpperCase())) {
            state.categories.push(newCat.toUpperCase());
            const select = document.getElementById('p-categoria');
            const option = new Option(newCat.toUpperCase(), newCat.toUpperCase());
            select.add(option);
            select.value = newCat.toUpperCase();
            renderFilters();
        }
    });

    document.getElementById('btn-add-tag').addEventListener('click', async () => {
        const newTag = await showInputModal('Nova Tag:', 'Ex: Pós-Produção');
        if (newTag && !state.tags.includes(newTag)) {
            state.tags.push(newTag);
            const select = document.getElementById('a-tag');
            const option = new Option(newTag, newTag);
            select.add(option);
            select.value = newTag;
            renderFilters();
        }
    });

    // Seleção de arquivo — feedback visual
    const fileInput = document.getElementById('p-imagem-file');
    const fileChosen = document.getElementById('file-chosen');
    if (fileInput) {
        fileInput.addEventListener('change', () => {
            fileChosen.textContent = fileInput.files[0]
                ? `📎 ${fileInput.files[0].name}`
                : 'Nenhum arquivo selecionado';
        });
    }

    // Botão copiar no modal de visualização
    document.getElementById('btn-copy-prompt').addEventListener('click', async () => {
        const content = document.getElementById('view-content').innerText;
        const btn = document.getElementById('btn-copy-prompt');
        try {
            await navigator.clipboard.writeText(content);
            btn.textContent = 'Copiado ✓';
            btn.classList.add('copied');
            showToast('Copiado para a área de transferência!', 'info');
            setTimeout(() => {
                btn.textContent = 'Copiar Prompt';
                btn.classList.remove('copied');
            }, 2200);
        } catch {
            showToast('Erro ao copiar. Tente manualmente.', 'error');
        }
    });
}

// ===================== NAVEGAÇÃO =====================
function switchTab(tab) {
    state.activeTab = tab;
    elements.navPrompts.classList.toggle('active', tab === 'prompts');
    elements.navAnotacoes.classList.toggle('active', tab === 'anotacoes');
    elements.sectionPrompts.classList.toggle('hidden', tab !== 'prompts');
    elements.sectionAnotacoes.classList.toggle('hidden', tab !== 'anotacoes');
}

// ===================== MODAIS =====================
function openModal(type, data = null) {
    if (type === 'prompt') {
        const form = document.getElementById('form-prompt');
        form.reset();
        hideFormError('prompt-error-msg');
        document.getElementById('prompt-id').value = data ? data.id : '';
        document.getElementById('prompt-modal-title').innerText = data ? 'Editar Prompt' : 'Novo Prompt';
        const submitBtn = document.getElementById('btn-submit-prompt');
        submitBtn.querySelector('.btn-text').textContent = data ? 'Salvar Alterações' : 'Criar Prompt';

        if (data) {
            document.getElementById('p-titulo').value = data.titulo || '';
            document.getElementById('p-descricao').value = data.descricao || '';
            document.getElementById('p-prompt').value = data.prompt || '';
            document.getElementById('p-categoria').value = data.categoria || 'ARTE';
            document.getElementById('p-imagem-url').value = data.imagem_url || '';
        }

        elements.modalPrompt.classList.add('active');
        setTimeout(() => document.getElementById('p-titulo').focus(), 80);

    } else if (type === 'anotacao') {
        const form = document.getElementById('form-anotacao');
        form.reset();
        hideFormError('anotacao-error-msg');
        document.getElementById('anotacao-id').value = data ? data.id : '';
        document.getElementById('anotacao-modal-title').innerText = data ? 'Editar Anotação' : 'Nova Anotação';
        const submitBtn = document.getElementById('btn-submit-anotacao');
        submitBtn.querySelector('.btn-text').textContent = data ? 'Salvar Alterações' : 'Criar';

        if (data) {
            document.getElementById('a-titulo').value = data.titulo || '';
            document.getElementById('a-tag').value = data.tag || 'Dicas';
            document.getElementById('a-conteudo').value = data.conteudo || '';
        }

        elements.modalAnotacao.classList.add('active');
        setTimeout(() => document.getElementById('a-titulo').focus(), 80);
    }
}

function closeModal() {
    const modals = [elements.modalPrompt, elements.modalAnotacao, elements.modalViewPrompt];
    modals.forEach(modal => {
        if (modal.classList.contains('active')) {
            const content = modal.querySelector('.modal-content');
            if (content) {
                content.classList.add('closing');
                const remove = () => {
                    modal.classList.remove('active');
                    content.classList.remove('closing');
                };
                content.addEventListener('animationend', remove, { once: true });
                // Fallback caso animação não dispare
                setTimeout(() => {
                    modal.classList.remove('active');
                    content.classList.remove('closing');
                }, 250);
            } else {
                modal.classList.remove('active');
            }
        }
    });

    // Reset file chooser
    const fileChosen = document.getElementById('file-chosen');
    if (fileChosen) fileChosen.textContent = 'Nenhum arquivo selecionado';
    const fileInput = document.getElementById('p-imagem-file');
    if (fileInput) fileInput.value = '';
}

// ===================== HELPERS DE FORM =====================
function setSubmitLoading(btnId, loading, loadingText = 'Processando...') {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    const textEl = btn.querySelector('.btn-text');
    const spinEl = btn.querySelector('.btn-spinner');
    btn.disabled = loading;
    if (textEl) textEl.textContent = loading ? loadingText : btn.dataset.originalText || textEl.textContent;
    if (spinEl) spinEl.style.display = loading ? 'inline' : 'none';
}

function showFormError(containerId, message) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.style.display = 'block';
    container.querySelector('.form-error').textContent = message;
}

function hideFormError(containerId) {
    const container = document.getElementById(containerId);
    if (container) container.style.display = 'none';
}

// ===================== CRUD: PROMPTS =====================
async function handlePromptSubmit(e) {
    e.preventDefault();
    hideFormError('prompt-error-msg');

    const id = document.getElementById('prompt-id').value;
    const fileInput = document.getElementById('p-imagem-file');
    let imagemUrl = document.getElementById('p-imagem-url').value;
    const isEdit = Boolean(id);

    setSubmitLoading('btn-submit-prompt', true, isEdit ? 'Salvando...' : 'Criando...');

    try {
        if (fileInput && fileInput.files[0]) {
            imagemUrl = await uploadImagem(fileInput.files[0]);
        }

        const dados = {
            titulo: document.getElementById('p-titulo').value,
            descricao: document.getElementById('p-descricao').value,
            prompt: document.getElementById('p-prompt').value,
            categoria: document.getElementById('p-categoria').value,
            imagem_url: imagemUrl
        };

        if (isEdit) {
            const updated = await editarPrompt(id, dados);
            // Atualizar apenas o card afetado no DOM
            const idx = state.prompts.findIndex(p => p.id === id);
            if (idx !== -1) state.prompts[idx] = { ...state.prompts[idx], ...dados };
            const existingCard = document.getElementById(`card-${id}`);
            if (existingCard) {
                const newCard = buildPromptCard(state.prompts[idx], true);
                existingCard.replaceWith(newCard);
            }
            showToast('Prompt atualizado com sucesso!', 'success');
        } else {
            const created = await criarPrompt(dados);
            state.prompts.unshift(created);
            // Adicionar card no topo do grid com animação
            if (state.promptFilter === 'TODOS' || state.promptFilter === dados.categoria) {
                const newCard = buildPromptCard(created, true);
                elements.promptsGrid.prepend(newCard);
                // Remover empty state se existia
                const empty = elements.promptsGrid.querySelector('.empty-state');
                if (empty) empty.remove();
            }
            showToast('Prompt criado!', 'success');
        }

        updateCounters();
        renderFilters(); // Atualiza contagens e categorias
        closeModal();
    } catch (err) {
        showFormError('prompt-error-msg', 'Erro ao salvar: ' + err.message);
        showToast('Erro ao salvar prompt.', 'error');
    } finally {
        setSubmitLoading('btn-submit-prompt', false);
    }
}

async function handleAnotacaoSubmit(e) {
    e.preventDefault();
    hideFormError('anotacao-error-msg');

    const id = document.getElementById('anotacao-id').value;
    const isEdit = Boolean(id);

    const dados = {
        titulo: document.getElementById('a-titulo').value,
        tag: document.getElementById('a-tag').value,
        conteudo: document.getElementById('a-conteudo').value
    };

    setSubmitLoading('btn-submit-anotacao', true, isEdit ? 'Salvando...' : 'Criando...');

    try {
        if (isEdit) {
            await editarAnotacao(id, dados);
            const idx = state.anotacoes.findIndex(a => a.id === id);
            if (idx !== -1) state.anotacoes[idx] = { ...state.anotacoes[idx], ...dados };
            const existingCard = document.getElementById(`card-nota-${id}`);
            if (existingCard) {
                const newCard = buildNotaCard(state.anotacoes[idx], true);
                existingCard.replaceWith(newCard);
            }
            showToast('Anotação atualizada!', 'success');
        } else {
            const created = await criarAnotacao(dados);
            state.anotacoes.unshift(created);
            if (state.anotacaoFilter === 'Todos' || state.anotacaoFilter === dados.tag) {
                const newCard = buildNotaCard(created, true);
                elements.anotacoesGrid.prepend(newCard);
                const empty = elements.anotacoesGrid.querySelector('.empty-state');
                if (empty) empty.remove();
            }
            showToast('Anotação salva!', 'success');
        }

        updateCounters();
        renderFilters();
        closeModal();
    } catch (err) {
        showFormError('anotacao-error-msg', 'Erro ao salvar: ' + err.message);
        showToast('Erro ao salvar anotação.', 'error');
    } finally {
        setSubmitLoading('btn-submit-anotacao', false);
    }
}

// ===================== COPIAR PROMPT =====================
window.copyPrompt = async (id) => {
    const promptObj = state.prompts.find(p => p.id === id);
    if (promptObj) {
        try {
            await navigator.clipboard.writeText(promptObj.prompt);
            const card = document.getElementById(`card-${id}`);
            if (card) {
                card.classList.add('copied');
                setTimeout(() => card.classList.remove('copied'), 1600);
            }
            showToast('Copiado para a área de transferência!', 'info');
        } catch {
            showToast('Não foi possível copiar.', 'error');
        }
    }
};

// ===================== DELETE =====================
window.deletePromptHandler = async (id) => {
    const confirmed = await showConfirm('Deseja realmente excluir este prompt?');
    if (!confirmed) return;

    const card = document.getElementById(`card-${id}`);
    if (card) {
        card.classList.add('card-exiting');
        await new Promise(resolve => setTimeout(resolve, 220));
    }

    try {
        await deletarPrompt(id);
        state.prompts = state.prompts.filter(p => p.id !== id);
        if (card) card.remove();
        updateCounters();
        renderFilters();
        showToast('Prompt excluído.', 'info');

        // Mostrar empty state se grid ficou vazio
        const visibleCards = elements.promptsGrid.querySelectorAll('.card');
        if (visibleCards.length === 0) {
            elements.promptsGrid.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">🗂</div>
                    <p class="empty-state-title">Nenhum prompt aqui</p>
                    <p class="empty-state-sub">Adicione um novo prompt clicando em "+ Novo Prompt".</p>
                </div>`;
        }
    } catch (err) {
        showToast('Erro ao excluir prompt.', 'error');
        if (card) card.classList.remove('card-exiting');
    }
};

window.deleteAnotacaoHandler = async (id) => {
    const confirmed = await showConfirm('Deseja realmente excluir esta anotação?');
    if (!confirmed) return;

    const card = document.getElementById(`card-nota-${id}`);
    if (card) {
        card.classList.add('card-exiting');
        await new Promise(resolve => setTimeout(resolve, 220));
    }

    try {
        await deletarAnotacao(id);
        state.anotacoes = state.anotacoes.filter(a => a.id !== id);
        if (card) card.remove();
        updateCounters();
        renderFilters();
        showToast('Anotação excluída.', 'info');

        const visibleCards = elements.anotacoesGrid.querySelectorAll('.card');
        if (visibleCards.length === 0) {
            elements.anotacoesGrid.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📝</div>
                    <p class="empty-state-title">Nenhuma anotação aqui</p>
                    <p class="empty-state-sub">Crie uma nova anotação clicando em "+ Nova".</p>
                </div>`;
        }
    } catch (err) {
        showToast('Erro ao excluir anotação.', 'error');
        if (card) card.classList.remove('card-exiting');
    }
};

// ===================== EDITAR =====================
window.editPrompt = (id) => {
    const promptObj = state.prompts.find(p => p.id === id);
    if (promptObj) openModal('prompt', promptObj);
};

window.editAnotacao = (id) => {
    const nota = state.anotacoes.find(a => a.id === id);
    if (nota) openModal('anotacao', nota);
};

// ===================== VER PROMPT =====================
window.viewPrompt = (id) => {
    const promptObj = state.prompts.find(p => p.id === id);
    if (!promptObj) return;

    document.getElementById('view-title').innerText = promptObj.titulo;
    document.getElementById('view-category').innerText = promptObj.categoria || 'GERAL';
    document.getElementById('view-description').innerText = promptObj.descricao || '';
    document.getElementById('view-content').innerText = promptObj.prompt;

    // Reset botão copiar
    const copyBtn = document.getElementById('btn-copy-prompt');
    copyBtn.textContent = 'Copiar Prompt';
    copyBtn.classList.remove('copied');

    const imgContainer = document.getElementById('view-image-container');
    if (promptObj.imagem_url) {
        imgContainer.innerHTML = `<img src="${promptObj.imagem_url}" loading="lazy" alt="${promptObj.titulo}"
            onerror="this.parentElement.innerHTML='<span style=\\'color:var(--text-muted)\\'>Imagem indisponível</span>'">`;
        imgContainer.classList.remove('hidden');
    } else {
        imgContainer.classList.add('hidden');
    }

    elements.modalViewPrompt.classList.add('active');
};
