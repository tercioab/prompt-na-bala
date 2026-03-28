import './style.css'
import { supabase } from './supabase'

const statusEl = document.querySelector('#status')

async function testConnection() {
  try {
    const { data, error } = await supabase.from('_test_connection').select('*').limit(1)
    
    // Note: Since this table likely doesn't exist, we'll get an error, 
    // but a 401/404 from Supabase still confirms the client is reaching the API.
    if (error && error.message.includes('FetchError')) {
      throw error
    }

    statusEl.innerHTML = '● Cliente Supabase Inicializado'
    statusEl.style.color = '#4ade80'
    statusEl.style.borderColor = 'rgba(74, 222, 128, 0.2)'
    statusEl.style.background = 'rgba(74, 222, 128, 0.05)'
  } catch (err) {
    console.error('Erro de conexão Supabase:', err)
    statusEl.innerHTML = '● Aguardando Configuração do Supabase'
    statusEl.style.color = '#fbbf24'
    statusEl.style.borderColor = 'rgba(251, 191, 36, 0.2)'
    statusEl.style.background = 'rgba(251, 191, 36, 0.05)'
  }
}

testConnection()
