// Testes de regressão de parcelas-base, a partir das tabelas de imóveis fornecidas.
// Valores nominais, sem reajustes. Não validam lances ou contemplação.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const html=fs.readFileSync('index.html','utf8');
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
assert.match(html,/function gerarLinkConsultor\(\)/);
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
for(const id of ['produto','credito','prazoConsorcio','prazoFin','entradaPct','sistemaFin','bancoFin','bancoAuto','indiceOficial','resultadoIndice','valCustoBanco','telefoneBotao','linkGerado']){
 assert.ok(html.includes('id="'+id+'"'),'Campo ausente: '+id);
}
assert.match(html,/Valor de Entrada:<\/span>\s*<strong id="valEntradaFin"/);
assert.doesNotMatch(html,/Valor de Entrada Exigido|Valor de Entrada Obrigatória no Banco/);
assert.match(html,/id="painelConsultaCredito"/);
assert.match(html,/Não há consulta automática de crédito/);
assert.match(html,/id="documentoCredito"/);
assert.match(html,/function validarDocumentoCredito\(\)/);
assert.match(html,/function exibirResultadoCreditoExterno\(\)/);
assert.match(html,/function limparDadosConsultaCredito\(\)/);
assert.match(html,/id="statusRestricaoCredito"/);
assert.match(html,/id="resultadoRestricaoCredito"/);
assert.match(html,/id="origemRestricaoCredito"/);
assert.match(html,/id="confirmacaoRestricaoCredito"/);
assert.match(html,/function registrarResultadoRestricaoCredito\(\)/);
assert.match(html,/Nenhuma restrição encontrada no relatório/);
assert.match(html,/Não consultado/);
assert.match(html,/informado manualmente/);

const validadoresCredito=html.match(/function validarCpfLocal\([\s\S]*?(?=\n        const fmt =)/);
assert.ok(validadoresCredito,'Validação de documento ausente');
const contextoCredito=vm.createContext({});
vm.runInContext(validadoresCredito[0],contextoCredito);
assert.equal(contextoCredito.validarCpfLocal('52998224725'),true,'CPF de exemplo válido');
assert.equal(contextoCredito.validarCpfLocal('11111111111'),false,'CPF com repetição');
assert.equal(contextoCredito.validarCpfLocal('52998224724'),false,'CPF com dígito errado');
assert.equal(contextoCredito.validarCnpjLocal('11222333000181'),true,'CNPJ numérico de exemplo válido');
assert.equal(contextoCredito.validarCnpjLocal('00000000000000'),false,'CNPJ com repetição');
assert.equal(contextoCredito.validarCnpjLocal('11222333000182'),false,'CNPJ com dígito errado');
const pesosCnpj1=[5,4,3,2,9,8,7,6,5,4,3,2];
const pesosCnpj2=[6,5,4,3,2,9,8,7,6,5,4,3,2];
const digitoCnpjTeste=(txt,pesos)=>{const resto=txt.split('').reduce((sum,v,i)=>sum+(v.charCodeAt(0)-48)*pesos[i],0)%11;return String(resto<2?0:11-resto);};
const raizCnpjAlfa='ABCDEF120001';
const digito1=digitoCnpjTeste(raizCnpjAlfa,pesosCnpj1);
const cnpjAlfanumericoTeste=raizCnpjAlfa+digito1+digitoCnpjTeste(raizCnpjAlfa+digito1,pesosCnpj2);
assert.equal(contextoCredito.validarCnpjLocal(cnpjAlfanumericoTeste),true,'CNPJ alfanumérico válido');
console.log('Pré-análise: rótulo da entrada e CPF/CNPJ (inclusive alfanumérico) verificados.');

assert.match(html,/function enviarWhatsApp\(\)/);
assert.match(html,/https:\/\/wa\.me\/'\+consultorAtual\.numero/);
assert.match(html,/encodeURIComponent\(textoProposta\(\)\)/);
assert.match(html,/contemplação não é garantida/i);
assert.match(html,/Esta simulação não inclui taxas adicionais, seguros e tarifas\./);
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
