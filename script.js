let equipamentos = [];
let historico = [];
let paradasEquipamento = [];
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
  await carregarParadasEquipamento();
  atualizarDashboard();
  renderizarTabelaEquipamentos();
  carregarSugestoesFrotasHistorico();
  preencherSelectsFrota();
  setTimeout(desenharGraficosDashboard, 100);
}


async function carregarParadasEquipamento() {
  const { data, error } = await supabaseClient
    .from("paradas_equipamento")
    .select("*")
    .order("data_hora_parada", { ascending: false });

  if (error) {
    console.warn("Não foi possível carregar paradas:", error.message);
    paradasEquipamento = [];
    return;
  }

  paradasEquipamento = data || [];
}

function dataHoraLocalPadrao(data = new Date()) {
  const ajuste = new Date(data.getTime() - data.getTimezoneOffset() * 60000);
  return ajuste.toISOString().slice(0, 16);
}

function datetimeLocalParaISO(valor) {
  if (!valor) return null;
  return new Date(valor).toISOString();
}

function buscarParadaAberta(frota) {
  return paradasEquipamento
    .filter(p =>
      String(p.frota) === String(frota) &&
      !p.data_hora_liberacao
    )
    .sort((a, b) => new Date(b.data_hora_parada) - new Date(a.data_hora_parada))[0] || null;
}

function abrirFormularioParada(id) {
  const eq = equipamentos.find(item => item.id === id);
  if (!eq) return;

  fecharFormularioLiberacao();

  document.getElementById("paradaEquipamentoId").value = eq.id;
  document.getElementById("paradaFrota").value = eq.frota || "";
  document.getElementById("paradaStatus").value = normalizarStatus(eq.status) === "Tombado (Acidente)"
    ? "Tombado (Acidente)"
    : "Indisponível";
  document.getElementById("paradaDataHora").value = dataHoraLocalPadrao();
  document.getElementById("paradaDataHoraLiberacao").value = "";
  document.getElementById("paradaProblema").value = eq.problema || "";
  document.getElementById("paradaOS").value = eq.ordem_servico || "";
  document.getElementById("paradaPrevisao").value = eq.previsao || "";
  document.getElementById("paradaResponsavel").value = eq.responsavel || "";
  document.getElementById("paradaResponsavelLiberacao").value = "";
  document.getElementById("paradaObservacaoLiberacao").value = "";

  document.getElementById("painelParadaEquipamento").classList.remove("campo-oculto");
  document.getElementById("painelParadaEquipamento").scrollIntoView({ behavior: "smooth", block: "start" });
}

function fecharFormularioParada() {
  const painel = document.getElementById("painelParadaEquipamento");
  if (painel) painel.classList.add("campo-oculto");
}

function abrirFormularioLiberacao(id) {
  const eq = equipamentos.find(item => item.id === id);
  if (!eq) return;

  fecharFormularioParada();

  const aberta = buscarParadaAberta(eq.frota);
  if (!aberta && normalizarStatus(eq.status) === "Disponível") {
    const continuar = confirm("Não encontrei parada aberta para esta frota. Deseja registrar apenas a liberação/status disponível?");
    if (!continuar) return;
  }

  document.getElementById("liberacaoEquipamentoId").value = eq.id;
  document.getElementById("liberacaoFrota").value = eq.frota || "";
  document.getElementById("liberacaoDataHora").value = dataHoraLocalPadrao();
  document.getElementById("liberacaoResponsavel").value = eq.responsavel || "";
  document.getElementById("liberacaoObservacao").value = "";

  document.getElementById("painelLiberacaoEquipamento").classList.remove("campo-oculto");
  document.getElementById("painelLiberacaoEquipamento").scrollIntoView({ behavior: "smooth", block: "start" });
}

function fecharFormularioLiberacao() {
  const painel = document.getElementById("painelLiberacaoEquipamento");
  if (painel) painel.classList.add("campo-oculto");
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

async function registrarHistoricoCompleto(equipamentoAntigo, dadosNovos, observacao, dataHora = new Date().toISOString()) {
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
      data_hora: dataHora
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


async function salvarParadaEquipamento() {
  const id = document.getElementById("paradaEquipamentoId").value;
  const equipamento = equipamentos.find(eq => String(eq.id) === String(id));

  if (!equipamento) {
    alert("Equipamento não encontrado.");
    return;
  }

  const statusParada = statusSeguro(document.getElementById("paradaStatus").value, "Indisponível");
  const dataHoraParada = document.getElementById("paradaDataHora").value;
  const dataHoraLiberacao = document.getElementById("paradaDataHoraLiberacao").value;
  const problema = document.getElementById("paradaProblema").value.trim();
  const ordemServico = document.getElementById("paradaOS").value.trim();
  const previsao = document.getElementById("paradaPrevisao").value.trim();
  const responsavelParada = document.getElementById("paradaResponsavel").value.trim();
  const responsavelLiberacao = document.getElementById("paradaResponsavelLiberacao").value.trim();
  const observacaoLiberacao = document.getElementById("paradaObservacaoLiberacao").value.trim();

  if (!dataHoraParada || !responsavelParada) {
    alert("Informe a data/hora da parada e o responsável pela parada.");
    return;
  }

  if (!problema && statusParada !== "Tombado (Acidente)") {
    const continuar = confirm("A parada está sem problema/observação. Deseja continuar?");
    if (!continuar) return;
  }

  const paradaISO = datetimeLocalParaISO(dataHoraParada);
  const liberacaoISO = datetimeLocalParaISO(dataHoraLiberacao);

  if (liberacaoISO && new Date(liberacaoISO) < new Date(paradaISO)) {
    alert("A data/hora de liberação não pode ser anterior à data/hora da parada.");
    return;
  }

  const parada = {
    equipamento_id: equipamento.id,
    frota: equipamento.frota,
    categoria: normalizarCategoria(equipamento.categoria),
    tipo: padronizarTipo(equipamento.tipo),
    status_parada: statusParada,
    problema,
    ordem_servico: ordemServico,
    previsao: statusParada === "Tombado (Acidente)" ? "" : previsao,
    data_hora_parada: paradaISO,
    data_hora_liberacao: liberacaoISO,
    responsavel_parada: responsavelParada,
    responsavel_liberacao: responsavelLiberacao,
    observacao_parada: problema,
    observacao_liberacao: observacaoLiberacao
  };

  const { error } = await supabaseClient
    .from("paradas_equipamento")
    .insert([parada]);

  if (error) {
    alert("Erro ao registrar parada: " + error.message);
    return;
  }

  const dadosParada = {
    frota: equipamento.frota,
    status: statusParada,
    problema,
    ordem_servico: ordemServico,
    previsao: parada.previsao,
    responsavel: responsavelParada
  };

  await registrarHistoricoCompleto(
    equipamento,
    dadosParada,
    liberacaoISO ? "Registro retroativo de parada" : "Registro de parada do equipamento",
    paradaISO
  );

  if (liberacaoISO) {
    await registrarHistoricoCompleto(
      { ...equipamento, status: statusParada, problema, ordem_servico: ordemServico, previsao: parada.previsao },
      {
        frota: equipamento.frota,
        status: "Disponível",
        problema: "",
        ordem_servico: "",
        previsao: "",
        responsavel: responsavelLiberacao || responsavelParada
      },
      "Registro retroativo de liberação",
      liberacaoISO
    );

    alert("Parada retroativa registrada com liberação.");
  } else {
    const dadosAtualizados = {
      status: statusParada,
      problema,
      ordem_servico: ordemServico,
      previsao: parada.previsao,
      responsavel: responsavelParada,
      ultima_atualizacao: new Date().toISOString()
    };

    const { error: erroAtualizacao } = await supabaseClient
      .from("equipamentos")
      .update(dadosAtualizados)
      .eq("id", equipamento.id);

    if (erroAtualizacao) {
      alert("Parada registrada, mas houve erro ao atualizar o status atual: " + erroAtualizacao.message);
    } else {
      alert("Parada registrada e equipamento atualizado.");
    }
  }

  fecharFormularioParada();
  await carregarEquipamentos();
  await carregarHistorico();
}

async function salvarLiberacaoEquipamento() {
  const id = document.getElementById("liberacaoEquipamentoId").value;
  const equipamento = equipamentos.find(eq => String(eq.id) === String(id));

  if (!equipamento) {
    alert("Equipamento não encontrado.");
    return;
  }

  const dataHoraLiberacao = document.getElementById("liberacaoDataHora").value;
  const responsavel = document.getElementById("liberacaoResponsavel").value.trim();
  const observacao = document.getElementById("liberacaoObservacao").value.trim();

  if (!dataHoraLiberacao || !responsavel) {
    alert("Informe a data/hora da liberação e o responsável.");
    return;
  }

  const liberacaoISO = datetimeLocalParaISO(dataHoraLiberacao);
  const paradaAberta = buscarParadaAberta(equipamento.frota);

  if (paradaAberta) {
    if (new Date(liberacaoISO) < new Date(paradaAberta.data_hora_parada)) {
      alert("A liberação não pode ser anterior à data/hora da parada aberta.");
      return;
    }

    const { error } = await supabaseClient
      .from("paradas_equipamento")
      .update({
        data_hora_liberacao: liberacaoISO,
        responsavel_liberacao: responsavel,
        observacao_liberacao: observacao
      })
      .eq("id", paradaAberta.id);

    if (error) {
      alert("Erro ao fechar parada: " + error.message);
      return;
    }
  }

  const dadosAtualizados = {
    status: "Disponível",
    problema: "",
    ordem_servico: "",
    previsao: "",
    responsavel,
    ultima_atualizacao: new Date().toISOString()
  };

  const { error: erroAtualizacao } = await supabaseClient
    .from("equipamentos")
    .update(dadosAtualizados)
    .eq("id", equipamento.id);

  if (erroAtualizacao) {
    alert("Erro ao liberar equipamento: " + erroAtualizacao.message);
    return;
  }

  await registrarHistoricoCompleto(
    equipamento,
    {
      frota: equipamento.frota,
      status: "Disponível",
      problema: "",
      ordem_servico: "",
      previsao: "",
      responsavel
    },
    paradaAberta ? "Liberação de parada aberta" : "Liberação manual do equipamento",
    liberacaoISO
  );

  alert("Equipamento liberado com sucesso.");
  fecharFormularioLiberacao();
  await carregarEquipamentos();
  await carregarHistorico();
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
    const paradaAberta = buscarParadaAberta(eq.frota);
    const textoLiberar = paradaAberta ? "✅ Liberar" : "✅ Liberar";
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
          <button class="btn-indisponivel" onclick="abrirFormularioParada(${eq.id})">⛔ Parar</button>
          <button class="btn-liberar" onclick="abrirFormularioLiberacao(${eq.id})">${textoLiberar}</button>
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

  const tempos = {
    "Disponível": 0,
    "Indisponível": 0,
    "Tombado (Acidente)": 0
  };

  const paradasPeriodo = paradasEquipamento.filter(p => {
    if (String(p.frota) !== String(frota)) return false;

    const inicioParada = new Date(p.data_hora_parada);
    const fimParada = p.data_hora_liberacao ? new Date(p.data_hora_liberacao) : fim;

    return inicioParada < fim && fimParada > inicio;
  });

  if (paradasPeriodo.length > 0) {
    const totalPeriodo = fim - inicio;

    paradasPeriodo.forEach(parada => {
      const statusParada = statusSeguro(parada.status_parada, "Indisponível");
      const inicioParada = new Date(parada.data_hora_parada) < inicio ? inicio : new Date(parada.data_hora_parada);
      const fimParadaOriginal = parada.data_hora_liberacao ? new Date(parada.data_hora_liberacao) : fim;
      const fimParada = fimParadaOriginal > fim ? fim : fimParadaOriginal;

      if (fimParada > inicioParada) {
        tempos[statusParada] += fimParada - inicioParada;
      }
    });

    const parado = tempos["Indisponível"] + tempos["Tombado (Acidente)"];
    tempos["Disponível"] = Math.max(totalPeriodo - parado, 0);

    const totalMs = Object.values(tempos).reduce((s, v) => s + v, 0);
    const disponibilidade = totalMs > 0 ? tempos["Disponível"] / totalMs * 100 : 0;
    const indisponibilidade = totalMs > 0 ? (tempos["Indisponível"] + tempos["Tombado (Acidente)"]) / totalMs * 100 : 0;

    return {
      equipamento,
      eventos: dentro,
      paradas: paradasPeriodo,
      tempos,
      totalMs,
      disponibilidade,
      indisponibilidade,
      inicio,
      fim
    };
  }

  let statusAtual = equipamento ? equipamento.status_normalizado : "Disponível";

  const anteriores = todos.filter(h => new Date(h.data_hora) < inicio);
  if (anteriores.length > 0) {
    statusAtual = normalizarStatus(anteriores[anteriores.length - 1].status_novo);
  } else if (dentro.length > 0) {
    const anterior = normalizarStatus(dentro[0].status_anterior);
    statusAtual = STATUS_LISTA.includes(anterior) ? anterior : normalizarStatus(dentro[0].status_novo);
  }

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

  return { equipamento, eventos: dentro, paradas: [], tempos, totalMs, disponibilidade, indisponibilidade, inicio, fim };
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

/* ============================================================
   CORREÇÃO FINAL: EXPORTAÇÕES POR PERÍODO
   Regra aplicada:
   - O relatório NÃO multiplica mais quantidade de equipamentos x dias.
   - O tempo analisado exibido é somente a duração do período escolhido.
   - As porcentagens usam histórico/paradas para calcular a ocorrência de indisponibilidade dentro do período selecionado.
   - Se não houver histórico/paradas no período, o sistema não inventa indisponibilidade:
     considera o período sem ocorrências registradas.
============================================================ */

function msParaTexto(ms) {
  const valor = Math.max(0, Number(ms || 0));
  const totalHoras = valor / (1000 * 60 * 60);
  let dias = Math.floor(totalHoras / 24);
  let horas = totalHoras - (dias * 24);

  // Corrige arredondamento: 31 dias e 24.0h vira 32 dias e 0.0h
  if (horas >= 23.95) {
    dias += 1;
    horas = 0;
  }

  return `${dias} dias e ${horas.toFixed(1)}h`;
}

function dataLocalInicio(dataStr) {
  const [ano, mes, dia] = String(dataStr).split("-").map(Number);
  return new Date(ano, mes - 1, dia, 0, 0, 0, 0);
}

function dataLocalFimExclusivo(dataStr) {
  const [ano, mes, dia] = String(dataStr).split("-").map(Number);
  return new Date(ano, mes - 1, dia + 1, 0, 0, 0, 0);
}

function formatarDataPeriodoBR(dataStr) {
  if (!dataStr) return "--";
  const [ano, mes, dia] = String(dataStr).split("-");
  return `${dia}/${mes}/${ano}`;
}

function obterPeriodoExportacao() {
  const hoje = new Date();
  const inicioPadrao = new Date();
  inicioPadrao.setDate(hoje.getDate() - 30);

  const inputInicio = document.getElementById("exportDataInicial");
  const inputFinal = document.getElementById("exportDataFinal");

  if (inputInicio && !inputInicio.value) inputInicio.value = dataISOInput(inicioPadrao);
  if (inputFinal && !inputFinal.value) inputFinal.value = dataISOInput(hoje);

  const dataInicial = inputInicio?.value || dataISOInput(inicioPadrao);
  const dataFinal = inputFinal?.value || dataISOInput(hoje);

  const inicio = dataLocalInicio(dataInicial);
  const fimExclusivo = dataLocalFimExclusivo(dataFinal);

  if (fimExclusivo <= inicio) {
    alert("A data final precisa ser igual ou posterior à data inicial.");
    return null;
  }

  return {
    dataInicial,
    dataFinal,
    inicio,
    fimExclusivo,
    periodoMs: fimExclusivo - inicio,
    periodoTexto: `${formatarDataPeriodoBR(dataInicial)} a ${formatarDataPeriodoBR(dataFinal)}`
  };
}

// Sobrescreve a função antiga apenas para também preencher as datas das exportações.
function preencherSelectsFrota() {
  const hoje = new Date();
  const inicio = new Date();
  inicio.setDate(hoje.getDate() - 30);

  ["histDataInicial", "relDataInicial", "exportDataInicial"].forEach(id => {
    const input = document.getElementById(id);
    if (input && !input.value) input.value = dataISOInput(inicio);
  });

  ["histDataFinal", "relDataFinal", "exportDataFinal"].forEach(id => {
    const input = document.getElementById(id);
    if (input && !input.value) input.value = dataISOInput(hoje);
  });

  preencherDatalistTipos();
  carregarSugestoesFrotasHistorico();
}

async function carregarDadosPeriodoExportacao(periodo) {
  let historicos = historico || [];
  let paradas = paradasEquipamento || [];

  try {
    const { data, error } = await supabaseClient
      .from("historico")
      .select("*")
      .order("data_hora", { ascending: true });

    if (!error) historicos = data || [];
  } catch (e) {
    console.warn("Não foi possível carregar histórico para exportação:", e);
  }

  try {
    const { data, error } = await supabaseClient
      .from("paradas_equipamento")
      .select("*")
      .order("data_hora_parada", { ascending: true });

    if (!error) paradas = data || [];
  } catch (e) {
    console.warn("Não foi possível carregar paradas para exportação:", e);
  }

  const historicosPeriodo = historicos.filter(h => {
    const d = new Date(h.data_hora);
    return d >= periodo.inicio && d < periodo.fimExclusivo;
  });

  const paradasPeriodo = paradas.filter(p => {
    if (!p.data_hora_parada) return false;
    const inicioParada = new Date(p.data_hora_parada);
    const fimParada = p.data_hora_liberacao ? new Date(p.data_hora_liberacao) : periodo.fimExclusivo;
    return inicioParada < periodo.fimExclusivo && fimParada > periodo.inicio;
  });

  return { historicos, paradas, historicosPeriodo, paradasPeriodo };
}

function criarResumoVazioPeriodo(label, quantidadeEquipamentos, periodoMs) {
  return {
    label,
    totalEquipamentos: quantidadeEquipamentos,
    tempoAnalisadoMs: periodoMs,
    disponivelMs: periodoMs,
    indisponivelMs: 0,
    tombadoMs: 0,
    disponibilidade: 100,
    indisponibilidade: 0,
    tombadoPct: 0
  };
}

function statusInicialAntesDoPeriodo(equipamento, historicos, periodo) {
  const eventosAntes = historicos
    .filter(h => {
      const mesmaFrota = String(h.frota || "") === String(equipamento.frota || "");
      const mesmoId = h.equipamento_id && equipamento.id && String(h.equipamento_id) === String(equipamento.id);
      const dataEvento = new Date(h.data_hora);
      return (mesmaFrota || mesmoId) && h.data_hora && dataEvento < periodo.inicio;
    })
    .sort((a, b) => new Date(b.data_hora) - new Date(a.data_hora));

  if (eventosAntes.length > 0) {
    return normalizarStatus(eventosAntes[0].status_novo);
  }

  // Sem registro anterior: não usa status atual para "viajar no tempo".
  // A base inicial segura é Disponível até que o histórico/parada indique o contrário.
  return "Disponível";
}


function montarEventosStatusEquipamentoNoPeriodo(equipamento, periodo, historicos, paradas) {
  let statusAtual = statusInicialAntesDoPeriodo(equipamento, historicos, periodo);
  const eventos = [];

  historicos.forEach(h => {
    const mesmaFrota = String(h.frota || "") === String(equipamento.frota || "");
    const mesmoId = h.equipamento_id && equipamento.id && String(h.equipamento_id) === String(equipamento.id);
    if (!(mesmaFrota || mesmoId) || !h.data_hora) return;

    const dataEvento = new Date(h.data_hora);
    if (dataEvento >= periodo.inicio && dataEvento < periodo.fimExclusivo) {
      eventos.push({ data: dataEvento, status: normalizarStatus(h.status_novo), origem: "historico" });
    }
  });

  paradas.forEach(p => {
    const mesmaFrota = String(p.frota || "") === String(equipamento.frota || "");
    const mesmoId = p.equipamento_id && equipamento.id && String(p.equipamento_id) === String(equipamento.id);
    if (!(mesmaFrota || mesmoId) || !p.data_hora_parada) return;

    const inicioParadaOriginal = new Date(p.data_hora_parada);
    const fimParadaOriginal = p.data_hora_liberacao ? new Date(p.data_hora_liberacao) : periodo.fimExclusivo;

    if (inicioParadaOriginal >= periodo.fimExclusivo || fimParadaOriginal <= periodo.inicio) return;

    const inicioParada = inicioParadaOriginal < periodo.inicio ? periodo.inicio : inicioParadaOriginal;
    const fimParada = fimParadaOriginal > periodo.fimExclusivo ? periodo.fimExclusivo : fimParadaOriginal;

    eventos.push({ data: inicioParada, status: normalizarStatus(p.status_parada), origem: "parada" });
    if (fimParada > inicioParada && p.data_hora_liberacao) {
      eventos.push({ data: fimParada, status: "Disponível", origem: "liberacao" });
    }
  });

  eventos.sort((a, b) => a.data - b.data);
  return { statusInicial: statusAtual, eventos };
}

function calcularSegmentosEquipamentoNoPeriodo(equipamento, periodo, historicos, paradas) {
  const { statusInicial, eventos } = montarEventosStatusEquipamentoNoPeriodo(equipamento, periodo, historicos, paradas);
  const segmentos = [];
  let statusAtual = statusSeguro(statusInicial, "Disponível");
  let cursor = periodo.inicio;

  eventos.forEach(evento => {
    const dataEvento = evento.data < periodo.inicio ? periodo.inicio : evento.data;

    if (dataEvento > cursor) {
      segmentos.push({
        inicio: new Date(cursor),
        fim: new Date(dataEvento),
        status: statusSeguro(statusAtual, "Disponível"),
        frota: equipamento.frota,
        categoria: equipamento.categoria_normalizada,
        tipo: equipamento.tipo_normalizado
      });
    }

    statusAtual = statusSeguro(evento.status, statusAtual);
    cursor = dataEvento;
  });

  if (periodo.fimExclusivo > cursor) {
    segmentos.push({
      inicio: new Date(cursor),
      fim: new Date(periodo.fimExclusivo),
      status: statusSeguro(statusAtual, "Disponível"),
      frota: equipamento.frota,
      categoria: equipamento.categoria_normalizada,
      tipo: equipamento.tipo_normalizado
    });
  }

  return segmentos.filter(seg => seg.fim > seg.inicio);
}

function calcularTemposEquipamentoNoPeriodo(equipamento, periodo, historicos, paradas) {
  const tempos = {
    "Disponível": 0,
    "Indisponível": 0,
    "Tombado (Acidente)": 0
  };

  calcularSegmentosEquipamentoNoPeriodo(equipamento, periodo, historicos, paradas).forEach(seg => {
    tempos[statusSeguro(seg.status, "Disponível")] += seg.fim - seg.inicio;
  });

  return tempos;
}

function calcularTemposGrupoPorSegmentos(segmentos, periodo) {
  const tempos = {
    "Disponível": periodo.periodoMs,
    "Indisponível": 0,
    "Tombado (Acidente)": 0
  };

  const intervalos = segmentos
    .filter(seg => statusSeguro(seg.status, "Disponível") !== "Disponível")
    .map(seg => ({
      inicio: Math.max(new Date(seg.inicio).getTime(), periodo.inicio.getTime()),
      fim: Math.min(new Date(seg.fim).getTime(), periodo.fimExclusivo.getTime()),
      status: statusSeguro(seg.status, "Disponível")
    }))
    .filter(seg => seg.fim > seg.inicio);

  if (intervalos.length === 0) return tempos;

  const cortes = new Set([periodo.inicio.getTime(), periodo.fimExclusivo.getTime()]);
  intervalos.forEach(seg => {
    cortes.add(seg.inicio);
    cortes.add(seg.fim);
  });

  const pontos = [...cortes].sort((a, b) => a - b);
  let indisponivelMs = 0;
  let tombadoMs = 0;

  for (let i = 0; i < pontos.length - 1; i++) {
    const ini = pontos[i];
    const fim = pontos[i + 1];
    if (fim <= ini) continue;

    const ativos = intervalos.filter(seg => seg.inicio < fim && seg.fim > ini);
    if (ativos.length === 0) continue;

    const duracao = fim - ini;
    const temTombado = ativos.some(seg => seg.status === "Tombado (Acidente)");

    if (temTombado) {
      tombadoMs += duracao;
    } else {
      indisponivelMs += duracao;
    }
  }

  tempos["Tombado (Acidente)"] = Math.min(tombadoMs, periodo.periodoMs);
  tempos["Indisponível"] = Math.min(indisponivelMs, Math.max(0, periodo.periodoMs - tempos["Tombado (Acidente)"]));
  tempos["Disponível"] = Math.max(0, periodo.periodoMs - tempos["Indisponível"] - tempos["Tombado (Acidente)"]);

  return tempos;
}

function montarResumoPeriodo(periodo, historicos, paradas) {
  const lista = listaEquipamentosNormalizada();
  const totalEquipamentos = lista.length;

  const tipos = {};

  lista.forEach(eq => {
    const segmentosEq = calcularSegmentosEquipamentoNoPeriodo(eq, periodo, historicos, paradas);
    const categoriaLabel = eq.categoria_normalizada === "Trator" ? "Trator Nonino" : eq.categoria_normalizada;
    const tipoRel = tipoParaRelatorio(eq);
    const chaveTipo = `${categoriaLabel}||${tipoRel}`;

    if (!tipos[chaveTipo]) {
      tipos[chaveTipo] = {
        label: `${categoriaLabel} - ${tipoRel}`,
        categoria: categoriaLabel,
        tipo: tipoRel,
        totalEquipamentos: 0,
        tempoAnalisadoMs: periodo.periodoMs,
        disponivelMs: periodo.periodoMs,
        indisponivelMs: 0,
        tombadoMs: 0,
        disponibilidade: 100,
        indisponibilidade: 0,
        tombadoPct: 0,
        segmentos: []
      };
    }

    tipos[chaveTipo].totalEquipamentos += 1;
    tipos[chaveTipo].segmentos.push(...segmentosEq);
  });

  function finalizarResumoPorOcorrencia(r) {
    const temposGrupo = calcularTemposGrupoPorSegmentos(r.segmentos || [], periodo);

    r.disponivelMs = temposGrupo["Disponível"];
    r.indisponivelMs = temposGrupo["Indisponível"];
    r.tombadoMs = temposGrupo["Tombado (Acidente)"];
    r.tempoAnalisadoMs = periodo.periodoMs;

    r.disponibilidade = periodo.periodoMs > 0 ? (r.disponivelMs / periodo.periodoMs) * 100 : 0;
    r.indisponibilidade = periodo.periodoMs > 0 ? (r.indisponivelMs / periodo.periodoMs) * 100 : 0;
    r.tombadoPct = periodo.periodoMs > 0 ? (r.tombadoMs / periodo.periodoMs) * 100 : 0;

    delete r.segmentos;
    return r;
  }

  const resumoTipos = Object.values(tipos)
    .filter(r => r.totalEquipamentos > 0)
    .map(finalizarResumoPorOcorrencia)
    .sort((a, b) => String(a.label).localeCompare(String(b.label), "pt-BR"));

  function combinarResumosPonderados(label, resumos, extra = {}) {
    const pesoTotal = resumos.reduce((s, r) => s + (Number(r.totalEquipamentos) || 0), 0);
    const divisor = pesoTotal > 0 ? pesoTotal : (resumos.length || 1);

    const disponivelMs = resumos.length > 0
      ? resumos.reduce((s, r) => s + (r.disponivelMs || 0) * ((Number(r.totalEquipamentos) || 0) || 1), 0) / divisor
      : periodo.periodoMs;

    const indisponivelMs = resumos.length > 0
      ? resumos.reduce((s, r) => s + (r.indisponivelMs || 0) * ((Number(r.totalEquipamentos) || 0) || 1), 0) / divisor
      : 0;

    const tombadoMs = resumos.length > 0
      ? resumos.reduce((s, r) => s + (r.tombadoMs || 0) * ((Number(r.totalEquipamentos) || 0) || 1), 0) / divisor
      : 0;

    const ajuste = periodo.periodoMs > 0 ? periodo.periodoMs / Math.max(disponivelMs + indisponivelMs + tombadoMs, 1) : 1;
    const dispAjustado = disponivelMs * ajuste;
    const indispAjustado = indisponivelMs * ajuste;
    const tombAjustado = tombadoMs * ajuste;

    return {
      label,
      ...extra,
      totalEquipamentos: pesoTotal || resumos.reduce((s, r) => s + (Number(r.totalEquipamentos) || 0), 0),
      tempoAnalisadoMs: periodo.periodoMs,
      disponivelMs: dispAjustado,
      indisponivelMs: indispAjustado,
      tombadoMs: tombAjustado,
      disponibilidade: periodo.periodoMs > 0 ? (dispAjustado / periodo.periodoMs) * 100 : 0,
      indisponibilidade: periodo.periodoMs > 0 ? (indispAjustado / periodo.periodoMs) * 100 : 0,
      tombadoPct: periodo.periodoMs > 0 ? (tombAjustado / periodo.periodoMs) * 100 : 0
    };
  }

  const resumoCategorias = CATEGORIAS.map(cat => {
    const categoriaLabel = cat === "Trator" ? "Trator Nonino" : cat;
    const tiposDaCategoria = resumoTipos.filter(t => t.categoria === categoriaLabel);
    return combinarResumosPonderados(categoriaLabel, tiposDaCategoria);
  }).filter(r => r.totalEquipamentos > 0);

  const resumoGeral = combinarResumosPonderados("Geral", resumoCategorias, { totalEquipamentos });
  resumoGeral.totalEquipamentos = totalEquipamentos;

  return { resumoGeral, resumoCategorias, resumoTipos };
}

function pctPeriodo(valorMs, periodoMs) {
  return periodoMs > 0 ? `${((valorMs / periodoMs) * 100).toFixed(1)}%` : "0.0%";
}

function resumoParaCanvasPeriodo(resumo) {
  return {
    label: resumo.label,
    disponiveis: resumo.disponivelMs,
    indisponiveis: resumo.indisponivelMs,
    tombados: resumo.tombadoMs
  };
}

function criarCanvasPizzaPeriodo(resumo, titulo = "Disponibilidade do período") {
  const canvas = document.createElement("canvas");
  canvas.width = 900;
  canvas.height = 520;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "#d1d5db";
  ctx.lineWidth = 2;
  ctx.strokeRect(12, 12, canvas.width - 24, canvas.height - 24);

  ctx.fillStyle = "#064e3b";
  ctx.font = "bold 28px Arial";
  quebrarTextoCanvas(ctx, titulo || "Resumo", 36, 55, 420, 32);

  const dados = [
    { status: "Disponível", valor: resumo.disponivelMs || 0 },
    { status: "Indisponível", valor: resumo.indisponivelMs || 0 },
    { status: "Tombado (Acidente)", valor: resumo.tombadoMs || 0 }
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

  ctx.beginPath();
  ctx.arc(cx, cy, 58, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.strokeStyle = "#e5e7eb";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "#064e3b";
  ctx.font = "bold 24px Arial";
  ctx.textAlign = "center";
  ctx.fillText("Período", cx, cy - 4);
  ctx.font = "15px Arial";
  ctx.fillStyle = "#6b7280";
  ctx.fillText("tempo", cx, cy + 22);
  ctx.textAlign = "left";

  let y = 170;
  ctx.font = "bold 18px Arial";
  ctx.fillStyle = "#111827";
  ctx.fillText("Composição por tempo", 525, y - 28);

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
    ctx.fillText(`${msParaTexto(item.valor)} — ${percentual}%`, 560, y + 25);

    y += 74;
  });

  ctx.fillStyle = "#6b7280";
  ctx.font = "14px Arial";
  ctx.fillText("Cálculo baseado no histórico e paradas do período selecionado", 525, 445);

  return canvas;
}

function linhasResumoCategoriaPeriodo(resumos) {
  return resumos.map(r => [
    r.label,
    r.totalEquipamentos,
    msParaTexto(r.tempoAnalisadoMs),
    msParaTexto(r.disponivelMs),
    pctPeriodo(r.disponivelMs, r.tempoAnalisadoMs),
    msParaTexto(r.indisponivelMs),
    pctPeriodo(r.indisponivelMs, r.tempoAnalisadoMs),
    msParaTexto(r.tombadoMs),
    pctPeriodo(r.tombadoMs, r.tempoAnalisadoMs)
  ]);
}

function linhasResumoTipoPeriodo(resumos) {
  return resumos.map(r => [
    r.categoria,
    r.tipo,
    r.totalEquipamentos,
    msParaTexto(r.tempoAnalisadoMs),
    msParaTexto(r.disponivelMs),
    pctPeriodo(r.disponivelMs, r.tempoAnalisadoMs),
    msParaTexto(r.indisponivelMs),
    pctPeriodo(r.indisponivelMs, r.tempoAnalisadoMs),
    msParaTexto(r.tombadoMs),
    pctPeriodo(r.tombadoMs, r.tempoAnalisadoMs)
  ]);
}

function linhasParadasPeriodo(paradasPeriodo, periodo) {
  if (!paradasPeriodo || paradasPeriodo.length === 0) {
    return [["-", "-", "-", "-", "-", "-", "-", "Nenhuma parada registrada no período", "-", "-"]];
  }

  return paradasPeriodo.map(p => {
    const inicioOriginal = new Date(p.data_hora_parada);
    const fimOriginal = p.data_hora_liberacao ? new Date(p.data_hora_liberacao) : periodo.fimExclusivo;
    const inicio = inicioOriginal < periodo.inicio ? periodo.inicio : inicioOriginal;
    const fim = fimOriginal > periodo.fimExclusivo ? periodo.fimExclusivo : fimOriginal;

    return [
      p.frota || "",
      normalizarCategoria(p.categoria),
      padronizarTipo(p.tipo),
      normalizarStatus(p.status_parada),
      formatarData(inicio),
      p.data_hora_liberacao ? formatarData(fim) : "Aberta no período",
      msParaTexto(fim - inicio),
      p.problema || p.observacao_parada || "",
      p.ordem_servico || "",
      p.responsavel_parada || ""
    ];
  });
}

function linhasHistoricoPeriodo(historicosPeriodo) {
  if (!historicosPeriodo || historicosPeriodo.length === 0) {
    return [["-", "-", "-", "-", "Nenhum histórico registrado no período", "-", "-", "-"]];
  }

  return historicosPeriodo.map(h => [
    formatarData(h.data_hora),
    h.frota || "",
    normalizarStatus(h.status_anterior),
    normalizarStatus(h.status_novo),
    h.problema_novo || "",
    h.os_novo || "",
    h.previsao_novo || "",
    h.responsavel || ""
  ]);
}

function adicionarPaginaPizzasPeriodoPDF(doc, tituloPagina, resumos, subtitulo = "") {
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
      const canvas = criarCanvasPizzaPeriodo(resumo, resumo.label || "Resumo");
      doc.addImage(canvas.toDataURL("image/png"), "PNG", pos.x + 1, pos.y, 128, 68);
    });
  });
}

async function prepararDadosExportacaoPeriodo() {
  const periodo = obterPeriodoExportacao();
  if (!periodo) return null;

  const dados = await carregarDadosPeriodoExportacao(periodo);
  const resumos = montarResumoPeriodo(periodo, dados.historicos, dados.paradas);

  return { periodo, ...dados, ...resumos };
}

async function exportarExcel() {
  const base = await prepararDadosExportacaoPeriodo();
  if (!base) return;

  const lista = listaEquipamentosNormalizada();
  if (lista.length === 0) return alert("Nenhum equipamento para exportar.");

  const resumo = [{
    "Período": base.periodo.periodoTexto,
    "Dias do período": (base.periodo.periodoMs / (1000 * 60 * 60 * 24)).toFixed(0),
    "Total de equipamentos": base.resumoGeral.totalEquipamentos,
    "Período analisado": msParaTexto(base.resumoGeral.tempoAnalisadoMs),
    "Tempo disponível": msParaTexto(base.resumoGeral.disponivelMs),
    "Disponibilidade %": base.resumoGeral.disponibilidade.toFixed(1),
    "Tempo indisponível": msParaTexto(base.resumoGeral.indisponivelMs),
    "Indisponibilidade %": base.resumoGeral.indisponibilidade.toFixed(1),
    "Tempo tombado/acidente": msParaTexto(base.resumoGeral.tombadoMs),
    "Tombado %": base.resumoGeral.tombadoPct.toFixed(1),
    "Históricos no período": base.historicosPeriodo.length,
    "Paradas no período": base.paradasPeriodo.length
  }];

  const equipamentosPlanilha = lista.map(eq => ({
    Frota: eq.frota || "",
    Tipo: eq.tipo_normalizado || "",
    Categoria: eq.categoria_normalizada || "",
    Placa: eq.placa || "",
    "Status atual": eq.status_normalizado || "",
    Situação: eq.situacao || "",
    Problema: eq.problema || "",
    OS: eq.ordem_servico || "",
    Previsão: eq.previsao || "",
    Responsável: eq.responsavel || "",
    "Última Atualização": formatarData(eq.ultima_atualizacao)
  }));

  const resumoCategoria = base.resumoCategorias.map(r => ({
    Categoria: r.label,
    "Qtd. equipamentos": r.totalEquipamentos,
    "Período analisado": msParaTexto(r.tempoAnalisadoMs),
    "Tempo disponível": msParaTexto(r.disponivelMs),
    "% disponível": pctPeriodo(r.disponivelMs, r.tempoAnalisadoMs),
    "Tempo indisponível": msParaTexto(r.indisponivelMs),
    "% indisponível": pctPeriodo(r.indisponivelMs, r.tempoAnalisadoMs),
    "Tempo tombado": msParaTexto(r.tombadoMs),
    "% tombado": pctPeriodo(r.tombadoMs, r.tempoAnalisadoMs)
  }));

  const resumoTipo = base.resumoTipos.map(r => ({
    Categoria: r.categoria,
    Tipo: r.tipo,
    "Qtd. equipamentos": r.totalEquipamentos,
    "Período analisado": msParaTexto(r.tempoAnalisadoMs),
    "Tempo disponível": msParaTexto(r.disponivelMs),
    "% disponível": pctPeriodo(r.disponivelMs, r.tempoAnalisadoMs),
    "Tempo indisponível": msParaTexto(r.indisponivelMs),
    "% indisponível": pctPeriodo(r.indisponivelMs, r.tempoAnalisadoMs),
    "Tempo tombado": msParaTexto(r.tombadoMs),
    "% tombado": pctPeriodo(r.tombadoMs, r.tempoAnalisadoMs)
  }));

  const paradas = linhasParadasPeriodo(base.paradasPeriodo, base.periodo).map(l => ({
    Frota: l[0], Categoria: l[1], Tipo: l[2], Status: l[3], Parada: l[4], Liberação: l[5], Duração: l[6], Problema: l[7], OS: l[8], Responsável: l[9]
  }));

  const historicosPlanilha = linhasHistoricoPeriodo(base.historicosPeriodo).map(l => ({
    "Data/Hora": l[0], Frota: l[1], "Status anterior": l[2], "Status novo": l[3], Problema: l[4], OS: l[5], Previsão: l[6], Responsável: l[7]
  }));

  const arquivo = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(arquivo, XLSX.utils.json_to_sheet(resumo), "Resumo do Período");
  XLSX.utils.book_append_sheet(arquivo, XLSX.utils.json_to_sheet(resumoCategoria), "Resumo Categoria");
  XLSX.utils.book_append_sheet(arquivo, XLSX.utils.json_to_sheet(resumoTipo), "Resumo Tipo");
  XLSX.utils.book_append_sheet(arquivo, XLSX.utils.json_to_sheet(paradas), "Paradas Período");
  XLSX.utils.book_append_sheet(arquivo, XLSX.utils.json_to_sheet(historicosPlanilha), "Histórico Período");
  XLSX.utils.book_append_sheet(arquivo, XLSX.utils.json_to_sheet(equipamentosPlanilha), "Equipamentos Atuais");
  XLSX.writeFile(arquivo, `controle_irrigacao_${base.periodo.dataInicial}_a_${base.periodo.dataFinal}.xlsx`);
}

async function exportarPDFGerencial() {
  const base = await prepararDadosExportacaoPeriodo();
  if (!base) return;

  const lista = listaEquipamentosNormalizada();
  if (lista.length === 0) return alert("Nenhum equipamento para exportar.");

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const r = base.resumoGeral;

  adicionarCabecalhoPDF(doc, "Relatório Gerencial de Disponibilidade da Irrigação", `Período analisado: ${base.periodo.periodoTexto}`);

  doc.setFontSize(11);
  doc.text(`Período: ${base.periodo.periodoTexto}`, 14, 35);
  doc.text(`Dias do período: ${(base.periodo.periodoMs / (1000 * 60 * 60 * 24)).toFixed(0)}`, 14, 42);
  doc.text(`Total de equipamentos: ${r.totalEquipamentos}`, 14, 49);
  doc.text(`Período analisado: ${msParaTexto(r.tempoAnalisadoMs)}`, 14, 56);
  doc.text(`Tempo disponível: ${msParaTexto(r.disponivelMs)} (${r.disponibilidade.toFixed(1)}%)`, 14, 63);
  doc.text(`Tempo indisponível: ${msParaTexto(r.indisponivelMs)} (${r.indisponibilidade.toFixed(1)}%)`, 14, 70);
  doc.text(`Tempo tombado/acidente: ${msParaTexto(r.tombadoMs)} (${r.tombadoPct.toFixed(1)}%)`, 14, 77);

  const pizza = criarCanvasPizzaPeriodo(r, "Disponibilidade do período");
  doc.addImage(pizza.toDataURL("image/png"), "PNG", 124, 33, 150, 86);

  doc.autoTable({
    head: [["Categoria", "Qtd. equip.", "Período analisado", "Tempo disp.", "% Disp.", "Tempo indisp.", "% Indisp.", "Tempo tomb.", "% Tomb."]],
    body: linhasResumoCategoriaPeriodo(base.resumoCategorias),
    startY: 130,
    styles: { fontSize: 7 },
    headStyles: { fillColor: [6, 78, 59] }
  });

  doc.autoTable({
    head: [["Frota", "Categoria", "Tipo", "Status", "Parada", "Liberação", "Duração", "Problema", "OS", "Responsável"]],
    body: linhasParadasPeriodo(base.paradasPeriodo, base.periodo),
    startY: doc.lastAutoTable.finalY + 10,
    styles: { fontSize: 6 },
    headStyles: { fillColor: [6, 78, 59] }
  });

  doc.setFontSize(8);
  doc.text(`Históricos no período: ${base.historicosPeriodo.length} | Paradas no período: ${base.paradasPeriodo.length}`, 14, 200);
  if (base.historicosPeriodo.length === 0 && base.paradasPeriodo.length === 0) {
    doc.setTextColor(75, 85, 99);
    doc.text("Sem registros de parada, tombamento ou alteração no período; disponibilidade considerada 100% por ausência de indisponibilidades registradas.", 14, 206, { maxWidth: 265 });
  }

  doc.save(`relatorio_gerencial_irrigacao_${base.periodo.dataInicial}_a_${base.periodo.dataFinal}.pdf`);
}

async function exportarPDFAuditoria() {
  const base = await prepararDadosExportacaoPeriodo();
  if (!base) return;

  const lista = listaEquipamentosNormalizada();
  if (lista.length === 0) return alert("Nenhum equipamento para exportar.");

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const dataEmissao = new Date().toLocaleString("pt-BR");
  const r = base.resumoGeral;
  const tiposCriticos = [...base.resumoTipos]
    .filter(t => t.totalEquipamentos > 0 && (t.indisponivelMs + t.tombadoMs) > 0)
    .sort((a, b) => a.disponibilidade - b.disponibilidade)
    .slice(0, 8);

  // Página 1
  adicionarCabecalhoPDF(doc, "Relatório de Auditoria Operacional", `Período analisado: ${base.periodo.periodoTexto}`);

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
  doc.text(`Período analisado: ${base.periodo.periodoTexto}`, 22, 67);
  doc.text(`Data de emissão: ${dataEmissao}`, 190, 67);

  adicionarCartaoIndicadorPDF(doc, 14, 86, "Equipamentos", r.totalEquipamentos, "cadastrados", [6, 78, 59]);
  adicionarCartaoIndicadorPDF(doc, 80, 86, "Disponibilidade", `${r.disponibilidade.toFixed(1)}%`, msParaTexto(r.disponivelMs), [22, 163, 74]);
  adicionarCartaoIndicadorPDF(doc, 146, 86, "Indisponibilidade", `${r.indisponibilidade.toFixed(1)}%`, msParaTexto(r.indisponivelMs), [220, 38, 38]);
  adicionarCartaoIndicadorPDF(doc, 212, 86, "Período", msParaTexto(r.tempoAnalisadoMs), "período analisado", [55, 65, 81]);

  adicionarTituloSecaoPDF(doc, "Resumo executivo", 14, 124);
  doc.setFontSize(9);
  doc.setTextColor(55, 65, 81);
  doc.text(`Este relatório considera o intervalo de ${base.periodo.periodoTexto}. Os indicadores são calculados com base no histórico de alterações e nas paradas registradas, respeitando o período selecionado.`, 14, 135, { maxWidth: 128 });
  doc.text(`Foram considerados ${r.totalEquipamentos} equipamento(s). O tempo analisado exibido corresponde ao período selecionado, sem multiplicar equipamentos x dias.`, 14, 148, { maxWidth: 128 });
  doc.text(`A disponibilidade operacional do período foi de ${r.disponibilidade.toFixed(1)}%, com ${(r.indisponibilidade + r.tombadoPct).toFixed(1)}% de tempo fora de disponibilidade.`, 14, 161, { maxWidth: 128 });
  if (base.historicosPeriodo.length === 0 && base.paradasPeriodo.length === 0) {
    doc.setFontSize(8);
    doc.setTextColor(75, 85, 99);
    doc.text("Não houve registros de parada, tombamento ou alteração de status no período selecionado; por isso a disponibilidade foi considerada 100% pela ausência de indisponibilidades registradas.", 14, 174, { maxWidth: 128 });
  }

  const pizzaCapa = criarCanvasPizzaPeriodo(r, "Disponibilidade do período");
  doc.addImage(pizzaCapa.toDataURL("image/png"), "PNG", 150, 120, 128, 74);

  // Página 2
  doc.addPage("landscape");
  adicionarCabecalhoPDF(doc, "Relatório de Auditoria Operacional", "Visão geral do período");
  adicionarTituloSecaoPDF(doc, "1. Gráfico geral de disponibilidade no período", 14, 36);
  const pizzaGeral = criarCanvasPizzaPeriodo(r, "Distribuição por tempo");
  doc.addImage(pizzaGeral.toDataURL("image/png"), "PNG", 14, 46, 138, 80);

  doc.setFillColor(250, 252, 250);
  doc.setDrawColor(229, 231, 235);
  doc.roundedRect(166, 46, 116, 80, 3, 3, "FD");
  doc.setFontSize(11);
  doc.setTextColor(6, 78, 59);
  doc.setFont(undefined, "bold");
  doc.text("Leitura rápida", 174, 58);
  doc.setFont(undefined, "normal");
  doc.setTextColor(55, 65, 81);
  doc.setFontSize(9);
  doc.text(`Período: ${base.periodo.periodoTexto}`, 174, 76);
  doc.text(`Período analisado: ${msParaTexto(r.tempoAnalisadoMs)}`, 174, 90);
  doc.text(`Tempo disponível: ${msParaTexto(r.disponivelMs)} (${r.disponibilidade.toFixed(1)}%)`, 174, 104);
  doc.text(`Tempo indisponível: ${msParaTexto(r.indisponivelMs)} (${r.indisponibilidade.toFixed(1)}%)`, 174, 118);
  doc.text(`Históricos no período: ${base.historicosPeriodo.length} | Paradas: ${base.paradasPeriodo.length}`, 174, 132);

  adicionarTituloSecaoPDF(doc, "2. Resumo por categoria", 14, 146);
  doc.autoTable({
    head: [["Categoria", "Qtd. equip.", "Período analisado", "Tempo disp.", "% Disp.", "Tempo indisp.", "% Indisp.", "Tempo tomb.", "% Tomb."]],
    body: linhasResumoCategoriaPeriodo(base.resumoCategorias),
    startY: 154,
    styles: { fontSize: 7 },
    headStyles: { fillColor: [6, 78, 59] }
  });

  adicionarPaginaPizzasPeriodoPDF(
    doc,
    "3. Gráficos de pizza por categoria",
    base.resumoCategorias,
    "Cada gráfico mostra a distribuição do período por status dentro da categoria, considerando as ocorrências registradas."
  );

  adicionarPaginaPizzasPeriodoPDF(
    doc,
    "4. Gráficos de pizza por tipo de equipamento",
    base.resumoTipos,
    "Cada gráfico mostra a distribuição do período por status dentro do tipo, considerando as ocorrências registradas."
  );

  // Página consolidação por tipo
  doc.addPage("landscape");
  adicionarCabecalhoPDF(doc, "Relatório de Auditoria Operacional", "Consolidação por tipo e pontos de atenção");
  adicionarTituloSecaoPDF(doc, "5. Disponibilidade por tipo de equipamento no período", 14, 34);
  doc.autoTable({
    head: [["Categoria", "Tipo", "Qtd.", "Período analisado", "Tempo disp.", "% Disp.", "Tempo indisp.", "% Indisp.", "Tempo tomb.", "% Tomb."]],
    body: linhasResumoTipoPeriodo(base.resumoTipos),
    startY: 42,
    styles: { fontSize: 6 },
    headStyles: { fillColor: [6, 78, 59] }
  });

  // Mantém a seção 6 em página própria para evitar quebra de tabela com linha solta.
  doc.addPage("landscape");
  adicionarCabecalhoPDF(doc, "Relatório de Auditoria Operacional", "Pontos de atenção por tipo");
  let ySecao6 = 34;

  adicionarTituloSecaoPDF(doc, "6. Tipos com menor disponibilidade no período", 14, ySecao6);

  if (tiposCriticos.length === 0) {
    doc.setFontSize(9);
    doc.setTextColor(55, 65, 81);
    doc.text("Nenhum tipo apresentou indisponibilidade ou tombamento no período selecionado.", 14, ySecao6 + 10, { maxWidth: 260 });
  } else {
    doc.autoTable({
      head: [["Categoria", "Tipo", "Qtd.", "Disponibilidade", "Tempo indisp.", "Tempo tomb."]],
      body: tiposCriticos.map(t => [
        t.categoria,
        t.tipo,
        t.totalEquipamentos,
        `${t.disponibilidade.toFixed(1)}%`,
        msParaTexto(t.indisponivelMs),
        msParaTexto(t.tombadoMs)
      ]),
      startY: ySecao6 + 8,
      styles: { fontSize: 7 },
      headStyles: { fillColor: [220, 38, 38] }
    });
  }

  // Paradas
  doc.addPage("landscape");
  adicionarCabecalhoPDF(doc, "Relatório de Auditoria Operacional", "Paradas registradas no período");
  adicionarTituloSecaoPDF(doc, "7. Descrição dos Equipamentos Indisponíveis e Tombados", 14, 34);
  doc.setFontSize(8);
  doc.setTextColor(75, 85, 99);
  doc.text(`Esta seção lista as paradas e tombamentos que tiveram sobreposição com o período ${base.periodo.periodoTexto}.`, 14, 43, { maxWidth: 265 });
  doc.autoTable({
    head: [["Frota", "Categoria", "Tipo", "Status", "Parada", "Liberação", "Duração", "Problema", "OS", "Responsável"]],
    body: linhasParadasPeriodo(base.paradasPeriodo, base.periodo),
    startY: 52,
    styles: { fontSize: 6 },
    headStyles: { fillColor: [6, 78, 59] }
  });

  // Histórico
  doc.addPage("landscape");
  adicionarCabecalhoPDF(doc, "Relatório de Auditoria Operacional", "Histórico de alterações no período");
  adicionarTituloSecaoPDF(doc, "8. Histórico de alterações", 14, 34);
  doc.autoTable({
    head: [["Data/Hora", "Frota", "Status anterior", "Status novo", "Problema", "OS", "Previsão", "Responsável"]],
    body: linhasHistoricoPeriodo(base.historicosPeriodo),
    startY: 42,
    styles: { fontSize: 6 },
    headStyles: { fillColor: [6, 78, 59] }
  });

  // Conclusão
  doc.addPage("landscape");
  adicionarCabecalhoPDF(doc, "Relatório de Auditoria Operacional", "Conclusão automática");
  adicionarTituloSecaoPDF(doc, "9. Conclusão", 14, 36);
  doc.setFontSize(10);
  doc.setTextColor(55, 65, 81);
  const conclusao = [
    `No período de ${base.periodo.periodoTexto}, foram avaliados ${r.totalEquipamentos} equipamento(s).`,
    `O tempo analisado do relatório corresponde a ${msParaTexto(r.tempoAnalisadoMs)}, sem multiplicar quantidade de equipamentos pelo número de dias.`,
    `A disponibilidade geral do período foi de ${r.disponibilidade.toFixed(1)}%, representando ${msParaTexto(r.disponivelMs)} em condição disponível.`,
    `O tempo fora de disponibilidade foi de ${msParaTexto(r.indisponivelMs + r.tombadoMs)}, considerando indisponibilidades e tombamentos/acidentes registrados no histórico e nas paradas.`,
    `Foram encontrados ${base.historicosPeriodo.length} registro(s) de histórico e ${base.paradasPeriodo.length} parada(s) com ocorrência ou sobreposição dentro do período selecionado.`,
    ...(base.historicosPeriodo.length === 0 && base.paradasPeriodo.length === 0 ? ["Como não houve registros de parada, tombamento ou alteração no período, a disponibilidade foi considerada 100% pela ausência de indisponibilidades registradas."] : []),
    "Este documento deve ser utilizado como apoio à rastreabilidade operacional, auditoria e acompanhamento da disponibilidade da frota da irrigação."
  ];
  doc.text(conclusao, 14, 50, { maxWidth: 260, lineHeightFactor: 1.6 });

  adicionarRodapeAuditoriaPDF(doc, dataEmissao);
  doc.save(`relatorio_auditoria_irrigacao_${base.periodo.dataInicial}_a_${base.periodo.dataFinal}.pdf`);
}

/* =========================================================
   CORREÇÃO FINAL - RELATÓRIOS POR PERÍODO
   - Cálculo por equipamento normalizado pelo período selecionado
   - Não exibe equipamentos x dias
   - Respeita histórico/paradas do período
   - Adiciona quantidade de equipamentos nas legendas dos gráficos
   ========================================================= */

function calcularSegmentosEquipamentoNoPeriodo(equipamento, periodo, historicos, paradas) {
  const inicioMs = periodo.inicio.getTime();
  const fimMs = periodo.fimExclusivo.getTime();

  const mesmoEquipamento = (registro) => {
    const mesmaFrota = String(registro.frota || "") === String(equipamento.frota || "");
    const mesmoId = registro.equipamento_id && equipamento.id && String(registro.equipamento_id) === String(equipamento.id);
    return mesmaFrota || mesmoId;
  };

  const historicosEq = (historicos || [])
    .filter(h => mesmoEquipamento(h) && h.data_hora)
    .sort((a, b) => new Date(a.data_hora) - new Date(b.data_hora));

  const ultimoAntes = historicosEq
    .filter(h => new Date(h.data_hora).getTime() < inicioMs)
    .sort((a, b) => new Date(b.data_hora) - new Date(a.data_hora))[0];

  let statusBase = ultimoAntes ? statusSeguro(ultimoAntes.status_novo, "Disponível") : "Disponível";

  const historicosPeriodo = historicosEq
    .filter(h => {
      const t = new Date(h.data_hora).getTime();
      return t >= inicioMs && t < fimMs;
    })
    .map(h => ({
      tempo: new Date(h.data_hora).getTime(),
      status: statusSeguro(h.status_novo, statusBase),
      origem: "historico"
    }));

  const paradasEq = (paradas || [])
    .filter(p => mesmoEquipamento(p) && p.data_hora_parada)
    .map(p => {
      const iniOriginal = new Date(p.data_hora_parada).getTime();
      const fimOriginal = p.data_hora_liberacao ? new Date(p.data_hora_liberacao).getTime() : fimMs;
      const ini = Math.max(iniOriginal, inicioMs);
      const fim = Math.min(fimOriginal, fimMs);
      return {
        inicio: ini,
        fim,
        status: statusSeguro(p.status_parada, "Indisponível"),
        origem: "parada"
      };
    })
    .filter(p => p.fim > p.inicio);

  const cortes = new Set([inicioMs, fimMs]);
  historicosPeriodo.forEach(h => cortes.add(h.tempo));
  paradasEq.forEach(p => {
    cortes.add(p.inicio);
    cortes.add(p.fim);
  });

  const pontos = [...cortes].sort((a, b) => a - b);
  const segmentos = [];

  for (let i = 0; i < pontos.length - 1; i++) {
    const ini = pontos[i];
    const fim = pontos[i + 1];
    if (fim <= ini) continue;

    const ultimoHistoricoAteAqui = historicosPeriodo
      .filter(h => h.tempo <= ini)
      .sort((a, b) => b.tempo - a.tempo)[0];

    let status = ultimoHistoricoAteAqui ? ultimoHistoricoAteAqui.status : statusBase;

    const paradasAtivas = paradasEq.filter(p => p.inicio < fim && p.fim > ini);
    if (paradasAtivas.length > 0) {
      const temTombado = paradasAtivas.some(p => statusSeguro(p.status, "Indisponível") === "Tombado (Acidente)");
      status = temTombado ? "Tombado (Acidente)" : "Indisponível";
    }

    segmentos.push({
      inicio: new Date(ini),
      fim: new Date(fim),
      status: statusSeguro(status, "Disponível"),
      frota: equipamento.frota,
      categoria: equipamento.categoria_normalizada,
      tipo: equipamento.tipo_normalizado
    });
  }

  return segmentos.filter(seg => seg.fim > seg.inicio);
}

function calcularResumoNormalizadoGrupoPeriodo(label, equipamentosGrupo, periodo, historicos, paradas, extra = {}) {
  const totalEquipamentos = equipamentosGrupo.length;
  const bruto = {
    "Disponível": 0,
    "Indisponível": 0,
    "Tombado (Acidente)": 0
  };
  const equipamentosPorStatus = {
    "Disponível": new Set(),
    "Indisponível": new Set(),
    "Tombado (Acidente)": new Set()
  };

  equipamentosGrupo.forEach(eq => {
    const temposEq = {
      "Disponível": 0,
      "Indisponível": 0,
      "Tombado (Acidente)": 0
    };

    calcularSegmentosEquipamentoNoPeriodo(eq, periodo, historicos, paradas).forEach(seg => {
      const status = statusSeguro(seg.status, "Disponível");
      const duracao = Math.max(0, new Date(seg.fim).getTime() - new Date(seg.inicio).getTime());
      bruto[status] += duracao;
      temposEq[status] += duracao;
    });

    STATUS_LISTA.forEach(status => {
      if ((temposEq[status] || 0) > 0) {
        equipamentosPorStatus[status].add(String(eq.id || eq.frota || Math.random()));
      }
    });
  });

  const divisor = totalEquipamentos > 0 ? totalEquipamentos : 1;
  const disponivelMs = totalEquipamentos > 0 ? bruto["Disponível"] / divisor : periodo.periodoMs;
  const indisponivelMs = totalEquipamentos > 0 ? bruto["Indisponível"] / divisor : 0;
  const tombadoMs = totalEquipamentos > 0 ? bruto["Tombado (Acidente)"] / divisor : 0;

  const totalNormalizado = Math.max(disponivelMs + indisponivelMs + tombadoMs, 1);
  const fator = periodo.periodoMs > 0 ? periodo.periodoMs / totalNormalizado : 1;

  const dispFinal = Math.max(0, disponivelMs * fator);
  const indispFinal = Math.max(0, indisponivelMs * fator);
  const tombFinal = Math.max(0, tombadoMs * fator);

  return {
    label,
    ...extra,
    totalEquipamentos,
    tempoAnalisadoMs: periodo.periodoMs,
    disponivelMs: dispFinal,
    indisponivelMs: indispFinal,
    tombadoMs: tombFinal,
    disponibilidade: periodo.periodoMs > 0 ? (dispFinal / periodo.periodoMs) * 100 : 0,
    indisponibilidade: periodo.periodoMs > 0 ? (indispFinal / periodo.periodoMs) * 100 : 0,
    tombadoPct: periodo.periodoMs > 0 ? (tombFinal / periodo.periodoMs) * 100 : 0,
    qtdDisponivel: equipamentosPorStatus["Disponível"].size,
    qtdIndisponivel: equipamentosPorStatus["Indisponível"].size,
    qtdTombado: equipamentosPorStatus["Tombado (Acidente)"].size
  };
}

function montarResumoPeriodo(periodo, historicos, paradas) {
  const lista = listaEquipamentosNormalizada();
  const totalEquipamentos = lista.length;

  const resumoGeral = calcularResumoNormalizadoGrupoPeriodo("Geral", lista, periodo, historicos, paradas, {
    totalEquipamentos
  });
  resumoGeral.totalEquipamentos = totalEquipamentos;

  const resumoCategorias = CATEGORIAS.map(cat => {
    const categoriaLabel = cat === "Trator" ? "Trator Nonino" : cat;
    const equipamentosCategoria = lista.filter(eq => eq.categoria_normalizada === cat);
    return calcularResumoNormalizadoGrupoPeriodo(categoriaLabel, equipamentosCategoria, periodo, historicos, paradas);
  }).filter(r => r.totalEquipamentos > 0);

  const gruposTipo = {};
  lista.forEach(eq => {
    const categoriaLabel = eq.categoria_normalizada === "Trator" ? "Trator Nonino" : eq.categoria_normalizada;
    const tipoRel = tipoParaRelatorio(eq);
    const chave = `${categoriaLabel}||${tipoRel}`;

    if (!gruposTipo[chave]) {
      gruposTipo[chave] = {
        categoria: categoriaLabel,
        tipo: tipoRel,
        equipamentos: []
      };
    }

    gruposTipo[chave].equipamentos.push(eq);
  });

  const resumoTipos = Object.values(gruposTipo)
    .map(g => calcularResumoNormalizadoGrupoPeriodo(`${g.categoria} - ${g.tipo}`, g.equipamentos, periodo, historicos, paradas, {
      categoria: g.categoria,
      tipo: g.tipo
    }))
    .sort((a, b) => String(a.label).localeCompare(String(b.label), "pt-BR"));

  return { resumoGeral, resumoCategorias, resumoTipos };
}

function textoQuantidadeEquipamentos(qtd) {
  const n = Number(qtd) || 0;
  return `${n} equipamento${n === 1 ? "" : "s"}`;
}

function criarCanvasPizzaPeriodo(resumo, titulo = "Disponibilidade do período") {
  const canvas = document.createElement("canvas");
  canvas.width = 980;
  canvas.height = 540;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "#d1d5db";
  ctx.lineWidth = 2;
  ctx.strokeRect(12, 12, canvas.width - 24, canvas.height - 24);

  ctx.fillStyle = "#064e3b";
  ctx.font = "bold 28px Arial";
  quebrarTextoCanvas(ctx, titulo || "Resumo", 36, 55, 440, 32);

  const dados = [
    { status: "Disponível", valor: resumo.disponivelMs || 0, qtd: resumo.qtdDisponivel || 0 },
    { status: "Indisponível", valor: resumo.indisponivelMs || 0, qtd: resumo.qtdIndisponivel || 0 },
    { status: "Tombado (Acidente)", valor: resumo.tombadoMs || 0, qtd: resumo.qtdTombado || 0 }
  ];

  const total = dados.reduce((soma, item) => soma + item.valor, 0);
  const cx = 280;
  const cy = 292;
  const raio = 155;
  let anguloInicial = -Math.PI / 2;

  if (total <= 0) {
    ctx.fillStyle = "#374151";
    ctx.font = "22px Arial";
    ctx.fillText("Sem dados", 210, 285);
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
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 5;
      ctx.stroke();
    }
    anguloInicial += angulo;
  });

  ctx.beginPath();
  ctx.arc(cx, cy, 58, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.strokeStyle = "#e5e7eb";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "#064e3b";
  ctx.font = "bold 24px Arial";
  ctx.textAlign = "center";
  ctx.fillText("Período", cx, cy - 4);
  ctx.font = "15px Arial";
  ctx.fillStyle = "#6b7280";
  ctx.fillText("tempo", cx, cy + 22);
  ctx.textAlign = "left";

  let y = 165;
  ctx.font = "bold 18px Arial";
  ctx.fillStyle = "#111827";
  ctx.fillText("Composição por tempo", 560, y - 28);

  dados.forEach(item => {
    const percentual = total > 0 ? (item.valor / total * 100).toFixed(1) : "0.0";
    const label = item.status === "Tombado (Acidente)" ? "Tombado" : item.status;

    ctx.fillStyle = CORES_STATUS[item.status];
    ctx.fillRect(560, y - 16, 22, 22);

    ctx.fillStyle = "#111827";
    ctx.font = "bold 18px Arial";
    ctx.fillText(label, 595, y);

    ctx.fillStyle = "#374151";
    ctx.font = "15px Arial";
    ctx.fillText(`${msParaTexto(item.valor)} • ${textoQuantidadeEquipamentos(item.qtd)} — ${percentual}%`, 595, y + 25);

    y += 78;
  });

  ctx.fillStyle = "#6b7280";
  ctx.font = "14px Arial";
  ctx.fillText("Cálculo baseado no histórico e paradas do período selecionado", 560, 455);

  return canvas;
}

function linhasResumoCategoriaPeriodo(resumos) {
  return resumos.map(r => [
    r.label,
    r.totalEquipamentos,
    msParaTexto(r.tempoAnalisadoMs),
    `${msParaTexto(r.disponivelMs)} (${r.qtdDisponivel || 0})`,
    pctPeriodo(r.disponivelMs, r.tempoAnalisadoMs),
    `${msParaTexto(r.indisponivelMs)} (${r.qtdIndisponivel || 0})`,
    pctPeriodo(r.indisponivelMs, r.tempoAnalisadoMs),
    `${msParaTexto(r.tombadoMs)} (${r.qtdTombado || 0})`,
    pctPeriodo(r.tombadoMs, r.tempoAnalisadoMs)
  ]);
}

function linhasResumoTipoPeriodo(resumos) {
  return resumos.map(r => [
    r.categoria,
    r.tipo,
    r.totalEquipamentos,
    msParaTexto(r.tempoAnalisadoMs),
    `${msParaTexto(r.disponivelMs)} (${r.qtdDisponivel || 0})`,
    pctPeriodo(r.disponivelMs, r.tempoAnalisadoMs),
    `${msParaTexto(r.indisponivelMs)} (${r.qtdIndisponivel || 0})`,
    pctPeriodo(r.indisponivelMs, r.tempoAnalisadoMs),
    `${msParaTexto(r.tombadoMs)} (${r.qtdTombado || 0})`,
    pctPeriodo(r.tombadoMs, r.tempoAnalisadoMs)
  ]);
}
