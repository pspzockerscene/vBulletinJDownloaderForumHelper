// ==UserScript==
// @name               JDownloader Forum Helper
// @name:en            JDownloader Forum Helper
// @name:de            JDownloader Forum Helper
// @description        Setzt Thread-Präfixe mit einem Klick direkt aus der Thread-Ansicht und der Forumsübersicht
// @description:en     Set thread prefixes with a single click from thread view and forum list
// @description:de     Setzt Thread-Präfixe mit einem Klick direkt aus der Thread-Ansicht und der Forumsübersicht
// @version            1.6
// @author             pspzockerscene
// @namespace          https://board.jdownloader.org/
// @homepageURL        https://github.com/pspzockerscene/vBulletinJDownloaderForumHelper
// @homepage           https://github.com/pspzockerscene/vBulletinJDownloaderForumHelper
// @icon               https://board.jdownloader.org/favicon.ico
// @match              https://board.jdownloader.org/showthread.php*
// @match              https://board.jdownloader.org/forumdisplay.php*
// @run-at             document-end
// @inject-into        content
// @grant              GM_getValue
// @grant              GM_setValue
// @grant              GM_registerMenuCommand
// @license            GPL v3
// @compatible         firefox
// @compatible         chrome
// @compatible         safari
// @compatible         opera
// @compatible         edge
// @downloadURL        https://raw.githubusercontent.com/pspzockerscene/vBulletinJDownloaderForumHelper/refs/heads/main/vBulletinJDownloaderForumHelper.user.js
// @updateURL          https://raw.githubusercontent.com/pspzockerscene/vBulletinJDownloaderForumHelper/refs/heads/main/vBulletinJDownloaderForumHelper.user.js
// ==/UserScript==

(function() {
    'use strict';

    // Zentrale Prüfung: User muss eingeloggt sein
    if (!document.body.innerHTML.includes('logouthash=')) {
        return;
    }

    /**
     * Gibt die Präfix-Liste basierend auf der Forum-ID zurück
     */
    function getPrefixesForForum(forumId) {
        if (forumId === 52) {
            // Eventscripter Forum
            return {
                '': '(ohne Präfix)',
                'scripts_scripts': '[Script]',
                'scripts_solved': '[Solved]',
                'scripts_update': '[Wait for JD2 Core Update]',
                'scripts_declined': '[Declined]',
                'scripts_progress': '[In Progress]',
                'scripts_user_required': '[User feedback required]',
                'scripts_request': '[Script request]',
                'scripts_dev_required': '[Developer Feedback required]'
            };
        }

        // Standard Bug Report Präfixe
        return {
            '': '(ohne Präfix)',
            'bugreport_s': '[Erledigt]',
            'bugreport_major': '[Erledigt in JD2]',
            'bugreport_u': '[Abgelehnt]',
            'bugreport_bt': '[Siehe Bugtracker]',
            'bugreport_user': '[Benutzer Feedback benötigt]',
            'bugreport_developer': '[Entwickler Feedback benötigt]',
            'bugreport_plugin': '[Auf Plugin Update warten]',
            'bugreport_JD2core': '[Auf JD2-Core-Update warten]',
            'bugreport_p': '[In Arbeit]',
            'bugreport_howto': '[HOWTO]'
        };
    }

    /**
     * Gibt den Default-Präfix basierend auf Forum-ID zurück
     */
    function getDefaultPrefixForForum(forumId) {
        return forumId === 52 ? 'scripts_solved' : 'bugreport_s';
    }

    /**
     * Extrahiert die Forum-ID aus URL (forumdisplay.php) oder Navbar (showthread.php)
     */
    function getForumId() {
        // Methode 1: Aus URL (für forumdisplay.php)
        const urlParams = new URLSearchParams(window.location.search);
        if (window.location.href.includes('forumdisplay.php')) {
            const forumId = parseInt(urlParams.get('f'));
            if (forumId) return forumId;
        }

        // Methode 2: Aus Navbar (für showthread.php)
        const navbarMatch = document.body.innerHTML.match(/<span class="navbar">[^<]*<a href="forumdisplay\.php\?f=(\d+)">/g);
        if (navbarMatch && navbarMatch.length > 0) {
            const lastNavbarLink = navbarMatch[navbarMatch.length - 1];
            const forumMatch = lastNavbarLink.match(/f=(\d+)/);
            if (forumMatch) {
                return parseInt(forumMatch[1]);
            }
        }

        return null;
    }

    /**
     * Ladet Thread-Daten von der Bearbeitungsseite
     */
    function loadThreadEditData(threadId) {
        return fetch(`https://board.jdownloader.org/postings.php?do=editthread&t=${threadId}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                return response.text();
            })
            .then(html => {
                const tokenMatch = html.match(/name="securitytoken"\s+value="([^"]+)"/);
                const titleMatch = html.match(/name="title"\s+value="([^"]*)"/);
                const notesMatch = html.match(/name="notes"\s+value="([^"]*)"/);

                if (!tokenMatch || !titleMatch) {
                    throw new Error('Konnte erforderliche Daten nicht extrahieren');
                }

                return {
                    token: tokenMatch[1],
                    title: titleMatch[1],
                    notes: notesMatch ? notesMatch[1] : '',
                    open: html.match(/name="open"\s+value="yes"\s+id="cb_open"\s+checked="checked"/) ? 'yes' : '',
                    visible: html.match(/name="visible"\s+value="yes"\s+id="cb_visible"\s+checked="checked"/) ? 'yes' : '',
                    iconid: html.match(/name="iconid"\s+value="(\d+)"\s+id="rb_iconid_\d+"\s+checked="checked"/) ? RegExp.$1 : '0'
                };
            });
    }

    /**
     * Dekodiert HTML-Entities (z.B. &quot; zu ")
     */
    function decodeHtmlEntities(text) {
        const textarea = document.createElement('textarea');
        textarea.innerHTML = text;
        return textarea.value;
    }

    /**
     * Speichert das neue Thread-Präfix mit FormData und ISO-8859-1 Encoding
     */
    function saveThreadPrefix(threadId, prefixId, editData) {
        // Dekodiere den Titel um HTML-Entities richtig zu behandeln
        const decodedTitle = decodeHtmlEntities(editData.title);

        const formData = new FormData();
        formData.append('s', '');
        formData.append('securitytoken', editData.token);
        formData.append('t', threadId);
        formData.append('do', 'updatethread');
        formData.append('prefixid', prefixId);
        formData.append('title', decodedTitle);
        formData.append('notes', editData.notes);
        if (editData.open) formData.append('open', editData.open);
        if (editData.visible) formData.append('visible', editData.visible);
        formData.append('iconid', editData.iconid);

        return fetch(`https://board.jdownloader.org/postings.php?do=updatethread&t=${threadId}`, {
            method: 'POST',
            body: formData,
            credentials: 'include',
            headers: {
                'Content-Type': 'text/html; charset=ISO-8859-1'
            }
        }).then(response => {
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            return response;
        });
    }

    // ===== SINGLE THREAD OVERLAY =====
    (function singleThreadOverlay() {
        if (!GM_getValue('enableSingleThreadOverlay', true)) {
            return;
        }

        let threadId = new URLSearchParams(window.location.search).get('t');
        if (!threadId) {
            const printMatch = document.body.innerHTML.match(/href="printthread\.php\?t=(\d+)"/);
            if (printMatch) {
                threadId = printMatch[1];
            }
        }

        if (!threadId) {
            return;
        }

        const currentForumId = getForumId();
        const prefixes = getPrefixesForForum(currentForumId);
        const defaultPrefix = getDefaultPrefixForForum(currentForumId);

        // CSS für das Overlay
        const style = document.createElement('style');
        style.textContent = `
        #prefix-setter-overlay {
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10000;
            background: white;
            border: 2px solid #0B198C;
            border-radius: 5px;
            padding: 15px;
            box-shadow: 0 4px 8px rgba(0,0,0,0.2);
            font-family: verdana, geneva, lucida, arial, helvetica, sans-serif;
            font-size: 11px;
        }

        #prefix-setter-overlay label {
            display: block;
            margin-bottom: 8px;
            font-weight: bold;
            color: #333;
        }

        #prefix-selector {
            width: 200px;
            padding: 5px;
            margin-bottom: 10px;
            font-size: 11px;
            border: 1px solid #BEC9D1;
            font-family: verdana, geneva, lucida, arial, helvetica, sans-serif;
        }

        #prefix-apply-btn {
            width: 100%;
            padding: 6px;
            background: #436976;
            color: white;
            border: 1px solid #2d3f4a;
            border-radius: 3px;
            cursor: pointer;
            font-weight: bold;
            font-size: 11px;
            font-family: verdana, geneva, lucida, arial, helvetica, sans-serif;
            transition: background 0.2s;
        }

        #prefix-apply-btn:hover:not(:disabled) {
            background: #2d3f4a;
        }

        #prefix-apply-btn:disabled {
            background: #cccccc;
            color: #666666;
            cursor: not-allowed;
            border: 1px solid #999999;
        }

        #prefix-apply-btn[title] {
            cursor: help;
        }

        #prefix-status {
            margin-top: 10px;
            padding: 8px;
            border-radius: 3px;
            text-align: center;
            display: none;
            font-size: 11px;
            max-width: 200px;
            word-wrap: break-word;
        }

        #prefix-status.success {
            background: #d4edda;
            color: #155724;
            border: 1px solid #c3e6cb;
            display: block;
        }

        #prefix-status.error {
            background: #f8d7da;
            color: #721c24;
            border: 1px solid #f5c6cb;
            display: block;
        }

        #prefix-status.loading {
            background: #d1ecf1;
            color: #0c5460;
            border: 1px solid #bee5eb;
            display: block;
        }
    `;
    document.head.appendChild(style);

    // Overlay HTML erstellen
    const overlay = document.createElement('div');
    overlay.id = 'prefix-setter-overlay';
    overlay.innerHTML = `
        <label for="prefix-selector">Thread-Präfix:</label>
        <select id="prefix-selector">
            ${Object.entries(prefixes).map(([value, label]) =>
                `<option value="${value}" ${value === defaultPrefix ? 'selected' : ''}>${label}</option>`
            ).join('')}
        </select>
        <button id="prefix-apply-btn">Präfix übernehmen</button>
        <div id="prefix-status"></div>
        <div style="margin-top: 8px; font-size: 10px; color: #666; text-align: center;">
            Hotkey: <kbd style="background: #f0f0f0; padding: 2px 4px; border-radius: 2px; font-family: monospace;">Ctrl+E</kbd>
        </div>
    `;
    document.body.appendChild(overlay);

    // Extrahiere das aktuell gesetzte Präfix aus der Threadseite
    function getCurrentPrefix() {
        // Suche nach dem Thread-Titel in der navbar mit Präfix-Format
        // Beispiel: <td class="navbar"...><strong>[<b><font...>Erledigt</font></b>] Titel</strong></td>
        // oder auch einfach: <strong>[Erledigt] Titel</strong>

        // Suche nach allen möglichen Formaten des Präfix in strong tags
        // Pattern: [beliebiger HTML content mit Präfix-Text in Klammern]
        const navbarMatch = document.body.innerHTML.match(/<td class="navbar"[^>]*>[\s\S]*?<strong>\s*\[\s*(?:<[^>]+>)*([^\]<]+)(?:<[^>]*>)*\s*\]\s+([^<]+)<\/strong>/);

        if (navbarMatch && navbarMatch[1]) {
            // navbarMatch[1] enthält den Präfix-Text (z.B. "Erledigt")
            const prefixText = navbarMatch[1].trim();
            const prefixLabel = `[${prefixText}]`;

            // Finde die ID für dieses Label in den aktuellen Präfixen
            for (const [prefixId, label] of Object.entries(prefixes)) {
                if (label === prefixLabel) {
                    return prefixId;
                }
            }

            // Wenn Präfix gefunden aber nicht erkannt (z.B. wegen Titeln mit [xyz])
            // -> behandle als leeren Präfix (unbekannt = nicht gesetzt)
            return '';
        }

        // Wenn kein Präfix mit Brackets gefunden, ist das Präfix leer
        return '';
    }

    // Prüfe initial welches Präfix gesetzt ist
    const currentPrefix = getCurrentPrefix();

    // Update Button Status
    function updateButtonStatus() {
        const selectedPrefix = document.getElementById('prefix-selector').value;
        const button = document.getElementById('prefix-apply-btn');

        // Button ist disabled wenn:
        // 1. Kein Präfix gesetzt (currentPrefix === '') UND "(ohne Präfix)" ausgewählt (selectedPrefix === '')
        // 2. Ein Präfix gesetzt (currentPrefix !== '') UND dieser mit dem ausgewählten übereinstimmt
        if ((currentPrefix === '' && selectedPrefix === '') ||
            (currentPrefix !== '' && currentPrefix === selectedPrefix)) {
            button.disabled = true;
            button.textContent = 'Präfix bereits gesetzt';
            button.style.cursor = 'not-allowed';
        } else {
            button.disabled = false;
            button.textContent = 'Präfix übernehmen';
            button.style.cursor = 'pointer';
        }
    }

    // Initial Button Status setzen
    updateButtonStatus();

    // Tooltip zum Button hinzufügen
    const button = document.getElementById('prefix-apply-btn');
    button.title = 'Klick oder Ctrl+E drücken';

    // Listener auf Select-Change
    document.getElementById('prefix-selector').addEventListener('change', updateButtonStatus);

    // Hotkey Ctrl+E zum Anwenden des Präfix
    document.addEventListener('keydown', function(event) {
        // Early return falls nicht Ctrl+E
        if ((event.key !== 'e' && event.key !== 'E') || !event.ctrlKey || event.altKey || event.shiftKey) {
            return;
        }

        event.preventDefault();
        const button = document.getElementById('prefix-apply-btn');
        if (button && !button.disabled) {
            button.click();
        }
    });

    // Security Token aus der Seite extrahieren
    let securityToken = '';
    const scripts = document.querySelectorAll('script');
    scripts.forEach(script => {
        if (script.textContent.includes('SECURITYTOKEN')) {
            const match = script.textContent.match(/SECURITYTOKEN\s*=\s*"([^"]+)"/);
            if (match) {
                securityToken = match[1];
            }
        }
    });

        // Button-Click-Handler mit zentralen Funktionen
        document.getElementById('prefix-apply-btn').addEventListener('click', function() {
            const selectedPrefix = document.getElementById('prefix-selector').value;
            const button = this;
            const statusDiv = document.getElementById('prefix-status');

            button.disabled = true;
            statusDiv.className = 'loading';
            statusDiv.textContent = 'Bearbeitungsseite wird geladen...';

            loadThreadEditData(threadId)
                .then(editData => {
                    statusDiv.textContent = 'Präfix wird gespeichert...';
                    return saveThreadPrefix(threadId, selectedPrefix, editData);
                })
                .then(() => {
                    button.disabled = false;
                    statusDiv.className = 'success';
                    statusDiv.textContent = '✓ Präfix erfolgreich gespeichert!';

                    location.reload();
                })
                .catch(error => {
                    button.disabled = false;
                    statusDiv.className = 'error';
                    statusDiv.textContent = `✗ Fehler: ${error.message}`;
                    console.error('Fehler beim Präfix setzen:', error);
                });
        });

        console.log('JDownloader Prefix Setter geladen. Thread-ID:', threadId);
    })();

    // ===== FORUM LIST PREFIXES =====
    (function forumListPrefixes() {
        if (!GM_getValue('enableForumListPrefixes', true)) {
            return;
        }

        if (!window.location.href.includes('forumdisplay.php')) {
            return;
        }

        const currentForumId = getForumId();
        if (!currentForumId) {
            return;
        }

        const prefixes = getPrefixesForForum(currentForumId);

    // CSS für das Dropdown
    const style = document.createElement('style');
    style.textContent = `
        .thread-prefix-selector {
            font-size: 9px;
            padding: 2px 4px;
            margin-left: 8px;
            border: 1px solid #BEC9D1;
            border-radius: 2px;
            font-family: verdana, geneva, lucida, arial, helvetica, sans-serif;
            background: white;
            cursor: pointer;
            width: 110px;
        }

        .thread-prefix-selector:disabled {
            background: #f0f0f0;
            cursor: not-allowed;
            color: #999;
        }

        .thread-prefix-selector:hover:not(:disabled) {
            border-color: #0B198C;
            background: #f9f9f9;
        }
    `;
    document.head.appendChild(style);

    // Finde alle Thread-Rows
    const threadRows = document.querySelectorAll('td[id^="td_threadtitle_"]');

    console.log('Gefundene Thread-Rows:', threadRows.length);

    threadRows.forEach(titleCell => {
        // Extrahiere Thread-ID aus der Cell-ID
        const idMatch = titleCell.id.match(/td_threadtitle_(\d+)/);
        if (!idMatch) {
            return;
        }
        const threadId = idMatch[1];

        // Finde die aktuelle Row
        const row = titleCell.closest('tr');
        if (!row) {
            return;
        }

        // Extrahiere aktuelles Präfix
        let currentPrefix = '';
        const rowHTML = row.innerHTML;
        let prefixMatch = rowHTML.match(/\[<b><font[^>]*>([^\]<]+)<\/font><\/b>\]/);
        if (!prefixMatch) {
            prefixMatch = rowHTML.match(/\[<b>([^\]<]+)<\/b>\]/);
        }

        if (prefixMatch && prefixMatch[1]) {
            const prefixText = prefixMatch[1].trim();
            const prefixLabel = `[${prefixText}]`;
            for (const [id, label] of Object.entries(prefixes)) {
                if (label === prefixLabel) {
                    currentPrefix = id;
                    break;
                }
            }
        }

        // Finde den Thread-Link
        const threadLink = titleCell.querySelector('a[id^="thread_title_"]');
        if (!threadLink) {
            return;
        }

        // Erstelle Dropdown
        const dropdown = document.createElement('select');
        dropdown.className = 'thread-prefix-selector';
        dropdown.title = 'Thread-Präfix ändern';
        dropdown.innerHTML = Object.entries(prefixes)
            .map(([id, label]) => `<option value="${id}" ${id === currentPrefix ? 'selected' : ''}>${label}</option>`)
            .join('');

        // Füge Dropdown direkt nach dem Thread-Link ein (inline)
        threadLink.parentNode.insertBefore(dropdown, threadLink.nextSibling);

        // Change-Event Handler mit zentraler Funktion
        dropdown.addEventListener('change', function() {
            const selectedPrefix = this.value;
            if (selectedPrefix === currentPrefix) {
                return;
            }

            this.disabled = true;

            loadThreadEditData(threadId)
                .then(editData => {
                    return saveThreadPrefix(threadId, selectedPrefix, editData);
                })
                .then(() => {
                    location.reload();
                })
                .catch(error => {
                    console.error('Fehler beim Ändern des Präfix (Thread ' + threadId + '):', error);
                    dropdown.disabled = false;
                    alert('Fehler beim Ändern des Präfix: ' + error.message);
                });
        });

        console.log('Dropdown hinzugefügt für Thread:', threadId);
    });

    console.log('JDownloader Forum List Helper geladen');
    })();

    // ===== MENÜ-BEFEHLE =====
    GM_registerMenuCommand('🔧 JDF: Single-Thread Overlay ' + (GM_getValue('enableSingleThreadOverlay', true) ? '✓' : '✗'), function() {
        const current = GM_getValue('enableSingleThreadOverlay', true);
        GM_setValue('enableSingleThreadOverlay', !current);
        alert('Single-Thread Overlay ' + (!current ? 'aktiviert' : 'deaktiviert') + '\n(Seite neu laden zum Anwenden)');
    });

    GM_registerMenuCommand('🔧 JDF: Threadübersicht Präfixe ' + (GM_getValue('enableForumListPrefixes', true) ? '✓' : '✗'), function() {
        const current = GM_getValue('enableForumListPrefixes', true);
        GM_setValue('enableForumListPrefixes', !current);
        alert('Threadübersicht Präfixe ' + (!current ? 'aktiviert' : 'deaktiviert') + '\n(Seite neu laden zum Anwenden)');
    });

})();