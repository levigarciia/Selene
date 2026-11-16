import { useEffect, useRef, useState } from 'react';
import { limiteAudioSegundos } from '../../shared/audio';

/** Grava somente por ação explícita e libera o microfone ao concluir, trocar de conversa ou sair. */
export function useGravacaoAudio(
    chave: string,
    anexar: (arquivos: File[]) => Promise<void>,
    informarErro: (erro: string) => void,
) {
    const [estado, definirEstado] = useState<'inativa' | 'solicitando' | 'gravando' | 'preparando'>('inativa');
    const [segundos, definirSegundos] = useState(0);
    const gravador = useRef<MediaRecorder | null>(null);
    const fluxo = useRef<MediaStream | null>(null);
    const sessao = useRef(0);
    const temporizador = useRef<ReturnType<typeof setInterval> | null>(null);
    const iniciando = useRef(false);

    function liberar() {
        if (temporizador.current) clearInterval(temporizador.current);
        temporizador.current = null;
        if (gravador.current) {
            gravador.current.onstop = null;
            gravador.current.ondataavailable = null;
            if (gravador.current.state !== 'inactive') gravador.current.stop();
        }
        gravador.current = null;
        fluxo.current?.getTracks().forEach((trilha) => trilha.stop());
        fluxo.current = null;
        iniciando.current = false;
    }

    useEffect(() => {
        definirEstado('inativa');
        definirSegundos(0);
        return () => { sessao.current++; liberar(); };
    }, [chave]);

    function concluir() {
        if (gravador.current?.state !== 'recording') return;
        definirEstado('preparando');
        gravador.current.stop();
    }

    async function iniciar() {
        if (iniciando.current || gravador.current) return;
        iniciando.current = true;
        const atual = ++sessao.current;
        definirEstado('solicitando');
        informarErro('');
        try {
            const capturado = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            if (atual !== sessao.current) {
                capturado.getTracks().forEach((trilha) => trilha.stop());
                return;
            }
            fluxo.current = capturado;
            const tipo = 'audio/webm;codecs=opus';
            const recorder = new MediaRecorder(capturado,
                MediaRecorder.isTypeSupported(tipo) ? { mimeType: tipo } : undefined);
            gravador.current = recorder;
            const partes: Blob[] = [];
            recorder.ondataavailable = (evento) => { if (evento.data.size) partes.push(evento.data); };
            recorder.onerror = () => {
                liberar();
                definirEstado('inativa');
                informarErro('Não foi possível gravar o áudio.');
            };
            recorder.onstop = async () => {
                const mime = recorder.mimeType;
                liberar();
                if (atual !== sessao.current) return;
                definirEstado('preparando');
                try {
                    const arquivo = new File(partes, 'Gravação.webm', { type: mime });
                    if (!arquivo.size) throw new Error('A gravação ficou vazia. Tente novamente.');
                    await anexar([arquivo]);
                } catch (erro) {
                    informarErro(erro instanceof Error ? erro.message : 'Não foi possível preparar a gravação.');
                } finally {
                    if (atual === sessao.current) definirEstado('inativa');
                }
            };
            recorder.start();
            definirSegundos(0);
            definirEstado('gravando');
            const inicio = Date.now();
            temporizador.current = setInterval(() => {
                const decorrido = Math.floor((Date.now() - inicio) / 1000);
                definirSegundos(decorrido);
                if (decorrido >= limiteAudioSegundos) concluir();
            }, 250);
        } catch (erro) {
            if (atual !== sessao.current) return;
            liberar();
            definirEstado('inativa');
            informarErro(erro instanceof DOMException && erro.name === 'NotAllowedError'
                ? 'Permita o acesso ao microfone para gravar áudio.'
                : 'Não foi possível acessar o microfone. Verifique o dispositivo.');
        }
    }

    return { estado, segundos, iniciar, concluir, ocupada: estado !== 'inativa' };
}
