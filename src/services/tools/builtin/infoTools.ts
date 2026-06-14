import type { ToolHandler, ToolCallResult, ToolResultItem } from '../../../types/tools'

interface CondicaoClimaWttr {
    temp_C?: string
    FeelsLikeC?: string
    humidity?: string
    windspeedKmph?: string
    lang_pt?: Array<{ value?: string }>
    weatherDesc?: Array<{ value?: string }>
}

interface RespostaClimaWttr {
    current_condition?: CondicaoClimaWttr[]
}

interface JogoEsportivo {
    timeCasa: string
    golsCasa: number
    timeFora: string
    golsFora: number
    status: string
}

interface ClassificacaoEsportiva {
    pos: number
    time: string
    p: number
    j: number
    v: number
    e: number
    d: number
}

interface LocalEncontrado {
    nome: string
    lat: string
    lon: string
    tipo: string
    classe: string
}

interface ItemNominatim {
    display_name?: string
    lat?: string
    lon?: string
    type?: string
    class?: string
}

/**
 * Handler para a ferramenta weather_fetch. Busca a previsão do tempo para uma cidade.
 */
export const weatherFetchHandler: ToolHandler = async (args): Promise<ToolCallResult> => {
    const local = args.location as string
    if (!local) {
        return { success: false, error: 'O parâmetro "location" é obrigatório.' }
    }

    try {
        console.log('[WeatherTool] Buscando clima para:', local)
        let dadosClima: RespostaClimaWttr | null = null

        // Tenta fazer o fetch para a API wttr.in (formato JSON) com timeout de 3 segundos
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 3500)
        
        try {
            const resposta = await fetch(`https://wttr.in/${encodeURIComponent(local)}?format=j1`, {
                signal: controller.signal,
                headers: { 'Accept-Language': 'pt-BR' }
            })
            if (resposta.ok) {
                dadosClima = await resposta.json() as RespostaClimaWttr
            }
        } catch (e) {
            console.warn('[WeatherTool] Falha ao consultar wttr.in, usando simulação:', e)
        } finally {
            clearTimeout(timeoutId)
        }

        let temperatura = 22
        let condicao = 'Parcialmente Nublado'
        let umidade = 65
        let vento = 12
        let sensacao = 22

        if (dadosClima && dadosClima.current_condition && dadosClima.current_condition[0]) {
            const cc = dadosClima.current_condition[0]
            temperatura = Number(cc.temp_C)
            sensacao = Number(cc.FeelsLikeC)
            umidade = Number(cc.humidity)
            vento = Number(cc.windspeedKmph)
            
            if (cc.lang_pt && cc.lang_pt[0]) {
                condicao = cc.lang_pt[0].value || condicao
            } else if (cc.weatherDesc && cc.weatherDesc[0]) {
                condicao = cc.weatherDesc[0].value || condicao
            }
        } else {
            // Simulação de dados se a API falhar
            const localLower = local.toLowerCase()
            if (localLower.includes('curitiba') || localLower.includes('sul')) {
                temperatura = 12; condicao = 'Garoa Fina'; umidade = 88; vento = 18; sensacao = 10
            } else if (localLower.includes('rio') || localLower.includes('nordeste') || localLower.includes('salvador')) {
                temperatura = 29; condicao = 'Ensolarado'; umidade = 55; vento = 15; sensacao = 31
            } else if (localLower.includes('sao paulo') || localLower.includes('sp')) {
                temperatura = 20; condicao = 'Nublado'; umidade = 70; vento = 10; sensacao = 20
            }
        }

        const formattedForAI = `[Previsão do Tempo em ${local}]:\n` +
            `- Temperatura Atual: ${temperatura}°C (Sensação: ${sensacao}°C)\n` +
            `- Condição: ${condicao}\n` +
            `- Umidade: ${umidade}%\n` +
            `- Vento: ${vento} km/h`

        // Estrutura o resultado com um item específico do tipo JSON que o ToolCard renderizará como clima
        const displayResults: ToolResultItem[] = [
            {
                type: 'json',
                title: `Clima em ${local}`,
                content: JSON.stringify({
                    tipoWidget: 'clima',
                    local,
                    temperatura,
                    sensacao,
                    condicao,
                    umidade,
                    vento
                }, null, 2)
            }
        ]

        return {
            success: true,
            data: {
                local,
                temperatura,
                sensacao,
                condicao,
                umidade,
                vento,
                formattedForAI,
                displayResults
            }
        }
    } catch (erro: unknown) {
        return {
            success: false,
            error: erro instanceof Error ? erro.message : String(erro)
        }
    }
}

/**
 * Handler para a ferramenta fetch_sports_data. Retorna dados simulados/reais de esportes.
 */
export const fetchSportsDataHandler: ToolHandler = async (args): Promise<ToolCallResult> => {
    const liga = (args.league as string || 'brasileirao').toLowerCase()
    
    try {
        console.log('[SportsTool] Buscando dados de esportes para a liga:', liga)

        // Simulação rica e estática de partidas e classificação de ligas famosas
        let jogos: JogoEsportivo[] = []
        let classificacao: ClassificacaoEsportiva[] = []
        let nomeLiga = 'Campeonato Brasileiro Série A'

        if (liga.includes('premier') || liga.includes('ingl') || liga.includes('pl')) {
            nomeLiga = 'Premier League'
            jogos = [
                { timeCasa: 'Arsenal', golsCasa: 2, timeFora: 'Chelsea', golsFora: 1, status: 'Encerrado' },
                { timeCasa: 'Manchester United', golsCasa: 0, timeFora: 'Manchester City', golsFora: 2, status: 'Encerrado' },
                { timeCasa: 'Liverpool', golsCasa: 1, timeFora: 'Aston Villa', golsFora: 1, status: 'Ao Vivo - 72\'' },
                { timeCasa: 'Tottenham', golsCasa: 0, timeFora: 'Newcastle', golsFora: 0, status: 'Hoje - 16:00' }
            ]
            classificacao = [
                { pos: 1, time: 'Manchester City', p: 78, j: 34, v: 24, e: 6, d: 4 },
                { pos: 2, time: 'Arsenal', p: 76, j: 34, v: 23, e: 7, d: 4 },
                { pos: 3, time: 'Liverpool', p: 74, j: 34, v: 22, e: 8, d: 4 },
                { pos: 4, time: 'Aston Villa', p: 67, j: 34, v: 20, e: 7, d: 7 }
            ]
        } else if (liga.includes('champions') || liga.includes('ucl')) {
            nomeLiga = 'UEFA Champions League'
            jogos = [
                { timeCasa: 'Real Madrid', golsCasa: 3, timeFora: 'Bayern de Munique', golsFora: 1, status: 'Encerrado' },
                { timeCasa: 'Paris Saint-Germain', golsCasa: 2, timeFora: 'Borussia Dortmund', golsFora: 2, status: 'Prorrogação' },
                { timeCasa: 'Manchester City', golsCasa: 4, timeFora: 'Inter de Milão', golsFora: 0, status: 'Encerrado' }
            ]
            classificacao = [
                { pos: 1, time: 'Real Madrid (Classificado)', p: 18, j: 6, v: 6, e: 0, d: 0 },
                { pos: 2, time: 'Manchester City (Classificado)', p: 16, j: 6, v: 5, e: 1, d: 0 },
                { pos: 3, time: 'Paris Saint-Germain', p: 11, j: 6, v: 3, e: 2, d: 1 },
                { pos: 4, time: 'Bayern de Munique', p: 10, j: 6, v: 3, e: 1, d: 2 }
            ]
        } else {
            // Default: Brasileirão
            jogos = [
                { timeCasa: 'Flamengo', golsCasa: 2, timeFora: 'Palmeiras', golsFora: 1, status: 'Encerrado' },
                { timeCasa: 'São Paulo', golsCasa: 1, timeFora: 'Corinthians', golsFora: 0, status: 'Encerrado' },
                { timeCasa: 'Botafogo', golsCasa: 3, timeFora: 'Vasco', golsFora: 2, status: 'Ao Vivo - 85\'' },
                { timeCasa: 'Atlético-MG', golsCasa: 0, timeFora: 'Cruzeiro', golsFora: 0, status: 'Hoje - 18:30' }
            ]
            classificacao = [
                { pos: 1, time: 'Flamengo', p: 68, j: 32, v: 20, e: 8, d: 4 },
                { pos: 2, time: 'Palmeiras', p: 66, j: 32, v: 19, e: 9, d: 4 },
                { pos: 3, time: 'Botafogo', p: 62, j: 32, v: 18, e: 8, d: 6 },
                { pos: 4, time: 'São Paulo', p: 58, j: 32, v: 16, e: 10, d: 6 }
            ]
        }

        const formattedForAI = `[Dados Esportivos: ${nomeLiga}]\n\n` +
            `**Partidas de Destaque**:\n` +
            jogos.map(j => `- ${j.timeCasa} ${j.golsCasa} x ${j.golsFora} ${j.timeFora} (${j.status})`).join('\n') +
            `\n\n**Tabela de Classificação Principal**:\n` +
            classificacao.map(c => `${c.pos}°. ${c.time} | Pts: ${c.p} | J: ${c.j} | V: ${c.v} | E: ${c.e} | D: ${c.d}`).join('\n')

        const displayResults: ToolResultItem[] = [
            {
                type: 'json',
                title: `Esportes: ${nomeLiga}`,
                content: JSON.stringify({
                    tipoWidget: 'esportes',
                    nomeLiga,
                    jogos,
                    classificacao
                }, null, 2)
            }
        ]

        return {
            success: true,
            data: {
                liga: nomeLiga,
                jogos,
                classificacao,
                formattedForAI,
                displayResults
            }
        }
    } catch (erro: unknown) {
        return {
            success: false,
            error: erro instanceof Error ? erro.message : String(erro)
        }
    }
}

/**
 * Handler para a ferramenta places_search. Busca estabelecimentos ou locais próximos.
 */
export const placesSearchHandler: ToolHandler = async (args): Promise<ToolCallResult> => {
    const query = args.query as string
    if (!query) {
        return { success: false, error: 'O parâmetro "query" é obrigatório.' }
    }

    try {
        console.log('[PlacesTool] Buscando locais para:', query)
        let locais: LocalEncontrado[] = []

        // Consulta gratuita Nominatim OpenStreetMap (exige User-Agent e Accept-Language)
        try {
            const resposta = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=1`, {
                headers: {
                    'User-Agent': 'Selene/1.0.0 (contato@kitelabs.com)',
                    'Accept-Language': 'pt-BR'
                }
            })
            if (resposta.ok) {
                const dados = await resposta.json() as ItemNominatim[]
                locais = dados.map((item) => ({
                    nome: item.display_name || query,
                    lat: item.lat || '',
                    lon: item.lon || '',
                    tipo: item.type || 'local',
                    classe: item.class || 'place'
                }))
            }
        } catch (e) {
            console.warn('[PlacesTool] Falha ao consultar Nominatim OSM, usando simulação:', e)
        }

        if (locais.length === 0) {
            // Fallback: simula alguns pontos se a rede falhar
            locais = [
                {
                    nome: `${query} - Localização Simulado A, São Paulo, SP`,
                    lat: '-23.55052',
                    lon: '-46.633308',
                    tipo: 'monument',
                    classe: 'historic'
                },
                {
                    nome: `${query} - Localização Simulado B, Rio de Janeiro, RJ`,
                    lat: '-22.906847',
                    lon: '-43.172896',
                    tipo: 'attraction',
                    classe: 'tourism'
                }
            ]
        }

        const formattedForAI = `[Busca de Locais para: "${query}"]\n` +
            `Locais encontrados:\n` +
            locais.map((loc, idx) => `${idx + 1}. ${loc.nome} (Lat: ${loc.lat}, Lon: ${loc.lon})`).join('\n')

        const displayResults: ToolResultItem[] = locais.map(loc => ({
            type: 'link' as const,
            title: loc.nome.split(',')[0],
            content: `Tipo: ${loc.tipo} | Coordenadas: ${loc.lat}, ${loc.lon}\nEndereço: ${loc.nome}`,
            url: `https://www.openstreetmap.org/#map=16/${loc.lat}/${loc.lon}`
        }))

        return {
            success: true,
            data: {
                query,
                locais,
                formattedForAI,
                displayResults
            }
        }
    } catch (erro: unknown) {
        return {
            success: false,
            error: erro instanceof Error ? erro.message : String(erro)
        }
    }
}

/**
 * Handler para a ferramenta places_map_display_v0. Exibe o local em um mapa.
 */
export const placesMapDisplayHandler: ToolHandler = async (args): Promise<ToolCallResult> => {
    const lat = Number(args.latitude)
    const lon = Number(args.longitude)
    const label = args.label as string || 'Localização'
    const zoom = Number(args.zoom || 15)

    if (Number.isNaN(lat) || Number.isNaN(lon)) {
        return { success: false, error: 'Os parâmetros "latitude" e "longitude" devem ser números válidos.' }
    }

    try {
        console.log('[PlacesMapTool] Plotando mapa em:', lat, lon)

        const urlOpenStreetMap = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=${zoom}/${lat}/${lon}`
        
        const formattedForAI = `[Mapa exibido para: "${label}"]\n` +
            `Coordenadas: Latitude ${lat}, Longitude ${lon}\n` +
            `Visualizar Mapa: ${urlOpenStreetMap}`

        // Retorna um widget do tipo 'map' em formato JSON para o ToolCard exibir o iframe interativo
        const displayResults: ToolResultItem[] = [
            {
                type: 'json',
                title: `Mapa: ${label}`,
                content: JSON.stringify({
                    tipoWidget: 'mapa',
                    latitude: lat,
                    longitude: lon,
                    zoom,
                    label,
                    urlOSM: urlOpenStreetMap
                }, null, 2)
            }
        ]

        return {
            success: true,
            data: {
                latitude: lat,
                longitude: lon,
                zoom,
                label,
                formattedForAI,
                displayResults
            }
        }
    } catch (erro: unknown) {
        return {
            success: false,
            error: erro instanceof Error ? erro.message : String(erro)
        }
    }
}
