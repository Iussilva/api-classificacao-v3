document.addEventListener('DOMContentLoaded', function () {
  document.getElementById('senha').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') entrar();
  });
  document.getElementById('btnEntrar').addEventListener('click', entrar);
});

fetch('/api/auth/session', { credentials: 'same-origin' }).then(function (r) {
  if (r.ok) window.location.href = '/index.html';
}).catch(function () {});

async function entrar() {
  var usuario = document.getElementById('usuario').value.trim();
  var senha = document.getElementById('senha').value;
  var btn = document.getElementById('btnEntrar');
  var erro = document.getElementById('erroMsg');

  if (!usuario || !senha) {
    mostrarErro('Preencha usuário e senha.');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Entrando...';
  erro.style.display = 'none';

  try {
    var resp = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ usuario: usuario, senha: senha })
    });
    var data = await resp.json();

    if (!resp.ok) {
      mostrarErro(data.erro || 'Credenciais inválidas.');
      return;
    }

    window.location.href = '/index.html';
  } catch (e) {
    mostrarErro('Erro de conexão com o servidor.');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Entrar';
  }
}

function mostrarErro(msg) {
  var el = document.getElementById('erroMsg');
  el.textContent = msg;
  el.style.display = 'block';
}
