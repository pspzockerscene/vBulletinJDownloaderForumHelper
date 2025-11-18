// ==UserScript==
// @name               JDownloader Forum Helper
// @name:en            JDownloader Forum Helper
// @name:de            JDownloader Forum Helper
// @description        Setzt Thread-Präfixe mit einem Klick direkt aus der Thread-Ansicht
// @description:en     Set thread prefixes with a single click from the thread view
// @description:de     Setzt Thread-Präfixe mit einem Klick direkt aus der Thread-Ansicht
// @version            1.3
// @author             pspzockerscene
// @namespace          https://board.jdownloader.org/
// @homepageURL        https://github.com/pspzockerscene/vBulletinJDownloaderForumHelper
// @homepage           https://github.com/pspzockerscene/vBulletinJDownloaderForumHelper
// @icon               https://board.jdownloader.org/favicon.ico
// @match              https://board.jdownloader.org/showthread.php*
// @run-at             document-end
// @inject-into        content
// @grant              none
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

    // Schritt 1: Prüfe ob User eingeloggt ist (logouthash ohne Anführungszeichen)
    if (!document.body.innerHTML.includes('logouthash=')) {
        // Nicht eingeloggt - beende Script still
        return;
    }

    // Schritt 2: Thread-ID aus URL-Parameter "t" extrahieren
    let threadId = new URLSearchParams(window.location.search).get('t');

    // Schritt 3: Wenn keine threadID in URL, extrahiere aus href="printthread.php?t=..."
    if (!threadId) {
        const printMatch = document.body.innerHTML.match(/href="printthread\.php\?t=(\d+)"/);
        if (printMatch) {
            threadId = printMatch[1];
        }
    }

    // Wenn immer noch keine threadID gefunden, beende Script still
    if (!threadId) {
        return;
    }

    // Schritt 4: Ermittle das aktuelle Unterforum aus der navbar nur
    // Suche nach: <span class="navbar">...forumdisplay.php?f=XX...
    const navbarMatch = document.body.innerHTML.match(/<span class="navbar">[^<]*<a href="forumdisplay\.php\?f=(\d+)">/g);
    let currentForumId = null;

    if (navbarMatch && navbarMatch.length > 0) {
        // Nimm den letzten Navbar-Link (das ist das aktuelle Unterforum)
        const lastNavbarLink = navbarMatch[navbarMatch.length - 1];
        const forumMatch = lastNavbarLink.match(/f=(\d+)/);
        if (forumMatch) {
            currentForumId = parseInt(forumMatch[1]);
        }
    }

    // Definiere Präfixe je nach Unterforum
    let prefixes = {};
    let defaultPrefix = 'bugreport_s'; // Standard default

    if (currentForumId === 52) {
        // Eventscripter Forum (id 52)
        prefixes = {
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
        defaultPrefix = 'scripts_solved'; // Default für Forum 52
    } else {
        // Standard Bug Report Präfixe
        prefixes = {
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

            // Wenn Präfix gefunden aber nicht erkannt - Fehler
            return `UNKNOWN:${prefixLabel}`;
        }

        // Wenn kein Präfix mit Brackets gefunden, ist das Präfix leer
        return '';
    }

    // Prüfe initial welches Präfix gesetzt ist
    const currentPrefix = getCurrentPrefix();

    // Wenn ein unbekanntes Präfix erkannt wurde, zeige Fehler
    if (currentPrefix.startsWith('UNKNOWN:')) {
        const unknownPrefix = currentPrefix.substring(8); // Entferne "UNKNOWN:" Präfix
        overlay.innerHTML = `
            <div style="color: red; font-weight: bold; margin-bottom: 10px;">
                ⚠️ Fehler
            </div>
            <div style="font-size: 10px; color: red;">
                Unbekanntes Präfix erkannt:<br/>
                <strong>${unknownPrefix}</strong><br/>
                <br/>
                Das Script kennt diesen Präfix nicht. Bitte manuell bearbeiten oder den Script-Autor kontaktieren.
            </div>
        `;
        return;
    }

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

    // Listener auf Select-Change
    document.getElementById('prefix-selector').addEventListener('change', updateButtonStatus);

    // Hotkey 'c' zum Anwenden des Präfix
    document.addEventListener('keydown', function(event) {
        // Prüfe ob 'c' oder 'C' gedrückt wurde
        if ((event.key === 'c' || event.key === 'C') && !event.ctrlKey && !event.altKey && !event.shiftKey) {
            // Nur wenn der Button aktiv ist (nicht disabled)
            const button = document.getElementById('prefix-apply-btn');
            if (button && !button.disabled) {
                button.click();
            }
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

    // Button-Click-Handler
    document.getElementById('prefix-apply-btn').addEventListener('click', function() {
        const selectedPrefix = document.getElementById('prefix-selector').value;
        const button = this;
        const statusDiv = document.getElementById('prefix-status');

        button.disabled = true;
        statusDiv.className = 'loading';
        statusDiv.textContent = 'Bearbeitungsseite wird geladen...';

        // Schritt 1: Zur Bearbeitungsseite navigieren um alle erforderlichen Werte zu extrahieren
        fetch(`https://board.jdownloader.org/postings.php?do=editthread&t=${threadId}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Bearbeitungsseite konnte nicht geladen werden (Status: ${response.status})`);
                }
                return response.text();
            })
            .then(html => {
                // Alle erforderlichen Werte aus der Bearbeitungsseite extrahieren
                const tokenMatch = html.match(/name="securitytoken"\s+value="([^"]+)"/);
                const titleMatch = html.match(/name="title"\s+value="([^"]*)"/);
                const notesMatch = html.match(/name="notes"\s+value="([^"]*)"/);

                // Validierung: sicherstellen dass wir die richtigen Werte gefunden haben
                if (!tokenMatch) {
                    throw new Error('Security Token konnte nicht gefunden werden. Möglicherweise keine Berechtigung.');
                }
                if (!titleMatch) {
                    throw new Error('Thread-Titel konnte nicht gefunden werden.');
                }

                // Checkbox-Status korrekt erkennen - suche nach name="open" mit checked
                const openMatch = html.match(/name="open"\s+value="yes"\s+id="cb_open"\s+checked="checked"/);
                const visibleMatch = html.match(/name="visible"\s+value="yes"\s+id="cb_visible"\s+checked="checked"/);

                // Icon-ID: suche nach name="iconid" mit value="X" und checked
                const iconidMatch = html.match(/name="iconid"\s+value="(\d+)"\s+id="rb_iconid_\d+"\s+checked="checked"/);

                const newSecurityToken = tokenMatch[1];
                const title = titleMatch[1];
                const notes = notesMatch ? notesMatch[1] : '';
                const open = openMatch ? 'yes' : '';
                const visible = visibleMatch ? 'yes' : '';
                const iconid = iconidMatch ? iconidMatch[1] : '0';

                statusDiv.textContent = 'Präfix wird gespeichert...';

                // Schritt 2: Formular mit allen erforderlichen Daten absenden
                const formData = new URLSearchParams();
                formData.append('s', '');
                formData.append('securitytoken', newSecurityToken);
                formData.append('t', threadId);
                formData.append('do', 'updatethread');
                formData.append('prefixid', selectedPrefix);
                formData.append('title', title);
                formData.append('notes', notes);
                // Nur append wenn wirklich gecheckt
                if (open) formData.append('open', open);
                if (visible) formData.append('visible', visible);
                formData.append('iconid', iconid);

                return fetch(`https://board.jdownloader.org/postings.php?do=updatethread&t=${threadId}`, {
                    method: 'POST',
                    body: formData,
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                });
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Fehler beim Speichern (HTTP ${response.status})`);
                }
                return response.text();
            })
            .then(html => {
                // Prüfe ob das Präfix tatsächlich gespeichert wurde (optional)
                // oder gehe einfach davon aus dass es funktioniert hat
                button.disabled = false;
                statusDiv.className = 'success';
                statusDiv.textContent = '✓ Präfix erfolgreich gespeichert!';

                // Nach 2 Sekunden neu laden
                setTimeout(() => {
                    location.reload();
                }, 2000);
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