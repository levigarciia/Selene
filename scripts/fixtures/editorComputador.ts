import { app, BrowserWindow } from 'electron';

void app.whenReady().then(async () => {
    app.setAccessibilitySupportEnabled(true);
    const janela = new BrowserWindow({ width: 800, height: 700, webPreferences: { sandbox: true } });
    janela.setAlwaysOnTop(true);
    const botoes = Array.from({ length: 260 }, (_, indice) => `<button>Canal ${indice}</button>`).join('');
    await janela.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`
        <title>Editor de validação</title>
        <div style="display:grid;grid-template-columns:repeat(20,1fr)">${botoes}</div>
        <div contenteditable="true" role="textbox" aria-multiline="true"
            aria-label="Mensagem de validação">Anterior</div>
        <output id="envios">0</output>
        <output id="mensagem"></output>
        <script>
            const editor = document.querySelector('[contenteditable]');
            let texto = '';
            editor.addEventListener('input', () => { texto = editor.textContent; });
            editor.addEventListener('keydown', evento => {
                if (evento.key !== 'Enter') return;
                evento.preventDefault();
                if (!texto.trim()) return;
                document.querySelector('#envios').textContent = '1';
                document.querySelector('#mensagem').textContent = texto;
                editor.textContent = '';
                texto = '';
            });
        </script>
    `)}`);
    janela.focus();
});
