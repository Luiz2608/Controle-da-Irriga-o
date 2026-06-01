let equipamentos = [];
let historico = [];
let graficos = {};

const STATUS_LISTA = [
  "Disponível",
  "Indisponível",
  "Tombado (Acidente)"
];

const CORES_STATUS = {
  "Disponível": "#16a34a",
  "Indisponível": "#dc2626",
  "Tombado (Acidente)": "#374151"
};

function normalizarStatus(status) {
  if (status === "Operando") return "Disponível";
  if (status === "Em manutenção") return "Indisponível";
  if (status === "Parado sem previsão") return "Indisponível";
  if (status === "Tombado/Inativo") return "Tombado (Acidente)";
  if (status === "Tombado") return "Tombado (Acidente)";
  return status || "Indisponível";
}

function mostrarTela(id) {
  document.querySelectorAll(".tela").forEach(tela => tela.classList.remove("ativa"));
  document.getElementById(id).classList.add("ativa");

  if (id === "dashboard") {
    setTimeout(desenharGraficosDashboard, 120);
  }

  if (id === "relatorio") {
    gerarRelatorio();
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

  setTimeout(desenharGraficosDashboard, 120);
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

function classeStatus(status) {
  const s = normalizarStatus(status);
  if (s === "Disponível") return "status-disponivel";
  if (s === "Indisponível") return "status-indisponivel";
  if (s === "Tombado (Acidente)") return "status-tombado";
  return "status-indisponivel";
}

function badgeStatus(status) {
  const s = normalizarStatus(status);
  return `<span class="status-badge ${classeStatus(s)}">${escaparHTML(s)}</span>`;
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
  setTimeout(desenharGraficosDashboard, 120);
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
    if (situacao) situacao.placeholder = "Ex: disponível no pátio ou em operação";
    return;
  }

  campoProblema?.classList.remove("campo-oculto");
  campoOS?.classList.remove("campo-oculto");

  if (status === "Tombado (Acidente)") {
    campoPrevisao?.classList.add("campo-oculto");
    if (previsao) previsao.value = "";
    if (situacao) situacao.placeholder = "Ex: tombado, aguardando avaliação";
  } else {
    campoPrevisao?.classList.remove("campo-oculto");
    if (situacao) situacao.placeholder = "Ex: aguardando peça, oficina, manutenção";
  }
}

async function salvarEquipamento() {
  const id = document.getElementById("idEquipamento").value;

  const dados = {
    frota: document.getElementById("frota").value.trim(),
    tipo: document.getElementById("tipo").value.trim(),
    categoria: document.getElementById("categoria").value,
    placa: document.getElementById("placa").value.trim(),
    status: normalizarStatus(document.getElementById("status").value),
    situacao: document.getElementById("situacao").value.trim(),
    problema: document.getElementById("problema").value.trim(),
    ordem_servico: document.getElementById("ordemServico").value.trim(),
    previsao: document.getElementById("previsao").value.trim(),
    responsavel: document.getElementById("responsavel").value.trim(),
    ultima_atualizacao: new Date().toISOString()
  };

  if (dados.categoria !== "Caminhão") dados.placa = "";

  if (dados.status === "Disponível") {
    dados.problema = "";
    dados.ordem_servico = "";
    dados.previsao = "";
  }

  if (dados.status === "Tombado (Acidente)") {
    dados.previsao = "";
  }

  if (!dados.frota || !dados.tipo || !dados.responsavel) {
    alert("Preencha pelo menos Frota, Tipo e Responsável.");
    return;
  }

  if (!id) {
    const { error } = await supabaseClient.from("equipamentos").insert([dados]);
    if (error) {
      alert("Erro ao cadastrar. Verifique se a frota já existe.");
      return;
    }
    alert("Equipamento cadastrado com sucesso!");
  } else {
    const equipamentoAntigo = equipamentos.find(eq => eq.id == id);
    const { error } = await supabaseClient.from("equipamentos").update(dados).eq("id", id);
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
  const { error } = await supabaseClient.from("historico").insert([{
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
    observacao: observacao,
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
  document.getElementById("tipo").value = eq.tipo || "";
  document.getElementById("categoria").value = eq.categoria || "Caminhão";
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

async function atualizarStatusRapido(id) {
  const equipamento = equipamentos.find(eq => eq.id === id);
  if (!equipamento) return;

  const select = document.getElementById(`statusRapido_${id}`);
  const novoStatus = normalizarStatus(select.value);
  const statusAtual = normalizarStatus(equipamento.status);

  if (novoStatus === statusAtual) {
    alert("O status selecionado já é o status atual.");
    return;
  }

  const responsavel = prompt("Informe o responsável pela atualização:");
  if (!responsavel || responsavel.trim() === "") {
    alert("Responsável é obrigatório para atualizar o status.");
    select.value = statusAtual;
    return;
  }

  const confirmar = confirm(`Confirmar alteração da frota ${equipamento.frota} de "${statusAtual}" para "${novoStatus}"?`);
  if (!confirmar) {
    select.value = statusAtual;
    return;
  }

  const dadosAtualizados = {
    status: novoStatus,
    responsavel: responsavel.trim(),
    ultima_atualizacao: new Date().toISOString()
  };

  const dadosHistorico = {
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
    dadosHistorico.problema = "";
    dadosHistorico.ordem_servico = "";
    dadosHistorico.previsao = "";
  }

  if (novoStatus === "Tombado (Acidente)") {
    dadosAtualizados.previsao = "";
    dadosHistorico.previsao = "";
  }

  const { error } = await supabaseClient.from("equipamentos").update(dadosAtualizados).eq("id", id);
  if (error) {
    alert("Erro ao atualizar status: " + error.message);
    select.value = statusAtual;
    return;
  }

  await registrarHistoricoCompleto(equipamento, dadosHistorico, "Atualização rápida de status");
  alert("Status atualizado com sucesso!");
  await carregarEquipamentos();
}

function atualizarDashboard() {
  const total = equipamentos.length;
  const disponiveis = equipamentos.filter(eq => normalizarStatus(eq.status) === "Disponível").length;
  const indisponiveis = equipamentos.filter(eq => normalizarStatus(eq.status) === "Indisponível").length;
  const tombados = equipamentos.filter(eq => normalizarStatus(eq.status) === "Tombado (Acidente)").length;
  const percentual = total > 0 ? ((disponiveis / total) * 100).toFixed(1) : 0;

  document.getElementById("cardTotal").innerText = total;
  document.getElementById("cardDisponiveis").innerText = disponiveis;
  document.getElementById("cardIndisponiveis").innerText = indisponiveis;
  document.getElementById("cardTombados").innerText = tombados;
  document.getElementById("cardPercentual").innerText = percentual + "%";
  document.getElementById("heroDisponibilidade").innerText = percentual + "%";

  document.getElementById("totalCaminhoes").innerText = equipamentos.filter(eq => eq.categoria === "Caminhão").length;
  document.getElementById("totalTratores").innerText = equipamentos.filter(eq => eq.categoria === "Trator").length;
  document.getElementById("totalTanques").innerText = equipamentos.filter(eq => eq.categoria === "Tanque").length;
  document.getElementById("totalApoio").innerText = equipamentos.filter(eq => eq.categoria === "Apoio").length;
  document.getElementById("ultimaAtualizacaoHero").innerText = "Última atualização: " + buscarUltimaAtualizacao();

  renderizarTabelaParados();
}

function buscarUltimaAtualizacao() {
  if (equipamentos.length === 0) return "--";
  const datas = equipamentos.map(eq => eq.ultima_atualizacao).filter(data => data);
  if (datas.length === 0) return "--";
  datas.sort((a, b) => new Date(b) - new Date(a));
  return formatarData(datas[0]);
}

function contarStatus(lista) {
  return STATUS_LISTA.map(status => ({
    status,
    quantidade: lista.filter(eq => normalizarStatus(eq.status) === status).length
  }));
}

function destruirGrafico(nome) {
  if (graficos[nome]) {
    graficos[nome].destroy();
    graficos[nome] = null;
  }
}

function opcoesBarra() {
  const corTexto = corTextoAtual();
  const corGrid = corGridAtual();
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { enabled: true }
    },
    scales: {
      x: { ticks: { color: corTexto }, grid: { display: false } },
      y: { beginAtZero: true, ticks: { color: corTexto, precision: 0 }, grid: { color: corGrid } }
    }
  };
}

function opcoesPizza() {
  const corTexto = corTextoAtual();
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "bottom", labels: { color: corTexto, padding: 12, boxWidth: 14 } },
      tooltip: { enabled: true }
    }
  };
}

function criarGraficoBarra(canvasId, nomeGrafico) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  destruirGrafico(nomeGrafico);
  const dados = contarStatus(equipamentos);

  graficos[nomeGrafico] = new Chart(canvas, {
    type: "bar",
    data: {
      labels: dados.map(item => item.status),
      datasets: [{
        label: "Quantidade",
        data: dados.map(item => item.quantidade),
        backgroundColor: dados.map(item => CORES_STATUS[item.status]),
        borderRadius: 8,
        maxBarThickness: 70
      }]
    },
    options: opcoesBarra()
  });
}

function criarGraficoPizza(canvasId, nomeGrafico, lista, infoId, textoSemDados) {
  const canvas = document.getElementById(canvasId);
  const info = document.getElementById(infoId);
  if (!canvas) return;
  destruirGrafico(nomeGrafico);

  if (lista.length === 0) {
    canvas.style.display = "none";
    if (info) info.innerText = textoSemDados || "Nenhum equipamento cadastrado.";
    return;
  }

  canvas.style.display = "block";
  const dados = contarStatus(lista).filter(item => item.quantidade > 0);

  if (info) {
    const disponiveis = lista.filter(eq => normalizarStatus(eq.status) === "Disponível").length;
    const percentual = ((disponiveis / lista.length) * 100).toFixed(1);
    info.innerText = `Total: ${lista.length} | Disponibilidade: ${percentual}%`;
  }

  graficos[nomeGrafico] = new Chart(canvas, {
    type: "pie",
    data: {
      labels: dados.map(item => item.status),
      datasets: [{
        data: dados.map(item => item.quantidade),
        backgroundColor: dados.map(item => CORES_STATUS[item.status]),
        borderWidth: 2
      }]
    },
    options: opcoesPizza()
  });
}

function desenharGraficosDashboard() {
  criarGraficoBarra("graficoBarraStatus", "barraStatusDashboard");
  criarGraficoPizza("graficoPizzaGeral", "pizzaGeralDashboard", equipamentos, "infoPizzaGeral", "Nenhum equipamento cadastrado.");
  criarGraficoPizza("pizzaCaminhao", "pizzaCaminhaoDashboard", equipamentos.filter(eq => eq.categoria === "Caminhão"), "infoPizzaCaminhao", "Nenhum caminhão cadastrado.");
  criarGraficoPizza("pizzaTrator", "pizzaTratorDashboard", equipamentos.filter(eq => eq.categoria === "Trator"), "infoPizzaTrator", "Nenhum trator cadastrado.");
  criarGraficoPizza("pizzaTanque", "pizzaTanqueDashboard", equipamentos.filter(eq => eq.categoria === "Tanque"), "infoPizzaTanque", "Nenhum tanque cadastrado.");
  criarGraficoPizza("pizzaApoio", "pizzaApoioDashboard", equipamentos.filter(eq => eq.categoria === "Apoio"), "infoPizzaApoio", "Nenhum equipamento de apoio cadastrado.");
}

function renderizarTabelaParados() {
  const tbody = document.getElementById("tabelaParados");
  tbody.innerHTML = "";

  const lista = equipamentos.filter(eq => normalizarStatus(eq.status) !== "Disponível");
  if (lista.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7">✅ Nenhum equipamento indisponível ou tombado no momento.</td></tr>`;
    return;
  }

  lista.forEach(eq => {
    tbody.innerHTML += `
      <tr>
        <td><strong>${escaparHTML(eq.frota)}</strong></td>
        <td>${escaparHTML(eq.categoria)}</td>
        <td>${badgeStatus(eq.status)}</td>
        <td>${escaparHTML(eq.problema)}</td>
        <td>${escaparHTML(eq.ordem_servico)}</td>
        <td>${escaparHTML(eq.previsao)}</td>
        <td>${escaparHTML(eq.responsavel)}</td>
      </tr>`;
  });
}

function renderizarTabelaEquipamentos() {
  const tbody = document.getElementById("tabelaEquipamentos");
  if (!tbody) return;

  const filtroFrota = document.getElementById("filtroFrota")?.value.toLowerCase() || "";
  const filtroCategoria = document.getElementById("filtroCategoria")?.value || "";
  const filtroStatus = document.getElementById("filtroStatus")?.value || "";

  let lista = equipamentos.filter(eq => {
    const frota = String(eq.frota || "").toLowerCase();
    const statusNormalizado = normalizarStatus(eq.status);
    return frota.includes(filtroFrota) &&
      (!filtroCategoria || eq.categoria === filtroCategoria) &&
      (!filtroStatus || statusNormalizado === filtroStatus);
  });

  tbody.innerHTML = "";
  if (lista.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9">Nenhum equipamento encontrado.</td></tr>`;
    return;
  }

  lista.forEach(eq => {
    const statusAtual = normalizarStatus(eq.status);
    const opcoesStatus = STATUS_LISTA.map(status => {
      const selected = status === statusAtual ? "selected" : "";
      return `<option ${selected}>${status}</option>`;
    }).join("");

    tbody.innerHTML += `
      <tr>
        <td><strong>${escaparHTML(eq.frota)}</strong></td>
        <td>${escaparHTML(eq.tipo)}</td>
        <td>${escaparHTML(eq.categoria)}</td>
        <td>${badgeStatus(eq.status)}</td>
        <td>${escaparHTML(eq.problema)}</td>
        <td>${escaparHTML(eq.ordem_servico)}</td>
        <td>${escaparHTML(eq.previsao)}</td>
        <td>
          <select class="select-rapido" id="statusRapido_${eq.id}">${opcoesStatus}</select>
          <button class="btn-rapido" onclick="atualizarStatusRapido(${eq.id})">Atualizar</button>
        </td>
        <td>
          <button class="btn-editar" onclick="editarEquipamento(${eq.id})">Editar</button>
          <button class="btn-excluir" onclick="excluirEquipamento(${eq.id})">Excluir</button>
        </td>
      </tr>`;
  });
}

function gerarRelatorio() {
  const total = equipamentos.length;
  const disponiveis = equipamentos.filter(eq => normalizarStatus(eq.status) === "Disponível").length;
  const indisponiveis = equipamentos.filter(eq => normalizarStatus(eq.status) === "Indisponível").length;
  const tombados = equipamentos.filter(eq => normalizarStatus(eq.status) === "Tombado (Acidente)").length;

  const percDisponivel = total > 0 ? ((disponiveis / total) * 100).toFixed(1) : 0;
  const percIndisponivel = total > 0 ? ((indisponiveis / total) * 100).toFixed(1) : 0;
  const percTombados = total > 0 ? ((tombados / total) * 100).toFixed(1) : 0;

  let texto = `🚛 RELATÓRIO DE DISPONIBILIDADE DA IRRIGAÇÃO

📅 Atualizado em: ${new Date().toLocaleString("pt-BR")}

📊 Total geral de equipamentos: ${total}

✅ Disponíveis: ${disponiveis}
📈 Porcentagem disponível: ${percDisponivel}%

❌ Indisponíveis: ${indisponiveis}
📉 Porcentagem indisponível: ${percIndisponivel}%

⚫ Tombados (Acidente): ${tombados}
📉 Porcentagem tombados: ${percTombados}%

━━━━━━━━━━━━━━━━━━
`;

  const categorias = {
    "Caminhão": "🚛 CAMINHÕES",
    "Trator": "🚜 TRATORES",
    "Tanque": "🛢️ TANQUES",
    "Apoio": "🛠️ APOIO"
  };

  Object.keys(categorias).forEach(categoria => {
    texto += `\n${categorias[categoria]}\n\n`;
    const lista = equipamentos.filter(eq => eq.categoria === categoria && normalizarStatus(eq.status) !== "Disponível");
    if (lista.length === 0) {
      texto += "✅ Nenhum equipamento indisponível.\n";
    } else {
      lista.forEach(eq => {
        texto += `• Frota ${eq.frota} – ${normalizarStatus(eq.status)} – ${eq.problema || "Sem observação"} – OS ${eq.ordem_servico || "Sem OS"} – Previsão ${eq.previsao || "Sem previsão"}\n`;
      });
    }
  });

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
  if (equipamentos.length === 0) {
    alert("Nenhum equipamento para exportar.");
    return;
  }

  const dados = equipamentos.map(eq => ({
    Frota: eq.frota || "",
    Tipo: eq.tipo || "",
    Categoria: eq.categoria || "",
    Placa: eq.placa || "",
    Status: normalizarStatus(eq.status),
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
  const data = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(arquivo, `controle_irrigacao_${data}.xlsx`);
}

function exportarPDF() {
  if (equipamentos.length === 0) {
    alert("Nenhum equipamento para exportar.");
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  const total = equipamentos.length;
  const disponiveis = equipamentos.filter(eq => normalizarStatus(eq.status) === "Disponível").length;
  const percentual = total > 0 ? ((disponiveis / total) * 100).toFixed(1) : 0;

  doc.setFontSize(16);
  doc.text("Relatório de Disponibilidade da Irrigação", 14, 15);
  doc.setFontSize(10);
  doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, 14, 22);
  doc.text(`Total de equipamentos: ${total}`, 14, 28);
  doc.text(`Disponibilidade geral: ${percentual}%`, 14, 34);

  const linhas = equipamentos.map(eq => [
    eq.frota || "",
    eq.tipo || "",
    eq.categoria || "",
    normalizarStatus(eq.status),
    eq.problema || "",
    eq.ordem_servico || "",
    eq.previsao || "",
    eq.responsavel || ""
  ]);

  doc.autoTable({
    head: [["Frota", "Tipo", "Categoria", "Status", "Problema", "OS", "Previsão", "Responsável"]],
    body: linhas,
    startY: 42,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [6, 78, 59] }
  });

  const data = new Date().toISOString().slice(0, 10);
  doc.save(`relatorio_irrigacao_${data}.pdf`);
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
  const tbody = document.getElementById("tabelaHistorico");
  tbody.innerHTML = "";

  if (historico.length === 0) {
    tbody.innerHTML = `<tr><td colspan="11">Nenhuma alteração registrada ainda.</td></tr>`;
    return;
  }

  historico.forEach(item => {
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
      </tr>`;
  });
}

document.addEventListener("DOMContentLoaded", () => {
  aplicarTemaSalvo();
  ajustarCamposFormulario();
  carregarEquipamentos();
});
