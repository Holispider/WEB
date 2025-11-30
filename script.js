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

            buttons.forEach(btn => btn.classList.remove('active'));
            contents.forEach(content => content.classList.add('hidden'));

            button.classList.add('active');

            const targetContent = document.getElementById(targetId);
            if (targetContent) {
                targetContent.classList.remove('hidden');
            } else {
                console.error(`Cílový prvek s ID "${targetId}" nebyl nalezen.`);
            }
        });
    });
}

// ==========================================================
// LOGIKA PRO PROKLIK TTS Z BANNERU
// ==========================================================

/**
 * Zpracuje kliknutí na odkaz TTS v pravém banneru.
 * Přepne na záložku "TTS Kódy a Ukázky" v sekci hlavního obsahu 
 * a posune stránku k této sekci.
 */
function handleTTSLinkClick(event) {
    event.preventDefault(); // Zabrání výchozímu skoku kotvy

    const targetTabId = 'tts-kody';
    const mainInfoSection = document.querySelector('.main-info');
    
    if (mainInfoSection) {
        // 1. Najde a aktivuje tlačítko TTS
        const ttsButton = mainInfoSection.querySelector(`.content-button[data-content="${targetTabId}"]`);
        
        if (ttsButton) {
            // Simuluje kliknutí na tlačítko (vyvolá logiku přepínání)
            ttsButton.click(); 
        }

        // 2. Posune stránku na sekci Detaily o Streamu
        mainInfoSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}


// ==========================================================
// LOGIKA PRO ROTUJÍCÍ INSTAGRAM BANNER
// ==========================================================

/**
 * Nastaví automatickou rotaci (posouvání) obsahu v Instagram iframe.
 * @param {string} iframeId ID iframe (musí být 'instagram-iframe').
 * @param {number} containerHeight Výška výřezu (z CSS .instagram-widget-container).
 * @param {number} totalIframeHeight Celková výška obsahu iframe (z HTML style="height:...").
 * @param {number} stepSize O kolik pixelů posunout při každé rotaci (např. 350px = 1-2 příspěvky).
 * @param {number} intervalTime Jak často se má rotace spustit (v ms).
 */
function setupInstagramRotation(iframeId, containerHeight, totalIframeHeight, stepSize, intervalTime) {
    const iframe = document.getElementById(iframeId);
    if (!iframe) return;

    // Odečteme výšku kontejneru od celkové výšky obsahu (jak daleko můžeme maximálně posunout)
    const maxScroll = totalIframeHeight - containerHeight;
    let currentPosition = 0;

    function rotate() {
        // Kontrola pro případ, že je rotace vypnutá na mobilu (breakpoint 900px)
        if (window.innerWidth <= 900) {
            iframe.style.transform = 'translateY(0px)';
            return;
        }

        currentPosition += stepSize;
        
        // Pokud dosáhne konce, vrátí se na začátek
        if (currentPosition > maxScroll) {
            currentPosition = 0; 
            iframe.style.transition = 'none'; // Vypne animaci pro okamžitý skok
        } else {
            iframe.style.transition = 'transform 1s ease-in-out'; // Zapne animaci
        }

        // Aplikujeme posun (negativní hodnota posouvá obsah nahoru)
        iframe.style.transform = `translateY(-${currentPosition}px)`;
        
        // Pokud jsme skočili na 0 (začátek), je potřeba malá pauza před dalším plynulým posunem
        if (currentPosition === 0) {
            setTimeout(rotate, 5000); // 5 sekund pauza na začátku rotace
        }
    }

    // Spouštění rotace
    setInterval(rotate, intervalTime); 
}


// ==========================================================
// SPUŠTĚNÍ
// ==========================================================

document.addEventListener('DOMContentLoaded', () => {
    // Nastavení přepínání pro Streamy a Detaily
    setupTabs('.stream-tabs .tab-button', '.stream-content .tab-content');
    setupTabs('.content-tabs .content-button', '.content-area .content-panel');
    
    // Nastavení rotace pro Instagram banner
    // Hodnoty: ID, Výška výřezu (CSS: 550px), Celková výška iframe (HTML: 10780px), Krok, Interval (ms)
    setupInstagramRotation('instagram-iframe', 550, 10780, 350, 4000); 
});