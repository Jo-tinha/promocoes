// Administradores do Buba Promo por e-mail.
// Só vale para e-mail VERIFICADO (login com Google, ou conta com senha que clicou no link de verificação);
// assim ninguém vira admin só por criar uma conta com um desses endereços.
// Ao mudar esta lista, mude também a função admin() em firestore.rules e publique as regras.
export const EMAILS_ADMIN = ['bedimjoaovictor@gmail.com', 'bobapromo@gmail.com'];

// Conta de TESTE: o e-mail não existe de verdade, então nunca é verificado — por isso fica numa lista
// à parte, sem exigir verificação. É seguro porque a conta já foi criada (o Firebase não deixa outra
// pessoa se cadastrar com o mesmo e-mail). Para tirar o acesso, apague daqui e de firestore.rules.
export const EMAILS_ADMIN_TESTE = ['teste.admin@bubapromo.test'];

export function emailEhAdmin(usuario) {
  const email = String(usuario?.email || '').toLowerCase();
  if (EMAILS_ADMIN_TESTE.includes(email)) return true;
  return Boolean(usuario?.emailVerified && EMAILS_ADMIN.includes(email));
}
