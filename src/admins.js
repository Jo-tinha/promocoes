// Administradores do Buba Promo por e-mail.
// Só vale para e-mail VERIFICADO (login com Google, ou conta com senha que clicou no link de verificação);
// assim ninguém vira admin só por criar uma conta com um desses endereços.
// Ao mudar esta lista, mude também a função admin() em firestore.rules e publique as regras.
export const EMAILS_ADMIN = ['bedimjoaovictor@gmail.com', 'bobapromo@gmail.com'];

export function emailEhAdmin(usuario) {
  return Boolean(usuario?.emailVerified && EMAILS_ADMIN.includes(String(usuario.email).toLowerCase()));
}
