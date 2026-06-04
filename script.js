let equipamentos = [];
let historico = [];
let graficos = {};
let ultimaConsultaHistorico = null;

const STATUS_LISTA = ["Disponível", "Indisponível", "Tombado (Acidente)"];
const CATEGORIAS = ["Caminhão", "Trator", "Tanque", "Apoio"];

const CORES_STATUS = {
  "Disponível": "#16a34a",
  "Indisponível": "#dc2626",
  "Tombado (Acidente)": "#374151"
};

function normalizarStatus(status) {
  if (!status) return "Indisponível";
  const s = String(status).trim();
  if (s === "Disponível" || s === "Operando") return "Disponível";
  if (s === "Tombado/Inativo" || s === "Tombado" || s === "Tombado (Acidente)") return "Tombado (Acidente)";
  if (s === "Em manutenção" || s === "Parado sem previsão" || s === "Indisponível") return "Indisponível";
  return s;
}

function statusValido(status) {
  return STATUS_LISTA.includes(normalizarStatus(status));
}

function statusSeguro(status, fallback = "Disponível") {
  const normalizado = normalizarStatus(status);
  return STATUS_LISTA.includes(normalizado) ? normalizado : fallback;
}


function removerAcentos(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function chaveTexto(texto) {
  return removerAcentos(texto)
    .toLowerCase()
    .replace(/['’`´]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const TIPOS_PADRONIZADOS = {
  "caminhao vinhaca": "Caminhão Vinhaça",
  "caminhao vinhaça": "Caminhão Vinhaça",
  "caminhão vinhaca": "Caminhão Vinhaça",
  "caminhão vinhaça": "Caminhão Vinhaça",
  "caminhao apoio": "Caminhão Apoio",
  "trator bomba": "Trator Bomba",
  "trator vinhaça": "Trator Vinhaça",
  "trator vinhaca": "Trator Vinhaça",
  "tanque vinhaca": "Tanque Vinhaça",
  "tanque vinhaça": "Tanque Vinhaça",
  "bola dagua": "Bola D'água",
  "bola d agua": "Bola D'água",
  "bola d'agua": "Bola D'água",
  "bola dágua": "Bola D'água",
  "bola d'água": "Bola D'água"
};

function capitalizarTipo(texto) {
  const minusculas = ["de", "da", "do", "das", "dos", "e"];
  return String(texto || "")
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((palavra, indice) => {
      if (indice > 0 && minusculas.includes(palavra)) return palavra;
      return palavra.charAt(0).toUpperCase() + palavra.slice(1);
    })
    .join(" ");
}

function padronizarTipo(tipo) {
  const limpo = String(tipo || "").replace(/\s+/g, " ").trim();
  if (!limpo) return "Não informado";

  const chave = chaveTexto(limpo);
  if (TIPOS_PADRONIZADOS[chave]) return TIPOS_PADRONIZADOS[chave];

  let texto = capitalizarTipo(limpo);
  texto = texto.replace(/\bCaminhao\b/g, "Caminhão");
  texto = texto.replace(/\bVinhaca\b/g, "Vinhaça");
  texto = texto.replace(/\bDagua\b/g, "D'água");
  texto = texto.replace(/\bD Agua\b/g, "D'água");
  texto = texto.replace(/\bD'Agua\b/g, "D'água");
  return texto;
}

function normalizarCategoria(categoria) {
  if (!categoria) return "Apoio";
  const c = removerAcentos(String(categoria).trim().toLowerCase());
  if (c.includes("camin")) return "Caminhão";
  if (c.includes("trator")) return "Trator";
  if (c.includes("tanque") || c.includes("bola")) return "Tanque";
  return "Apoio";
}

function equipamentoNormalizado(eq) {
  return {
    ...eq,
    status_normalizado: normalizarStatus(eq.status),
    categoria_normalizada: normalizarCategoria(eq.categoria),
    tipo_normalizado: padronizarTipo(eq.tipo)
  };
}

function listaEquipamentosNormalizada() {
  return equipamentos.map(equipamentoNormalizado);
}

function mostrarTela(id) {
  document.querySelectorAll(".tela").forEach(tela => tela.classList.remove("ativa"));
  document.getElementById(id).classList.add("ativa");

  if (id === "dashboard") {
    setTimeout(desenharGraficosDashboard, 100);
  }

  if (id === "relatorio") {
    gerarRelatorio();
    preencherSelectsFrota();
  }

  if (id === "historico") {
    carregarHistorico();
  }
}

function aplicarTemaSalvo() {
  const temaSalvo = localStorage.getItem("temaSistema") || "light";
  document.body.setAttribute("data-theme", temaSalvo);
  const btnTema = document.getElementById("btnTema");
  if (btnTema) btnTema.innerText = temaSalvo === "dark" ? "☀️ Tema claro" : "🌙 Tema escuro";
}

function alternarTema() {
  const temaAtual = document.body.getAttribute("data-theme");
  const novoTema = temaAtual === "dark" ? "light" : "dark";
  document.body.setAttribute("data-theme", novoTema);
  localStorage.setItem("temaSistema", novoTema);
  const btnTema = document.getElementById("btnTema");
  if (btnTema) btnTema.innerText = novoTema === "dark" ? "☀️ Tema claro" : "🌙 Tema escuro";
  setTimeout(desenharGraficosDashboard, 100);
  if (ultimaConsultaHistorico) setTimeout(() => desenharPizzaHistoricoPeriodo(ultimaConsultaHistorico.resumo), 100);
}

function corTextoAtual() {
  return getComputedStyle(document.body).getPropertyValue("--cor-texto").trim() || "#1f2937";
}

function corGridAtual() {
  return getComputedStyle(document.body).getPropertyValue("--cor-borda").trim() || "#d1d5db";
}

function escaparHTML(valor) {
  if (valor === null || valor === undefined) return "";
  return String(valor)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatarData(dataISO) {
  if (!dataISO) return "--";
  return new Date(dataISO).toLocaleString("pt-BR");
}

function formatarDataCurta(dataISO) {
  if (!dataISO) return "--";
  return new Date(dataISO).toLocaleDateString("pt-BR");
}

function dataISOInput(date) {
  return date.toISOString().slice(0, 10);
}

function classeStatus(status) {
  const s = normalizarStatus(status);
  if (s === "Disponível") return "status-disponivel";
  if (s === "Indisponível") return "status-indisponivel";
  if (s === "Tombado (Acidente)") return "status-tombado";
  return "status-neutro";
}

function badgeStatus(status) {
  const s = normalizarStatus(status);
  return `<span class="status-badge ${classeStatus(s)}">${escaparHTML(s)}</span>`;
}

function contarStatus(lista) {
  const normalizados = lista.map(equipamentoNormalizado);
  return STATUS_LISTA.map(status => ({
    status,
    quantidade: normalizados.filter(eq => eq.status_normalizado === status).length
  }));
}

function calcularResumo(lista) {
  const normalizados = lista.map(equipamentoNormalizado);
  const total = normalizados.length;
  const disponiveis = normalizados.filter(eq => eq.status_normalizado === "Disponível").length;
  const indisponiveis = normalizados.filter(eq => eq.status_normalizado === "Indisponível").length;
  const tombados = normalizados.filter(eq => eq.status_normalizado === "Tombado (Acidente)").length;
  const disponibilidade = total > 0 ? (disponiveis / total * 100) : 0;
  const indisponibilidade = total > 0 ? ((indisponiveis + tombados) / total * 100) : 0;
  return { total, disponiveis, indisponiveis, tombados, disponibilidade, indisponibilidade };
}

async function carregarEquipamentos() {
  const { data, error } = await supabaseClient
    .from("equipamentos")
    .select("*")
    .order("categoria", { ascending: true })
    .order("frota", { ascending: true });

  if (error) {
    alert("Erro ao carregar equipamentos: " + error.message);
    return;
  }

  equipamentos = data || [];
  atualizarDashboard();
  renderizarTabelaEquipamentos();
  carregarSugestoesFrotasHistorico();
  preencherSelectsFrota();
  setTimeout(desenharGraficosDashboard, 100);
}

function carregarSugestoesFrotasHistorico() {
  const listaHistorico = document.getElementById("listaFrotasHistorico");
  const listaRelatorio = document.getElementById("listaFrotasHistoricoRelatorio");

  if (listaHistorico) {
    listaHistorico.innerHTML = "";
  }

  if (listaRelatorio) {
    listaRelatorio.innerHTML = "";
  }

  const frotasOrdenadas = [...equipamentos]
    .map(eq => eq.frota)
    .filter(frota => frota !== null && frota !== undefined && String(frota).trim() !== "")
    .sort((a, b) => String(a).localeCompare(String(b), "pt-BR", { numeric: true }));

  frotasOrdenadas.forEach(frota => {
    if (listaHistorico) {
      listaHistorico.innerHTML += `<option value="${frota}">`;
    }

    if (listaRelatorio) {
      listaRelatorio.innerHTML += `<option value="${frota}">`;
    }
  });
}

async function carregarHistorico() {
  const { data, error } = await supabaseClient
    .from("historico")
    .select("*")
    .order("data_hora", { ascending: false });

  if (error) {
    alert("Erro ao carregar histórico: " + error.message);
    return;
  }

  historico = data || [];
  preencherSelectsFrota();
  renderizarHistoricoGeral();
}

function preencherSelectsFrota() {
  const frotas = [...new Set(equipamentos.map(eq => eq.frota).filter(Boolean))].sort();
  const selects = ["histFrota", "relFrotaHistorico"];

  selects.forEach(id => {
    const select = document.getElementById(id);
    if (!select) return;
    const valorAtual = select.value;
    select.innerHTML = `<option value="">Selecione uma frota</option>`;
    frotas.forEach(frota => {
      select.innerHTML += `<option value="${escaparHTML(frota)}">Frota ${escaparHTML(frota)}</option>`;
    });
    if (valorAtual && frotas.includes(valorAtual)) select.value = valorAtual;
  });

  const hoje = new Date();
  const inicio = new Date();
  inicio.setDate(hoje.getDate() - 30);

  ["histDataInicial", "relDataInicial"].forEach(id => {
    const input = document.getElementById(id);
    if (input && !input.value) input.value = dataISOInput(inicio);
  });

  ["histDataFinal", "relDataFinal"].forEach(id => {
    const input = document.getElementById(id);
    if (input && !input.value) input.value = dataISOInput(hoje);
  });

  preencherDatalistTipos();
}

function preencherDatalistTipos() {
  const datalist = document.getElementById("listaTiposEquipamentos");
  if (!datalist) return;

  const tipos = [...new Set(equipamentos.map(eq => padronizarTipo(eq.tipo)).filter(tipo => tipo && tipo !== "Não informado"))].sort();
  datalist.innerHTML = "";
  tipos.forEach(tipo => {
    datalist.innerHTML += `<option value="${escaparHTML(tipo)}"></option>`;
  });
}

function ajustarCamposFormulario() {
  const categoria = document.getElementById("categoria")?.value;
  const status = document.getElementById("status")?.value;

  const campoPlaca = document.getElementById("campoPlaca");
  const campoProblema = document.getElementById("campoProblema");
  const campoOS = document.getElementById("campoOS");
  const campoPrevisao = document.getElementById("campoPrevisao");

  const placa = document.getElementById("placa");
  const problema = document.getElementById("problema");
  const ordemServico = document.getElementById("ordemServico");
  const previsao = document.getElementById("previsao");
  const situacao = document.getElementById("situacao");

  if (categoria === "Caminhão") {
    campoPlaca?.classList.remove("campo-oculto");
  } else {
    campoPlaca?.classList.add("campo-oculto");
    if (placa) placa.value = "";
  }

  if (status === "Disponível") {
    campoProblema?.classList.add("campo-oculto");
    campoOS?.classList.add("campo-oculto");
    campoPrevisao?.classList.add("campo-oculto");
    if (problema) problema.value = "";
    if (ordemServico) ordemServico.value = "";
    if (previsao) previsao.value = "";
    if (situacao) situacao.placeholder = "Ex: disponível no pátio ou liberado para operação";
    return;
  }

  campoProblema?.classList.remove("campo-oculto");
  campoOS?.classList.remove("campo-oculto");

  if (status === "Tombado (Acidente)") {
    campoPrevisao?.classList.add("campo-oculto");
    if (previsao) previsao.value = "";
  } else {
    campoPrevisao?.classList.remove("campo-oculto");
  }

  if (situacao) situacao.placeholder = "Ex: aguardando peça, na oficina, sem previsão";
}

async function salvarEquipamento() {
  const id = document.getElementById("idEquipamento").value;

  const dados = {
    frota: document.getElementById("frota").value.trim(),
    tipo: document.getElementById("tipo").value.trim(),
    categoria: document.getElementById("categoria").value,
    placa: document.getElementById("placa").value.trim(),
    status: document.getElementById("status").value,
    situacao: document.getElementById("situacao").value.trim(),
    problema: document.getElementById("problema").value.trim(),
    ordem_servico: document.getElementById("ordemServico").value.trim(),
    previsao: document.getElementById("previsao").value.trim(),
    responsavel: document.getElementById("responsavel").value.trim(),
    ultima_atualizacao: new Date().toISOString()
  };

  if (dados.categoria === "Trator") {
  dados.tipo = "Trator Nonino";
}

  dados.categoria = normalizarCategoria(dados.categoria);
  dados.status = statusSeguro(dados.status);
  dados.tipo = padronizarTipo(dados.tipo);

  if (dados.categoria !== "Caminhão") dados.placa = "";
  if (dados.status === "Disponível") {
    dados.problema = "";
    dados.ordem_servico = "";
    dados.previsao = "";
  }
  if (dados.status === "Tombado (Acidente)") dados.previsao = "";

  if (!dados.frota || !dados.tipo || !dados.responsavel) {
    alert("Preencha pelo menos Frota, Tipo e Responsável.");
    return;
  }

  if (!id) {
    const { data, error } = await supabaseClient
      .from("equipamentos")
      .insert([dados])
      .select()
      .single();

    if (error) {
      alert("Erro ao cadastrar. Verifique se a frota já existe.");
      return;
    }

    await registrarHistoricoCompleto(
      { id: data.id, frota: dados.frota, status: "Cadastro inicial", problema: "", ordem_servico: "", previsao: "" },
      dados,
      "Cadastro inicial do equipamento"
    );

    alert("Equipamento cadastrado com sucesso!");
  } else {
    const equipamentoAntigo = equipamentos.find(eq => eq.id == id);

    const { error } = await supabaseClient
      .from("equipamentos")
      .update(dados)
      .eq("id", id);

    if (error) {
      alert("Erro ao atualizar equipamento: " + error.message);
      return;
    }

    if (equipamentoAntigo) {
      const mudouStatus = normalizarStatus(equipamentoAntigo.status) !== dados.status;
      const mudouProblema = (equipamentoAntigo.problema || "") !== dados.problema;
      const mudouOS = (equipamentoAntigo.ordem_servico || "") !== dados.ordem_servico;
      const mudouPrevisao = (equipamentoAntigo.previsao || "") !== dados.previsao;

      if (mudouStatus || mudouProblema || mudouOS || mudouPrevisao) {
        await registrarHistoricoCompleto(equipamentoAntigo, dados, "Alteração completa do equipamento");
      }
    }

    alert("Equipamento atualizado com sucesso!");
  }

  limparFormulario();
  await carregarEquipamentos();
  mostrarTela("equipamentos");
}

async function registrarHistoricoCompleto(equipamentoAntigo, dadosNovos, observacao) {
  const { error } = await supabaseClient
    .from("historico")
    .insert([{
      equipamento_id: equipamentoAntigo.id,
      frota: dadosNovos.frota || equipamentoAntigo.frota,
      status_anterior: normalizarStatus(equipamentoAntigo.status),
      status_novo: normalizarStatus(dadosNovos.status),
      problema_anterior: equipamentoAntigo.problema || "",
      problema_novo: dadosNovos.problema || "",
      os_anterior: equipamentoAntigo.ordem_servico || "",
      os_novo: dadosNovos.ordem_servico || "",
      previsao_anterior: equipamentoAntigo.previsao || "",
      previsao_novo: dadosNovos.previsao || "",
      observacao,
      responsavel: dadosNovos.responsavel || "Não informado",
      data_hora: new Date().toISOString()
    }]);

  if (error) console.error("Erro ao registrar histórico:", error.message);
}

function editarEquipamento(id) {
  const eq = equipamentos.find(item => item.id === id);
  if (!eq) return;

  document.getElementById("idEquipamento").value = eq.id;
  document.getElementById("frota").value = eq.frota || "";
  document.getElementById("tipo").value = padronizarTipo(eq.tipo || "");
  document.getElementById("categoria").value = normalizarCategoria(eq.categoria);
  document.getElementById("placa").value = eq.placa || "";
  document.getElementById("status").value = normalizarStatus(eq.status);
  document.getElementById("situacao").value = eq.situacao || "";
  document.getElementById("problema").value = eq.problema || "";
  document.getElementById("ordemServico").value = eq.ordem_servico || "";
  document.getElementById("previsao").value = eq.previsao || "";
  document.getElementById("responsavel").value = eq.responsavel || "";

  ajustarCamposFormulario();
  mostrarTela("cadastro");
}

async function excluirEquipamento(id) {
  const confirmar = confirm("Tem certeza que deseja excluir este equipamento?");
  if (!confirmar) return;

  const { error } = await supabaseClient.from("equipamentos").delete().eq("id", id);
  if (error) {
    alert("Erro ao excluir: " + error.message);
    return;
  }

  alert("Equipamento excluído com sucesso!");
  await carregarEquipamentos();
}

function limparFormulario() {
  document.getElementById("idEquipamento").value = "";
  document.getElementById("frota").value = "";
  document.getElementById("tipo").value = "";
  document.getElementById("categoria").value = "Caminhão";
  document.getElementById("placa").value = "";
  document.getElementById("status").value = "Disponível";
  document.getElementById("situacao").value = "";
  document.getElementById("problema").value = "";
  document.getElementById("ordemServico").value = "";
  document.getElementById("previsao").value = "";
  document.getElementById("responsavel").value = "";
  ajustarCamposFormulario();
}

async function atualizarStatusDireto(id, novoStatus) {
  const equipamento = equipamentos.find(eq => eq.id === id);
  if (!equipamento) return;

  if (normalizarStatus(equipamento.status) === novoStatus) {
    alert("Este equipamento já está com esse status.");
    return;
  }

  const responsavel = prompt("Informe o responsável pela atualização:");
  if (!responsavel || responsavel.trim() === "") {
    alert("Responsável é obrigatório para atualizar o status.");
    return;
  }

  const confirmar = confirm(`Confirmar alteração da frota ${equipamento.frota} para "${novoStatus}"?`);
  if (!confirmar) return;

  const dadosAtualizados = {
    status: novoStatus,
    responsavel: responsavel.trim(),
    ultima_atualizacao: new Date().toISOString()
  };

  let dadosParaHistorico = {
    frota: equipamento.frota,
    status: novoStatus,
    problema: equipamento.problema || "",
    ordem_servico: equipamento.ordem_servico || "",
    previsao: equipamento.previsao || "",
    responsavel: responsavel.trim()
  };

  if (novoStatus === "Disponível") {
    dadosAtualizados.problema = "";
    dadosAtualizados.ordem_servico = "";
    dadosAtualizados.previsao = "";
    dadosParaHistorico.problema = "";
    dadosParaHistorico.ordem_servico = "";
    dadosParaHistorico.previsao = "";
  }

  if (novoStatus === "Tombado (Acidente)") {
    dadosAtualizados.previsao = "";
    dadosParaHistorico.previsao = "";
  }

  const { error } = await supabaseClient.from("equipamentos").update(dadosAtualizados).eq("id", id);
  if (error) {
    alert("Erro ao atualizar status: " + error.message);
    return;
  }

  await registrarHistoricoCompleto(equipamento, dadosParaHistorico, "Atualização rápida de status");
  alert("Status atualizado com sucesso!");
  await carregarEquipamentos();
}

async function atualizarStatusRapido(id) {
  const select = document.getElementById(`statusRapido_${id}`);
  if (!select) return;
  await atualizarStatusDireto(id, select.value);
}

function atualizarDashboard() {
  const lista = listaEquipamentosNormalizada();
  const resumo = calcularResumo(equipamentos);

  document.getElementById("cardTotal").innerText = resumo.total;
  document.getElementById("cardDisponiveis").innerText = resumo.disponiveis;
  document.getElementById("cardIndisponiveis").innerText = resumo.indisponiveis;
  document.getElementById("cardTombados").innerText = resumo.tombados;
  document.getElementById("cardDisponibilidade").innerText = `${resumo.disponibilidade.toFixed(1)}%`;
  document.getElementById("heroDisponibilidade").innerText = `${resumo.disponibilidade.toFixed(1)}%`;

  document.getElementById("totalCaminhoes").innerText = lista.filter(eq => eq.categoria_normalizada === "Caminhão").length;
  document.getElementById("totalTratores").innerText = lista.filter(eq => eq.categoria_normalizada === "Trator").length;
  document.getElementById("totalTanques").innerText = lista.filter(eq => eq.categoria_normalizada === "Tanque").length;
  document.getElementById("totalApoio").innerText = lista.filter(eq => eq.categoria_normalizada === "Apoio").length;

  document.getElementById("ultimaAtualizacaoHero").innerText = "Última atualização: " + buscarUltimaAtualizacao();

  renderizarTabelaParados();
  renderizarAccordionCategorias();
}

function buscarUltimaAtualizacao() {
  if (equipamentos.length === 0) return "--";
  const datas = equipamentos.map(eq => eq.ultima_atualizacao).filter(Boolean);
  if (datas.length === 0) return "--";
  datas.sort((a, b) => new Date(b) - new Date(a));
  return formatarData(datas[0]);
}

function destruirGrafico(nome) {
  if (graficos[nome]) {
    graficos[nome].destroy();
    graficos[nome] = null;
  }
}

function rotuloQuantidadePercentual(item, total) {
  const percentual = total > 0 ? (item.quantidade / total * 100).toFixed(1) : "0.0";
  return `${item.status}: ${item.quantidade} (${percentual}%)`;
}

function opcoesPadraoGrafico(dados = []) {
  const corTexto = corTextoAtual();
  const corGrid = corGridAtual();
  const total = dados.reduce((s, d) => s + d.quantidade, 0);

  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context) => {
            const item = dados[context.dataIndex];
            return item ? rotuloQuantidadePercentual(item, total) : `Quantidade: ${context.raw}`;
          }
        }
      }
    },
    scales: {
      x: { ticks: { color: corTexto }, grid: { color: corGrid } },
      y: { beginAtZero: true, ticks: { color: corTexto, precision: 0 }, grid: { color: corGrid } }
    }
  };
}

function opcoesPizza(dados = []) {
  const corTexto = corTextoAtual();
  const total = dados.reduce((s, d) => s + d.quantidade, 0);

  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "bottom",
        labels: { color: corTexto, padding: 14 }
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const item = dados[context.dataIndex];
            return item ? rotuloQuantidadePercentual(item, total) : context.label;
          }
        }
      }
    }
  };
}

function criarGraficoBarra(canvasId, nomeGrafico, lista) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  destruirGrafico(nomeGrafico);

  const dados = contarStatus(lista);
  const total = dados.reduce((s, d) => s + d.quantidade, 0);

  const pluginValores = {
    id: `valores_${nomeGrafico}`,
    afterDatasetsDraw(chart) {
      const { ctx } = chart;
      const dataset = chart.data.datasets[0];
      const meta = chart.getDatasetMeta(0);
      ctx.save();
      ctx.fillStyle = corTextoAtual();
      ctx.font = "bold 12px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      meta.data.forEach((bar, index) => {
        const valor = dataset.data[index] || 0;
        const percentual = total > 0 ? (valor / total * 100).toFixed(1) : "0.0";
        ctx.fillText(`${valor} (${percentual}%)`, bar.x, bar.y - 4);
      });
      ctx.restore();
    }
  };

  graficos[nomeGrafico] = new Chart(canvas, {
    type: "bar",
    data: {
      labels: dados.map(item => item.status === "Tombado (Acidente)" ? "Tombado" : item.status),
      datasets: [{
        label: "Quantidade",
        data: dados.map(item => item.quantidade),
        backgroundColor: dados.map(item => CORES_STATUS[item.status])
      }]
    },
    options: opcoesPadraoGrafico(dados),
    plugins: [pluginValores]
  });
}

function criarGraficoPizza(canvasId, nomeGrafico, lista, infoId, textoSemDados) {
  const canvas = document.getElementById(canvasId);
  const info = document.getElementById(infoId);
  if (!canvas) return;
  destruirGrafico(nomeGrafico);

  if (!lista || lista.length === 0) {
    canvas.style.display = "none";
    if (info) info.innerText = textoSemDados || "Nenhum equipamento cadastrado.";
    return;
  }

  canvas.style.display = "block";
  const dados = contarStatus(lista).filter(item => item.quantidade > 0);
  const resumo = calcularResumo(lista);
  if (info) info.innerText = `Total: ${resumo.total} | Disponibilidade: ${resumo.disponibilidade.toFixed(1)}%`;

  const total = dados.reduce((s, d) => s + d.quantidade, 0);

  graficos[nomeGrafico] = new Chart(canvas, {
    type: "pie",
    data: {
      labels: dados.map(item => rotuloQuantidadePercentual(item, total)),
      datasets: [{
        data: dados.map(item => item.quantidade),
        backgroundColor: dados.map(item => CORES_STATUS[item.status])
      }]
    },
    options: opcoesPizza(dados)
  });
}

function desenharGraficosDashboard() {
  const lista = listaEquipamentosNormalizada();
  criarGraficoBarra("graficoBarraStatus", "barraStatusDashboard", lista);
  criarGraficoPizza("graficoPizzaGeral", "pizzaGeralDashboard", lista, "infoPizzaGeral", "Nenhum equipamento cadastrado.");
  criarGraficoPizza("pizzaCaminhao", "pizzaCaminhaoDashboard", lista.filter(eq => eq.categoria_normalizada === "Caminhão"), "infoPizzaCaminhao", "Nenhum caminhão cadastrado.");
  criarGraficoPizza("pizzaTrator", "pizzaTratorDashboard", lista.filter(eq => eq.categoria_normalizada === "Trator"), "infoPizzaTrator", "Nenhum trator cadastrado.");
  criarGraficoPizza("pizzaTanque", "pizzaTanqueDashboard", lista.filter(eq => eq.categoria_normalizada === "Tanque"), "infoPizzaTanque", "Nenhum tanque cadastrado.");
  criarGraficoPizza("pizzaApoio", "pizzaApoioDashboard", lista.filter(eq => eq.categoria_normalizada === "Apoio"), "infoPizzaApoio", "Nenhum equipamento de apoio cadastrado.");
}

function renderizarAccordionCategorias() {
  const container = document.getElementById("accordionCategorias");
  if (!container) return;
  const lista = listaEquipamentosNormalizada();
  container.innerHTML = "";

  CATEGORIAS.forEach(categoria => {
    const itensCategoria = lista.filter(eq => eq.categoria_normalizada === categoria);
    const resumoCategoria = calcularResumo(itensCategoria);

    const gruposTipo = {};
    itensCategoria.forEach(eq => {
      const tipo = eq.tipo_normalizado || "Não informado";
      if (!gruposTipo[tipo]) gruposTipo[tipo] = [];
      gruposTipo[tipo].push(eq);
    });

    let tiposHTML = "";
    const tipos = Object.keys(gruposTipo).sort();

    if (tipos.length === 0) {
      tiposHTML = `<p class="texto-ajuda">Nenhum equipamento cadastrado nesta categoria.</p>`;
    } else {
      tiposHTML = `<div class="tipo-grid">`;
      tipos.forEach(tipo => {
        const resumo = calcularResumo(gruposTipo[tipo]);
        tiposHTML += `
          <div class="tipo-card">
            <h4>${escaparHTML(tipo)}</h4>
            <div class="tipo-metricas">
              <span>Total: ${resumo.total}</span>
              <span>Disponíveis: ${resumo.disponiveis}</span>
              <span>Indisponíveis: ${resumo.indisponiveis}</span>
              <span>Tombados: ${resumo.tombados}</span>
            </div>
            <div class="tipo-percentual">${resumo.disponibilidade.toFixed(1)}%</div>
          </div>
        `;
      });
      tiposHTML += `</div>`;
    }

    container.innerHTML += `
      <details class="accordion-item">
        <summary>${escaparHTML(categoria)} — Total: ${resumoCategoria.total} | Disponibilidade: ${resumoCategoria.disponibilidade.toFixed(1)}%</summary>
        <div class="accordion-conteudo">${tiposHTML}</div>
      </details>
    `;
  });
}

function renderizarTabelaParados() {
  const tbody = document.getElementById("tabelaParados");
  tbody.innerHTML = "";
  const parados = listaEquipamentosNormalizada().filter(eq => eq.status_normalizado !== "Disponível");

  if (parados.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8">✅ Nenhum equipamento indisponível ou tombado no momento.</td></tr>`;
    return;
  }

  parados.forEach(eq => {
    tbody.innerHTML += `
      <tr>
        <td><strong>${escaparHTML(eq.frota)}</strong></td>
        <td>${escaparHTML(eq.categoria_normalizada)}</td>
        <td>${escaparHTML(eq.tipo_normalizado)}</td>
        <td>${badgeStatus(eq.status_normalizado)}</td>
        <td>${escaparHTML(eq.problema)}</td>
        <td>${escaparHTML(eq.ordem_servico)}</td>
        <td>${escaparHTML(eq.previsao)}</td>
        <td>${escaparHTML(eq.responsavel)}</td>
      </tr>
    `;
  });
}

function renderizarTabelaEquipamentos() {
  const tbody = document.getElementById("tabelaEquipamentos");
  if (!tbody) return;

  const filtroFrota = document.getElementById("filtroFrota")?.value.toLowerCase() || "";
  const filtroCategoria = document.getElementById("filtroCategoria")?.value || "";
  const filtroStatus = document.getElementById("filtroStatus")?.value || "";

  let lista = listaEquipamentosNormalizada().filter(eq => {
    const frota = String(eq.frota || "").toLowerCase();
    const confereFrota = frota.includes(filtroFrota);
    const confereCategoria = !filtroCategoria || eq.categoria_normalizada === filtroCategoria;
    const confereStatus = !filtroStatus || eq.status_normalizado === filtroStatus;
    return confereFrota && confereCategoria && confereStatus;
  });

  tbody.innerHTML = "";
  if (lista.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9">Nenhum equipamento encontrado.</td></tr>`;
    return;
  }

  lista.forEach(eq => {
    const opcoesStatus = STATUS_LISTA.map(status => `<option ${status === eq.status_normalizado ? "selected" : ""}>${status}</option>`).join("");
    tbody.innerHTML += `
      <tr>
        <td><strong>${escaparHTML(eq.frota)}</strong></td>
        <td>${escaparHTML(eq.tipo_normalizado)}</td>
        <td>${escaparHTML(eq.categoria_normalizada)}</td>
        <td>${badgeStatus(eq.status_normalizado)}</td>
        <td>${escaparHTML(eq.problema)}</td>
        <td>${escaparHTML(eq.ordem_servico)}</td>
        <td>${escaparHTML(eq.previsao)}</td>
        <td>
          <select class="select-rapido" id="statusRapido_${eq.id}">${opcoesStatus}</select>
          <button class="btn-rapido" onclick="atualizarStatusRapido(${eq.id})">Atualizar</button>
          <button class="btn-liberar" onclick="atualizarStatusDireto(${eq.id}, 'Disponível')">✔ Liberar</button>
          <button class="btn-indisponivel" onclick="atualizarStatusDireto(${eq.id}, 'Indisponível')">❌ Indisponível</button>
          <button class="btn-tombado" onclick="atualizarStatusDireto(${eq.id}, 'Tombado (Acidente)')">⚫ Tombado</button>
        </td>
        <td>
          <button class="btn-editar" onclick="editarEquipamento(${eq.id})">Editar</button>
          <button class="btn-excluir" onclick="excluirEquipamento(${eq.id})">Excluir</button>
        </td>
      </tr>
    `;
  });
}

function formatarOSWhatsapp(valor) {
  const texto = (valor || "").trim();
  if (!texto) return "Sem OS";
  if (texto.toUpperCase().startsWith("OS")) return texto;
  return `OS ${texto}`;
}

function formatarPrevisaoWhatsapp(valor) {
  const texto = (valor || "").trim();
  return texto || "Sem previsão";
}

function linhaRelatorioWhatsapp(eq) {
  const status = eq.status_normalizado;
  const frota = eq.frota || "Sem frota";
  const tipo = eq.tipo_normalizado || "Sem tipo";
  const problema = eq.problema || "Sem observação";
  const os = formatarOSWhatsapp(eq.ordem_servico);
  const previsao = formatarPrevisaoWhatsapp(eq.previsao);

  if (status === "Disponível") {
    return `✅ Frota ${frota} – OK / Disponível – Tipo: ${tipo}`;
  }

  if (status === "Tombado (Acidente)") {
    return `⚫ Frota ${frota} – Tombado (Acidente) – ${problema} – ${os} – Previsão ${previsao}`;
  }

  return `❌ Frota ${frota} – Indisponível – ${problema} – ${os} – Previsão ${previsao}`;
}

function gerarRelatorio() {
  const total = equipamentos.length;

  const disponiveis = equipamentos.filter(eq =>
    eq.status === "Disponível" || eq.status === "Operando"
  ).length;

  const indisponiveis = equipamentos.filter(eq =>
    eq.status === "Indisponível" ||
    eq.status === "Em manutenção" ||
    eq.status === "Parado sem previsão"
  ).length;

  const tombados = equipamentos.filter(eq =>
    eq.status === "Tombado (Acidente)" ||
    eq.status === "Tombado/Inativo"
  ).length;

  const percDisponivel = total > 0 ? ((disponiveis / total) * 100).toFixed(1) : 0;
  const percIndisponivel = total > 0 ? ((indisponiveis / total) * 100).toFixed(1) : 0;
  const percTombado = total > 0 ? ((tombados / total) * 100).toFixed(1) : 0;

  function porcentagem(valor, totalCategoria) {
    return totalCategoria > 0 ? ((valor / totalCategoria) * 100).toFixed(1) : "0.0";
  }

  function formatarOS(os) {
    if (!os || os.trim() === "") return "Sem OS";

    let osLimpa = os.trim();

    // Evita ficar "OS OS 4158985"
    if (osLimpa.toUpperCase().startsWith("OS ")) {
      return osLimpa;
    }

    return "OS " + osLimpa;
  }

  function formatarPrevisao(previsao) {
    if (!previsao || previsao.trim() === "") return "Sem previsão";
    return previsao.trim();
  }

  function statusIcone(status) {
    if (status === "Disponível" || status === "Operando") return "✅";
    if (status === "Tombado (Acidente)" || status === "Tombado/Inativo") return "⚫";
    return "❌";
  }

  function statusTexto(status) {
    if (status === "Disponível" || status === "Operando") return "Disponível";
    if (status === "Tombado/Inativo") return "Tombado (Acidente)";
    if (status === "Em manutenção" || status === "Parado sem previsão") return "Indisponível";
    return status || "Sem status";
  }

  function linhaEquipamento(eq) {
    const icone = statusIcone(eq.status);
    const status = statusTexto(eq.status);
    const tipo = eq.tipo ? ` – ${eq.tipo}` : "";

    if (status === "Disponível") {
      return `${icone} Frota ${eq.frota}${tipo} – ${status}`;
    }

    const problema = eq.problema && eq.problema.trim() !== ""
      ? eq.problema.trim()
      : "Sem observação";

    const os = formatarOS(eq.ordem_servico);
    const previsao = formatarPrevisao(eq.previsao);

    return `${icone} Frota ${eq.frota}${tipo} – ${status} – ${problema} – ${os} – Previsão ${previsao}`;
  }

  function gerarBlocoCategoria(categoria, titulo) {
    const lista = equipamentos.filter(eq => eq.categoria === categoria);

    const totalCategoria = lista.length;

    const dispCategoria = lista.filter(eq =>
      eq.status === "Disponível" || eq.status === "Operando"
    ).length;

    const indispCategoria = lista.filter(eq =>
      eq.status === "Indisponível" ||
      eq.status === "Em manutenção" ||
      eq.status === "Parado sem previsão"
    ).length;

    const tombCategoria = lista.filter(eq =>
      eq.status === "Tombado (Acidente)" ||
      eq.status === "Tombado/Inativo"
    ).length;

    let bloco = `\n${titulo} — Total: ${totalCategoria} | ✅ ${dispCategoria} (${porcentagem(dispCategoria, totalCategoria)}%) | ❌ ${indispCategoria} (${porcentagem(indispCategoria, totalCategoria)}%) | ⚫ ${tombCategoria} (${porcentagem(tombCategoria, totalCategoria)}%)\n\n`;

    if (lista.length === 0) {
      bloco += "Nenhum equipamento cadastrado nesta categoria.\n";
      return bloco;
    }

    const ordenados = [...lista].sort((a, b) => {
      const ordemStatus = {
        "Tombado (Acidente)": 1,
        "Tombado/Inativo": 1,
        "Indisponível": 2,
        "Em manutenção": 2,
        "Parado sem previsão": 2,
        "Disponível": 3,
        "Operando": 3
      };

      const ordemA = ordemStatus[a.status] || 9;
      const ordemB = ordemStatus[b.status] || 9;

      if (ordemA !== ordemB) return ordemA - ordemB;

      return String(a.frota).localeCompare(String(b.frota), "pt-BR", {
        numeric: true
      });
    });

    ordenados.forEach(eq => {
      bloco += `• ${linhaEquipamento(eq)}\n`;
    });

    return bloco;
  }

  let texto = `🚛 RELATÓRIO DE DISPONIBILIDADE DA IRRIGAÇÃO

📅 Atualizado em: ${new Date().toLocaleString("pt-BR")}

📊 Total geral de equipamentos: ${total}

✅ Disponíveis: ${disponiveis}
📈 Disponibilidade: ${percDisponivel}%

❌ Indisponíveis: ${indisponiveis}
📉 Indisponibilidade: ${percIndisponivel}%

⚫ Tombados (Acidente): ${tombados}
📉 Tombados: ${percTombado}%

━━━━━━━━━━━━━━━━━━
`;

  texto += gerarBlocoCategoria("Caminhão", "🚛 CAMINHÕES");
  texto += gerarBlocoCategoria("Trator", "🚜 TRATORES");
  texto += gerarBlocoCategoria("Tanque", "🛢️ TANQUES");
  texto += gerarBlocoCategoria("Apoio", "🛠️ APOIO");

  document.getElementById("textoRelatorio").value = texto;
}

function copiarRelatorio() {
  gerarRelatorio();
  const texto = document.getElementById("textoRelatorio");
  texto.select();
  document.execCommand("copy");
  alert("Relatório copiado!");
}

function baixarRelatorioTxt() {
  gerarRelatorio();
  const texto = document.getElementById("textoRelatorio").value;
  const blob = new Blob([texto], { type: "text/plain;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "relatorio_irrigacao.txt";
  link.click();
}

function exportarExcel() {
  const lista = listaEquipamentosNormalizada();
  if (lista.length === 0) {
    alert("Nenhum equipamento para exportar.");
    return;
  }

  const dados = lista.map(eq => ({
    Frota: eq.frota || "",
    Tipo: eq.tipo_normalizado || "",
    Categoria: eq.categoria_normalizada || "",
    Placa: eq.placa || "",
    Status: eq.status_normalizado || "",
    Situação: eq.situacao || "",
    Problema: eq.problema || "",
    OS: eq.ordem_servico || "",
    Previsão: eq.previsao || "",
    Responsável: eq.responsavel || "",
    "Última Atualização": formatarData(eq.ultima_atualizacao)
  }));

  const planilha = XLSX.utils.json_to_sheet(dados);
  const arquivo = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(arquivo, planilha, "Equipamentos");
  XLSX.writeFile(arquivo, `controle_irrigacao_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

function criarCanvasPizza(lista, titulo = "") {
  const canvas = document.createElement("canvas");
  canvas.width = 620;
  canvas.height = 380;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#064e3b";
  ctx.font = "bold 18px Arial";
  ctx.fillText(titulo, 20, 28);

  const dados = contarStatus(lista);
  const total = dados.reduce((s, d) => s + d.quantidade, 0);
  const cx = 185;
  const cy = 200;
  const raio = 115;
  let anguloInicial = -Math.PI / 2;

  if (total === 0) {
    ctx.fillStyle = "#374151";
    ctx.font = "16px Arial";
    ctx.fillText("Sem dados", 135, 195);
    return canvas;
  }

  dados.forEach(item => {
    const angulo = (item.quantidade / total) * Math.PI * 2;
    if (angulo > 0) {
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, raio, anguloInicial, anguloInicial + angulo);
      ctx.closePath();
      ctx.fillStyle = CORES_STATUS[item.status];
      ctx.fill();
    }
    anguloInicial += angulo;
  });

  let y = 120;
  dados.forEach(item => {
    const percentual = total > 0 ? (item.quantidade / total * 100).toFixed(1) : "0.0";
    ctx.fillStyle = CORES_STATUS[item.status];
    ctx.fillRect(360, y - 12, 16, 16);
    ctx.fillStyle = "#111827";
    ctx.font = "14px Arial";
    ctx.fillText(`${item.status}: ${item.quantidade} (${percentual}%)`, 386, y);
    y += 30;
  });

  return canvas;
}

function criarCanvasPizzaValores(valores, titulo = "") {
  const canvas = document.createElement("canvas");
  canvas.width = 620;
  canvas.height = 380;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#064e3b";
  ctx.font = "bold 18px Arial";
  ctx.fillText(titulo, 20, 28);

  const dados = STATUS_LISTA.map(status => ({ status, valor: valores[status] || 0 }));
  const total = dados.reduce((s, d) => s + d.valor, 0);
  const cx = 185;
  const cy = 200;
  const raio = 115;
  let anguloInicial = -Math.PI / 2;

  if (total <= 0) {
    ctx.fillStyle = "#374151";
    ctx.font = "16px Arial";
    ctx.fillText("Sem dados", 135, 195);
    return canvas;
  }

  dados.forEach(item => {
    const angulo = (item.valor / total) * Math.PI * 2;
    if (angulo > 0) {
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, raio, anguloInicial, anguloInicial + angulo);
      ctx.closePath();
      ctx.fillStyle = CORES_STATUS[item.status];
      ctx.fill();
    }
    anguloInicial += angulo;
  });

  let y = 120;
  dados.forEach(item => {
    const percentual = total > 0 ? (item.valor / total * 100).toFixed(1) : "0.0";
    ctx.fillStyle = CORES_STATUS[item.status];
    ctx.fillRect(360, y - 12, 16, 16);
    ctx.fillStyle = "#111827";
    ctx.font = "14px Arial";
    ctx.fillText(`${item.status}: ${msParaTexto(item.valor)} (${percentual}%)`, 386, y);
    y += 30;
  });

  return canvas;
}


function criarCanvasPizzaResumo(resumo, titulo = "") {
  const canvas = document.createElement("canvas");
  canvas.width = 900;
  canvas.height = 520;
  const ctx = canvas.getContext("2d");

  // Fundo e moldura
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "#d1d5db";
  ctx.lineWidth = 2;
  ctx.strokeRect(12, 12, canvas.width - 24, canvas.height - 24);

  // Título
  ctx.fillStyle = "#064e3b";
  ctx.font = "bold 28px Arial";
  quebrarTextoCanvas(ctx, titulo || "Resumo", 36, 55, 420, 32);

  const dados = [
    { status: "Disponível", valor: resumo.disponiveis || 0 },
    { status: "Indisponível", valor: resumo.indisponiveis || 0 },
    { status: "Tombado (Acidente)", valor: resumo.tombados || 0 }
  ];

  const total = dados.reduce((soma, item) => soma + item.valor, 0);
  const cx = 270;
  const cy = 285;
  const raio = 155;
  let anguloInicial = -Math.PI / 2;

  if (total <= 0) {
    ctx.fillStyle = "#374151";
    ctx.font = "22px Arial";
    ctx.fillText("Sem dados", 210, 285);
    return canvas;
  }

  // Pizza
  dados.forEach(item => {
    const angulo = (item.valor / total) * Math.PI * 2;
    if (angulo > 0) {
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, raio, anguloInicial, anguloInicial + angulo);
      ctx.closePath();
      ctx.fillStyle = CORES_STATUS[item.status];
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 5;
      ctx.stroke();
    }
    anguloInicial += angulo;
  });

  // Centro com total
  ctx.beginPath();
  ctx.arc(cx, cy, 58, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.strokeStyle = "#e5e7eb";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "#064e3b";
  ctx.font = "bold 30px Arial";
  ctx.textAlign = "center";
  ctx.fillText(String(total), cx, cy - 4);
  ctx.font = "15px Arial";
  ctx.fillStyle = "#6b7280";
  ctx.fillText("total", cx, cy + 22);
  ctx.textAlign = "left";

  // Legenda com quantidade e porcentagem
  let y = 170;
  ctx.font = "bold 18px Arial";
  ctx.fillStyle = "#111827";
  ctx.fillText("Composição", 525, y - 28);

  dados.forEach(item => {
    const percentual = total > 0 ? (item.valor / total * 100).toFixed(1) : "0.0";
    const label = item.status === "Tombado (Acidente)" ? "Tombado" : item.status;

    ctx.fillStyle = CORES_STATUS[item.status];
    ctx.fillRect(525, y - 16, 22, 22);

    ctx.fillStyle = "#111827";
    ctx.font = "bold 18px Arial";
    ctx.fillText(label, 560, y);

    ctx.fillStyle = "#374151";
    ctx.font = "16px Arial";
    ctx.fillText(`${item.valor} equipamento(s) — ${percentual}%`, 560, y + 25);

    y += 74;
  });

  ctx.fillStyle = "#6b7280";
  ctx.font = "14px Arial";
  ctx.fillText("Fonte: Sistema de Controle da Irrigação", 525, 445);

  return canvas;
}

function quebrarTextoCanvas(ctx, texto, x, y, larguraMaxima, alturaLinha) {
  const palavras = String(texto || "").split(" ");
  let linha = "";
  for (let i = 0; i < palavras.length; i++) {
    const teste = linha + palavras[i] + " ";
    const medida = ctx.measureText(teste).width;
    if (medida > larguraMaxima && i > 0) {
      ctx.fillText(linha, x, y);
      linha = palavras[i] + " ";
      y += alturaLinha;
    } else {
      linha = teste;
    }
  }
  ctx.fillText(linha, x, y);
}

function adicionarCartaoIndicadorPDF(doc, x, y, titulo, valor, observacao, cor = [6, 78, 59]) {
  doc.setFillColor(245, 250, 247);
  doc.roundedRect(x, y, 62, 24, 3, 3, "F");
  doc.setDrawColor(cor[0], cor[1], cor[2]);
  doc.setLineWidth(0.5);
  doc.line(x, y, x, y + 24);
  doc.setFontSize(8);
  doc.setTextColor(90, 90, 90);
  doc.text(titulo, x + 4, y + 7);
  doc.setTextColor(cor[0], cor[1], cor[2]);
  doc.setFontSize(14);
  doc.text(String(valor), x + 4, y + 15);
  doc.setTextColor(90, 90, 90);
  doc.setFontSize(7);
  doc.text(observacao || "", x + 4, y + 21);
  doc.setTextColor(0, 0, 0);
}

function adicionarPaginaPizzasPDF(doc, tituloPagina, resumos, subtitulo = "") {
  const posicoes = [
    { x: 14, y: 42 },
    { x: 153, y: 42 },
    { x: 14, y: 119 },
    { x: 153, y: 119 }
  ];

  const grupos = [];
  for (let i = 0; i < resumos.length; i += 4) {
    grupos.push(resumos.slice(i, i + 4));
  }

  if (grupos.length === 0) {
    doc.addPage("landscape");
    adicionarCabecalhoPDF(doc, "Relatório de Auditoria Operacional", tituloPagina);
    adicionarTituloSecaoPDF(doc, "Sem registros", 14, 38);
    doc.setFontSize(9);
    doc.setTextColor(75, 85, 99);
    doc.text("Nenhum registro encontrado para esta seção.", 14, 48);
    return;
  }

  grupos.forEach((grupo, indicePagina) => {
    doc.addPage("landscape");
    const titulo = grupos.length > 1 ? `${tituloPagina} (${indicePagina + 1}/${grupos.length})` : tituloPagina;
    adicionarCabecalhoPDF(doc, "Relatório de Auditoria Operacional", titulo);

    adicionarTituloSecaoPDF(doc, tituloPagina, 14, 34);
    if (subtitulo) {
      doc.setFontSize(8);
      doc.setTextColor(75, 85, 99);
      doc.text(subtitulo, 14, 40, { maxWidth: 265 });
    }

    grupo.forEach((resumo, indice) => {
      const pos = posicoes[indice];
      doc.setDrawColor(229, 231, 235);
      doc.setFillColor(250, 252, 250);
      doc.roundedRect(pos.x - 1, pos.y - 2, 132, 72, 3, 3, "FD");
      const canvas = criarCanvasPizzaResumo(resumo, resumo.label || "Resumo");
      doc.addImage(canvas.toDataURL("image/png"), "PNG", pos.x + 1, pos.y, 128, 68);
    });
  });
}

function adicionarTituloSecaoPDF(doc, titulo, x, y) {
  doc.setTextColor(6, 78, 59);
  doc.setFontSize(12);
  doc.setFont(undefined, "bold");
  doc.text(titulo, x, y);
  doc.setFont(undefined, "normal");
  doc.setDrawColor(22, 163, 74);
  doc.setLineWidth(0.6);
  doc.line(x, y + 2, x + 78, y + 2);
  doc.setTextColor(0, 0, 0);
}

function adicionarRodapeAuditoriaPDF(doc, dataEmissao) {
  const totalPaginas = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPaginas; i++) {
    doc.setPage(i);
    doc.setDrawColor(209, 213, 219);
    doc.setLineWidth(0.2);
    doc.line(14, 200, 283, 200);
    doc.setFontSize(7);
    doc.setTextColor(107, 114, 128);
    doc.text(`Controle de Disponibilidade da Irrigação • Emitido em ${dataEmissao}`, 14, 204);
    doc.text(`Página ${i} de ${totalPaginas}`, 263, 204);
  }
  doc.setTextColor(0, 0, 0);
}

function adicionarObservacaoPDF(doc, texto, x, y, largura = 265) {
  doc.setFillColor(240, 253, 244);
  doc.setDrawColor(187, 247, 208);
  doc.roundedRect(x, y, largura, 18, 3, 3, "FD");
  doc.setFontSize(8);
  doc.setTextColor(55, 65, 81);
  doc.text(texto, x + 4, y + 7, { maxWidth: largura - 8 });
  doc.setTextColor(0, 0, 0);
}

function criarCanvasBarra(lista, titulo = "") {
  const canvas = document.createElement("canvas");
  canvas.width = 650;
  canvas.height = 380;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#064e3b";
  ctx.font = "bold 18px Arial";
  ctx.fillText(titulo, 20, 28);

  const dados = contarStatus(lista);
  const total = dados.reduce((s, d) => s + d.quantidade, 0);
  const max = Math.max(...dados.map(d => d.quantidade), 1);
  const baseY = 310;
  const largura = 120;
  const gap = 55;
  let x = 70;

  ctx.strokeStyle = "#d1d5db";
  ctx.beginPath();
  ctx.moveTo(45, baseY);
  ctx.lineTo(610, baseY);
  ctx.stroke();

  dados.forEach(item => {
    const altura = (item.quantidade / max) * 210;
    const percentual = total > 0 ? (item.quantidade / total * 100).toFixed(1) : "0.0";
    ctx.fillStyle = CORES_STATUS[item.status];
    ctx.fillRect(x, baseY - altura, largura, altura);
    ctx.fillStyle = "#111827";
    ctx.font = "bold 14px Arial";
    ctx.textAlign = "center";
    ctx.fillText(`${item.quantidade} (${percentual}%)`, x + largura / 2, baseY - altura - 8);
    ctx.font = "12px Arial";
    const label = item.status === "Tombado (Acidente)" ? "Tombado" : item.status;
    ctx.fillText(label, x + largura / 2, baseY + 24);
    ctx.textAlign = "left";
    x += largura + gap;
  });

  return canvas;
}

function criarCanvasBarrasEmpilhadas(resumos, titulo = "") {
  const alturaLinha = 34;
  const altura = Math.max(260, 80 + resumos.length * alturaLinha);
  const canvas = document.createElement("canvas");
  canvas.width = 950;
  canvas.height = altura;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#064e3b";
  ctx.font = "bold 18px Arial";
  ctx.fillText(titulo, 20, 28);

  const xLabel = 20;
  const xBarra = 250;
  const larguraBarra = 430;
  let y = 70;

  resumos.forEach(item => {
    const total = item.total || 0;
    const dispPct = total > 0 ? item.disponiveis / total : 0;
    const indPct = total > 0 ? item.indisponiveis / total : 0;
    const tombPct = total > 0 ? item.tombados / total : 0;

    ctx.fillStyle = "#111827";
    ctx.font = "12px Arial";
    const label = item.label.length > 30 ? item.label.slice(0, 29) + "…" : item.label;
    ctx.fillText(label, xLabel, y + 12);

    ctx.fillStyle = "#e5e7eb";
    ctx.fillRect(xBarra, y, larguraBarra, 18);

    let xAtual = xBarra;
    ctx.fillStyle = CORES_STATUS["Disponível"];
    ctx.fillRect(xAtual, y, larguraBarra * dispPct, 18);
    xAtual += larguraBarra * dispPct;
    ctx.fillStyle = CORES_STATUS["Indisponível"];
    ctx.fillRect(xAtual, y, larguraBarra * indPct, 18);
    xAtual += larguraBarra * indPct;
    ctx.fillStyle = CORES_STATUS["Tombado (Acidente)"];
    ctx.fillRect(xAtual, y, larguraBarra * tombPct, 18);

    ctx.fillStyle = "#111827";
    ctx.font = "12px Arial";
    const disponibilidade = total > 0 ? (item.disponiveis / total * 100).toFixed(1) : "0.0";
    ctx.fillText(`Total: ${total} | Disp.: ${item.disponiveis} (${disponibilidade}%) | Indisp.: ${item.indisponiveis} | Tomb.: ${item.tombados}`, xBarra + larguraBarra + 15, y + 12);
    y += alturaLinha;
  });

  return canvas;
}

function resumosPorCategoria() {
  const lista = listaEquipamentosNormalizada();
  return CATEGORIAS.map(categoria => {
    const itens = lista.filter(eq => eq.categoria_normalizada === categoria);
    const r = calcularResumo(itens);
    return { label: categoria === "Trator" ? "Trator Nonino" : categoria, ...r };
  });
}

function tipoParaRelatorio(eq) {
  const categoria = eq.categoria_normalizada || eq.categoria || "";
  const tipoOriginal = eq.tipo_normalizado || eq.tipo || "Não informado";
  const chave = chaveTexto(tipoOriginal);

  // Apenas no relatório: todo trator será agrupado como Trator Nonino
  if (categoria === "Trator") {
    return "Trator Nonino";
  }

  // Apenas no relatório: apoio será agrupado em 3 grupos
  if (categoria === "Apoio") {
    if (chave.includes("hidro roll") || chave.includes("hidroroll")) {
      return "Hidro Roll";
    }

    if (
      chave.includes("motobomba") ||
      chave.includes("moto bomba")
    ) {
      return "MotoBomba";
    }

    return "Apoio";
  }

  // Caminhão e Tanque continuam usando o tipo preenchido/padronizado
  return tipoOriginal;
}

function resumosPorTipo() {
  const lista = listaEquipamentosNormalizada();
  const grupos = {};

  lista.forEach(eq => {
    const tipoRelatorio = tipoParaRelatorio(eq);
    const chave = `${eq.categoria_normalizada}||${tipoRelatorio}`;

    if (!grupos[chave]) grupos[chave] = [];
    grupos[chave].push(eq);
  });

  return Object.keys(grupos).sort().map(chave => {
    const [categoria, tipo] = chave.split("||");
    const r = calcularResumo(grupos[chave]);
    return { label: `${categoria} - ${tipo}`, categoria, tipo, ...r };
  });
}

function adicionarCabecalhoPDF(doc, titulo, subtitulo) {
  doc.setFillColor(6, 78, 59);
  doc.rect(0, 0, 297, 24, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(15);
  doc.text(titulo, 14, 10);
  doc.setFontSize(9);
  doc.text(subtitulo, 14, 17);
  doc.setTextColor(0, 0, 0);
}

function pct(valor, total) {
  return total > 0 ? `${(valor / total * 100).toFixed(1)}%` : "0.0%";
}

function tabelaResumoCategoria() {
  return resumosPorCategoria().map(r => [
    r.label,
    r.total,
    r.disponiveis,
    pct(r.disponiveis, r.total),
    r.indisponiveis,
    pct(r.indisponiveis, r.total),
    r.tombados,
    pct(r.tombados, r.total)
  ]);
}

function tabelaResumoTipo() {
  return resumosPorTipo().map(r => [
    r.categoria,
    r.tipo,
    r.total,
    r.disponiveis,
    pct(r.disponiveis, r.total),
    r.indisponiveis,
    pct(r.indisponiveis, r.total),
    r.tombados,
    pct(r.tombados, r.total)
  ]);
}

function exportarPDFGerencial() {
  const lista = listaEquipamentosNormalizada();
  if (lista.length === 0) return alert("Nenhum equipamento para exportar.");

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const resumo = calcularResumo(lista);

  adicionarCabecalhoPDF(doc, "Relatório Gerencial de Disponibilidade da Irrigação", `Gerado em ${new Date().toLocaleString("pt-BR")}`);

  doc.setFontSize(11);
  doc.text(`Total: ${resumo.total}`, 14, 35);
  doc.text(`Disponíveis: ${resumo.disponiveis} (${pct(resumo.disponiveis, resumo.total)})`, 14, 42);
  doc.text(`Indisponíveis: ${resumo.indisponiveis} (${pct(resumo.indisponiveis, resumo.total)})`, 14, 49);
  doc.text(`Tombados (Acidente): ${resumo.tombados} (${pct(resumo.tombados, resumo.total)})`, 14, 56);
  doc.text(`Disponibilidade geral: ${resumo.disponibilidade.toFixed(1)}%`, 14, 63);

  const pizza = criarCanvasPizza(lista, "Distribuição geral por status");
  const barra = criarCanvasBarra(lista, "Quantidade por status");
  doc.addImage(pizza.toDataURL("image/png"), "PNG", 88, 30, 90, 60);
  doc.addImage(barra.toDataURL("image/png"), "PNG", 184, 30, 98, 60);

  doc.autoTable({
    head: [["Categoria", "Total", "Disp.", "% Disp.", "Indisp.", "% Indisp.", "Tomb.", "% Tomb."]],
    body: tabelaResumoCategoria(),
    startY: 98,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [6, 78, 59] }
  });

  const indisponiveis = lista.filter(eq => eq.status_normalizado !== "Disponível").map(eq => [
    eq.frota || "", eq.categoria_normalizada, eq.tipo_normalizado, eq.status_normalizado, eq.problema || "", eq.ordem_servico || "", eq.previsao || "", eq.responsavel || ""
  ]);

  doc.autoTable({
    head: [["Frota", "Categoria", "Tipo", "Status", "Problema", "OS", "Previsão", "Responsável"]],
    body: indisponiveis.length ? indisponiveis : [["-", "-", "-", "Nenhum equipamento indisponível", "-", "-", "-", "-"]],
    startY: doc.lastAutoTable.finalY + 10,
    styles: { fontSize: 7 },
    headStyles: { fillColor: [6, 78, 59] }
  });

  doc.save(`relatorio_gerencial_irrigacao_${new Date().toISOString().slice(0, 10)}.pdf`);
}

async function exportarPDFAuditoria() {
  const lista = listaEquipamentosNormalizada();
  if (lista.length === 0) return alert("Nenhum equipamento para exportar.");

  // Tenta carregar o histórico mais recente para que o PDF de auditoria não dependa da aba Histórico estar aberta.
  let historicoAuditoria = historico || [];
  try {
    const { data } = await supabaseClient
      .from("historico")
      .select("*")
      .order("data_hora", { ascending: false })
      .limit(500);
    historicoAuditoria = data || historicoAuditoria;
  } catch (e) {
    console.warn("Não foi possível atualizar o histórico antes do PDF:", e);
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const resumo = calcularResumo(lista);
  const dataEmissao = new Date().toLocaleString("pt-BR");
  const dataArquivo = new Date().toISOString().slice(0, 10);
  const categorias = resumosPorCategoria();
  const tipos = resumosPorTipo();

  const indisponiveis = lista.filter(eq => eq.status_normalizado !== "Disponível");
  const tiposCriticos = tipos
    .filter(t => t.total > 0)
    .sort((a, b) => a.disponibilidade - b.disponibilidade)
    .slice(0, 8);

  // PÁGINA 1 — CAPA EXECUTIVA
  adicionarCabecalhoPDF(doc, "Relatório de Auditoria Operacional", "Controle de Disponibilidade da Irrigação");

  doc.setFillColor(240, 253, 244);
  doc.roundedRect(14, 34, 269, 42, 4, 4, "F");
  doc.setDrawColor(187, 247, 208);
  doc.roundedRect(14, 34, 269, 42, 4, 4, "S");

  doc.setFontSize(18);
  doc.setTextColor(6, 78, 59);
  doc.setFont(undefined, "bold");
  doc.text("Relatório de Auditoria Operacional", 22, 49);
  doc.setFont(undefined, "normal");
  doc.setFontSize(10);
  doc.setTextColor(55, 65, 81);
  doc.text("Controle automotivo dos equipamentos da irrigação, transporte e aplicação de vinhaça", 22, 58);
  doc.text(`Data de emissão: ${dataEmissao}`, 22, 67);
  doc.text("Fonte: Sistema de Controle da Irrigação", 190, 67);

  adicionarCartaoIndicadorPDF(doc, 14, 86, "Total geral", resumo.total, "equipamentos cadastrados", [6, 78, 59]);
  adicionarCartaoIndicadorPDF(doc, 80, 86, "Disponíveis", resumo.disponiveis, pct(resumo.disponiveis, resumo.total), [22, 163, 74]);
  adicionarCartaoIndicadorPDF(doc, 146, 86, "Indisponíveis", resumo.indisponiveis, pct(resumo.indisponiveis, resumo.total), [220, 38, 38]);
  adicionarCartaoIndicadorPDF(doc, 212, 86, "Tombados", resumo.tombados, pct(resumo.tombados, resumo.total), [55, 65, 81]);

  adicionarTituloSecaoPDF(doc, "Resumo executivo", 14, 124);
  doc.setFontSize(9);
  doc.setTextColor(55, 65, 81);
  doc.text(`Foram analisados ${resumo.total} equipamento(s) cadastrados no sistema. A disponibilidade geral apurada foi de ${resumo.disponibilidade.toFixed(1)}%.`, 14, 135, { maxWidth: 128 });
  doc.text(`No momento da emissão, existem ${indisponiveis.length} equipamento(s) fora da condição disponível, incluindo indisponíveis e tombados/acidente.`, 14, 144, { maxWidth: 128 });
  doc.text("Este documento consolida indicadores, gráficos, tabelas e histórico de alterações para apoio à rastreabilidade operacional e auditoria.", 14, 153, { maxWidth: 128 });

  const pizzaCapa = criarCanvasPizzaResumo({ label: "Geral", ...resumo }, "Disponibilidade geral");
  doc.addImage(pizzaCapa.toDataURL("image/png"), "PNG", 150, 120, 128, 74);

  // PÁGINA 2 — GRÁFICO GERAL E LEITURA DE AUDITORIA
  doc.addPage("landscape");
  adicionarCabecalhoPDF(doc, "Relatório de Auditoria Operacional", "Visão geral de disponibilidade");
  adicionarTituloSecaoPDF(doc, "1. Gráfico geral de disponibilidade", 14, 36);

  const pizzaGeral = criarCanvasPizzaResumo({ label: "Geral", ...resumo }, "Distribuição geral");
  doc.addImage(pizzaGeral.toDataURL("image/png"), "PNG", 14, 46, 138, 80);

  doc.setFillColor(250, 252, 250);
  doc.setDrawColor(229, 231, 235);
  doc.roundedRect(166, 46, 116, 80, 3, 3, "FD");
  doc.setFontSize(11);
  doc.setTextColor(6, 78, 59);
  doc.setFont(undefined, "bold");
  doc.text("Leitura rápida", 174, 58);
  doc.setFont(undefined, "normal");
  doc.setFontSize(9);
  doc.setTextColor(55, 65, 81);
  doc.text(`Disponíveis: ${resumo.disponiveis} (${pct(resumo.disponiveis, resumo.total)})`, 174, 70);
  doc.text(`Indisponíveis: ${resumo.indisponiveis} (${pct(resumo.indisponiveis, resumo.total)})`, 174, 80);
  doc.text(`Tombados/acidente: ${resumo.tombados} (${pct(resumo.tombados, resumo.total)})`, 174, 90);
  doc.text(`Disponibilidade geral: ${resumo.disponibilidade.toFixed(1)}%`, 174, 104);
  doc.text("Critério: Disponível representa equipamento apto para operação. Indisponível e tombado representam frota fora de disponibilidade operacional.", 174, 116, { maxWidth: 98 });

  adicionarTituloSecaoPDF(doc, "2. Resumo por categoria", 14, 142);
  doc.autoTable({
    head: [["Categoria", "Total", "Disponível", "% Disp.", "Indisponível", "% Indisp.", "Tombado", "% Tomb."]],
    body: tabelaResumoCategoria(),
    startY: 148,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [6, 78, 59], textColor: [255, 255, 255] },
    alternateRowStyles: { fillColor: [245, 250, 247] },
    margin: { left: 14, right: 14 }
  });

  // PÁGINAS DE PIZZA POR CATEGORIA
  adicionarPaginaPizzasPDF(
    doc,
    "3. Gráficos de pizza por categoria",
    categorias,
    "Cada gráfico mostra quantidade e percentual de Disponível, Indisponível e Tombado dentro da respectiva categoria."
  );

  // PÁGINAS DE PIZZA POR TIPO
  adicionarPaginaPizzasPDF(
    doc,
    "4. Gráficos de pizza por tipo de equipamento",
    tipos,
    "Os tipos são padronizados automaticamente para reduzir duplicidade por diferença de escrita, acento ou letras maiúsculas/minúsculas."
  );

  // PÁGINA — TABELA POR TIPO + PONTOS DE ATENÇÃO
  doc.addPage("landscape");
  adicionarCabecalhoPDF(doc, "Relatório de Auditoria Operacional", "Consolidação por tipo e pontos de atenção");
  adicionarTituloSecaoPDF(doc, "5. Disponibilidade por tipo de equipamento", 14, 34);

  doc.autoTable({
    head: [["Categoria", "Tipo", "Total", "Disp.", "% Disp.", "Indisp.", "% Indisp.", "Tomb.", "% Tomb."]],
    body: tabelaResumoTipo(),
    startY: 40,
    styles: { fontSize: 7, cellPadding: 1.7 },
    headStyles: { fillColor: [6, 78, 59], textColor: [255, 255, 255] },
    alternateRowStyles: { fillColor: [245, 250, 247] },
    margin: { left: 14, right: 14 }
  });

  const yCritico = Math.min((doc.lastAutoTable?.finalY || 40) + 10, 145);
  adicionarTituloSecaoPDF(doc, "6. Tipos com menor disponibilidade", 14, yCritico);
  const corpoCritico = tiposCriticos.map(t => [
    t.categoria,
    t.tipo,
    t.total,
    `${t.disponibilidade.toFixed(1)}%`,
    t.indisponiveis,
    t.tombados
  ]);
  doc.autoTable({
    head: [["Categoria", "Tipo", "Total", "Disponibilidade", "Indisp.", "Tomb."]],
    body: corpoCritico.length ? corpoCritico : [["-", "Sem dados críticos", "-", "-", "-", "-"]],
    startY: yCritico + 6,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [220, 38, 38], textColor: [255, 255, 255] },
    alternateRowStyles: { fillColor: [254, 242, 242] },
    margin: { left: 14, right: 14 }
  });

  // PÁGINA — EQUIPAMENTOS INDISPONÍVEIS/TOMBADOS
  doc.addPage("landscape");
  adicionarCabecalhoPDF(doc, "Relatório de Auditoria Operacional", "Equipamentos indisponíveis e tombados");
  adicionarTituloSecaoPDF(doc, "7. Descrição dos Equipamentos Indisponíveis e Tombados", 14, 34);
  adicionarObservacaoPDF(doc, "Esta seção lista os equipamentos com status Indisponível ou Tombado (Acidente), incluindo problema, OS, previsão e responsável pela atualização.", 14, 40);

  const indisponiveisTabela = indisponiveis.map(eq => [
    eq.frota || "",
    eq.categoria_normalizada,
    eq.tipo_normalizado,
    eq.status_normalizado,
    eq.problema || "",
    eq.ordem_servico || "",
    eq.previsao || "",
    eq.responsavel || ""
  ]);

  doc.autoTable({
    head: [["Frota", "Categoria", "Tipo", "Status", "Problema", "OS", "Previsão", "Responsável"]],
    body: indisponiveisTabela.length ? indisponiveisTabela : [["-", "-", "-", "Nenhum equipamento fora de disponibilidade", "-", "-", "-", "-"]],
    startY: 66,
    styles: { fontSize: 7, cellPadding: 1.7 },
    headStyles: { fillColor: [6, 78, 59], textColor: [255, 255, 255] },
    alternateRowStyles: { fillColor: [245, 250, 247] },
    margin: { left: 14, right: 14 }
  });

  // PÁGINA — CONCLUSÃO
  doc.addPage("landscape");
  adicionarCabecalhoPDF(doc, "Relatório de Auditoria Operacional", "Conclusão automática");
  adicionarTituloSecaoPDF(doc, "8. Conclusão", 14, 38);

  doc.setFillColor(250, 252, 250);
  doc.setDrawColor(229, 231, 235);
  doc.roundedRect(14, 48, 269, 90, 4, 4, "FD");
  doc.setFontSize(9);
  doc.setTextColor(55, 65, 81);
  doc.text(`No momento da emissão, foram avaliados ${resumo.total} equipamento(s) cadastrados no sistema.`, 22, 62, { maxWidth: 250 });
  doc.text(`A disponibilidade geral apurada foi de ${resumo.disponibilidade.toFixed(1)}%, com ${resumo.disponiveis} equipamento(s) disponível(is).`, 22, 74, { maxWidth: 250 });
  doc.text(`Foram identificados ${resumo.indisponiveis} equipamento(s) indisponível(is) e ${resumo.tombados} equipamento(s) tombado(s)/acidente.`, 22, 86, { maxWidth: 250 });
  doc.text("O relatório apresenta rastreabilidade por frota, categoria, tipo de equipamento, status, responsável e data/hora de atualização.", 22, 98, { maxWidth: 250 });
  doc.text("Recomenda-se arquivar este documento junto aos controles operacionais da irrigação para acompanhamento, tomada de decisão e auditoria.", 22, 110, { maxWidth: 250 });

  doc.setFillColor(240, 253, 244);
  doc.setDrawColor(187, 247, 208);
  doc.roundedRect(14, 150, 269, 24, 4, 4, "FD");
  doc.setFontSize(8);
  doc.setTextColor(6, 78, 59);
  doc.text("Documento gerado no Sistema de Controle da Irrigação. Os dados refletem os registros existentes no momento da emissão.", 22, 164, { maxWidth: 250 });

  adicionarRodapeAuditoriaPDF(doc, dataEmissao);
  doc.save(`relatorio_auditoria_irrigacao_${dataArquivo}.pdf`);
}
function renderizarHistoricoGeral() {
  const tbody = document.getElementById("tabelaHistorico");
  if (!tbody) return;

  const filtroFrota = document.getElementById("filtroHistoricoFrota")?.value.toLowerCase() || "";
  const filtroStatus = document.getElementById("filtroHistoricoStatus")?.value || "";
  const filtroResponsavel = document.getElementById("filtroHistoricoResponsavel")?.value.toLowerCase() || "";

  const lista = historico.filter(item => {
    const frota = String(item.frota || "").toLowerCase();
    const responsavel = String(item.responsavel || "").toLowerCase();
    const statusNovo = normalizarStatus(item.status_novo);
    return frota.includes(filtroFrota) && responsavel.includes(filtroResponsavel) && (!filtroStatus || statusNovo === filtroStatus);
  });

  tbody.innerHTML = "";
  if (lista.length === 0) {
    tbody.innerHTML = `<tr><td colspan="11">Nenhuma alteração encontrada.</td></tr>`;
    return;
  }

  lista.forEach(item => {
    tbody.innerHTML += `
      <tr>
        <td>${formatarData(item.data_hora)}</td>
        <td><strong>${escaparHTML(item.frota)}</strong></td>
        <td>${badgeStatus(item.status_anterior)}</td>
        <td>${badgeStatus(item.status_novo)}</td>
        <td>${escaparHTML(item.problema_anterior)}</td>
        <td>${escaparHTML(item.problema_novo)}</td>
        <td>${escaparHTML(item.os_anterior)}</td>
        <td>${escaparHTML(item.os_novo)}</td>
        <td>${escaparHTML(item.previsao_anterior)}</td>
        <td>${escaparHTML(item.previsao_novo)}</td>
        <td>${escaparHTML(item.responsavel)}</td>
      </tr>
    `;
  });
}

function obterHistoricoFiltradoPorPeriodo(frota, dataInicial, dataFinal) {
  const inicio = new Date(`${dataInicial}T00:00:00`);
  const fim = new Date(`${dataFinal}T23:59:59`);

  const todos = historico
    .filter(h => String(h.frota) === String(frota))
    .sort((a, b) => new Date(a.data_hora) - new Date(b.data_hora));

  const dentro = todos.filter(h => {
    const d = new Date(h.data_hora);
    return d >= inicio && d <= fim;
  });

  return { inicio, fim, todos, dentro };
}

function calcularDisponibilidadePeriodo(frota, dataInicial, dataFinal) {
  const equipamento = listaEquipamentosNormalizada().find(eq => String(eq.frota) === String(frota));
  const { inicio, fim, todos, dentro } = obterHistoricoFiltradoPorPeriodo(frota, dataInicial, dataFinal);

  let statusAtual = equipamento ? equipamento.status_normalizado : "Disponível";

  const anteriores = todos.filter(h => new Date(h.data_hora) < inicio);
  if (anteriores.length > 0) {
    statusAtual = normalizarStatus(anteriores[anteriores.length - 1].status_novo);
  } else if (dentro.length > 0) {
    const anterior = normalizarStatus(dentro[0].status_anterior);
    statusAtual = STATUS_LISTA.includes(anterior) ? anterior : normalizarStatus(dentro[0].status_novo);
  }

  const tempos = {
    "Disponível": 0,
    "Indisponível": 0,
    "Tombado (Acidente)": 0
  };

  let cursor = inicio;
  dentro.forEach(evento => {
    const dataEvento = new Date(evento.data_hora);
    if (dataEvento > cursor) {
      tempos[statusSeguro(statusAtual)] += dataEvento - cursor;
    }
    statusAtual = statusSeguro(evento.status_novo, statusAtual);
    cursor = dataEvento;
  });

  if (fim > cursor) tempos[statusSeguro(statusAtual)] += fim - cursor;

  const totalMs = Object.values(tempos).reduce((s, v) => s + v, 0);
  const disponibilidade = totalMs > 0 ? tempos["Disponível"] / totalMs * 100 : 0;
  const indisponibilidade = totalMs > 0 ? (tempos["Indisponível"] + tempos["Tombado (Acidente)"]) / totalMs * 100 : 0;

  return { equipamento, eventos: dentro, tempos, totalMs, disponibilidade, indisponibilidade, inicio, fim };
}

function msParaTexto(ms) {
  const horas = ms / (1000 * 60 * 60);
  if (horas < 24) return `${horas.toFixed(1)} h`;
  return `${(horas / 24).toFixed(1)} dias`;
}

function consultarHistoricoFrota() {
  const frota = document.getElementById("histFrota").value;
  const dataInicial = document.getElementById("histDataInicial").value;
  const dataFinal = document.getElementById("histDataFinal").value;

  if (!frota || !dataInicial || !dataFinal) {
    alert("Selecione frota, data inicial e data final.");
    return;
  }

  const resultado = calcularDisponibilidadePeriodo(frota, dataInicial, dataFinal);
  ultimaConsultaHistorico = { frota, dataInicial, dataFinal, ...resultado, resumo: resultado };

  document.getElementById("resultadoHistoricoFrota").classList.remove("oculto");
  document.getElementById("histCardFrota").innerText = frota;
  document.getElementById("histCardDisponibilidade").innerText = `${resultado.disponibilidade.toFixed(1)}%`;
  document.getElementById("histCardIndisponibilidade").innerText = `${resultado.indisponibilidade.toFixed(1)}%`;
  document.getElementById("histCardAlteracoes").innerText = resultado.eventos.length;

  const eq = resultado.equipamento;
  document.getElementById("histResumoEquipamento").innerHTML = eq ? `
    <p><strong>Categoria:</strong> ${escaparHTML(eq.categoria_normalizada)}</p>
    <p><strong>Tipo:</strong> ${escaparHTML(eq.tipo_normalizado)}</p>
    <p><strong>Status atual:</strong> ${badgeStatus(eq.status_normalizado)}</p>
    <p><strong>Última atualização:</strong> ${formatarData(eq.ultima_atualizacao)}</p>
    <p><strong>Tempo disponível:</strong> ${msParaTexto(resultado.tempos["Disponível"])}</p>
    <p><strong>Tempo indisponível:</strong> ${msParaTexto(resultado.tempos["Indisponível"])}</p>
    <p><strong>Tempo tombado:</strong> ${msParaTexto(resultado.tempos["Tombado (Acidente)"])}</p>
  ` : `<p>Equipamento não encontrado no cadastro atual.</p>`;

  const tbody = document.getElementById("tabelaHistoricoFrota");
  tbody.innerHTML = "";
  if (resultado.eventos.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10">Nenhuma alteração encontrada para essa frota no período.</td></tr>`;
  } else {
    resultado.eventos.forEach(item => {
      tbody.innerHTML += `
        <tr>
          <td>${formatarData(item.data_hora)}</td>
          <td>${badgeStatus(item.status_anterior)}</td>
          <td>${badgeStatus(item.status_novo)}</td>
          <td>${escaparHTML(item.problema_anterior)}</td>
          <td>${escaparHTML(item.problema_novo)}</td>
          <td>${escaparHTML(item.os_anterior)}</td>
          <td>${escaparHTML(item.os_novo)}</td>
          <td>${escaparHTML(item.previsao_anterior)}</td>
          <td>${escaparHTML(item.previsao_novo)}</td>
          <td>${escaparHTML(item.responsavel)}</td>
        </tr>
      `;
    });
  }

  desenharPizzaHistoricoPeriodo(resultado);
}

function desenharPizzaHistoricoPeriodo(resultado) {
  const canvas = document.getElementById("histPizzaPeriodo");
  if (!canvas || !resultado) return;
  destruirGrafico("histPizzaPeriodo");
  const total = resultado.totalMs || 1;
  const dados = STATUS_LISTA.map(status => ({ status, valor: resultado.tempos[status] || 0 })).filter(d => d.valor > 0);

  graficos["histPizzaPeriodo"] = new Chart(canvas, {
    type: "pie",
    data: {
      labels: dados.map(d => {
        const percentual = total > 0 ? (d.valor / total * 100).toFixed(1) : "0.0";
        return `${d.status}: ${msParaTexto(d.valor)} (${percentual}%)`;
      }),
      datasets: [{ data: dados.map(d => d.valor), backgroundColor: dados.map(d => CORES_STATUS[d.status]) }]
    },
    options: opcoesPizza()
  });

  document.getElementById("histInfoPeriodo").innerText = `Período: ${formatarDataCurta(resultado.inicio)} a ${formatarDataCurta(resultado.fim)} | Baseado no tempo em cada status`;
}

function obterParametrosHistoricoRelatorio() {
  const frota = document.getElementById("relFrotaHistorico")?.value || document.getElementById("histFrota")?.value;
  const dataInicial = document.getElementById("relDataInicial")?.value || document.getElementById("histDataInicial")?.value;
  const dataFinal = document.getElementById("relDataFinal")?.value || document.getElementById("histDataFinal")?.value;
  return { frota, dataInicial, dataFinal };
}

function exportarPDFHistoricoFrota() {
  const { frota, dataInicial, dataFinal } = obterParametrosHistoricoRelatorio();
  if (!frota || !dataInicial || !dataFinal) return alert("Selecione frota, data inicial e data final.");

  const resultado = calcularDisponibilidadePeriodo(frota, dataInicial, dataFinal);
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const eq = resultado.equipamento;

  adicionarCabecalhoPDF(doc, `Histórico da Frota ${frota}`, `Período: ${dataInicial} a ${dataFinal}`);
  doc.setFontSize(10);
  doc.text(`Categoria: ${eq ? eq.categoria_normalizada : "-"}`, 14, 35);
  doc.text(`Tipo: ${eq ? eq.tipo_normalizado : "-"}`, 14, 42);
  doc.text(`Status atual: ${eq ? eq.status_normalizado : "-"}`, 14, 49);
  doc.text(`Disponibilidade no período: ${resultado.disponibilidade.toFixed(1)}%`, 14, 56);
  doc.text(`Indisponibilidade no período: ${resultado.indisponibilidade.toFixed(1)}%`, 14, 63);
  doc.text(`Quantidade de alterações: ${resultado.eventos.length}`, 14, 70);

  const pizza = criarCanvasPizzaValores(resultado.tempos, "Disponibilidade por período");
  doc.addImage(pizza.toDataURL("image/png"), "PNG", 160, 30, 95, 65);

  const linhas = resultado.eventos.map(item => [
    formatarData(item.data_hora), normalizarStatus(item.status_anterior), normalizarStatus(item.status_novo), item.problema_novo || "", item.os_novo || "", item.previsao_novo || "", item.responsavel || ""
  ]);

  doc.autoTable({
    head: [["Data/Hora", "Status anterior", "Status novo", "Problema", "OS", "Previsão", "Responsável"]],
    body: linhas.length ? linhas : [["-", "-", "-", "Nenhuma alteração no período", "-", "-", "-"]],
    startY: 102,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [6, 78, 59] }
  });

  doc.save(`historico_frota_${frota}_${dataInicial}_a_${dataFinal}.pdf`);
}

function exportarExcelHistoricoFrota() {
  const { frota, dataInicial, dataFinal } = obterParametrosHistoricoRelatorio();
  if (!frota || !dataInicial || !dataFinal) return alert("Selecione frota, data inicial e data final.");

  const resultado = calcularDisponibilidadePeriodo(frota, dataInicial, dataFinal);
  const dados = resultado.eventos.map(item => ({
    "Data/Hora": formatarData(item.data_hora),
    Frota: item.frota,
    "Status anterior": normalizarStatus(item.status_anterior),
    "Status novo": normalizarStatus(item.status_novo),
    "Problema anterior": item.problema_anterior || "",
    "Problema novo": item.problema_novo || "",
    "OS anterior": item.os_anterior || "",
    "OS nova": item.os_novo || "",
    "Previsão anterior": item.previsao_anterior || "",
    "Previsão nova": item.previsao_novo || "",
    Responsável: item.responsavel || ""
  }));

  const resumo = [{
    Frota: frota,
    "Data inicial": dataInicial,
    "Data final": dataFinal,
    "Disponibilidade %": resultado.disponibilidade.toFixed(1),
    "Indisponibilidade %": resultado.indisponibilidade.toFixed(1),
    "Alterações": resultado.eventos.length,
    "Tempo disponível": msParaTexto(resultado.tempos["Disponível"]),
    "Tempo indisponível": msParaTexto(resultado.tempos["Indisponível"]),
    "Tempo tombado": msParaTexto(resultado.tempos["Tombado (Acidente)"])
  }];

  const arquivo = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(arquivo, XLSX.utils.json_to_sheet(resumo), "Resumo");
  XLSX.utils.book_append_sheet(arquivo, XLSX.utils.json_to_sheet(dados), "Histórico");
  XLSX.writeFile(arquivo, `historico_frota_${frota}_${dataInicial}_a_${dataFinal}.xlsx`);
}

document.addEventListener("DOMContentLoaded", async () => {
  aplicarTemaSalvo();
  ajustarCamposFormulario();
  await carregarEquipamentos();
  await carregarHistorico();
});

function normalizarTextoComparacao(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['´`]/g, "")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizarTextoRelatorio(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['´`]/g, "")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
