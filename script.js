// JSZip ships as a classic UMD script (vendor/jszip.min.js) to avoid bare-specifier
// module resolution issues; THREE is vendored locally for offline reliability.
const JSZip = window.JSZip;
if (!window.JSZip) console.error('[boot] JSZip failed to load — zip import/export will be unavailable.');
import * as THREE from './vendor/three.module.js';

// New Audio Context for Web Audio API
const audioContext = new (window.AudioContext || window.webkitAudioContext)();
const audioCache = new Map(); // Cache for AudioBuffers

let dynamicSystemMessages = []; // Initialize dynamic system messages array to prevent ReferenceError
// NEW: language/i18n
let currentLanguage = 'en';
const translations = {
    en: {
        loading: {
            pcDisclaimer: 'DESIGNED FOR PC. MOBILE EXPERIENCE MAY BE UNBEARABLE.'
        },
        main: {
            titlePrefix: 'AI WORLD',
            titleSuffix: 'MAKER',
            tagline: 'THE ULTIMATE PROCEDURAL ADVENTURE ENGINE',
            myWorlds: 'MY WORLDS',
            onlineGallery: 'ONLINE GALLERY',
            featuredWorlds: 'FEATURED WORLDS',
            worldRoulette: 'WORLD ROULETTE',
            liveChat: 'Live Chat',
            settings: 'Settings',
            about: 'About',
            findPlayers: 'Find Players',
            credits: 'Credits',
            poweredBy: 'POWERED BY WEBSIM AI',
            pcOptimized: 'PC OPTIMIZED • MOBILE MAY BE UNBEARABLE',
            unknownProtocol: 'Unknown Protocol',
            back: 'Back',
            cancel: 'Cancel'
        },
        settings: {
            title: 'SYSTEM SETTINGS',
            languageLabel: 'Language',
            languageDescription: 'Change the interface language.',
            cornerRoundingLabel: 'Corner Rounding',
            cornerRoundingDescription: 'Toggle rounded edges for UI elements.',
            compressionLabel: 'Compression Level',
            compressionDescription: 'Reduces AI text length via recursive summarization.',
            soundsLabel: 'Sounds',
            soundsDescription: 'Volume for interface sound effects and haptic simulation.',
            musicLabel: 'Music',
            musicDescription: 'Volume for adaptive background music tracks.',
            lumenLabel: 'Lumen Mode',
            lumenDescription: 'Scene images are always shown. Use "Disable Images" to hide all visuals.',
            dateFormatLabel: 'Date Format',
            dateFormatDescription: 'Choose how dates are displayed throughout the UI.',
            clockStyleLabel: 'Clock Style',
            clockStyleDescription: 'Toggle between 12-hour and 24-hour time display.',
            backgroundLabel: 'Background Effects',
            backgroundDescription: 'Enable or disable the animated menu background shader (disable for low-end PCs).',
            ttsLabel: 'Voice Acting (TTS)',
            ttsDescription: 'Enable AI-generated voice acting for characters.',
            interpolationLabel: 'Image Downscaling',
            interpolationDescription: 'Change the algorithm used to render world visuals.',
            catInterface: 'INTERFACE & LOCALIZATION',
            catSimulation: 'AI & NARRATIVE ENGINE',
            catAudio: 'AUDIO & SOUND',
            catGraphics: 'GRAPHICS & VISUALS',
            resetBtn: 'Reset Defaults',
            downscaling: 'Image Downscaling',
            downscalingDesc: 'Change the algorithm used to render world visuals at smaller sizes.',
            panoramic: '360 Panorama',
            panoramicDesc: 'Generates immersive 360° views you can look around in.',
            fov: '360 Field of View',
            fovDesc: 'Adjust the default zoom level for 360-degree views.',
            bicubic: 'Bicubic (High Quality)',
            bilinear: 'Bilinear (Standard)',
            nearest: 'Nearest Neighbor (Pixelated)',
            enabled: 'Enabled',
            disabled: 'Disabled',
            vrSupport: 'VR Support (WebXR)',
            vrDesc: 'Enable Virtual Reality mode for 360-degree worlds. Requires a compatible headset.',
            catMaintenance: 'Maintenance',
            fileSystemTitle: 'VIRTUAL FILE SYSTEM',
            fileSystemDesc: 'Access and manage the raw data structures stored in your browser\'s local storage.',
            copyDirPath: 'COPY DATA DIRECTORY PATH',
            dataExportTitle: 'DATA BACKUP & PORTABILITY',
            dataExportDesc: 'Download your entire local library as a single master archive.',
            exportFull: 'EXPORT FULL MASTER BACKUP (.zip)',
            importFull: 'IMPORT MASTER BACKUP (.zip)'
        },
        chat: {
            title: 'Global Chat',
            placeholder: 'Type a message...',
            send: 'Send'
        },
        worlds: {
            title: 'My Worlds',
            tabLocal: 'My Library',
            tabPlayed: 'Played from Gallery',
            tabUploaded: 'My Uploads',
            simpleMode: 'Simple',
            advancedMode: 'Advanced',
            newName: 'Name:',
            newPrompt: 'Concept Prompt:',
            newObjective: 'World Objective / Win Condition:',
            createButton: 'Create',
            import: 'Import .aiworld',
            newSave: 'New Adventure',
            adventureSaves: 'Adventure Saves',
            saveChanges: 'Save Changes',
            shareOnline: 'Share Online',
            thumbnailLabel: 'Thumbnail (Optional - used for Gallery)',
            thumbnailHint: 'If you don\'t upload one, an AI-generated thumbnail will be created automatically when the world is saved.',
            worldMusic: 'World Music (Optional)',
            musicHint: 'Upload an MP3/WAV to set the world\'s theme.',
            namePlaceholder: 'e.g. Neon City',
            promptPlaceholder: 'Describe the world\'s atmosphere, rules, and dangers...',
            winConditionPlaceholder: 'Describe how the player wins...'
        },
        adv: {
            items: 'Items',
            locations: 'Locations',
            characters: 'Characters',
            rules: 'Lore & Rules',
            stats: 'Custom Stats',
            editItems: 'Edit Items',
            editLocations: 'Edit Locations',
            editCharacters: 'Edit Characters',
            editRules: 'Edit Lore & Rules',
            editStats: 'Edit Custom Stats',
            addNew: 'Add New',
            search: 'Search:',
            filterPlaceholder: 'Filter list...',
            name: 'Name',
            description: 'Description',
            namePlaceholder: 'Enter name...',
            descPlaceholder: 'Enter details...',
            customIcon: 'Custom Icon (Optional)',
            locationTheme: 'Location Theme (Optional)',
            voiceType: 'Voice Type (AI Voice Acting)',
            voicePreview: 'Preview Voice',
            voiceDesc: 'Used when this character speaks in dialogue.',
            startingValue: 'Starting Value (%)',
            barColor: 'Bar Color',
            saveEntry: 'Save Entry'
        },
        game: {
            inventory: 'Inventory',
            stats: 'Stats',
            placeholder: 'What do you do?',
            act: 'Act',
            log: 'LOG',
            toggleLog: 'Toggle Narrative Log',
            toggleInv: 'Toggle Inventory'
        },
        gallery: {
            searchPlaceholder: 'Search worlds by name or creator...',
            sortLabel: 'Sort:',
            sortDate: 'Date',
            sortRating: 'Rating',
            sortPlays: 'Plays',
            sortName: 'Name',
            orderDesc: 'Descending',
            orderAsc: 'Ascending',
            filtersBtn: 'Filters',
            filtersTitle: 'Search Filters',
            filterImageLabel: 'Visual Content',
            filterImageAny: 'All Visuals',
            filterImageHas: 'With Thumbnails',
            filterImageNone: 'No Thumbnails',
            filterComplexityLabel: 'World Complexity',
            filterComplexityAny: 'All Types',
            filterComplexitySimple: 'Simple Worlds Only',
            filterComplexityAdvanced: 'Advanced Worlds Only',
            filterWordsLabel: 'Word Count Range (Prompt)',
            filterWordsHint: 'Tip: Set maximum to 0 for no limit.',
            applyFilters: 'Apply Filters',
            copyId: 'Copy World ID',
            report: 'Report',
            downloadPlay: 'Play',
            banish: 'Banish',
            feature: 'Feature',
            unfeature: 'Unfeature',
            comments: 'COMMENTS',
            commentPlaceholder: 'Add your thought...',
            commentSend: 'SEND',
            worldConcept: 'WORLD CONCEPT',
            by: 'By:',
            plays: 'PLAYS:'
        },
        share: {
            title: 'Share World Online',
            subtitle: 'Publish your world to the Online Gallery for others to discover and play.',
            includeSaves: 'Include my adventure saves in the upload',
            unshare: 'Unupload World',
            upload: 'Upload to Gallery'
        },
        progress: {
            processing: 'Processing...',
            statusPreparing: 'Preparing world data...'
        },
        shadow: {
            title: 'Shadow Realm',
            subtitle: 'BANISHED CONCEPTS • VISIBLE ONLY TO THE OVERSEER',
            reveal: 'REVEAL BANISHED VISUALS'
        },
        reports: {
            title: 'World Reports',
            subtitle: 'PENDING REVIEWS • BREACH OF CONDUCT LOGS',
            inspect: 'Inspect World',
            dismiss: 'Dismiss'
        },
        profile: {
            title: 'User Profile',
            contributions: 'GALLERY CONTRIBUTIONS',
            statsSummary: 'Uploaded {worlds} Worlds • {wins} Won'
        },
        onboarding: {
            title: 'Choose Language',
            label: 'Interface Language',
            hint: 'You can change this later in System Settings.',
            continue: 'Continue'
        },
        playerSearch: {
            title: 'Player Search',
            placeholder: 'Search by username...',
            sortLabel: 'Sort:',
            sortWorlds: 'Worlds',
            sortVictories: 'Victories',
            sortUsername: 'Username',
            noPlayers: 'No players found matching that name.',
            stats: '{worlds} Worlds • {wins} Won',
            viewProfile: 'View Profile'
        },
        credits: {
            title: 'Credits',
            creator: 'Creator',
            vfx: 'Visual Effects',
            music: 'Menu Theme',
            engine: 'Engine',
            editorMusic: 'Face Raiders OST',
            legacy: 'Legacy'
        },
        roulette: {
            subtitle: 'Target a random adventure across the digital frontier.',
            complexityLabel: 'Complexity Filter',
            complexityAny: 'Any Complexity',
            complexitySimple: 'Simple Worlds Only',
            complexityAdvanced: 'Advanced Worlds Only',
            ratingLabel: 'Min Rating Filter',
            ratingAny: 'Any Rating',
            ratingPositive: 'Positive (+1)',
            ratingGood: 'Good (+5)',
            ratingLegendary: 'Legendary (+15)',
            spin: 'INITIATE SPIN',
            abort: 'ABORT'
        },
        about: {
            title: 'About the Engine',
            notice: 'NARRATIVE SIMULATION NOTICE',
            p1: 'AI World Maker is an <span style="color: #00f3ff; font-weight: bold;">AI-driven text adventure engine</span>. It uses advanced language models to act as a dynamic Game Master, generating stories, consequences, and descriptions based on your unique prompts.',
            p2: 'Please understand that this is <span style="text-decoration: underline;">not</span> a traditional 3D game engine. There are no actual physical "worlds" to explore in a literal sense. Instead, the engine synthesizes <span style="color: #ff00ff;">AI-generated snapshots</span> to visualize your journey.',
            p3: 'Every scene is a hallucination of the AI, designed to provide atmosphere to the text-based core of the simulation. Your choices drive the narrative, while the visuals act as a window into the AI\'s interpretation of your world.',
            techNote: '<span style="color: #00f3ff; font-weight: bold;">TECH NOTE:</span> The <span style="font-family: monospace; color: #ff00ff;">.aiworld</span> export files are standard <span style="font-weight: bold;">ZIP archives</span> containing your world configuration, metadata, and adventure logs.'
        }
    },
    pt: {
        main: {
            titlePrefix: 'MUNDO IA',
            titleSuffix: 'MAKER',
            tagline: 'O MOTOR DEFINITIVO DE AVENTURAS PROCEDURAIS',
            myWorlds: 'MEUS MUNDOS',
            onlineGallery: 'GALERIA ONLINE',
            featuredWorlds: 'MUNDOS EM DESTAQUE',
            worldRoulette: 'ROULETTE DE MUNDOS',
            liveChat: 'Chat Global',
            settings: 'Configurações',
            about: 'Sobre',
            findPlayers: 'Encontrar Jogadores',
            credits: 'Créditos',
            poweredBy: 'DESENVOLVIDO COM WEBSIM AI',
            pcOptimized: 'OTIMIZADO PARA PC • NO CELULAR PODE SER SOFRIDO'
        },
        settings: {
            title: 'CONFIGURAÇÕES DO SISTEMA',
            languageLabel: 'Idioma',
            languageDescription: 'Altere o idioma da interface.',
            compressionLabel: 'Nível de Compressão',
            compressionDescription: 'Reduz o texto da IA com sumarização recursiva.',
            soundsLabel: 'Sons',
            soundsDescription: 'Volume dos efeitos sonoros da interface.',
            musicLabel: 'Música',
            musicDescription: 'Volume das trilhas sonoras de fundo.',
            lumenLabel: 'Modo Lumen',
            lumenDescription: 'Filtro inteligente para imagens gráficas da IA.',
            dateFormatLabel: 'Formato de Data',
            dateFormatDescription: 'Escolha como as datas são exibidas.',
            clockStyleLabel: 'Formato de Hora',
            clockStyleDescription: 'Altere entre 12 e 24 horas.',
            backgroundLabel: 'Efeitos de Fundo',
            backgroundDescription: 'Ativar/desativar o shader animado do menu (melhor para PCs fracos desativar).',
            cornerRoundingLabel: 'Arredondamento de Cantos',
            cornerRoundingDescription: 'Ativar ou desativar cantos arredondados na interface.',
            ttsLabel: 'Dublagem (TTS)',
            ttsDescription: 'Ativar dublagem gerada por IA para personagens.',
            catInterface: 'INTERFACE E LOCALIZAÇÃO',
            catSimulation: 'IA E MOTOR NARRATIVO',
            catAudio: 'ÁUDIO E SOM',
            catGraphics: 'GRÁFICOS E VISUAIS'
        },
        chat: {
            title: 'Chat Global',
            placeholder: 'Digite uma mensagem...',
            send: 'Enviar'
        },
        worlds: {
            title: 'Meus Mundos',
            tabLocal: 'Minha Biblioteca',
            tabPlayed: 'Jogos da Galeria',
            tabUploaded: 'Meus Envios',
            simpleMode: 'Simples',
            advancedMode: 'Avançado',
            newName: 'Nome:',
            newPrompt: 'Conceito do Mundo:',
            newObjective: 'Objetivo / Condição de Vitória:',
            createButton: 'Criar'
        },
        gallery: {
            searchPlaceholder: 'Pesquisar mundos por nome ou criador...',
            sortLabel: 'Ordenar:',
            sortDate: 'Data',
            sortRating: 'Avaliação',
            sortPlays: 'Jogadas',
            sortName: 'Nome',
            orderDesc: 'Decrescente',
            orderAsc: 'Crescente'
        },
        playerSearch: {
            title: 'Busca de Jogadores',
            placeholder: 'Buscar por nome de usuário...',
            sortLabel: 'Ordenar:',
            sortWorlds: 'Mundos',
            sortVictories: 'Vitórias',
            sortUsername: 'Usuário',
            noPlayers: 'Nenhum jogador encontrado com esse nome.',
            stats: '{worlds} Mundos • {wins} Vitórias',
            viewProfile: 'Ver Perfil'
        },
        credits: {
            title: 'Créditos',
            creator: 'Criador',
            vfx: 'Efeitos Visuais',
            music: 'Tema do Menu',
            engine: 'Motor',
            editorMusic: 'Face Raiders OST',
            legacy: 'Legado'
        },
        roulette: {
            subtitle: 'Almeje uma aventura aleatória pela fronteira digital.',
            complexityLabel: 'Filtro de Complexidade',
            complexityAny: 'Qualquer Complexidade',
            complexitySimple: 'Mundos Simples Apenas',
            complexityAdvanced: 'Mundos Avançados Apenas',
            ratingLabel: 'Filtro de Avaliação Mínima',
            ratingAny: 'Qualquer Avaliação',
            ratingPositive: 'Positiva (+1)',
            ratingGood: 'Boa (+5)',
            ratingLegendary: 'Lendária (+15)',
            spin: 'INICIAR GIRO',
            abort: 'ABORTAR'
        },
        about: {
            title: 'Sobre o Motor',
            notice: 'AVISO DE SIMULAÇÃO NARRATIVA',
            p1: 'AI World Maker é um <span style="color: #00f3ff; font-weight: bold;">motor de aventura de texto impulsionado por IA</span>. Ele usa modelos de linguagem avançados para atuar como um Mestre de Jogo dinâmico, gerando histórias, consequências e descrições baseadas em seus comandos únicos.',
            p2: 'Por favor, entenda que este <span style="text-decoration: underline;">não</span> é um motor de jogo 3D tradicional. Não existem "mundos" físicos reais para explorar no sentido literal. Em vez disso, o motor sintetiza <span style="color: #ff00ff;">instantâneos gerados por IA</span> para visualizar sua jornada.',
            p3: 'Cada cena é uma alucinação da IA, projetada para fornecer atmosfera ao núcleo baseado em texto da simulação. Suas escolhas impulsionam a narrativa, enquanto os visuais agem como uma janela para a interpretação da IA do seu mundo.',
            techNote: '<span style="color: #00f3ff; font-weight: bold;">NOTA TÉCNICA:</span> Os arquivos de exportação <span style="font-family: monospace; color: #ff00ff;">.aiworld</span> são <span style="font-weight: bold;">arquivos ZIP padrão</span> contendo a configuração do seu mundo, metadados e registros de aventura.'
        }
    },
    pl: {
        main: {
            titlePrefix: 'ŚWIAT AI',
            titleSuffix: 'KREATOR',
            tagline: 'ULTYMATYWNY SILNIK PROCEDURALNYCH PRZYGÓD',
            myWorlds: 'MOJE ŚWIATY',
            onlineGallery: 'GALERIA ONLINE',
            featuredWorlds: 'WYRÓŻNIONE ŚWIATY',
            worldRoulette: 'RULETKA ŚWIATÓW',
            liveChat: 'Czat Globalny',
            settings: 'Ustawienia',
            about: 'O grze',
            findPlayers: 'Znajdź graczy',
            credits: 'Twórcy',
            poweredBy: 'NAPĘDZANE PRZEZ WEBSIM AI',
            pcOptimized: 'OPTYMALIZACJA NA PC • MOBILNIE MOŻE BOLEĆ'
        },
        settings: {
            title: 'USTAWIENIA SYSTEMU',
            languageLabel: 'Język',
            languageDescription: 'Zmień język interfejsu.',
            compressionLabel: 'Poziom kompresji',
            compressionDescription: 'Skraca tekst AI za pomocą podsumowań.',
            soundsLabel: 'Dźwięki',
            soundsDescription: 'Głośność efektów interfejsu.',
            musicLabel: 'Muzyka',
            musicDescription: 'Głośność muzyki w tle.',
            lumenLabel: 'Tryb Lumen',
            lumenDescription: 'Inteligentne filtrowanie drastycznych obrazów AI.',
            dateFormatLabel: 'Format daty',
            dateFormatDescription: 'Wybierz sposób wyświetlania dat.',
            clockStyleLabel: 'Zegar',
            clockStyleDescription: 'Przełącz pomiędzy zegarem 12/24h.',
            backgroundLabel: 'Efekty tła',
            backgroundDescription: 'Włącz/wyłącz animowany shader tła (dla słabszych PC wyłącz).',
            ttsLabel: 'Dubbing (TTS)',
            ttsDescription: 'Włącz generowany przez SI dubbing dla postaci.',
            catInterface: 'INTERFEJS I LOKALIZACJA',
            catSimulation: 'SI I SILNIK NARRACYJNY',
            catAudio: 'AUDIO I DŹWIĘK',
            catGraphics: 'GRAFIKA I WIZUALIZACJA'
        },
        chat: {
            title: 'Czat Globalny',
            placeholder: 'Napisz wiadomość...',
            send: 'Wyślij'
        },
        worlds: {
            title: 'Moje Światy',
            tabLocal: 'Moja Biblioteka',
            tabPlayed: 'Zagrane z Galerii',
            tabUploaded: 'Moje Wrzuty',
            simpleMode: 'Prosty',
            advancedMode: 'Zaawansowany',
            newName: 'Nazwa:',
            newPrompt: 'Opis koncepcji:',
            newObjective: 'Cel świata / warunek wygranej:',
            createButton: 'Utwórz'
        },
        gallery: {
            searchPlaceholder: 'Szukaj światów po nazwie lub twórcy...',
            sortLabel: 'Sortuj:',
            sortDate: 'Data',
            sortRating: 'Ocena',
            sortPlays: 'Gry',
            sortName: 'Nazwa',
            orderDesc: 'Malejąco',
            orderAsc: 'Rosnąco'
        },
        playerSearch: {
            title: 'Szukaj Graczy',
            placeholder: 'Szukaj po nazwie użytkownika...',
            sortLabel: 'Sortuj:',
            sortWorlds: 'Światy',
            sortVictories: 'Zwycięstwa',
            sortUsername: 'Użytkownik',
            noPlayers: 'Nie znaleziono graczy o tej nazwie.',
            stats: '{worlds} Światów • {wins} Wygranych',
            viewProfile: 'Zobacz Profil'
        },
        credits: {
            title: 'Twórcy',
            creator: 'Autor',
            vfx: 'Efekty Wizualne',
            music: 'Motyw Menu',
            engine: 'Silnik',
            editorMusic: 'Face Raiders OST',
            legacy: 'Dziedzictwo'
        },
        roulette: {
            subtitle: 'Wylosuj przygodę na cyfrowym pograniczu.',
            complexityLabel: 'Filtr złożoności',
            complexityAny: 'Dowolna złożoność',
            complexitySimple: 'Tylko proste światy',
            complexityAdvanced: 'Tylko zaawansowane światy',
            ratingLabel: 'Filtr minimalnej oceny',
            ratingAny: 'Dowolna ocena',
            ratingPositive: 'Pozytywna (+1)',
            ratingGood: 'Dobra (+5)',
            ratingLegendary: 'Legendarna (+15)',
            spin: 'ZAKRĘĆ',
            abort: 'PRZERWIJ'
        },
        about: {
            title: 'O silniku',
            notice: 'INFORMACJA O SYMULACJI NARRACYJNEJ',
            p1: 'AI World Maker to <span style="color: #00f3ff; font-weight: bold;">silnik przygodowy oparty na tekście i AI</span>. Wykorzystuje zaawansowane modele językowe, aby pełnić rolę dynamicznego Mistrza Gry, generując opowieści, konsekwencje i opisy na podstawie Twoich unikalnych promptów.',
            p2: 'Prosimy zrozumieć, że <span style="text-decoration: underline;">nie</span> jest to tradycyjny silnik gier 3D. W sensie dosłownym nie istnieją żadne fizyczne „światy” do eksploracji. Zamiast tego silnik syntetyzuje <span style="color: #ff00ff;">wygenerowane przez AI migawki</span>, aby zwizualizować Twoją podróż.',
            p3: 'Każda scena jest halucynacją sztucznej inteligencji, zaprojektowaną w celu nadania atmosfery tekstowemu rdzeniowi symulacji. Twoje wybory napędzają narrację, a wizualizacje służą jako okno na interpretację Twojego świata przez AI.',
            techNote: '<span style="color: #00f3ff; font-weight: bold;">NOTA TECHNICZNA:</span> Pliki eksportu <span style="font-family: monospace; color: #ff00ff;">.aiworld</span> to standardowe <span style="font-weight: bold;">archiwa ZIP</span> zawierające konfigurację świata, metadane i dzienniki przygód.'
        }
    },
    ar: {
        main: {
            titlePrefix: 'عَالَم الذكاء الاصطناعي',
            titleSuffix: 'صَانِع',
            tagline: 'مُحَرِّك المُغامَرات الإجرائية الأقصى',
            myWorlds: 'عوَالِمي',
            onlineGallery: 'المَعرِض عبر الإنترنت',
            featuredWorlds: 'عوَالِم مُمَيَّزة',
            worldRoulette: 'روليت العوَالِم',
            liveChat: 'دردشة عالمية',
            settings: 'الإعدادات',
            about: 'حول',
            findPlayers: 'البحث عن لاعبين',
            credits: 'إشادات',
            poweredBy: 'يَعمل بواسطة WEBSIM AI',
            pcOptimized: 'مُحسَّن للحاسوب • التجربة على الهاتف قد تكون سيئة'
        },
        settings: {
            title: 'إعدادات النظام',
            languageLabel: 'اللغة',
            languageDescription: 'غيّر لغة الواجهة.',
            compressionLabel: 'مستوى الضغط',
            compressionDescription: 'يُقَلِّص نصوص الذكاء الاصطناعي عبر التلخيص المتكرر.',
            soundsLabel: 'الأصوات',
            soundsDescription: 'مستوى صوت تأثيرات الواجهة.',
            musicLabel: 'الموسيقى',
            musicDescription: 'مستوى صوت موسيقى الخلفية.',
            lumenLabel: 'وضع Lumen',
            lumenDescription: 'ترشيح ذكي للصور العنيفة أو الصادمة.',
            dateFormatLabel: 'تنسيق التاريخ',
            dateFormatDescription: 'اختر كيفية عرض التواريخ في الواجهة.',
            clockStyleLabel: 'نمط الساعة',
            clockStyleDescription: 'التبديل بين تنسيق 12 ساعة و 24 ساعة.',
            backgroundLabel: 'تأثيرات الخلفية',
            backgroundDescription: 'تفعيل أو إيقاف مؤثرات الخلفية المتحركة (أوقفها للأجهزة الضعيفة).',
            ttsLabel: 'التمثيل الصوتي (TTS)',
            ttsDescription: 'تفعيل التمثيل الصوتي الناتج عن الذكاء الاصطناعي للشخصيات.',
            catInterface: 'الواجهة واللغة',
            catSimulation: 'محرك الذكاء الاصطناعي والسرد',
            catAudio: 'الأوديو والصوت',
            catGraphics: 'الجرافيك والمرئيات'
        },
        chat: {
            title: 'دردشة عالمية',
            placeholder: 'اكتب رسالة...',
            send: 'إرسال'
        },
        worlds: {
            title: 'عوَالِمي',
            tabLocal: 'مكتبتي',
            tabPlayed: 'لُعبت من المَعرِض',
            tabUploaded: 'عوَالِمي المرفوعة',
            simpleMode: 'بسيط',
            advancedMode: 'متقدِّم',
            newName: 'الاسم:',
            newPrompt: 'وصف الفكرة:',
            newObjective: 'هدف العالَم / شرط الفوز:',
            createButton: 'إنشاء'
        },
        gallery: {
            searchPlaceholder: 'ابحث عن العوالم بالاسم أو المنشئ...',
            sortLabel: 'فرز:',
            sortDate: 'التاريخ',
            sortRating: 'التقييم',
            sortPlays: 'اللعبات',
            sortName: 'الاسم',
            orderDesc: 'تنازلي',
            orderAsc: 'تصاعدي'
        },
        playerSearch: {
            title: 'البحث عن اللاعبين',
            placeholder: 'البحث عن طريق اسم المستخدم...',
            sortLabel: 'فرز:',
            sortWorlds: 'العوالم',
            sortVictories: 'الانتصارات',
            sortUsername: 'اسم المستخدم',
            noPlayers: 'لم يتم العثور على لاعبين بهذا الاسم.',
            stats: '{worlds} عوالم • {wins} فوز',
            viewProfile: 'عرض الملف الشخصي'
        },
        credits: {
            title: 'إشادات',
            creator: 'المنشئ',
            vfx: 'المؤثرات البصرية',
            music: 'لحن القائمة',
            engine: 'المحرك',
            editorMusic: 'Face Raiders OST',
            legacy: 'الإرث'
        },
        roulette: {
            subtitle: 'استهدف مغامرة عشوائية عبر الحدود الرقمية.',
            complexityLabel: 'فلتر التعقيد',
            complexityAny: 'أي تعقيد',
            complexitySimple: 'عوالم بسيطة فقط',
            complexityAdvanced: 'عوالم متقدمة فقط',
            ratingLabel: 'فلتر الحد الأدنى للتقييم',
            ratingAny: 'أي تقييم',
            ratingPositive: 'إيجابي (+1)',
            ratingGood: 'جيد (+5)',
            ratingLegendary: 'أسطوري (+15)',
            spin: 'بدء الدوران',
            abort: 'إلغاء'
        },
        about: {
            title: 'حول المحرك',
            notice: 'إشعار محاكاة سردية',
            p1: 'AI World Maker هو <span style="color: #00f3ff; font-weight: bold;">محرك مغامرات نصي يعتمد على الذكاء الاصطناعي</span>. يستخدم نماذج لغوية متقدمة ليعمل كمدير لعبة ديناميكي، حيث ينشئ القصص والنتائج والأوصاف بناءً على مطالباتك الفريدة.',
            p2: 'يرجى فهم أن هذا <span style="text-decoration: underline;">ليس</span> محرك ألعاب ثلاثي الأبعاد تقليديًا. لا توجد "عوالم" مادية فعلية لاستكشافها بالمعنى الحرفي. بدلاً من ذلك، يقوم المحرك بتركيب <span style="color: #ff00ff;">لقطات تم إنشاؤها بواسطة الذكاء الاصطناعي</span> لتصور رحلتك.',
            p3: 'كل مشهد هو هلوسة من الذكاء الاصطناعي، مصممة لإضفاء جو على الجوهر النصي للمحاكاة. اختياراتك تقود السرد، بينما تعمل المرئيات كنافذة على تفسير الذكاء الاصطناعي لعالمك.',
            techNote: '<span style="color: #00f3ff; font-weight: bold;">ملاحظة تقنية:</span> ملفات التصدير <span style="font-family: monospace; color: #ff00ff;">.aiworld</span> هي <span style="font-weight: bold;">أرشيفات ZIP قياسية</span> تحتوي على تكوين عالمك وبياناته الوصفية وسجلات المغامرة.'
        }
    },
    fil: {
        main: {
            titlePrefix: 'AI WORLD',
            titleSuffix: 'MAKER',
            tagline: 'ANG ULTIMATE ENGINE NG PROCEDURAL ADVENTURE',
            myWorlds: 'MGA MUNDO KO',
            onlineGallery: 'ONLINE GALLERY',
            featuredWorlds: 'FEATURED WORLDS',
            worldRoulette: 'WORLD ROULETTE',
            liveChat: 'Global Chat',
            settings: 'Settings',
            about: 'Tungkol',
            findPlayers: 'Hanapin ang Mga Manlalaro',
            credits: 'Credits',
            poweredBy: 'PINAPAGANA NG WEBSIM AI',
            pcOptimized: 'INAAYOS PARA SA PC • BAKA MASAKIT SA MOBILE'
        },
        settings: {
            title: 'SYSTEM SETTINGS',
            languageLabel: 'Wika',
            languageDescription: 'Palitan ang wika ng interface.',
            compressionLabel: 'Antas ng Compression',
            compressionDescription: 'Pinaiikli ang teksto ng AI gamit ang summarization.',
            soundsLabel: 'Tunog',
            soundsDescription: 'Bolume ng mga tunog ng interface.',
            musicLabel: 'Musika',
            musicDescription: 'Bolume ng background music.',
            lumenLabel: 'Lumen Mode',
            lumenDescription: 'Matalinong pag-filter ng graphic na imahe ng AI.',
            dateFormatLabel: 'Petsa',
            dateFormatDescription: 'Paano ipapakita ang petsa sa UI.',
            clockStyleLabel: 'Orasan',
            clockStyleDescription: 'Pumili sa 12‑oras o 24‑oras na display.',
            backgroundLabel: 'Background Effects',
            backgroundDescription: 'Buksan o isara ang animated na menu background (isara para sa mahihinang PC).',
            ttsLabel: 'Voice Acting (TTS)',
            ttsDescription: 'I-enable ang AI-generated voice acting para sa mga character.',
            catInterface: 'INTERFACE AT LOKALISASYON',
            catSimulation: 'AI AT NARRATIVE ENGINE',
            catAudio: 'AUDIO AT TUNOG',
            catGraphics: 'GRAPHICS AT VISUALS'
        },
        chat: {
            title: 'Global Chat',
            placeholder: 'Mag-type ng mensahe...',
            send: 'Send'
        },
        worlds: {
            title: 'Mga Mundo Ko',
            tabLocal: 'Aking Library',
            tabPlayed: 'Nalaro mula Gallery',
            tabUploaded: 'Mga Upload Ko',
            simpleMode: 'Simple',
            advancedMode: 'Advanced',
            newName: 'Pangalan:',
            newPrompt: 'Concept Prompt:',
            newObjective: 'Layunin ng Mundo / Panalo:',
            createButton: 'Create'
        },
        gallery: {
            searchPlaceholder: 'Maghanap ng mga mundo sa pangalan o gumawa...',
            sortLabel: 'I-sort:',
            sortDate: 'Petsa',
            sortRating: 'Rating',
            sortPlays: 'Mga Laro',
            sortName: 'Pangalan',
            orderDesc: 'Pababang',
            orderAsc: 'Pataas'
        },
        playerSearch: {
            title: 'Hanapin ang Mga Manlalaro',
            placeholder: 'Maghanap sa username...',
            sortLabel: 'I-sort:',
            sortWorlds: 'Mga Mundo',
            sortVictories: 'Mga Panalo',
            sortUsername: 'Username',
            noPlayers: 'Walang nahanap na manlalaro sa pangalang iyan.',
            stats: '{worlds} Mundo • {wins} Panalo',
            viewProfile: 'View Profile'
        },
        credits: {
            title: 'Credits',
            creator: 'Creator',
            vfx: 'Visual Effects',
            music: 'Menu Theme',
            engine: 'Engine',
            editorMusic: 'Face Raiders OST',
            legacy: 'Legacy'
        },
        roulette: {
            subtitle: 'Targetin ang isang random na adventure sa digital na hangganan.',
            complexityLabel: 'Filter ng Pagiging Kumplikado',
            complexityAny: 'Kahit Ano',
            complexitySimple: 'Mga Simpleng Mundo Lang',
            complexityAdvanced: 'Mga Advanced na Mundo Lang',
            ratingLabel: 'Filter ng Min Rating',
            ratingAny: 'Kahit Anong Rating',
            ratingPositive: 'Positibo (+1)',
            ratingGood: 'Maganda (+5)',
            ratingLegendary: 'Legendary (+15)',
            spin: 'SIMULAN ANG SPIN',
            abort: 'ITIGIL'
        },
        about: {
            title: 'Tungkol sa Engine',
            notice: 'NARRATIVE SIMULATION NOTICE',
            p1: 'Ang AI World Maker ay isang <span style="color: #00f3ff; font-weight: bold;">AI-driven text adventure engine</span>. Gumagamit ito ng mga advanced language models para magsilbing dynamic na Game Master, na gumagawa ng mga kwento, kahihinatnan, at deskripsyon base sa iyong mga unique prompt.',
            p2: 'Mangyaring intindihin na ito ay <span style="text-decoration: underline;">hindi</span> isang tradisyunal na 3D game engine. Walang totoong pisikal na "mundo" na pwedeng i-explore sa literal na kahulugan. Sa halip, ang engine ay nag-synthesize ng <span style="color: #ff00ff;">AI-generated snapshots</span> para ipakita ang iyong paglalakbay.',
            p3: 'Ang bawat eksena ay isang hallucination ng AI, na idinisenyo para magbigay ng atmospera sa text-based core ng simulation. Ang iyong mga desisyon ang nagpapatakbo ng kwento, habang ang mga visual ay nagsisilbing bintana sa interpretasyon ng AI sa iyong mundo.',
            techNote: '<span style="color: #00f3ff; font-weight: bold;">TECH NOTE:</span> Ang mga <span style="font-family: monospace; color: #ff00ff;">.aiworld</span> export files ay mga standard na <span style="font-weight: bold;">ZIP archive</span> na naglalaman ng iyong world configuration, metadata, at adventure logs.'
        }
    },
    id: {
        main: {
            titlePrefix: 'DUNIA AI',
            titleSuffix: 'MAKER',
            tagline: 'MESIN PETUALANGAN PROSEDURAL ULTIMATIF',
            myWorlds: 'DUNIAKU',
            onlineGallery: 'GALERI ONLINE',
            featuredWorlds: 'DUNIA PILIHAN',
            worldRoulette: 'ROLET DUNIA',
            liveChat: 'Obrolan Global',
            settings: 'Pengaturan',
            about: 'Tentang',
            findPlayers: 'Cari Pemain',
            credits: 'Kredit',
            poweredBy: 'DIDUKUNG OLEH WEBSIM AI',
            pcOptimized: 'DIOPTIMALKAN UNTUK PC • PENGALAMAN MOBILE BISA KURANG NYAMAN'
        },
        settings: {
            title: 'PENGATURAN SISTEM',
            languageLabel: 'Bahasa',
            languageDescription: 'Ubah bahasa antarmuka.',
            compressionLabel: 'Tingkat Kompresi',
            compressionDescription: 'Memperpendek teks AI dengan rangkuman berulang.',
            soundsLabel: 'Suara',
            soundsDescription: 'Volume efek suara antarmuka.',
            musicLabel: 'Musik',
            musicDescription: 'Volume musik latar.',
            lumenLabel: 'Mode Lumen',
            lumenDescription: 'Penyaringan cerdas untuk gambar AI yang terlalu grafis.',
            dateFormatLabel: 'Format Tanggal',
            dateFormatDescription: 'Pilih bagaimana tanggal ditampilkan.',
            clockStyleLabel: 'Gaya Jam',
            clockStyleDescription: 'Beralih antara format 12 jam dan 24 jam.',
            backgroundLabel: 'Efek Latar',
            backgroundDescription: 'Aktifkan/nonaktifkan shader latar menu animasi (nonaktifkan untuk PC lemah).',
            ttsLabel: 'Akting Suara (TTS)',
            ttsDescription: 'Aktifkan akting suara karakter yang dihasilkan AI.',
            catInterface: 'ANTARMUKA & LOKALISASI',
            catSimulation: 'AI & MESIN NARASI',
            catAudio: 'AUDIO & SUARA',
            catGraphics: 'GRAFIS & VISUAL'
        },
        chat: {
            title: 'Obrolan Global',
            placeholder: 'Ketik pesan...',
            send: 'Kirim'
        },
        worlds: {
            title: 'Duniaku',
            tabLocal: 'Perpustakaan Saya',
            tabPlayed: 'Dimainkan dari Galeri',
            tabUploaded: 'Upload Saya',
            simpleMode: 'Sederhana',
            advancedMode: 'Lanjutan',
            newName: 'Nama:',
            newPrompt: 'Konsep Dunia:',
            newObjective: 'Tujuan Dunia / Syarat Menang:',
            createButton: 'Buat'
        },
        gallery: {
            searchPlaceholder: 'Cari dunia berdasarkan nama atau pembuat...',
            sortLabel: 'Urutkan:',
            sortDate: 'Tanggal',
            sortRating: 'Rating',
            sortPlays: 'Mainkan',
            sortName: 'Nama',
            orderDesc: 'Menurun',
            orderAsc: 'Menaik'
        },
        playerSearch: {
            title: 'Cari Pemain',
            placeholder: 'Cari berdasarkan username...',
            sortLabel: 'Urutkan:',
            sortWorlds: 'Dunia',
            sortVictories: 'Kemenangan',
            sortUsername: 'Username',
            noPlayers: 'Tidak ada pemain yang ditemukan.',
            stats: '{worlds} Dunia • {wins} Menang',
            viewProfile: 'Lihat Profil'
        },
        credits: {
            title: 'Kredit',
            creator: 'Pembuat',
            vfx: 'Efek Visual',
            music: 'Tema Menu',
            engine: 'Mesin',
            editorMusic: 'Face Raiders OST',
            legacy: 'Warisan'
        },
        roulette: {
            subtitle: 'Targetkan petualangan acak di perbatasan digital.',
            complexityLabel: 'Filter Kompleksitas',
            complexityAny: 'Kompleksitas Apa Pun',
            complexitySimple: 'Hanya Dunia Sederhana',
            complexityAdvanced: 'Hanya Dunia Lanjutan',
            ratingLabel: 'Filter Rating Minimum',
            ratingAny: 'Rating Apa Pun',
            ratingPositive: 'Positif (+1)',
            ratingGood: 'Bagus (+5)',
            ratingLegendary: 'Legendaris (+15)',
            spin: 'MULAI PUTARAN',
            abort: 'BATALKAN'
        },
        about: {
            title: 'Tentang Mesin',
            notice: 'PEMBERITAHUAN SIMULASI NARATIF',
            p1: 'AI World Maker adalah <span style="color: #00f3ff; font-weight: bold;">mesin petualangan teks berbasis AI</span>. Ini menggunakan model bahasa tingkat lanjut untuk bertindak sebagai Game Master dinamis, menghasilkan cerita, konsekuensi, dan deskripsi berdasarkan prompt unik Anda.',
            p2: 'Harap dipahami bahwa ini <span style="text-decoration: underline;">bukan</span> mesin game 3D tradisional. Tidak ada "dunia" fisik nyata yang bisa dijelajahi dalam arti harfiah. Sebaliknya, mesin ini menyintesis <span style="color: #ff00ff;">cuplikan yang dihasilkan AI</span> untuk memvisualisasikan perjalanan Anda.',
            p3: 'Setiap adegan adalah halusinasi AI, yang dirancang untuk memberikan suasana pada inti simulasi berbasis teks. Pilihan Anda menggerakkan narasi, sementara visual bertindak sebagai jendela ke dalam interpretasi AI tentang dunia Anda.',
            techNote: '<span style="color: #00f3ff; font-weight: bold;">CATATAN TEKNIS:</span> File ekspor <span style="font-family: monospace; color: #ff00ff;">.aiworld</span> adalah <span style="font-weight: bold;">arsip ZIP standar</span> yang berisi konfigurasi dunia, metadata, dan log petualangan Anda.'
        }
    },
    de: {
        main: {
            titlePrefix: 'KI-WELT',
            titleSuffix: 'MAKER',
            tagline: 'DIE ULTIMATIVE ENGINE FÜR PROCEDURAL ADVENTURES',
            myWorlds: 'MEINE WELTEN',
            onlineGallery: 'ONLINE-GALERIE',
            featuredWorlds: 'EMPFOHLENE WELTEN',
            worldRoulette: 'WELTEN‑ROULETTE',
            liveChat: 'Globaler Chat',
            settings: 'Einstellungen',
            about: 'Info',
            findPlayers: 'Spieler finden',
            credits: 'Credits',
            poweredBy: 'ANGETRIEBEN VON WEBSIM AI',
            pcOptimized: 'FÜR PC OPTIMIERT • MOBIL KANN UNANGENEHM SEIN'
        },
        settings: {
            title: 'SYSTEMEINSTELLUNGEN',
            languageLabel: 'Sprache',
            languageDescription: 'Ändere die Sprache der Benutzeroberfläche.',
            compressionLabel: 'Kompressionsstufe',
            compressionDescription: 'Kürzt KI‑Texte mit rekursiver Zusammenfassung.',
            soundsLabel: 'Sounds',
            soundsDescription: 'Lautstärke für UI‑Soundeffekte.',
            musicLabel: 'Musik',
            musicDescription: 'Lautstärke für Hintergrundmusik.',
            lumenLabel: 'Lumen‑Modus',
            lumenDescription: 'Intelligenter Filter für drastische KI‑Bilder.',
            dateFormatLabel: 'Datumsformat',
            dateFormatDescription: 'Lege fest, wie Datumsangaben angezeigt werden.',
            clockStyleLabel: 'Uhrzeitformat',
            clockStyleDescription: 'Zwischen 12‑ und 24‑Stunden‑Anzeige wechseln.',
            backgroundLabel: 'Hintergrundeffekte',
            backgroundDescription: 'Animierten Menü‑Hintergrundshader aktivieren/deaktivieren (für schwächere PCs deaktivieren).',
            ttsLabel: 'Synchronisation (TTS)',
            ttsDescription: 'KI-generierte Sprachausgabe für Charaktere aktivieren.',
            catInterface: 'OBERFLÄCHE & LOKALISIERUNG',
            catSimulation: 'KI & NARRATIVE ENGINE',
            catAudio: 'AUDIO & SOUND',
            catGraphics: 'GRAFIK & VISUALS'
        },
        chat: {
            title: 'Globaler Chat',
            placeholder: 'Nachricht eingeben...',
            send: 'Senden'
        },
        worlds: {
            title: 'Meine Welten',
            tabLocal: 'Meine Bibliothek',
            tabPlayed: 'Aus Galerie gespielt',
            tabUploaded: 'Meine Uploads',
            simpleMode: 'Einfach',
            advancedMode: 'Fortgeschritten',
            newName: 'Name:',
            newPrompt: 'Weltkonzept:',
            newObjective: 'Weltziel / Siegbedingung:',
            createButton: 'Erstellen'
        },
        gallery: {
            searchPlaceholder: 'Welten nach Name oder Ersteller suchen...',
            sortLabel: 'Sortieren:',
            sortDate: 'Datum',
            sortRating: 'Bewertung',
            sortPlays: 'Spiele',
            sortName: 'Name',
            orderDesc: 'Absteigend',
            orderAsc: 'Aufsteigend'
        },
        playerSearch: {
            title: 'Spieler finden',
            placeholder: 'Nach Benutzername suchen...',
            sortLabel: 'Sortieren:',
            sortWorlds: 'Welten',
            sortVictories: 'Siege',
            sortUsername: 'Benutzername',
            noPlayers: 'Keine Spieler mit diesem Namen gefunden.',
            stats: '{worlds} Welten • {wins} Siege',
            viewProfile: 'Profil ansehen'
        },
        credits: {
            title: 'Credits',
            creator: 'Ersteller',
            vfx: 'Visuelle Effekte',
            music: 'Menü-Thema',
            engine: 'Engine',
            editorMusic: 'Face Raiders OST',
            legacy: 'Vermächtnis'
        },
        roulette: {
            subtitle: 'Ziele auf ein zufälliges Abenteuer an der digitalen Grenze.',
            complexityLabel: 'Komplexitätsfilter',
            complexityAny: 'Jede Komplexität',
            complexitySimple: 'Nur einfache Welten',
            complexityAdvanced: 'Nur fortgeschrittene Welten',
            ratingLabel: 'Mindestbewertungsfilter',
            ratingAny: 'Jede Bewertung',
            ratingPositive: 'Positiv (+1)',
            ratingGood: 'Gut (+5)',
            ratingLegendary: 'Legendär (+15)',
            spin: 'SPIN STARTEN',
            abort: 'ABBRECHEN'
        },
        about: {
            title: 'Über die Engine',
            notice: 'HINWEIS ZUR NARRATIVEN SIMULATION',
            p1: 'AI World Maker ist eine <span style="color: #00f3ff; font-weight: bold;">KI-gesteuerte Text-Adventure-Engine</span>. Sie nutzt fortschrittliche Sprachmodelle, um als dynamischer Game Master zu fungieren und Geschichten, Konsequenzen und Beschreibungen basierend auf Ihren einzigartigen Prompts zu generieren.',
            p2: 'Bitte haben Sie Verständnis dafür, dass dies <span style="text-decoration: underline;">keine</span> herkömmliche 3D-Game-Engine ist. Es gibt keine tatsächlichen physischen „Welten“ im wörtlichen Sinne zu erkunden. Stattdessen synthetisiert die Engine <span style="color: #ff00ff;">KI-generierte Schnappschüsse</span>, um Ihre Reise zu visualisieren.',
            p3: 'Jede Szene ist eine Halluvination der KI, die dazu dient, dem textbasierten Kern der Simulation Atmosphäre zu verleihen. Ihre Entscheidungen treiben die Erzählung voran, während die Grafiken als Fenster zur Interpretation Ihrer Welt durch die KI fungieren.',
            techNote: '<span style="color: #00f3ff; font-weight: bold;">TECH-HINWEIS:</span> Die <span style="font-family: monospace; color: #ff00ff;">.aiworld</span>-Exportdateien sind standardmäßige <span style="font-weight: bold;">ZIP-Archive</span>, die Ihre Weltkonfiguration, Metadaten und Abenteuerprotokolle enthalten.'
        }
    },
    uk: {
        main: {
            titlePrefix: 'СВІТ ШІ',
            titleSuffix: 'MAKER',
            tagline: 'ОСТАТОЧНИЙ ДВИГУН ПРОЦЕДУРНИХ ПРИГОД',
            myWorlds: 'МОЇ СВІТИ',
            onlineGallery: 'ОНЛАЙН‑ГАЛЕРЕЯ',
            featuredWorlds: 'ОБРАНІ СВІТИ',
            worldRoulette: 'РУЛЕТКА СВІТІВ',
            liveChat: 'Глобальний чат',
            settings: 'Налаштування',
            about: 'Про гру',
            findPlayers: 'Знайти гравців',
            credits: 'Титри',
            poweredBy: 'ПРАЦЮЄ НА WEBSIM AI',
            pcOptimized: 'ОПТИМІЗОВАНО ДЛЯ ПК • НА МОБІЛЬНОМУ МОЖЕ БУТИ НЕЗРУЧНО'
        },
        settings: {
            title: 'СИСТЕМНІ НАЛАШТУВАННЯ',
            languageLabel: 'Мова',
            languageDescription: 'Змініть мову інтерфейсу.',
            compressionLabel: 'Рівень стиснення',
            compressionDescription: 'Скорочує текст ШІ за допомогою узагальнення.',
            soundsLabel: 'Звуки',
            soundsDescription: 'Гучність звукових ефектів інтерфейсу.',
            musicLabel: 'Музика',
            musicDescription: 'Гучність фонової музики.',
            lumenLabel: 'Режим Lumen',
            lumenDescription: 'Розумна фільтрація надто жорстких зображень ШІ.',
            dateFormatLabel: 'Формат дати',
            dateFormatDescription: 'Виберіть, як відображати дати в інтерфейсі.',
            clockStyleLabel: 'Формат часу',
            clockStyleDescription: 'Перемикач між 12‑ та 24‑годинним форматом.',
            backgroundLabel: 'Ефекти фону',
            backgroundDescription: 'Увімкнути або вимкнути анімований фон меню (для слабких ПК краще вимкнути).',
            ttsLabel: 'Озвучення (TTS)',
            ttsDescription: 'Увімкнути озвучення персонажів, згенероване ШІ.',
            catInterface: 'ІНТЕРФЕЙС ТА ЛОКАЛІЗАЦІЯ',
            catSimulation: 'ШІ ТА НАРРАТИВНИЙ ДВИГУН',
            catAudio: 'АУДІО ТА ЗВУК',
            catGraphics: 'ГРАФІКА ТА ВІЗУАЛ'
        },
        chat: {
            title: 'Глобальний чат',
            placeholder: 'Введіть повідомлення...',
            send: 'Надіслати'
        },
        worlds: {
            title: 'Мої світи',
            tabLocal: 'Моя бібліотека',
            tabPlayed: 'Зіграно з галереї',
            tabUploaded: 'Мої завантаження',
            simpleMode: 'Простий',
            advancedMode: 'Розширений',
            newName: 'Назва:',
            newPrompt: 'Опис концепції:',
            newObjective: 'Мета світу / умова перемоги:',
            createButton: 'Створити'
        },
        gallery: {
            searchPlaceholder: 'Пошук світів за назвою або автором...',
            sortLabel: 'Сортувати:',
            sortDate: 'Дата',
            sortRating: 'Рейтинг',
            sortPlays: 'Ігри',
            sortName: 'Назва',
            orderDesc: 'За спаданням',
            orderAsc: 'За зростанням'
        },
        playerSearch: {
            title: 'Знайти гравців',
            placeholder: 'Пошук за ім\'ям...',
            sortLabel: 'Сортувати:',
            sortWorlds: 'Світи',
            sortVictories: 'Перемоги',
            sortUsername: 'Ім\'я',
            noPlayers: 'Гравців не знайдено.',
            stats: '{worlds} світів • {wins} перемог',
            viewProfile: 'Профіль'
        },
        credits: {
            title: 'Титри',
            creator: 'Автор',
            vfx: 'Візуальні ефекти',
            music: 'Тема меню',
            engine: 'Рушій',
            editorMusic: 'Face Raiders OST',
            legacy: 'Спадщина'
        },
        roulette: {
            subtitle: 'Оберіть випадкову пригоду на цифровому кордоні.',
            complexityLabel: 'Фільтр складності',
            complexityAny: 'Будь-яка складність',
            complexitySimple: 'Тільки прості світи',
            complexityAdvanced: 'Тільки розширені світи',
            ratingLabel: 'Фільтр мінімального рейтингу',
            ratingAny: 'Будь-який рейтинг',
            ratingPositive: 'Позитивний (+1)',
            ratingGood: 'Добрий (+5)',
            ratingLegendary: 'Легендарний (+15)',
            spin: 'ЗАПУСТИТИ',
            abort: 'СКАСУВАТИ'
        },
        about: {
            title: 'Про рушій',
            notice: 'ПОВІДОМЛЕННЯ ПРО НАРРАТИВНУ СИМУЛЯЦІЮ',
            p1: 'AI World Maker — це <span style="color: #00f3ff; font-weight: bold;">текстовий пригодницький рушій на базі ШІ</span>. Він використовує вдосконалені мовні моделі, щоб діяти як динамічний Гейм-майстер, створюючи історії, наслідки та описи на основі ваших унікальних підказок.',
            p2: 'Будь ласка, зрозумійте, що це <span style="text-decoration: underline;">не</span> традиційний рушій для 3D-ігор. У буквальному сенсі не існує реальних фізичних «світів» для дослідження. Замість цього рушій синтезує <span style="color: #ff00ff;">знімки, згенеровані ШІ</span>, щоб візуалізувати вашу подорож.',
            p3: 'Кожна сцена — це галюцинація ШІ, розроблена для створення атмосфери текстового ядра симуляції. Ваші вибори керують розповіддю, а візуальні ефекти діють як вікно в інтерпретацію вашого світу штучним інтелектом.',
            techNote: '<span style="color: #00f3ff; font-weight: bold;">ТЕХНІЧНА ПРИМІТКА:</span> Файли експорту <span style="font-family: monospace; color: #ff00ff;">.aiworld</span> є стандартними <span style="font-weight: bold;">ZIP-архівами</span>, що містять конфігурацію вашого світу, метадані та журнали пригод.'
        }
    }
};

function t(path) {
    const langPack = translations[currentLanguage] || translations.en;
    const segments = path.split('.');
    let obj = langPack;
    for (const seg of segments) {
        if (obj && Object.prototype.hasOwnProperty.call(obj, seg)) {
            obj = obj[seg];
        } else {
            obj = null;
            break;
        }
    }
    if (typeof obj === 'string') return obj;
    // fallback to English
    if (currentLanguage !== 'en') {
        const fallbackSegments = path.split('.');
        let fb = translations.en;
        for (const seg of fallbackSegments) {
            if (fb && Object.prototype.hasOwnProperty.call(fb, seg)) {
                fb = fb[seg];
            } else {
                fb = null;
                break;
            }
        }
        if (typeof fb === 'string') return fb;
    }
    return path;
}

function applyTranslations() {
    // Simple data-i18n text nodes
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        el.textContent = t(key);
    });
    // HTML content
    document.querySelectorAll('[data-i18n-html]').forEach(el => {
        const key = el.getAttribute('data-i18n-html');
        el.innerHTML = t(key);
    });
    // Placeholders
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        el.placeholder = t(key);
    });
    // Tooltips/Titles
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        const key = el.getAttribute('data-i18n-title');
        el.title = t(key);
    });
}
let dailyCountdownInterval = null; // Defined to prevent ReferenceError from legacy daily world logic

 // New global variable for UI sound volume
let uiSoundsVolume = 0.7; // Default volume
let globalCurrentUser = null;
let projectCreatorUsername = null;
 // New global variable for background shader toggle
let backgroundEnabled = true; // Default to on (shader active)
let voiceActingEnabled = true; // Default to on
let panoramicMode = true; // Default to on (360 viewing)
let panoramicFov = 75; // Default FOV
let cornerRoundingEnabled = true; // Default to on
// NEW: UI layout mode (legacy vs immersive)
let uiLayout = 'immersive'; // 'legacy' or 'immersive'
let imageInterpolation = 'nearest'; // 'bicubic', 'bilinear', or 'nearest'
let vrModeEnabled = false;

// Initialize WebsimSocket for online features
const room = new WebsimSocket();

// New global variables for music
let backgroundMusicSource = null; // To hold the currently playing source
let backgroundMusicGainNode = null; // To control music volume
let musicVolume = 0.4; // Default volume
let currentPlayingMusicUrl = null; // NEW: To keep track of what's currently playing

// NEW: Track which menu to return to when closing World Config
let configReturnMenu = null;
let profileReturnMenu = null;

// CHANGED: New global variable for image censoring mode (was imageCensoringEnabled)
let imageCensoringMode = 'hide'; // Default to 'hide', can be 'off' or 'hide'

 // NEW: Global variable to store the URL of the last hidden graphic image
let lastHiddenImageUrl = '';
let lastNon360ImageUrl = '';
// NEW: Global variables to remember the last scene image and whether it was hidden
let lastSceneImageUrl = '';
let lastSceneWasHidden = false;

// NEW: Global variable to keep track of the current location or world state
let currentLevel = "Uninitialized World"; 

const gameTitle = document.getElementById('game-title'); // Reference to game title
const creditsBtn = document.getElementById('credits-btn');
const creditsMenu = document.getElementById('credits-menu');
const creditsCloseBtn = document.getElementById('credits-close-btn');

const aboutBtn = document.getElementById('about-btn');
const aboutMenu = document.getElementById('about-menu');
const aboutCloseBtn = document.getElementById('about-close-btn');

const secretEmbedBtn = document.getElementById('secret-embed-btn');
const embedMenu = document.getElementById('embed-menu');
const embedCloseBtn = document.getElementById('embed-close-btn');

const secretIframe = embedMenu.querySelector('iframe');
const secretIframeUrl = secretIframe.src;

secretEmbedBtn.addEventListener('click', () => {
    playSound(audioCache.get('ui_click.mp3'), 0.4);
    stopMusic();
    // Ensure the iframe has its source set when opening
    secretIframe.src = secretIframeUrl;
    embedMenu.classList.remove('hidden');
    // Ensure the iframe gains focus so pointer lock can be requested by the game
    setTimeout(() => secretIframe.focus(), 100);
});

embedCloseBtn.addEventListener('click', () => {
    playSound(audioCache.get('ui_click.mp3'), 0.4);
    // "Mute" the embed by clearing the source so audio stops
    secretIframe.src = '';
    embedMenu.classList.add('hidden');
    // Resume menu music
    if (musicVolume > 0) {
        playBackgroundMusic('menumusic.mp3');
    }
});

creditsBtn.addEventListener('click', () => {
    playSound(audioCache.get('ui_click.mp3'), 0.4);
    creditsMenu.classList.remove('hidden');
});

creditsCloseBtn.addEventListener('click', () => {
    playSound(audioCache.get('ui_click.mp3'), 0.4);
    creditsMenu.classList.add('hidden');
});

aboutBtn.addEventListener('click', () => {
    playSound(audioCache.get('ui_click.mp3'), 0.4);
    aboutMenu.classList.remove('hidden');
});

aboutCloseBtn.addEventListener('click', () => {
    playSound(audioCache.get('ui_click.mp3'), 0.4);
    aboutMenu.classList.add('hidden');
});

const liveChatBtn = document.getElementById('live-chat-btn');
const liveChatMenu = document.getElementById('live-chat-menu');
const liveChatCloseBtn = document.getElementById('live-chat-close-btn');
const playerSearchBtn = document.getElementById('player-search-btn');
const playerSearchMenu = document.getElementById('player-search-menu');
const playerSearchCloseBtn = document.getElementById('player-search-close-btn');
const playerSearchInput = document.getElementById('player-search-input');
const playerSearchSort = document.getElementById('player-search-sort');
const playerSearchOrder = document.getElementById('player-search-order');
const playersList = document.getElementById('players-list');
const chatMessagesContainer = document.getElementById('chat-messages');
const chatInputForm = document.getElementById('chat-input-form');
const chatInput = document.getElementById('chat-input');

liveChatBtn.addEventListener('click', () => {
    playSound(audioCache.get('ui_click.mp3'), 0.4);
    liveChatMenu.classList.remove('hidden');
    scrollToBottom();
});

liveChatCloseBtn.addEventListener('click', () => {
    playSound(audioCache.get('ui_click.mp3'), 0.4);
    liveChatMenu.classList.add('hidden');
});

playerSearchBtn.addEventListener('click', () => {
    playSound(audioCache.get('ui_click.mp3'), 0.4);
    playerSearchMenu.classList.remove('hidden');
    renderPlayerSearch();
});

playerSearchCloseBtn.addEventListener('click', () => {
    playSound(audioCache.get('ui_click.mp3'), 0.4);
    playerSearchMenu.classList.add('hidden');
});

playerSearchInput.addEventListener('input', () => {
    renderPlayerSearch();
});

playerSearchSort.addEventListener('change', () => {
    playSound(audioCache.get('ui_click.mp3'), 0.4);
    renderPlayerSearch();
});

playerSearchOrder.addEventListener('change', () => {
    playSound(audioCache.get('ui_click.mp3'), 0.4);
    renderPlayerSearch();
});

function renderPlayerSearch() {
    playersList.innerHTML = '';
    const filter = playerSearchInput.value.toLowerCase();
    const sortBy = playerSearchSort.value;
    const order = playerSearchOrder.value;

    // Extract unique users from shared worlds
    const userMap = new Map();
    
    // Add users from shared worlds
    sharedWorlds.forEach(w => {
        if (!userMap.has(w.username)) {
            userMap.set(w.username, {
                username: w.username,
                worldCount: 0,
                victoryCount: 0,
                avatarUrl: `https://images.websim.com/avatar/${w.username}`
            });
        }
        userMap.get(w.username).worldCount++;
    });

    // Add users from victories
    sharedWorldVictories.forEach(v => {
        if (!userMap.has(v.username)) {
            userMap.set(v.username, {
                username: v.username,
                worldCount: 0,
                victoryCount: 0,
                avatarUrl: `https://images.websim.com/avatar/${v.username}`
            });
        }
        userMap.get(v.username).victoryCount++;
    });

    const users = Array.from(userMap.values());
    const filteredUsers = users.filter(u => u.username.toLowerCase().includes(filter));

    if (filteredUsers.length === 0) {
        playersList.innerHTML = `<p class="no-saves">${t('playerSearch.noPlayers')}</p>`;
        return;
    }

    // Sort logic
    filteredUsers.sort((a, b) => {
        let valA, valB;
        if (sortBy === 'worlds') {
            valA = a.worldCount; valB = b.worldCount;
        } else if (sortBy === 'victories') {
            valA = a.victoryCount; valB = b.victoryCount;
        } else if (sortBy === 'username') {
            valA = a.username.toLowerCase(); valB = b.username.toLowerCase();
        }

        if (valA < valB) return order === 'asc' ? -1 : 1;
        if (valA > valB) return order === 'asc' ? 1 : -1;
        return 0;
    });

    filteredUsers.forEach(user => {
        const card = document.createElement('div');
        card.className = 'shared-world-card player-card';
        card.style.alignItems = 'center';
        card.style.textAlign = 'center';
        card.style.padding = '25px';

        const statsStr = t('playerSearch.stats')
            .replace('{worlds}', user.worldCount)
            .replace('{wins}', user.victoryCount);

        card.innerHTML = `
            <img src="${user.avatarUrl}" class="profile-hero-avatar" style="width: 80px; height: 80px; margin-bottom: 10px;" alt="${user.username}" crossorigin="anonymous" onerror="window.__WS_AVATAR_FALLBACK&&window.__WS_AVATAR_FALLBACK(this)">
            <h4 style="margin: 5px 0;">${user.username}</h4>
            <div class="creator">${statsStr}</div>
            <button class="menu-button small" style="margin-top: 15px; width: 100%; background: linear-gradient(135deg, #00f3ff 0%, #0077ff 100%); color: #050508; border: none; font-weight: 900;">${t('playerSearch.viewProfile')}</button>
        `;

        card.addEventListener('click', () => {
            playerSearchMenu.classList.add('hidden');
            openUserProfile(user.username);
        });

        playersList.appendChild(card);
    });
}

function scrollToBottom() {
    chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
}

chatInputForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = chatInput.value.trim();
    if (!text) return;

    if (text.toLowerCase().includes('websim.com')) {
        alert("Self-promotion links are not allowed in the chat.");
        return;
    }

    chatInput.value = '';
    playSound(audioCache.get('ui_click.mp3'), 0.2);

    try {
        await room.collection('chat_message_v1').create({
            text: text,
            avatarUrl: globalCurrentUser?.avatarUrl || `https://images.websim.com/avatar/${globalCurrentUser?.username || 'anonymous'}`
        });
    } catch (err) {
        console.error("Failed to send chat message:", err);
    }
});

function setupChatSubscription() {
    room.collection('chat_message_v1').subscribe((messages) => {
        chatMessagesContainer.innerHTML = '';
        // messages are newest first from websim, so we reverse for display
        [...messages].reverse().forEach(msg => {
            if (msg.text.toLowerCase().includes('websim.com')) return;
            const isMe = globalCurrentUser && msg.username === globalCurrentUser.username;
            const item = document.createElement('div');
            item.className = `chat-message-item ${isMe ? 'me' : ''}`;
            
            const time = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            
            item.innerHTML = `
                <img src="${msg.avatarUrl}" class="chat-avatar user-link" data-username="${msg.username}" alt="${msg.username}" crossorigin="anonymous" onerror="window.__WS_AVATAR_FALLBACK&&window.__WS_AVATAR_FALLBACK(this)">
                <div class="chat-message-content">
                    <div class="chat-sender-info">
                        <span class="chat-sender-name user-link" data-username="${msg.username}">${msg.username}</span>
                        <span class="chat-timestamp">${time}</span>
                    </div>
                    <div class="chat-text">${msg.text}</div>
                </div>
            `;
            chatMessagesContainer.appendChild(item);
        });
        scrollToBottom();
    });
}



async function loadAudio(url) {
    if (audioCache.has(url)) {
        return audioCache.get(url);
    }
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        audioCache.set(url, audioBuffer);
        console.log(`Audio loaded and cached: ${url}`);
        return audioBuffer;
    } catch (error) {
        // Asset missing (the original websim media files aren't in the repo) —
        // synthesize a matching procedural sound so audio still works.
        console.warn(`Audio asset unavailable (${url}); synthesizing fallback.`, error.message || error);
        try {
            const synth = synthesizeFallbackAudio(url);
            if (synth) {
                audioCache.set(url, synth);
                return synth;
            }
        } catch (synthError) {
            console.error(`Fallback synthesis failed for ${url}:`, synthError);
        }
        return null; // Return null if loading fails
    }
}

/* Procedural stand-ins for the missing websim audio assets.
   Sound effects are short synthesized blips/noise bursts; music tracks become
   gentle looping ambient chord pads so menus and worlds still have a soundtrack. */
function synthesizeFallbackAudio(url) {
    const name = String(url).split('/').pop().toLowerCase();
    const rate = 44100;
    const isMusic = /music|complex|faceraiders|theme|\.mp3$/.test(name) &&
        !/^ui_|walk|eat|drink|monster/.test(name);
    const duration = isMusic ? 8.0 : (/monster/.test(name) ? 1.2 : 0.45);
    const frameCount = Math.floor(rate * duration);
    const buffer = audioContext.createBuffer(1, frameCount, rate);
    const data = buffer.getChannelData(0);

    const noise = (i) => (Math.sin(i * 12.9898) * 43758.5453) % 1;

    if (isMusic) {
        // Ambient chord pad loop: Am7 -> Fmaj7 arpeggio over a low drone.
        const progression = [
            [220.00, 261.63, 329.63, 415.30], // Am7-ish
            [174.61, 220.00, 261.63, 349.23]  // Fmaj-ish
        ];
        for (let i = 0; i < frameCount; i++) {
            const t = i / rate;
            const bar = Math.floor(t / 4) % progression.length;
            const chord = progression[bar];
            let s = 0;
            for (let n = 0; n < chord.length; n++) {
                const freq = chord[n];
                s += Math.sin(2 * Math.PI * freq * t) * 0.16;
                s += Math.sin(2 * Math.PI * (freq / 2) * t) * 0.10;
            }
            // Soft arpeggio blip every half second.
            const step = Math.floor(t * 2);
            const arp = chord[step % chord.length] * 2;
            const stepPhase = (t * 2) % 1;
            s += Math.sin(2 * Math.PI * arp * t) * Math.exp(-stepPhase * 6) * 0.12;
            // Loop-friendly fade at the edges.
            const edge = Math.min(1, t * 2, (duration - t) * 2);
            data[i] = Math.tanh(s * 0.8) * 0.5 * Math.max(0, edge);
        }
    } else if (/ui_click/.test(name)) {
        for (let i = 0; i < frameCount; i++) {
            const t = i / rate;
            data[i] = Math.sign(Math.sin(2 * Math.PI * 1180 * t)) * Math.exp(-t * 60) * 0.35;
        }
    } else if (/ui_confirm/.test(name)) {
        for (let i = 0; i < frameCount; i++) {
            const t = i / rate;
            const f = t < 0.09 ? 880 : 1320;
            data[i] = Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 14) * 0.4;
        }
    } else if (/ui_error/.test(name)) {
        for (let i = 0; i < frameCount; i++) {
            const t = i / rate;
            const f = 340 - t * 260;
            data[i] = Math.sign(Math.sin(2 * Math.PI * f * t)) * Math.exp(-t * 9) * 0.32;
        }
    } else if (/ui_gain/.test(name)) {
        for (let i = 0; i < frameCount; i++) {
            const t = i / rate;
            data[i] = (Math.sin(2 * Math.PI * 1320 * t) + 0.6 * Math.sin(2 * Math.PI * 1980 * t)) *
                Math.exp(-t * 7) * 0.3;
        }
    } else if (/ui_lose/.test(name)) {
        for (let i = 0; i < frameCount; i++) {
            const t = i / rate;
            const f = 420 - t * 500;
            data[i] = Math.sin(2 * Math.PI * Math.max(80, f) * t) * Math.exp(-t * 8) * 0.36;
        }
    } else if (/walk/.test(name)) {
        // Two soft footfalls.
        for (let i = 0; i < frameCount; i++) {
            const t = i / rate;
            const burst = (t < 0.12 || (t > 0.22 && t < 0.34)) ? 1 : 0;
            const local = (t > 0.22) ? t - 0.22 : t;
            data[i] = (noise(i) * 0.7 + Math.sin(2 * Math.PI * 90 * t) * 0.3) *
                burst * Math.exp(-local * 30) * 0.4;
        }
    } else if (/drink/.test(name)) {
        for (let i = 0; i < frameCount; i++) {
            const t = i / rate;
            const p = (t * 7) % 1;
            const f = 400 + Math.sin(t * 18) * 260;
            data[i] = Math.sin(2 * Math.PI * f * t) * Math.exp(-p * 4) * 0.25;
        }
    } else if (/eat/.test(name)) {
        for (let i = 0; i < frameCount; i++) {
            const t = i / rate;
            const burst = (t < 0.06 || (t > 0.12 && t < 0.18)) ? 1 : 0;
            const local = (t > 0.12) ? t - 0.12 : t;
            data[i] = noise(i * 1.7) * burst * Math.exp(-local * 45) * 0.5;
        }
    } else if (/monster/.test(name)) {
        for (let i = 0; i < frameCount; i++) {
            const t = i / rate;
            const trem = 0.6 + 0.4 * Math.sin(2 * Math.PI * 9 * t);
            const growl = Math.sin(2 * Math.PI * 72 * t) + 0.5 * Math.sin(2 * Math.PI * 108 * t) +
                0.25 * noise(i * 0.4);
            data[i] = growl * trem * Math.exp(-t * 2.2) * 0.4;
        }
    } else {
        for (let i = 0; i < frameCount; i++) {
            const t = i / rate;
            data[i] = Math.sin(2 * Math.PI * 720 * t) * Math.exp(-t * 30) * 0.3;
        }
    }

    return buffer;
}

function playSound(buffer, volume = 0.7) {
    // Check if UI sounds are muted
    if (uiSoundsVolume <= 0) {
        return;
    }

    if (!buffer) {
        console.warn("Attempted to play null audio buffer.");
        return;
    }

    // Check if AudioContext is suspended (e.g., before first user interaction)
    if (audioContext.state === 'suspended') {
        audioContext.resume().then(() => {
            console.log("AudioContext resumed for UI sound.");
            _playActualSound(buffer, volume);
        }).catch(e => console.error("Error resuming AudioContext for UI sound:", e));
    } else {
        _playActualSound(buffer, volume);
    }
}

function applyImageInterpolation() {
    const sceneImg = document.getElementById('current-scene-image');
    if (!sceneImg) return;

    // Apply to main scene image CSS
    if (imageInterpolation === 'nearest') {
        sceneImg.style.imageRendering = 'pixelated';
    } else if (imageInterpolation === 'bilinear') {
        sceneImg.style.imageRendering = 'auto'; // Browser default usually bilinear/bicubic
    } else {
        sceneImg.style.imageRendering = 'auto';
    }

    // Apply to Three.js if active
    if (PanoramaViewer.sphere && PanoramaViewer.sphere.material.uniforms.map.value) {
        const texture = PanoramaViewer.sphere.material.uniforms.map.value;
        if (imageInterpolation === 'nearest') {
            texture.minFilter = THREE.NearestFilter;
            texture.magFilter = THREE.NearestFilter;
        } else {
            texture.minFilter = THREE.LinearFilter;
            texture.magFilter = THREE.LinearFilter;
        }
        texture.needsUpdate = true;
    }
}

function _playActualSound(buffer, volume) {
    const source = audioContext.createBufferSource();
    source.buffer = buffer;

    const gainNode = audioContext.createGain();
    // Apply global sound volume
    gainNode.gain.value = volume * uiSoundsVolume;

    source.connect(gainNode);
    gainNode.connect(audioContext.destination);

    source.start(0);
}

// Add a function to stop music
function stopMusic() {
    if (backgroundMusicSource) {
        try {
            backgroundMusicSource.stop();
        } catch (e) {
            console.warn("Error stopping background music:", e);
        }
        backgroundMusicSource = null;
    }
    currentPlayingMusicUrl = null;
}

async function playBackgroundMusic(trackUrl) {
    if (musicVolume <= 0 || !trackUrl) {
        stopMusic();
        return;
    }

    if (currentPlayingMusicUrl === trackUrl) {
        // Just update volume if track is already playing
        if (backgroundMusicGainNode) {
            backgroundMusicGainNode.gain.setTargetAtTime(musicVolume, audioContext.currentTime, 0.1);
        }
        return;
    }

    stopMusic();
    currentPlayingMusicUrl = trackUrl;

    try {
        const buffer = await loadAudio(trackUrl);
        if (!buffer || currentPlayingMusicUrl !== trackUrl) return;

        backgroundMusicSource = audioContext.createBufferSource();
        backgroundMusicSource.buffer = buffer;
        backgroundMusicSource.loop = true;

        backgroundMusicGainNode = audioContext.createGain();
        backgroundMusicGainNode.gain.value = musicVolume; 

        backgroundMusicSource.connect(backgroundMusicGainNode);
        backgroundMusicGainNode.connect(audioContext.destination);

        backgroundMusicSource.start(0);
        console.log(`Playing background music: ${trackUrl.substring(0, 50)}...`);
    } catch (error) {
        console.error("Error playing background music:", error);
    }
}

// Also need to ensure AudioContext is resumed on first user interaction
document.addEventListener('click', async () => {
    if (audioContext.state === 'suspended') {
        try {
            await audioContext.resume();
            console.log("AudioContext resumed on user interaction.");
        } catch (e) {
            console.error("Error resuming AudioContext on user interaction:", e);
        }
    }
}, { once: true });

// New AI function for sound effects
async function getSoundEffects(userInputText, aiDescription, signal) {
    try {
        const SUMMARY_AI_TIMEOUT_MS = 10000;
        const soundAiPromise = websim.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: `You are a sound effects manager for a text-based adventure game.
Your task is to analyze the user's action and the game's AI description to determine which sound effects should be played.
Respond directly with a JSON array of sound effect objects, and no other text.
Each object in the array should have a "sound" property (the filename) and an optional "volume" property (a number between 0.0 and 1.0, default 0.7 if not specified).

Available sound files and their triggers:
- "walk.mp3": Play when the user or an entity is moving, walking, running, exploring, searching, advancing, or generally changing location.
- "eat.mp3": Play when the user consumes food or something solid.
- "drink.mp3": Play when the user consumes liquid, such as water or potions.
- "monster.mp3": Play ONLY during intense physical conflict or when an actual hostile monster/predator is actively attacking. Do not play for peaceful NPCs or general ambient tension.

Example JSON output:
[
  {"sound": "walk.mp3", "volume": 0.5},
  {"sound": "monster.mp3"}
]

If no sounds should be played, return an empty array: []

Analyze the following:
User Action: "${userInputText}"
AI Description: "${aiDescription}"
`
                }
            ],
            json: true,
            signal: signal
        });

        const timeoutPromise = new Promise((resolve, reject) => {
            const id = setTimeout(() => {
                clearTimeout(id);
                reject(new Error("Sound AI response timed out."));
            }, SUMMARY_AI_TIMEOUT_MS);
        });

        const completion = await Promise.race([soundAiPromise, timeoutPromise]);

        const sounds = JSON.parse(completion.content);
        if (Array.isArray(sounds) && sounds.every(s => typeof s === 'object' && typeof s.sound === 'string')) {
            return sounds;
        } else {
            console.error("Sound AI returned invalid JSON format:", sounds);
            throw new Error("Sound AI returned invalid data.");
        }
    } catch (error) {
        if (error.name === 'AbortError') {
            console.warn("Sound AI request aborted.");
            throw error;
        }
        console.error("Error getting sound effects from AI:", error);
        throw new Error(`Sound effect generation failed: ${error.message || 'unknown error'}`);
    }
}

/**
 * Decide which dialogue lines (quotes) should actually be voiced with TTS.
 * Returns an array of dialogue strings that should be spoken.
 */
async function filterDialoguesForTTS(description, signal) {
    try {
        const FILTER_TIMEOUT_MS = 8000;
        const dialogueRegex = /"([^"]+)"/g;
        const allMatches = [...description.matchAll(dialogueRegex)];
        const allLines = allMatches.map(m => m[1]).filter(Boolean);

        if (allLines.length === 0) return [];

        const filterPromise = websim.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: `You decide which quoted dialogue lines in a game narration should be voice acted.
Return ONLY JSON and nothing else.

Given a list of dialogue lines (quotes), choose the ones that are important enough to read out loud (e.g., NPC speech, ominous messages, key story beats).
Ignore repetitive filler, single-word exclamations, and system-like messages.

JSON schema:
{
  "speak": string[] // subset of provided lines to voice, in order
}`
                },
                {
                    role: "user",
                    content: `Full description:\n${description}\n\nExtracted quoted lines:\n${JSON.stringify(allLines)}`
                }
            ],
            json: true,
            signal
        });

        const timeoutPromise = new Promise((_, reject) => {
            const id = setTimeout(() => {
                clearTimeout(id);
                reject(new Error("Dialogue filter AI timed out."));
            }, FILTER_TIMEOUT_MS);
        });

        const completion = await Promise.race([filterPromise, timeoutPromise]);
        const result = JSON.parse(completion.content);
        if (!result || !Array.isArray(result.speak)) return allLines;

        // Only keep lines that actually exist in the original set
        const allowedSet = new Set(allLines);
        return result.speak.filter(l => typeof l === 'string' && allowedSet.has(l));
    } catch (err) {
        console.warn("Dialogue filter failed, falling back to all lines:", err);
        const fallbackMatches = [...description.matchAll(/"([^"]+)"/g)];
        return fallbackMatches.map(m => m[1]).filter(Boolean);
    }
}

// New AI function for summarizing text
async function voiceActDescription(description, world, signal) {
    if (!voiceActingEnabled) return;
    try {
        // Extract dialogue segments
        const dialogueRegex = /"([^"]+)"/g;
        const matches = [...description.matchAll(dialogueRegex)];
        if (matches.length === 0) return;

        // Ask a separate AI step which of these lines should actually be voiced
        const allLines = matches.map(m => m[1]).filter(Boolean);
        const selectedLines = await filterDialoguesForTTS(description, signal);
        if (!selectedLines || selectedLines.length === 0) return;

        const characterData = world.rawAdvancedDetails?.filter(d => d.type === 'characters') || [];

        const voiceMappingPromise = websim.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: `Analyze the provided game text and identify which character is speaking each dialogue line (text in quotes).
Assign a specific voice ID for each line based on the character's likely gender, age, and personality.
Available Predefined Characters: ${JSON.stringify(characterData.map(c => ({ name: c.name, preferredVoice: c.voiceId })))}

If a character is predefined, use their 'preferredVoice' if it isn't 'auto'.
If 'auto' or not predefined, choose from these generic codes: "en-male", "en-female", "en-male", "en-female", "en-male". Use variety.

Respond with a JSON array of objects:
{
  "dialogue": string, // the text in quotes
  "voiceId": string // the chosen voice code or ID
}
`
                },
                {
                    role: "user",
                    content: description
                }
            ],
            json: true,
            signal: signal
        });

        const mappingCompletion = await voiceMappingPromise;
        const segments = JSON.parse(mappingCompletion.content);

        // Sequence the audio playbacks
        for (const segment of segments) {
            try {
                // Ensure we never pass an invalid "auto" or empty voice ID to TTS.
                let resolvedVoiceId = segment.voiceId;
                if (!resolvedVoiceId || resolvedVoiceId === 'auto') {
                    // Default fallback voice when AI didn't pick a concrete one or character is set to "auto"
                    resolvedVoiceId = 'en-male';
                }

                const ttsResult = await websim.textToSpeech({
                    text: segment.dialogue,
                    voice: resolvedVoiceId
                });
                
                const audio = new Audio(ttsResult.url);
                // Use UI sound volume as the base so TTS isn't muted when music is turned down
                if (uiSoundsVolume <= 0) continue; // Skip playback if UI sounds are muted
                audio.volume = Math.min(1, uiSoundsVolume * 1.2);
                await new Promise((resolve) => {
                    audio.onended = resolve;
                    audio.onerror = resolve;
                    audio.play().catch(resolve);
                });
            } catch (err) {
                console.warn("TTS line failed:", err);
            }
        }
    } catch (error) {
        console.warn("Voice acting system failed:", error);
    }
}

async function summarizeText(originalText, level, signal) {
    // Prevent summarization of short status messages to avoid AI hallucinations/over-extrapolation
    if (level === 'off' || originalText.length < 180) {
        return originalText;
    }

    let systemPrompt = "";
    if (level === 'level1') {
        systemPrompt = `You are an AI condensation engine. Your goal is to provide a concise summary of the provided game narration while MANDATORILY PRESERVING all text within quotation marks.

INSTRUCTIONS:
1. Summarize the general narration into 2-3 engaging sentences.
2. ABSOLUTELY DO NOT add new details, locations, or entities that were not in the original text.
3. ABSOLUTELY DO NOT summarize, shorten, or paraphrase any text within quotation marks (dialogue, signs, notes, etc.).
4. Every single quote found in the source text MUST be included in your output VERBATIM and in its FULL ORIGINAL LENGTH.
5. If the source text consists primarily of quotes, keep all quotes and provide a brief one-sentence narrative context.

Respond only with the resulting text.`;
    } else if (level === 'level2') {
        systemPrompt = `You are an AI critical condensation engine. Your goal is to provide a minimalist summary of narrative events while MANDATORILY PRESERVING all text within quotation marks.

INSTRUCTIONS:
1. Summarize only the most critical narrative events (dangers, major scene changes, item gains).
2. ABSOLUTELY DO NOT add new details or plot points. If it didn't happen in the source, it doesn't happen in the summary.
3. ABSOLUTELY DO NOT summarize, shorten, or paraphrase any text within quotation marks (dialogue, signs, notes, etc.).
4. Every single quote found in the source text MUST be included in your output VERBATIM and in its FULL ORIGINAL LENGTH.
5. Quotations are top priority and must never be compressed, even if they are long.

Respond only with the resulting text.`;
    } else {
        console.warn(`Unknown summarization level: ${level}. Returning original text.`);
        return originalText;
    }

    try {
        const SUMMARY_AI_TIMEOUT_MS = 15000;
        const summaryAiPromise = websim.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: systemPrompt
                },
                {
                    role: "user",
                    content: originalText
                }
            ],
            signal: signal
        });

        const timeoutPromise = new Promise((resolve, reject) => {
            const id = setTimeout(() => {
                clearTimeout(id);
                reject(new Error("Summary AI response timed out."));
            }, SUMMARY_AI_TIMEOUT_MS);
        });

        const completion = await Promise.race([summaryAiPromise, timeoutPromise]);
        return completion.content.trim();
    } catch (error) {
        if (error.name === 'AbortError') {
            console.warn("Summary AI request aborted.");
            throw error;
        }
        console.error("Error summarizing text:", error);
        return originalText;
    }
}

function getSystemPrompt(world) {
    let advancedInfo = "";
    if (world.isAdvanced) {
        advancedInfo = `
--- ADVANCED WORLD DATA ---
STARTING ITEMS: ${world.startingItems || "None"}
LOCATIONS: ${world.locations || "Not specified"}
CHARACTERS/ENTITIES: ${world.characters || "Not specified"}
SPECIAL RULES/LORE: ${world.rules || "Not specified"}
CUSTOM TRACKED STATS: ${world.customStats || "None"}
---------------------------
`;
    }

    const winConditionText = world.objective ? `
--- WORLD OBJECTIVE / WIN CONDITION ---
${world.objective}
If the player fulfills this objective, you must set "game_won": true in your JSON response.
---------------------------------------` : "";

    const panoramicInstruction = panoramicMode ? `
- IMAGE FORMAT: You must describe a 360-degree equirectangular panorama. The image prompt should specify a seamless 360-degree view, ultra-wide angle, or panoramic perspective to ensure it looks correct in a 360 viewer.` : "";

    const survivalContext = `
--- SURVIVAL SYSTEM SETTINGS ---
- Hunger Logic: ${world.disableHunger ? "DISABLED. Do not track hunger or mention needing food/being hungry." : "ENABLED. Track hunger changes and describe the need for food."}
- Thirst Logic: ${world.disableThirst ? "DISABLED. Do not track thirst or mention needing water/being thirsty." : "ENABLED. Track thirst changes and describe the need for hydration."}
- DRAIN RATE: Enabled survival stats should drain faster than average (e.g., -5 to -12 per standard action).
- MINOR DAMAGE: Small scrapes, low falls, or minor inconveniences should do negligible health damage (0-2%).
--------------------------------`;

    return {
        role: "system",
        content: `You are a Master World-Building Engine. Your task is to generate an immersive, narrative experience based on the following world concept:
---
WORLD CONCEPT: ${world.prompt}
---${advancedInfo}${winConditionText}${survivalContext}
You synthesize this concept into a cohesive universe with its own rules, aesthetics, and storytelling potential.

Your goal is to immerse the player in a rich, reactive environment. You will describe the current scene, react to the player's actions, introduce new elements, NPCs, or challenges based on their choices, and guide them through this player-defined world.

CRITICAL INSTRUCTIONS:
1. ADHERE TO THEME: If the World Concept is not horror, DO NOT force horror elements, "creepypasta" tropes, or constant monster attacks. If the world is peaceful, sci-fi, or fantasy, focus on wonder, technology, or magic instead of fear.
2. VARIETY: Avoid repetitive "stay alive" loops. Include peaceful discovery, NPC interactions, mystery-solving, and environmental navigation.
3. PROGRESSION: Allow the player to make meaningful progress toward their objective or finding an escape. Do not trap them in an endless cycle of attacks.
4. TONE CONSISTENCY: Maintain the specific tone of the concept provided (e.g., whimsical, gritty, sterile, nostalgic).
5. STAT BALANCING: Minor injuries should have near-zero impact on health. ${!world.disableHunger || !world.disableThirst ? 'However, if an ENABLED survival stat (hunger/thirst) is at 0, describe the player\'s physical deterioration in your narrative.' : ''}

When describing a scene, always write from the player’s first-person perspective ("you" POV) and focus on sensory details: what you see, hear, feel, and the overall atmosphere. Be specific and evocative.

Your response MUST be a JSON object with these fields:
{
  "description": "A detailed textual description of the current situation, what the player sees, hears, feels, and the outcome of their action. Concise but evocative.",
  "image_prompt": "A cinematic, detailed visual description suitable for AI image generation, based on the 'description' field. This field is MANDATORY. ${panoramicMode ? 'Include "equirectangular 360 panorama" in the prompt.' : ''}",
  "items_gained": [{"name": "item_name", "quantity": 1}],
  "items_lost": [{"name": "item_name", "quantity": 1}],
  "stats_changes": {
    "health_change": 0,
    "hunger_change": 0,
    "thirst_change": 0,
    "sanity_change": 0,
    "custom_stats": { "stat_name": value_change }
  },
  "game_won": boolean,
  "current_level": "A string representing the current location or world state"
}

Rules for your responses:
1.  Maintain consistency within the world's internal logic.
2.  The image_prompt should ONLY describe what is *visually seen*.
3.  Ensure the image prompt implies a human perspective.
4.  Stat changes should be logical based on events.
5.  If "game_won" is true, describe the victory clearly in the "description". Note that the player can continue exploring even after a win.
6.  YOU ARE THE ARBITER: Do not allow the player to 'manifest' items or outcomes by simply stating they happened (e.g., 'I explored and found a shotgun'). You decide if an action succeeds and what is actually found. If a player attempts to manifest items, describe them finding nothing, or something mundane and narratively appropriate instead.
7.  INVENTORY MANAGEMENT: You are responsible for the player's inventory. If the player consumes, uses, breaks, drops, or loses an item mentioned in their action or the narrative, you MUST include it in the 'items_lost' array with the correct quantity. If they gain items, include them in 'items_gained'. Never ignore item usage.`
    };
}

let conversationHistory = [];

const textOutputDiv = document.getElementById('text-output');
const imageDisplayDiv = document.getElementById('image-display');
const userInput = document.getElementById('user-input');
const inputForm = document.getElementById('input-form');
const loadingDiv = document.getElementById('loading');
const actButton = document.getElementById('act-button');

const currentSceneImage = document.getElementById('current-scene-image');

let inventory = {};
const inventoryList = document.getElementById('inventory-list');

let playerStats = {
    health: 100,
    hunger: 100,
    thirst: 100,
    custom: {}
};
const healthBar = document.getElementById('health-bar');
const healthStatValue = document.getElementById('health-stat');
const hungerBar = document.getElementById('hunger-bar');
const hungerStatValue = document.getElementById('hunger-stat');
const thirstBar = document.getElementById('thirst-bar');
const thirstStatValue = document.getElementById('thirst-stat');



const DEFAULT_SUMMARIZE_LEVEL = 'level2';

const settingsButton = document.getElementById('settings-btn');
const settingsMenu = document.getElementById('settings-menu');
const mainMenuSummarizeSelect = document.getElementById('main-menu-summarize-select');
const mainMenuCloseOptionsButton = document.getElementById('main-menu-close-options-button');
const resetSettingsButton = document.getElementById('reset-settings-btn');

const uiSoundsSlider = document.getElementById('ui-sounds-slider');
const languageSelect = document.getElementById('language-select');
const uiSoundsValue = document.getElementById('ui-sounds-value');

// First-run language onboarding elements
const languageOnboardingModal = document.getElementById('language-onboarding');
const onboardingLanguageSelect = document.getElementById('onboarding-language-select');
const onboardingLanguageConfirmBtn = document.getElementById('onboarding-language-confirm-btn');
const musicSlider = document.getElementById('music-slider');
const musicValue = document.getElementById('music-value');
const imageCensoringSelect = document.getElementById('image-censoring-select');

// New date/time setting controls
const timeFormatSelect = document.getElementById('time-format-select'); // 'mdy' or 'dmy'
const timeClockSelect = document.getElementById('time-clock-select');   // '12' or '24'
const cornerRoundingSelect = document.getElementById('corner-rounding-select');
const toggleLogBtn = document.getElementById('toggle-log-btn');
const toggleInvBtn = document.getElementById('toggle-inv-btn');
const uiLayoutSelect = document.getElementById('ui-layout-select');
const ttsToggleSelect = document.getElementById('tts-toggle-select');
const vrModeSelect = document.getElementById('vr-mode-select');
const enterVRBtn = document.getElementById('enter-vr-btn');
const imageInterpolationSelect = document.getElementById('image-interpolation-select');
const panoramicModeSelect = document.getElementById('panoramic-mode-select');
const panoramicFovSlider = document.getElementById('panoramic-fov-slider');
const panoramicFovValue = document.getElementById('panoramic-fov-value');

// Provide formatting helpers that respect user settings
function formatDateForUI(dateObj) {
    if (!dateObj || isNaN(dateObj.getTime())) return 'Unknown Date';
    const format = (timeFormatSelect && timeFormatSelect.value) ? timeFormatSelect.value : 'mdy';
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    const year = dateObj.getFullYear();
    if (format === 'dmy') {
        return `${day}/${month}/${year}`;
    }
    // default mdy
    return `${month}/${day}/${year}`;
}

function formatTimeForUI(dateObj) {
    if (!dateObj || isNaN(dateObj.getTime())) return '';
    const clock = (timeClockSelect && timeClockSelect.value) ? timeClockSelect.value : '12';
    const hours = dateObj.getHours();
    const minutes = String(dateObj.getMinutes()).padStart(2, '0');
    if (clock === '24') {
        return `${String(hours).padStart(2, '0')}:${minutes}`;
    } else {
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const h12 = hours % 12 === 0 ? 12 : hours % 12;
        return `${h12}:${minutes} ${ampm}`;
    }
}

const loadingSplash = document.getElementById('loading-splash');

let currentSummarizeLevel = DEFAULT_SUMMARIZE_LEVEL;

let cancellationTokenSource = null;

const FULL_CONSUMPTION_ITEMS = ['Supplies', 'Rations', 'Medkit'];

// NEW: DOM elements for graphic image reveal
const graphicContentWarning = document.getElementById('graphic-content-warning');

/* NEW: WebGL Shader Background */
class MenuShaderBackground {
    constructor(canvas) {
        this.canvas = canvas;
        this.gl = canvas.getContext('webgl');
        if (!this.gl) return;

        this.startTime = Date.now();
        this.animationFrameId = null;

        this.init();
    }

    init() {
        const gl = this.gl;

        const vsSource = `
            attribute vec2 position;
            void main() {
                gl_Position = vec4(position, 0.0, 1.0);
            }
        `;

        const fsSource = `
            precision highp float;
            uniform vec2 iResolution;
            uniform float iTime;

            // sun & grid functions
            // Shader License: CC BY 3.0
            // Author: Jan Mróz (jaszunio15)
            // Thanks

            float sun(vec2 uv, float battery)
            {
                float val = smoothstep(0.3, 0.29, length(uv));
                float bloom = smoothstep(0.7, 0.0, length(uv));
                float cut = 3.0 * sin((uv.y + iTime * 0.2 * (battery + 0.02)) * 100.0) 
                            + clamp(uv.y * 14.0 + 1.0, -6.0, 6.0);
                cut = clamp(cut, 0.0, 1.0);
                return clamp(val * cut, 0.0, 1.0) + bloom * 0.6;
            }

            float grid(vec2 uv, float battery)
            {
                vec2 size = vec2(uv.y, uv.y * uv.y * 0.2) * 0.01;
                uv += vec2(0.0, iTime * 4.0 * (battery + 0.05));
                uv = abs(fract(uv) - 0.5);
                vec2 lines = smoothstep(size, vec2(0.0), uv);
                lines += smoothstep(size * 5.0, vec2(0.0), uv) * 0.4 * battery;
                return clamp(lines.x + lines.y, 0.0, 3.0);
            }

            float dot2(in vec2 v ) { return dot(v,v); }

            float sdTrapezoid( in vec2 p, in float r1, float r2, float he )
            {
                vec2 k1 = vec2(r2,he);
                vec2 k2 = vec2(r2-r1,2.0*he);
                p.x = abs(p.x);
                vec2 ca = vec2(p.x-min(p.x,(p.y<0.0)?r1:r2), abs(p.y)-he);
                vec2 cb = p - k1 + k2*clamp( dot(k1-p,k2)/dot2(k2), 0.0, 1.0 );
                float s = (cb.x<0.0 && ca.y<0.0) ? -1.0 : 1.0;
                return s*sqrt( min(dot2(ca),dot2(cb)) );
            }

            float sdLine( in vec2 p, in vec2 a, in vec2 b )
            {
                vec2 pa = p-a, ba = b-a;
                float h = clamp( dot(pa,ba)/dot(ba,ba), 0.0, 1.0 );
                return length( pa - ba*h );
            }

            float sdBox( in vec2 p, in vec2 b )
            {
                vec2 d = abs(p)-b;
                return length(max(d,vec2(0))) + min(max(d.x,d.y),0.0);
            }

            float opSmoothUnion(float d1, float d2, float k){
                float h = clamp(0.5 + 0.5 * (d2 - d1) /k,0.0,1.0);
                return mix(d2, d1 , h) - k * h * ( 1.0 - h);
            }

            float sdCloud(in vec2 p, in vec2 a1, in vec2 b1, in vec2 a2, in vec2 b2, float w)
            {
                float lineVal1 = sdLine(p, a1, b1);
                float lineVal2 = sdLine(p, a2, b2);
                vec2 ww = vec2(w*1.5, 0.0);
                vec2 left = max(a1 + ww, a2 + ww);
                vec2 right = min(b1 - ww, b2 - ww);
                vec2 boxCenter = (left + right) * 0.5;
                float boxH = abs(a2.y - a1.y) * 0.5;
                float boxVal = sdBox(p - boxCenter, vec2(0.04, boxH)) + w;
                
                float uniVal1 = opSmoothUnion(lineVal1, boxVal, 0.05);
                float uniVal2 = opSmoothUnion(lineVal2, boxVal, 0.05);
                
                return min(uniVal1, uniVal2);
            }

            void mainImage( out vec4 fragColor, in vec2 fragCoord )
            {
                vec2 uv = (2.0 * fragCoord.xy - iResolution.xy)/iResolution.y;
                float battery = 1.0;
                
                {
                    float fog = smoothstep(0.1, -0.02, abs(uv.y + 0.2));
                    vec3 col = vec3(0.0, 0.1, 0.2);
                    if (uv.y < -0.2)
                    {
                        uv.y = 3.0 / (abs(uv.y + 0.2) + 0.05);
                        uv.x *= uv.y * 1.0;
                        float gridVal = grid(uv, battery);
                        col = mix(col, vec3(1.0, 0.5, 1.0), gridVal);
                    }
                    else
                    {
                        float fujiD = min(uv.y * 4.5 - 0.5, 1.0);
                        uv.y -= battery * 1.1 - 0.51;
                        
                        vec2 sunUV = uv;
                        vec2 fujiUV = uv;
                        
                        sunUV += vec2(0.75, 0.2);
                        col = vec3(1.0, 0.2, 1.0);
                        float sunVal = sun(sunUV, battery);
                        
                        col = mix(col, vec3(1.0, 0.4, 0.1), sunUV.y * 2.0 + 0.2);
                        col = mix(vec3(0.0, 0.0, 0.0), col, sunVal);
                        
                        float fujiVal = sdTrapezoid( uv  + vec2(-0.75+sunUV.y * 0.0, 0.5), 1.75 + pow(uv.y * uv.y, 2.1), 0.2, 0.5);
                        float waveVal = uv.y + sin(uv.x * 20.0 + iTime * 2.0) * 0.05 + 0.2;
                        float wave_width = smoothstep(0.0,0.01,(waveVal));
                        
                        col = mix( col, mix(vec3(0.0, 0.0, 0.25), vec3(1.0, 0.0, 0.5), fujiD), step(fujiVal, 0.0));
                        col = mix( col, vec3(1.0, 0.5, 1.0), wave_width * step(fujiVal, 0.0));
                        col = mix( col, vec3(1.0, 0.5, 1.0), 1.0-smoothstep(0.0,0.01,abs(fujiVal)) );
                        
                        col += mix( col, mix(vec3(1.0, 0.12, 0.8), vec3(0.0, 0.0, 0.2), clamp(uv.y * 3.5 + 3.0, 0.0, 1.0)), step(0.0, fujiVal) );
                        
                        vec2 cloudUV = uv;
                        cloudUV.x = mod(cloudUV.x + iTime * 0.1, 4.0) - 2.0;
                        float cloudTime = iTime * 0.5;
                        float cloudY = -0.5;
                        float cloudVal1 = sdCloud(cloudUV, 
                                                 vec2(0.1 + sin(cloudTime + 140.5)*0.1,cloudY), 
                                                 vec2(1.05 + cos(cloudTime * 0.9 - 36.56) * 0.1, cloudY), 
                                                 vec2(0.2 + cos(cloudTime * 0.867 + 387.165) * 0.1,0.25+cloudY), 
                                                 vec2(0.5 + cos(cloudTime * 0.9675 - 15.162) * 0.09, 0.25+cloudY), 0.075);
                        cloudY = -0.6;
                        float cloudVal2 = sdCloud(cloudUV, 
                                                 vec2(-0.9 + cos(cloudTime * 1.02 + 541.75) * 0.1,cloudY), 
                                                 vec2(-0.5 + sin(cloudTime * 0.9 - 316.56) * 0.1, cloudY), 
                                                 vec2(-1.5 + cos(cloudTime * 0.867 + 37.165) * 0.1,0.25+cloudY), 
                                                 vec2(-0.6 + sin(cloudTime * 0.9675 + 665.162) * 0.09, 0.25+cloudY), 0.075);
                        
                        float cloudVal = min(cloudVal1, cloudVal2);
                        
                        col = mix(col, vec3(0.0, 0.0, 0.2), 1.0 - smoothstep(0.075 - 0.0001, 0.075, cloudVal));
                        col += vec3(1.0, 1.0, 1.0)*(1.0 - smoothstep(0.0,0.01,abs(cloudVal - 0.075)));
                    }

                    col += fog * fog * fog;
                    col = mix(vec3(col.r, col.r, col.r) * 0.5, col, battery * 0.7);

                    fragColor = vec4(col,1.0);
                }
            }

            void main() {
                mainImage(gl_FragColor, gl_FragCoord.xy);
            }
        `;

        const vertexShader = this.createShader(gl.VERTEX_SHADER, vsSource);
        const fragmentShader = this.createShader(gl.FRAGMENT_SHADER, fsSource);
        this.program = this.createProgram(vertexShader, fragmentShader);

        this.positionAttributeLocation = gl.getAttribLocation(this.program, "position");
        this.resolutionUniformLocation = gl.getUniformLocation(this.program, "iResolution");
        this.timeUniformLocation = gl.getUniformLocation(this.program, "iTime");

        this.positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        const positions = [
            -1, -1,
             1, -1,
            -1,  1,
            -1,  1,
             1, -1,
             1,  1,
        ];
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
    }

    createShader(type, source) {
        const gl = this.gl;
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error(gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }
        return shader;
    }

    createProgram(vs, fs) {
        const gl = this.gl;
        const program = gl.createProgram();
        gl.attachShader(program, vs);
        gl.attachShader(program, fs);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error(gl.getProgramInfoLog(program));
            return null;
        }
        return program;
    }

    resize() {
        // Render shader at 125% internal resolution for crisper visuals while keeping CSS size unchanged.
        const width = window.innerWidth;
        const height = window.innerHeight;
        const renderScale = 1.25; // 125%
        // Set internal drawing buffer to scaled resolution
        this.canvas.width = Math.round(width * renderScale);
        this.canvas.height = Math.round(height * renderScale);
        // Keep displayed CSS size matching viewport to avoid visual scaling issues
        this.canvas.style.width = `${width}px`;
        this.canvas.style.height = `${height}px`;
        // Set viewport to match internal buffer size
        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    }

    render() {
        if (!this.gl) return;
        const gl = this.gl;
        const time = (Date.now() - this.startTime) * 0.001;

        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.useProgram(this.program);
        gl.enableVertexAttribArray(this.positionAttributeLocation);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        gl.vertexAttribPointer(this.positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);

        // Pass the internal buffer resolution (already scaled in resize) so shader can render crisply at 125%
        gl.uniform2f(this.resolutionUniformLocation, this.canvas.width, this.canvas.height);
        gl.uniform1f(this.timeUniformLocation, time);

        gl.drawArrays(gl.TRIANGLES, 0, 6);

        this.animationFrameId = requestAnimationFrame(this.render.bind(this));
    }

    stop() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }
}

let menuShader = null;

function displayRandomMenuBackground() {
    if (!backgroundEnabled) return;
    const canvas = document.getElementById('menu-shader-canvas');
    if (!canvas) return;

    if (!menuShader) {
        menuShader = new MenuShaderBackground(canvas);
    }
    
    menuShader.resize();
    menuShader.stop(); // Ensure no double loops
    canvas.style.display = 'block';
    menuShader.render();
}

/* NEW: Three.js Panorama Viewer Module */
const PanoramaViewer = {
    scene: null,
    camera: null,
    renderer: null,
    sphere: null,
    container: null,
    xrButton: null,
    uiPlane: null,
    uiGroup: null,
    uiCanvas: null,
    uiContext: null,
    handMaterial: null,
    controller1: null,
    controller2: null,
    controllerGrip1: null,
    controllerGrip2: null,
    raycaster: new THREE.Raycaster(),
    reticle1: null,
    reticle2: null,
    vrInputBuffer: "",
    isVRKeyboardOpen: false,
    tempMatrix: new THREE.Matrix4(),
    isUserInteracting: false,
    onPointerDownMouseX: 0,
    onPointerDownMouseY: 0,
    lon: 0,
    onPointerDownLon: 0,
    lat: 0,
    onPointerDownLat: 0,
    horizontalLockMargin: 9.0,
    phi: 0,
    theta: 0,
    textureLoader: new THREE.TextureLoader(),

    init(containerElement) {
        if (this.renderer) return;
        this.container = containerElement;

        this.scene = new THREE.Scene();
        // Lower near plane to 0.1 to prevent UI clipping when head-mounted
        this.camera = new THREE.PerspectiveCamera(panoramicFov, containerElement.clientWidth / containerElement.clientHeight, 0.1, 1100);
        this.scene.add(this.camera);
        
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(containerElement.clientWidth, containerElement.clientHeight);
        this.renderer.xr.enabled = true;
        containerElement.appendChild(this.renderer.domElement);

        const geometry = new THREE.SphereGeometry(500, 80, 80);
        geometry.scale(-1, 1, 1); 

        // Use ShaderMaterial to handle seam and pole blurring
        const material = new THREE.ShaderMaterial({
            uniforms: {
                map: { value: null }
            },
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform sampler2D map;
                varying vec2 vUv;

                vec4 blurredSample(sampler2D tex, vec2 uv, float radius) {
                    vec4 color = vec4(0.0);
                    color += texture2D(tex, uv + vec2(-radius, -radius));
                    color += texture2D(tex, uv + vec2(radius, -radius));
                    color += texture2D(tex, uv + vec2(-radius, radius));
                    color += texture2D(tex, uv + vec2(radius, radius));
                    color += texture2D(tex, uv) * 2.0;
                    return color / 6.0;
                }

                void main() {
                    vec2 uv = vUv;

                    // Only soften top/bottom poles; no seam blur on left/right edges.
                    float poleDist = min(uv.y, 1.0 - uv.y);
                    float poleFactor = smoothstep(0.12, 0.0, poleDist);

                    vec4 baseColor = texture2D(map, uv);

                    if (poleFactor > 0.01) {
                        float blurRadius = poleFactor * 0.04;
                        vec4 blurColor = blurredSample(map, uv, blurRadius);
                        vec3 finalRGB = mix(baseColor.rgb, blurColor.rgb, poleFactor);
                        float vignette = mix(1.0, 0.5, poleFactor);
                        gl_FragColor = vec4(finalRGB * vignette, 1.0);
                    } else {
                        gl_FragColor = baseColor;
                    }
                }
            `
        });

        this.sphere = new THREE.Mesh(geometry, material);
        this.scene.add(this.sphere);

        // Create a group for the UI to allow smoothing/lazy-follow
        this.uiGroup = new THREE.Group();
        this.scene.add(this.uiGroup);

        // Setup VR UI Plane - Mimic PC 16:9 Layout
        this.uiCanvas = document.createElement('canvas');
        this.uiCanvas.width = 1280;
        this.uiCanvas.height = 720;
        this.uiContext = this.uiCanvas.getContext('2d');
        
        const uiTexture = new THREE.CanvasTexture(this.uiCanvas);
        uiTexture.minFilter = THREE.LinearFilter;
        uiTexture.magFilter = THREE.LinearFilter;
        
        const uiMaterial = new THREE.MeshBasicMaterial({ 
            map: uiTexture, 
            transparent: true, 
            side: THREE.DoubleSide,
            depthTest: false // Ensure UI is always on top of scene
        });
        
        // Use 16:9 aspect geometry
        const uiGeometry = new THREE.PlaneGeometry(1.6, 0.9);
        this.uiPlane = new THREE.Mesh(uiGeometry, uiMaterial);
        this.uiPlane.renderOrder = 50; // Lower than reticles/lines to ensure they stay visible on top
        
        // Initial setup for UI Group
        this.uiPlane.position.set(0, 0, 0); 
        this.uiGroup.add(this.uiPlane);
        this.uiGroup.visible = false;

        // Controllers
        this.controller1 = this.renderer.xr.getController(0);
        this.controller1.addEventListener('selectstart', this.onSelectStart.bind(this));
        this.scene.add(this.controller1);

        this.controller2 = this.renderer.xr.getController(1);
        this.controller2.addEventListener('selectstart', this.onSelectStart.bind(this));
        this.scene.add(this.controller2);
        
        // Add Controller Grips for actual hand positioning
        this.controllerGrip1 = this.renderer.xr.getControllerGrip(0);
        this.scene.add(this.controllerGrip1);
        this.controllerGrip2 = this.renderer.xr.getControllerGrip(1);
        this.scene.add(this.controllerGrip2);

        // Visual hand proxies
        const handGeo = new THREE.BoxGeometry(0.05, 0.05, 0.1);
        this.handMaterial = new THREE.MeshBasicMaterial({ color: 0x444444 });
        this.controllerGrip1.add(new THREE.Mesh(handGeo, this.handMaterial));
        this.controllerGrip2.add(new THREE.Mesh(handGeo, this.handMaterial));

        // Controller lines for pointing
        const geometryLine = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)]);
        const lineMaterial = new THREE.LineBasicMaterial({ 
            color: 0x00f3ff, 
            depthTest: false,
            transparent: true,
            opacity: 0.5
        });
        const line = new THREE.Line(geometryLine, lineMaterial);
        line.name = 'line';
        line.scale.z = 5;
        line.renderOrder = 100;
        this.controller1.add(line.clone());
        this.controller2.add(line.clone());

        // Visual reticles for hovering
        const reticleGeo = new THREE.RingGeometry(0.015, 0.02, 32);
        const reticleMat = new THREE.MeshBasicMaterial({ 
            color: 0x00f3ff, 
            transparent: true, 
            opacity: 0.8, 
            side: THREE.DoubleSide, 
            depthTest: false 
        });
        this.reticle1 = new THREE.Mesh(reticleGeo, reticleMat);
        this.reticle2 = new THREE.Mesh(reticleGeo, reticleMat.clone());
        this.reticle1.renderOrder = 101;
        this.reticle2.renderOrder = 101;
        this.scene.add(this.reticle1);
        this.scene.add(this.reticle2);

        this.lon = 180; // Start looking away from the seam

        containerElement.addEventListener('pointerdown', this.onPointerDown.bind(this));
        containerElement.addEventListener('wheel', this.onDocumentMouseWheel.bind(this));
        window.addEventListener('resize', this.onWindowResize.bind(this));

        this.animate();
    },

    updateHandColor(hexColor) {
        if (this.handMaterial && hexColor) {
            this.handMaterial.color.set(hexColor);
        }
    },

    loadTexture(url) {
        this.container.classList.remove('hidden');
        currentSceneImage.classList.add('hidden');
        this.onWindowResize(); 

        // Apply world-specific VR hand color if it exists
        if (currentWorld && currentWorld.vrHandColor) {
            this.updateHandColor(currentWorld.vrHandColor);
        } else {
            this.updateHandColor('#444444'); // Fallback
        }

        this.textureLoader.load(url, (texture) => {
            if (imageInterpolation === 'nearest') {
                texture.minFilter = THREE.NearestFilter;
                texture.magFilter = THREE.NearestFilter;
            } else {
                texture.minFilter = THREE.LinearFilter;
                texture.magFilter = THREE.LinearFilter;
            }
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.ClampToEdgeWrapping;
            
            this.sphere.material.uniforms.map.value = texture;
            this.sphere.material.needsUpdate = true;
            this.lon = 180; // Reset to center of texture (away from seam)
            this.lat = 0;
        }, undefined, (err) => {
            // Remote texture failed (rate limit / CORS / offline). Fall back to
            // the built-in procedural renderer so the panorama never stays black.
            console.warn('[panorama] texture failed to load, using procedural fallback:', err && (err.message || err));
            try {
                let fallbackPrompt = 'cinematic game scene, atmospheric';
                if (typeof url === 'string' && url.indexOf('image.pollinations.ai/prompt/') !== -1) {
                    const m = url.match(/\/prompt\/([^?]+)/);
                    if (m) fallbackPrompt = decodeURIComponent(m[1]);
                }
                const fb = window.__wsShimInternals && window.__wsShimInternals.proceduralImage
                    ? window.__wsShimInternals.proceduralImage(fallbackPrompt, { w: 1536, h: 768, explicit: true })
                    : null;
                if (fb && fb !== url) {
                    this.loadTexture(fb);
                } else if (!fb) {
                    this.hide();
                    currentSceneImage.src = url;
                    currentSceneImage.classList.remove('hidden');
                }
            } catch (e) {
                console.warn('[panorama] procedural fallback failed:', e);
            }
        });
    },

    onWindowResize() {
        if (!this.renderer) return;
        this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    },

    onPointerDown(event) {
        if (event.isPrimary === false) return;
        this.isUserInteracting = true;
        this.onPointerDownMouseX = event.clientX;
        this.onPointerDownMouseY = event.clientY;
        this.onPointerDownLon = this.lon;
        this.onPointerDownLat = this.lat;

        const onPointerMove = (e) => {
            if (e.isPrimary === false) return;
            
            const deltaX = e.clientX - this.onPointerDownMouseX;
            const deltaY = e.clientY - this.onPointerDownMouseY;
            
            this.lon -= deltaX * 0.1;
            this.lat += deltaY * 0.1;
            
            // Apply clamp immediately to the property to prevent accumulation past poles
            // Stronger clamp range to better hide top/bottom distortion in 360 images
            this.lat = Math.max(-30, Math.min(30, this.lat));
            
            this.onPointerDownMouseX = e.clientX;
            this.onPointerDownMouseY = e.clientY;
        };

        const onPointerUp = () => {
            this.isUserInteracting = false;
            document.removeEventListener('pointermove', onPointerMove);
            document.removeEventListener('pointerup', onPointerUp);
        };

        document.addEventListener('pointermove', onPointerMove);
        document.addEventListener('pointerup', onPointerUp);
    },

    onDocumentMouseWheel(event) {
        // Disable scroll-wheel FOV zoom in 360 mode; FOV is now controlled only by the settings slider.
        event.preventDefault();
    },

    animate() {
        this.renderer.setAnimationLoop(this.update.bind(this));
    },

    updateVRUI() {
        if (!this.uiContext) return;
        const ctx = this.uiContext;
        const W = 1280, H = 720;
        ctx.clearRect(0, 0, W, H);

        // 1. Narrative Log (Centered Window)
        const logEl = document.getElementById('text-output');
        const isLogVisible = logEl && logEl.classList.contains('visible');
        if (isLogVisible) {
            ctx.save();
            ctx.fillStyle = 'rgba(5, 5, 12, 0.95)';
            const logW = 900, logH = 400;
            const logX = (W - logW) / 2, logY = 120;
            this.drawRoundedRect(ctx, logX, logY, logW, logH, 24);
            ctx.fill();
            ctx.strokeStyle = 'rgba(0, 243, 255, 0.4)';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.textAlign = 'left';
            // Draw messages with word wrap, starting from bottom to show newest content first
            ctx.font = '22px Courier New';
            const messages = Array.from(document.querySelectorAll('#text-output p')).slice(-20).reverse();
            let currentY = logY + logH - 45;
            const lineHeight = 28;
            const maxWidth = logW - 80;

            messages.forEach(p => {
                if (currentY < logY + 40) return;
                ctx.fillStyle = p.classList.contains('user-action-text') ? '#9cdcfe' : '#f0f0f0';
                const text = (p.classList.contains('user-action-text') ? "> " : "") + p.textContent;
                
                const words = text.split(' ');
                let lines = [];
                let currentLine = '';
                
                for (let n = 0; n < words.length; n++) {
                    let testLine = currentLine + words[n] + ' ';
                    if (ctx.measureText(testLine).width > maxWidth && n > 0) {
                        lines.push(currentLine);
                        currentLine = words[n] + ' ';
                    } else {
                        currentLine = testLine;
                    }
                }
                lines.push(currentLine);
                
                // Draw lines bottom to top
                for (let i = lines.length - 1; i >= 0; i--) {
                    if (currentY >= logY + 40) {
                        ctx.fillText(lines[i], logX + 40, currentY);
                        currentY -= lineHeight;
                    }
                }
                currentY -= 12; // Paragraph spacing
            });
            ctx.restore();
        }

        // 2. Inventory (Centered Window Overlay)
        const invEl = document.querySelector('.inventory-section');
        const isInvVisible = invEl && invEl.classList.contains('visible');
        if (isInvVisible) {
            ctx.save();
            ctx.fillStyle = 'rgba(10, 5, 15, 0.95)';
            const invW = 800, invH = 400;
            const invX = (W - invW) / 2, invY = 120;
            this.drawRoundedRect(ctx, invX, invY, invW, invH, 24);
            ctx.fill();
            ctx.strokeStyle = 'rgba(255, 0, 255, 0.4)';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.fillStyle = '#ff00ff';
            ctx.font = 'bold 24px Courier New';
            ctx.textAlign = 'center';
            ctx.fillText('INVENTORY', W/2, invY + 50);
            ctx.font = '18px Courier New';
            ctx.fillStyle = '#fff';
            const items = Object.entries(inventory);
            if (items.length === 0) {
                ctx.fillText('[EMPTY]', W/2, invY + 150);
            } else {
                items.slice(0, 10).forEach(([name, qty], i) => {
                    ctx.fillText(`${name} x${qty}`, W/2, invY + 100 + (i * 30));
                });
            }
            ctx.restore();
        }

        // 3. Stats HUD (Bottom Right - Positioned higher to avoid clipping with input bar)
        const hudW = 280;
        const hudX = W - hudW - 40;
        ctx.save();

        let statsToRender = [];
        if (currentWorld) {
            if (!currentWorld.isAdvanced) {
                statsToRender = [
                    { name: 'HEALTH', val: playerStats.health, color: '#4CAF50' },
                    { name: 'HUNGER', val: playerStats.hunger, color: '#FF9800', hidden: currentWorld.disableHunger },
                    { name: 'THIRST', val: playerStats.thirst, color: '#03A9F4', hidden: currentWorld.disableThirst }
                ].filter(s => !s.hidden);
            } else {
                const isLegacy = !currentWorld.version;
                let definedStats = currentWorld.rawAdvancedDetails?.filter(d => d.type === 'stats') || [];
                
                if (isLegacy) {
                    const hasHealth = definedStats.some(s => s.name.toLowerCase() === 'health');
                    const hasHunger = definedStats.some(s => s.name.toLowerCase() === 'hunger');
                    const hasThirst = definedStats.some(s => s.name.toLowerCase() === 'thirst');
                    if (!hasHealth) definedStats = [{ name: 'Health', color: '#4CAF50', startValue: 100 }, ...definedStats];
                    if (!hasHunger) definedStats.push({ name: 'Hunger', color: '#FF9800', startValue: 100 });
                    if (!hasThirst) definedStats.push({ name: 'Thirst', color: '#03A9F4', startValue: 100 });
                }

                statsToRender = definedStats.map(statDef => {
                    const internalKey = statDef.name.toLowerCase();
                    let val = 0;
                    if (['health', 'hunger', 'thirst'].includes(internalKey)) {
                        val = playerStats[internalKey];
                    } else {
                        val = playerStats.custom ? playerStats.custom[statDef.name] : 0;
                    }
                    return { name: statDef.name.toUpperCase(), val, color: statDef.color || '#00f3ff' };
                });
            }
        }

        // Dynamically position stats from bottom up, anchored above the input bar
        let statY = H - 120 - (statsToRender.length * 60); 
        
        statsToRender.forEach(s => {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            this.drawRoundedRect(ctx, hudX, statY, hudW, 50, 6);
            ctx.fill();
            ctx.font = 'bold 16px Courier New';
            ctx.fillStyle = s.color;
            ctx.textAlign = 'left';
            ctx.fillText(s.name, hudX + 15, statY + 20);
            ctx.textAlign = 'right';
            ctx.fillText(`${Math.round(s.val)}%`, hudX + hudW - 15, statY + 20);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.fillRect(hudX + 15, statY + 30, hudW - 30, 8);
            ctx.fillStyle = s.color;
            ctx.fillRect(hudX + 15, statY + 30, (hudW - 30) * (Math.min(100, Math.max(0, s.val)) / 100), 8);
            statY += 60;
        });
        ctx.restore();

        // 4. Input Bar & Virtual Keyboard
        const inputW = 1200, inputH = 80;
        const inputX = (W - inputW) / 2, inputY = H - 100;
        ctx.save();
        ctx.fillStyle = 'rgba(10, 10, 15, 0.9)';
        this.drawRoundedRect(ctx, inputX, inputY, inputW, inputH, 12);
        ctx.fill();
        ctx.strokeStyle = this.isVRKeyboardOpen ? '#00f3ff' : 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 24px Courier New';
        ctx.textAlign = 'left';
        const displayTxt = this.vrInputBuffer + (Math.floor(Date.now() / 500) % 2 ? "_" : "");
        ctx.fillText(this.isVRKeyboardOpen ? "> " + displayTxt : "CLICK TO TYPE", inputX + 30, inputY + 48);
        ctx.restore();

        if (this.isVRKeyboardOpen) {
            this.drawVRKeyboard(ctx);
        }

        // 5. Utility Buttons (Top Bar)
        ctx.save();
        // LOG Toggle
        ctx.fillStyle = isLogVisible ? '#00f3ff' : 'rgba(0, 243, 255, 0.2)';
        this.drawRoundedRect(ctx, 40, 40, 200, 60, 8);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = isLogVisible ? '#000' : '#00f3ff';
        ctx.font = 'bold 20px Courier New';
        ctx.textAlign = 'center';
        ctx.fillText('📜 LOG', 140, 78);

        // INV Toggle
        ctx.fillStyle = isInvVisible ? '#ff00ff' : 'rgba(255, 0, 255, 0.2)';
        this.drawRoundedRect(ctx, W - 240, 40, 200, 60, 8);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = isInvVisible ? '#000' : '#ff00ff';
        ctx.fillText('🎒 INV', W - 140, 78);
        ctx.restore();

        this.uiPlane.material.map.needsUpdate = true;
    },

    drawVRKeyboard(ctx) {
        const keys = [
            ["Q","W","E","R","T","Y","U","I","O","P", "DEL"],
            ["A","S","D","F","G","H","J","K","L"],
            ["Z","X","C","V","B","N","M"],
            ["CANCEL", "SPC", "CONFIRM"]
        ];
        const W = 1280, H = 720;
        let startY = 250;
        ctx.font = 'bold 22px Courier New';
        keys.forEach((row, r) => {
            let keyW = (W - 100) / row.length;
            row.forEach((key, c) => {
                let x = 50 + c * keyW;
                let y = startY + r * 85;
                ctx.fillStyle = 'rgba(30, 30, 40, 0.95)';
                this.drawRoundedRect(ctx, x + 5, y + 5, keyW - 10, 75, 5);
                ctx.fill();
                ctx.strokeStyle = '#00f3ff';
                ctx.stroke();
                ctx.fillStyle = '#fff';
                ctx.textAlign = 'center';
                ctx.fillText(key, x + keyW/2, y + 48);
            });
        });
    },

    // Helper for rounded rectangles on canvas
    drawRoundedRect(ctx, x, y, width, height, radius) {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
    },

    onSelectStart(event) {
        const controller = event.target;
        this.tempMatrix.identity().extractRotation(controller.matrixWorld);
        this.raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
        this.raycaster.ray.direction.set(0, 0, -1).applyMatrix4(this.tempMatrix);

        const intersects = this.raycaster.intersectObject(this.uiPlane);
        if (intersects.length > 0) {
            this.handleVRClick(intersects[0].uv);
        }
    },

    handleVRClick(uv) {
        // VR UV space: x(0=left, 1=right), y(0=bottom, 1=top)
        
        // 1. Toggle Log (Top Left)
        if (uv.y > 0.85 && uv.x < 0.25) {
            playSound(audioCache.get('ui_click.mp3'), 0.3);
            const logEl = document.getElementById('text-output');
            if (logEl) {
                const isVisible = logEl.classList.toggle('visible');
                const btn = document.getElementById('toggle-log-btn');
                if (btn) btn.classList.toggle('active', isVisible);
            }
            return;
        }

        // 2. Toggle Inventory (Top Right)
        if (uv.y > 0.85 && uv.x > 0.75) {
            playSound(audioCache.get('ui_click.mp3'), 0.3);
            const invSection = document.querySelector('.inventory-section');
            if (invSection) {
                const isVisible = invSection.classList.toggle('visible');
                const btn = document.getElementById('toggle-inv-btn');
                if (btn) btn.classList.toggle('active', isVisible);
            }
            return;
        }

        // 3. Input Area / Keyboard
        if (uv.y < 0.15 || this.isVRKeyboardOpen) {
            if (uv.y < 0.15 && !this.isVRKeyboardOpen) {
                playSound(audioCache.get('ui_confirm.mp3'), 0.4);
                this.isVRKeyboardOpen = true;
            } else if (this.isVRKeyboardOpen) {
                this.handleVRKeyboardSelection(uv);
            }
        }
        
        this.updateVRUI();
    },

    handleVRKeyboardSelection(uv) {
        // Keyboard area is roughly y[0.15 to 0.6]
        if (uv.y < 0.2 || uv.y > 0.65) return;

        const keys = [
            ["Q","W","E","R","T","Y","U","I","O","P", "DEL"],
            ["A","S","D","F","G","H","J","K","L"],
            ["Z","X","C","V","B","N","M"],
            ["CANCEL", "SPC", "CONFIRM"]
        ];

        const rowIdx = Math.floor((0.65 - uv.y) / 0.12);
        const row = keys[rowIdx];
        if (!row) return;

        const colIdx = Math.floor(uv.x * row.length);
        const key = row[colIdx];
        if (!key) return;

        playSound(audioCache.get('ui_click.mp3'), 0.15);

        if (key === "CONFIRM") {
            const action = this.vrInputBuffer.trim();
            if (action) {
                const aiContextAction = `Current Stats: ${JSON.stringify(playerStats)}\nInventory: ${JSON.stringify(inventory)}\nUser Action: ${action}`;
                handlePlayerAction(action, aiContextAction);
                this.vrInputBuffer = "";
                this.isVRKeyboardOpen = false;
                playSound(audioCache.get('ui_confirm.mp3'), 0.4);
            }
        } else if (key === "CANCEL") {
            this.vrInputBuffer = "";
            this.isVRKeyboardOpen = false;
            playSound(audioCache.get('ui_lose.mp3'), 0.3);
        } else if (key === "DEL") {
            this.vrInputBuffer = this.vrInputBuffer.slice(0, -1);
        } else if (key === "SPC") {
            this.vrInputBuffer += " ";
        } else {
            this.vrInputBuffer += key;
        }
    },

    update() {
        if (!this.renderer) return;

        // Clamp vertical look range more aggressively to keep the poles out of view
        this.lat = Math.max(-30, Math.min(30, this.lat));

        // Dynamically calculate horizontal FOV to allow maximum rotation without revealing the texture seam.
        // We account for vertical tilt (pitch) because horizontal coverage expands as you look towards the poles.
        const hFov = 2 * Math.atan(Math.tan(this.camera.fov * Math.PI / 360) * this.camera.aspect) * 180 / Math.PI;
        const pitchFactor = 1 / Math.cos(THREE.MathUtils.degToRad(this.lat));
        // Adjusted safety margin to dynamic value to maximize rotation freedom while attempting to keep the seam hidden.
        const fovBuffer = (hFov * pitchFactor / 2) + this.horizontalLockMargin; 
        this.lon = Math.max(fovBuffer, Math.min(360 - fovBuffer, this.lon));

        this.phi = THREE.MathUtils.degToRad(90 - this.lat);
        this.theta = THREE.MathUtils.degToRad(this.lon);

        const x = 500 * Math.sin(this.phi) * Math.cos(this.theta);
        const y = 500 * Math.cos(this.phi);
        const z = 500 * Math.sin(this.phi) * Math.sin(this.theta);

        this.camera.lookAt(x, y, z);

        if (this.renderer.xr.isPresenting) {
            this.uiGroup.visible = true;
            this.updateVRUI();

            // Position smoothing logic (Lazy Follow)
            const targetPos = new THREE.Vector3();
            const targetQuat = new THREE.Quaternion();
            
            this.camera.getWorldPosition(targetPos);
            this.camera.getWorldQuaternion(targetQuat);

            const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(targetQuat);
            forward.y = 0;
            forward.normalize();
            
            targetPos.add(forward.multiplyScalar(1.2));
            targetPos.y -= 0.35;

            this.uiGroup.position.lerp(targetPos, 0.08); 
            
            const lookPos = new THREE.Vector3();
            this.camera.getWorldPosition(lookPos);
            this.uiGroup.lookAt(lookPos);

            // Update Laser Lines and Reticles
            this.updateControllerInteraction(this.controller1, this.reticle1);
            this.updateControllerInteraction(this.controller2, this.reticle2);
        } else {
            this.uiGroup.visible = false;
            if (this.reticle1) this.reticle1.visible = false;
            if (this.reticle2) this.reticle2.visible = false;
        }

        this.renderer.render(this.scene, this.camera);
    },

    updateControllerInteraction(controller, reticle) {
        if (!controller || !reticle) return;
        
        const line = controller.getObjectByName('line');
        if (!line) return;

        this.tempMatrix.identity().extractRotation(controller.matrixWorld);
        this.raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
        this.raycaster.ray.direction.set(0, 0, -1).applyMatrix4(this.tempMatrix);

        const intersects = this.raycaster.intersectObject(this.uiPlane);
        if (intersects.length > 0) {
            const intersection = intersects[0];
            line.scale.z = intersection.distance;
            reticle.visible = true;
            reticle.position.copy(intersection.point);
            // Orient reticle to face the same way as the UI plane
            reticle.quaternion.copy(this.uiPlane.getWorldQuaternion(new THREE.Quaternion()));
            // Offset slightly to prevent z-fighting
            const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(reticle.quaternion);
            reticle.position.add(normal.multiplyScalar(0.005));
        } else {
            line.scale.z = 5;
            reticle.visible = false;
        }
    },

    hide() {
        if (this.container) this.container.classList.add('hidden');
        currentSceneImage.classList.remove('hidden');
    }
};

function calculateImageDrawRect(img, canvasWidth, canvasHeight, objectFit) {
    const imgAspectRatio = img.naturalWidth / img.naturalHeight;
    const canvasAspectRatio = canvasWidth / canvasHeight;

    let sx = 0, sy = 0, sWidth = img.naturalWidth, sHeight = img.naturalHeight; // Source
    let dx = 0, dy = 0, dWidth = canvasWidth, dHeight = canvasHeight;           // Destination

    if (objectFit === 'cover') {
        if (imgAspectRatio > canvasAspectRatio) { // Image is wider than canvas
            sHeight = img.naturalHeight;
            sWidth = sHeight * canvasAspectRatio;
            sx = (img.naturalWidth - sWidth) / 2;
            sy = 0;
        } else { // Image is taller than canvas
            sWidth = img.naturalWidth;
            sHeight = sWidth / canvasAspectRatio;
            sx = 0;
            sy = (img.naturalHeight - sHeight) / 2;
        }
    } else if (objectFit === 'contain') {
        if (imgAspectRatio > canvasAspectRatio) { // Image is wider than canvas
            dHeight = canvasWidth / imgAspectRatio;
            dy = (canvasHeight - dHeight) / 2;
            dWidth = canvasWidth;
            dx = 0;
        } else { // Image is taller than canvas
            dWidth = canvasHeight * imgAspectRatio;
            dx = (canvasWidth - dWidth) / 2;
            dHeight = canvasHeight;
            dy = 0;
        }
    }
    // For 'fill' (default behavior if no specific objectFit)
    // sx,sy,sWidth,sHeight would be img's full dimensions.
    // dx,dy,dWidth,dHeight would be canvas full dimensions.

    return { sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight };
}

async function displayNewImageWithSwipe(newImageUrl) {
    const swipeCanvas = document.getElementById('swipe-canvas');
    const oldImageElement = currentSceneImage; // The <img> tag that currently shows the scene

    if (!newImageUrl) {
        oldImageElement.src = ''; // Clear image if null
        swipeCanvas.style.display = 'none'; // Hide canvas if no image
        return;
    }

    const ctx = swipeCanvas.getContext('2d');

    // Apply interpolation to canvas
    if (imageInterpolation === 'nearest') {
        ctx.imageSmoothingEnabled = false;
    } else {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = imageInterpolation === 'bicubic' ? 'high' : 'medium';
    }

    // Set canvas dimensions to match the image display area
    // This is important as image-display size can change (e.g., on fullscreen toggle)
    swipeCanvas.width = imageDisplayDiv.clientWidth;
    swipeCanvas.height = imageDisplayDiv.clientHeight;

    // Load the new image
    const newImg = new Image();
    newImg.crossOrigin = "anonymous";
    newImg.src = newImageUrl;

    const newImageLoadPromise = new Promise(resolve => {
        newImg.onload = resolve;
        newImg.onerror = () => {
            console.error("Failed to load new image for swipe effect:", newImageUrl);
            resolve(); // Still resolve to not block, but newImg might be incomplete
        };
    });

    // Load the old image (if any)
    const oldImg = new Image();
    oldImg.crossOrigin = "anonymous";
    const currentSrc = oldImageElement.src;
    let oldImageLoadedSuccessfully = false;

    const oldImageLoadPromise = new Promise(resolve => {
        if (currentSrc && currentSrc !== window.location.href + '/') { // Check if there's an actual old image source
            oldImg.src = currentSrc;
            oldImg.onload = () => { oldImageLoadedSuccessfully = true; resolve(); };
            oldImg.onerror = () => { console.warn("Old image failed to load for swipe effect, proceeding without it."); resolve(); };
        } else {
            resolve(); // No old image to load
        }
    });

    // Wait for both images to load (or fail to load)
    await Promise.all([newImageLoadPromise, oldImageLoadPromise]);

    if (!newImg.complete || newImg.naturalWidth === 0) {
        // If the new image failed to load, just keep the old one or clear it if no old one
        oldImageElement.src = ''; // Clear if new image is invalid
        if (oldImageLoadedSuccessfully) {
            oldImageElement.src = currentSrc; // Revert to old if valid
        }
        swipeCanvas.style.display = 'none';
        return;
    }

    // NEW: The old image element remains visible. The canvas will draw on top.
    // oldImageElement.style.opacity = '0'; // REMOVED: This caused the instant disappearance
    swipeCanvas.style.display = 'block';

    let animationStartTime = null;
    const duration = 500; // milliseconds for the swipe animation

    function animateSwipe(currentTime) {
        if (!animationStartTime) animationStartTime = currentTime;
        const progress = Math.min((currentTime - animationStartTime) / duration, 1);

        ctx.clearRect(0, 0, swipeCanvas.width, swipeCanvas.height);

        // Determine current object-fit mode based on fullscreen state
        // Changed to always use 'cover' to fill the space
        const currentObjectFit = 'cover';

        // Draw the old image first (if successfully loaded)
        if (oldImageLoadedSuccessfully && oldImg.complete && oldImg.naturalWidth > 0) {
            const { sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight } = calculateImageDrawRect(oldImg, swipeCanvas.width, swipeCanvas.height, currentObjectFit);
            ctx.drawImage(oldImg, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight);
        }

        // Calculate the swipe position (from top to bottom)
        const swipeY = swipeCanvas.height * progress;

        // Draw the new image over the old one, clipped by the swipe
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, swipeCanvas.width, swipeY); // Clip from top down
        ctx.clip();

        const { sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight } = calculateImageDrawRect(newImg, swipeCanvas.width, swipeCanvas.height, currentObjectFit);
        ctx.drawImage(newImg, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight);

        ctx.restore();

        // Draw the scan line (visual effect)
        const gradientHeight = 12; // Height of the gradient band for the scan line effect
        const gradient = ctx.createLinearGradient(0, swipeY - gradientHeight / 2, 0, swipeY + gradientHeight / 2);

        // Define stops for the gradient to create a subtle chromatic aberration-like, smooth edge
        gradient.addColorStop(0, 'rgba(0, 0, 0, 0)'); // Transparent at the top
        gradient.addColorStop(0.4, 'rgba(255, 0, 0, 0.12)'); // Subtle red leading edge
        gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.08)'); // Very subtle slight glow at the center
        gradient.addColorStop(0.6, 'rgba(0, 255, 255, 0.12)'); // Subtle cyan trailing edge
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)'); // Transparency at the bottom

        ctx.fillStyle = gradient;
        ctx.fillRect(0, swipeY - gradientHeight / 2, swipeCanvas.width, gradientHeight);

        if (progress < 1) {
            requestAnimationFrame(animateSwipe);
        } else {
            // Animation finished: update the actual <img> and hide the canvas
            oldImageElement.src = newImageUrl;
            oldImageElement.style.opacity = '1'; // Ensure the image is fully visible after transition
            swipeCanvas.style.display = 'none';
        }
    }

    requestAnimationFrame(animateSwipe);
}



settingsButton.addEventListener('click', () => {
    playSound(audioCache.get('ui_click.mp3'), 0.4);
    settingsMenu.classList.toggle('hidden');
    mainMenuSummarizeSelect.value = currentSummarizeLevel;
    if (imageInterpolationSelect) imageInterpolationSelect.value = imageInterpolation;
    uiSoundsSlider.value = uiSoundsVolume;
    uiSoundsValue.textContent = `${Math.round(uiSoundsVolume * 100)}%`;
    musicSlider.value = musicVolume;
    musicValue.textContent = `${Math.round(musicVolume * 100)}%`;
    imageCensoringSelect.value = imageCensoringMode;
});

mainMenuCloseOptionsButton.addEventListener('click', () => {
    playSound(audioCache.get('ui_click.mp3'), 0.4);
    settingsMenu.classList.add('hidden');
});

resetSettingsButton.addEventListener('click', () => {
    playSound(audioCache.get('ui_click.mp3'), 0.4);
    currentSummarizeLevel = DEFAULT_SUMMARIZE_LEVEL;
    uiSoundsVolume = 0.7;
    musicVolume = 0.4;
    // CHANGED: Reset imageCensoringMode to default 'hide'
    imageCensoringMode = 'hide';
    // NEW: Reset backgroundEnabled default
    backgroundEnabled = true;
    cornerRoundingEnabled = true;
    voiceActingEnabled = true;
    uiLayout = 'immersive';
    imageInterpolation = 'nearest';

    mainMenuSummarizeSelect.value = currentSummarizeLevel;
    if (imageInterpolationSelect) imageInterpolationSelect.value = imageInterpolation;
    uiSoundsSlider.value = uiSoundsVolume;
    uiSoundsValue.textContent = `${Math.round(uiSoundsVolume * 100)}%`;
    musicSlider.value = musicVolume;
    musicValue.textContent = `${Math.round(musicVolume * 100)}%`;
    // CHANGED: Set select value based on imageCensoringMode
    imageCensoringSelect.value = imageCensoringMode;
    if (uiLayoutSelect) uiLayoutSelect.value = uiLayout;
    document.body.classList.add('immersive-ui');
    document.body.classList.remove('ui-square');
    if (cornerRoundingSelect) cornerRoundingSelect.value = 'on';
    if (backgroundSelect) backgroundSelect.value = backgroundEnabled ? 'on' : 'off';
    if (ttsToggleSelect) ttsToggleSelect.value = voiceActingEnabled ? 'on' : 'off';
    if (vrModeSelect) vrModeSelect.value = vrModeEnabled ? 'on' : 'off';
    if (panoramicModeSelect) panoramicModeSelect.value = panoramicMode ? 'on' : 'off';
    if (enterVRBtn) enterVRBtn.classList.add('hidden');
    if (panoramicFovSlider) {
        panoramicFovSlider.value = 75;
        panoramicFovValue.textContent = '75°';
    }

    SaveSystem.saveGlobalSettings({
        currentSummarizeLevel: currentSummarizeLevel,
        uiSoundsVolume: uiSoundsVolume,
        musicVolume: musicVolume,
        voiceActingEnabled: voiceActingEnabled,
        imageCensoringMode: imageCensoringMode,
        backgroundEnabled: backgroundEnabled,
        cornerRoundingEnabled: cornerRoundingEnabled,
        uiLayout: uiLayout,
        imageInterpolation: 'nearest',
        panoramicMode: panoramicMode,
        panoramicFov: 75
    });
    alert("Settings reset to default!");
});

mainMenuSummarizeSelect.addEventListener('change', () => {
    playSound(audioCache.get('ui_click.mp3'), 0.4);
    currentSummarizeLevel = mainMenuSummarizeSelect.value;
    SaveSystem.saveGlobalSettings({ currentSummarizeLevel: currentSummarizeLevel });
    console.log(`Summarization level set to: ${currentSummarizeLevel}`);
});

uiSoundsSlider.addEventListener('input', () => {
    uiSoundsVolume = parseFloat(uiSoundsSlider.value);
    uiSoundsValue.textContent = `${Math.round(uiSoundsVolume * 100)}%`;
    SaveSystem.saveGlobalSettings({ uiSoundsVolume: uiSoundsVolume });
});

// New Settings Tab Logic
document.querySelectorAll('.settings-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const targetId = btn.dataset.target;
        
        // Update Buttons
        document.querySelectorAll('.settings-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        // Update Panels
        document.querySelectorAll('.settings-panel').forEach(p => p.classList.remove('active'));
        const targetPanel = document.getElementById(targetId);
        if (targetPanel) {
            targetPanel.classList.add('active');
            playSound(audioCache.get('ui_click.mp3'), 0.2);
        }
    });
});

// Play a test sound when user finishes adjusting the sound slider
uiSoundsSlider.addEventListener('change', () => {
    playSound(audioCache.get('ui_click.mp3'), 0.4);
});

musicSlider.addEventListener('input', () => {
    musicVolume = parseFloat(musicSlider.value);
    musicValue.textContent = `${Math.round(musicVolume * 100)}%`;
    SaveSystem.saveGlobalSettings({ musicVolume: musicVolume });
    
    if (backgroundMusicGainNode) {
        backgroundMusicGainNode.gain.setTargetAtTime(musicVolume, audioContext.currentTime, 0.05);
    }

    if (musicVolume > 0 && !backgroundMusicSource) {
        // Resume music if it was muted and we are in a state that should have music
        if (!gameContainer.classList.contains('hidden')) {
            playBackgroundMusic('The Complex.mp3');
        } else if (!mainMenu.classList.contains('hidden')) {
            playBackgroundMusic('menumusic.mp3');
        }
    } else if (musicVolume <= 0) {
        stopMusic();
    }
});

imageCensoringSelect.addEventListener('change', () => {
    playSound(audioCache.get('ui_click.mp3'), 0.4);
    // CHANGED: Update imageCensoringMode from select value
    imageCensoringMode = imageCensoringSelect.value;
    SaveSystem.saveGlobalSettings({ imageCensoringMode: imageCensoringMode });
    console.log(`Image Censoring Mode: ${imageCensoringMode}`);
});

// Time format and clock style listeners
if (timeFormatSelect) {
    timeFormatSelect.addEventListener('change', () => {
        playSound(audioCache.get('ui_click.mp3'), 0.4);
        SaveSystem.saveGlobalSettings({ timeFormat: timeFormatSelect.value });
        // Update any visible dates immediately
        if (!worldsMenu.classList.contains('hidden')) refreshWorldsList();
        if (!onlineWorldsMenu.classList.contains('hidden')) renderSharedWorlds();
        if (!worldConfigMenu.classList.contains('hidden') && currentWorld) refreshWorldSavesList(currentWorld.name);
        console.log(`Date Format set to: ${timeFormatSelect.value}`);
    });
}

if (timeClockSelect) {
    timeClockSelect.addEventListener('change', () => {
        playSound(audioCache.get('ui_click.mp3'), 0.4);
        SaveSystem.saveGlobalSettings({ timeClock: timeClockSelect.value });
        // Update visible times immediately
        if (!worldsMenu.classList.contains('hidden')) refreshWorldsList();
        if (!onlineWorldsMenu.classList.contains('hidden')) renderSharedWorlds();
        if (!worldConfigMenu.classList.contains('hidden') && currentWorld) refreshWorldSavesList(currentWorld.name);
        console.log(`Clock style set to: ${timeClockSelect.value}-hour`);
    });
}

 // NEW: language select control
if (languageSelect) {
    languageSelect.addEventListener('change', () => {
        playSound(audioCache.get('ui_click.mp3'), 0.4);
        currentLanguage = languageSelect.value || 'en';
        SaveSystem.saveGlobalSettings({ language: currentLanguage });
        applyTranslations();
    });
}

// NEW: Background shader toggle control
const backgroundSelect = document.getElementById('background-select');
if (panoramicModeSelect) {
    panoramicModeSelect.addEventListener('change', () => {
        playSound(audioCache.get('ui_click.mp3'), 0.4);
        panoramicMode = panoramicModeSelect.value === 'on';
        SaveSystem.saveGlobalSettings({ panoramicMode: panoramicMode });
        console.log(`Panoramic Mode: ${panoramicMode ? 'On' : 'Off'}`);
        if (!panoramicMode) {
            PanoramaViewer.hide();
        }
    });
}

if (panoramicFovSlider) {
    panoramicFovSlider.addEventListener('input', () => {
        panoramicFov = parseInt(panoramicFovSlider.value);
        panoramicFovValue.textContent = `${panoramicFov}°`;
        SaveSystem.saveGlobalSettings({ panoramicFov: panoramicFov });
        
        if (PanoramaViewer.camera) {
            PanoramaViewer.camera.fov = panoramicFov;
            PanoramaViewer.camera.updateProjectionMatrix();
        }
    });
}

if (ttsToggleSelect) {
    ttsToggleSelect.addEventListener('change', () => {
        playSound(audioCache.get('ui_click.mp3'), 0.4);
        voiceActingEnabled = ttsToggleSelect.value === 'on';
        SaveSystem.saveGlobalSettings({ voiceActingEnabled: voiceActingEnabled });
        console.log(`Voice Acting (TTS): ${voiceActingEnabled ? 'On' : 'Off'}`);
    });
}

if (backgroundSelect) {
    backgroundSelect.addEventListener('change', () => {
        playSound(audioCache.get('ui_click.mp3'), 0.4);
        backgroundEnabled = backgroundSelect.value === 'on';
        SaveSystem.saveGlobalSettings({ backgroundEnabled: backgroundEnabled });
        console.log(`Background Effects: ${backgroundEnabled ? 'On' : 'Off'}`);
        const canvas = document.getElementById('menu-shader-canvas');
        const container = document.getElementById('menu-backgrounds');
        if (!backgroundEnabled) {
            // stop and hide shader for low-end systems
            if (menuShader) menuShader.stop();
            if (canvas) canvas.style.display = 'none';
            if (container) container.style.background = '#1a1a1a';
        } else {
            // resume shader
            if (canvas) canvas.style.display = 'block';
            displayRandomMenuBackground();
        }
    });
}

if (imageInterpolationSelect) {
    imageInterpolationSelect.addEventListener('change', () => {
        playSound(audioCache.get('ui_click.mp3'), 0.4);
        imageInterpolation = imageInterpolationSelect.value;
        SaveSystem.saveGlobalSettings({ imageInterpolation: imageInterpolation });
        applyImageInterpolation();
        console.log(`Image Downscaling method set to: ${imageInterpolation}`);
    });
}

if (vrModeSelect) {
    vrModeSelect.addEventListener('change', () => {
        playSound(audioCache.get('ui_click.mp3'), 0.4);
        vrModeEnabled = vrModeSelect.value === 'on';
        SaveSystem.saveGlobalSettings({ vrModeEnabled: vrModeEnabled });
        if (enterVRBtn) enterVRBtn.classList.toggle('hidden', !vrModeEnabled || !panoramicMode);
    });
}

if (enterVRBtn) {
    enterVRBtn.addEventListener('click', async () => {
        playSound(audioCache.get('ui_confirm.mp3'), 0.4);
        if (!PanoramaViewer.renderer) {
            PanoramaViewer.init(document.getElementById('panorama-container'));
        }
        
        try {
            const sessionInit = { optionalFeatures: ['local-floor', 'bounded-floor', 'layers'] };
            const session = await navigator.xr.requestSession('immersive-vr', sessionInit);
            PanoramaViewer.renderer.xr.setSession(session);
        } catch (e) {
            console.error("Failed to start VR session:", e);
            alert("VR initialization failed. Make sure your headset is connected and your browser supports WebXR.");
        }
    });
}

if (cornerRoundingSelect) {
    cornerRoundingSelect.addEventListener('change', () => {
        playSound(audioCache.get('ui_click.mp3'), 0.4);
        cornerRoundingEnabled = cornerRoundingSelect.value === 'on';
        document.body.classList.toggle('ui-square', !cornerRoundingEnabled);
        SaveSystem.saveGlobalSettings({ cornerRoundingEnabled: cornerRoundingEnabled });
        console.log(`Corner Rounding: ${cornerRoundingEnabled ? 'On' : 'Off'}`);
    });
}

if (uiLayoutSelect) {
    uiLayoutSelect.addEventListener('change', () => {
        playSound(audioCache.get('ui_click.mp3'), 0.4);
        uiLayout = uiLayoutSelect.value;
        SaveSystem.saveGlobalSettings({ uiLayout: uiLayout });
        document.body.classList.toggle('immersive-ui', uiLayout === 'immersive');
        
        // Reset toggle states when switching
        if (textOutputDiv) textOutputDiv.classList.remove('visible');
        if (toggleLogBtn) toggleLogBtn.classList.remove('active');
        const invSection = document.querySelector('.inventory-section');
        if (invSection) invSection.classList.remove('visible');
        if (toggleInvBtn) toggleInvBtn.classList.remove('active');

        console.log(`UI Layout set to: ${uiLayout}`);
        
        // Trigger resize events to help Three.js/Canvas adjust to new layout
        window.dispatchEvent(new Event('resize'));
    });
}

if (toggleLogBtn) {
    toggleLogBtn.addEventListener('click', () => {
        playSound(audioCache.get('ui_click.mp3'), 0.3);
        const isVisible = textOutputDiv.classList.toggle('visible');
        toggleLogBtn.classList.toggle('active', isVisible);
    });
}

if (toggleInvBtn) {
    toggleInvBtn.addEventListener('click', () => {
        playSound(audioCache.get('ui_click.mp3'), 0.3);
        const invSection = document.querySelector('.inventory-section');
        if (invSection) {
            const isVisible = invSection.classList.toggle('visible');
            toggleInvBtn.classList.toggle('active', isVisible);
        }
    });
}

async function updateInventoryDisplay() {
    inventoryList.innerHTML = '';
    const items = Object.keys(inventory);
    
    if (items.length === 0) {
        const emptyMsg = document.createElement('li');
        emptyMsg.textContent = "Empty";
        emptyMsg.style.gridColumn = "1 / -1";
        emptyMsg.style.textAlign = "center";
        emptyMsg.style.opacity = "0.4";
        emptyMsg.style.padding = "20px";
        emptyMsg.style.listStyle = "none";
        inventoryList.appendChild(emptyMsg);
    } else {
        for (const itemName of items) {
            const quantity = inventory[itemName];
            const card = document.createElement('li');
            card.className = 'inventory-item-card';
            card.title = `Use ${itemName}`;

            const nameOverlay = document.createElement('div');
            nameOverlay.className = 'inventory-item-name-overlay';
            nameOverlay.textContent = itemName;

            const quantityBadge = document.createElement('div');
            quantityBadge.className = 'inventory-item-quantity';
            quantityBadge.textContent = quantity;

            // Resolve Image
            let imageSrc = itemImageMap.get(itemName);
            
            // Check World Data if not in cache
            if (!imageSrc && currentWorld && currentWorld.rawAdvancedDetails) {
                const worldItem = currentWorld.rawAdvancedDetails.find(d => d.type === 'items' && d.name === itemName);
                if (worldItem && worldItem.imageUrl) {
                    imageSrc = worldItem.imageUrl;
                    itemImageMap.set(itemName, imageSrc);
                }
            }

            // If still no image and not queued, generate one
            if (!imageSrc && !itemGenerationQueue.has(itemName)) {
                itemGenerationQueue.add(itemName);
                generateItemImage(itemName).then(url => {
                    itemImageMap.set(itemName, url);
                    itemGenerationQueue.delete(itemName);
                    updateInventoryDisplay(); // Re-render once ready
                });
            }

            if (imageSrc) {
                const img = document.createElement('img');
                img.className = 'inventory-item-image';
                img.src = imageSrc;
                img.crossOrigin = "anonymous";
                card.appendChild(img);
            } else {
                const loading = document.createElement('div');
                loading.className = 'inventory-item-loading';
                loading.textContent = "...";
                card.appendChild(loading);
            }

            card.appendChild(nameOverlay);
            card.appendChild(quantityBadge);

            card.addEventListener('click', () => {
                if (userInput.disabled) return;
                playSound(audioCache.get('ui_click.mp3'), 0.2);
                userInput.value = `Use ${itemName}`;
                userInput.focus();
            });

            inventoryList.appendChild(card);
        }
    }
}

async function generateItemImage(itemName) {
    try {
        const worldTheme = currentWorld ? currentWorld.prompt : "a mysterious adventure";
        const result = await websim.imageGen({
            prompt: `A 1:1 inventory icon of ${itemName}. Style: detailed, isolated on dark background, consistent with ${worldTheme}. Game item sprite.`,
            aspect_ratio: "1:1"
        });
        return result.url;
    } catch (err) {
        console.error("Failed to generate item icon for", itemName, err);
        return 'menu.svg'; // Fallback icon
    }
}

function addItemToInventory(item, quantity = 1) {
    if (inventory[item]) {
        inventory[item] += quantity;
        appendOutputContent(`You gained ${quantity} ${item}(s). Total: ${inventory[item]}`, 'text', 'status-message');
    } else {
        inventory[item] = quantity;
        appendOutputContent(`You found: ${item} (x${quantity})`, 'text', 'status-message');
    }
    playSound(audioCache.get('ui_gain.mp3'), 0.4);
    updateInventoryDisplay();
}

function removeItemFromInventory(item, quantity = 1) {
    if (inventory[item]) {
        const amountToRemove = Math.min(quantity, inventory[item]);
        inventory[item] -= amountToRemove;
        
        if (inventory[item] <= 0) {
            delete inventory[item];
            appendOutputContent(`You used/lost all ${item}(s).`, 'text', 'status-message');
        } else {
            appendOutputContent(`You used ${amountToRemove} ${item}(s). Remaining: ${inventory[item]}`, 'text', 'status-message');
        }
        playSound(audioCache.get('ui_lose.mp3'), 0.4);
    } else {
        playSound(audioCache.get('ui_error.mp3'), 0.6);
        appendOutputContent(`You don't have ${item} to remove.`, 'text', 'error-message');
    }
    updateInventoryDisplay();
}

function updateStatsDisplay() {
    const statsArea = document.getElementById('stats-display-area');
    if (!statsArea) return;
    statsArea.innerHTML = '';

    const isLegacy = currentWorld && !currentWorld.version;

    // If simple mode, show hardcoded health/hunger/thirst
    if (currentWorld && !currentWorld.isAdvanced) {
        const standardStats = [
            { name: 'Health', value: playerStats.health, color: getStatColor(playerStats.health) },
            { name: 'Hunger', value: playerStats.hunger, color: 'var(--stat-hunger-orange)', hidden: currentWorld.disableHunger },
            { name: 'Thirst', value: playerStats.thirst, color: 'var(--stat-thirst-blue)', hidden: currentWorld.disableThirst }
        ];

        standardStats.forEach(s => {
            if (s.hidden) return;
            statsArea.appendChild(createStatElement(s.name, s.value, s.color));
        });
    } else {
        // Advanced Mode: Render based on defined stats in the world
        let definedStats = currentWorld?.rawAdvancedDetails?.filter(d => d.type === 'stats') || [];
        
        // Force core stats for legacy advanced worlds if they aren't explicitly there
        if (isLegacy) {
            const hasHealth = definedStats.some(s => s.name.toLowerCase() === 'health');
            const hasHunger = definedStats.some(s => s.name.toLowerCase() === 'hunger');
            const hasThirst = definedStats.some(s => s.name.toLowerCase() === 'thirst');
            
            if (!hasHealth) definedStats = [{ name: 'Health', color: '#4CAF50' }, ...definedStats];
            if (!hasHunger) definedStats.push({ name: 'Hunger', color: '#FF9800' });
            if (!hasThirst) definedStats.push({ name: 'Thirst', color: '#03A9F4' });
        }

        definedStats.forEach(statDef => {
            // Internal logic uses lower-case keys for core stats to maintain compatibility with AI simulation
            const internalKey = statDef.name.toLowerCase();
            let val = 0;
            if (['health', 'hunger', 'thirst'].includes(internalKey)) {
                val = playerStats[internalKey];
            } else {
                val = playerStats.custom ? playerStats.custom[statDef.name] : 0;
            }

            statsArea.appendChild(createStatElement(statDef.name, val, statDef.color || '#00f3ff'));
        });
    }
}

function createStatElement(name, value, color) {
    const div = document.createElement('div');
    div.className = 'stat-item';
    // NEW: Set CSS variable for better immersive styling
    div.style.setProperty('--stat-color', color);
    div.innerHTML = `
        ${name}
        <div class="stat-bar-container">
            <div class="stat-bar" style="width: ${Math.min(100, Math.max(0, value))}%; background-color: ${color};"></div>
            <span class="stat-value">${Math.round(value)}%</span>
        </div>
    `;
    return div;
}

function getStatColor(value) {
    if (value >= 66) return 'var(--stat-green)';
    if (value >= 33) return '#00f3ff'; // Neon Cyan instead of yellow
    return 'var(--stat-red)';
}

let suppressToasts = false;

function appendOutputContent(content, type = 'text', className = '', technicalError = null) {
    let element;
    if (type === 'image') {
        currentSceneImage.src = content;
    } else {
        element = document.createElement('p');
        element.textContent = content;
        textOutputDiv.appendChild(element);

        if (technicalError) {
            const copyBtn = document.createElement('button');
            copyBtn.className = 'copy-error-btn';
            copyBtn.textContent = 'Copy Full Error';
            copyBtn.onclick = (e) => {
                e.stopPropagation();
                const techInfo = technicalError instanceof Error 
                    ? `Message: ${technicalError.message}\n\nStack:\n${technicalError.stack}`
                    : String(technicalError);
                navigator.clipboard.writeText(techInfo).then(() => {
                    const oldText = copyBtn.textContent;
                    copyBtn.textContent = 'Copied!';
                    setTimeout(() => copyBtn.textContent = oldText, 2000);
                });
                playSound(audioCache.get('ui_click.mp3'), 0.2);
            };
            element.appendChild(document.createElement('br'));
            element.appendChild(copyBtn);
        }
    }

    if (className && type === 'text') {
        element.classList.add(className);
    }

    // Always keep the full log updated
    textOutputDiv.scrollTop = textOutputDiv.scrollTop + textOutputDiv.scrollHeight;

    // IMMERSIVE MODE: also show log messages as transient pop-up toasts
    // Suppress toasts when rebuilding history (e.g., on save load)
    if (
        !suppressToasts &&
        document.body.classList.contains('immersive-ui') &&
        type === 'text' &&
        typeof content === 'string' &&
        content.trim() !== ''
    ) {
        const toastContainer = document.getElementById('immersive-toast-container');
        if (!toastContainer) return;

        const toast = document.createElement('div');
        toast.className = 'immersive-log-toast';
        // Use same text as log; keep it simple and raw
        toast.textContent = content;

        toastContainer.appendChild(toast);

        // Trigger entrance animation
        requestAnimationFrame(() => {
            toast.classList.add('visible');
        });

        const DISPLAY_MS = 8000;
        const FADE_MS = 600;

        setTimeout(() => {
            toast.classList.add('fade-out');
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, FADE_MS);
        }, DISPLAY_MS);
    }
}

async function handlePlayerAction(displayActionText, aiContextActionText, clearPreviousHistory = false) {
    if (!aiContextActionText) return;

    toggleLoading(true);
    toggleInput(false);

    if (clearPreviousHistory) {
        conversationHistory = [conversationHistory[0]];
        textOutputDiv.innerHTML = '';
        appendOutputContent(displayActionText, 'text', 'initial-narrative');
    } else {
        appendOutputContent(`> ${displayActionText}`, 'text', 'user-action-text');
    }

    let attemptSuccessful = false;
    let attemptCount = 0;
    const MAX_ATTEMPTS = 3;
    const AI_TIMEOUT_MS = 45000;
    const IMAGE_GEN_TIMEOUT_MS = 85000; // must exceed shim imageGen hard cap (80s)

    while (attemptCount < MAX_ATTEMPTS && !attemptSuccessful) {
        attemptCount++;
        cancellationTokenSource = new AbortController();
        const signal = cancellationTokenSource.signal;

        try {
            const userMessageObject = {
                role: "user",
                content: aiContextActionText + "\n\n(Respond using the required JSON schema)",
            };

            const messagesForAI = [
                conversationHistory[0],
                ...dynamicSystemMessages,
                ...conversationHistory.slice(1), // Unlimited memory: send all past turns in the session
                userMessageObject
            ];

            const aiPromise = websim.chat.completions.create({
                messages: messagesForAI,
                json: true,
                signal: signal,
            });

            const timeoutPromise = new Promise((resolve, reject) => {
                const id = setTimeout(() => {
                    clearTimeout(id);
                    reject(new Error("AI response timed out."));
                }, AI_TIMEOUT_MS);
            });

            const completion = await Promise.race([aiPromise, timeoutPromise]);

            if (!completion.content || completion.content.trim() === '') {
                throw new Error("AI returned empty response");
            }

            let result;
            let rawContent = completion.content;
            
            // Clean up possible markdown wrapping even if json:true was requested
            if (rawContent.includes('```')) {
                const match = rawContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
                if (match) rawContent = match[1];
            }

            try {
                result = JSON.parse(rawContent);
            } catch (parseError) {
                console.warn("Standard JSON parse failed, attempting loose recovery...", parseError);
                // If the model returned just a string, wrap it as a description
                if (rawContent && rawContent.trim().length > 10) {
                    result = { description: rawContent.trim(), image_prompt: rawContent.trim().substring(0, 100) };
                } else {
                    throw new Error("AI response was not valid JSON.");
                }
            }

            if (!result.description || result.description.trim() === '') {
                // Check for common alternative field names if 'description' is missing
                const altField = result.text || result.narration || result.message || result.scene || result.content;
                if (altField) {
                    result.description = altField;
                } else if (typeof result === 'string') {
                    result = { description: result };
                } else {
                    throw new Error("AI response missing required description field");
                }
            }
            // NEW: Extract current_level
            currentLevel = result.current_level || currentLevel; // Update current level

            // NEW: Music System Flexibility - check for location specific theme
            let themeToPlay = currentWorld.musicDataUrl; // Default to global theme
            if (currentWorld.isAdvanced && currentWorld.rawAdvancedDetails) {
                const normalizedLevel = currentLevel.toLowerCase().trim();
                const locationMatch = currentWorld.rawAdvancedDetails.find(d => 
                    d.type === 'locations' && 
                    d.locationMusicUrl && 
                    (normalizedLevel.includes(d.name.toLowerCase()) || d.name.toLowerCase().includes(normalizedLevel))
                );
                if (locationMatch) {
                    themeToPlay = locationMatch.locationMusicUrl;
                }
            }

            if (themeToPlay) {
                playBackgroundMusic(themeToPlay);
            } else {
                stopMusic();
            }

            let description = result.description;
            let imagePrompt = result.image_prompt;
            let itemsGained = result.items_gained || [];
            let itemsLost = result.items_lost || [];
            let statsChanges = result.stats_changes || {};
            let gameWon = result.game_won || false;

            // NEW: Voice Act the description (async, don't block image)
            voiceActDescription(description, currentWorld, signal);

            // NEW: Sound effects should play before image loads
            try {
                const soundsToPlay = await getSoundEffects(displayActionText, description, signal);
                for (const soundInfo of soundsToPlay) {
                    if (audioCache.has(soundInfo.sound)) {
                        playSound(audioCache.get(soundInfo.sound), soundInfo.volume || 0.7);
                    } else {
                        console.warn(`Sound file not pre-loaded or invalid: ${soundInfo.sound}`);
                    }
                }
            } catch (soundError) {
                if (soundError.name === 'AbortError') {
                    throw soundError;
                }
                console.warn(`Sound effect generation failed: ${soundError.message}`);
            }

            let originalImageURL = '';
            if (imagePrompt && imagePrompt.trim() !== '') {
                // priority: scene images wait for a free API throttle slot (icons/thumbnails don't)
                const imageGenPromise = websim.imageGen(panoramicMode ? {
                    prompt: imagePrompt,
                    // Higher resolution for 360° panoramas to improve visual fidelity
                    width: 4096,
                    height: 2048,
                    priority: true,
                } : {
                    prompt: imagePrompt,
                    aspect_ratio: "16:9",
                    priority: true,
                });

                const imageTimeoutPromise = new Promise((resolve, reject) => {
                    const id = setTimeout(() => {
                        clearTimeout(id);
                        reject(new Error("Image generation timed out."));
                    }, IMAGE_GEN_TIMEOUT_MS);
                });

                try {
                    const imageResult = await Promise.race([imageGenPromise, imageTimeoutPromise]);
                    originalImageURL = imageResult.url;

                    // Default: remember the generated image URL for saving
                    lastSceneImageUrl = originalImageURL || '';
                    lastSceneWasHidden = false;

                    // Lumen Mode: 'disable' suppresses images entirely; otherwise always show
                    // (the old AI graphic-content detector has been removed).
                    if (imageCensoringMode === 'disable') {
                        // Do not display images at all; remember the URL in case user toggles later
                        lastHiddenImageUrl = originalImageURL || '';
                        lastSceneWasHidden = !!originalImageURL;
                        graphicContentWarning.classList.add('hidden');
                        currentSceneImage.src = ''; // Ensure no image shown
                        currentSceneImage.classList.remove('hidden');
                        PanoramaViewer.hide();
                        appendOutputContent("Images are disabled in Lumen Mode. Visuals are suppressed.", 'text', 'status-message');
                        console.log("Image Censoring: Images disabled by user preference.");
                    } else {
                        // Censoring is off, just show the image
                        graphicContentWarning.classList.add('hidden');
                        lastSceneWasHidden = false;
                        if (originalImageURL) {
                            if (panoramicMode) {
                                PanoramaViewer.init(document.getElementById('panorama-container'));
                                PanoramaViewer.loadTexture(originalImageURL);
                            } else {
                                PanoramaViewer.hide();
                                lastNon360ImageUrl = originalImageURL;
                                await displayNewImageWithSwipe(originalImageURL);
                            }
                        }
                        lastHiddenImageUrl = '';
                    }
                } catch (imageError) {
                    console.warn(`Image generation failed or timed out: ${imageError.message}`);
                    appendOutputContent("Could not generate image for the scene.", 'text', 'status-message');
                    graphicContentWarning.classList.add('hidden'); // Hide warning if image fails
                    currentSceneImage.src = ''; // Ensure image is cleared if generation fails
                }
            } else {
                // No image prompt, hide warning and clear stored scene image
                graphicContentWarning.classList.add('hidden');
                currentSceneImage.src = '';
                currentSceneImage.style.opacity = '1';
                lastHiddenImageUrl = '';
                lastSceneImageUrl = '';
                lastSceneWasHidden = false;
            }

            if (statsChanges) {
                if (typeof statsChanges.health_change === 'number') {
                    playerStats.health = Math.max(0, Math.min(100, playerStats.health + statsChanges.health_change));
                }
                if (typeof statsChanges.hunger_change === 'number') {
                    playerStats.hunger = Math.max(0, Math.min(100, playerStats.hunger + statsChanges.hunger_change));
                }
                if (typeof statsChanges.thirst_change === 'number') {
                    playerStats.thirst = Math.max(0, Math.min(100, playerStats.thirst + statsChanges.thirst_change));
                }

                // Apply starvation/dehydration health penalties
                if (playerStats.hunger <= 0 && !currentWorld.disableHunger) {
                    const penalty = 5;
                    playerStats.health = Math.max(0, playerStats.health - penalty);
                    appendOutputContent("You are starving; your health is deteriorating.", 'text', 'status-message');
                }
                if (playerStats.thirst <= 0 && !currentWorld.disableThirst) {
                    const penalty = 8;
                    playerStats.health = Math.max(0, playerStats.health - penalty);
                    appendOutputContent("You are severely dehydrated; your health is failing.", 'text', 'status-message');
                }
                if (statsChanges.custom_stats && typeof statsChanges.custom_stats === 'object') {
                    for (const [sName, sChange] of Object.entries(statsChanges.custom_stats)) {
                        if (!playerStats.custom) playerStats.custom = {};
                        playerStats.custom[sName] = (playerStats.custom[sName] || 0) + sChange;
                    }
                }
                updateStatsDisplay();
            }

            if (gameWon) {
                // Record victory for the user's global stats
                try {
                    await room.collection('world_victory_v1').create({
                        world_id: currentWorld.id || 'local_adventure',
                        world_name: currentWorld.name
                    });
                } catch (vErr) {
                    console.warn("Failed to record victory:", vErr);
                }
                playSound(audioCache.get('ui_confirm.mp3'), 0.5);
                appendOutputContent("--- VICTORY ACHIEVED ---", 'text', 'status-message');
                appendOutputContent("You have fulfilled the world's objective! You may choose to continue exploring.", 'text', 'status-message');
                // We don't return here, allowing the game to continue in "endless mode"
            }

            if (playerStats.health <= 0) {
                endGame("Your health has reached 0%. You collapse and the world fades to black.");
                attemptSuccessful = true;
                return;
            }

            let displayedDescription = description;
            if (currentSummarizeLevel !== 'off') {
                try {
                    const summarized = await summarizeText(description, currentSummarizeLevel, signal);
                    if (summarized) {
                        displayedDescription = summarized;
                    }
                } catch (summaryError) {
                    if (summaryError.name === 'AbortError') {
                        throw summaryError;
                    }
                    console.warn(`Failed to summarize text, displaying original: ${summaryError.message}`);
                }
            }

            appendOutputContent(displayedDescription, 'text', 'ai-message');

            // Handle Items Lost (support strings or {name, quantity} objects)
            itemsLost.forEach(item => {
                if (typeof item === 'object' && item.name) {
                    removeItemFromInventory(item.name, item.quantity || 1);
                } else if (typeof item === 'string') {
                    removeItemFromInventory(item, 1);
                }
            });
            
            // Handle Items Gained (support strings or {name, quantity} objects)
            itemsGained.forEach(item => {
                if (typeof item === 'object' && item.name) {
                    addItemToInventory(item.name, item.quantity || 1);
                } else if (typeof item === 'string') {
                    addItemToInventory(item, 1);
                }
            });

            conversationHistory.push(userMessageObject);
            conversationHistory.push({ role: "assistant", content: completion.content });

            checkWinCondition(); // NEW: Check for win condition after processing AI response

            attemptSuccessful = true;
        } catch (error) {
            cancellationTokenSource = null;

            if (error.name === 'AbortError') {
                console.log("AI request aborted by user.");
                appendOutputContent("AI generation cancelled by user. Please try your action again.", 'text', 'status-message');
                attemptSuccessful = false;
                break;
            } else if (attemptCount < MAX_ATTEMPTS) {
                let errorMessage = "";
                if (error.message && error.message.includes("AI response timed out.")) {
                    errorMessage = "AI response timed out.";
                } else if (error.message && error.message.includes("AI response was not valid JSON.")) {
                    errorMessage = "AI returned invalid data.";
                } else if (error.message && error.message.includes("AI returned empty response")) {
                    errorMessage = "AI returned empty response.";
                } else if (error.message && error.message.includes("AI response missing required description")) {
                    errorMessage = "AI response missing required description.";
                } else {
                    errorMessage = "An unexpected issue occurred.";
                    console.error(`Unhandled error during AI interaction (attempt ${attemptCount}/${MAX_ATTEMPTS}):`, error);
                }
                appendOutputContent(`${errorMessage} Retrying (attempt ${attemptCount} of ${MAX_ATTEMPTS})...`, 'text', 'status-message', error);
            } else {
                let finalErrorMessage = "An error occurred during AI interaction after multiple attempts.";
                if (error.message && error.message.includes("AI response timed out.")) {
                    finalErrorMessage = "AI timed out and could not respond. Please try your action again.";
                } else if (error.message && error.message.includes("AI returned unreadable data.")) {
                    finalErrorMessage = "AI returned unreadable data after multiple attempts. Please try your action again.";
                } else if (error.message && error.message.includes("AI response missing required description")) {
                    finalErrorMessage = "AI response was incomplete after multiple attempts. Please try your action again.";
                } else {
                    console.error(`Final unhandled error during AI interaction (attempt ${attemptCount}/${MAX_ATTEMPTS}):`, error);
                }
                playSound(audioCache.get('ui_error.mp3'), 0.6);
                appendOutputContent(finalErrorMessage, 'text', 'error-message', error);
                attemptSuccessful = false;
                break;
            }
        }
    }

    if (attemptSuccessful) {
        autoSave();
    } else {
        appendOutputContent("Unable to generate a response. The world remains silent.", 'text', 'error-message');
    }

    toggleLoading(false);
    toggleInput(true);
    textOutputDiv.scrollTop = textOutputDiv.scrollHeight;
}

// NEW: Win condition check - Worlds are open-ended now
function checkWinCondition() {
    return false;
}

// MODIFIED: endGame function to handle win/loss states
function endGame(message, isWin = false) { // Add isWin parameter
    if (isWin) {
        playSound(audioCache.get('ui_confirm.mp3'), 0.5); // Play success sound for win
    } else {
        playSound(audioCache.get('ui_error.mp3'), 0.6); // Play error sound for loss
    }
    appendOutputContent(message, 'text', isWin ? 'status-message' : 'error-message'); // Optionally change class for win message
    appendOutputContent(isWin ? "YOU WIN!" : "GAME OVER", 'text', isWin ? 'status-message' : 'error-message'); // Display WIN/GAME OVER
    toggleInput(false);
    loadingDiv.classList.add('hidden');
    stopMusic();
}

function checkGameOver() {
    if (playerStats.health <= 0) {
        endGame("Your health has reached 0%. You collapse and the world fades to black.");
    }
}

function toggleLoading(isLoading) {
    // loadingDiv.classList.toggle('hidden', !isLoading);
}

function toggleInput(isEnabled) {
    userInput.disabled = !isEnabled;
    actButton.disabled = !isEnabled;
}

async function sendAction(event) {
    event.preventDefault();

    const action = userInput.value.trim();
    if (!action) return;

    playSound(audioCache.get('ui_click.mp3'), 0.4);
    const aiContextAction = `Current Stats: ${JSON.stringify(playerStats)}\nInventory: ${JSON.stringify(inventory)}\nUser Action: ${action}`;

    await handlePlayerAction(action, aiContextAction);

    userInput.value = '';
}

inputForm.addEventListener('submit', sendAction);

window.addEventListener('resize', () => {
    const swipeCanvas = document.getElementById('swipe-canvas');
    if (swipeCanvas && swipeCanvas.style.display !== 'none') {
        swipeCanvas.width = imageDisplayDiv.clientWidth;
        swipeCanvas.height = imageDisplayDiv.clientHeight;
    }
    if (menuShader) {
        menuShader.resize();
    }
});

// NEW: Update the graphic content warning click handler
graphicContentWarning.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    playSound(audioCache.get('ui_click.mp3'), 0.4);

    // NEW: Add confirmation dialog
    const confirmed = confirm("This image contains potentially graphic content. Do you want to view it?");
    if (confirmed) {
        graphicContentWarning.classList.add('hidden');
        if (panoramicMode && lastHiddenImageUrl) {
            PanoramaViewer.init(document.getElementById('panorama-container'));
            PanoramaViewer.loadTexture(lastHiddenImageUrl);
            currentSceneImage.src = '';
        } else {
            currentSceneImage.src = lastHiddenImageUrl;
            currentSceneImage.style.opacity = '1';
        }

        lastHiddenImageUrl = '';
        autoSave();
    }
});

class SaveSystem {
    static WORLDS_KEY = 'ai_worlds_v1';
    static GALLERY_CACHE_KEY = 'ai_gallery_cache_v1';
    static SAVES_KEY = 'ai_saves_v1';
    static GLOBAL_SETTINGS_KEY = 'ai_global_settings_v1';

    static getWorlds() {
        const data = localStorage.getItem(this.WORLDS_KEY);
        return data ? JSON.parse(data) : {};
    }

    static getGalleryCache() {
        const data = localStorage.getItem(this.GALLERY_CACHE_KEY);
        return data ? JSON.parse(data) : {};
    }

    static findWorld(name) {
        const worlds = this.getWorlds();
        if (worlds[name]) return worlds[name];
        const cache = this.getGalleryCache();
        return cache[name] || null;
    }

    static async attemptSetItemWithPrune(key, value, maxRetries = 3) {
        // Try to set item; if quota exceeded, prune oldest saves/worlds and retry
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                localStorage.setItem(key, value);
                return true;
            } catch (err) {
                if (err && (err.name === 'QuotaExceededError' || err.code === 22 || err.code === 1014)) {
                    console.warn(`localStorage quota reached (attempt ${attempt + 1}/${maxRetries}). Attempting to free space.`);
                    // Try to prune saves first, then worlds
                    try {
                        const saves = this.getAllSaves();
                        const saveIds = Object.keys(saves);
                        if (saveIds.length > 0) {
                            // Remove the oldest save
                            saveIds.sort((a, b) => new Date(saves[a].timestamp) - new Date(saves[b].timestamp));
                            const oldest = saveIds[0];
                            delete saves[oldest];
                            localStorage.setItem(this.SAVES_KEY, JSON.stringify(saves));
                            console.log(`Pruned oldest save: ${oldest}`);
                            continue; // retry setItem
                        } else {
                            const worlds = this.getWorlds();
                            const worldNames = Object.keys(worlds);
                            if (worldNames.length > 0) {
                                // Remove the oldest world by created timestamp
                                worldNames.sort((a, b) => new Date(worlds[a].created || 0) - new Date(worlds[b].created || 0));
                                const oldestWorld = worldNames[0];
                                delete worlds[oldestWorld];
                                localStorage.setItem(this.WORLDS_KEY, JSON.stringify(worlds));
                                console.log(`Pruned oldest world: ${oldestWorld}`);
                                continue; // retry setItem
                            }
                        }
                    } catch (pruneErr) {
                        console.error("Pruning failed while handling quota error:", pruneErr);
                        // If pruning failed for any reason, break early
                        break;
                    }
                } else {
                    // Not a quota issue, rethrow
                    throw err;
                }
            }
        }
        // Final attempt failed
        return false;
    }

    static saveWorld(name, prompt, musicDataUrl = null, advancedData = null, oldName = null, objective = null) {
        const worlds = this.getWorlds();
        
        if (oldName && oldName !== name) {
            delete worlds[oldName];
        }

        const existingWorld = worlds[name] || {};
        const worldData = { 
            ...existingWorld,
            name, 
            prompt, 
            version: advancedData?.version || existingWorld.version || 2,
            objective: objective !== null ? objective : (existingWorld.objective || ""),
            musicDataUrl: musicDataUrl !== undefined ? musicDataUrl : existingWorld.musicDataUrl,
            created: existingWorld.created || new Date().toISOString(),
            ...advancedData,
            disableHunger: advancedData?.disableHunger !== undefined ? advancedData.disableHunger : (existingWorld.disableHunger || false),
            disableThirst: advancedData?.disableThirst !== undefined ? advancedData.disableThirst : (existingWorld.disableThirst || false),
            isGalleryCache: false // Ensure it's marked as a main library world
        };
        worlds[name] = worldData;

        try {
            localStorage.setItem(this.WORLDS_KEY, JSON.stringify(worlds));
            return worlds[name];
        } catch (err) {
            const success = this.attemptSetItemWithPrune(this.WORLDS_KEY, JSON.stringify(worlds));
            if (success) return worlds[name];
            throw err;
        }
    }

    static saveToGalleryCache(worldData) {
        const cache = this.getGalleryCache();
        const name = worldData.name;
        cache[name] = {
            ...worldData,
            isGalleryCache: true,
            created: worldData.created || new Date().toISOString()
        };

        try {
            localStorage.setItem(this.GALLERY_CACHE_KEY, JSON.stringify(cache));
            return cache[name];
        } catch (err) {
            // Prune gallery cache if it hits quota
            const success = this.attemptSetItemWithPrune(this.GALLERY_CACHE_KEY, JSON.stringify(cache));
            return success ? cache[name] : worldData;
        }
    }

    static deleteWorld(name) {
        const worlds = this.getWorlds();
        const cache = this.getGalleryCache();
        
        if (worlds[name]) {
            delete worlds[name];
            localStorage.setItem(this.WORLDS_KEY, JSON.stringify(worlds));
        }
        if (cache[name]) {
            delete cache[name];
            localStorage.setItem(this.GALLERY_CACHE_KEY, JSON.stringify(cache));
        }

        // Delete all associated saves
        const saves = this.getAllSaves();
        Object.keys(saves).forEach(id => {
            if (saves[id].worldName === name) delete saves[id];
        });
        localStorage.setItem(this.SAVES_KEY, JSON.stringify(saves));
    }

    static getAllSaves() {
        const data = localStorage.getItem(this.SAVES_KEY);
        return data ? JSON.parse(data) : {};
    }

    static getSavesForWorld(worldName) {
        const all = this.getAllSaves();
        return Object.values(all)
            .filter(s => s.worldName === worldName)
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }

    static saveGame(saveId, data) {
        const saves = this.getAllSaves();

        // Sanitize conversation history: try to keep as much as possible for "unlimited" feel
        let safeConversation = data.conversationHistory || [];
        try {
            // No longer force-slicing to 300 to satisfy "unlimited" request.
            // Browser quota will be managed by the setItem retry/prune logic instead.

            // If serialized conversation is absolutely massive (e.g. over 2MB), 
            // we apply a safety floor to prevent complete storage failure.
            const serializedConv = JSON.stringify(safeConversation);
            if (serializedConv.length > 2000000) {
                console.warn("Conversation history approaching extreme browser limits; trimming oldest entries.");
                safeConversation = safeConversation.slice(-500); 
            }
        } catch (e) {
            console.warn("Failed to sanitize conversation history; storing minimal placeholder.", e);
            safeConversation = [{ role: 'system', content: '[CONVERSATION_TRUNCATED_FOR_STORAGE]' }];
        }

        // Sanitize lastImageSrc: do not store very large embedded data URLs (replace with null and flag)
        let safeLastImageSrc = data.lastImageSrc;
        let safeWasImageHidden = !!data.wasImageHidden;
        try {
            if (typeof safeLastImageSrc === 'string' && safeLastImageSrc.startsWith('data:') && safeLastImageSrc.length > 100000) {
                console.warn("Embedded image data too large for storage; omitting image and marking as hidden.");
                safeLastImageSrc = null;
                safeWasImageHidden = true;
            }
        } catch (e) {
            safeLastImageSrc = null;
            safeWasImageHidden = true;
        }

        saves[saveId] = {
            id: saveId,
            worldName: data.worldName,
            saveName: data.saveName,
            conversationHistory: safeConversation,
            inventory: data.inventory,
            playerStats: data.playerStats,
            lastImageSrc: safeLastImageSrc,
            wasImageHidden: safeWasImageHidden,
            currentLevel: data.currentLevel,
            timestamp: new Date().toISOString()
        };

        try {
            localStorage.setItem(this.SAVES_KEY, JSON.stringify(saves));
            console.log(`Game saved: ${saveId}`);
        } catch (err) {
            console.error("localStorage.setItem failed when saving game:", err);
            // Try to free up space by pruning the oldest save(s) then retry
            const serialized = JSON.stringify(saves);
            const success = this.attemptSetItemWithPrune(this.SAVES_KEY, serialized);
            if (success) {
                console.log(`Game saved after pruning: ${saveId}`);
                return;
            } else {
                // If still failing, remove the problematic save and warn the user
                delete saves[saveId];
                try { localStorage.setItem(this.SAVES_KEY, JSON.stringify(saves)); } catch (e) { /* ignore */ }
                alert("Not enough storage to save this game. Try deleting old saves or thumbnails.");
                throw new Error("Unable to save game due to storage quota.");
            }
        }
    }

    static loadGame(saveId) {
        const saves = this.getAllSaves();
        return saves[saveId] || null;
    }

    static deleteSave(saveId) {
        const saves = this.getAllSaves();
        if (saves[saveId]) {
            delete saves[saveId];
            localStorage.setItem(this.SAVES_KEY, JSON.stringify(saves));
            return true;
        }
        return false;
    }

    static saveGlobalSettings(settings) {
        const currentSettings = this.loadGlobalSettings();
        localStorage.setItem(this.GLOBAL_SETTINGS_KEY, JSON.stringify({
            ...currentSettings,
            ...settings
        }));
    }

    static loadGlobalSettings() {
        const settingsRaw = localStorage.getItem(this.GLOBAL_SETTINGS_KEY);
        const defaultSettings = {
            currentSummarizeLevel: DEFAULT_SUMMARIZE_LEVEL,
            uiSoundsVolume: 0.7,
            musicVolume: 0.4,
            imageCensoringMode: 'hide',
            backgroundEnabled: true,
            voiceActingEnabled: true,
            cornerRoundingEnabled: true,
            panoramicFov: 75,
            language: 'en'
        };
        
        if (!settingsRaw) return defaultSettings;
        
        const settings = JSON.parse(settingsRaw);
        
        // Handle migration from booleans if necessary
        if (settings.uiSoundsEnabled !== undefined) {
            settings.uiSoundsVolume = settings.uiSoundsEnabled ? 0.7 : 0;
            delete settings.uiSoundsEnabled;
        }
        if (settings.musicEnabled !== undefined) {
            settings.musicVolume = settings.musicEnabled ? 0.4 : 0;
            delete settings.musicEnabled;
        }
        
        return { ...defaultSettings, ...settings };
    }
}

/* If a saved world has no thumbnail, generate one via AI and assign it to the world record.
   This runs after world creation, updates, and when copying a shared world so every save
   ends up with a thumbnail (if possible). */
let thumbnailGenInFlight = false;
async function generateAndAssignThumbnail(worldName) {
    if (thumbnailGenInFlight) return; // one generation at a time (create + settings can overlap)
    thumbnailGenInFlight = true;
    try {
        const worlds = SaveSystem.getWorlds();
        const world = worlds[worldName];
        if (!world) return;
        if (world.thumbnailUrl) return; // already has one

        // Build a concise prompt for thumbnail generation
        const prompt = `Cinematic gallery thumbnail for a world titled \"${world.name}\". Theme: ${world.prompt}. Masterpiece quality, high-contrast, evocative, polished digital art, coherent composition, correct anatomy with natural hands and limbs, clean detailed rendering, no artifacts, no distortions, no garbled text.`;

        // Request image generation
        const result = await websim.imageGen({
            prompt,
            aspect_ratio: "16:9"
        });

        if (result && result.url) {
            // Attach thumbnail to the world and persist
            world.thumbnailUrl = result.url;
            // Use SaveSystem.saveWorld to persist the updated world (preserve existing metadata)
            SaveSystem.saveWorld(world.name, world.prompt, world.musicDataUrl, {
                isAdvanced: world.isAdvanced,
                rawAdvancedDetails: world.rawAdvancedDetails,
                startingItems: world.startingItems,
                locations: world.locations,
                characters: world.characters,
                rules: world.rules,
                customStats: world.customStats,
                thumbnailUrl: world.thumbnailUrl
            }, world.name, world.objective || "");
            console.log(`Generated and assigned thumbnail for world: ${world.name}`);
            try {
                if (typeof refreshWorldsList === 'function' && worldsMenu && !worldsMenu.classList.contains('hidden')) {
                    refreshWorldsList();
                }
            } catch (e) { /* list may not exist in this view */ }
        }
    } catch (err) {
        console.warn("Automatic thumbnail generation failed for", worldName, err);
    } finally {
        thumbnailGenInFlight = false;
    }
}

const mainMenu = document.getElementById('main-menu');
const gameContainer = document.getElementById('game-container');
const featuredWorldsBtn = document.getElementById('featured-worlds-btn');
const manageWorldsBtn = document.getElementById('manage-worlds-btn');
const worldsMenu = document.getElementById('worlds-menu');
const worldsList = document.getElementById('worlds-list');
const tabLocalBtn = document.getElementById('tab-local-btn');
const tabPlayedBtn = document.getElementById('tab-played-btn');
const tabUploadedBtn = document.getElementById('tab-uploaded-btn');
const browseOnlineBtn = document.getElementById('browse-online-btn');
const onlineWorldsMenu = document.getElementById('online-worlds-menu');
const onlineWorldsList = document.getElementById('online-worlds-list');
let showFeaturedOnly = false;
const shadowRealmBtn = document.getElementById('shadow-realm-btn');
const reportsBtn = document.getElementById('reports-btn');
const reportsMenu = document.getElementById('reports-menu');
const reportsCloseBtn = document.getElementById('reports-close-btn');
const reportsList = document.getElementById('reports-list');
const shadowRealmMenu = document.getElementById('shadow-realm-menu');
const shadowRealmCloseBtn = document.getElementById('shadow-realm-close-btn');
const shadowWorldsList = document.getElementById('shadow-worlds-list');
const onlineSearchInput = document.getElementById('online-search');
const openGalleryFiltersBtn = document.getElementById('open-gallery-filters-btn');
const galleryFiltersModal = document.getElementById('gallery-filters-modal');
const closeFiltersBtn = document.getElementById('close-filters-btn');
const applyFiltersBtn = document.getElementById('apply-filters-btn');
const filterWordsMinInput = document.getElementById('filter-words-min');
const filterWordsMaxInput = document.getElementById('filter-words-max');
const closeOnlineMenuBtn = document.getElementById('close-online-menu-btn');

openGalleryFiltersBtn.addEventListener('click', () => {
    playSound(audioCache.get('ui_click.mp3'), 0.4);
    galleryFiltersModal.classList.remove('hidden');
});

closeFiltersBtn.addEventListener('click', () => {
    playSound(audioCache.get('ui_click.mp3'), 0.2);
    galleryFiltersModal.classList.add('hidden');
});

applyFiltersBtn.addEventListener('click', () => {
    playSound(audioCache.get('ui_confirm.mp3'), 0.4);
    galleryFiltersModal.classList.add('hidden');
    renderSharedWorlds();
});

const onlineWorldDetails = document.getElementById('online-world-details');
const reportWorldBtn = document.getElementById('report-world-btn');
const modBanishBtn = document.getElementById('mod-banish-btn');
const modFeatureBtn = document.getElementById('mod-feature-btn');
const onlineDetailName = document.getElementById('online-detail-name');
const onlineDetailCreator = document.getElementById('online-detail-creator');
const onlineDetailPrompt = document.getElementById('online-detail-prompt');
const likeBtn = document.getElementById('like-btn');
const dislikeBtn = document.getElementById('dislike-btn');
const likeCountSpan = document.getElementById('like-count');
const dislikeCountSpan = document.getElementById('dislike-count');
const commentsList = document.getElementById('comments-list');
const newCommentInput = document.getElementById('new-comment-input');
const postCommentBtn = document.getElementById('post-comment-btn');
const playSharedWorldBtn = document.getElementById('play-shared-world-btn');
const closeOnlineDetailsBtn = document.getElementById('close-online-details-btn');
const copyWorldIdBtn = document.getElementById('copy-world-id-btn');

const openCreateWorldBtn = document.getElementById('open-create-world-btn');
const closeWorldsMenuBtn = document.getElementById('close-worlds-menu-btn');
const importWorldBtn = document.getElementById('import-world-btn');

const createWorldMenu = document.getElementById('create-world-menu');
const newWorldNameInput = document.getElementById('new-world-name');
const newWorldPromptInput = document.getElementById('new-world-prompt');
const newWorldObjectiveInput = document.getElementById('new-world-objective');
const newWorldMusicInput = document.getElementById('new-world-music');
const confirmCreateWorldBtn = document.getElementById('confirm-create-world-btn');
const cancelCreateWorldBtn = document.getElementById('cancel-create-world-btn');

const modeSimpleBtn = document.getElementById('mode-simple-btn');
const modeAdvancedBtn = document.getElementById('mode-advanced-btn');
const advancedFields = document.getElementById('advanced-fields');

const advancedDetailMenu = document.getElementById('advanced-detail-menu');
const advDetailTitle = document.getElementById('adv-detail-title');
const subAdvOpenModalBtn = document.getElementById('sub-adv-open-modal-btn');
const subAdvSearch = document.getElementById('sub-adv-search');
const subAdvListContainer = document.getElementById('sub-adv-list-container');
const closeAdvDetailBtn = document.getElementById('close-adv-detail-btn');

// Modal Elements
const advancedEntryModal = document.getElementById('advanced-entry-modal');
const entryModalTitle = document.getElementById('entry-modal-title');
const entryNameInput = document.getElementById('entry-name');
const entryDescriptionInput = document.getElementById('entry-description');
const entrySaveBtn = document.getElementById('entry-save-btn');
const entryCancelBtn = document.getElementById('entry-cancel-btn');
const previewVoiceBtn = document.getElementById('preview-voice-btn');

let creationMode = 'simple';
let currentEditingCategory = 'items';
let currentAdvancedDetails = []; // Array of { type: 'items|locations|etc', name: 'string', description: 'string' }
let currentEditingDetailIndex = null; // Track which entry is being edited
const itemImageMap = new Map(); // Global runtime cache for item images
const itemGenerationQueue = new Set(); // Track items currently being AI-generated

modeSimpleBtn.addEventListener('click', () => {
    playSound(audioCache.get('ui_click.mp3'), 0.4);
    creationMode = 'simple';
    modeSimpleBtn.classList.add('active');
    modeAdvancedBtn.classList.remove('active');
    advancedFields.classList.add('hidden');
});

modeAdvancedBtn.addEventListener('click', () => {
    playSound(audioCache.get('ui_click.mp3'), 0.4);
    creationMode = 'advanced';
    modeAdvancedBtn.classList.add('active');
    modeSimpleBtn.classList.remove('active');
    advancedFields.classList.remove('hidden');
    ensureDefaultStats();
    updateCategoryCounts();
});

function ensureDefaultStats() {
    // Determine if we are working with a legacy world (no version flag)
    // currentWorld being null implies a new world (which will automatically become v2 on save)
    const isLegacy = currentWorld && !currentWorld.version;

    const defaults = [
        { type: 'stats', name: 'Health', description: 'Your overall physical well-being.', startValue: 100, color: '#4CAF50' },
        { type: 'stats', name: 'Hunger', description: 'Your need for food.', startValue: 100, color: '#FF9800' },
        { type: 'stats', name: 'Thirst', description: 'Your need for hydration.', startValue: 100, color: '#03A9F4' }
    ];

    defaults.forEach(def => {
        const exists = currentAdvancedDetails.some(d => d.type === 'stats' && d.name.toLowerCase() === def.name.toLowerCase());
        if (!exists) {
            // Force stats for legacy worlds. For v2 worlds, we only add them if the list is currently empty (initial setup)
            if (isLegacy || currentAdvancedDetails.length === 0) {
                currentAdvancedDetails.push(def);
            }
        }
    });
}

function updateCategoryCounts() {
    const counts = { items: 0, locations: 0, characters: 0, rules: 0, stats: 0 };
    currentAdvancedDetails.forEach(d => {
        if (counts[d.type] !== undefined) counts[d.type]++;
    });
    
    // Update main creation menu counts
    ['items', 'locations', 'characters', 'rules', 'stats'].forEach(cat => {
        const el = document.getElementById(`count-${cat}`);
        if (el) el.textContent = counts[cat];
        const editEl = document.getElementById(`edit-count-${cat}`);
        if (editEl) editEl.textContent = counts[cat];
    });
}

document.querySelectorAll('.category-card').forEach(card => {
    card.addEventListener('click', () => {
        const category = card.dataset.category;
        openAdvancedSubMenu(category);
    });
});

function openAdvancedSubMenu(category) {
    playSound(audioCache.get('ui_click.mp3'), 0.4);
    currentEditingCategory = category;
    
    const translationKeys = {
        items: "adv.editItems",
        locations: "adv.editLocations",
        characters: "adv.editCharacters",
        rules: "adv.editRules",
        stats: "adv.editStats"
    };
    
    advDetailTitle.textContent = t(translationKeys[category] || category);
    subAdvSearch.value = '';
    
    advancedDetailMenu.classList.remove('hidden');
    renderSubAdvancedDetails();
}

function renderSubAdvancedDetails() {
    subAdvListContainer.innerHTML = '';
    const filter = subAdvSearch.value.toLowerCase();
    
    const categoryIcons = {
        items: "🎒",
        locations: "📍",
        characters: "👥",
        rules: "📜",
        stats: "📊"
    };

    currentAdvancedDetails.forEach((detail, index) => {
        if (detail.type !== currentEditingCategory) return;
        if (filter && !detail.name.toLowerCase().includes(filter) && !detail.description.toLowerCase().includes(filter)) return;

        const card = document.createElement('div');
        card.className = `adv-entry-card tag-${detail.type}`;
        
        const iconHtml = (detail.type === 'items' && detail.imageUrl) 
            ? `<img src="${detail.imageUrl}" class="adv-entry-icon-img" crossorigin="anonymous">`
            : `<span>${categoryIcons[detail.type] || "•"}</span>`;

        const statInfo = (detail.type === 'stats') 
            ? `<div class="adv-entry-stat-info">${detail.startValue}% • <span style="color:${detail.color}">█ Bar Color</span></div>`
            : '';

        const musicIndicator = (detail.type === 'locations' && detail.locationMusicUrl)
            ? `<div style="font-size: 0.7em; color: #00f3ff; margin-top: 4px; font-weight: bold;">♫ CUSTOM THEME ATTACHED</div>`
            : '';

        card.innerHTML = `
            <div class="adv-entry-icon-preview">
                ${iconHtml}
            </div>
            <div class="adv-entry-content">
                <div class="adv-entry-header">
                    <span class="adv-entry-name">${detail.name}</span>
                </div>
                <div class="adv-entry-desc">${detail.description || "No description provided."}</div>
                ${statInfo}
                ${musicIndicator}
            </div>
            <div class="adv-entry-actions">
                <div class="adv-entry-btn edit" title="Edit Entry">✎</div>
                <div class="adv-entry-btn delete" title="Delete Entry">×</div>
            </div>
        `;
        
        // Edit on click or explicit edit button
        const handleEdit = () => openEntryModal(detail, index);
        card.addEventListener('click', handleEdit);
        card.querySelector('.edit').addEventListener('click', (e) => {
            e.stopPropagation();
            handleEdit();
        });

        card.querySelector('.delete').addEventListener('click', (e) => {
            e.stopPropagation();
            playSound(audioCache.get('ui_click.mp3'), 0.2);
            if (confirm(`Remove "${detail.name}" from your world configuration?`)) {
                currentAdvancedDetails.splice(index, 1);
                renderSubAdvancedDetails();
                updateCategoryCounts();
                playSound(audioCache.get('ui_lose.mp3'), 0.3);
            }
        });
        
        subAdvListContainer.appendChild(card);
    });
}

subAdvOpenModalBtn.addEventListener('click', () => {
    openEntryModal();
});

function openEntryModal(existingDetail = null, index = null) {
    playSound(audioCache.get('ui_click.mp3'), 0.4);
    currentEditingDetailIndex = index;

    const singularNames = { items: "Item", locations: "Location", characters: "Character", rules: "Lore/Rule", stats: "Stat" };
    const icons = { items: "🎒", locations: "📍", characters: "👥", rules: "📜", stats: "📊" };
    const placeholders = {
        items: "e.g. Plasma Pistol, Rations...",
        locations: "e.g. The Spire, Sunken City...",
        characters: "e.g. Merchant, Rogue AI...",
        rules: "e.g. Gravity is low, Perma-death...",
        stats: "e.g. Oxygen, Mana, Heat..."
    };

    const isEditing = existingDetail !== null;
    entryModalTitle.textContent = `${isEditing ? 'Edit' : 'Add New'} ${singularNames[currentEditingCategory] || 'Entry'}`;
    document.getElementById('entry-modal-icon').textContent = icons[currentEditingCategory] || "📝";
    
    entryNameInput.value = isEditing ? existingDetail.name : '';
    entryDescriptionInput.value = isEditing ? existingDetail.description : '';
    entryNameInput.placeholder = placeholders[currentEditingCategory] || "Enter name...";
    
    // Handle Image Field
    const imageField = document.getElementById('entry-image-field');
    const imageInput = document.getElementById('entry-image-input');
    const imagePreview = document.getElementById('entry-image-preview');
    const imagePreviewContainer = document.getElementById('entry-image-preview-container');

    imageInput.value = ''; // Reset input
    if (currentEditingCategory === 'items') {
        imageField.classList.remove('hidden');
        if (isEditing && existingDetail.imageUrl) {
            imagePreview.src = existingDetail.imageUrl;
            imagePreviewContainer.classList.remove('hidden');
        } else {
            imagePreviewContainer.classList.add('hidden');
        }
    } else {
        imageField.classList.add('hidden');
    }

    // NEW: Handle Location Music Field
    const locationMusicField = document.getElementById('entry-location-music-field');
    const locationMusicInput = document.getElementById('entry-location-music-input');
    const locationMusicInfo = document.getElementById('entry-location-music-info');
    
    if (locationMusicInput) {
        locationMusicInput.value = '';
        if (currentEditingCategory === 'locations') {
            locationMusicField.classList.remove('hidden');
            locationMusicInfo.textContent = (isEditing && existingDetail.locationMusicUrl) ? "✓ Custom theme set" : "";
            // Temporarily store the URL on the input so save can find it
            locationMusicInput.dataset.currentUrl = (isEditing && existingDetail.locationMusicUrl) ? existingDetail.locationMusicUrl : "";
        } else {
            locationMusicField.classList.add('hidden');
        }
    }

    // Handle Stat Fields
    const statFields = document.getElementById('entry-stat-fields');
    const statValueInput = document.getElementById('entry-stat-value');
    const statColorInput = document.getElementById('entry-stat-color');

    if (currentEditingCategory === 'stats') {
        statFields.classList.remove('hidden');
        statValueInput.value = isEditing ? (existingDetail.startValue ?? 100) : 100;
        statColorInput.value = isEditing ? (existingDetail.color ?? '#00f3ff') : '#00f3ff';
    } else {
        statFields.classList.add('hidden');
    }

    // Handle Voice Field
    const voiceField = document.getElementById('entry-voice-field');
    const voiceSelect = document.getElementById('entry-voice-select');
    if (currentEditingCategory === 'characters') {
        voiceField.classList.remove('hidden');
        voiceSelect.value = isEditing ? (existingDetail.voiceId || 'auto') : 'auto';
    } else {
        voiceField.classList.add('hidden');
    }
    
    // Set theme class
    advancedEntryModal.className = `entry-modal-overlay ${currentEditingCategory}`;
    
    advancedEntryModal.classList.remove('hidden');
    entryNameInput.focus();
}

// NEW: Add listener for location music upload
document.getElementById('entry-location-music-input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
        playSound(audioCache.get('ui_click.mp3'), 0.2);
        try {
            const saveBtn = document.getElementById('entry-save-btn');
            const originalText = saveBtn.textContent;
            saveBtn.disabled = true;
            saveBtn.textContent = "Uploading Audio...";
            
            const url = await websim.upload(file);
            e.target.dataset.currentUrl = url;
            document.getElementById('entry-location-music-info').textContent = "✓ Theme uploaded";
            
            saveBtn.disabled = false;
            saveBtn.textContent = originalText;
        } catch (err) {
            console.error("Failed to upload location music:", err);
            alert("Audio upload failed.");
        }
    }
});

// Add listener for modal image upload
document.getElementById('entry-image-input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
        playSound(audioCache.get('ui_click.mp3'), 0.2);
        try {
            const url = await websim.upload(file);
            const imagePreview = document.getElementById('entry-image-preview');
            const imagePreviewContainer = document.getElementById('entry-image-preview-container');
            imagePreview.src = url;
            imagePreviewContainer.classList.remove('hidden');
        } catch (err) {
            console.error("Failed to upload entry image:", err);
            alert("Image upload failed.");
        }
    }
});

entryCancelBtn.addEventListener('click', () => {
    playSound(audioCache.get('ui_click.mp3'), 0.4);
    advancedEntryModal.classList.add('hidden');
});

entrySaveBtn.addEventListener('click', () => {
    const name = entryNameInput.value.trim();
    const description = entryDescriptionInput.value.trim();
    const imagePreview = document.getElementById('entry-image-preview');
    const imageUrl = (currentEditingCategory === 'items' && !document.getElementById('entry-image-preview-container').classList.contains('hidden')) 
                    ? imagePreview.src : null;
    
    if (!name) {
        alert("Please provide at least a name.");
        return;
    }

    playSound(audioCache.get('ui_confirm.mp3'), 0.4);
    
    const entryData = {
        type: currentEditingCategory,
        name: name,
        description: description,
        imageUrl: imageUrl
    };

    if (currentEditingCategory === 'locations') {
        entryData.locationMusicUrl = document.getElementById('entry-location-music-input').dataset.currentUrl || null;
    }

    if (currentEditingCategory === 'stats') {
        entryData.startValue = parseInt(document.getElementById('entry-stat-value').value) || 0;
        entryData.color = document.getElementById('entry-stat-color').value;
    }

    if (currentEditingCategory === 'characters') {
        entryData.voiceId = document.getElementById('entry-voice-select').value;
    }

    if (currentEditingDetailIndex !== null) {
        currentAdvancedDetails[currentEditingDetailIndex] = entryData;
    } else {
        currentAdvancedDetails.push(entryData);
    }
    
    advancedEntryModal.classList.add('hidden');
    renderSubAdvancedDetails();
    updateCategoryCounts();
});

subAdvSearch.addEventListener('input', renderSubAdvancedDetails);

if (previewVoiceBtn) {
    previewVoiceBtn.addEventListener('click', async () => {
        const voiceSelect = document.getElementById('entry-voice-select');
        let voiceId = voiceSelect.value;
        const charName = document.getElementById('entry-name').value.trim() || "explorer";
        
        if (voiceId === 'auto') {
            // Pick a random but distinct preview voice if set to auto
            voiceId = 'en-male';
        }

        playSound(audioCache.get('ui_click.mp3'), 0.4);
        previewVoiceBtn.disabled = true;
        const originalContent = previewVoiceBtn.textContent;
        previewVoiceBtn.textContent = "⌛";

        try {
            const sampleText = `Greetings, I am ${charName}. I am ready to begin our journey.`;
            const result = await websim.textToSpeech({
                text: sampleText,
                voice: voiceId
            });
            
            const audio = new Audio(result.url);
            audio.volume = Math.min(1, uiSoundsVolume * 1.2);
            await audio.play();
        } catch (err) {
            console.error("Voice preview failed:", err);
        } finally {
            previewVoiceBtn.disabled = false;
            previewVoiceBtn.textContent = originalContent;
        }
    });
}

closeAdvDetailBtn.addEventListener('click', () => {
    playSound(audioCache.get('ui_click.mp3'), 0.4);
    advancedDetailMenu.classList.add('hidden');
});

const worldConfigMenu = document.getElementById('world-config-menu');
const configWorldTitle = document.getElementById('config-world-title');
const editWorldNameInput = document.getElementById('edit-world-name');
const editWorldPrompt = document.getElementById('edit-world-prompt');
const editWorldObjectiveInput = document.getElementById('edit-world-objective');
const editWorldMusicInput = document.getElementById('edit-world-music');
const shareWorldBtn = document.getElementById('share-world-btn');
const currentMusicInfo = document.getElementById('current-music-info');
const saveWorldConfigBtn = document.getElementById('save-world-config-btn');
const cancelWorldConfigBtn = document.getElementById('cancel-world-config-btn');
const worldSavesList = document.getElementById('world-saves-list');
const newSaveBtn = document.getElementById('new-save-btn');
const closeWorldConfigBtn = document.getElementById('close-world-config-btn');

const editModeSimpleBtn = document.getElementById('edit-mode-simple-btn');
const editModeAdvancedBtn = document.getElementById('edit-mode-advanced-btn');
const editAdvancedFields = document.getElementById('edit-advanced-fields');

let editCreationMode = 'simple';

editModeSimpleBtn.addEventListener('click', () => {
    playSound(audioCache.get('ui_click.mp3'), 0.4);
    editCreationMode = 'simple';
    editModeSimpleBtn.classList.add('active');
    editModeAdvancedBtn.classList.remove('active');
    editAdvancedFields.classList.add('hidden');
});

editModeAdvancedBtn.addEventListener('click', () => {
    playSound(audioCache.get('ui_click.mp3'), 0.4);
    editCreationMode = 'advanced';
    editModeAdvancedBtn.classList.add('active');
    editModeSimpleBtn.classList.remove('active');
    editAdvancedFields.classList.remove('hidden');
    ensureDefaultStats();
    updateCategoryCounts();
});

const returnToMenuBtn = document.getElementById('return-to-menu-btn');

let currentSaveId = null;
let currentSaveName = null;
let currentWorld = null;

async function startNewGame(world, saveName) {
    currentWorld = world;
    currentSaveId = `${world.name}_${Date.now()}`;
    currentSaveName = saveName || "New Adventure";
    currentLevel = "Uninitialized World";

    if (world.musicDataUrl) {
        playBackgroundMusic(world.musicDataUrl);
    } else {
        stopMusic();
    }

    // Setup conversation with system prompt based on world concept
    conversationHistory = [getSystemPrompt(world)];

    inventory = {};
    playerStats = {
        health: 100,
        hunger: 100,
        thirst: 100,
        custom: {}
    };

    // Apply starting items and custom stats if in advanced mode
    const isLegacy = world && !world.version;

    if (world.isAdvanced || isLegacy) {
        if (world.startingItems) {
            const items = world.startingItems.split('\n').map(i => i.trim()).filter(i => i);
            items.forEach(itemStr => {
                const name = itemStr.split(' (')[0];
                inventory[name] = (inventory[name] || 0) + 1;
            });
        }
        
        // Initialize stats from advanced definitions
        const stats = world.rawAdvancedDetails?.filter(d => d.type === 'stats') || [];
        
        // For legacy worlds, ensure the core three are at least initialized if missing
        if (isLegacy) {
            if (!stats.some(s => s.name.toLowerCase() === 'health')) playerStats.health = 100;
            if (!stats.some(s => s.name.toLowerCase() === 'hunger')) playerStats.hunger = 100;
            if (!stats.some(s => s.name.toLowerCase() === 'thirst')) playerStats.thirst = 100;
        }

        stats.forEach(statDef => {
            const internalKey = statDef.name.toLowerCase();
            const startVal = statDef.startValue ?? 100;
            
            if (['health', 'hunger', 'thirst'].includes(internalKey)) {
                playerStats[internalKey] = startVal;
            } else {
                if (!playerStats.custom) playerStats.custom = {};
                playerStats.custom[statDef.name] = startVal;
            }
        });
    }

    mainMenu.classList.add('hidden');
    worldsMenu.classList.add('hidden');
    worldConfigMenu.classList.add('hidden');
    createWorldMenu.classList.add('hidden');
    gameContainer.classList.remove('hidden');
    document.body.classList.add('game-active');

    playSound(audioCache.get('ui_confirm.mp3'), 0.5);
    updateInventoryDisplay();
    updateStatsDisplay();
    textOutputDiv.innerHTML = '';

    const displayAction = `Entering World...`;
    const aiContextAction = `Initialize the game in the world concept provided in your system prompt. Describe the starting scene and the current state of the player. Current Stats: ${JSON.stringify(playerStats)}`;
    await handlePlayerAction(displayAction, aiContextAction, true);
}

// REMOVED: showNewGameNamePrompt function


let activeWorldsTab = 'local';

tabLocalBtn.addEventListener('click', () => {
    playSound(audioCache.get('ui_click.mp3'), 0.4);
    activeWorldsTab = 'local';
    tabLocalBtn.classList.add('active');
    tabPlayedBtn.classList.remove('active');
    tabUploadedBtn.classList.remove('active');
    refreshWorldsList();
});

tabPlayedBtn.addEventListener('click', () => {
    playSound(audioCache.get('ui_click.mp3'), 0.4);
    activeWorldsTab = 'played';
    tabPlayedBtn.classList.add('active');
    tabLocalBtn.classList.remove('active');
    tabUploadedBtn.classList.remove('active');
    refreshWorldsList();
});

tabUploadedBtn.addEventListener('click', () => {
    playSound(audioCache.get('ui_click.mp3'), 0.4);
    activeWorldsTab = 'uploaded';
    tabUploadedBtn.classList.add('active');
    tabLocalBtn.classList.remove('active');
    tabPlayedBtn.classList.remove('active');
    refreshWorldsList();
});

function refreshWorldsList() {
    worldsList.innerHTML = '';

    if (activeWorldsTab === 'local' || activeWorldsTab === 'played') {
        const worlds = activeWorldsTab === 'local' ? SaveSystem.getWorlds() : SaveSystem.getGalleryCache();
        
        if (activeWorldsTab === 'local') {
            // Add "Create New World" card first
            const createCard = document.createElement('div');
            createCard.className = 'world-card create-new';
            createCard.innerHTML = `
                <div class="create-icon">+</div>
                <div class="create-text">Create World</div>
            `;
            createCard.onclick = () => {
                playSound(audioCache.get('ui_click.mp3'), 0.4);
                playBackgroundMusic('faceraiders.mp3');
                worldsMenu.classList.add('hidden');
                createWorldMenu.classList.remove('hidden');
                newWorldNameInput.value = '';
                newWorldPromptInput.value = '';
                currentAdvancedDetails = [];
                subAdvSearch.value = '';
                updateCategoryCounts();
            };
            worldsList.appendChild(createCard);
        }

        const names = Object.keys(worlds).sort((a, b) => {
            const dateA = new Date(worlds[a].created || 0);
            const dateB = new Date(worlds[b].created || 0);
            return dateB - dateA;
        });

        names.forEach(name => {
            const world = worlds[name];
            const card = document.createElement('div');
            card.className = 'world-card';
            
            const saves = SaveSystem.getSavesForWorld(name);
            let thumbnail = 'background.jpg';
            if (world.thumbnailUrl) {
                thumbnail = world.thumbnailUrl;
            } else if (saves.length > 0 && saves[0].lastImageSrc) {
                thumbnail = saves[0].lastImageSrc;
            }

            const isGalleryCache = world.isGalleryCache;
            const dateObj = new Date(world.created || world.created_at || 0);
            const uploadDate = (world.created || world.created_at) ? formatDateForUI(dateObj) : 'Unknown Date';
            const exactTime = (world.created || world.created_at) ? formatTimeForUI(dateObj) : '';
            const fullDate = exactTime ? `${uploadDate} ${exactTime}` : uploadDate;

            card.innerHTML = `
                <div class="world-card-thumbnail-container">
                    <img src="${thumbnail}" class="world-card-thumbnail" alt="${world.name}" crossorigin="anonymous">
                </div>
                <div class="world-card-content">
                    <h4>${world.name}</h4>
                    <div class="world-meta" style="margin-bottom: 5px;">
                        ${isGalleryCache ? `<span style="color: #00f3ff; font-size: 0.7em;">PLAYED FROM GALLERY</span>` : `<span class="date-toggle" style="opacity: 0.5; cursor: pointer;" title="Click for exact time" data-short="${uploadDate}" data-full="${fullDate}">${fullDate}</span>`}
                    </div>
                    <p class="world-desc">${world.prompt}</p>
                    <div class="world-card-footer">
                        <div class="world-meta">
                            <span>${saves.length} Saves</span>
                            <span>${world.isAdvanced ? 'Advanced' : 'Simple'}</span>
                        </div>
                        <div class="world-actions">
                            <button class="world-action-btn export-world-btn" title="Export as Zip">💾</button>
                            <button class="world-action-btn edit-world-btn" title="Edit">🛠️</button>
                            <button class="world-action-btn delete delete-world-btn">×</button>
                        </div>
                    </div>
                </div>
            `;
            
            card.addEventListener('click', (e) => {
                if (e.target.closest('.world-action-btn')) return;
                playSound(audioCache.get('ui_click.mp3'), 0.4);
                openWorldConfig(world, false, worldsMenu);
            });

            // Copying and editing is now always enabled for shared worlds
            const canCopyOrEdit = true;

            card.querySelector('.edit-world-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                playSound(audioCache.get('ui_click.mp3'), 0.4);
                openWorldConfig(world, true, worldsMenu);
            });

            card.querySelector('.export-world-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                playSound(audioCache.get('ui_confirm.mp3'), 0.4);
                exportWorldToZip(world.name);
            });

            card.querySelector('.delete-world-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                playSound(audioCache.get('ui_click.mp3'), 0.4);
                if (confirm(`Delete world "${name}" and ALL its saves?`)) {
                    SaveSystem.deleteWorld(name);
                    refreshWorldsList();
                }
            });
            worldsList.appendChild(card);
        });
    } else if (activeWorldsTab === 'uploaded') {
        // Uploaded tab
        const myUploaded = sharedWorlds.filter(w => globalCurrentUser && w.username === globalCurrentUser.username);
        
        if (myUploaded.length === 0) {
            worldsList.innerHTML = '<div class="no-saves" style="grid-column: 1/-1; padding: 50px;">You haven\'t shared any worlds to the gallery yet.</div>';
            return;
        }

        myUploaded.forEach(world => {
            const card = document.createElement('div');
            card.className = 'world-card';
            const dateObj = new Date(world.created_at);
            const uploadDate = formatDateForUI(dateObj);
            const exactTime = formatTimeForUI(dateObj);
            const fullDate = `${uploadDate} ${exactTime}`;

            card.innerHTML = `
                <div class="world-card-thumbnail-container">
                    <img src="${world.thumbnailUrl || 'background.jpg'}" class="world-card-thumbnail" alt="${world.name}" crossorigin="anonymous">
                </div>
                <div class="world-card-content">
                    <h4>${world.name}</h4>
                    <div class="creator">ID: ${world.id.substring(0,8)}... • <span class="date-toggle" style="font-size: 0.85em; cursor: pointer; opacity: 0.7;" title="Click for exact time" data-short="${uploadDate}" data-full="${fullDate}">${fullDate}</span></div>
                    <p class="world-desc">${world.prompt}</p>
                    <div class="world-card-footer">
                        <div class="world-meta">
                            <span>Shared Online</span>
                            <span>${world.isAdvanced ? 'Advanced' : 'Simple'}</span>
                        </div>
                        <div class="world-actions">
                            <button class="world-action-btn view-gallery-btn">View in Gallery</button>
                            <button class="world-action-btn delete unshare-btn">×</button>
                        </div>
                    </div>
                </div>
            `;

            card.addEventListener('click', (e) => {
                if (e.target.closest('.world-action-btn')) return;
                openSharedWorldDetails(world);
            });

            card.querySelector('.view-gallery-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                openSharedWorldDetails(world);
            });

            card.querySelector('.unshare-btn').addEventListener('click', async (e) => {
                e.stopPropagation();
                playSound(audioCache.get('ui_click.mp3'), 0.4);
                if (confirm(`Are you sure you want to remove "${world.name}" from the gallery?`)) {
                    try {
                        await room.collection('shared_world_v6').delete(world.id);
                    } catch (err) {
                        console.error("Failed to delete:", err);
                    }
                }
            });

            worldsList.appendChild(card);
        });
    }
}

function openWorldConfig(world, showEdit = true, returnMenu = null) {
    currentWorld = world;
    if (returnMenu) configReturnMenu = returnMenu;
    if (!configReturnMenu) configReturnMenu = worldsMenu;

    worldsMenu.classList.add('hidden');
    onlineWorldsMenu.classList.add('hidden');
    worldConfigMenu.classList.remove('hidden');

    const configSavesView = document.getElementById('config-saves-view');
    const configEditView = document.getElementById('config-edit-view');

    if (showEdit) {
        playBackgroundMusic('faceraiders.mp3');
        configSavesView.classList.add('hidden');
        configEditView.classList.remove('hidden');
        configWorldTitle.textContent = `Edit World: ${world.name}`;
        
        editWorldNameInput.value = world.name;
        editWorldPrompt.value = world.prompt;
        editWorldObjectiveInput.value = world.objective || "";
        editWorldMusicInput.value = ''; // Reset file input
        
        const handColor = world.vrHandColor || '#444444';
        const handColorInput = document.getElementById('edit-world-vr-hand-color');
        const handColorPreview = document.getElementById('edit-hand-color-preview');
        if (handColorInput) handColorInput.value = handColor;
        if (handColorPreview) handColorPreview.style.background = handColor;
        document.querySelectorAll('#edit-hand-color-picker .color-swatch').forEach(s => {
            s.classList.toggle('active', s.dataset.color.toUpperCase() === handColor.toUpperCase());
        });
        
        currentAdvancedDetails = world.rawAdvancedDetails ? [...world.rawAdvancedDetails] : [];
        currentThumbnailUrl = world.thumbnailUrl || null;

        const editThumbPreview = document.getElementById('edit-thumbnail-preview');
        const editThumbContainer = document.getElementById('edit-thumbnail-preview-container');
        if (world.thumbnailUrl) {
            editThumbPreview.src = world.thumbnailUrl;
            editThumbContainer.classList.remove('hidden');
        } else {
            editThumbContainer.classList.add('hidden');
        }
        
        if (world.isAdvanced) {
            editModeAdvancedBtn.click();
        } else {
            editModeSimpleBtn.click();
        }
        
        if (world.musicDataUrl) {
            currentMusicInfo.textContent = "Custom music is set.";
        } else {
            currentMusicInfo.textContent = "No custom music set.";
        }
        updateCategoryCounts();
    } else {
        configSavesView.classList.remove('hidden');
        configEditView.classList.add('hidden');
        configWorldTitle.textContent = `World: ${world.name}`;
        refreshWorldSavesList(world.name);
    }
}

function refreshWorldSavesList(worldName) {
    const saves = SaveSystem.getSavesForWorld(worldName);
    worldSavesList.innerHTML = '';
    
    if (saves.length === 0) {
        worldSavesList.innerHTML = `
            <div class="no-saves-placeholder">
                <div class="placeholder-icon">📂</div>
                <p>No adventure logs found for this world.</p>
                <p style="font-size: 0.8em; opacity: 0.6;">Start a new adventure to begin recording your journey.</p>
            </div>
        `;
    } else {
        // Find the world record once so we can reuse its thumbnail as a fallback
        const worldRecordForThumb = currentWorld || SaveSystem.findWorld(worldName);
        const worldFallbackThumb = (worldRecordForThumb && worldRecordForThumb.thumbnailUrl) ? worldRecordForThumb.thumbnailUrl : 'background.jpg';

        saves.forEach(save => {
            const card = document.createElement('div');
            card.className = 'save-card';
            
            // Priority:
            // 1) If this save had graphic content hidden, show the graphic placeholder.
            // 2) Else use the save's own lastImageSrc if present.
            // 3) Else fall back to the world's thumbnail.
            // 4) Finally fall back to a generic background.
            const thumbnailUrl = save.wasImageHidden
                ? 'graphicpreview.svg'
                : (save.lastImageSrc || worldFallbackThumb || 'background.jpg');
            const dateObj = new Date(save.timestamp);
        const timeStr = `${formatDateForUI(dateObj)} ${formatTimeForUI(dateObj)}`;

            card.innerHTML = `
                <div class="save-card-thumbnail-container">
                    <img src="${thumbnailUrl}" class="save-card-thumbnail" alt="Save perspective" crossorigin="anonymous">
                    <div class="save-card-level-tag">${save.currentLevel || 'Unknown Region'}</div>
                </div>
                <div class="save-card-content">
                    <div class="save-card-header">
                        <h4>${save.saveName || 'Adventure Log'}</h4>
                        <span class="save-card-date">${timeStr}</span>
                    </div>
                    <div class="save-card-stats">
                        <div class="mini-stat">
                            <span class="mini-stat-label">HEALTH</span>
                            <div class="mini-stat-bar-bg">
                                <div class="mini-stat-bar-fill" style="width: ${save.playerStats.health}%; background: ${getStatColor(save.playerStats.health)}"></div>
                            </div>
                            <span class="mini-stat-value">${save.playerStats.health}%</span>
                        </div>
                    </div>
                    <div class="save-card-footer">
                        <button class="save-card-btn load-btn">RESUME</button>
                        <button class="save-card-btn delete-btn" title="Delete Log">×</button>
                    </div>
                </div>
            `;
            
            card.addEventListener('click', (e) => {
                if (e.target.closest('.delete-btn')) return;
                playSound(audioCache.get('ui_click.mp3'), 0.4);
                loadSaveGame(save.id);
            });

            card.querySelector('.delete-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                playSound(audioCache.get('ui_click.mp3'), 0.4);
                if (confirm(`Purge adventure log "${save.saveName || 'Adventure'}"? This cannot be undone.`)) {
                    SaveSystem.deleteSave(save.id);
                    refreshWorldSavesList(worldName);
                }
            });

            worldSavesList.appendChild(card);
        });
    }
}

function loadSaveGame(saveId) {
    const save = SaveSystem.loadGame(saveId);
    if (!save) {
        playSound(audioCache.get('ui_error.mp3'), 0.6);
        return;
    }

    currentSaveId = saveId;
    currentSaveName = save.saveName || "Adventure";
    currentWorld = SaveSystem.findWorld(save.worldName);

    if (currentWorld && currentWorld.musicDataUrl) {
        playBackgroundMusic(currentWorld.musicDataUrl);
    } else {
        stopMusic();
    }

    mainMenu.classList.add('hidden');
    worldsMenu.classList.add('hidden');
    worldConfigMenu.classList.add('hidden');
    gameContainer.classList.remove('hidden');
    document.body.classList.add('game-active'); // NEW: add class to body

    playSound(audioCache.get('ui_confirm.mp3'), 0.5);

    // Ensure system prompt is using the CURRENT world concept, in case it was edited
    const sysPrompt = getSystemPrompt(currentWorld);
    
    // Reset the last non-360 image tracker to whatever the save uses if it's a standard aspect
    // This helps world thumbnails stay non-distorted when loading old saves
    if (save.lastImageSrc && !save.wasImageHidden) {
        lastNon360ImageUrl = save.lastImageSrc;
    }

    conversationHistory = save.conversationHistory || [];
    if (conversationHistory.length > 0) {
        conversationHistory[0] = sysPrompt;
    } else {
        conversationHistory = [sysPrompt];
    }
    inventory = save.inventory || {};
    playerStats = save.playerStats || {
        health: 100,
        hunger: 100,
        thirst: 100
    };
    currentLevel = save.currentLevel || "Starting Region"; // NEW: Load currentLevel

    // NEW: Handle loading of hidden images and restore last scene tracking
    if (save.wasImageHidden && save.lastImageSrc) {
        lastHiddenImageUrl = save.lastImageSrc;
        lastSceneImageUrl = save.lastImageSrc;
        lastSceneWasHidden = true;
        PanoramaViewer.hide();

        if (imageCensoringMode === 'disable') {
            currentSceneImage.src = '';
            currentSceneImage.classList.remove('hidden');
            graphicContentWarning.classList.add('hidden');
            appendOutputContent("This save contains a previously hidden image, but images are disabled in your settings.", 'text', 'status-message');
        } else {
            currentSceneImage.src = 'graphiccontent.svg'; 
            currentSceneImage.classList.remove('hidden');
            if (imageCensoringMode === 'hide') {
                graphicContentWarning.classList.remove('hidden');
            } else {
                graphicContentWarning.classList.add('hidden');
                if (panoramicMode && lastHiddenImageUrl) {
                    PanoramaViewer.init(document.getElementById('panorama-container'));
                    PanoramaViewer.loadTexture(lastHiddenImageUrl);
                } else {
                    currentSceneImage.src = lastHiddenImageUrl;
                }
                lastHiddenImageUrl = ''; 
                lastSceneWasHidden = false;
            }
            appendOutputContent("Last image was graphic content and is currently hidden. Click the warning to view it.", 'text', 'status-message');
        }
    } else {
        lastHiddenImageUrl = '';
        lastSceneImageUrl = save.lastImageSrc || '';
        lastSceneWasHidden = false;

        if (imageCensoringMode === 'disable') {
            currentSceneImage.src = '';
            currentSceneImage.classList.remove('hidden');
            graphicContentWarning.classList.add('hidden');
            PanoramaViewer.hide();
        } else {
            if (panoramicMode && save.lastImageSrc) {
                PanoramaViewer.init(document.getElementById('panorama-container'));
                PanoramaViewer.loadTexture(save.lastImageSrc);
            } else {
                currentSceneImage.src = save.lastImageSrc || '';
                currentSceneImage.classList.remove('hidden');
                PanoramaViewer.hide();
            }
            graphicContentWarning.classList.add('hidden');
        }
    }

    updateInventoryDisplay();
    updateStatsDisplay();

    // Rebuild the visible log without triggering immersive toasts
    suppressToasts = true;
    textOutputDiv.innerHTML = '';
    if (conversationHistory.length > 1) {
        for (let i = 1; i < conversationHistory.length; i++) {
            const entry = conversationHistory[i];
            if (entry.role === 'user') {
                let userActionDisplay;
                if (entry.content.startsWith('[DEBUG_COMMAND] User invoked: "')) {
                    const match = entry.content.match(/\[DEBUG_COMMAND\] User invoked: "(.*?)"/);
                    userActionDisplay = match ? match[1] : 'Debug Command';
                    userActionDisplay = `[DEBUG] ${userActionDisplay}`;
                } else if (entry.content.startsWith('[DEBUG_TELEPORT] Teleport me to Level ')) {
                    const match = entry.content.match(/\[DEBUG_TELEPORT\] Teleport me to Level (.*?)\./);
                    userActionDisplay = match ? `Teleport to Level ${match[1]}` : 'Debug Teleport';
                    userActionDisplay = `[DEBUG] ${userActionDisplay}`;
                } else {
                    const parts = entry.content.split('\nUser Action: ');
                    userActionDisplay = parts.length > 1 ? parts[1] : 'Resumed game action';
                }
                appendOutputContent(`> ${userActionDisplay}`, 'text', 'user-action-text');
            } else if (entry.role === 'assistant') {
                let displayedDescription = "An old game message could not be displayed.";
                try {
                    const parsedContent = JSON.parse(entry.content);
                    if (parsedContent && typeof parsedContent.description === 'string' && parsedContent.description.trim() !== '') {
                        displayedDescription = parsedContent.description;
                    } else {
                        console.log("Parsed assistant message has no valid description:", parsedContent, entry.content);
                        displayedDescription = "An old game message could not be displayed (missing description).";
                    }
                } catch (e) {
                    console.log("Failed to parse assistant message from history on load:", e, entry.content);
                    const textMatch = entry.content.match(/"description"\s*:\s*"(.*?)(?<!\\)"/s);
                    if (textMatch && textMatch[1]) {
                        displayedDescription = textMatch[1].replace(/\\"/g, '"');
                        displayedDescription = displayedDescription.replace(/\\n/g, '\n');
                        displayedDescription += " [Partial data recovered]";
                        console.log("Recovered partial description from malformed JSON.");
                    }
                }
                appendOutputContent(displayedDescription, 'text', 'ai-message');
            }
        }
    } else {
        appendOutputContent("Welcome back. The world awaits your return.", 'text', 'initial-narrative');
        currentSceneImage.src = '';
        lastHiddenImageUrl = '';
    }
    // Re-enable toasts for future live messages
    suppressToasts = false;
    // After loading, ensure game state is consistent and check for win/loss
    checkGameOver(); // Re-check game over state on load
    checkWinCondition(); // NEW: Re-check win condition on load
}



function autoSave() {
    if (currentSaveId && currentWorld) {
        SaveSystem.saveGame(currentSaveId, {
            worldName: currentWorld.name,
            saveName: currentSaveName || currentSaveId.split('_')[0],
            conversationHistory,
            inventory,
            playerStats,
            // Always use the last scene image URL we tracked (works for 360° and normal)
            lastImageSrc: lastSceneImageUrl || '',
            wasImageHidden: !!lastSceneWasHidden,
            currentLevel: currentLevel,
        });
    }
}

window.addEventListener('beforeunload', () => {
    autoSave();
});

// REMOVED: newGameBtn.addEventListener as it's no longer a standalone button

const worldRouletteBtn = document.getElementById('world-roulette-btn');
const rouletteModal = document.getElementById('roulette-modal');
const confirmRouletteBtn = document.getElementById('confirm-roulette-btn');
const cancelRouletteBtn = document.getElementById('cancel-roulette-btn');
const rouletteComplexity = document.getElementById('roulette-filter-complexity');
const rouletteRating = document.getElementById('roulette-filter-rating');

worldRouletteBtn.addEventListener('click', () => {
    playSound(audioCache.get('ui_click.mp3'), 0.4);
    rouletteModal.classList.remove('hidden');
});

cancelRouletteBtn.addEventListener('click', () => {
    playSound(audioCache.get('ui_click.mp3'), 0.2);
    rouletteModal.classList.add('hidden');
});

confirmRouletteBtn.addEventListener('click', () => {
    playSound(audioCache.get('ui_confirm.mp3'), 0.4);
    
    const complexity = rouletteComplexity.value;
    const minRating = parseInt(rouletteRating.value);

    // Calculate ratings first
    const worldRatings = {};
    sharedWorldFeedbacks.forEach(f => {
        if (!worldRatings[f.world_id]) worldRatings[f.world_id] = 0;
        if (f.type === 'like') worldRatings[f.world_id]++;
        if (f.type === 'dislike') worldRatings[f.world_id]--;
    });

    const candidates = sharedWorlds.filter(w => {
        // Exclude shadow realm worlds
        if (shadowRealmIds.includes(w.id)) return false;

        // Complexity filter
        if (complexity === 'simple' && w.isAdvanced) return false;
        if (complexity === 'advanced' && !w.isAdvanced) return false;

        // Rating filter
        const rating = worldRatings[w.id] || 0;
        if (rating < minRating) return false;

        return true;
    });

    if (candidates.length === 0) {
        playSound(audioCache.get('ui_error.mp3'), 0.6);
        alert("No worlds found matching those exact filters. Try broadening your search!");
        return;
    }

    const chosen = candidates[Math.floor(Math.random() * candidates.length)];
    rouletteModal.classList.add('hidden');
    openSharedWorldDetails(chosen);
});

manageWorldsBtn.addEventListener('click', () => {
    playSound(audioCache.get('ui_click.mp3'), 0.4);
    mainMenu.classList.add('hidden');
    worldsMenu.classList.remove('hidden');
    refreshWorldsList();
});

closeWorldsMenuBtn.addEventListener('click', () => {
    playSound(audioCache.get('ui_click.mp3'), 0.4);
    worldsMenu.classList.add('hidden');
    mainMenu.classList.remove('hidden');
});



async function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function updateProgressUI(show, title = "Processing...", status = "", percent = 0) {
    const modal = document.getElementById('progress-modal');
    if (!show) {
        modal.classList.add('hidden');
        return;
    }
    const titleEl = document.getElementById('progress-title');
    const statusEl = document.getElementById('progress-status');
    const barEl = document.getElementById('progress-bar');
    
    titleEl.textContent = title;
    statusEl.textContent = status;
    barEl.style.width = `${Math.min(100, Math.max(0, percent))}%`;
    modal.classList.remove('hidden');
}

async function fetchAsBlob(url, onProgress = null) {
    if (!url) return null;
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Status ${response.status}`);
        
        if (!onProgress) return await response.blob();

        const contentLength = response.headers.get('content-length');
        const total = parseInt(contentLength, 10);
        
        if (isNaN(total)) {
            return await response.blob();
        }

        let loaded = 0;
        const reader = response.body.getReader();
        const chunks = [];
        
        while(true) {
            const {done, value} = await reader.read();
            if (done) break;
            chunks.push(value);
            loaded += value.length;
            onProgress(Math.round((loaded / total) * 100));
        }

        return new Blob(chunks);
    } catch (e) {
        console.warn("Could not fetch asset:", url, e);
        return null;
    }
}

confirmCreateWorldBtn.addEventListener('click', async () => {
    playSound(audioCache.get('ui_click.mp3'), 0.4);
    const name = newWorldNameInput.value.trim();
    const prompt = newWorldPromptInput.value.trim();
    const objective = newWorldObjectiveInput.value.trim();
    const musicFile = newWorldMusicInput.files[0];
    const vrHandColor = document.getElementById('new-world-vr-hand-color').value;

    if (name && prompt) {
        let musicDataUrl = null;
        if (musicFile) {
            try {
                confirmCreateWorldBtn.disabled = true;
                confirmCreateWorldBtn.textContent = "Uploading Music...";
                musicDataUrl = await websim.upload(musicFile);
            } catch (e) {
                console.error("Failed to upload music file:", e);
                alert("Failed to upload music. World created without it.");
            } finally {
                confirmCreateWorldBtn.disabled = false;
                confirmCreateWorldBtn.textContent = "Create";
            }
        }

        let advancedData = { 
            isAdvanced: false, 
            rawAdvancedDetails: [],
            disableHunger: false,
            disableThirst: false
        };
        if (creationMode === 'advanced') {
            const formatData = (type) => currentAdvancedDetails
                .filter(d => d.type === type)
                .map(d => `${d.name}${d.description ? ` (${d.description})` : ''}`)
                .join('\n');

            advancedData = {
                isAdvanced: true,
                rawAdvancedDetails: [...currentAdvancedDetails],
                startingItems: formatData('items'),
                locations: formatData('locations'),
                characters: formatData('characters'),
                rules: formatData('rules'),
                customStats: formatData('stats'),
                disableHunger: !currentAdvancedDetails.some(d => d.type === 'stats' && d.name.toLowerCase() === 'hunger'),
                disableThirst: !currentAdvancedDetails.some(d => d.type === 'stats' && d.name.toLowerCase() === 'thirst')
            };
        }

        const world = SaveSystem.saveWorld(name, prompt, musicDataUrl, { ...advancedData, version: 2, vrHandColor }, null, objective);
        // Thumbnail generates in the background — the create flow must not
        // block on remote image generation (it can take tens of seconds).
        generateAndAssignThumbnail(world.name);
        createWorldMenu.classList.add('hidden');
        openWorldConfig(world, true, worldsMenu); // Show edit fields after creation
    } else {
        alert("Please enter a name and prompt.");
    }
});

function isCreateWorldDirty() {
    return newWorldNameInput.value.trim() !== '' ||
           newWorldPromptInput.value.trim() !== '' ||
           newWorldObjectiveInput.value.trim() !== '' ||
           currentAdvancedDetails.length > 0 ||
           newWorldMusicInput.files.length > 0;
}

cancelCreateWorldBtn.addEventListener('click', () => {
    playSound(audioCache.get('ui_click.mp3'), 0.4);

    if (!isCreateWorldDirty()) {
        playBackgroundMusic('menumusic.mp3');
        createWorldMenu.classList.add('hidden');
        worldsMenu.classList.remove('hidden');
        refreshWorldsList();
        return;
    }

    // User said "X button in the editor", applying same safety to Create screen
    exitEditorModal.classList.remove('hidden');
    
    // Temporarily override modal behavior for "Create" context
    const originalSaveHandler = exitSaveQuitBtn.onclick;
    const originalQuitHandler = exitFinalQuitBtn.onclick;
    const originalCancelHandler = exitCancelBtn.onclick;

    exitSaveQuitBtn.onclick = async () => {
        playSound(audioCache.get('ui_confirm.mp3'), 0.4);
        await confirmCreateWorldBtn.click();
        cleanup();
        closeWorldConfigImmediately();
        createWorldMenu.classList.add('hidden');
    };

    exitFinalQuitBtn.onclick = () => {
        playSound(audioCache.get('ui_lose.mp3'), 0.5);
        cleanup();
        createWorldMenu.classList.add('hidden');
        worldsMenu.classList.remove('hidden');
        exitEditorModal.classList.add('hidden');
        exitReallySureModal.classList.add('hidden');
        playBackgroundMusic('menumusic.mp3');
    };

    exitCancelBtn.onclick = () => {
        playSound(audioCache.get('ui_click.mp3'), 0.4);
        cleanup();
        exitEditorModal.classList.add('hidden');
    };

    function cleanup() {
        exitSaveQuitBtn.onclick = originalSaveHandler;
        exitFinalQuitBtn.onclick = originalQuitHandler;
        exitCancelBtn.onclick = originalCancelHandler;
    }
});

saveWorldConfigBtn.addEventListener('click', async () => {
    playSound(audioCache.get('ui_click.mp3'), 0.4);
    if (currentWorld) {
        const newName = editWorldNameInput.value.trim();
        const newPrompt = editWorldPrompt.value.trim();
        const newObjective = editWorldObjectiveInput.value.trim();
        const musicFile = editWorldMusicInput.files[0];
        const vrHandColor = document.getElementById('edit-world-vr-hand-color').value;

        if (!newName || !newPrompt) {
            alert("Name and Prompt are required.");
            return;
        }
        
        let musicDataUrl = undefined; 
        if (musicFile) {
            try {
                saveWorldConfigBtn.disabled = true;
                saveWorldConfigBtn.textContent = "Uploading Music...";
                musicDataUrl = await websim.upload(musicFile);
            } catch (e) {
                console.error("Failed to upload music file:", e);
                alert("Failed to upload music file. Settings not saved.");
                saveWorldConfigBtn.disabled = false;
                saveWorldConfigBtn.textContent = "Save Changes";
                return;
            } finally {
                saveWorldConfigBtn.disabled = false;
                saveWorldConfigBtn.textContent = "Save Changes";
            }
        }

        let advancedData = { 
            isAdvanced: false, 
            rawAdvancedDetails: [],
            disableHunger: false,
            disableThirst: false
        };
        if (editCreationMode === 'advanced') {
            const formatData = (type) => currentAdvancedDetails
                .filter(d => d.type === type)
                .map(d => `${d.name}${d.description ? ` (${d.description})` : ''}`)
                .join('\n');

            advancedData = {
                isAdvanced: true,
                rawAdvancedDetails: [...currentAdvancedDetails],
                startingItems: formatData('items'),
                locations: formatData('locations'),
                characters: formatData('characters'),
                rules: formatData('rules'),
                customStats: formatData('stats'),
                disableHunger: !currentAdvancedDetails.some(d => d.type === 'stats' && d.name.toLowerCase() === 'hunger'),
                disableThirst: !currentAdvancedDetails.some(d => d.type === 'stats' && d.name.toLowerCase() === 'thirst')
            };
        }

        const oldName = currentWorld.name;
        const updatedWorld = SaveSystem.saveWorld(newName, newPrompt, musicDataUrl, { 
            ...advancedData,
            vrHandColor: vrHandColor,
            thumbnailUrl: currentThumbnailUrl 
        }, oldName, newObjective);
        
        // Auto-generate a thumbnail only if one hasn't been manually set
        if (!updatedWorld.thumbnailUrl) {
            // Background: settings UI must confirm immediately.
            generateAndAssignThumbnail(updatedWorld.name);
        }

        currentWorld = updatedWorld;
        if (currentWorld.musicDataUrl) {
            currentMusicInfo.textContent = "Custom music is set.";
        }
        
        alert("World configuration updated.");
        // Re-open normally to show saves for the (potentially new) name
        openWorldConfig(currentWorld, false, configReturnMenu);
    }
});



newSaveBtn.addEventListener('click', () => {
    playSound(audioCache.get('ui_click.mp3'), 0.4);
    if (currentWorld) {
        const name = prompt("Enter a name for this adventure:", "New Adventure");
        if (name !== null) {
            startNewGame(currentWorld, name.trim() || "New Adventure");
        }
    }
});

const exitEditorModal = document.getElementById('exit-editor-modal');
const exitReallySureModal = document.getElementById('exit-really-sure-modal');
const exitSaveQuitBtn = document.getElementById('exit-save-quit-btn');
const exitQuitNoSaveBtn = document.getElementById('exit-quit-no-save-btn');
const exitCancelBtn = document.getElementById('exit-cancel-btn');
const exitFinalQuitBtn = document.getElementById('exit-final-quit-btn');
const exitFinalCancelBtn = document.getElementById('exit-final-cancel-btn');

function isEditWorldDirty() {
    if (!currentWorld) return false;
    const currentName = editWorldNameInput.value.trim();
    const currentPrompt = editWorldPrompt.value.trim();
    const currentObjective = editWorldObjectiveInput.value.trim();
    const currentHandColor = document.getElementById('edit-world-vr-hand-color').value;
    
    // Deep compare advanced details using JSON stringification
    const originalDetails = currentWorld.rawAdvancedDetails || [];
    const detailsMatch = JSON.stringify(currentAdvancedDetails) === JSON.stringify(originalDetails);
    
    return currentName !== currentWorld.name ||
           currentPrompt !== currentWorld.prompt ||
           currentObjective !== (currentWorld.objective || "") ||
           currentHandColor !== (currentWorld.vrHandColor || '#444444') ||
           !detailsMatch ||
           (editWorldMusicInput.files.length > 0);
}

function closeWorldConfigImmediately() {
    playBackgroundMusic('menumusic.mp3');
    worldConfigMenu.classList.add('hidden');
    exitEditorModal.classList.add('hidden');
    exitReallySureModal.classList.add('hidden');
    
    const returnMenu = configReturnMenu || worldsMenu;
    returnMenu.classList.remove('hidden');
    if (returnMenu === worldsMenu) {
        refreshWorldsList();
    }
}

closeWorldConfigBtn.addEventListener('click', () => {
    playSound(audioCache.get('ui_click.mp3'), 0.4);
    
    const configEditView = document.getElementById('config-edit-view');
    const isEditing = configEditView && !configEditView.classList.contains('hidden');

    if (isEditing && isEditWorldDirty()) {
        exitEditorModal.classList.remove('hidden');
    } else {
        closeWorldConfigImmediately();
    }
});

exitCancelBtn.addEventListener('click', () => {
    playSound(audioCache.get('ui_click.mp3'), 0.4);
    exitEditorModal.classList.add('hidden');
});

exitSaveQuitBtn.addEventListener('click', async () => {
    playSound(audioCache.get('ui_confirm.mp3'), 0.4);
    // Trigger existing save logic
    await saveWorldConfigBtn.click();
    // After save completes (which internally switches to Saves view), fully close
    closeWorldConfigImmediately();
});

exitQuitNoSaveBtn.addEventListener('click', () => {
    playSound(audioCache.get('ui_click.mp3'), 0.4);
    exitReallySureModal.classList.remove('hidden');
});

exitFinalCancelBtn.addEventListener('click', () => {
    playSound(audioCache.get('ui_click.mp3'), 0.4);
    exitReallySureModal.classList.add('hidden');
});

exitFinalQuitBtn.addEventListener('click', () => {
    playSound(audioCache.get('ui_lose.mp3'), 0.5);
    closeWorldConfigImmediately();
});

// REMOVED: startNamedGameBtn and cancelNewGameBtn listeners here, as they are now handled dynamically within loadGameMenu


// --- ONLINE FEATURES IMPLEMENTATION ---

let sharedWorlds = [];
let sharedWorldFeedbacks = [];
let sharedWorldPlays = [];
let sharedWorldVictories = []; // NEW: Track world victories
let shadowRealmIds = []; // Track banished world IDs
let featuredWorldMap = new Map(); // Track featured world IDs and their feature dates for sorting
let featuredWorldIds = []; // Track featured world IDs
let showShadowThumbnails = false; // Toggle for shadow realm thumbnails
let currentViewingSharedWorld = null;
const onlineSortSelect = document.getElementById('online-sort');
const onlineOrderSelect = document.getElementById('online-order');

browseOnlineBtn.addEventListener('click', async () => {
    playSound(audioCache.get('ui_click.mp3'), 0.4);
    showFeaturedOnly = false;
    mainMenu.classList.add('hidden');
    onlineWorldsMenu.classList.remove('hidden');
    if (!globalCurrentUser) globalCurrentUser = await websim.getCurrentUser();
    fetchSharedWorlds();
});

featuredWorldsBtn.addEventListener('click', async () => {
    playSound(audioCache.get('ui_confirm.mp3'), 0.4);
    showFeaturedOnly = true;
    mainMenu.classList.add('hidden');
    onlineWorldsMenu.classList.remove('hidden');
    if (!globalCurrentUser) globalCurrentUser = await websim.getCurrentUser();
    fetchSharedWorlds();
});

closeOnlineMenuBtn.addEventListener('click', () => {
    playSound(audioCache.get('ui_click.mp3'), 0.4);
    onlineWorldsMenu.classList.add('hidden');
    mainMenu.classList.remove('hidden');
});

onlineSearchInput.addEventListener('input', () => {
    renderSharedWorlds();
});

async function fetchSharedWorlds() {
    onlineWorldsList.innerHTML = '<p class="loading">Loading worlds...</p>';
    try {
        // If sharedWorlds is already populated, render immediately
        if (sharedWorlds && sharedWorlds.length > 0) {
            renderSharedWorlds();
        } else {
            // Otherwise, it will be handled by the collection subscription
            console.log("Waiting for gallery sync...");
        }
    } catch (error) {
        console.error("Error fetching shared worlds:", error);
        onlineWorldsList.innerHTML = '<p class="error-message">Failed to load online gallery.</p>';
    }
}

function renderSharedWorlds() {
    const filter = onlineSearchInput.value.toLowerCase();
    const sortBy = onlineSortSelect.value;
    const order = onlineOrderSelect.value;
    const imgFilter = document.getElementById('filter-image').value;
    const complexityFilter = document.getElementById('filter-complexity').value;
    const minWords = parseInt(filterWordsMinInput.value) || 0;
    let maxWords = parseInt(filterWordsMaxInput.value);
    if (isNaN(maxWords) || maxWords <= 0) maxWords = Infinity;

    onlineWorldsList.innerHTML = '';

    // NEW: Hide sort controls if in featured mode
    const sortControls = document.querySelector('.sort-controls');
    if (sortControls) sortControls.style.display = showFeaturedOnly ? 'none' : 'flex';
    
    let filtered = sharedWorlds.filter(w => {
        const matchesFilter = w.name.toLowerCase().includes(filter) || 
                             w.username.toLowerCase().includes(filter) ||
                             w.id.toLowerCase().includes(filter);
        const isBanished = shadowRealmIds.includes(w.id);
        const isFeatured = featuredWorldIds.includes(w.id);
        
        if (showFeaturedOnly && !isFeatured) return false;
        if (isBanished) return false;
        if (!matchesFilter) return false;

        // New Filters
        if (imgFilter === 'has' && !w.thumbnailUrl) return false;
        if (imgFilter === 'none' && w.thumbnailUrl) return false;

        if (complexityFilter === 'simple' && w.isAdvanced) return false;
        if (complexityFilter === 'advanced' && !w.isAdvanced) return false;

        const wordCount = (w.prompt || "").trim().split(/\s+/).filter(Boolean).length;
        if (wordCount < minWords) return false;
        if (wordCount > maxWords) return false;

        return true;
    });

    // Calculate rating for each world
    const worldRatings = {};
    sharedWorldFeedbacks.forEach(f => {
        if (!worldRatings[f.world_id]) worldRatings[f.world_id] = 0;
        if (f.type === 'like') worldRatings[f.world_id]++;
        if (f.type === 'dislike') worldRatings[f.world_id]--;
    });

    // Sort Logic
    if (showFeaturedOnly) {
        // Featured worlds always sort by the time they were featured (newest first)
        filtered.sort((a, b) => (featuredWorldMap.get(b.id) || 0) - (featuredWorldMap.get(a.id) || 0));
    } else {
        const playCounts = {};
        if (sortBy === 'plays') {
            sharedWorldPlays.forEach(p => {
                playCounts[p.world_id] = (playCounts[p.world_id] || 0) + 1;
            });
        }

        filtered.sort((a, b) => {
            let valA, valB;
            if (sortBy === 'date') {
                valA = new Date(a.created_at).getTime();
                valB = new Date(b.created_at).getTime();
            } else if (sortBy === 'rating') {
                valA = worldRatings[a.id] || 0;
                valB = worldRatings[b.id] || 0;
            } else if (sortBy === 'plays') {
                valA = playCounts[a.id] || 0;
                valB = playCounts[b.id] || 0;
            } else if (sortBy === 'name') {
                valA = a.name.toLowerCase();
                valB = b.name.toLowerCase();
            }

            if (valA < valB) return order === 'asc' ? -1 : 1;
            if (valA > valB) return order === 'asc' ? 1 : -1;
            return 0;
        });
    }

    if (filtered.length === 0) {
        onlineWorldsList.innerHTML = '<p class="no-saves">No worlds found.</p>';
        return;
    }

    filtered.forEach(world => {
        const card = document.createElement('div');
        card.className = 'shared-world-card';
        
        let thumbnailHTML = '';
        if (world.thumbnailUrl) {
            thumbnailHTML = `<img src="${world.thumbnailUrl}" class="shared-world-thumbnail" alt="${world.name} thumbnail" crossorigin="anonymous">`;
        }

        const likes = worldRatings[world.id] || 0;
        const plays = sharedWorldPlays.filter(p => p.world_id === world.id).length;
        const isOwner = globalCurrentUser && world.username === globalCurrentUser.username;
        const isAdmin = globalCurrentUser && (globalCurrentUser.username === 'Speedymule6858' || globalCurrentUser.username === projectCreatorUsername);
        
        const dateObj = new Date(world.created_at);
        const uploadDate = formatDateForUI(dateObj);
        const exactTime = formatTimeForUI(dateObj);
        const fullDate = `${uploadDate} ${exactTime}`;

        const isFeatured = featuredWorldIds.includes(world.id);

        card.innerHTML = `
            ${thumbnailHTML}
            <h4>${world.name} ${isFeatured ? '💎' : ''}</h4>
            <div class="creator">by <span class="user-link" data-username="${world.username}">${world.username}</span> • <span class="date-toggle" style="font-size: 0.85em; opacity: 0.7; cursor: pointer;" title="Click for exact time" data-short="${uploadDate}" data-full="${fullDate}">${uploadDate}</span></div>
            <div class="stats">
                <span>Rating: ${likes > 0 ? '+' : ''}${likes}</span>
                <span>Plays: ${plays.toLocaleString()}</span>
                <span style="font-size: 0.8em; opacity: 0.6; font-family: monospace;">ID: ${world.id.substring(0, 8)}...</span>
            </div>
            ${isOwner ? '<button class="delete-gallery-btn">Unupload</button>' : ''}
        `;

        card.addEventListener('click', (e) => {
            if (e.target.classList.contains('delete-gallery-btn')) return;
            openSharedWorldDetails(world);
        });

        if (isOwner) {
            const delBtn = card.querySelector('.delete-gallery-btn');
            delBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (confirm(`Are you sure you want to remove "${world.name}" from the gallery?`)) {
                    playSound(audioCache.get('ui_lose.mp3'), 0.4);
                    try {
                        await room.collection('shared_world_v6').delete(world.id);
                    } catch (err) {
                        console.error("Failed to delete from gallery:", err);
                    }
                }
            });
        }



        onlineWorldsList.appendChild(card);
    });
}

function renderShadowWorlds() {
    shadowWorldsList.innerHTML = '';
    const banished = sharedWorlds.filter(w => shadowRealmIds.includes(w.id));

    if (banished.length === 0) {
        shadowWorldsList.innerHTML = '<p class="no-saves">The Shadow Realm is currently empty.</p>';
        return;
    }

    banished.forEach(world => {
        const card = document.createElement('div');
        card.className = 'shared-world-card';
        card.style.borderColor = '#ff4d4d';
        
        let thumbnailHTML = '';
        if (showShadowThumbnails && world.thumbnailUrl) {
            thumbnailHTML = `<img src="${world.thumbnailUrl}" class="shared-world-thumbnail" style="filter: grayscale(1) contrast(1.2) brightness(0.8);" alt="${world.name} thumbnail" crossorigin="anonymous">`;
        } else {
            thumbnailHTML = `<div class="shared-world-thumbnail" style="background: repeating-linear-gradient(45deg, #1a0000, #1a0000 10px, #2a0000 10px, #2a0000 20px); border: 1px solid #400; display: flex; align-items: center; justify-content: center; color: #500; font-size: 3em;">🚫</div>`;
        }

        card.innerHTML = `
            ${thumbnailHTML}
            <h4 style="color: #ff4d4d;">${world.name}</h4>
            <div class="creator">by ${world.username} (Banished)</div>
            <div class="world-actions" style="margin-top: 10px; gap: 8px;">
                <button class="view-shadow-details-btn world-action-btn" style="flex-grow: 1;">View & Play</button>
                <button class="restore-gallery-btn world-action-btn" style="background: #00c853;">Restore</button>
            </div>
        `;

        card.addEventListener('click', (e) => {
            if (e.target.closest('.world-action-btn')) return;
            openSharedWorldDetails(world);
        });

        card.querySelector('.view-shadow-details-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            openSharedWorldDetails(world);
        });

        card.querySelector('.restore-gallery-btn').addEventListener('click', async (e) => {
            e.stopPropagation();
            if (confirm(`Restore "${world.name}" to the public gallery?`)) {
                playSound(audioCache.get('ui_confirm.mp3'), 0.4);
                try {
                    const record = (await room.collection('shadow_realm_v1').filter({ world_id: world.id }).getList())[0];
                    if (record) {
                        await room.collection('shadow_realm_v1').delete(record.id);
                    }
                } catch (err) {
                    console.error("Failed to restore:", err);
                }
            }
        });

        shadowWorldsList.appendChild(card);
    });
}

onlineSortSelect.addEventListener('change', () => {
    playSound(audioCache.get('ui_click.mp3'), 0.4);
    renderSharedWorlds();
});

onlineOrderSelect.addEventListener('change', () => {
    playSound(audioCache.get('ui_click.mp3'), 0.4);
    renderSharedWorlds();
});

['filter-image', 'filter-complexity'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
        el.addEventListener('change', () => {
            playSound(audioCache.get('ui_click.mp3'), 0.2);
            renderSharedWorlds();
        });
    }
});

reportWorldBtn.addEventListener('click', async () => {
    if (!currentViewingSharedWorld) return;
    const reason = prompt(`Why are you reporting "${currentViewingSharedWorld.name}"?`, "");
    if (reason === null) return;
    if (!reason.trim()) {
        alert("Please provide a reason for the report.");
        return;
    }

    playSound(audioCache.get('ui_lose.mp3'), 0.4);
    try {
        await room.collection('world_report_v1').create({
            world_id: currentViewingSharedWorld.id,
            world_name: currentViewingSharedWorld.name,
            reason: reason.trim(),
            reported_username: currentViewingSharedWorld.username
        });
        alert("Report submitted successfully. Thank you for keeping the community safe.");
    } catch (err) {
        console.error("Report failed:", err);
        alert("Failed to submit report.");
    }
});

async function openSharedWorldDetails(world) {
    playSound(audioCache.get('ui_click.mp3'), 0.4);
    currentViewingSharedWorld = world;
    onlineWorldDetails.classList.remove('hidden');

    onlineDetailName.textContent = world.name + (featuredWorldIds.includes(world.id) ? ' 💎' : '');
    const dateObj = new Date(world.created_at);
    const uploadDate = dateObj.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    const exactTime = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const fullDate = `${uploadDate} ${exactTime}`;

    onlineDetailCreator.innerHTML = `By: <span class="user-link" data-username="${world.username}">${world.username}</span> • <span class="date-toggle" style="cursor: pointer;" title="Click for exact time" data-short="${uploadDate}" data-full="${fullDate}">${fullDate}</span>`;
    onlineDetailPrompt.textContent = world.prompt;

    const isAdmin = globalCurrentUser && (globalCurrentUser.username === 'Speedymule6858' || globalCurrentUser.username === projectCreatorUsername);
    if (isAdmin) {
        modBanishBtn.classList.remove('hidden');
        modFeatureBtn.classList.remove('hidden');
        modFeatureBtn.textContent = featuredWorldIds.includes(world.id) ? 'Unfeature' : 'Feature';
    } else {
        modBanishBtn.classList.add('hidden');
        modFeatureBtn.classList.add('hidden');
    }

    const detailThumb = document.getElementById('online-detail-thumbnail');
    if (world.thumbnailUrl) {
        detailThumb.src = world.thumbnailUrl;
        detailThumb.style.display = 'block';
    } else {
        detailThumb.style.display = 'none';
    }
    
    // Ensure user is loaded for feedback logic
    if (!globalCurrentUser) globalCurrentUser = await websim.getCurrentUser();
    
    // Load feedback and comments
    updateFeedbackStats(world.id);
    loadComments(world.id);
}

modBanishBtn.addEventListener('click', async () => {
    if (!currentViewingSharedWorld) return;
    if (confirm(`Banish "${currentViewingSharedWorld.name}" to the Shadow Realm? It will be hidden from all users.`)) {
        playSound(audioCache.get('ui_lose.mp3'), 0.6);
        try {
            await room.collection('shadow_realm_v1').create({ world_id: currentViewingSharedWorld.id });
            onlineWorldDetails.classList.add('hidden');
        } catch (err) {
            console.error("Failed to banish:", err);
        }
    }
});

modFeatureBtn.addEventListener('click', async () => {
    if (!currentViewingSharedWorld) return;
    const isFeatured = featuredWorldIds.includes(currentViewingSharedWorld.id);
    playSound(audioCache.get('ui_click.mp3'), 0.4);
    try {
        if (isFeatured) {
            const records = await room.collection('featured_world_v1').filter({ world_id: currentViewingSharedWorld.id }).getList();
            for (const r of records) {
                await room.collection('featured_world_v1').delete(r.id);
            }
        } else {
            await room.collection('featured_world_v1').create({ world_id: currentViewingSharedWorld.id });
        }
        modFeatureBtn.textContent = isFeatured ? 'Feature' : 'Unfeature';
        onlineDetailName.textContent = currentViewingSharedWorld.name + (!isFeatured ? ' 💎' : '');
    } catch (err) {
        console.error("Failed to toggle feature status:", err);
    }
});

function updateFeedbackStats(worldId) {
    if (!sharedWorldFeedbacks) return;
    
    const feedbacks = sharedWorldFeedbacks.filter(f => f.world_id === worldId);
    const likes = feedbacks.filter(f => f.type === 'like').length;
    const dislikes = feedbacks.filter(f => f.type === 'dislike').length;
    
    likeCountSpan.textContent = likes;
    dislikeCountSpan.textContent = dislikes;

    const playCount = sharedWorldPlays.filter(p => p.world_id === worldId).length;
    const playsEl = document.getElementById('online-detail-plays');
    if (playsEl) playsEl.textContent = `PLAYS: ${playCount.toLocaleString()}`;
    
    if (globalCurrentUser) {
        const myFeedback = feedbacks.find(f => f.username === globalCurrentUser.username);
        likeBtn.classList.toggle('active', myFeedback?.type === 'like');
        dislikeBtn.classList.toggle('active', myFeedback?.type === 'dislike');
    }
}

async function loadComments(worldId) {
    commentsList.innerHTML = '<div class="loading" style="padding: 20px; text-align: center;">Retrieving data feeds...</div>';
    room.collection('world_comment').filter({ world_id: worldId }).subscribe(comments => {
        commentsList.innerHTML = '';
        // Websim returns newest first. We'll display newest first for high engagement.
        comments.forEach(c => {
            if (c.text.toLowerCase().includes('websim.com')) return;
            const div = document.createElement('div');
            div.className = 'comment-item-modern';
            div.innerHTML = `
                <span class="comment-user-modern user-link" data-username="${c.username}">${c.username}</span>
                <div class="comment-text-modern">${c.text}</div>
            `;
            commentsList.appendChild(div);
        });
        if (comments.length === 0) {
            commentsList.innerHTML = '<div class="no-saves" style="padding: 40px; text-align: center;">No feedback data received.</div>';
        }
    });
}

likeBtn.addEventListener('click', () => handleFeedback('like'));
dislikeBtn.addEventListener('click', () => handleFeedback('dislike'));

async function handleFeedback(type) {
    if (!currentViewingSharedWorld || !globalCurrentUser) return;
    playSound(audioCache.get('ui_click.mp3'), 0.4);
    
    const worldId = currentViewingSharedWorld.id;
    // Use the cached sharedWorldFeedbacks for checking existing votes
    const feedbacks = sharedWorldFeedbacks.filter(f => f.world_id === worldId);
    const myFeedback = feedbacks.find(f => f.username === globalCurrentUser.username);
    
    if (myFeedback) {
        if (myFeedback.type === type) {
            await room.collection('world_feedback').delete(myFeedback.id);
        } else {
            await room.collection('world_feedback').update(myFeedback.id, { type });
        }
    } else {
        await room.collection('world_feedback').create({ world_id: worldId, type });
    }
    // Logic updated; global subscription will trigger UI refresh via updateFeedbackStats
}

postCommentBtn.addEventListener('click', async () => {
    const text = newCommentInput.value.trim();
    if (!text || !currentViewingSharedWorld) return;

    if (text.toLowerCase().includes('websim.com')) {
        alert("Self-promotion links are not allowed in comments.");
        return;
    }
    
    playSound(audioCache.get('ui_confirm.mp3'), 0.4);
    await room.collection('world_comment').create({
        world_id: currentViewingSharedWorld.id,
        text: text
    });
    newCommentInput.value = '';
});

playSharedWorldBtn.addEventListener('click', async () => {
    if (!currentViewingSharedWorld) return;
    playSound(audioCache.get('ui_confirm.mp3'), 0.4);
    
    const world = currentViewingSharedWorld;
    
    onlineWorldDetails.classList.add('hidden');
    onlineWorldsMenu.classList.add('hidden');
    
    // Register a play count
    try {
        room.collection('world_play_v1').create({ world_id: world.id });
    } catch (e) {
        console.warn("Failed to register play count:", e);
    }

    let worldToOpen = null;
    
    if (world.zipUrl) {
        try {
            updateProgressUI(true, "Downloading World", "Connecting to gallery...", 0);
            const blob = await fetchAsBlob(world.zipUrl, (p) => {
                updateProgressUI(true, "Downloading World", `Receiving data... ${p}%`, p * 0.8); // 80% for download
            });
            worldToOpen = await handleImportZip(blob, true, world);
        } catch (e) {
            console.error("Failed to download and unpack shared world:", e);
            alert("Could not load world package from gallery.");
        } finally {
            updateProgressUI(false);
        }
    } else {
        // Fallback for legacy v5 entries
        const localWorlds = SaveSystem.getWorlds();
        worldToOpen = localWorlds[world.name];
        if (!worldToOpen) {
            worldToOpen = SaveSystem.saveWorld(world.name, world.prompt, world.musicDataUrl, {
                isAdvanced: world.isAdvanced,
                rawAdvancedDetails: world.rawAdvancedDetails,
                startingItems: world.startingItems,
                locations: world.locations,
                characters: world.characters,
                rules: world.rules,
                thumbnailUrl: world.thumbnailUrl
            });
        }
    }

    if (worldToOpen) {
        openWorldConfig(worldToOpen, false, onlineWorldsMenu);
    }
});



closeOnlineDetailsBtn.addEventListener('click', () => {
    playSound(audioCache.get('ui_click.mp3'), 0.4);
    onlineWorldDetails.classList.add('hidden');
});

copyWorldIdBtn.addEventListener('click', () => {
    if (!currentViewingSharedWorld) return;
    playSound(audioCache.get('ui_click.mp3'), 0.4);
    navigator.clipboard.writeText(currentViewingSharedWorld.id).then(() => {
        const originalText = copyWorldIdBtn.textContent;
        copyWorldIdBtn.textContent = "Copied!";
        copyWorldIdBtn.style.color = "#00f3ff";
        setTimeout(() => {
            copyWorldIdBtn.textContent = originalText;
            copyWorldIdBtn.style.color = "";
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy ID: ', err);
    });
});

/* New Share Modal Elements (thumbnail input moved to World Config edit page) */
const shareOnlineModal = document.getElementById('share-online-modal');
const worldThumbnailInput = document.getElementById('world-thumbnail-input'); // moved input reference
const aiGenThumbnailBtn = document.getElementById('ai-gen-thumbnail-btn');
const thumbnailLoadingOverlay = document.getElementById('thumbnail-loading-overlay');
const shareThumbnailPreview = document.getElementById('share-thumbnail-preview');
const shareThumbnailPreviewContainer = document.getElementById('share-thumbnail-preview-container');
const shareIncludeSaves = document.getElementById('share-include-saves');
const confirmShareBtn = document.getElementById('confirm-share-btn');
const cancelShareBtn = document.getElementById('cancel-share-btn');
const unshareWorldBtn = document.getElementById('unshare-world-btn');

let existingShareRecord = null;
let currentThumbnailUrl = null;

async function prepareThumbnailUpload(file) {
    const maxUploadSize = 1.5 * 1024 * 1024;
    if (file.size <= maxUploadSize) return file;

    if (!file.type.startsWith('image/')) {
        throw new Error("Choose an image file.");
    }

    let bitmap;
    try {
        bitmap = await createImageBitmap(file);
    } catch {
        throw new Error("This image format can't be resized in your browser. Try a JPG or PNG.");
    }

    try {
        const maxDimension = 1600;
        const initialScale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
        let width = Math.max(1, Math.round(bitmap.width * initialScale));
        let height = Math.max(1, Math.round(bitmap.height * initialScale));

        for (let sizePass = 0; sizePass < 5; sizePass++) {
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const context = canvas.getContext('2d');
            context.fillStyle = '#fff';
            context.fillRect(0, 0, width, height);
            context.drawImage(bitmap, 0, 0, width, height);

            for (const quality of [0.86, 0.76, 0.66]) {
                const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
                if (!blob) throw new Error("The image couldn't be resized.");
                if (blob.size <= maxUploadSize || (sizePass === 4 && quality === 0.66)) {
                    const baseName = file.name.replace(/\.[^.]+$/, '') || 'thumbnail';
                    return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' });
                }
            }

            width = Math.max(1, Math.round(width * 0.75));
            height = Math.max(1, Math.round(height * 0.75));
        }
    } finally {
        bitmap.close();
    }
}

shareWorldBtn.addEventListener('click', async () => {
    if (!currentWorld) return;
    playSound(audioCache.get('ui_click.mp3'), 0.4);
    
    // Check if already shared
    const currentUser = await websim.getCurrentUser();
    
    // Priority 1: Check by stored onlineId for accurate updates even after renames
    existingShareRecord = currentWorld.onlineId ? sharedWorlds.find(w => w.id === currentWorld.onlineId) : null;
    
    // Priority 2: Fallback to name/username match (for legacy worlds shared before this persistent ID update)
    if (!existingShareRecord) {
        existingShareRecord = sharedWorlds.find(w => w.name === currentWorld.name && w.username === currentUser.username);
        // If found via fallback, link the ID now so future updates are precise
        if (existingShareRecord) {
            currentWorld.onlineId = existingShareRecord.id;
            SaveSystem.saveWorld(currentWorld.name, currentWorld.prompt, currentWorld.musicDataUrl, currentWorld, currentWorld.name, currentWorld.objective || "");
        }
    }

    // Setup modal
    // Reset preview values; thumbnail file UI is now in World Config so clear the file input there
    if (worldThumbnailInput) worldThumbnailInput.value = '';
    shareThumbnailPreview.src = existingShareRecord?.thumbnailUrl || '';
    shareThumbnailPreviewContainer.classList.toggle('hidden', !existingShareRecord?.thumbnailUrl);
    shareIncludeSaves.checked = false; // Default to false for privacy
    
    // Prioritize existing gallery thumbnail, then the local world thumbnail you just set
    currentThumbnailUrl = existingShareRecord?.thumbnailUrl || currentWorld.thumbnailUrl || null;
    
    if (currentThumbnailUrl) {
        shareThumbnailPreview.src = currentThumbnailUrl;
        shareThumbnailPreviewContainer.classList.remove('hidden');
    }

    confirmShareBtn.textContent = existingShareRecord ? "Update Gallery Entry" : "Upload to Gallery";
    unshareWorldBtn.classList.toggle('hidden', !existingShareRecord);
    
    shareOnlineModal.classList.remove('hidden');
});

if (worldThumbnailInput) {
    worldThumbnailInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
            playSound(audioCache.get('ui_click.mp3'), 0.4);
            try {
                const uploadFile = await prepareThumbnailUpload(file);
                const url = await websim.upload(uploadFile);
                currentThumbnailUrl = url;
                
                // Update Config Preview
                const editThumbPreview = document.getElementById('edit-thumbnail-preview');
                const editThumbContainer = document.getElementById('edit-thumbnail-preview-container');
                if (editThumbPreview) editThumbPreview.src = url;
                if (editThumbContainer) editThumbContainer.classList.remove('hidden');

                // Update Share Modal Preview (if open or for future opening)
                shareThumbnailPreview.src = url;
                shareThumbnailPreviewContainer.classList.remove('hidden');
            } catch (error) {
                console.error("Thumbnail upload failed:", error);
                const reason = error instanceof Error && error.message
                    ? `\n\n${error.message}`
                    : "";
                alert(`Failed to upload thumbnail.${reason}`);
            }
        }
    });
}

if (aiGenThumbnailBtn) {
    aiGenThumbnailBtn.addEventListener('click', async () => {
        if (!currentWorld) return;
        playSound(audioCache.get('ui_click.mp3'), 0.4);
        
        aiGenThumbnailBtn.disabled = true;
        if (thumbnailLoadingOverlay) thumbnailLoadingOverlay.classList.remove('hidden');
        if (shareThumbnailPreviewContainer) shareThumbnailPreviewContainer.classList.remove('hidden');
        
        try {
            const result = await websim.imageGen({
                prompt: `A beautiful, atmospheric thumbnail image for a world called "${currentWorld.name}". Theme: ${currentWorld.prompt}. Cinematic lighting, evocative artistic style.`,
                aspect_ratio: "16:9"
            });
            
            currentThumbnailUrl = result.url;
            if (shareThumbnailPreview) shareThumbnailPreview.src = result.url;
            playSound(audioCache.get('ui_confirm.mp3'), 0.4);
        } catch (error) {
            console.error("AI Thumbnail generation failed:", error);
            alert("Failed to generate AI thumbnail.");
        } finally {
            aiGenThumbnailBtn.disabled = false;
            if (thumbnailLoadingOverlay) thumbnailLoadingOverlay.classList.add('hidden');
        }
    });
} else {
    console.warn("aiGenThumbnailBtn not found in DOM; AI thumbnail button disabled.");
}

confirmShareBtn.addEventListener('click', async () => {
    if (!currentWorld) return;
    
    if (!confirm("Are you sure you want to share this world package to the public gallery?")) return;
    
    playSound(audioCache.get('ui_confirm.mp3'), 0.5);
    confirmShareBtn.disabled = true;
    confirmShareBtn.textContent = "Uploading...";

    try {
        // If no thumbnail provided, generate one via AI before uploading
        if (!currentThumbnailUrl) {
            try {
                if (thumbnailLoadingOverlay) thumbnailLoadingOverlay.classList.remove('hidden');
                confirmShareBtn.textContent = "Generating thumbnail...";
                const genResult = await websim.imageGen({
                    prompt: `A cinematic, atmospheric thumbnail for a world called "${currentWorld.name}". Theme: ${currentWorld.prompt}. Evocative, high-contrast, polished art style suitable for a gallery thumbnail.`,
                    aspect_ratio: "16:9"
                });
                currentThumbnailUrl = genResult.url;
                if (shareThumbnailPreview) {
                    shareThumbnailPreview.src = currentThumbnailUrl;
                    shareThumbnailPreviewContainer.classList.remove('hidden');
                }
                playSound(audioCache.get('ui_confirm.mp3'), 0.35);
            } catch (genErr) {
                console.warn("AI thumbnail generation failed, continuing without thumbnail:", genErr);
            } finally {
                if (thumbnailLoadingOverlay) thumbnailLoadingOverlay.classList.add('hidden');
            }
        }

        confirmShareBtn.textContent = "Packaging world...";
        const includeSaves = shareIncludeSaves.checked;
        const zipBlob = await exportWorldToZip(currentWorld.name, true, includeSaves);
        
        // Sanitize filename for upload to prevent S3/backend errors with special characters in world names
        const safeFileName = `${currentWorld.name.replace(/[^a-z0-9]/gi, '_') || 'world'}.aiworld`;
        const zipUrl = await websim.upload(new File([zipBlob], safeFileName, { type: 'application/zip' }));

        const worldData = {
            name: currentWorld.name,
            prompt: currentWorld.prompt,
            musicDataUrl: currentWorld.musicDataUrl,
            isAdvanced: currentWorld.isAdvanced || false,
            rawAdvancedDetails: currentWorld.rawAdvancedDetails || [],
            startingItems: currentWorld.startingItems || "",
            locations: currentWorld.locations || "",
            characters: currentWorld.characters || "",
            rules: currentWorld.rules || "",
            allowCopy: true,
            thumbnailUrl: currentThumbnailUrl,
            zipUrl: zipUrl
        };

        if (existingShareRecord) {
            await room.collection('shared_world_v6').update(existingShareRecord.id, worldData);
            // Ensure local world is linked to this ID
            if (currentWorld.onlineId !== existingShareRecord.id) {
                currentWorld.onlineId = existingShareRecord.id;
                SaveSystem.saveWorld(currentWorld.name, currentWorld.prompt, currentWorld.musicDataUrl, currentWorld, currentWorld.name, currentWorld.objective || "");
            }
            alert("Gallery entry updated!");
        } else {
            const newRecord = await room.collection('shared_world_v6').create(worldData);
            // Save the new online ID locally to prevent future duplicates
            currentWorld.onlineId = newRecord.id;
            SaveSystem.saveWorld(currentWorld.name, currentWorld.prompt, currentWorld.musicDataUrl, currentWorld, currentWorld.name, currentWorld.objective || "");
            alert("World published to Online Gallery!");
        }
        shareOnlineModal.classList.add('hidden');
    } catch (e) {
        console.error("Sharing failed:", e);
        alert("Failed to share world.");
    } finally {
        confirmShareBtn.disabled = false;
        confirmShareBtn.textContent = existingShareRecord ? "Update Gallery Entry" : "Upload to Gallery";
    }
});

unshareWorldBtn.addEventListener('click', async () => {
    if (!existingShareRecord) return;
    if (!confirm("Unupload this world? It will be removed from the Online Gallery for everyone.")) return;
    
    playSound(audioCache.get('ui_lose.mp3'), 0.4);
    try {
        await room.collection('shared_world_v6').delete(existingShareRecord.id);
        alert("World removed from Online Gallery.");
        shareOnlineModal.classList.add('hidden');
    } catch (e) {
        console.error("Unsharing failed:", e);
        alert("Failed to remove world from gallery.");
    }
});

cancelShareBtn.addEventListener('click', () => {
    playSound(audioCache.get('ui_click.mp3'), 0.4);
    shareOnlineModal.classList.add('hidden');
});

// NEW: Event listener for the "Main Menu" button in game
returnToMenuBtn.addEventListener('click', () => {
    playSound(audioCache.get('ui_click.mp3'), 0.4);
    if (confirm("Are you sure you want to return to the main menu? Your current progress will be saved.")) {
        autoSave();
        stopMusic();
        if (musicVolume > 0) {
            playBackgroundMusic('menumusic.mp3');
        }
        gameContainer.classList.add('hidden');
        mainMenu.classList.remove('hidden');
        document.body.classList.remove('game-active'); // NEW: remove class from body

        // Ensure image warning is hidden when returning to main menu
        graphicContentWarning.classList.add('hidden');
        lastHiddenImageUrl = '';
        currentSceneImage.src = ''; // Clear game image
        PanoramaViewer.hide();
        displayRandomMenuBackground(); // NEW: Change menu background when returning to menu
    }
});

async function exportWorldToZip(worldName, returnBlob = false, includeSaves = true) {
    try {
        const world = SaveSystem.findWorld(worldName);
        if (!world) return;

        updateProgressUI(true, "Exporting World", "Gathering assets...", 5);
        const zip = new JSZip();
        const assetsFolder = zip.folder("assets");
        
        // Add music if exists
        if (world.musicDataUrl) {
            const musicBlob = await fetchAsBlob(world.musicDataUrl);
            if (musicBlob) assetsFolder.file("music.mp3", musicBlob);
        }
        updateProgressUI(true, "Exporting World", "Preparing configuration...", 15);

        // Add world thumbnail if exists
        if (world.thumbnailUrl) {
            const thumbBlob = await fetchAsBlob(world.thumbnailUrl);
            if (thumbBlob) assetsFolder.file("thumbnail.png", thumbBlob);
        }
        
        // World configuration
        zip.file("world.json", JSON.stringify(world, null, 2));

        // Get all saves for this world
        if (includeSaves) {
            const worldSaves = SaveSystem.getSavesForWorld(worldName);
            if (worldSaves.length > 0) {
                const savesFolder = zip.folder("saves");
                const saveImagesFolder = zip.folder("save_images");
                
                let saveCount = 0;
                for (const save of worldSaves) {
                    saveCount++;
                    const prog = 15 + ((saveCount / worldSaves.length) * 40);
                    updateProgressUI(true, "Exporting World", `Processing saves (${saveCount}/${worldSaves.length})...`, prog);
                    // Fetch save image if exists
                    if (save.lastImageSrc && !save.lastImageSrc.startsWith('data:')) {
                        const imgBlob = await fetchAsBlob(save.lastImageSrc);
                        if (imgBlob) {
                            saveImagesFolder.file(`${save.id}.png`, imgBlob);
                        }
                    }
                    savesFolder.file(`${save.id}.json`, JSON.stringify(save, null, 2));
                }
            }
        }

        updateProgressUI(true, "Exporting World", "Compressing package...", 60);
        const blob = await zip.generateAsync({ type: "blob" }, (metadata) => {
            updateProgressUI(true, "Exporting World", `Compressing... ${metadata.percent.toFixed(0)}%`, 60 + (metadata.percent * 0.4));
        });
        
        updateProgressUI(false);
        if (returnBlob) return blob;

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${worldName.replace(/[^a-z0-9]/gi, '_')}.aiworld`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        console.log(`Exported world "${worldName}" to .aiworld (zip) package.`);
    } catch (err) {
        console.error("Export failed:", err);
        if (!returnBlob) alert("Failed to export world.");
        throw err;
    }
}

async function handleImportZip(file, isGallery = false, originMetadata = null) {
    if (!file) return;
    playSound(audioCache.get('ui_click.mp3'), 0.4);
    
    try {
        updateProgressUI(true, "Importing World", "Unpacking package...", 10);
        const zip = await JSZip.loadAsync(file);
        const worldFile = zip.file("world.json");
        if (!worldFile) {
            alert("Invalid world file: missing world.json");
            updateProgressUI(false);
            return;
        }

        const worldContent = await worldFile.async("string");
        const importedWorld = JSON.parse(worldContent);
        
        if (!importedWorld.name || !importedWorld.prompt) {
            alert("Invalid world data in zip.");
            updateProgressUI(false);
            return;
        }

        const worlds = SaveSystem.getWorlds();
        let finalName = importedWorld.name;
        
        // Handle name collision
        if (!isGallery && worlds[finalName]) {
            const confirmed = confirm(`A world named "${finalName}" already exists. Import as a copy?`);
            if (!confirmed) { updateProgressUI(false); return; }
            finalName = `${finalName} (Imported ${new Date().getTime()})`;
            importedWorld.name = finalName;
        }

        updateProgressUI(true, "Importing World", "Extracting assets...", 30);
        // Unpack and re-upload assets if they exist in zip to get fresh URLs
        const assetsFolder = zip.folder("assets");
        if (assetsFolder) {
            const musicFile = assetsFolder.file("music.mp3");
            if (musicFile) {
                const blob = await musicFile.async("blob");
                importedWorld.musicDataUrl = await websim.upload(new File([blob], "music.mp3", { type: "audio/mpeg" }));
            }
            const thumbFile = assetsFolder.file("thumbnail.png");
            if (thumbFile) {
                const blob = await thumbFile.async("blob");
                importedWorld.thumbnailUrl = await websim.upload(new File([blob], "thumbnail.png", { type: "image/png" }));
            }
        }

        updateProgressUI(true, "Importing World", "Saving configuration...", 50);
        
        const worldData = {
            name: importedWorld.name,
            prompt: importedWorld.prompt,
            musicDataUrl: importedWorld.musicDataUrl,
            isAdvanced: importedWorld.isAdvanced,
            rawAdvancedDetails: importedWorld.rawAdvancedDetails,
            startingItems: importedWorld.startingItems,
            locations: importedWorld.locations,
            characters: importedWorld.characters,
            rules: importedWorld.rules,
            customStats: importedWorld.customStats,
            thumbnailUrl: importedWorld.thumbnailUrl,
            objective: importedWorld.objective || "",
            onlineId: isGallery && originMetadata ? originMetadata.id : (importedWorld.onlineId || null),
            originMetadata: isGallery && originMetadata ? {
                username: originMetadata.username,
                allowCopy: originMetadata.allowCopy,
                originalId: originMetadata.id
            } : (importedWorld.originMetadata || null)
        };

        // If it's from gallery, save to cache instead of local worlds library
        let savedWorld;
        if (isGallery) {
            savedWorld = SaveSystem.saveToGalleryCache(worldData);
        } else {
            savedWorld = SaveSystem.saveWorld(
                worldData.name, 
                worldData.prompt, 
                worldData.musicDataUrl, 
                worldData, 
                null, 
                worldData.objective
            );
        }

        // Import saves if any
        const savesFolder = zip.folder("saves");
        const saveImagesFolder = zip.folder("save_images");
        if (savesFolder) {
            const saveFiles = [];
            savesFolder.forEach((relativePath, file) => {
                if (relativePath.endsWith(".json")) {
                    saveFiles.push(file);
                }
            });

            let saveIdx = 0;
            for (const saveFile of saveFiles) {
                saveIdx++;
                const prog = 50 + ((saveIdx / saveFiles.length) * 45);
                updateProgressUI(true, "Importing World", `Unpacking saves (${saveIdx}/${saveFiles.length})...`, prog);
                const saveContent = await saveFile.async("string");
                const save = JSON.parse(saveContent);
                
                // Unpack save image if exists in zip
                if (saveImagesFolder) {
                    const imgFile = saveImagesFolder.file(`${save.id}.png`);
                    if (imgFile) {
                        const blob = await imgFile.async("blob");
                        save.lastImageSrc = await websim.upload(new File([blob], `${save.id}.png`, { type: "image/png" }));
                    }
                }

                // Update worldName to the potentially renamed world
                save.worldName = finalName;
                const newSaveId = `${finalName}_${new Date().getTime()}_${Math.floor(Math.random() * 1000)}`;
                save.id = newSaveId;
                SaveSystem.saveGame(newSaveId, save);
            }
        }

        updateProgressUI(false);
        if (!isGallery) alert(`Successfully imported world: ${finalName}`);
        refreshWorldsList();
        return savedWorld;
    } catch (err) {
        updateProgressUI(false);
        console.error("Import failed:", err);
        if (!isGallery) alert("Failed to import world zip. Make sure it's a valid export file.");
    }
}

importWorldBtn.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    // Accept both .zip and .aiworld (which is a renamed zip)
    input.accept = '.zip,.aiworld';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (file) handleImportZip(file);
    };
    input.click();
});

async function initialScene() {
    toggleLoading(true);
    toggleInput(false);
    try {
        if (audioContext.state === 'suspended') {
            await audioContext.resume();
        }

        const initialText = "Enter a theme or concept to generate your world (e.g., 'A cyberpunk metropolis in perpetual rain', 'An ancient forest where magic has died', 'A drifting space station with a dark secret').";
        appendOutputContent(initialText, 'text', 'initial-narrative');
        
        currentLevel = "Awaiting Creation";

        updateInventoryDisplay();
        updateStatsDisplay();

    } catch (error) {
        console.error("Error setting up initial scene:", error);
        appendOutputContent("Could not load initial scene.", 'text', 'error-message');
        currentSceneImage.src = '';
    } finally {
        toggleLoading(false);
        toggleInput(true);
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    loadingSplash.classList.remove('hidden');
    mainMenu.classList.add('hidden');
    gameContainer.classList.add('hidden');

    // Preload core audio assets
    const preloadPromises = [
        loadAudio('walk.mp3'),
        loadAudio('eat.mp3'),
        loadAudio('drink.mp3'),
        loadAudio('monster.mp3'),
        loadAudio('ui_click.mp3'),
        loadAudio('ui_confirm.mp3'),
        loadAudio('ui_error.mp3'),
        loadAudio('ui_gain.mp3'),
        loadAudio('ui_lose.mp3')
    ];



    try {
        await Promise.all(preloadPromises);
        console.log("All audio and menu background assets pre-loaded.");
    } catch (error) {
        console.error("Failed to preload some assets:", error);
        // Continue anyway, as missing assets shouldn't completely break the game
    }

    const loadedGlobalSettings = SaveSystem.loadGlobalSettings();
    currentSummarizeLevel = loadedGlobalSettings.currentSummarizeLevel;
    uiSoundsVolume = loadedGlobalSettings.uiSoundsVolume;
    musicVolume = loadedGlobalSettings.musicVolume;
    voiceActingEnabled = typeof loadedGlobalSettings.voiceActingEnabled === 'boolean' ? loadedGlobalSettings.voiceActingEnabled : true;
    imageCensoringMode = loadedGlobalSettings.imageCensoringMode;
    backgroundEnabled = typeof loadedGlobalSettings.backgroundEnabled === 'boolean' ? loadedGlobalSettings.backgroundEnabled : true;
    uiLayout = loadedGlobalSettings.uiLayout || 'immersive';
    imageInterpolation = loadedGlobalSettings.imageInterpolation || 'nearest';
    document.body.classList.toggle('immersive-ui', uiLayout === 'immersive');
    panoramicMode = typeof loadedGlobalSettings.panoramicMode === 'boolean' ? loadedGlobalSettings.panoramicMode : true;
    panoramicFov = loadedGlobalSettings.panoramicFov || 75;
    cornerRoundingEnabled = typeof loadedGlobalSettings.cornerRoundingEnabled === 'boolean' ? loadedGlobalSettings.cornerRoundingEnabled : true;
    document.body.classList.toggle('ui-square', !cornerRoundingEnabled);
    if (cornerRoundingSelect) cornerRoundingSelect.value = cornerRoundingEnabled ? 'on' : 'off';

    // NEW: Load language and VR
    currentLanguage = loadedGlobalSettings.language || 'en';
    vrModeEnabled = !!loadedGlobalSettings.vrModeEnabled;

    // Load time settings (defaults: m/d/y and 12-hour)
    const loadedTimeFormat = loadedGlobalSettings.timeFormat || 'mdy';
    const loadedTimeClock = loadedGlobalSettings.timeClock || '12';
    if (timeFormatSelect) timeFormatSelect.value = loadedTimeFormat;
    if (timeClockSelect) timeClockSelect.value = loadedTimeClock;

    mainMenuSummarizeSelect.value = currentSummarizeLevel;
    uiSoundsSlider.value = uiSoundsVolume;
    uiSoundsValue.textContent = `${Math.round(uiSoundsVolume * 100)}%`;
    musicSlider.value = musicVolume;
    musicValue.textContent = `${Math.round(musicVolume * 100)}%`;
    // CHANGED: Set select value based on imageCensoringMode
    imageCensoringSelect.value = imageCensoringMode;
    if (uiLayoutSelect) uiLayoutSelect.value = uiLayout;
    if (imageInterpolationSelect) imageInterpolationSelect.value = imageInterpolation;
    // Apply interpolation on start
    applyImageInterpolation();
    // NEW: Set select value for background toggle if present
    if (backgroundSelect) backgroundSelect.value = backgroundEnabled ? 'on' : 'off';
    if (ttsToggleSelect) ttsToggleSelect.value = voiceActingEnabled ? 'on' : 'off';
    if (vrModeSelect) vrModeSelect.value = vrModeEnabled ? 'on' : 'off';
    if (panoramicModeSelect) {
        panoramicModeSelect.value = panoramicMode ? 'on' : 'off';
        if (enterVRBtn) enterVRBtn.classList.toggle('hidden', !vrModeEnabled || !panoramicMode);
    }
    if (panoramicFovSlider) {
        panoramicFovSlider.value = panoramicFov;
        panoramicFovValue.textContent = `${panoramicFov}°`;
    }
    // NEW: Set language select from settings
    if (languageSelect) languageSelect.value = currentLanguage;

    loadingSplash.classList.add('hidden');
    mainMenu.classList.remove('hidden');

    // Apply initial translations
    applyTranslations();

    // First-run language onboarding: show only if no first-run flag exists
    const firstRunFlag = localStorage.getItem('ai_first_run_done');
    if (!firstRunFlag && languageOnboardingModal && onboardingLanguageSelect && onboardingLanguageConfirmBtn) {
        // Sync onboarding select with current language before showing
        onboardingLanguageSelect.value = currentLanguage;
        languageOnboardingModal.classList.remove('hidden');

        onboardingLanguageConfirmBtn.onclick = () => {
            playSound(audioCache.get('ui_click.mp3'), 0.4);
            const chosenLang = onboardingLanguageSelect.value || 'en';
            currentLanguage = chosenLang;
            SaveSystem.saveGlobalSettings({ language: currentLanguage });
            if (languageSelect) languageSelect.value = currentLanguage;
            applyTranslations();
            localStorage.setItem('ai_first_run_done', '1');
            languageOnboardingModal.classList.add('hidden');
        };
    }

    // Initialize WebsimSocket room
    try {
        await room.initialize();
        console.log("WebsimSocket initialized.");
    } catch (roomInitError) {
        console.error("Room initialization failed:", roomInitError);
    }

    // Start the background cycle only after main menu is visible and only if enabled
    if (backgroundEnabled) {
        displayRandomMenuBackground();
    } else {
        // Hide shader canvas if disabled
        const canvas = document.getElementById('menu-shader-canvas');
        if (canvas) canvas.style.display = 'none';
    }

    // Play menu music if not muted
    if (musicVolume > 0) {
        playBackgroundMusic('menumusic.mp3');
    }

    globalCurrentUser = await websim.getCurrentUser();
    const creator = await window.websim.getCreatedBy();
    projectCreatorUsername = creator.username;
    
    setupChatSubscription();

    // Check if current user is admin
    const isAdmin = globalCurrentUser && (globalCurrentUser.username === 'Speedymule6858' || globalCurrentUser.username === projectCreatorUsername);
    
    if (isAdmin) {
        shadowRealmBtn.classList.remove('hidden');
        reportsBtn.classList.remove('hidden');
    }

    reportsBtn.addEventListener('click', () => {
        playSound(audioCache.get('ui_confirm.mp3'), 0.4);
        reportsMenu.classList.remove('hidden');
        renderReports();
    });

    reportsCloseBtn.addEventListener('click', () => {
        playSound(audioCache.get('ui_click.mp3'), 0.4);
        reportsMenu.classList.add('hidden');
    });

    function renderReports() {
        reportsList.innerHTML = '<p class="loading">Fetching reports...</p>';
        room.collection('world_report_v1').subscribe(reports => {
            reportsList.innerHTML = '';
            if (reports.length === 0) {
                reportsList.innerHTML = '<p class="no-saves">No pending reports.</p>';
                return;
            }

            reports.forEach(report => {
                const card = document.createElement('div');
                card.className = 'shared-world-card';
                card.style.borderColor = '#ffb700';
                
                const world = sharedWorlds.find(w => w.id === report.world_id);

                card.innerHTML = `
                    <h4 style="color: #ffb700;">${report.world_name}</h4>
                    <div class="creator">Reported User: <span class="user-link" data-username="${report.reported_username}">${report.reported_username}</span></div>
                    <div class="creator">By: <span class="user-link" data-username="${report.username}">${report.username}</span></div>
                    <div class="details-description-card" style="margin-top: 10px; padding: 10px;">
                        <label>REASON</label>
                        <p style="font-size: 0.9em; color: #fff;">${report.reason}</p>
                    </div>
                    <div class="world-actions" style="margin-top: 10px; gap: 8px;">
                        <button class="view-report-world-btn world-action-btn" style="flex-grow: 1;">Inspect World</button>
                        <button class="dismiss-report-btn world-action-btn" style="background: #444;">Dismiss</button>
                    </div>
                `;

                card.querySelector('.view-report-world-btn').addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (world) {
                        openSharedWorldDetails(world);
                    } else {
                        alert("The reported world no longer exists or is private.");
                    }
                });

                card.querySelector('.dismiss-report-btn').addEventListener('click', async (e) => {
                    e.stopPropagation();
                    if (confirm("Dismiss this report?")) {
                        playSound(audioCache.get('ui_click.mp3'), 0.2);
                        try {
                            await room.collection('world_report_v1').delete(report.id);
                        } catch (err) {
                            console.error("Failed to delete report:", err);
                        }
                    }
                });

                reportsList.appendChild(card);
            });
        });
    }

    shadowRealmBtn.addEventListener('click', () => {
        playSound(audioCache.get('ui_confirm.mp3'), 0.4);
        const confirmed = confirm("Are you sure you wish to enter the Shadow Realm? These worlds have been banished for a reason.");
        if (confirmed) {
            shadowRealmMenu.classList.remove('hidden');
            const revealToggle = document.getElementById('reveal-shadow-thumbnails');
            if (revealToggle) {
                revealToggle.checked = showShadowThumbnails;
                revealToggle.onchange = (e) => {
                    showShadowThumbnails = e.target.checked;
                    playSound(audioCache.get('ui_click.mp3'), 0.2);
                    renderShadowWorlds();
                };
            }
            renderShadowWorlds();
        }
    });

    shadowRealmCloseBtn.addEventListener('click', () => {
        playSound(audioCache.get('ui_click.mp3'), 0.4);
        shadowRealmMenu.classList.add('hidden');
    });

    // Initialize Shadow Realm Subscription
    room.collection('shadow_realm_v1').subscribe(records => {
        shadowRealmIds = records.map(r => r.world_id);
        renderSharedWorlds();
        if (!shadowRealmMenu.classList.contains('hidden')) renderShadowWorlds();
    });

    room.collection('featured_world_v1').subscribe(records => {
        featuredWorldMap = new Map(records.map(r => [r.world_id, new Date(r.created_at).getTime()]));
        featuredWorldIds = records.map(r => r.world_id);
        renderSharedWorlds();
    });

    // Initialize Online Gallery Subscriptions early to ensure data is ready
    room.collection('world_feedback').subscribe(feedbacks => {
        sharedWorldFeedbacks = feedbacks;
        if (!onlineWorldsMenu.classList.contains('hidden')) renderSharedWorlds();
        // Update details view if it's currently open
        if (currentViewingSharedWorld) {
            updateFeedbackStats(currentViewingSharedWorld.id);
        }
    });

    room.collection('shared_world_v6').subscribe(worlds => {
        sharedWorlds = worlds;
        if (!onlineWorldsMenu.classList.contains('hidden')) renderSharedWorlds();
        if (!worldsMenu.classList.contains('hidden')) refreshWorldsList();
    });

    room.collection('world_play_v1').subscribe(plays => {
        sharedWorldPlays = plays;
        if (!onlineWorldsMenu.classList.contains('hidden')) renderSharedWorlds();
        if (currentViewingSharedWorld) updateFeedbackStats(currentViewingSharedWorld.id);
    });

    room.collection('world_victory_v1').subscribe(victories => {
        sharedWorldVictories = victories;
        if (!playerSearchMenu.classList.contains('hidden')) renderPlayerSearch();
    });

    const creditLinkButtons = document.querySelectorAll('.credits-link-button');
    creditLinkButtons.forEach(button => {
        button.addEventListener('click', (event) => {
            playSound(audioCache.get('ui_click.mp3'), 0.4);
            const url = event.currentTarget.dataset.url;
            if (url) {
                window.open(url, '_blank');
            }
        });
    });

    // Global listener for user profile links and date toggling
    document.addEventListener('click', (e) => {
        const userLink = e.target.closest('.user-link');
        if (userLink) {
            e.stopPropagation();
            const username = userLink.dataset.username;
            if (username) {
                openUserProfile(username);
            }
            return;
        }

        const toggle = e.target.closest('.date-toggle');
        if (toggle) {
            e.stopPropagation();
            playSound(audioCache.get('ui_click.mp3'), 0.2);
            const isFull = toggle.textContent === toggle.dataset.full;
            toggle.textContent = isFull ? toggle.dataset.short : toggle.dataset.full;
        }
    });

    // Initialize custom color pickers
    const initCustomPicker = (containerId, inputId, previewId) => {
        const container = document.getElementById(containerId);
        if (!container) return;
        const input = document.getElementById(inputId);
        const preview = document.getElementById(previewId);
        const swatches = container.querySelectorAll('.color-swatch');

        const updatePicker = (color) => {
            // Validate hex
            if (!/^#[0-9A-F]{6}$/i.test(color)) return;
            input.value = color.toUpperCase();
            preview.style.background = color;
            swatches.forEach(s => {
                s.classList.toggle('active', s.dataset.color.toUpperCase() === color.toUpperCase());
            });
        };

        swatches.forEach(swatch => {
            swatch.addEventListener('click', () => {
                playSound(audioCache.get('ui_click.mp3'), 0.2);
                updatePicker(swatch.dataset.color);
            });
        });

        input.addEventListener('input', (e) => {
            let val = e.target.value;
            if (!val.startsWith('#')) val = '#' + val;
            if (val.length > 7) val = val.substring(0, 7);
            updatePicker(val);
        });
    };

    initCustomPicker('create-hand-color-picker', 'new-world-vr-hand-color', 'create-hand-color-preview');
    initCustomPicker('edit-hand-color-picker', 'edit-world-vr-hand-color', 'edit-hand-color-preview');

    // Maintenance Handlers
    const maintenanceModal = document.getElementById('maintenance-viewer-modal');
    const maintenanceTitle = document.getElementById('maintenance-viewer-title');
    const maintenanceContent = document.getElementById('maintenance-viewer-content');
    const maintenanceClose = document.getElementById('maintenance-viewer-close-btn');
    const maintenanceCopy = document.getElementById('maintenance-copy-btn');

    const openMaintenanceView = (title, key) => {
        playSound(audioCache.get('ui_click.mp3'), 0.4);
        maintenanceTitle.textContent = `File: ${title}`;
        const data = localStorage.getItem(key);
        maintenanceContent.value = data ? JSON.stringify(JSON.parse(data), null, 2) : "{}";
        maintenanceModal.classList.remove('hidden');
    };



    maintenanceClose.onclick = () => {
        playSound(audioCache.get('ui_click.mp3'), 0.2);
        maintenanceModal.classList.add('hidden');
    };

    maintenanceCopy.onclick = () => {
        maintenanceContent.select();
        document.execCommand('copy');
        playSound(audioCache.get('ui_confirm.mp3'), 0.3);
        const originalText = maintenanceCopy.textContent;
        maintenanceCopy.textContent = "COPIED!";
        setTimeout(() => maintenanceCopy.textContent = originalText, 2000);
    };

    // Handle Linux Type dropdown visibility
    const osSelect = document.getElementById('data-dir-os-select');
    const linuxTypeWrapper = document.getElementById('linux-type-wrapper');
    if (osSelect && linuxTypeWrapper) {
        osSelect.addEventListener('change', () => {
            linuxTypeWrapper.classList.toggle('hidden', osSelect.value !== 'linux');
        });
    }

    // --- File Directory Handlers (Export triggers) ---
    const exportDataToFile = (filename, data) => {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    document.getElementById('copy-data-dir-btn').onclick = () => {
        playSound(audioCache.get('ui_confirm.mp3'), 0.4);
        const os = document.getElementById('data-dir-os-select').value;
        const browser = document.getElementById('data-dir-browser-select').value;
        
        let path = "";

        if (os === 'win') {
            switch (browser) {
                case 'chrome': path = "%LocalAppData%\\Google\\Chrome\\User Data\\Default\\Local Storage\\leveldb"; break;
                case 'edge': path = "%LocalAppData%\\Microsoft\\Edge\\User Data\\Default\\Local Storage\\leveldb"; break;
                case 'brave': path = "%LocalAppData%\\BraveSoftware\\Brave-Browser\\User Data\\Default\\Local Storage\\leveldb"; break;
                case 'chromium': path = "%LocalAppData%\\Chromium\\User Data\\Default\\Local Storage\\leveldb"; break;
                case 'firefox': path = "%AppData%\\Mozilla\\Firefox\\Profiles\\[profile-id].default-release\\storage\\default"; break;
                case 'opera': path = "%AppData%\\Opera Software\\Opera Stable\\Local Storage\\leveldb"; break;
                case 'operagx': path = "%AppData%\\Opera Software\\Opera GX Stable\\Local Storage\\leveldb"; break;
                case 'vivaldi': path = "%LocalAppData%\\Vivaldi\\User Data\\Default\\Local Storage\\leveldb"; break;
                case 'tor': path = "Desktop\\Tor Browser\\Browser\\TorBrowser\\Data\\Browser\\profile.default\\Local Storage\\leveldb"; break;
                default: path = "Browser path not mapped for Windows.";
            }
        } else if (os === 'mac') {
            const base = "~/Library/Application Support/";
            switch (browser) {
                case 'chrome': path = base + "Google/Chrome/Default/Local Storage/leveldb"; break;
                case 'edge': path = base + "Microsoft Edge/Default/Local Storage/leveldb"; break;
                case 'brave': path = base + "BraveSoftware/Brave-Browser/Default/Local Storage/leveldb"; break;
                case 'chromium': path = base + "Chromium/Default/Local Storage/leveldb"; break;
                case 'firefox': path = base + "Firefox/Profiles/[profile-id].default-release/storage/default"; break;
                case 'opera': path = base + "com.operasoftware.Opera/Local Storage/leveldb"; break;
                case 'operagx': path = base + "com.operasoftware.OperaGX/Local Storage/leveldb"; break;
                case 'vivaldi': path = base + "Vivaldi/Default/Local Storage/leveldb"; break;
                case 'arc': path = base + "Arc/User Data/Default/Local Storage/leveldb"; break;
                default: path = "Browser path not mapped for macOS.";
            }
        } else if (os === 'linux') {
            const linuxType = document.getElementById('data-dir-linux-type-select').value;
            switch (browser) {
                case 'chrome': 
                    if (linuxType === 'native') path = `~/.config/google-chrome/Default/Local Storage/leveldb`;
                    else if (linuxType === 'snap') path = `~/snap/google-chrome/common/.config/google-chrome/Default/Local Storage/leveldb`;
                    else if (linuxType === 'flatpak') path = `~/.var/app/com.google.Chrome/config/google-chrome/Default/Local Storage/leveldb`;
                    break;
                case 'edge':
                    if (linuxType === 'native') path = `~/.config/microsoft-edge/Default/Local Storage/leveldb`;
                    else if (linuxType === 'flatpak') path = `~/.var/app/com.microsoft.Edge/config/microsoft-edge/Default/Local Storage/leveldb`;
                    else path = "";
                    break;
                case 'brave': 
                    if (linuxType === 'native') path = `~/.config/BraveSoftware/Brave-Browser/Default/Local Storage/leveldb`;
                    else if (linuxType === 'snap') path = `~/snap/brave/common/.config/BraveSoftware/Brave-Browser/Default/Local Storage/leveldb`;
                    else if (linuxType === 'flatpak') path = `~/.var/app/com.brave.Browser/config/BraveSoftware/Brave-Browser/Default/Local Storage/leveldb`;
                    break;
                case 'chromium': 
                    if (linuxType === 'native') path = `~/.config/chromium/Default/Local Storage/leveldb`;
                    else if (linuxType === 'snap') path = `~/snap/chromium/common/.config/chromium/Default/Local Storage/leveldb`;
                    else if (linuxType === 'flatpak') path = `~/.var/app/org.chromium.Chromium/config/chromium/Default/Local Storage/leveldb`;
                    else path = "";
                    break;
                case 'firefox': 
                    if (linuxType === 'native') path = `~/.mozilla/firefox/*.default-release/storage/default`;
                    else if (linuxType === 'snap') path = `~/snap/firefox/common/.mozilla/firefox/*.default-release/storage/default`;
                    else if (linuxType === 'flatpak') path = `~/.var/app/org.mozilla.firefox/.mozilla/firefox/*.default-release/storage/default`;
                    break;
                case 'vivaldi': 
                    if (linuxType === 'native') path = `~/.config/vivaldi/Default/Local Storage/leveldb`;
                    else if (linuxType === 'flatpak') path = `~/.var/app/com.vivaldi.Vivaldi/config/vivaldi/Default/Local Storage/leveldb`;
                    else path = "";
                    break;
                case 'opera': 
                    if (linuxType === 'native') path = `~/.config/opera/Local Storage/leveldb`;
                    else if (linuxType === 'snap') path = `~/snap/opera/common/.config/opera/Local Storage/leveldb`;
                    else path = "";
                    break;
                case 'operagx':
                    path = `~/.config/opera/Local Storage/leveldb`;
                    break;
                case 'tor':
                    path = `~/.local/share/torbrowser/tbb/x86_64/tor-browser_en-US/Browser/TorBrowser/Data/Browser/profile.default/Local Storage/leveldb`;
                    break;
                case 'arc':
                    path = ``;
                    break;
                default: 
                    path = "";
            }
        }
        
        navigator.clipboard.writeText(path).then(() => {
            const btn = document.getElementById('copy-data-dir-btn');
            const labelSpan = btn.querySelector('[data-i18n]');
            const originalText = labelSpan.textContent;
            labelSpan.textContent = "PATH COPIED!";
            btn.style.borderColor = "#00f3ff";
            setTimeout(() => {
                labelSpan.textContent = originalText;
                btn.style.borderColor = "";
            }, 3000);
        });
    };

    document.getElementById('export-full-backup-btn').onclick = async () => {
        playSound(audioCache.get('ui_confirm.mp3'), 0.5);
        try {
            updateProgressUI(true, "Full Backup", "Creating master archive...", 10);
            const zip = new JSZip();
            zip.file("worlds.json", localStorage.getItem(SaveSystem.WORLDS_KEY) || "{}");
            zip.file("saves.json", localStorage.getItem(SaveSystem.SAVES_KEY) || "{}");
            zip.file("settings.json", localStorage.getItem(SaveSystem.GLOBAL_SETTINGS_KEY) || "{}");
            zip.file("gallery_cache.json", localStorage.getItem(SaveSystem.GALLERY_CACHE_KEY) || "{}");
            
            const blob = await zip.generateAsync({ type: "blob" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `AI_WORLD_MAKER_FULL_BACKUP_${new Date().getTime()}.zip`;
            a.click();
            URL.revokeObjectURL(url);
            updateProgressUI(false);
            alert("Master backup created and downloaded successfully.");
        } catch (e) {
            console.error("Backup failed", e);
            alert("Backup failed. See console for details.");
            updateProgressUI(false);
        }
    };

    document.getElementById('import-full-backup-btn').onclick = async () => {
        playSound(audioCache.get('ui_click.mp3'), 0.4);
        if (!confirm("Warning: This will OVERWRITE your current local worlds, saves, and settings. Are you sure you want to restore from a backup?")) return;

        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.zip';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            try {
                updateProgressUI(true, "Restoring Backup", "Unpacking master archive...", 10);
                const zip = await JSZip.loadAsync(file);
                
                const filesToRestore = [
                    { name: "worlds.json", key: SaveSystem.WORLDS_KEY },
                    { name: "saves.json", key: SaveSystem.SAVES_KEY },
                    { name: "settings.json", key: SaveSystem.GLOBAL_SETTINGS_KEY },
                    { name: "gallery_cache.json", key: SaveSystem.GALLERY_CACHE_KEY }
                ];

                for (let i = 0; i < filesToRestore.length; i++) {
                    const f = filesToRestore[i];
                    const zipFile = zip.file(f.name);
                    if (zipFile) {
                        const content = await zipFile.async("string");
                        // Basic validation: ensure it's valid JSON before wiping key
                        JSON.parse(content); 
                        localStorage.setItem(f.key, content);
                        updateProgressUI(true, "Restoring Backup", `Restoring ${f.name}...`, 20 + ((i + 1) / filesToRestore.length) * 70);
                    }
                }

                updateProgressUI(false);
                playSound(audioCache.get('ui_confirm.mp3'), 0.5);
                alert("Master backup restored successfully! The application will now reload to apply the data.");
                window.location.reload();
            } catch (err) {
                console.error("Backup restoration failed:", err);
                updateProgressUI(false);
                alert("Failed to restore backup. Make sure it's a valid AI World Maker master archive.");
            }
        };
        input.click();
    };
});

const userProfileMenu = document.getElementById('user-profile-menu');
const profileAvatar = document.getElementById('profile-avatar');
const profileUsername = document.getElementById('profile-username');
const profileStatsSummary = document.getElementById('profile-stats-summary');
const profileWorldsList = document.getElementById('profile-worlds-list');
const closeProfileBtn = document.getElementById('close-profile-btn');

function openUserProfile(username) {
    playSound(audioCache.get('ui_click.mp3'), 0.4);
    
    // Store current active menu for returning
    const activeMenus = [
        'live-chat-menu', 'online-worlds-menu', 'online-world-details', 
        'reports-menu', 'main-menu', 'worlds-menu'
    ];
    for (const mId of activeMenus) {
        const m = document.getElementById(mId);
        if (m && !m.classList.contains('hidden')) {
            profileReturnMenu = m;
            break;
        }
    }

    userProfileMenu.classList.remove('hidden');
    profileUsername.textContent = username;
    profileAvatar.alt = username;
    profileAvatar.onerror = () => window.__WS_AVATAR_FALLBACK && window.__WS_AVATAR_FALLBACK(profileAvatar);
    profileAvatar.src = `https://images.websim.com/avatar/${username}`;

    const userWorlds = sharedWorlds.filter(w => w.username === username);
    const userVictories = sharedWorldVictories.filter(v => v.username === username);
    profileStatsSummary.textContent = t('profile.statsSummary')
        .replace('{worlds}', userWorlds.length)
        .replace('{wins}', userVictories.length);

    profileWorldsList.innerHTML = '';
    if (userWorlds.length === 0) {
        profileWorldsList.innerHTML = '<p class="no-saves" style="grid-column: 1/-1; padding: 40px;">This user hasn\'t shared any worlds yet.</p>';
    } else {
        userWorlds.forEach(world => {
            const card = document.createElement('div');
            card.className = 'shared-world-card';
            
            let thumbnailHTML = '';
            if (world.thumbnailUrl) {
                thumbnailHTML = `<img src="${world.thumbnailUrl}" class="shared-world-thumbnail" alt="${world.name} thumbnail" crossorigin="anonymous">`;
            }

            const dateObj = new Date(world.created_at);
            const uploadDate = formatDateForUI(dateObj);
            const exactTime = formatTimeForUI(dateObj);
            const fullDate = `${uploadDate} ${exactTime}`;

            card.innerHTML = `
                ${thumbnailHTML}
                <h4>${world.name}</h4>
                <div class="creator">Shared on <span class="date-toggle" style="font-size: 0.85em; opacity: 0.7; cursor: pointer;" title="Click for exact time" data-short="${uploadDate}" data-full="${fullDate}">${uploadDate}</span></div>
                <div class="stats">
                    <span style="font-size: 0.8em; opacity: 0.6; font-family: monospace;">ID: ${world.id.substring(0, 8)}...</span>
                </div>
            `;

            card.addEventListener('click', (e) => {
                userProfileMenu.classList.add('hidden');
                openSharedWorldDetails(world);
            });

            profileWorldsList.appendChild(card);
        });
    }
}

closeProfileBtn.addEventListener('click', () => {
    playSound(audioCache.get('ui_click.mp3'), 0.4);
    userProfileMenu.classList.add('hidden');
    // Logic to ensure we don't hide everything if we were inside a nested menu
    if (profileReturnMenu) {
        profileReturnMenu.classList.remove('hidden');
    }
});
