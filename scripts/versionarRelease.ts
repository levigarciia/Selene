export {};

const numero = process.env.GITHUB_RUN_NUMBER;
if (!numero || !/^[1-9]\d*$/.test(numero)) throw new Error('Número da execução do GitHub inválido.');
if (!process.env.GITHUB_OUTPUT) throw new Error('Destino das saídas do GitHub ausente.');
const arquivo = Bun.file('package.json');
const pacote = await arquivo.json();
const versao = `1.0.${numero}`;
pacote.version = versao;
await Bun.write(arquivo, `${JSON.stringify(pacote, null, 4)}\n`);
await Bun.write(process.env.GITHUB_OUTPUT, `valor=${versao}\n`);
console.log(`Versão da distribuição: ${versao}`);
