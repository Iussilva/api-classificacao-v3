var OpenAI = require('openai');

var openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
  baseURL: 'https://api.groq.com/openai/v1',
});

// Contexto base do sistema — enviado em todas as conversas
var SYSTEM_PROMPT = [
  'Você é um assistente de inteligência de negócios da Ourobras Joias.',
  'Tem acesso a dados de estoque da vitrine (tipo 2) dos fabricantes:',
  '  • ELLOS GOLD INDUSTRIA E COMERCIO LTDA',
  '  • SG METAIS LTDA',
  '  • MANTOVANI JOIAS LTDA.',
  'Os valores de estoque são em GRAMAS (g).',
  'Responda sempre em português brasileiro, de forma objetiva e profissional.',
  'Quando analisar dados, destaque insights importantes como:',
  '  - Fabricante/loja com maior ou menor estoque',
  '  - Produtos com estoque baixo',
  '  - Distribuição por família de produto',
  '  - Tendências ou anomalias nos dados',
  'Seja direto e use bullet points quando listar informações.',
].join('\n');

/**
 * Chama a API OpenAI com histórico de mensagens.
 * @param {Array} messages - Array de { role, content }
 * @param {number} maxTokens - Limite de tokens na resposta
 */
async function chamarOpenAI(messages, maxTokens) {
  // Verifica se a chave foi configurada
  var key = process.env.OPENAI_API_KEY || '';
  if (!key || key === 'sk-coloque-sua-chave-aqui' || key.length < 20) {
    throw new Error('OPENAI_KEY_MISSING');
  }
  maxTokens = maxTokens || 800;
  var response = await openai.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [{ role: 'system', content: SYSTEM_PROMPT }].concat(messages),
    max_tokens: maxTokens,
    temperature: 0.7,
  });
  return response.choices[0].message.content;
}

module.exports = {
  chamarOpenAI: chamarOpenAI
};
