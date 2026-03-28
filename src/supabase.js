import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// --- AUTH ---
export async function cadastrarUsuario(email, password, metadata = {}) {
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: metadata,
            emailRedirectTo: window.location.origin
        }
    });
    if (error) {
        console.error("Erro no cadastro:", error);
        throw error;
    }
    return data;
}

/**
 * Vincula dados que não têm user_id ao usuário atual (migração legada).
 */
export async function vincularDadosLegados() {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        
        const { error } = await supabase.rpc('vincular_dados_orfaos', { uid: session.user.id });
        if (error) console.error("Erro ao vincular dados legados:", error);
    } catch (err) {
        console.error("Falha na chamada de vinculação:", err);
    }
}

export async function loginUsuario(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });
  if (error) throw error;
  return data;
}

export async function logoutUsuario() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function reenviarConfirmacao(email) {
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email
  });
  if (error) throw error;
}

// --- PROMPTS ---
export async function buscarPrompts() {
    const { data, error } = await supabase
        .from('prompts')
        .select('*')
        .order('created_at', { ascending: false });
    
    if (error) {
        console.error("Erro ao buscar prompts:", error);
        throw error;
    }
    return data || [];
}

export async function criarPrompt(dados) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        console.error("Tentativa de criar prompt sem sessão ativa.");
        throw new Error("Sessão expirada ou não encontrada. Por favor, faça login novamente.");
    }
    
    const { data, error } = await supabase
        .from('prompts')
        .insert([{ ...dados, user_id: session.user.id }])
        .select();
    
    if (error) {
        console.error("Erro ao inserir prompt no Supabase:", error);
        throw error;
    }
    return data && data.length > 0 ? data[0] : null;
}

export async function editarPrompt(id, dados) {
  const { data, error } = await supabase.from('prompts').update(dados).eq('id', id).select();
  if (error) throw error;
  return data[0];
}

export async function deletarPrompt(id) {
  const { error } = await supabase.from('prompts').delete().eq('id', id);
  if (error) throw error;
  return true;
}

// --- ANOTAÇÕES ---
export async function buscarAnotacoes() {
    const { data, error } = await supabase
        .from('anotacoes')
        .select('*')
        .order('created_at', { ascending: false });
    
    if (error) {
        console.error("Erro ao buscar anotações:", error);
        throw error;
    }
    return data || [];
}

export async function criarAnotacao(dados) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Usuário não autenticado.");

    const { data, error } = await supabase
        .from('anotacoes')
        .insert([{ ...dados, user_id: session.user.id }])
        .select();
    
    if (error) {
        console.error("Erro ao inserir anotação no Supabase:", error);
        throw error;
    }
    return data && data.length > 0 ? data[0] : null;
}

export async function editarAnotacao(id, dados) {
  const { data, error } = await supabase.from('anotacoes').update(dados).eq('id', id).select();
  if (error) throw error;
  return data[0];
}

export async function deletarAnotacao(id) {
  const { error } = await supabase.from('anotacoes').delete().eq('id', id);
  if (error) throw error;
  return true;
}

// --- STORAGE ---
export async function uploadImagem(file) {
  const fileExt = file.name.split('.').pop();
  const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
  const filePath = `${fileName}`;

  const { error } = await supabase.storage
    .from('prompts')
    .upload(filePath, file);

  if (error) throw error;

  const { data } = supabase.storage
    .from('prompts')
    .getPublicUrl(filePath);

  return data.publicUrl;
}
