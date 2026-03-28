import { 
    buscarPrompts, criarPrompt, editarPrompt, deletarPrompt, 
    buscarAnotacoes, criarAnotacao, editarAnotacao, deletarAnotacao 
} from './supabase.js';

// --- ESTADO DA APLICAÇÃO ---
let state = {
    prompts: [],
    anotacoes: [],
    activeTab: 'prompts',
    promptFilter: 'TODOS',
    anotacaoFilter: 'Todos',
    categories: ['TODOS', 'ARTE', 'FOTOGRAFIA', 'ESCRITA', 'CÓDIGO', 'MARKETING', 'NEGÓCIOS', 'EDUCAÇÃO'],
    tags: ['Todos', 'Ângulos', 'Iluminação', 'Composição', 'Dicas', 'Estilos', 'Câmera', 'links']
};

// --- SELETORES DOM ---
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
    // Modais
    modalPrompt: document.getElementById('modal-prompt'),
    modalAnotacao: document.getElementById('modal-anotacao'),
    modalViewPrompt: document.getElementById('modal-view-prompt'),
    // Botões de Abrir Modal
    btnNewPrompt: document.getElementById('btn-new-prompt'),
    btnNewAnotacao: document.getElementById('btn-new-anotacao')
};

// --- INICIALIZAÇÃO ---
window.addEventListener('DOMContentLoaded', async () => {
    setupEventListeners();
    await fetchData();
    renderAll();
});

async function fetchData() {
    try {
        state.prompts = await buscarPrompts();
        state.anotacoes = await buscarAnotacoes();
        
        // Extrair categorias/tags customizadas existentes nos dados
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
    }
}

// --- RENDERIZAÇÃO ---
function renderAll() {
    renderFilters();
    renderPromptsGrid();
    renderAnotacoesGrid();
    updateCounters();
}

function renderFilters() {
    // Filtros de Prompts
    elements.promptFilters.innerHTML = state.categories.map(cat => `
        <button class="filter-tag ${state.promptFilter === cat ? 'active' : ''}" 
                onclick="window.setPromptFilter('${cat}')">
            ${cat}
        </button>
    `).join('');

    // Filtros de Anotações
    elements.anotacaoFilters.innerHTML = state.tags.map(tag => `
        <button class="filter-tag ${state.anotacaoFilter === tag ? 'active' : ''}" 
                onclick="window.setAnotacaoFilter('${tag}')">
            ${tag}
        </button>
    `).join('');
}

function renderPromptsGrid() {
    const filtered = state.promptFilter === 'TODOS' 
        ? state.prompts 
        : state.prompts.filter(p => p.categoria === state.promptFilter);

    elements.promptsGrid.innerHTML = filtered.map(prompt => `
        <div class="card" id="card-${prompt.id}" onclick="window.copyPrompt('${prompt.id}')">
            <div class="card-image">
                ${prompt.imagem_url 
                    ? `<img src="${prompt.imagem_url}" onerror="this.src=''; this.parentElement.innerHTML='<span class=\'card-fallback\'>Sem Imagem</span>'">` 
                    : '<span class="card-fallback">Sem Imagem</span>'}
            </div>
            <div class="card-content">
                <span class="card-badge">${prompt.categoria || 'GERAL'}</span>
                <h3 class="card-title">${prompt.titulo}</h3>
                <p class="card-desc">${prompt.descricao || ''}</p>
            </div>
            <div class="card-actions">
                <button class="btn-action" onclick="event.stopPropagation(); window.viewPrompt('${prompt.id}')">👁</button>
                <button class="btn-action" onclick="event.stopPropagation(); window.editPrompt('${prompt.id}')">✎</button>
                <button class="btn-action" onclick="event.stopPropagation(); window.deletePromptHandler('${prompt.id}')">×</button>
            </div>
            <div class="copy-overlay">Copiado!</div>
        </div>
    `).join('');
}

function renderAnotacoesGrid() {
    const filtered = state.anotacaoFilter === 'Todos' 
        ? state.anotacoes 
        : state.anotacoes.filter(a => a.tag === state.anotacaoFilter);

    elements.anotacoesGrid.innerHTML = filtered.map(nota => `
        <div class="card nota-card">
            <div class="card-content">
                <span class="card-badge">${nota.tag || 'Dicas'}</span>
                <h3 class="card-title">${nota.titulo || 'Sem Título'}</h3>
                <div class="card-desc" style="-webkit-line-clamp: 6;">
                    ${formatContent(nota.conteudo)}
                </div>
            </div>
            <div class="card-actions">
                <button class="btn-action" onclick="window.editAnotacao('${nota.id}')">✎</button>
                <button class="btn-action" onclick="window.deleteAnotacaoHandler('${nota.id}')">×</button>
            </div>
        </div>
    `).join('');
}

function updateCounters() {
    elements.promptCounter.innerText = `${state.prompts.length} prompts salvos`;
    elements.anotacaoCounter.innerText = `${state.anotacoes.length} anotações salvas`;
}

// Auxiliar para links clicáveis
function formatContent(text) {
    if (!text) return '';
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.replace(urlRegex, url => `<a href="${url}" target="_blank" onclick="event.stopPropagation()">${url}</a>`);
}

// --- HANDLERS DE FILTRO ---
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

// --- NAVEGAÇÃO ---
function setupEventListeners() {
    elements.navPrompts.addEventListener('click', () => switchTab('prompts'));
    elements.navAnotacoes.addEventListener('click', () => switchTab('anotacoes'));

    // Modais
    elements.btnNewPrompt.addEventListener('click', () => openModal('prompt'));
    elements.btnNewAnotacao.addEventListener('click', () => openModal('anotacao'));

    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', closeModal);
    });

    // Form Submits
    document.getElementById('form-prompt').addEventListener('submit', handlePromptSubmit);
    document.getElementById('form-anotacao').addEventListener('submit', handleAnotacaoSubmit);

    // Adicionar Categorias/Tags Customizadas
    document.getElementById('btn-add-cat').addEventListener('click', () => {
        const newCat = prompt("Digite o nome da nova categoria:");
        if (newCat && !state.categories.includes(newCat.toUpperCase())) {
            state.categories.push(newCat.toUpperCase());
            const select = document.getElementById('p-categoria');
            const option = new Option(newCat.toUpperCase(), newCat.toUpperCase());
            select.add(option);
            select.value = newCat.toUpperCase();
            renderFilters();
        }
    });

    document.getElementById('btn-add-tag').addEventListener('click', () => {
        const newTag = prompt("Digite o nome da nova tag:");
        if (newTag && !state.tags.includes(newTag)) {
            state.tags.push(newTag);
            const select = document.getElementById('a-tag');
            const option = new Option(newTag, newTag);
            select.add(option);
            select.value = newTag;
            renderFilters();
        }
    });
    
    // Botão Copiar
    document.getElementById('btn-copy-prompt').addEventListener('click', () => {
        const content = document.getElementById('view-content').innerText;
        navigator.clipboard.writeText(content);
        const btn = document.getElementById('btn-copy-prompt');
        const originalText = btn.innerText;
        btn.innerText = 'Copiado!';
        setTimeout(() => btn.innerText = originalText, 2000);
    });
}

function switchTab(tab) {
    state.activeTab = tab;
    elements.navPrompts.classList.toggle('active', tab === 'prompts');
    elements.navAnotacoes.classList.toggle('active', tab === 'anotacoes');
    elements.sectionPrompts.classList.toggle('hidden', tab !== 'prompts');
    elements.sectionAnotacoes.classList.toggle('hidden', tab !== 'anotacoes');
}

// --- MODAIS ---
function openModal(type, data = null) {
    if (type === 'prompt') {
        const form = document.getElementById('form-prompt');
        form.reset();
        document.getElementById('prompt-id').value = data ? data.id : '';
        document.getElementById('prompt-modal-title').innerText = data ? 'Editar Prompt' : 'Novo Prompt';
        if (data) {
            document.getElementById('p-titulo').value = data.titulo;
            document.getElementById('p-descricao').value = data.descricao || '';
            document.getElementById('p-prompt').value = data.prompt;
            document.getElementById('p-categoria').value = data.categoria || 'ARTE';
            document.getElementById('p-imagem-url').value = data.imagem_url || '';
            form.querySelector('button[type="submit"]').innerText = 'Salvar Alterações';
        } else {
            form.querySelector('button[type="submit"]').innerText = 'Criar Prompt';
        }
        elements.modalPrompt.classList.add('active');
    } else if (type === 'anotacao') {
        const form = document.getElementById('form-anotacao');
        form.reset();
        document.getElementById('anotacao-id').value = data ? data.id : '';
        document.getElementById('anotacao-modal-title').innerText = data ? 'Editar Anotação' : 'Nova Anotação';
        if (data) {
            document.getElementById('a-titulo').value = data.titulo || '';
            document.getElementById('a-tag').value = data.tag || 'Dicas';
            document.getElementById('a-conteudo').value = data.conteudo || '';
            form.querySelector('button[type="submit"]').innerText = 'Salvar Alterações';
        } else {
            form.querySelector('button[type="submit"]').innerText = 'Criar';
        }
        elements.modalAnotacao.classList.add('active');
    }
}

function closeModal() {
    elements.modalPrompt.classList.remove('active');
    elements.modalAnotacao.classList.remove('active');
    elements.modalViewPrompt.classList.remove('active');
}

// --- CRUD HANDLERS ---
async function handlePromptSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('prompt-id').value;
    const dados = {
        titulo: document.getElementById('p-titulo').value,
        descricao: document.getElementById('p-descricao').value,
        prompt: document.getElementById('p-prompt').value,
        categoria: document.getElementById('p-categoria').value,
        imagem_url: document.getElementById('p-imagem-url').value
    };

    try {
        if (id) {
            await editarPrompt(id, dados);
        } else {
            await criarPrompt(dados);
        }
        closeModal();
        await fetchData();
        renderAll();
    } catch (err) {
        alert("Erro ao salvar prompt: " + err.message);
    }
}

async function handleAnotacaoSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('anotacao-id').value;
    const dados = {
        titulo: document.getElementById('a-titulo').value,
        tag: document.getElementById('a-tag').value,
        conteudo: document.getElementById('a-conteudo').value
    };

    try {
        if (id) {
            await editarAnotacao(id, dados);
        } else {
            await criarAnotacao(dados);
        }
        closeModal();
        await fetchData();
        renderAll();
    } catch (err) {
        alert("Erro ao salvar anotação: " + err.message);
    }
}

window.copyPrompt = async (id) => {
    const promptObj = state.prompts.find(p => p.id === id);
    if (promptObj) {
        try {
            await navigator.clipboard.writeText(promptObj.prompt);
            const card = document.getElementById(`card-${id}`);
            if (card) {
                card.classList.add('copied');
                setTimeout(() => card.classList.remove('copied'), 1500);
            }
        } catch (err) {
            console.error("Erro ao copiar:", err);
        }
    }
};

window.deletePromptHandler = async (id) => {
    if (confirm("Deseja realmente excluir este prompt?")) {
        try {
            await deletarPrompt(id);
            await fetchData();
            renderAll();
        } catch (err) {
            alert("Erro ao deletar: " + err.message);
        }
    }
};

window.deleteAnotacaoHandler = async (id) => {
    if (confirm("Deseja realmente excluir esta anotação?")) {
        try {
            await deletarAnotacao(id);
            await fetchData();
            renderAll();
        } catch (err) {
            alert("Erro ao deletar: " + err.message);
        }
    }
};

window.editPrompt = (id) => {
    const prompt = state.prompts.find(p => p.id === id);
    if (prompt) openModal('prompt', prompt);
};

window.editAnotacao = (id) => {
    const nota = state.anotacoes.find(a => a.id === id);
    if (nota) openModal('anotacao', nota);
};

window.viewPrompt = (id) => {
    const prompt = state.prompts.find(p => p.id === id);
    if (!prompt) return;

    document.getElementById('view-title').innerText = prompt.titulo;
    document.getElementById('view-category').innerText = prompt.categoria;
    document.getElementById('view-description').innerText = prompt.descricao;
    document.getElementById('view-content').innerText = prompt.prompt;
    
    const imgContainer = document.getElementById('view-image-container');
    if (prompt.imagem_url) {
        imgContainer.innerHTML = `<img src="${prompt.imagem_url}" onerror="this.src=''; this.parentElement.innerHTML='<span class=\'card-fallback\'>Sem Imagem</span>'">`;
        imgContainer.classList.remove('hidden');
    } else {
        imgContainer.classList.add('hidden');
    }

    elements.modalViewPrompt.classList.add('active');
};
