// ==========================================================
// LOGIKA PRO PŘEPÍNÁNÍ STREAMŮ A OBSAHU (TABULÁTORY)
// ==========================================================

/**
 * Nastaví logiku pro přepínání záložek.
 * @param {string} buttonSelector CSS selektor pro všechna přepínací tlačítka.
 * @param {string} contentSelector CSS selektor pro všechny panely obsahu v dané skupině.
 */
function setupTabs(buttonSelector, contentSelector) {
    const buttons = document.querySelectorAll(buttonSelector);
    const contents = document.querySelectorAll(contentSelector);

    buttons.forEach(button => {
        button.addEventListener('click', () => {
            const targetId = button.getAttribute('data-tab') || button.getAttribute('data-content');

            if (!targetId) {
                console.warn('Tlačítko nemá definovaný cíl (data-tab/data-content).');
                return; 
            }

            // 1. Skryje veškerý obsah a zruší aktivní stav tlačítek
            buttons.forEach(btn => btn.classList.remove('active'));
            contents.forEach(content => content.classList.add('hidden'));

            // 2. Aktivuje vybrané tlačítko
            button.classList.add('active');

            // 3. Zobrazí odpovídající obsah
            const targetContent = document.getElementById(targetId);
            if (targetContent) {
                targetContent.classList.remove('hidden');
            } else {
                console.error(`Cílový prvek s ID "${targetId}" nebyl nalezen.`);
            }
        });
    });
}

// Spuštění kódu až po úplném načtení DOM (doporučená praxe)
document.addEventListener('DOMContentLoaded', () => {
    // Nastavení přepínání pro Streamy
    setupTabs('.stream-tabs .tab-button', '.stream-content .tab-content');

    // Nastavení přepínání pro Hlavní obsah
    setupTabs('.content-tabs .content-button', '.content-area .content-panel');
});