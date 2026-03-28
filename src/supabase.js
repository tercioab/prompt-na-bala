import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// --- PROMPTS ---
export async function buscarPrompts(categoria = 'TODOS') {
  let query = supabase.from('prompts').select('*').order('created_at', { ascending: false });
  if (categoria !== 'TODOS') {
    query = query.eq('categoria', categoria);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function criarPrompt(dados) {
  const { data, error } = await supabase.from('prompts').insert([dados]).select();
  if (error) throw error;
  return data[0];
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
export async function buscarAnotacoes(tag = 'Todos') {
  let query = supabase.from('anotacoes').select('*').order('created_at', { ascending: false });
  if (tag !== 'Todos') {
    query = query.eq('tag', tag);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function criarAnotacao(dados) {
  const { data, error } = await supabase.from('anotacoes').insert([dados]).select();
  if (error) throw error;
  return data[0];
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
