// DEV ONLY: open any page with ?noNotif=1 to behave like iPhone Safari/Chrome, which have no
// window.Notification. Remembered for the tab (sessionStorage) so it survives the login redirect;
// ?noNotif=0 turns it off. Imported first in main.jsx so it runs before any other module.
// `import.meta.env.DEV` is false in `npm run build`, so this is dropped from production.
if (import.meta.env.DEV) {
  try {
    const flag = new URLSearchParams(window.location.search).get('noNotif');
    if (flag === '1') sessionStorage.setItem('noNotif', '1');
    if (flag === '0') sessionStorage.removeItem('noNotif');
    if (sessionStorage.getItem('noNotif') === '1') {
      delete window.Notification;
      console.warn('[dev] window.Notification removed to simulate iPhone (?noNotif=0 to undo)');
    }
  } catch { /* storage unavailable: no simulation */ }
}
