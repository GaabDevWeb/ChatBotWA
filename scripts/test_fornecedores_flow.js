const interceptor = require('../src/middleware/menuInterceptor');
const clientsRepo = require('../src/repositories/clientsRepo');

async function run() {
  const user = '+5511999999999';
  // Garante que o cliente exista
  const cliente = await clientsRepo.getOrCreate(user);
  console.log('Cliente de teste criado:', cliente);

  const steps = [
    'Quero cadastrar fornecedor',
    'ACME Indústria Ltda',
    '12345678000195',
    'Materiais de embalagem',
    'https://acme.com/portfolio.pdf',
    'https://acme.com',
    'São Paulo, Guarulhos, Osasco',
    'Maria Silva - (11) 90000-0000 - maria@acme.com',
    'SIM'
  ];

  for (const msg of steps) {
    const reply = await interceptor.process(user, msg);
    console.log(`> ${msg}\n${reply}\n`);
  }
}

run().catch((e) => {
  console.error('Erro no teste:', e);
});