let metaGlobal = 2500;
let consumoGlobal = 0;
let temporizadorLembrete = null;

window.onload = function() {
    carregarDadosHoje();
    iniciarTemporizador(60);
};

async function requisitarApi(acao, opcoes = {}) {
    const resposta = await fetch(`api.php?acao=${acao}`, opcoes);
    let dados;

    try {
        dados = await resposta.json();
    } catch {
        throw new Error("O servidor retornou uma resposta inválida. Verifique se a aplicação está sendo executada pelo PHP.");
    }

    if (!resposta.ok || dados.erro) {
        throw new Error(dados.erro || "Não foi possível comunicar com o servidor.");
    }

    return dados;
}

async function carregarDadosHoje() {
    try {
        const dados = await requisitarApi('carregar_hoje');
        metaGlobal = Number(dados.meta);
        consumoGlobal = Number(dados.consumo);
        document.getElementById("input-meta").value = metaGlobal;
        atualizarInterface(consumoGlobal);
    } catch (erro) {
        alert(erro.message);
    }
}

async function salvarMeta() {
    const novaMeta = Number(document.getElementById("input-meta").value);
    if (!Number.isSafeInteger(novaMeta) || novaMeta <= 0) {
        alert("Informe uma meta inteira maior que zero.");
        return;
    }

    const formData = new FormData();
    formData.append('meta', novaMeta);
    try {
        const dados = await requisitarApi('salvar_meta', {
            method: 'POST',
            body: formData
        });
        metaGlobal = Number(dados.meta);
        document.getElementById("input-meta").value = metaGlobal;
        atualizarInterface(consumoGlobal);
    } catch (erro) {
        document.getElementById("input-meta").value = metaGlobal;
        alert(erro.message);
    }
}

async function adicionarAgua() {
    const valorDigitado = Number(document.getElementById("input-consumo").value);
    if (!Number.isSafeInteger(valorDigitado) || valorDigitado <= 0) {
        alert("Informe uma quantidade inteira maior que zero.");
        return;
    }

    await enviarConsumo(valorDigitado);
}

async function removerAgua() {
    const valorDigitado = Number(document.getElementById("input-consumo").value);
    if (!Number.isSafeInteger(valorDigitado) || valorDigitado <= 0) {
        alert("Informe uma quantidade inteira maior que zero.");
        return;
    }

    await enviarConsumo(-valorDigitado);
}

async function enviarConsumo(valor) {
    const formData = new FormData();
    formData.append('valor', valor);

    try {
        const dados = await requisitarApi('registrar_consumo', {
            method: 'POST',
            body: formData
        });
        consumoGlobal = Number(dados.consumo);
        atualizarInterface(consumoGlobal);
    } catch (erro) {
        alert(erro.message);
    }
}

function atualizarInterface(consumoAtual) {
    document.getElementById("valor-consumido").textContent = consumoAtual;
    
    let falta = metaGlobal - consumoAtual;
    if (falta < 0) falta = 0;
    document.getElementById("valor-faltando").textContent = falta;

    let porcentagemAgua = (consumoAtual / metaGlobal) * 100;
    if (porcentagemAgua > 100) porcentagemAgua = 100;
    if (porcentagemAgua < 0) porcentagemAgua = 0;

    let porcentagemFalta = 100 - porcentagemAgua;

    document.querySelector(".progresso-agua").style.width = porcentagemAgua + "%";
    document.querySelector(".progresso-falta").style.width = porcentagemFalta + "%";
}

function mudarLembrete() {
    const inputLembrete = document.getElementById("input-lembrete");
    const novoLembrete = Number(inputLembrete.value);
    if (!Number.isSafeInteger(novoLembrete) || novoLembrete <= 0) {
        alert("Informe um intervalo inteiro maior que zero.");
        inputLembrete.value = 60;
        return;
    }

    document.getElementById("texto-lembrete").textContent = novoLembrete + " em " + novoLembrete;
    iniciarTemporizador(novoLembrete);
}

function iniciarTemporizador(minutos) {
    if (temporizadorLembrete) {
        clearInterval(temporizadorLembrete);
    }
    let milissegundos = minutos * 60 * 1000;
    temporizadorLembrete = setInterval(() => {
        document.getElementById("modal-popup").style.display = "flex";
    }, milissegundos);
}

function fecharPopup() {
    document.getElementById("modal-popup").style.display = "none";
}

async function abrirHistorico() {
    try {
        const dados = await requisitarApi('historico');
        const container = document.getElementById("lista-historico");
        container.innerHTML = "";
        if (Array.isArray(dados) && dados.length > 0) {
            dados.forEach(item => {
                const dataFormatada = item.data.split('-').reverse().join('/');
                const bateu = item.meta_batida === true || Number(item.meta_batida) === 1;
                const statusTexto = bateu ? "Batida" : "Não Batida";
                const statusClasse = bateu ? "meta-batida" : "meta-nao-batida";

                const div = document.createElement("div");
                div.className = "item-historico";
                div.innerHTML = `<span>Data: ${dataFormatada}</span>` +
                                `<span>Consumido: ${item.consumido}ml/${item.meta}ml</span>` +
                                `<span>Meta: <strong class="${statusClasse}">${statusTexto}</strong></span>`;
                container.appendChild(div);
            });
        } else {
            container.innerHTML = "<div>Nenhum histórico encontrado.</div>";
        }
        document.getElementById("modal-historico").style.display = "flex";
    } catch (erro) {
        alert(erro.message);
    }
}

function fecharHistorico() {
    document.getElementById("modal-historico").style.display = "none";
}