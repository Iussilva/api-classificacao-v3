-- Banco da aplicacao Ourobras Classificacao
-- Execute este script no MySQL/MariaDB separado da aplicacao.
-- Nao execute no banco Firebird do ERP.

CREATE DATABASE IF NOT EXISTS ourobras_app
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE ourobras_app;

CREATE TABLE IF NOT EXISTS usuarios (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  usuario VARCHAR(80) NOT NULL,
  nome VARCHAR(120) NULL,
  senha_hash VARCHAR(255) NOT NULL,
  perfil VARCHAR(40) NOT NULL DEFAULT 'usuario',
  ativo CHAR(1) NOT NULL DEFAULT 'S',
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  ultimo_login_em TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_usuarios_usuario (usuario)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS usuarios_permissoes (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  usuario_id INT UNSIGNED NOT NULL,
  permissao VARCHAR(40) NOT NULL,
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_usuario_permissao (usuario_id, permissao),
  CONSTRAINT fk_usuarios_permissoes_usuario
    FOREIGN KEY (usuario_id)
    REFERENCES usuarios (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS logs_acesso (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  usuario_id INT UNSIGNED NULL,
  usuario VARCHAR(80) NULL,
  evento VARCHAR(60) NOT NULL,
  ip VARCHAR(80) NULL,
  user_agent VARCHAR(255) NULL,
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_logs_acesso_criado_em (criado_em),
  KEY idx_logs_acesso_usuario (usuario_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Permissoes validas pela aplicacao:
-- admin, estoque, vendas, auditoria, consultas_erp, marketing
