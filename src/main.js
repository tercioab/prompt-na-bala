import { 
    buscarPrompts, criarPrompt, editarPrompt, deletarPrompt, 
    buscarAnotacoes, criarAnotacao, editarAnotacao, deletarAnotacao,
    uploadImagem, loginUsuario, cadastrarUsuario, logoutUsuario, 
    reenviarConfirmacao, supabase, vincularDadosLegados
} from './supabase.js';

// ===================== ESTADO =====================
let state = {
    user: null,
    session: null,
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
    // Screens
    appLoader: document.getElementById('app-loader'),
    authScreen: document.getElementById('auth-screen'),
    pendingScreen: document.getElementById('pending-screen'),
    appInterface: document.getElementById('app-interface'),
    
    // Auth Login
    formLogin: document.getElementById('form-login'),
    btnLoginSubmit: document.getElementById('btn-login-submit'),
    lEmail: document.getElementById('l-email'),
    lPass: document.getElementById('l-password'),
    lError: document.getElementById('l-error'),
    
    // Auth Signup
    formSignup: document.getElementById('form-signup'),
    btnSignupSubmit: document.getElementById('btn-signup-submit'),
    sNome: document.getElementById('s-nome'),
    sEmail: document.getElementById('s-email'),
    sPass: document.getElementById('s-password'),
    sConfirm: document.getElementById('s-confirm'),
    
    // User Menu
    userAvatar: document.getElementById('user-avatar'),
    userInitial: document.getElementById('user-initial'),
    userDropdown: document.getElementById('user-dropdown'),
    dropdownName: document.getElementById('dropdown-user-name'),
    dropdownEmail: document.getElementById('dropdown-user-email'),
    btnLogout: document.getElementById('btn-logout'),

    // Navigation & Content
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
    
    // Modals
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
    await initAuth();
});

async function initAuth() {
    // Escutar mudanças de estado de auth
    supabase.auth.onAuthStateChange(async (event, session) => {
        state.session = session;
        state.user = session?.user || null;
        
        console.log("Auth Event:", event, state.user?.email);

        if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
            if (state.user) {
                // Tenta vincular dados de forma não-bloqueante
                vincularDadosLegados();
                
                // Verificar se o email foi confirmado
                if (state.user.identities && state.user.id && !state.user.email_confirmed_at) {
                   showScreen('pending');
                } else {
                    showScreen('app');
                    refreshAppData(); // Carrega dados em segundo plano
                }
            } else {
                showScreen('auth');
            }
        } else if (event === 'SIGNED_OUT') {
            showScreen('auth');
            resetAppState();
        }
    });

    // Verificação inicial forçada caso onAuthStateChange demore
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        state.session = session;
        state.user = session.user;
        if (!state.user.email_confirmed_at) {
            showScreen('pending');
        } else {
            showScreen('app');
            refreshAppData();
        }
    } else {
        showScreen('auth');
    }
}

function showScreen(screen) {
    elements.appLoader.classList.add('hidden');
    elements.authScreen.classList.toggle('hidden', screen !== 'auth');
    elements.pendingScreen.classList.toggle('hidden', screen !== 'pending');
    elements.appInterface.classList.toggle('hidden', screen !== 'app');
    
    if (screen === 'pending') {
        document.getElementById('pending-user-email').textContent = state.user?.email || '';
    }
    
    if (screen === 'app' && state.user) {
        const name = state.user.user_metadata?.nome || state.user.email.split('@')[0];
        elements.userInitial.textContent = name.charAt(0).toUpperCase();
        elements.dropdownName.textContent = name;
        elements.dropdownEmail.textContent = state.user.email;
    }
}

async function refreshAppData() {
    renderSkeletons(elements.promptsGrid, 8);
    renderSkeletons(elements.anotacoesGrid, 6);
    await fetchData();
    renderAll();
}

function resetAppState() {
    state.prompts = [];
    state.anotacoes = [];
    renderAll();
}

async function fetchData() {
    try {
        console.log("Iniciando busca de dados...");
        const [prompts, anotacoes] = await Promise.allSettled([
            buscarPrompts(),
            buscarAnotacoes()
        ]);
        
        state.prompts = prompts.status === 'fulfilled' ? prompts.value : [];
        state.anotacoes = anotacoes.status === 'fulfilled' ? anotacoes.value : [];

        if (prompts.status === 'rejected') console.error("Falha ao carregar prompts:", prompts.reason);
        if (anotacoes.status === 'rejected') console.error("Falha ao carregar anotações:", anotacoes.reason);
        
        // Atualizar categorias e tags dinâmicas baseadas nos dados do usuário
        const allPrompts = state.prompts || [];
        const customCats = allPrompts
            .map(p => p.categoria)
            .filter(c => c && !['TODOS', 'ARTE', 'FOTOGRAFIA', 'ESCRITA', 'CÓDIGO', 'MARKETING', 'NEGÓCIOS', 'EDUCAÇÃO'].includes(c));
        
        state.categories = [...new Set(['TODOS', 'ARTE', 'FOTOGRAFIA', 'ESCRITA', 'CÓDIGO', 'MARKETING', 'NEGÓCIOS', 'EDUCAÇÃO', ...customCats])];

        const allNotes = state.anotacoes || [];
        const customTags = allNotes
            .map(a => a.tag)
            .filter(t => t && !['Todos', 'Ângulos', 'Iluminação', 'Composição', 'Dicas', 'Estilos', 'Câmera', 'links'].includes(t));
        
        state.tags = [...new Set(['Todos', 'Ângulos', 'Iluminação', 'Composição', 'Dicas', 'Estilos', 'Câmera', 'links', ...customTags])];
        
        console.log(`Dados carregados: ${allPrompts.length} prompts, ${allNotes.length} anotações.`);
    } catch (error) {
        console.error("Erro crítico em fetchData:", error);
        showToast('Erro ao sincronizar dados. Verifique sua conexão.', 'error');
    }
}

// ===================== TOAST SYSTEM =====================
function showToast(message, type = 'success') {
    const icons = { success: 'check-circle', error: 'alert-circle', info: 'info' };
    const colors = {
        success: 'border-green-500 text-green-400',
        error: 'border-red-500 text-red-400',
        info: 'border-blue-500 text-blue-400'
    };
    
    const toast = document.createElement('div');
    toast.className = `glass-panel rounded-2xl px-6 py-4 shadow-2xl flex items-center gap-4 border-l-4 ${colors[type]} animate-fade-slide`;
    toast.innerHTML = `
        <i data-lucide="${icons[type]}" class="w-5 h-5"></i>
        <span class="text-sm font-bold font-manrope tracking-tight">${message}</span>
    `;
    elements.toastContainer.appendChild(toast);
    lucide.createIcons({ props: { "stroke-width": 3 }, nameAttr: 'data-lucide', root: toast });

    const remove = () => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(20px)';
        setTimeout(() => toast.remove(), 300);
    };
    setTimeout(remove, 4000);
}

// ===================== AUTH HANDLERS =====================
async function handleLogin(e) {
    e.preventDefault();
    const email = elements.lEmail.value;
    const password = elements.lPass.value;
    
    elements.lError.classList.add('hidden');
    setSubmitLoading('btn-login-submit', true, 'Entrando...');

    try {
        const data = await loginUsuario(email, password);
        if (data.user && !data.user.email_confirmed_at) {
            showScreen('pending');
        }
    } catch (err) {
        let msg = 'Credenciais inválidas ou erro de conexão.';
        if (err.status === 429) msg = 'Muitas tentativas. Aguarde um momento.';
        if (err.message?.includes('Email not confirmed')) msg = 'Confirme seu email para entrar.';
        
        elements.lError.textContent = msg;
        elements.lError.classList.remove('hidden');
        showToast('Falha no login', 'error');
    } finally {
        setSubmitLoading('btn-login-submit', false);
    }
}

async function handleSignup(e) {
    e.preventDefault();
    const nome = elements.sNome.value.trim();
    const email = elements.sEmail.value.trim();
    const password = elements.sPass.value;
    const confirm = elements.sConfirm.value;
    const generalError = document.getElementById('s-error-general');

    let hasError = false;
    
    // Limpar erros
    document.querySelectorAll('.form-error').forEach(p => p.classList.add('hidden'));

    if (!nome) { showError('s-error-nome', 'Nome é obrigatório'); hasError = true; }
    if (password.length < 6) { showError('s-error-password', 'Mínimo 6 caracteres'); hasError = true; }
    if (password !== confirm) { showError('s-error-confirm', 'As senhas não coincidem'); hasError = true; }

    if (hasError) return;

    setSubmitLoading('btn-signup-submit', true, 'Criando conta...');

    try {
        await cadastrarUsuario(email, password, { nome });
        showScreen('pending');
        showToast('Conta criada com sucesso!', 'success');
    } catch (err) {
        console.error("Erro no cadastro:", err);
        let msg = err.message || 'Erro ao criar conta.';
        if (err.status === 429 || err.message?.includes('rate limit')) {
            msg = 'Limite de e-mails excedido no Supabase. Aguarde alguns minutos.';
        }
        
        if (generalError) {
            generalError.textContent = msg;
            generalError.classList.remove('hidden');
        }
        showToast('Erro no cadastro', 'error');
    } finally {
        setSubmitLoading('btn-signup-submit', false);
    }
}

function showError(id, msg) {
    const el = document.getElementById(id);
    el.textContent = msg;
    el.classList.remove('hidden');
}

function toggleAuthMode(to) {
    document.getElementById('auth-login').classList.toggle('hidden', to !== 'login');
    document.getElementById('auth-signup').classList.toggle('hidden', to !== 'signup');
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
        el.className = 'glass-panel rounded-3xl p-6 aspect-[4/5] overflow-hidden';
        el.innerHTML = `
            <div class="skeleton-shimmer h-full flex flex-col gap-4">
                <div class="h-1/2 bg-white/5 rounded-2xl"></div>
                <div class="space-y-3 p-2">
                    <div class="h-4 bg-white/10 rounded w-1/4"></div>
                    <div class="h-6 bg-white/10 rounded w-3/4"></div>
                    <div class="h-4 bg-white/10 rounded w-full"></div>
                </div>
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
    // Re-initialize Lucide icons for all newly added elements
    lucide.createIcons();
}

function renderFilters() {
    const filterBtnClass = (active) => `
        px-6 py-2.5 rounded-full text-xs font-bold font-manrope tracking-widest transition-all duration-300 whitespace-nowrap border
        ${active 
            ? 'bg-primary border-primary text-white shadow-[0_0_20px_rgba(239,35,60,0.4)]' 
            : 'bg-white/5 border-white/5 text-gray-400 hover:bg-white/10 hover:border-white/20'}
    `;

    const noteFilterBtnClass = (active) => `
        px-6 py-2.5 rounded-full text-xs font-bold font-manrope tracking-widest transition-all duration-300 whitespace-nowrap border
        ${active 
            ? 'bg-secondary border-secondary text-white shadow-[0_0_20px_rgba(234,88,12,0.4)]' 
            : 'bg-white/5 border-white/5 text-gray-400 hover:bg-white/10 hover:border-white/10'}
    `;

    elements.promptFilters.innerHTML = state.categories.map(cat => `
        <button class="${filterBtnClass(state.promptFilter === cat)}" 
                onclick="window.setPromptFilter('${cat}')">
            ${cat}
        </button>
    `).join('');

    elements.anotacaoFilters.innerHTML = state.tags.map(tag => `
        <button class="${noteFilterBtnClass(state.anotacaoFilter === tag)}" 
                onclick="window.setAnotacaoFilter('${tag}')">
            ${tag.toUpperCase()}
        </button>
    `).join('');
}

function buildPromptCard(prompt, animate = false) {
    const div = document.createElement('div');
    div.className = `glow-card glass-panel rounded-[2.5rem] overflow-hidden group/card relative flex flex-col ${animate ? 'animate-fade-slide' : ''}`;
    div.id = `card-${prompt.id}`;

    const imgHtml = prompt.imagem_url
        ? `<img src="${prompt.imagem_url}" loading="lazy" 
              class="w-full h-full object-cover transition-transform duration-700 group-hover/card:scale-110 opacity-60 group-hover/card:opacity-100" 
              alt="${prompt.titulo}">`
        : `<div class="w-full h-full flex items-center justify-center bg-white/5 text-gray-700 font-bold uppercase tracking-widest text-xs">Sem Imagem</div>`;

    div.innerHTML = `
        <div class="relative h-64 overflow-hidden border-b border-white/5">
            ${imgHtml}
            <div class="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-transparent to-transparent opacity-60"></div>
            <div class="absolute top-6 left-6">
                <span class="px-3 py-1 bg-primary/20 backdrop-blur-md border border-primary/30 rounded-lg text-[10px] font-bold text-primary tracking-widest uppercase">
                    ${prompt.categoria || 'GERAL'}
                </span>
            </div>
            <div class="absolute top-6 right-6 flex flex-col gap-2 translate-x-12 opacity-0 group-hover/card:translate-x-0 group-hover/card:opacity-100 transition-all duration-500">
                <button onclick="event.stopPropagation(); window.viewPrompt('${prompt.id}')" class="w-10 h-10 bg-white/10 backdrop-blur-md border border-white/20 rounded-full flex items-center justify-center text-white hover:bg-primary hover:border-primary transition-all shadow-xl">
                    <i data-lucide="eye" class="w-4 h-4"></i>
                </button>
                <button onclick="event.stopPropagation(); window.editPrompt('${prompt.id}')" class="w-10 h-10 bg-white/10 backdrop-blur-md border border-white/20 rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-all shadow-xl">
                    <i data-lucide="edit-3" class="w-4 h-4"></i>
                </button>
                <button onclick="event.stopPropagation(); window.deletePromptHandler('${prompt.id}')" class="w-10 h-10 bg-white/10 backdrop-blur-md border border-white/20 rounded-full flex items-center justify-center text-red-400 hover:bg-red-500 hover:text-white transition-all shadow-xl">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
            </div>
        </div>
        
        <div class="p-8 flex flex-col flex-1 cursor-pointer" onclick="window.copyPrompt('${prompt.id}')">
            <h3 class="text-xl font-manrope font-extrabold tracking-tight text-white mb-2 group-hover/card:text-primary transition-colors">${prompt.titulo}</h3>
            <p class="text-gray-500 text-sm line-clamp-2 leading-relaxed mb-6 flex-1">${prompt.descricao || ''}</p>
            
            <div class="flex items-center justify-between pt-4 border-t border-white/5">
                <span class="text-[10px] font-mono text-gray-600 uppercase tracking-widest">Clique para copiar</span>
                <i data-lucide="copy" class="w-4 h-4 text-gray-600 group-hover/card:text-primary transition-colors"></i>
            </div>
        </div>
        
        <div id="copy-overlay-${prompt.id}" class="absolute inset-0 bg-primary/90 backdrop-blur-sm flex flex-col items-center justify-center opacity-0 pointer-events-none transition-all duration-300 z-20">
            <div class="w-16 h-16 bg-white rounded-full flex items-center justify-center mb-4 shadow-2xl">
                <i data-lucide="check" class="w-8 h-8 text-primary"></i>
            </div>
            <span class="text-white font-manrope font-black text-2xl tracking-tighter">COPIADO!</span>
        </div>
    `;
    return div;
}

function buildNotaCard(nota, animate = false) {
    const div = document.createElement('div');
    div.className = `glow-card glass-panel rounded-[2rem] p-8 relative flex flex-col group/nota ${animate ? 'animate-fade-slide' : ''}`;
    div.id = `card-nota-${nota.id}`;

    div.innerHTML = `
        <div class="flex items-center justify-between mb-6">
            <span class="px-3 py-1 bg-secondary/10 border border-secondary/20 rounded-lg text-[10px] font-bold text-secondary tracking-widest uppercase">
                ${nota.tag || 'DICAS'}
            </span>
            <div class="flex gap-2 opacity-0 group-hover/nota:opacity-100 transition-opacity">
                <button onclick="event.stopPropagation(); window.editAnotacao('${nota.id}')" class="text-gray-500 hover:text-white transition-colors">
                    <i data-lucide="edit-3" class="w-4 h-4"></i>
                </button>
                <button onclick="event.stopPropagation(); window.deleteAnotacaoHandler('${nota.id}')" class="text-gray-500 hover:text-red-400 transition-colors">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
            </div>
        </div>
        
        <h3 class="text-lg font-manrope font-extrabold text-white mb-4 tracking-tight group-hover/nota:text-secondary transition-colors underline decoration-secondary/30 decoration-2 underline-offset-4">
            ${nota.titulo || 'Sem Título'}
        </h3>
        
        <div class="text-gray-400 text-sm leading-relaxed overflow-hidden flex-1" style="display: -webkit-box; -webkit-line-clamp: 6; -webkit-box-orient: vertical;">
            ${formatContent(nota.conteudo)}
        </div>
        
        <div class="mt-6 pt-4 border-t border-white/5 flex items-center justify-between text-[10px] font-mono text-gray-600 uppercase tracking-widest">
            <span>Nota rápida</span>
            <i data-lucide="file-text" class="w-3 h-3"></i>
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
    // Auth Mode Toggles
    document.getElementById('go-to-signup').addEventListener('click', (e) => { e.preventDefault(); toggleAuthMode('signup'); });
    document.getElementById('go-to-login').addEventListener('click', (e) => { e.preventDefault(); toggleAuthMode('login'); });
    document.getElementById('resend-back-to-login').addEventListener('click', (e) => { e.preventDefault(); showScreen('auth'); });

    // Auth Submits
    elements.formLogin.addEventListener('submit', handleLogin);
    elements.formSignup.addEventListener('submit', handleSignup);
    elements.btnLogout.addEventListener('click', logoutUsuario);

    // Toggle Pass Visibility
    document.querySelectorAll('.btn-toggle-pass').forEach(btn => {
        btn.addEventListener('click', () => {
            const input = btn.parentElement.querySelector('input');
            const icon = btn.querySelector('i');
            const type = input.type === 'password' ? 'text' : 'password';
            input.type = type;
            icon.setAttribute('data-lucide', type === 'password' ? 'eye' : 'eye-off');
            lucide.createIcons({ nameAttr: 'data-lucide', root: btn });
        });
    });

    // Resend Email
    document.getElementById('btn-resend-email').addEventListener('click', async () => {
        const btn = document.getElementById('btn-resend-email');
        try {
            await reenviarConfirmacao(state.user.email);
            showToast('Email reenviado!', 'info');
            btn.disabled = true;
            let count = 60;
            const timer = setInterval(() => {
                count--;
                btn.textContent = `Aguarde ${count}s...`;
                if (count <= 0) {
                    clearInterval(timer);
                    btn.disabled = false;
                    btn.textContent = 'Reenviar email';
                }
            }, 1000);
        } catch (err) {
            showToast('Erro ao reenviar email', 'error');
        }
    });

    // Avatar Dropdown
    elements.userAvatar.addEventListener('click', (e) => {
        e.stopPropagation();
        elements.userDropdown.classList.toggle('hidden');
    });

    document.addEventListener('click', () => {
        elements.userDropdown.classList.add('hidden');
    });

    // Navigation
    elements.navPrompts.addEventListener('click', () => switchTab('prompts'));
    elements.navAnotacoes.addEventListener('click', () => switchTab('anotacoes'));

    elements.btnNewPrompt.addEventListener('click', () => openModal('prompt'));
    elements.btnNewAnotacao.addEventListener('click', () => openModal('anotacao'));

    // Fechar modal ao clicar no backdrop
    [elements.modalPrompt, elements.modalAnotacao, elements.modalViewPrompt, elements.modalConfirm, elements.modalInput].forEach(modal => {
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

    // CRUD Submits
    document.getElementById('form-prompt').addEventListener('submit', handlePromptSubmit);
    document.getElementById('form-anotacao').addEventListener('submit', handleAnotacaoSubmit);

    // Adicionar Categorias/Tags
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

    // Seleção de arquivo feedback
    const fileInput = document.getElementById('p-imagem-file');
    const fileChosen = document.getElementById('file-chosen');
    if (fileInput) {
        fileInput.addEventListener('change', () => {
            fileChosen.textContent = fileInput.files[0]
                ? `📎 ${fileInput.files[0].name}`
                : 'Nenhum arquivo selecionado';
        });
    }

    // Botão copiar view modal
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
            showToast('Erro ao copiar.', 'error');
        }
    });
}

// ===================== NAVEGAÇÃO =====================
function switchTab(tab) {
    state.activeTab = tab;
    if (elements.navPrompts) elements.navPrompts.classList.toggle('active', tab === 'prompts');
    if (elements.navAnotacoes) elements.navAnotacoes.classList.toggle('active', tab === 'anotacoes');
    if (elements.sectionPrompts) elements.sectionPrompts.classList.toggle('hidden', tab !== 'prompts');
    if (elements.sectionAnotacoes) elements.sectionAnotacoes.classList.toggle('hidden', tab !== 'anotacoes');
    
    // Smooth scroll to top when switching
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ===================== MODAIS =====================
function openModal(type, data = null) {
    if (type === 'prompt') {
        const form = document.getElementById('form-prompt');
        if (form) form.reset();
        hideFormError('prompt-error-msg');
        document.getElementById('prompt-id').value = data ? data.id : '';
        document.getElementById('prompt-modal-title').innerText = data ? 'Editar Prompt' : 'Novo Prompt';
        const submitBtn = document.getElementById('btn-submit-prompt');
        if (submitBtn) {
            const textEl = submitBtn.querySelector('.btn-text');
            if (textEl) textEl.textContent = data ? 'Salvar Alterações' : 'Criar Prompt';
        }

        if (data) {
            if (document.getElementById('p-titulo')) document.getElementById('p-titulo').value = data.titulo || '';
            if (document.getElementById('p-descricao')) document.getElementById('p-descricao').value = data.descricao || '';
            if (document.getElementById('p-prompt')) document.getElementById('p-prompt').value = data.prompt || '';
            if (document.getElementById('p-categoria')) document.getElementById('p-categoria').value = data.categoria || 'ARTE';
            if (document.getElementById('p-imagem-url')) document.getElementById('p-imagem-url').value = data.imagem_url || '';
        }

        if (elements.modalPrompt) {
            elements.modalPrompt.classList.add('active');
            setTimeout(() => {
                const focusEl = document.getElementById('p-titulo');
                if (focusEl) focusEl.focus();
            }, 80);
        }
    }
    else if (type === 'anotacao') {
        const form = document.getElementById('form-anotacao');
        if (form) form.reset();
        hideFormError('anotacao-error-msg');
        document.getElementById('anotacao-id').value = data ? data.id : '';
        document.getElementById('anotacao-modal-title').innerText = data ? 'Editar Anotação' : 'Nova Anotação';
        const submitBtn = document.getElementById('btn-submit-anotacao');
        if (submitBtn) {
            const textEl = submitBtn.querySelector('.btn-text');
            if (textEl) textEl.textContent = data ? 'Salvar Alterações' : 'Salvar Nota';
        }

        if (data) {
            if (document.getElementById('a-titulo')) document.getElementById('a-titulo').value = data.titulo || '';
            if (document.getElementById('a-tag')) document.getElementById('a-tag').value = data.tag || 'Dicas';
            if (document.getElementById('a-conteudo')) document.getElementById('a-conteudo').value = data.conteudo || '';
        }

        if (elements.modalAnotacao) {
            elements.modalAnotacao.classList.add('active');
            setTimeout(() => {
                const focusEl = document.getElementById('a-titulo');
                if (focusEl) focusEl.focus();
            }, 80);
        }
    }
}

function closeModal() {
    const modals = [elements.modalPrompt, elements.modalAnotacao, elements.modalViewPrompt, elements.modalConfirm, elements.modalInput];
    modals.forEach(modal => {
        if (modal.classList.contains('active')) {
            const content = modal.querySelector('.modal-content') || modal.querySelector('.modal-confirm-box');
            if (content) {
                content.classList.add('closing');
                const remove = () => {
                    modal.classList.remove('active');
                    content.classList.remove('closing');
                };
                content.addEventListener('animationend', remove, { once: true });
                setTimeout(remove, 250);
            } else {
                modal.classList.remove('active');
            }
        }
    });

    const fileChosen = document.getElementById('file-chosen');
    if (fileChosen) fileChosen.textContent = 'Nenhum arquivo selecionado';
    const fileInput = document.getElementById('p-imagem-file');
    if (fileInput) fileInput.value = '';
}

// ===================== HELPERS DE FORM =====================
function setSubmitLoading(btnId, loading, loadingText = 'Processando...') {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    const contentEl = btn.querySelector('.btn-content') || btn;
    const spinEl = btn.querySelector('.btn-spinner');
    btn.disabled = loading;
    if (contentEl) {
        if (loading) {
            if (!btn.dataset.originalText) btn.dataset.originalText = contentEl.innerHTML;
            contentEl.innerHTML = `<span>${loadingText}</span>`;
        } else {
            contentEl.innerHTML = btn.dataset.originalText || contentEl.innerHTML;
        }
    }
    if (spinEl) spinEl.classList.toggle('hidden', !loading);
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
            await editarPrompt(id, dados);
            const idx = state.prompts.findIndex(p => p.id === id);
            if (idx !== -1) state.prompts[idx] = { ...state.prompts[idx], ...dados };
            const existingCard = document.getElementById(`card-${id}`);
            if (existingCard) {
                const newCard = buildPromptCard(state.prompts[idx], true);
                existingCard.replaceWith(newCard);
            }
            showToast('Prompt atualizado!', 'success');
        } else {
            const created = await criarPrompt(dados);
            state.prompts.unshift(created);
            if (state.promptFilter === 'TODOS' || state.promptFilter === dados.categoria) {
                const newCard = buildPromptCard(created, true);
                elements.promptsGrid.prepend(newCard);
                const empty = elements.promptsGrid.querySelector('.empty-state');
                if (empty) empty.remove();
            }
            showToast('Prompt criado!', 'success');
        }

        updateCounters();
        renderFilters();
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

// ===================== COMPLEMENTOS CRUD =====================
window.copyPrompt = async (id) => {
    const promptObj = state.prompts.find(p => p.id === id);
    if (promptObj) {
        try {
            await navigator.clipboard.writeText(promptObj.prompt);
            const overlay = document.getElementById(`copy-overlay-${id}`);
            if (overlay) {
                overlay.style.opacity = '1';
                overlay.style.pointerEvents = 'auto';
                setTimeout(() => {
                    overlay.style.opacity = '0';
                    overlay.style.pointerEvents = 'none';
                }, 1600);
            }
            showToast('Copiado para a área de transferência!', 'success');
        } catch {
            showToast('Não foi possível copiar.', 'error');
        }
    }
};

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
        if (elements.promptsGrid.querySelectorAll('.card').length === 0) renderPromptsGrid();
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
        if (elements.anotacoesGrid.querySelectorAll('.card').length === 0) renderAnotacoesGrid();
    } catch (err) {
        showToast('Erro ao excluir anotação.', 'error');
        if (card) card.classList.remove('card-exiting');
    }
};

window.editPrompt = (id) => {
    const promptObj = state.prompts.find(p => p.id === id);
    if (promptObj) openModal('prompt', promptObj);
};

window.editAnotacao = (id) => {
    const nota = state.anotacoes.find(a => a.id === id);
    if (nota) openModal('anotacao', nota);
};

window.viewPrompt = (id) => {
    const promptObj = state.prompts.find(p => p.id === id);
    if (!promptObj) return;

    document.getElementById('view-title').innerText = promptObj.titulo;
    document.getElementById('view-category').innerText = promptObj.categoria || 'GERAL';
    document.getElementById('view-description').innerText = promptObj.descricao || '';
    document.getElementById('view-content').innerText = promptObj.prompt;

    const copyBtn = document.getElementById('btn-copy-prompt');
    copyBtn.innerHTML = 'Copiar Prompt';
    
    const imgContainer = document.getElementById('view-image-container');
    if (promptObj.imagem_url) {
        imgContainer.innerHTML = `<img src="${promptObj.imagem_url}" loading="lazy" class="w-full h-full object-cover" alt="${promptObj.titulo}"
            onerror="this.parentElement.innerHTML='<span class=\\'text-gray-600 font-bold uppercase tracking-widest text-xs\\'>Imagem indisponível</span>'">`;
        imgContainer.classList.remove('hidden');
    } else {
        imgContainer.innerHTML = `<div class="w-full h-full flex flex-col items-center justify-center bg-white/5 text-gray-700 p-12 text-center">
            <i data-lucide="image-off" class="w-12 h-12 mb-4 opacity-20"></i>
            <span class="text-[10px] font-bold uppercase tracking-widest">Sem Imagem de Referência</span>
        </div>`;
        imgContainer.classList.remove('hidden');
        lucide.createIcons({ root: imgContainer });
    }

    elements.modalViewPrompt.classList.add('active');
};
