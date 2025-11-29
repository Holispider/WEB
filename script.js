// ==========================================================
// LOGIKA PRO PŘEPÍNÁNÍ STREAMŮ A OBSAHU (TABULÁTORY)
// ==========================================================

function setupTabs(buttonSelector, contentSelector) {
    const buttons = document.querySelectorAll(buttonSelector);
    const contents = document.querySelectorAll(contentSelector);

    buttons.forEach(button => {
        button.addEventListener('click', () => {
            const targetId = button.getAttribute('data-tab') || button.getAttribute('data-content');

            // 1. Skryje veškerý obsah a zruší aktivní stav tlačítek
            buttons.forEach(btn => btn.classList.remove('active'));
            contents.forEach(content => content.classList.add('hidden'));

            // 2. Aktivuje vybrané tlačítko
            button.classList.add('active');

            // 3. Zobrazí odpovídající obsah
            const targetContent = document.getElementById(targetId);
            if (targetContent) {
                targetContent.classList.remove('hidden');
            }
        });
    });
}

// Nastavení přepínání pro Streamy
setupTabs('.stream-tabs .tab-button', '.stream-content .tab-content');

// Nastavení přepínání pro Hlavní obsah
setupTabs('.content-tabs .content-button', '.content-area .content-panel');

// Statické audio ukázky nepotřebují žádný další JavaScript.