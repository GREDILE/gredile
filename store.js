/* Collegamento a Supabase: accesso, salvataggio, tempo reale e file.
   Tutti i dati stanno nella tabella "records" (collezione + id + contenuto JSON). */
(function () {
  'use strict';
  var cfg = window.GR_CONFIG || {};
  var configured = !!(cfg.url && cfg.anonKey && !/INSERISCI/.test(cfg.url + cfg.anonKey) && window.supabase);
  var sb = configured ? window.supabase.createClient(cfg.url, cfg.anonKey, { auth: { persistSession: true, autoRefreshToken: true } }) : null;
  var channel = null;

  function safeName(n) { return String(n).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9._-]+/g, '_').slice(-80); }

  window.Store = {
    configured: configured,
    onAuth: function (fn) { return sb.auth.onAuthStateChange(function (_e, session) { fn(session); }); },
    signIn: function (email, password) { return sb.auth.signInWithPassword({ email: email, password: password }); },
    signOut: function () { return sb.auth.signOut(); },
    loadAll: function () { return sb.from('records').select('coll,id,data').limit(20000); },
    upsert: function (coll, id, data) { return sb.from('records').upsert({ coll: coll, id: id, data: data }); },
    remove: function (coll, id) { return sb.from('records').delete().eq('coll', coll).eq('id', id); },
    /* onChange(payload) a ogni modifica fatta da un altro dispositivo; onStatus(stato) per i cambi di connessione */
    subscribe: function (onChange, onStatus) {
      this.unsubscribe();
      channel = sb.channel('gr-records')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'records' }, onChange)
        .subscribe(function (status) { if (onStatus) onStatus(status); });
    },
    unsubscribe: function () { if (channel) { sb.removeChannel(channel); channel = null; } },
    upload: function (file, userId) {
      var path = (userId || 'u') + '/' + Date.now() + '-' + safeName(file.name);
      return sb.storage.from('documenti').upload(path, file, { upsert: false }).then(function (r) {
        if (r.error) throw r.error;
        return path;
      });
    },
    signedUrl: function (path) {
      return sb.storage.from('documenti').createSignedUrl(path, 3600).then(function (r) { return r.error ? null : r.data.signedUrl; });
    },
    removeFile: function (path) { return sb.storage.from('documenti').remove([path]); }
  };
})();
