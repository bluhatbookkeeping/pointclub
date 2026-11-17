// No logins: each browser keeps a random id per room.
// `&p=2` in the URL gives a separate identity, so one browser can test as several people.
const slot = () => new URLSearchParams(location.search).get('p') ?? ''
const key = (roomId: string) => `pointclub:me:${roomId}${slot() ? ':' + slot() : ''}`
export function getMyId(roomId: string): string {
  try {
    let id = localStorage.getItem(key(roomId))
    if (!id) { id = crypto.randomUUID(); localStorage.setItem(key(roomId), id) }
    return id
  } catch { return 'guest-' + Math.random().toString(36).slice(2) }
}
/** "Been here before? Tap your name": this browser becomes that existing person. */
export function setMyId(roomId: string, id: string) {
  try { localStorage.setItem(key(roomId), id) } catch { /* ignore */ }
}
export function forgetMe(roomId: string) {
  try { localStorage.removeItem(key(roomId)) } catch { /* ignore */ }
}
export const uid = () => crypto.randomUUID()
