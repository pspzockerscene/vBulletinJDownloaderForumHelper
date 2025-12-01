// ==UserScript==
// @name               JDownloader Forum Helper
// @name:en            JDownloader Forum Helper
// @name:de            JDownloader Forum Helper
// @description        Setzt Thread-Präfixe mit einem Klick direkt aus der Thread-Ansicht und der Forumsübersicht
// @description:en     Set thread prefixes with a single click from thread view and forum list
// @description:de     Setzt Thread-Präfixe mit einem Klick direkt aus der Thread-Ansicht und der Forumsübersicht
// @version            1.7
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

                // Extrahiere Charset aus Content-Type Header
                let charset = 'utf-8'; // default
                const contentType = response.headers.get('content-type');
                if (contentType) {
                    const charsetMatch = contentType.match(/charset=([^\s;]+)/i);
                    if (charsetMatch) {
                        charset = charsetMatch[1].toLowerCase().replace(/['"]/g, '');
                    }
                }

                // Dekodiere mit erkanntem Charset
                return response.arrayBuffer().then(buffer => {
                    const decoder = new TextDecoder(charset);
                    return decoder.decode(buffer);
                });
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
     * Konvertiert einen String zu ISO-8859-1 URL-encoded Format
     */
    function encodeISO88591(str) {
        let encoded = '';
        for (let i = 0; i < str.length; i++) {
            const charCode = str.charCodeAt(i);
            if (charCode <= 0xFF) {
                // Zeichen ist im ISO-8859-1 Bereich
                if ((charCode >= 48 && charCode <= 57) ||   // 0-9
                    (charCode >= 65 && charCode <= 90) ||   // A-Z
                    (charCode >= 97 && charCode <= 122) ||  // a-z
                    charCode === 45 || charCode === 95 ||   // - _
                    charCode === 46 || charCode === 126) {  // . ~
                    encoded += str[i];
                } else {
                    encoded += '%' + charCode.toString(16).toUpperCase().padStart(2, '0');
                }
            } else {
                // Zeichen außerhalb ISO-8859-1
                encoded += '%' + charCode.toString(16).toUpperCase().padStart(2, '0');
            }
        }
        return encoded;
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
     * Speichert das neue Thread-Präfix
     */
    function saveThreadPrefix(threadId, prefixId, editData) {
        // Dekodiere den Titel um HTML-Entities richtig zu behandeln
        const decodedTitle = decodeHtmlEntities(editData.title);

        // Baue den Body manuell mit vollständiger Encoding-Kontrolle
        const bodyParts = [
            's=',
            'securitytoken=' + editData.token,
            't=' + threadId,
            'do=updatethread',
            'prefixid=' + prefixId,
            'title=' + encodeISO88591(decodedTitle),
            'notes=' + encodeISO88591(editData.notes),
            'iconid=' + editData.iconid
        ];

        if (editData.open) bodyParts.push('open=' + editData.open);
        if (editData.visible) bodyParts.push('visible=' + editData.visible);

        const body = bodyParts.join('&');

        return fetch(`https://board.jdownloader.org/postings.php?do=updatethread&t=${threadId}`, {
            method: 'POST',
            body: body,
            credentials: 'include',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
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
            padding: 10px;
            box-shadow: 0 4px 8px rgba(0,0,0,0.2);
            font-family: verdana, geneva, lucida, arial, helvetica, sans-serif;
            font-size: 11px;
            width: auto;
            max-width: 60px;
            transition: max-width 0.3s ease;
        }

        #prefix-setter-overlay.expanded {
            max-width: 200px;
        }

        #prefix-setter-overlay label {
            display: block;
            margin-bottom: 5px;
            font-weight: bold;
            color: #333;
            font-size: 10px;
        }

        #prefix-selector {
            width: 100%;
            padding: 4px;
            margin-bottom: 5px;
            font-size: 11px;
            border: 1px solid #BEC9D1;
            font-family: verdana, geneva, lucida, arial, helvetica, sans-serif;
            box-sizing: border-box;
        }

        #prefix-apply-btn {
            width: 100%;
            padding: 4px;
            background: #436976;
            color: white;
            border: 1px solid #2d3f4a;
            border-radius: 3px;
            cursor: pointer;
            font-weight: bold;
            font-size: 10px;
            font-family: verdana, geneva, lucida, arial, helvetica, sans-serif;
            transition: background 0.2s;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        #copy-threadid-btn {
            width: 100%;
            padding: 4px;
            margin-top: 3px;
            background: #436976;
            color: white;
            border: 1px solid #2d3f4a;
            border-radius: 3px;
            cursor: pointer;
            font-weight: bold;
            font-size: 10px;
            font-family: verdana, geneva, lucida, arial, helvetica, sans-serif;
            transition: background 0.2s;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        #copy-threadid-btn:hover {
            background: #2d3f4a;
        }

        #prefix-status {
            margin-top: 5px;
            padding: 6px;
            border-radius: 3px;
            text-align: center;
            display: none;
            font-size: 10px;
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

    // Extrahiere das aktuell gesetzte Präfix und den Titel aus der Threadseite
    function getCurrentPrefixAndTitle() {
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
            const title = navbarMatch[2] ? navbarMatch[2].trim() : '';

            // Finde die ID für dieses Label in den aktuellen Präfixen
            for (const [prefixId, label] of Object.entries(prefixes)) {
                if (label === prefixLabel) {
                    return { prefixId, title };
                }
            }

            // Wenn Präfix gefunden aber nicht erkannt
            return { prefixId: '', title };
        }

        // Wenn kein Präfix mit Brackets gefunden
        return { prefixId: '', title: '' };
    }

    const currentPrefixData = getCurrentPrefixAndTitle();
    const currentPrefixId = currentPrefixData.prefixId;
    const currentTitle = currentPrefixData.title;

    // Overlay HTML erstellen
    const overlay = document.createElement('div');
    overlay.id = 'prefix-setter-overlay';
    overlay.innerHTML = `
        <label for="prefix-selector">Präfix:</label>
        <select id="prefix-selector">
            ${Object.entries(prefixes).map(([value, label]) =>
                `<option value="${value}" ${value === currentPrefixId ? 'selected' : ''}>${label}</option>`
            ).join('')}
        </select>
        <label for="thread-title-input" style="margin-top: 5px;">Titel:</label>
        <input type="text" id="thread-title-input" value="${currentTitle.replace(/"/g, '&quot;')}" style="width: 100%; padding: 3px; margin-bottom: 5px; font-size: 10px; border: 1px solid #BEC9D1; font-family: verdana, geneva, lucida, arial, helvetica, sans-serif; box-sizing: border-box;">
        <button id="prefix-apply-btn">Änderungen übernehmen</button>
        <div style="margin-top: 2px; font-size: 8px; color: #999; text-align: center;">
            <kbd style="background: #f0f0f0; padding: 1px 2px; border-radius: 2px; font-family: monospace;">Ctrl+E</kbd>
        </div>
        <button id="copy-threadid-btn">Thread ID kopieren</button>
        <div style="margin-top: 2px; font-size: 8px; color: #999; text-align: center;">
            <kbd style="background: #f0f0f0; padding: 1px 2px; border-radius: 2px; font-family: monospace;">Ctrl+Shift+C</kbd>
        </div>
        <div id="prefix-status"></div>
    `;
    document.body.appendChild(overlay);

    // Update Button Status
    function updateButtonStatus() {
        const selectedPrefix = document.getElementById('prefix-selector').value;
        const selectedTitle = document.getElementById('thread-title-input').value;
        const button = document.getElementById('prefix-apply-btn');

        // Button ist aktiv wenn: anderes Präfix ODER anderer Titel
        const prefixChanged = selectedPrefix !== currentPrefixId;
        const titleChanged = selectedTitle !== currentTitle;

        if (prefixChanged || titleChanged) {
            button.disabled = false;
            button.textContent = 'Änderungen übernehmen';
            button.style.cursor = 'pointer';
        } else {
            button.disabled = true;
            button.textContent = 'Keine Änderungen';
            button.style.cursor = 'not-allowed';
        }
    }

    // Initial Button Status setzen
    updateButtonStatus();

    // Tooltip zum Präfix Button hinzufügen
    const button = document.getElementById('prefix-apply-btn');
    button.title = 'Klick oder Ctrl+E drücken';

    // Tooltip zum ThreadID Button hinzufügen
    const copyButton = document.getElementById('copy-threadid-btn');
    copyButton.title = 'Klick oder Ctrl+Shift+C drücken';

    // Listener auf Select-Change und Input-Change
    document.getElementById('prefix-selector').addEventListener('change', updateButtonStatus);
    document.getElementById('thread-title-input').addEventListener('input', updateButtonStatus);

    // Expand/Collapse Funktionalität
    const overlayDiv = document.getElementById('prefix-setter-overlay');

    // Expandiere bei Klick auf Dropdown
    document.getElementById('prefix-selector').addEventListener('click', function() {
        overlayDiv.classList.add('expanded');
    });

    // Expandiere bei Klick ins Titel-Input
    document.getElementById('thread-title-input').addEventListener('click', function() {
        overlayDiv.classList.add('expanded');
    });

    // Expandiere bei Klick ins leere der Box
    overlayDiv.addEventListener('click', function(e) {
        // Nur wenn auf die Box selbst geklickt, nicht auf Elemente darin
        if (e.target === overlayDiv) {
            overlayDiv.classList.add('expanded');
        }
    });

    // Kollabiere wenn außerhalb der Box geklickt
    document.addEventListener('click', function(e) {
        if (!overlayDiv.contains(e.target)) {
            overlayDiv.classList.remove('expanded');
        }
    });

    // Hotkey Ctrl+E zum Anwenden des Präfix
    document.addEventListener('keydown', function(event) {
        // Ctrl+E für Präfix setzen
        if ((event.key === 'e' || event.key === 'E') && event.ctrlKey && !event.altKey && !event.shiftKey) {
            event.preventDefault();
            const button = document.getElementById('prefix-apply-btn');
            if (button && !button.disabled) {
                button.click();
            }
        }

        // Ctrl+Shift+C für ThreadID kopieren
        if ((event.key === 'c' || event.key === 'C') && event.ctrlKey && event.shiftKey && !event.altKey) {
            event.preventDefault();
            const button = document.getElementById('copy-threadid-btn');
            if (button) {
                button.click();
            }
        }
    });

    // Security Token aus der Seite extrahieren
    const tokenMatch = document.body.innerHTML.match(/var SECURITYTOKEN = "([0-9]+-[a-f0-9]{40})"/);
    const securityToken = tokenMatch ? tokenMatch[1] : '';

        // Button-Click-Handler mit zentralen Funktionen
        document.getElementById('prefix-apply-btn').addEventListener('click', function() {
            const selectedPrefix = document.getElementById('prefix-selector').value;
            const selectedTitle = document.getElementById('thread-title-input').value;
            const button = this;
            const statusDiv = document.getElementById('prefix-status');

            button.disabled = true;
            statusDiv.className = 'loading';
            statusDiv.textContent = 'Bearbeitungsseite wird geladen...';

            loadThreadEditData(threadId)
                .then(editData => {
                    statusDiv.textContent = 'Änderungen werden gespeichert...';
                    // Überschreibe den Titel mit dem editierten Wert
                    editData.title = selectedTitle;
                    return saveThreadPrefix(threadId, selectedPrefix, editData);
                })
                .then(() => {
                    button.disabled = false;
                    statusDiv.className = 'success';
                    statusDiv.textContent = '✓ Änderungen erfolgreich gespeichert!';

                    location.reload();
                })
                .catch(error => {
                    button.disabled = false;
                    statusDiv.className = 'error';
                    statusDiv.textContent = `✗ Fehler: ${error.message}`;
                    console.error('Fehler beim Speichern:', error);
                });
        });

        // Click-Handler für ThreadID kopieren
        document.getElementById('copy-threadid-btn').addEventListener('click', function() {
            navigator.clipboard.writeText(threadId).then(() => {
                const statusDiv = document.getElementById('prefix-status');
                statusDiv.className = 'success';
                statusDiv.textContent = `✓ Thread ID ${threadId} kopiert!`;
                setTimeout(() => {
                    statusDiv.className = '';
                    statusDiv.textContent = '';
                }, 2000);
            }).catch(error => {
                const statusDiv = document.getElementById('prefix-status');
                statusDiv.className = 'error';
                statusDiv.textContent = '✗ Fehler beim Kopieren';
                console.error('Fehler beim Kopieren:', error);
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