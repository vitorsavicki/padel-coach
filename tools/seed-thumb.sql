-- Semeia um treino com frame para a conta de teste mais recente.
INSERT INTO videos (user_id, r2_key, titulo, status, quadros)
SELECT id, 'x', 'Treino com frame', 'analisado',
       '["data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q=="]'
FROM users WHERE nome = 'Vitor Thumb' ORDER BY id DESC LIMIT 1;

INSERT INTO analyses (video_id, user_id, nota_geral, resumo, pontos_fortes, pontos_melhorar, treino_sugerido, modelo_usado)
SELECT v.id, v.user_id, 7.5, 'Resumo de teste', '["ponto 1"]', '["ajuste 1"]', 'treino', 'teste'
FROM videos v JOIN users u ON u.id = v.user_id
WHERE u.nome = 'Vitor Thumb' ORDER BY v.id DESC LIMIT 1;
