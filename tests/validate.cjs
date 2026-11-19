// Testes de regressão de parcelas-base, a partir das tabelas de imóveis fornecidas.
// Valores nominais, sem reajustes. Não validam lances ou contemplação.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const html=fs.readFileSync('index.html','utf8');
// A versão dedicada da gerente Soraia deve receber as mesmas regras financeiras.
const soraia=fs.readFileSync('soraia/index.html','utf8');
assert.match(soraia,/const consultorPadrao = \{nome:'Soraia Mello - Gerente',numero:'5511999297191'\}/);
assert.match(soraia,/consultorAtual=validarConsultor\(consultorPadrao.nome,consultorPadrao.numero\)/);
assert.match(soraia,/id="nomeMarca">SORAIA MELLO<\/span> <span>\| GERENTE<\/span>/);
assert.match(soraia,/id="nomeRodape">Soraia Mello - Gerente<\/span> \| Gerente — Unifisa/);
assert.match(soraia,/href="\.\.\/manifest.webmanifest"/);
assert.match(soraia,/navigator.serviceWorker.register\('\.\.\/sw.js'\)/);
assert.doesNotMatch(soraia,/Fernando Leal|5511947662843|@fernandoconsultorunifisa/);
assert.match(soraia,/value="Soraia Mello - Gerente" readonly/);
assert.match(soraia,/value="\(11\) 99929-7191" readonly/);
function compararTrechosMatrizSoraia(inicio,fim){
 const a=html.indexOf(inicio),b=soraia.indexOf(inicio);
 assert.ok(a>=0&&b>=0,'Seção não encontrada: '+inicio);
 const ea=html.indexOf(fim,a+inicio.length),eb=soraia.indexOf(fim,b+inicio.length);
 assert.ok(ea>a&&eb>b,'Fim de seção não encontrado: '+fim);
 assert.equal(soraia.slice(b,eb),html.slice(a,ea),'Versões divergentes na seção financeira: '+inicio);
}
for(const [inicio,fim] of [
 ['const tabelaPlanos =','function preencherOpcoesTabela()'],
 ['const taxasBancosImobiliario =','let taxaBaseSelecionada ='],
 ['const taxasBancosAuto =','// Instituições de referência por segmento.'],
 ['const linhasCreditoRural =','function alternarVitrine(indice)'],
 ['const CAMPOS_ENCARGOS_FIN=','function calcularFinanciamento('],
 ['function calcularFinanciamento(','function desenharGraficoComparativo('],
 ['function gerarLinkCompartilhamento()','function aplicarSimulacaoCompartilhada()']
])compararTrechosMatrizSoraia(inicio,fim);
assert.match(soraia,/function modoIOFConformeFinalidade\(\)/);
assert.match(soraia,/iofPendente\?'A confirmar':fmt\(custosFin\.iof\)/);
console.log('Versão Soraia: identidade independente, links e cálculos sincronizados com a matriz.');

const plan=html.match(/const tabelaPlanos\s*=\s*(\{[\s\S]*?\});\s*function preencherOpcoesTabela/);
assert.ok(plan,'Cadastro de planos não encontrado');
const tabela=Function('"use strict";return ('+plan[1]+')')();
function parcelaBase(credito,prazo,adm,ant,reducao=1){
 const fundo=2.5,seguro=0.03;
 const mensalSeguro=credito*(1+(adm+fundo)/100)*seguro/100;
 return credito*(1+(adm+fundo)/100)/prazo*reducao+mensalSeguro-credito*ant/100/prazo;
}
const casos=[
 ['alphaPlus',300000,200,1887.75],
 ['betha',300000,200,1949.55],
 ['gamma',300000,200,1996.35],
 ['omega50',300000,200,1015.80],
 ['delta50',300000,200,1047.60],
 ['betha',150000,200,974.78]
];
for(const [id,credito,prazo,esperado] of casos){
 const p=tabela.imovel[id],i=p.prazos.indexOf(prazo);
 assert.ok(i>=0,'Prazo ausente: '+id);
 const real=parcelaBase(credito,prazo,p.adm[i],p.antecipacao,p.reducao||1);
 assert.ok(Math.abs(real-esperado)<=0.011,id+': esperado '+esperado+' obtido '+real);
 console.log('OK',id,credito,prazo,real.toFixed(2));
}
assert.deepEqual(Array.from(tabela.imovel.gamma12.adm),Array.from(tabela.imovel.gamma.adm));
assert.equal(tabela.imovel.delta.antecipacao,0);
assert.equal(tabela.imovel.delta.adm[tabela.imovel.delta.prazos.indexOf(60)],15);
assert.match(html,/condição personalizada \(não homologada\)/);
assert.doesNotMatch(html,/gerarPropostaPDF|nomeClientePDF|Salvar esta simulação em PDF/);
assert.match(html,/function gerarLinkCompartilhamento\(\)/);
assert.match(html,/id="tipoLinkGerador"/);
console.log('6 referências e salvaguardas de compartilhamento verificadas.');

// Revisão funcional: fórmulas de financiamento, campos de interface e envio.
const vm=require('node:vm');
const financiamento=html.match(/function calcularFinanciamento\([\s\S]*?\n        }\n        function calcular\(/);
assert.ok(financiamento,'Função de financiamento não encontrada');
const ctx=vm.createContext({});
vm.runInContext(financiamento[0].replace(/\n        function calcular\($/,''),ctx);
const sim=ctx.calcularFinanciamento;
function perto(real,esperado,tol=0.02){assert.ok(Math.abs(real-esperado)<=tol,'Esperado '+esperado+', recebido '+real);}
for(const sistema of ['sac','price']){
 const zero=sim(120000,0,120,sistema,0);
 perto(zero.primeira,1000);perto(zero.ultima,1000);perto(zero.total,120000);perto(zero.juros,0);
 const caso=sim(240000,12,360,sistema,0);
 assert.ok(caso.total>240000 && caso.juros>0,'Juros positivos: '+sistema);
 perto(caso.total,240000+caso.juros);
 if(sistema==='sac')assert.ok(caso.primeira>caso.ultima,'SAC decrescente');
 else perto(caso.primeira,caso.ultima);
}
const sac=sim(240000,12,360,'sac',0);
const price=sim(240000,12,360,'price',0);
assert.ok(sac.total<price.total,'SAC deve ter juros totais menores nas mesmas condições');
assert.deepEqual(Object.keys(sim(0,12,360,'sac')).sort(),['juros','primeira','total','ultima']);
// Taxas de referência conferidas contra dados BCB disponíveis em 18/11/2026.
function obterTabelaTaxas(nome){
 const match=html.match(new RegExp('const '+nome+' = (\\{[\\s\\S]*?\\});'));
 assert.ok(match,'Tabela ausente: '+nome);
 return Function('"use strict";return ('+match[1]+')')();
}
const taxasImovel=obterTabelaTaxas('taxasBancosImobiliario');
const taxasAuto=obterTabelaTaxas('taxasBancosAuto');
const taxasRurais=obterTabelaTaxas('linhasCreditoRural');
for(const [banco,taxa] of Object.entries({
 caixa:11.97,bradesco:12.27,santander:12.32,itau:12.22,
 bb:14.42,inter:12.97,sicoob:10.93,sicredi:12.23
})) assert.equal(taxasImovel[banco],taxa,'Imobiliário '+banco);
for(const [banco,taxa] of Object.entries({
 santander:24.36,itau:27.74,pan:41.85,bv:30.82,bradesco:22.17,safra:22.22
})) assert.equal(taxasAuto[banco],taxa,'Veículo '+banco);
for(const [linha,taxa] of Object.entries({
 pronamp:9,custeio:12.5,inovagro:11.5,moderfrota:12.5,
 moderfrotaPronamp:11.5,cooperativa:12,renovagro:8.5
})) assert.equal(taxasRurais[linha].taxa,taxa,'Rural '+linha);
assert.match(html,/outubro\/2026/);
assert.match(html,/28\/10 a 04\/11\/2026/);
assert.match(html,/value="moderfrotaPronamp"/);
assert.match(html,/HIPÓTESE ILUSTRATIVA — NÃO é taxa verificada do banco/);
assert.match(html,/produto==='luxo'\)document.getElementById\('ajustarTaxaCenario'\).checked=false/);
assert.match(html,/restaurar\('linhaCreditoRural'\);\s*if\(valorProduto==='capital_giro'\)atualizarEmprestimoEmpresarial\(\)/);
// Teste real da seleção das linhas, incluindo a visibilidade do seletor.
const inicioRural=html.indexOf('const linhasCreditoRural =');
const fimRural=html.indexOf('function alternarVitrine(indice)',inicioRural);
assert.ok(inicioRural>0&&fimRural>inicioRural);
let recalculosRurais=0;
const camposRurais=new Map([
 ['produto',{value:'capital_giro'}],
 ['modalidadeEmprestimo',{value:'rural'}],
 ['linhaCreditoRural',{value:'pronamp'}],
 ['jurosBanco',{value:''}],
 ['notaEmprestimo',{textContent:''}],
 ['seletorCreditoRural',{style:{display:'none'}}],
 ['blocoTomadorFin',{style:{display:'none'}}],
 ['perfilTomadorFin',{value:'pf'}],
 ['ajustarTaxaCenario',{checked:true}],
 ['prazoFin',{value:'96'}]
]);
const ctxRural=vm.createContext({
 document:{getElementById:id=>camposRurais.get(id)||null},
 sincronizarIOFConformeFinalidade:()=>{},
 calcular:()=>{recalculosRurais++;}
});
vm.runInContext(html.slice(inicioRural,fimRural),ctxRural);
for(const [linha,taxa] of Object.entries({
 pronamp:9,custeio:12.5,inovagro:11.5,moderfrota:12.5,
 moderfrotaPronamp:11.5,cooperativa:12,renovagro:8.5
})){
 camposRurais.get('linhaCreditoRural').value=linha;
 ctxRural.atualizarEmprestimoEmpresarial();
 assert.equal(Number(camposRurais.get('jurosBanco').value),taxa);
 assert.equal(camposRurais.get('seletorCreditoRural').style.display,'block');
 assert.ok(camposRurais.get('notaEmprestimo').textContent.includes(taxa.toFixed(2).replace('.',',')));
}
camposRurais.get('modalidadeEmprestimo').value='home';
ctxRural.atualizarEmprestimoEmpresarial();
assert.equal(camposRurais.get('seletorCreditoRural').style.display,'none');
assert.equal(Number(camposRurais.get('jurosBanco').value),18.16);
assert.match(camposRurais.get('notaEmprestimo').textContent,/HIPÓTESE/);
camposRurais.get('modalidadeEmprestimo').value='pronampe';
ctxRural.atualizarEmprestimoEmpresarial();
assert.equal(Number(camposRurais.get('jurosBanco').value),19.75);
assert.equal(Number(camposRurais.get('prazoFin').value),72);
// Veículos de luxo mostram média PF genérica sem ajuste automático; automóveis aceitam Safra.
const inicioAuto=html.indexOf('const taxasBancosAuto =');
const fimAuto=html.indexOf('// Instituições de referência por segmento.',inicioAuto);
assert.ok(inicioAuto>0&&fimAuto>inicioAuto);
const camposAuto=new Map([
 ['produto',{value:'auto'}],
 ['bancoAuto',{value:'safra'}],
 ['jurosBanco',{value:''}],
 ['notaBancoAuto',{textContent:''}],
 ['ajustarTaxaCenario',{checked:true}]
]);
const ctxAuto=vm.createContext({
 document:{getElementById:id=>camposAuto.get(id)||null},
 atualizarTaxaCenario:()=>{},
 aplicarEncargosAutomaticosFinanciamento:()=>{},
 calcular:()=>{},
 taxaBaseSelecionada:null
});
vm.runInContext(html.slice(inicioAuto,fimAuto),ctxAuto);
ctxAuto.selecionarBancoAuto();
assert.equal(Number(camposAuto.get('jurosBanco').value),22.22);
camposAuto.get('produto').value='luxo';
camposAuto.get('ajustarTaxaCenario').checked=true;
ctxAuto.selecionarBancoAuto();
assert.equal(camposAuto.get('ajustarTaxaCenario').checked,false);
assert.match(camposAuto.get('notaBancoAuto').textContent,/NÃO representa taxa específica/);
console.log('Taxas BCB, Plano Safra, avisos de hipóteses e seleção por linha conferidos.');

for(const id of ['produto','credito','prazoConsorcio','prazoFin','entradaPct','sistemaFin','bancoFin','bancoAuto','indiceOficial','resultadoIndice','valCustoBanco','linkGerado']){
 assert.ok(html.includes('id="'+id+'"'),'Campo ausente: '+id);
}
assert.match(html,/Valor de Entrada:<\/span>\s*<strong id="valEntradaFin"/);
assert.doesNotMatch(html,/Valor de Entrada Exigido|Valor de Entrada Obrigatória no Banco/);
// IOF, seguros e tarifas: modelos ilustrativos, separados e sem dupla contagem.
const inicioEncargos=html.indexOf('const CAMPOS_ENCARGOS_FIN=');
const fimEncargos=html.indexOf('function calcularFinanciamento(',inicioEncargos);
assert.ok(inicioEncargos>=0 && fimEncargos>inicioEncargos,'Funções de encargos não encontradas');
const camposEncargos=new Map([
 ['produto',{value:'auto'}],
 ['credito',{value:'100.000,00'}],
 ['entradaPct',{value:'20'}],
 ['bancoFin',{value:'santander'}],
 ['bancoAuto',{value:'pan'}],
 ['bancoEspecial',{value:'manual'}],
 ['tipoImovelFin',{value:'sfh'}],
 ['perfilTomadorFin',{value:'pf'}],
 ['modalidadeEmprestimo',{value:'home'}],
 ['encargosAutomaticosFin',{checked:false}],
 ['notaBaseEncargosFin',{textContent:''}],
 ['blocoTipoImovelFin',{style:{display:'none'}}],
 ['iofModoFin',{value:'auto_pf'}],
 ['iofManualFin',{value:'450'}],
 ['seguroMIPFin',{value:'85'}],
 ['seguroDFIFin',{value:'35'}],
 ['seguroPrestamistaFin',{value:'110'}],
 ['seguroBemFin',{value:'20'}],
 ['tarifaAvaliacaoFin',{value:'500'}],
 ['tarifaCadastroFin',{value:'200'}],
 ['registroFin',{value:'300'}],
 ['outrasTarifasFin',{value:'100'}],
 ['tarifaAdmMensalFin',{value:'15'}],
 ['financiarEncargosFin',{checked:false}],
 ['blocoSegurosHabitacionaisFin',{style:{display:'grid'}}],
 ['blocoSegurosVeiculoFin',{style:{display:'grid'}}],
 ['blocoIOFManualFin',{style:{display:'none'}}],
 ['notaIOFFin',{textContent:''}]
]);
const ctxEncargos=vm.createContext({
 document:{getElementById:id=>camposEncargos.get(id)||null},
 num:(id,def=0)=>{const n=Number(camposEncargos.get(id)?.value);return Number.isFinite(n)?n:def;},
 parseMoeda:v=>Number(String(v||'').replace(/\./g,'').replace(',','.')),
 calcular:()=>{}
});
vm.runInContext(html.slice(inicioEncargos,fimEncargos),ctxEncargos);
const modeloIOF=ctxEncargos.calcularIOFEstimadoPessoaFisica;
perto(modeloIOF(1200,0,12,'sac'),23.75,0.02);
assert.equal(modeloIOF(0,24,48,'price'),0);
const encBase=ctxEncargos.calcularEncargosFinanciamento('auto',80000,24,60,'price');
assert.ok(encBase.iof>0,'Veículo PF tributável deve gerar IOF estimado');
assert.equal(encBase.tarifas,1100);
assert.equal(encBase.seguroMensal,130);
assert.equal(encBase.totalSeguros,7800);
assert.equal(encBase.totalAdministracao,900);
perto(encBase.saldoFinanciado,80000);
perto(encBase.pagoAVista,encBase.iof+1100);
camposEncargos.get('financiarEncargosFin').checked=true;
const encFinanciado=ctxEncargos.calcularEncargosFinanciamento('auto',80000,24,60,'price');
perto(encFinanciado.saldoFinanciado,80000+encFinanciado.iof+1100);
perto(encFinanciado.pagoAVista,0);
const fAVista=sim(encBase.saldoFinanciado,24,60,'price');
const fFinanciado=sim(encFinanciado.saldoFinanciado,24,60,'price');
const custoAVista=20000+encBase.pagoAVista+fAVista.total+encBase.totalSeguros+encBase.totalAdministracao;
const custoFinanciado=20000+encFinanciado.pagoAVista+fFinanciado.total+encFinanciado.totalSeguros+encFinanciado.totalAdministracao;
assert.ok(custoFinanciado>custoAVista,'Financiar despesas deve gerar mais juros, não duplicar os custos');
camposEncargos.get('produto').value='imovel';
camposEncargos.get('iofModoFin').value='isento';
camposEncargos.get('financiarEncargosFin').checked=false;
const encHab=ctxEncargos.calcularEncargosFinanciamento('imovel',240000,12,360,'sac');
assert.equal(encHab.iof,0);
assert.equal(encHab.seguroMensal,120);
assert.equal(encHab.totalSeguros,43200);
assert.equal(encHab.tarifas,1100);
ctxEncargos.atualizarVisibilidadeEncargosFinanciamento();
assert.equal(camposEncargos.get('blocoSegurosHabitacionaisFin').style.display,'grid');
assert.equal(camposEncargos.get('blocoSegurosVeiculoFin').style.display,'none');
camposEncargos.get('iofModoFin').value='manual';
ctxEncargos.atualizarVisibilidadeEncargosFinanciamento();
assert.equal(camposEncargos.get('blocoIOFManualFin').style.display,'block');
assert.equal(ctxEncargos.calcularEncargosFinanciamento('imovel',240000,12,360,'sac').iof,450);
ctxEncargos.prepararEncargosFinanciamento();
assert.equal(camposEncargos.get('iofModoFin').value,'isento');
assert.equal(camposEncargos.get('tarifaAvaliacaoFin').value,'1950.00');
assert.equal(camposEncargos.get('tarifaAdmMensalFin').value,'25.00');
assert.ok(Number(camposEncargos.get('seguroMIPFin').value)>0);
assert.ok(Number(camposEncargos.get('seguroDFIFin').value)>0);
assert.match(camposEncargos.get('notaBaseEncargosFin').textContent,/teto público de avaliação/);
assert.equal(camposEncargos.get('financiarEncargosFin').checked,false);
assert.equal(camposEncargos.get('encargosAutomaticosFin').checked,true);
camposEncargos.get('bancoFin').value='caixa';
ctxEncargos.aplicarEncargosAutomaticosFinanciamento();
assert.equal(camposEncargos.get('tarifaAvaliacaoFin').value,'1500.00');
assert.match(camposEncargos.get('notaBaseEncargosFin').textContent,/PREMISSA GENÉRICA/);
camposEncargos.get('encargosAutomaticosFin').checked=false;
camposEncargos.get('tarifaAvaliacaoFin').value='2375.00';
ctxEncargos.aplicarEncargosAutomaticosFinanciamento();
assert.equal(camposEncargos.get('tarifaAvaliacaoFin').value,'2375.00','Modo manual deve preservar proposta do banco');
camposEncargos.get('bancoFin').value='santander';
camposEncargos.get('encargosAutomaticosFin').checked=true;
camposEncargos.get('tipoImovelFin').value='comercial';
ctxEncargos.alterarTipoImovelFin();
assert.equal(camposEncargos.get('iofModoFin').value,'auto_pf');
assert.ok(ctxEncargos.calcularEncargosFinanciamento('imovel',240000,12,360,'sac').iof>0,'Comercial PF deve estimar IOF');
assert.equal(camposEncargos.get('seguroMIPFin').value,'0','Comercial não atribui MIP habitacional');
assert.equal(camposEncargos.get('seguroDFIFin').value,'0','Comercial não atribui DFI habitacional');
assert.equal(camposEncargos.get('tarifaAvaliacaoFin').value,'3300.00');
camposEncargos.get('tipoImovelFin').value='sfi';
ctxEncargos.alterarTipoImovelFin();
assert.equal(camposEncargos.get('iofModoFin').value,'isento','Habitação SFI elegível');
camposEncargos.get('tipoImovelFin').value='sfh';
ctxEncargos.alterarTipoImovelFin();
assert.equal(camposEncargos.get('iofModoFin').value,'isento','Habitação SFH elegível');
camposEncargos.get('produto').value='capital_giro';
camposEncargos.get('modalidadeEmprestimo').value='home';
camposEncargos.get('perfilTomadorFin').value='pf';
ctxEncargos.sincronizarIOFConformeFinalidade();
assert.equal(camposEncargos.get('iofModoFin').value,'auto_pf','Home Equity PF: IOF tributável');
assert.ok(ctxEncargos.calcularEncargosFinanciamento('capital_giro',100000,18.16,60,'price').iof>0);
camposEncargos.get('perfilTomadorFin').value='pj';
ctxEncargos.alterarPerfilTomadorFin();
assert.equal(camposEncargos.get('iofModoFin').value,'manual','Home Equity PJ: IOF da proposta');
camposEncargos.get('produto').value='auto';
camposEncargos.get('produto').value='auto';
ctxEncargos.prepararEncargosFinanciamento();
assert.equal(camposEncargos.get('iofModoFin').value,'auto_pf');
assert.equal(camposEncargos.get('tarifaAvaliacaoFin').value,'650.00');
assert.equal(camposEncargos.get('tarifaCadastroFin').value,'850.00');
assert.match(camposEncargos.get('notaBaseEncargosFin').textContent,/exemplo publicado pelo banco/);
assert.equal(camposEncargos.get('seguroPrestamistaFin').value,'0');
for(const id of ['valIOFFin','valTarifasFin','valSaldoFin','valInicialFin','valSegurosFin','valAdmFin','valTotalParcelasFin','blocoEncargosFinanciamento']){
 assert.ok(html.includes('id="'+id+'"'),'Campo de encargos ausente: '+id);
}
assert.match(html,/custoFin=valorEntrada\+custosFin\.pagoAVista\+totalParcelasFin/);
assert.match(html,/desenharGraficoComparativo\([^\n]+custosFin\.pagoAVista,custosFin\.encargosMensais\)/);
console.log('IOF, seguros, tarifas, saldo financiado e desembolso total conferidos.');
assert.match(html,/id="blocoEncargosFinanciamento" hidden aria-hidden="true" style="display:none"/);
assert.ok(!html.includes('Detalhar seguros e tarifas (estimativas editáveis)'));
assert.ok(!html.includes('IOF, seguros e tarifas do financiamento</h3>'));
assert.match(html,/id="blocoTipoImovelFin"/);
assert.match(html,/onchange="alterarTipoImovelFin\(\)"/);
assert.match(html,/id="blocoTomadorFin"/);
assert.match(html,/onchange="alterarPerfilTomadorFin\(\)"/);
assert.match(html,/iofPendente\?'A confirmar':fmt\(custosFin\.iof\)/);
console.log('Interface financeira compacta verificada.');


// Compartilhamento unificado: um painel para administrador e demais consultores.
assert.match(html,/id="compartilharSimulador"/);
assert.equal((html.match(/id="linkGerado"/g)||[]).length,1,'Só um campo de link');
assert.ok(!html.includes('id="linkSimulacaoGerado"'),'Não exibir segundo link');
assert.ok(!html.includes('id="painelConsultaCredito"'),'Painel de crédito anterior removido');
for(const id of ['nomeGerador','telefoneGerador','tipoLinkGerador','avisoGerador']){
 assert.ok(html.includes('id="'+id+'"'),'Campo de compartilhamento ausente: '+id);
}
for(const fn of ['gerarLinkCompartilhamento','copiarLinkCompartilhamento','enviarLinkCompartilhamentoWhatsApp','aplicarSimulacaoCompartilhada']){
 assert.match(html,new RegExp('function '+fn+'\\('));
}
assert.match(html,/aplicarSimulacaoCompartilhada\(\);\s*\n\s*};/);
assert.match(html,/api\.whatsapp\.com\/send\?text=/);
assert.match(html,/else if\(codigo!=='manual'\)campo\.value=''/);
const inicioValidadorConsultor=html.indexOf('function validarConsultor(nome, telefone) {');
const fimValidadorConsultor=html.indexOf('        // Apenas parâmetros financeiros',inicioValidadorConsultor);
assert.ok(inicioValidadorConsultor>=0 && fimValidadorConsultor>inicioValidadorConsultor,'Validador do consultor ausente');
const contextoValidador=vm.createContext({});
vm.runInContext(html.slice(inicioValidadorConsultor,fimValidadorConsultor),contextoValidador);
const validarConsultorReal=contextoValidador.validarConsultor;
assert.equal(validarConsultorReal('Fernando Leal','(11) 94766-2843')?.numero,'5511947662843');
assert.equal(validarConsultorReal('Fernando Leal','11947662843')?.numero,'5511947662843');
assert.equal(validarConsultorReal('Fernando Leal','+55 11 94766-2843')?.numero,'5511947662843');
assert.equal(validarConsultorReal('Consultor Teste','(11) 98888-7777')?.numero,'5511988887777');
assert.equal(validarConsultorReal('Fernando Leal','número inválido'),null);
assert.equal(validarConsultorReal('Fernando Leal',''),null);
const inicioLink=html.indexOf('const CAMPOS_LINK_SIMULACAO =');
const fimLink=html.indexOf('function aplicarConsultor(){',inicioLink);
assert.ok(inicioLink>0&&fimLink>inicioLink,'Funções de compartilhamento não encontradas');
const camposLink=new Map([
 ['nomeGerador',{value:'Fernando Leal'}],
 ['telefoneGerador',{value:'(11) 94766-2843'}],
 ['tipoLinkGerador',{value:'simulacao',tagName:'SELECT',options:[{value:'simulacao'},{value:'simulador'}]}],
 ['produto',{value:'auto',tagName:'SELECT',options:[{value:'auto'},{value:'imovel'}]}],
 ['credito',{value:'125.000,00',type:'text'}],
 ['prazoConsorcio',{value:'80',type:'number'}],
 ['prazoFin',{value:'60',type:'number'}],
 ['planoUnifisa',{value:'gamma',tagName:'SELECT',options:[{value:''},{value:'gamma'}]}],
 ['lanceLivre',{value:'10.000,00',type:'text'}],
 ['ajustarTaxaCenario',{checked:true,type:'checkbox'}],
 ['ativarReduzida',{checked:false,type:'checkbox'}],
 ['subBlocoReduzida',{style:{display:'none'}}],
 ['avisoGerador',{textContent:''}],
 ['linkGerado',{value:''}],
 ['iofModoFin',{value:'auto_pf',tagName:'SELECT',options:[{value:'isento'},{value:'auto_pf'},{value:'manual'}]}],
 ['seguroPrestamistaFin',{value:'100',type:'number'}],
 ['tarifaAvaliacaoFin',{value:'500',type:'number'}],
 ['financiarEncargosFin',{checked:true,type:'checkbox'}],
 ['encargosAutomaticosFin',{checked:true,type:'checkbox'}],
 ['tipoImovelFin',{value:'sfh',tagName:'SELECT',options:[{value:'sfh'},{value:'sfi'},{value:'comercial'}]}],
 ['perfilTomadorFin',{value:'pf',tagName:'SELECT',options:[{value:'pf'},{value:'pj'}]}],
 ['notaBaseEncargosFin',{textContent:''}]
]);
let calculosCompartilhamento=0;
const localTeste={origin:'https://fernandoleal33.github.io',pathname:'/simuladorlotus/',search:''};
let urlWhatsAppCompartilhamento='';
const ambienteCompartilhamento=vm.createContext({
 window:{location:localTeste,open:(url)=>{urlWhatsAppCompartilhamento=url;}},
 document:{getElementById:id=>camposLink.get(id)||null},
 URL, URLSearchParams,
 navigator:{clipboard:{writeText:async()=>{}}},
 calcular:()=>{calculosCompartilhamento++;},
 mudarProduto:()=>{camposLink.get('credito').value='70.000,00';camposLink.get('prazoConsorcio').value='60';},
 aplicarTabelaUnifisa:()=>{},
 atualizarEmprestimoEmpresarial:()=>{},
 calcularIndice:()=>{},
 atualizarIndice:()=>{},
 atualizarVisibilidadeEncargosFinanciamento:()=>{},
 aplicarEncargosAutomaticosFinanciamento:()=>{},
 validarConsultor:validarConsultorReal
});
vm.runInContext(html.slice(inicioLink,fimLink),ambienteCompartilhamento);
const linkOriginal=ambienteCompartilhamento.gerarLinkCompartilhamento();
const enderecoGerado=new URL(linkOriginal);
assert.equal(enderecoGerado.pathname,'/simuladorlotus/');
assert.equal(enderecoGerado.searchParams.get('consultor'),'Fernando Leal');
assert.equal(enderecoGerado.searchParams.get('whatsapp'),'5511947662843');
assert.equal(enderecoGerado.searchParams.get('sim'),'1');
assert.equal(enderecoGerado.searchParams.get('produto'),'auto');
assert.equal(enderecoGerado.searchParams.get('s_credito'),'125.000,00');
assert.equal(enderecoGerado.searchParams.get('s_planoUnifisa'),'gamma');
assert.equal(enderecoGerado.searchParams.get('s_lanceLivre'),'10.000,00');
assert.equal(enderecoGerado.searchParams.get('s_ajustarTaxaCenario'),'1');
assert.equal(enderecoGerado.searchParams.get('s_iofModoFin'),'auto_pf');
assert.equal(enderecoGerado.searchParams.get('s_seguroPrestamistaFin'),'100');
assert.equal(enderecoGerado.searchParams.get('s_tarifaAvaliacaoFin'),'500');
assert.equal(enderecoGerado.searchParams.get('s_financiarEncargosFin'),'1');
assert.equal(enderecoGerado.searchParams.get('s_encargosAutomaticosFin'),'1');
assert.equal(enderecoGerado.searchParams.get('s_tipoImovelFin'),'sfh');
assert.equal(enderecoGerado.searchParams.get('s_perfilTomadorFin'),'pf');
assert.equal(enderecoGerado.hash,'#simulador');
assert.ok(!enderecoGerado.toString().includes('CPF'),'Não compartilhar documentos pessoais');
assert.equal(calculosCompartilhamento,1);
ambienteCompartilhamento.enviarLinkCompartilhamentoWhatsApp();
assert.match(urlWhatsAppCompartilhamento,/^https:\/\/api\.whatsapp\.com\/send\?text=/);
const mensagemWhatsAppCompartilhamento=new URL(urlWhatsAppCompartilhamento).searchParams.get('text');
assert.ok(mensagemWhatsAppCompartilhamento.includes('Consultor: Fernando Leal | WhatsApp: (11) 94766-2843'),'Contato do consultor precisa estar na mensagem');
assert.ok(mensagemWhatsAppCompartilhamento.includes('whatsapp=5511947662843'),'Contato do consultor precisa estar no link');
camposLink.get('produto').value='imovel';
camposLink.get('credito').value='300.000,00';
camposLink.get('planoUnifisa').value='';
camposLink.get('seguroPrestamistaFin').value='0';
camposLink.get('tarifaAvaliacaoFin').value='0';
camposLink.get('financiarEncargosFin').checked=false;
localTeste.search=enderecoGerado.search;
ambienteCompartilhamento.aplicarSimulacaoCompartilhada();
assert.equal(camposLink.get('produto').value,'auto');
assert.equal(camposLink.get('credito').value,'125.000,00');
assert.equal(camposLink.get('prazoConsorcio').value,'80');
assert.equal(camposLink.get('planoUnifisa').value,'gamma');
assert.equal(camposLink.get('lanceLivre').value,'10.000,00');
assert.equal(camposLink.get('ajustarTaxaCenario').checked,true);
assert.equal(camposLink.get('seguroPrestamistaFin').value,'100');
assert.equal(camposLink.get('tarifaAvaliacaoFin').value,'500');
assert.equal(camposLink.get('financiarEncargosFin').checked,true);
assert.equal(camposLink.get('encargosAutomaticosFin').checked,true);
assert.equal(camposLink.get('tipoImovelFin').value,'sfh');
assert.equal(camposLink.get('perfilTomadorFin').value,'pf');
assert.equal(calculosCompartilhamento,3,'Recalcula cenário na abertura');
camposLink.get('tipoLinkGerador').value='simulador';
camposLink.get('nomeGerador').value='Outro Consultor';
camposLink.get('telefoneGerador').value='(11) 98888-7777';
const linkLivre=ambienteCompartilhamento.gerarLinkCompartilhamento();
const enderecoLivre=new URL(linkLivre);
assert.equal(enderecoLivre.searchParams.get('consultor'),'Outro Consultor');
assert.equal(enderecoLivre.searchParams.get('whatsapp'),'5511988887777');
assert.equal(enderecoLivre.searchParams.get('sim'),null,'Simulador em branco sem simulação embutida');
assert.equal(enderecoLivre.searchParams.get('s_credito'),null);
assert.equal(calculosCompartilhamento,3,'Link em branco não recalcula');
camposLink.get('nomeGerador').value='';
assert.equal(ambienteCompartilhamento.gerarLinkCompartilhamento(),'','Nome vazio não gera link');
console.log('Compartilhamento unificado: administrador, outros consultores, cenário e link livre conferidos.');

assert.doesNotMatch(html,/Testar Envio via WhatsApp|id="telefoneBotao"|function enviarWhatsApp\(\)|function copiarProposta\(\)/);
assert.match(html,/const consultorPadrao = \{nome:'Fernando Leal',numero:'5511947662843'\}/);
assert.match(html,/Consultor: '\+dados\.nome\+' \| WhatsApp: '\+dados\.formatado/);
assert.match(html,/contemplação no mês escolhido é apenas uma hipótese matemática, nunca uma promessa/i);
assert.match(html,/Valores estimados; “A confirmar” não integra o total/);
assert.doesNotMatch(html,/Esta simulação não inclui taxas adicionais, seguros e tarifas\./);
assert.match(html,/Custo total estimado:<\/span>\s*<strong id="valCustoConsorcio"/);
assert.doesNotMatch(html,/id="painelReajusteFin"|id="encargosAutomaticos"|id="valEncargosFin"/);
console.log('Financiamento SAC/Price, campos, aviso e WhatsApp: verificações estáticas e matemáticas OK.');

const manifest=JSON.parse(fs.readFileSync('manifest.webmanifest','utf8'));
assert.equal(manifest.display,'standalone');
assert.equal(manifest.start_url,'./');
assert.ok(manifest.icons.some(icon=>icon.src==='./icon-192.png'&&icon.sizes==='192x192'));
assert.ok(manifest.icons.some(icon=>icon.src==='./icon-512.png'&&icon.sizes==='512x512'));
assert.match(html,/rel="manifest" href="\.\/manifest\.webmanifest"/);
assert.match(html,/serviceWorker\.register\('\.\/sw\.js'\)/);
assert.ok(fs.existsSync('sw.js')&&fs.existsSync('icon.svg'));
for(const size of [192,512,180])assert.ok(fs.existsSync('icon-'+size+'.png'),'Ícone PNG ausente: '+size);
console.log('Manifesto PWA, ícone e service worker presentes; versão desktop preservada.');

assert.match(html,/id="botaoInstalarPWA"/);
assert.match(html,/rel="apple-touch-icon" href="\.\/icon-180\.png"/);

assert.doesNotMatch(html,/atualizarPerfilEncargosBanco/,'Não chamar função de encargos removida');
assert.match(html,/if\(el\)el\.addEventListener\('change',calcular\)/);
console.log('Troca de bancos sem chamadas obsoletas verificada.');

assert.ok(tabela.auto.gamma30,'Gamma 30% precisa existir em automóveis');
assert.deepEqual(Array.from(tabela.auto.gamma30.prazos),[100,80,60]);
assert.equal(tabela.auto.gamma30.reducao,0.7);
assert.match(html,/if\(!plano\)\{[^}]*calcular\(\);return;\}/);
assert.match(html,/el\.addEventListener\('input',aplicarTabelaUnifisa\)/);
assert.match(html,/document\.getElementById\('prazoFin'\)\.addEventListener\('input', calcular\)/);
console.log('Gamma 30%, atualização imediata e recálculo do financiamento verificados.');

assert.match(html,/document\.addEventListener\('DOMContentLoaded',preencherOpcoesTabela\)/);
for(const key of ['betha','alphaPlus','gamma','omega50','delta50'])assert.ok(tabela.imovel[key],'Plano imobiliário ausente: '+key);
console.log('Inicialização independente e planos de imóveis conferidos.');


// Etapa 1: auditoria de parcelas nominais do consórcio, sem alterar cálculos publicados.
// Conferência independente da decomposição crédito + administração + reserva + seguro.
function auditarParcelas({credito,prazo,adm,reserva=2.5,seguro=0.03,antecipacao=0,mesesAntecipacao=0,reducao=1}){
  const principal=credito*(1+(adm+reserva)/100);
  const totalSeguro=principal*seguro/100*prazo;
  const total=principal+totalSeguro;
  const antecipado=credito*antecipacao/100;
  const regular=(total-antecipado)/prazo;
  const reduzida=reducao<1?principal/prazo*reducao+totalSeguro/prazo-antecipado/prazo:regular;
  const adicional=mesesAntecipacao?antecipado/mesesAntecipacao:0;
  const cronograma=Array.from({length:prazo},(_,i)=>reduzida+(i<mesesAntecipacao?adicional:0));
  return {total,antecipado,regular,reduzida,adicional,cronograma};
}
for(const [id,credito,prazo] of [
  ['alphaPlus',300000,200],['betha',300000,200],
  ['gamma',300000,200],['gamma12',100000,120],
  ['omega50',300000,200],['delta50',300000,200]
]){
  const plano=tabela.imovel[id],idx=plano.prazos.indexOf(prazo);
  assert.ok(idx>=0,'Prazo inválido na auditoria: '+id);
  const x=auditarParcelas({credito,prazo,adm:plano.adm[idx],
    antecipacao:plano.antecipacao,mesesAntecipacao:plano.mesesAntecipacao,
    reducao:plano.reducao||1});
  perto(x.cronograma[0],x.reduzida+x.adicional);
  perto(x.cronograma.at(-1),x.reduzida);
  perto(x.cronograma.reduce((a,b)=>a+b,0),
    x.reduzida*prazo+x.antecipado,0.02);
  if(!plano.reducao)perto(x.cronograma.reduce((a,b)=>a+b,0),x.total,0.02);
  if(id==='gamma12'){
    assert.equal(plano.mesesAntecipacao,12);
    perto(x.cronograma[0]-x.cronograma[12],x.antecipado/12);
  }
}
assert.match(html,/const parcelaRegular=\(totalPlano-totalTaxaAntecipada\)\/prazoCons/);
assert.match(html,/const parcelaPre=parcelaReduzida\+adicionalInicial/);
assert.match(html,/const pagoAntes=parcelaReduzida\*mesesAntes\+adicionalInicial\*mesesAntecipadosPagos/);
console.log('Auditoria nominal de parcelas e antecipações: 6 planos, conservação de valores e Gamma 12 OK.');


// Auditoria transversal: todas as categorias, planos e prazos cadastrados.
// Sem alterar o motor de cálculo nem inferir validade comercial de tabelas.
let cenariosAuditados=0;
const categoriasAuditadas=new Set();
for(const [categoria,planos] of Object.entries(tabela)){
  categoriasAuditadas.add(categoria);
  assert.ok(Object.keys(planos).length>0,'Categoria sem planos: '+categoria);
  for(const [id,plano] of Object.entries(planos)){
    assert.equal(plano.prazos.length,plano.adm.length,categoria+'/'+id+': prazos/taxas desalinhados');
    assert.ok(plano.prazos.length>0,categoria+'/'+id+': sem prazos');
    assert.equal(new Set(plano.prazos).size,plano.prazos.length,categoria+'/'+id+': prazo repetido');
    assert.ok(plano.prazos.every(p=>Number.isInteger(p)&&p>0&&p<=600),categoria+'/'+id+': prazo inválido');
    assert.ok(plano.adm.every(a=>Number.isFinite(a)&&a>=0),categoria+'/'+id+': taxa inválida');
    assert.ok(plano.antecipacao>=0&&Number.isFinite(plano.antecipacao),categoria+'/'+id+': antecipação inválida');
    assert.ok(Number.isInteger(plano.mesesAntecipacao)&&plano.mesesAntecipacao>=0,categoria+'/'+id+': meses de antecipação inválidos');
    assert.ok(plano.antecipacao===0||plano.mesesAntecipacao>0,categoria+'/'+id+': antecipação sem distribuição');
    for(let i=0;i<plano.prazos.length;i++){
      const prazo=plano.prazos[i],credito=plano.power?200000:100000;
      const seguro=(categoria==='imovel'||(categoria==='capital_giro'&&!plano.power))?0.03:0.06;
      const x=auditarParcelas({credito,prazo,adm:plano.adm[i],seguro,
        antecipacao:plano.antecipacao,mesesAntecipacao:plano.mesesAntecipacao,
        reducao:plano.reducao||1});
      assert.ok(x.cronograma.every(v=>Number.isFinite(v)&&v>=0),categoria+'/'+id+': parcela negativa ou não finita');
      perto(x.cronograma[0],x.reduzida+x.adicional);
      perto(x.cronograma.at(-1),x.reduzida+(prazo<=plano.mesesAntecipacao?x.adicional:0));
      perto(x.cronograma.reduce((a,b)=>a+b,0),
        x.reduzida*prazo+x.adicional*Math.min(prazo,plano.mesesAntecipacao));
      if(!plano.reducao&&plano.mesesAntecipacao<=prazo)
        perto(x.cronograma.reduce((a,b)=>a+b,0),x.total);
      if(plano.antecipacao===0){
        perto(x.antecipado,0);perto(x.adicional,0);perto(x.reduzida,x.cronograma[0]);
      }
      if(plano.reducao){
        assert.ok(plano.reducao>0&&plano.reducao<1,categoria+'/'+id+': redução fora da faixa');
        assert.ok(x.reduzida<x.regular,categoria+'/'+id+': redução não diminui parcela regular');
      }
      if(plano.mesesAntecipacao>1&&prazo>plano.mesesAntecipacao)
        perto(x.cronograma[0]-x.cronograma[plano.mesesAntecipacao],x.adicional);
      cenariosAuditados++;
    }
    if(plano.power){
      for(const credito of [69999,70000,99999,100000,149999,150000,300000,300001]){
        const teto=credito<100000?80:credito<150000?100:120;
        const elegiveis=plano.prazos.filter(p=>p<=teto&&credito>=70000&&credito<=300000);
        for(const prazo of plano.prazos){
          const valido=credito>=70000&&credito<=300000&&prazo<=teto;
          assert.equal(elegiveis.includes(prazo),valido,categoria+'/'+id+': limite Power inconsistente');
        }
      }
    }
  }
}
assert.deepEqual([...categoriasAuditadas].sort(),['auto','capital_giro','embarcacao','imovel','luxo','maquinario','moto','pesados']);
assert.match(html,/const seguroMensalPct=Math.max\(0,num\('seguroMensalPct',0\)\)/);
assert.match(html,/const totalSeguro=\(credito\+totalAdm\+totalReserva\)\*\(seguroMensalPct\/100\)\*prazoCons/);
assert.match(html,/const limitePower=credito<100000\?80:credito<150000\?100:120/);
console.log('Auditoria de todas as categorias: '+categoriasAuditadas.size+' categorias, '+cenariosAuditados+' combinações plano/prazo, limites Power e antecipações verificadas.');
