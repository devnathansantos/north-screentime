/** Lembretes simples em primeiro plano. Não é push remoto nem agendamento confiável em segundo plano. */
export async function requestNotificationPermission(){if(!('Notification' in globalThis))throw new Error('Notificações não são suportadas neste navegador.');return Notification.requestPermission();}
export function notify(title,body){if('Notification' in globalThis&&Notification.permission==='granted')new Notification(title,{body});else alert(`${title}\n${body}`);}
