<?php
header('Content-Type: application/json; charset=utf-8');
date_default_timezone_set('America/Sao_Paulo');

function responderJson($dados, $status = 200)
{
    http_response_code($status);
    echo json_encode($dados, JSON_UNESCAPED_UNICODE);
    exit;
}

try {
    $caminhoDb = 'sqlite:' . __DIR__ . DIRECTORY_SEPARATOR . 'bd.db';
    $db = new PDO($caminhoDb);
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $db->exec("CREATE TABLE IF NOT EXISTS dias (
        dat TEXT PRIMARY KEY,
        meta INTEGER NOT NULL,
        consumido INTEGER NOT NULL,
        meta_batida INTEGER NOT NULL DEFAULT 0
    )");
    $colunas = $db->query("PRAGMA table_info(dias)")->fetchAll(PDO::FETCH_COLUMN, 1);
    if (!in_array('meta_batida', $colunas, true)) {
        $db->exec("ALTER TABLE dias ADD COLUMN meta_batida INTEGER NOT NULL DEFAULT 0");
        $db->exec("UPDATE dias SET meta_batida = (consumido >= meta)");
    }

    $acao = $_GET['acao'] ?? '';
    $hoje = date('Y-m-d');

    if ($acao === 'carregar_hoje') {
        $stmt = $db->prepare("INSERT OR IGNORE INTO dias (dat, meta, consumido) VALUES (?, 2500, 0)");
        $stmt->execute([$hoje]);

        $stmt = $db->prepare("SELECT meta, consumido FROM dias WHERE dat = ?");
        $stmt->execute([$hoje]);
        $dia = $stmt->fetch(PDO::FETCH_ASSOC);

        responderJson([
            'data' => $hoje,
            'meta' => (int)$dia['meta'],
            'consumo' => (int)$dia['consumido']
        ]);
    }

    if ($acao === 'salvar_meta') {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            responderJson(['erro' => 'Use o método POST para salvar a meta.'], 405);
        }

        $entradaMeta = $_POST['meta'] ?? null;
        $meta = is_scalar($entradaMeta) ? filter_var($entradaMeta, FILTER_VALIDATE_INT) : false;
        if ($meta === false || $meta === null || $meta <= 0) {
            responderJson(['erro' => 'Informe uma meta inteira maior que zero.'], 400);
        }

        $stmt = $db->prepare("INSERT INTO dias (dat, meta, consumido, meta_batida) VALUES (?, ?, 0, 0)
            ON CONFLICT(dat) DO UPDATE SET
                meta = excluded.meta,
                meta_batida = (dias.consumido >= excluded.meta)");
        $stmt->execute([$hoje, $meta]);

        responderJson(['sucesso' => true, 'meta' => $meta]);
    }

    if ($acao === 'registrar_consumo') {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            responderJson(['erro' => 'Use o método POST para registrar o consumo.'], 405);
        }

        $entradaValor = $_POST['valor'] ?? null;
        $valor = is_scalar($entradaValor) ? filter_var($entradaValor, FILTER_VALIDATE_INT) : false;
        if ($valor === false || $valor === null || $valor === 0) {
            responderJson(['erro' => 'Informe um valor inteiro diferente de zero.'], 400);
        }

        $stmt = $db->prepare("INSERT INTO dias (dat, meta, consumido, meta_batida)
            VALUES (?, 2500, MAX(0, ?), (MAX(0, ?) >= 2500))
            ON CONFLICT(dat) DO UPDATE SET
                consumido = MAX(0, dias.consumido + ?),
                meta_batida = (MAX(0, dias.consumido + ?) >= dias.meta)");
        $stmt->execute([$hoje, $valor, $valor, $valor, $valor]);

        $stmt = $db->prepare("SELECT consumido FROM dias WHERE dat = ?");
        $stmt->execute([$hoje]);
        $consumo = (int)$stmt->fetchColumn();

        responderJson(['sucesso' => true, 'consumo' => $consumo]);
    }

    if ($acao === 'historico') {
        $stmt = $db->prepare("INSERT OR IGNORE INTO dias (dat, meta, consumido, meta_batida)
            VALUES (?, 2500, 0, 0)");
        $stmt->execute([$hoje]);

        $stmt = $db->prepare("SELECT dat AS data, meta, consumido, meta_batida
            FROM dias
            WHERE dat <= ?
            ORDER BY dat ASC");
        $stmt->execute([$hoje]);
        $historico = $stmt->fetchAll(PDO::FETCH_ASSOC);
        foreach ($historico as &$dia) {
            $dia['meta'] = (int)$dia['meta'];
            $dia['consumido'] = (int)$dia['consumido'];
            $dia['meta_batida'] = (bool)$dia['meta_batida'];
        }
        unset($dia);

        responderJson($historico);
    }

    responderJson(['erro' => 'Ação não encontrada.'], 404);
} catch (PDOException $e) {
    error_log('Erro na API HidraTrack/SQLite: ' . $e->getMessage());
    responderJson(['erro' => 'Falha ao acessar o banco SQLite. Verifique se o PHP tem o driver PDO_SQLITE habilitado e se bd.db pode ser gravado.'], 500);
}
