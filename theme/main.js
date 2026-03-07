// Навигация для Vidaa 3-9 с установкой приложений
class VidaaStore {
    constructor() {
        this.DEBUG = false;
        this.apps = []; // Будет загружено через API
        this.categories = [];
        this.modal = document.getElementById('app-modal');
        this.currentTab = 'all';
        this.vidaaVersion = this.detectVidaaVersion(); // Тут будет верная версия
        this.focusIndex = 0;
        this.focusableElements = [];

        // Определяем платформу
        this.isVidaaTV = this.detectVidaaTV();
        this.cardElements = [];
        this.notificationTimer = null;
        this.notificationRemoveTimer = null;
        this.performanceMode = {
            installStartDelay: this.isVidaaTV ? 250 : 450,
            installRefreshDelay: this.isVidaaTV ? 500 : 900,
            uninstallStartDelay: this.isVidaaTV ? 200 : 350,
            uninstallRefreshDelay: this.isVidaaTV ? 450 : 700,
            errorResetDelay: this.isVidaaTV ? 2500 : 3000,
            vidaa3AutofillDelay: this.isVidaaTV ? 1800 : 2500,
            vidaa3CleanupDelay: this.isVidaaTV ? 3500 : 4500,
            vidaa3FallbackDelay: this.isVidaaTV ? 2500 : 3500,
            notificationDuration: this.isVidaaTV ? 2200 : 3000
        };
        // Загружаем установленные приложения
        this.installedApps = this.loadInstalledApps();
        
        // Карта специальных StoreType для конкретных приложений
        this.specialStoreTypes = {
            'wink': 'hisense',
            'lampa': 'hisense',
            'lampa_basov': 'hisense',
            'lampaskaz': 'hisense'
        };
		
		// ========== КРАСНАЯ КНОПКА DEBUG ==========
        this.redButtonPressCount = 0;
        this.redButtonTimer = null;
        
        this.init();
    }
    
    // Создайте метод для логирования
    log(...args) {
        if (this.DEBUG) {
            console.log(...args);
        }
    }
    
    error(...args) {
        if (this.DEBUG) {
            console.error(...args);
        }
    }
    
    warn(...args) {
        if (this.DEBUG) {
            console.warn(...args);
        }
    }

   async init() {
    this.log('🎮 Vidaa версия:', this.vidaaVersion.version);
    //this.log('🖥️ Vidaa TV:', this.isVidaaTV);

    await this.loadAppsFromAPI();
    this.renderCategoryMenu();
    
    // Синхронизируем URL из установленных приложений
    this.syncUrlsFromInstalled()
    
    this.applyPerformanceMode();
    this.injectStyles();
    this.setupKeyboardNavigation();
    this.setupMouseClicks();
	this.setupDeviceInfo();
    
    this.renderAppCards();
    // Personal apps disabled for static build
    
        // Принудительно перечитываем статус после инициализации
    setTimeout(() => {
        this.refreshInstalledStatus();
    }, this.performanceMode.installRefreshDelay);
    
    this.updateFocusableElements();
    this.setFocus(0);
}

    applyPerformanceMode() {
        document.body.classList.toggle('tv-performance', this.isVidaaTV);
    }

    // Определение, является ли устройство Vidaa TV
    //detectVidaaTV() {
    //    return !!(
    //        typeof HiUtils_createRequest === 'function' ||
    //        typeof WebSDK_createFileRequest === 'function' ||
    //        typeof Hisense !== 'undefined'
    //    );
   // }
   
   

   
   
// ==================== PERSONAL APPS ====================
getDeviceId() {
    try {
        if (typeof Hisense_GetDeviceID === 'function') {
            return Hisense_GetDeviceID();
        }
    } catch (e) {
        //this.log('⚠ Hisense_GetDeviceID недоступен');
    }
    return null;
}

checkHDRInfo() {
    try {
        if (typeof Hisense_GetSupportForHDRInfo === 'function') {
            const result = Hisense_GetSupportForHDRInfo();
            return JSON.stringify(result, null, 2); // Красивый вывод с отступами
        }
    } catch (e) {
        //this.log('⚠ Hisense_GetSupportForHDRInfo недоступен');
        return 'Ошибка: ' + e.message;
    }
    return 'Не могу получить информацию о доступности HDR';
}

checkDOLbInfo() {
    try {
        if (typeof Hisense_GetSupportForDolby === 'function') {
            const result = Hisense_GetSupportForDolby();
            return JSON.stringify(result, null, 2);
        }
    } catch (e) {
        //this.log('⚠ Hisense_GetSupportForDolby недоступен');
        return 'Ошибка: ' + e.message;
    }
    return 'Функция Dolby недоступна';
}

// Генерация собственного UUID на основе DeviceID или fallback
generateUUIDFromDevice(deviceId) {
    if (!deviceId) {
        deviceId = navigator.userAgent + screen.width + screen.height + Date.now();
    }

    let hash = 0;
    for (let i = 0; i < deviceId.length; i++) {
        hash = ((hash << 5) - hash) + deviceId.charCodeAt(i);
        hash |= 0;
    }
    return 'vidaa-' + Math.abs(hash);
}

getPersonalUUID() {
    if (this._personalUUID) {
        //this.log('🆔 Personal UUID (cached):', this._personalUUID);
        return this._personalUUID;
    }

    let storedUUID = localStorage.getItem('vidaa_personal_uuid');
    if (storedUUID) {
        this._personalUUID = storedUUID;
        this.log('🆔 Personal UUID (from storage):', this._personalUUID);
        return this._personalUUID;
    }

    let deviceId = this.getDeviceId();
    this._personalUUID = this.generateUUIDFromDevice(deviceId);
    localStorage.setItem('vidaa_personal_uuid', this._personalUUID);

    //this.log('🆔 Personal UUID (generated):', this._personalUUID);
    return this._personalUUID;
}
// ==================== PERSONAL APPS ====================
async loadPersonalApps() {
    return;
}

// ==================== РЕНДЕР КАРТОЧЕК ====================
renderPersonalApps() {
    const container = document.getElementById('apps-container');
    if (!container) return;

    // убираем лоадер
    const loader = container.querySelector('.loading');
    if (loader) loader.remove();

    const apps = this.personalApps || [];
    if (!apps.length) return;

    apps.forEach((app, index) => {
        const card = document.createElement('div');
        card.className = 'app-card';
        card.setAttribute('data-category', 'Персональное'); // ключ для фильтра
        card.setAttribute('data-index', index);
        card.setAttribute('data-appid', app.appid);
        card.tabIndex = 0;
        card.style.display = 'none'; // скрыто по умолчанию

        card.innerHTML = `
            <div class="app-icon"><img src="${app.icon || ''}" alt="${app.name || 'Приложение'}"></div>
            <div class="app-info">
                <h3 class="app-name">${app.name || 'Без названия'}</h3>
                <p class="app-description">${app.description || ''}</p>
                <div class="app-meta">
                    <span class="app-category">Персональное</span>
                </div>
            </div>
        `;

        container.appendChild(card);
    });
}

// ==================== КНОПКА ФЛЬТРА ====================
createPersonalMenuButton() {
    const menu = document.querySelector('.menu');
    if (!menu || menu.querySelector('.menu-item[data-tab="Персональное"]')) return;

    const btn = document.createElement('button');
    btn.className = 'menu-item';
    btn.setAttribute('data-tab', 'Персональное');
    btn.tabIndex = 0;

    btn.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/>
            <path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>
        </svg>
        <span>Персональные</span>
    `;

    menu.appendChild(btn);

    const showPersonalCategory = () => {
    // 1. Активная кнопка
    document.querySelectorAll('.menu-item').forEach(m => m.classList.remove('active'));
    btn.classList.add('active');

    // 2. Фильтруем по категории
    const container = document.getElementById('apps-container');
    const apps = container.querySelectorAll('.app-card');
    let hasApps = false;

    apps.forEach(card => {
        if (card.dataset.category === 'Персональное') {
            card.style.display = ''; // сбрасываем, карточка показывает CSS
            hasApps = true;
        } else {
            card.style.display = 'none';
        }
    });

    // 3. Пустое сообщение
    let empty = container.querySelector('.empty-message');
    if (!empty) {
        empty = document.createElement('div');
        empty.className = 'empty-message';
        empty.innerHTML = `
            <svg width="100" height="100" viewBox="0 0 24 24" style="opacity:0.3;">
                <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"></circle>
                <path d="M8 12h8M12 8v8" stroke="currentColor" stroke-width="2"></path>
            </svg>
            <h3>Приложений не найдено</h3>
            <p>В этой категории пока нет приложений</p>
        `;
        container.appendChild(empty);
    }
    empty.style.display = hasApps ? 'none' : 'flex';
};

    // обработчики для ТВ и ПК
    btn.addEventListener('click', showPersonalCategory);
    btn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === 'OK') showPersonalCategory();
    });
}





	
	detectVidaaTV() {
		const ua = navigator.userAgent.toLowerCase();
		const isVidaaUA = /vidaa|hisense|hibrowser/.test(ua);
		const hasNativeAPI =
			typeof HiUtils_createRequest === 'function' ||
			typeof WebSDK_createFileRequest === 'function' ||
			(typeof Hisense !== 'undefined' && typeof Hisense.File !== 'undefined');
		return isVidaaUA && hasNativeAPI;
	}

    getAppIconUrl(appData, absolute = false) {
        const icon = appData && appData.icon ? appData.icon : '';
        if (!icon) {
            return '';
        }

        if (icon.startsWith('data:') || /^https?:\/\//i.test(icon)) {
            return icon;
        }

        return absolute ? new URL(icon, window.location.href).href : icon;
    }
	
	// ========== API МЕТОДЫ ==========
async loadAppsFromAPI() {
    try {
        const response = await fetch('data/apps.json', { cache: 'no-store' });
        const data = await response.json();
        const list = Array.isArray(data) ? data : [];

        this.installedApps = this.loadInstalledApps();

        const urlMap = {};
        this.installedApps.forEach(app => {
            if (app.URL) {
                urlMap[app.AppName] = app.URL;
            }
        });

        this.apps = list.map(app => {
            const icon = this.getAppIconUrl(app);

            if (app.url) {
                return { ...app, icon };
            }

            const urlFromInstalled = urlMap[app.name];
            if (urlFromInstalled) {
                return { ...app, url: urlFromInstalled, icon };
            }

            return { ...app, url: '', icon };
        });

        this.categories = [...new Set(this.apps.map(app => app.category).filter(Boolean))];
    } catch (error) {
        console.error('  :', error);
        this.showNotification('  ');
        this.apps = [];
        this.categories = [];
    }
}

    getCategoryIcon(category) {
        const icons = {
            'Кино': `
                <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
                    <rect x="2" y="4" width="20" height="16" rx="2" stroke="currentColor" stroke-width="1.5" fill="none"/>
                    <path d="M8 4V20M16 4V20M2 8H8M2 12H8M2 16H8M16 8H22M16 12H22M16 16H22" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                </svg>
            `,
            'ТВ-Каналы': `
                <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
                    <rect x="4" y="5" width="16" height="12" rx="1" stroke="currentColor" stroke-width="1.5" fill="none"/>
                    <path d="M8 17L6 21M16 17L18 21M12 17V19M12 21V19M12 19H8M12 19H16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                    <path d="M7 8H17M7 11H12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                </svg>
            `
        };

        return icons[category] || `
            <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
                <rect x="4" y="4" width="16" height="16" rx="3" stroke="currentColor" stroke-width="1.7" fill="none"/>
                <path d="M8 8H16M8 12H16M8 16H13" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
            </svg>
        `;
    }

    renderCategoryMenu() {
        const container = document.getElementById('dynamic-menu');
        if (!container) {
            return;
        }

        container.innerHTML = '';

        this.categories.forEach(category => {
            const button = document.createElement('button');
            button.className = 'menu-item';
            button.dataset.tab = category;
            button.tabIndex = 0;
            button.innerHTML = `
                ${this.getCategoryIcon(category)}
                <span>${category}</span>
            `;
            container.appendChild(button);
        });
    }

    async getAppDetails(appid) {
        try {
            return this.apps.find(app => app.appid === appid) || null;
        } catch (error) {
            this.showNotification('   ');
            return null;
        }
    }
	
	// Отрисовка карточек приложений
    renderAppCards_old() {
        const container = document.getElementById('apps-container');
        container.innerHTML = '';
        
        this.apps.forEach((app, index) => {
            const card = document.createElement('div');
            card.className = 'app-card';
            card.setAttribute('data-category', app.category.toLowerCase());
            card.setAttribute('data-index', index);
            card.setAttribute('data-appid', app.appid);
            card.tabIndex = 0;
            
            card.innerHTML = `
                <div class="app-icon">
                    <img src="${app.icon}" alt="${app.name}">
                </div>
                <div class="app-info">
                    <h3 class="app-name">${app.name}</h3>
                    <p class="app-description">${app.description}</p>
                    <div class="app-meta">
                        <span class="app-category">${app.category}</span>
                        <span class="app-version">${app.version}</span>
                    </div>
                </div>
            `;
            
            container.appendChild(card);
        });
        
        this.updateAppCards();
    }
	
	
	
	renderAppCards() {
    const container = document.getElementById('apps-container');
    container.innerHTML = '';
    this.cardElements = [];
    const fragment = document.createDocumentFragment();

    this.apps.forEach((app, index) => {
        const card = document.createElement('div');
        card.className = 'app-card';
        card.dataset.category = app.category.toLowerCase();
        card.dataset.index = index;
        card.dataset.appid = app.appid;
        card.tabIndex = 0;
        card.__appData = app;

        // ICON
        const iconWrap = document.createElement('div');
        iconWrap.className = 'app-icon';

        const img = document.createElement('img');
        img.src = app.icon;
        img.alt = app.name;
        img.loading = 'lazy';
        img.decoding = 'async';

        iconWrap.appendChild(img);

        // INFO
        const info = document.createElement('div');
        info.className = 'app-info';

        const name = document.createElement('h3');
        name.className = 'app-name';
        name.textContent = app.name;

        const desc = document.createElement('p');
        desc.className = 'app-description';
        desc.textContent = app.description;

        const meta = document.createElement('div');
        meta.className = 'app-meta';

        const cat = document.createElement('span');
        cat.className = 'app-category';
        cat.textContent = app.category;

        const ver = document.createElement('span');
        ver.className = 'app-version';
        ver.textContent = app.version;

        meta.appendChild(cat);
        meta.appendChild(ver);

        info.appendChild(name);
        info.appendChild(desc);
        info.appendChild(meta);

        card.appendChild(iconWrap);
        card.appendChild(info);

        this.cardElements.push(card);
        fragment.appendChild(card);
    });

    container.appendChild(fragment);

    this.updateAppCards();
}

    // ========== КРАСНАЯ КНОПКА DEBUG ==========
    setupKeyboardNavigation() {
        document.addEventListener('keydown', (e) => {
            const code = e.key || e.keyCode;
            
            // Красная кнопка (403) - 3 раза для Debug
            if (code === 403 || code === 'Red' || code === 'ColorF0Red') {
                this.handleRedButton();
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            
            if (code === 38) {
                this.navigate('up');
                e.preventDefault();
                e.stopPropagation();
            }
            else if (code === 40) {
                this.navigate('down');
                e.preventDefault();
                e.stopPropagation();
            }
            else if (code === 37) {
                this.navigate('left');
                e.preventDefault();
                e.stopPropagation();
            }
            else if (code === 39) {
                this.navigate('right');
                e.preventDefault();
                e.stopPropagation();
            }
            else if (code === 13) {
                this.handleOK();
                e.preventDefault();
                e.stopPropagation();
            }
            else if (code === 8 || code === 27) {
                this.handleBack();
                e.preventDefault();
                e.stopPropagation();
            }
        }, true);
    }

    handleRedButton() {
        this.redButtonPressCount++;
        //this.log(`🔴 Красная кнопка: ${this.redButtonPressCount}/3`);

        // Показываем индикатор
        this.showNotification(`🔴 ${this.redButtonPressCount}/3`);

        if (this.redButtonTimer) {
            clearTimeout(this.redButtonTimer);
        }
        
        this.redButtonTimer = setTimeout(() => {
            this.redButtonPressCount = 0;
        }, 10000);
        
        // Если нажали 3 раза
        if (this.redButtonPressCount >= 3) {
            this.redButtonPressCount = 0;
            clearTimeout(this.redButtonTimer);
            this.openDebugMode();
        }
    }

    openDebugMode() {
    //this.log('🔧 Открываем Debug режим');
    this.showNotification('🔧 Переход в Debug режим...');

    setTimeout(() => {

        let opened = false;

        // Способ 1: Hisense.System.launch
        try {
            if (window.Hisense && Hisense.System && typeof Hisense.System.launch === "function") {
                //this.log('Способ 1: Hisense.System.launch');
                Hisense.System.launch('hisense://debug');
                opened = true;
            }
        } catch (e) {
            //this.log('Способ 1 не сработал', e);
        }

        // Способ 2: Hisense.Browser.open
        if (!opened) {
            try {
                if (window.Hisense && Hisense.Browser && typeof Hisense.Browser.open === "function") {
                    //this.log('Способ 2: Hisense.Browser.open');
                    Hisense.Browser.open('hisense://debug');
                    opened = true;
                }
            } catch (e) {
                //this.log('Способ 2 не сработал', e);
            }
        }

        // Способ 3: HiUtils_createRequest (Vidaa 8–9)
        if (!opened) {
            try {
                if (typeof HiUtils_createRequest === "function") {
                    //this.log('Способ 3: HiUtils_createRequest openBrowser');
                    HiUtils_createRequest("openBrowser", { url: "hisense://debug" });
                    opened = true;
                }
            } catch (e) {
                //this.log('Способ 3 не сработал', e);
            }
        }

        // Способ 4: WebSDK_createFileRequest (Vidaa 5–6)
        if (!opened) {
            try {
                if (typeof WebSDK_createFileRequest === "function") {
                    //this.log('Способ 4: WebSDK_createFileRequest');
                    WebSDK_createFileRequest("open", JSON.stringify({ url: "hisense://debug" }));
                    opened = true;
                }
            } catch (e) {
                //this.log('Способ 4 не сработал', e);
            }
        }

        // Способ 5: window.location (ПОСЛЕДНЙ и осторожно)
        if (!opened) {
            try {
                //this.log('Способ 5: window.location');
                window.location.href = 'hisense://debug';
                opened = true;
            } catch (e) {
                //this.log('Способ 5 не сработал', e);
            }
        }

        // Overlay-инструкция (fallback)
        setTimeout(() => {
            if (!opened) {
                //this.log('Показываем инструкцию пользователю');

                const overlay = document.createElement('div');
                overlay.style.cssText = `
                    position: fixed;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    background: rgba(0, 0, 0, 0.95);
                    color: white;
                    padding: 40px;
                    border-radius: 20px;
                    z-index: 1000000;
                    text-align: center;
                    font-size: 22px;
                    max-width: 80%;
                `;

                overlay.innerHTML = `
                    <h2 style="margin-bottom:20px;">🔧 Debug режим</h2>
                    <p style="margin-bottom:15px;">Автооткрытие не удалось.</p>
                    <ol style="text-align:left;margin-bottom:25px;">
                        <li>Откройте браузер Vidaa</li>
                        <li>Введите: <b>hisense://debug</b></li>
                        <li>Нажмите Enter</li>
                    </ol>
                    <button class="debug-close-btn" style="
                        padding: 14px 36px;
                        font-size: 18px;
                        background: #0066FF;
                        color: white;
                        border: none;
                        border-radius: 10px;
                        cursor: pointer;
                    ">Закрыть</button>
                `;

                document.body.appendChild(overlay);

                overlay.querySelector('.debug-close-btn').onclick = () => {
                    document.body.removeChild(overlay);
                };
            }
        }, 400);

    }, 150);
}

    // Обновленный метод открытия модального окна
    async openAppModal(card) {
        const appid = card.dataset.appid;
        const index = parseInt(card.dataset.index);
        
        // Показываем loader
        this.showNotification('Загрузка данных приложения...');
        
        // Получаем полные данные приложения через API
        const appDetails = await this.getAppDetails(appid);
        
        if (!appDetails) {
            this.showNotification('Ошибка загрузки данных приложения');
            return;
        }
        
        // Обновляем данные в массиве (добавляем URL)
        this.apps[index] = { ...this.apps[index], ...appDetails };
        
        // Отображаем модальное окно
        document.getElementById('modal-icon').src = appDetails.icon;
        document.getElementById('modal-name').textContent = appDetails.name;
        document.getElementById('modal-description').textContent = appDetails.description;
        const modalCategory = document.getElementById('modal-category');
        const modalVersion = document.getElementById('modal-version');
        const modalSize = document.getElementById('modal-size');

        modalCategory.textContent = appDetails.category || '';
        modalCategory.style.display = appDetails.category ? 'inline-flex' : 'none';

        modalVersion.textContent = appDetails.version || '';
        modalVersion.style.display = appDetails.version ? 'inline-flex' : 'none';

        modalSize.textContent = appDetails.size || '';
        modalSize.style.display = appDetails.size ? 'inline-flex' : 'none';
        
        this.modal.classList.add('active');
        document.body.style.overflow = 'hidden';
        this.updateInstallButton();
        this.updateFocusableElements();
        this.setFocus(0);
    }
    
    
    // Добавьте метод для определения StoreType
getStoreType(appData) {
    const appId = appData.appid ? appData.appid.toLowerCase() : '';
    const appName = appData.name ? appData.name.toLowerCase() : '';
    
    // 1. Сначала проверяем специальные типы по appid
    if (this.specialStoreTypes[appId]) {
        //this.log(`🏷️ Специальный StoreType для ${appId}: ${this.specialStoreTypes[appId]}`);
        return this.specialStoreTypes[appId];
    }
    
    // 2. Проверка по названию (если нужно)
    if (appName === 'wink') {
        return 'hisense';
    }
    
    // 3. Определяем по платформе
    if (typeof HiUtils_createRequest === 'function') {
        // Vidaa 9
        return 'custom';
    } else if (typeof WebSDK_createFileRequest === 'function') {
        // Vidaa 6
        return 'store'; // или 'webos'?
    } else if (typeof Hisense !== 'undefined' && typeof Hisense.File !== 'undefined') {
        // Vidaa 4-5, 7-8
        return 'store';
    }
    
    // 4. По умолчанию
    return 'store';
}
    

    // ==================== VIDAA 9 ФУНКЦ ====================
    readAppInfoVidaa9() {
        if (typeof HiUtils_createRequest !== 'function') {
            return { AppInfo: [] };
        }
        try {
            const current = HiUtils_createRequest('fileRead', {
                path: 'websdk/Appinfo.json',
                mode: 6
            });
            if (current && current.ret && current.msg) {
                return JSON.parse(current.msg);
            }
        } catch (e) {
            //console.error("Ошибка чтения Appinfo.json (Vidaa 9):", e);
        }
        return { AppInfo: [] };
    }

    writeAppInfoVidaa9(appsObj) {
        if (typeof HiUtils_createRequest !== 'function') {
            return false;
        }
        try {
            const result = HiUtils_createRequest('fileWrite', {
                path: 'websdk/Appinfo.json',
                mode: 6,
                writedata: JSON.stringify(appsObj)
            });
            return result && result.ret;
        } catch (e) {
            //console.error("Ошибка записи Appinfo.json (Vidaa 9):", e);
            return false;
        }
    }

    // ==================== VIDAA 6 ФУНКЦ ====================
    readAppInfoVidaa6() {
        if (typeof WebSDK_createFileRequest !== 'function') {
            return { AppInfo: [] };
        }
        try {
            const raw = WebSDK_createFileRequest("read", JSON.stringify({
                path: "websdk/Appinfo.json",
                mode: 6
            }));
            if (!raw || raw === "null" || raw.trim() === "") {
                return { AppInfo: [] };
            }
            return JSON.parse(raw);
        } catch (e) {
            //console.error("Ошибка чтения Appinfo.json (Vidaa 6):", e);
            return { AppInfo: [] };
        }
    }

    writeAppInfoVidaa6(appsObj) {
        if (typeof WebSDK_createFileRequest !== 'function') {
            return false;
        }
        try {
            const payload = JSON.stringify({
                path: "websdk/Appinfo.json",
                writedata: JSON.stringify(appsObj),
                mode: 6
            });
            const result = WebSDK_createFileRequest("write", payload);
            return result && typeof result === 'string' && result.indexOf("success") !== -1;
        } catch (e) {
            //console.error("Ошибка записи Appinfo.json (Vidaa 6):", e);
            return false;
        }
    }

    // ==================== VIDAA 4-5, 7-8 ФУНКЦ ====================
    readAppInfoHisense() {
        if (typeof Hisense === 'undefined' || typeof Hisense.File === 'undefined') {
            return { AppInfo: [] };
        }
        try {
            const current = Hisense.File.read("launcher/Appinfo.json", 1);
            if (current) {
                return JSON.parse(current);
            }
        } catch (e) {
            //console.error('Ошибка чтения Appinfo.json (Hisense):', e);
        }
        return { AppInfo: [] };
    }

    writeAppInfoHisense(appsObj) {
        if (typeof Hisense === 'undefined' || typeof Hisense.File === 'undefined') {
            return false;
        }
        try {
            const writedata = JSON.stringify(appsObj);
            Hisense.File.write("launcher/Appinfo.json", writedata, 1);
            return true;
        } catch (e) {
            //console.error('Ошибка записи Appinfo.json (Hisense):', e);
            return false;
        }
    }

    // ==================== VIDAA 5 ФУНКЦ ====================
    readAppInfoVidaa5() {
        // Для Vidaa 5 используем тот же Hisense API, что и для 4,7,8
        return this.readAppInfoHisense();
    }

    writeAppInfoVidaa5(appsObj) {
        // Для Vidaa 5 используем тот же Hisense API
        return this.writeAppInfoHisense(appsObj);
    }

    // ==================== VIDAA 3 ФУНКЦ ====================
    installAppVidaa3(appData) {
        //this.log('🔧 Установка через Vidaa 3 Debug Mode');
        const iconUrl = this.getAppIconUrl(appData, true);
        
        // Открываем страницу debug в iframe (чтобы не терять текущую страницу)
        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.top = '0';
        iframe.style.left = '0';
        iframe.style.width = '100%';
        iframe.style.height = '100%';
        iframe.style.zIndex = '9999';
        iframe.style.background = 'white';
        document.body.appendChild(iframe);

        // Загружаем debug страницу
        iframe.src = 'hisense://debug';

        // Ждем загрузки iframe
        iframe.onload = () => {
            setTimeout(() => {
                try {
                    const doc = iframe.contentDocument || iframe.contentWindow.document;
                    
                    // Находим поля формы
                    const appNameInput = doc.querySelector('input[name="AppName"]') || 
                                        doc.querySelector('#AppName') ||
                                        Array.from(doc.querySelectorAll('input')).find(i => 
                                            i.placeholder && i.placeholder.toLowerCase().includes('name'));
                    
                    const thumbnailInput = doc.querySelector('input[name="Thumbnail"]') || 
                                          doc.querySelector('#Thumbnail');
                    
                    const iconSmallInput = doc.querySelector('input[name="IconSmall"]') || 
                                          doc.querySelector('#IconSmall');
                    
                    const iconLargeInput = doc.querySelector('input[name="IconLarge"]') || 
                                          doc.querySelector('#IconLarge');
                    
                    const appUrlInput = doc.querySelector('input[name="AppUrl"]') || 
                                       doc.querySelector('#AppUrl') ||
                                       Array.from(doc.querySelectorAll('input')).find(i => 
                                           i.placeholder && i.placeholder.toLowerCase().includes('url'));

                    // Заполняем форму
                    if (appNameInput) appNameInput.value = appData.name;
                    if (thumbnailInput) thumbnailInput.value = iconUrl;
                    if (iconSmallInput) iconSmallInput.value = iconUrl;
                    if (iconLargeInput) iconLargeInput.value = iconUrl;
                    if (appUrlInput) appUrlInput.value = appData.url;

                    // Находим кнопку Install
                    const installButton = doc.querySelector('button[type="submit"]') ||
                                         doc.querySelector('input[type="submit"]') ||
                                         Array.from(doc.querySelectorAll('button')).find(btn => 
                                             btn.textContent.toLowerCase().includes('install'));

                    if (installButton) {
                        // Показываем уведомление
                        this.showNotification(`Установка ${appData.name}...`);
                        
                        // Создаем overlay с инструкцией
                        const overlay = doc.createElement('div');
                        overlay.style.cssText = `
                            position: fixed;
                            top: 50%;
                            left: 50%;
                            transform: translate(-50%, -50%);
                            background: rgba(0, 0, 0, 0.9);
                            color: white;
                            padding: 40px;
                            border-radius: 20px;
                            z-index: 10000;
                            text-align: center;
                            font-size: 24px;
                        `;
                        overlay.innerHTML = `
                            <h2 style="margin-bottom: 20px;">✓ Форма заполнена</h2>
                            <p style="margin-bottom: 20px;">Нажмите кнопку OK на пульте для установки</p>
                            <p style="font-size: 18px; opacity: 0.7;">ли нажмите кнопку Install ниже</p>
                        `;
                        doc.body.appendChild(overlay);

                        // Автоматически нажимаем Install через 2 секунды
                        setTimeout(() => {
                            installButton.click();
                            overlay.innerHTML = `
                                <h2 style="margin-bottom: 20px;">⏳ Установка...</h2>
                                <p>Дождитесь завершения установки</p>
                                <p style="font-size: 18px; opacity: 0.7; margin-top: 20px;">
                                    После завершения перезагрузите ТВ
                                </p>
                            `;
                            
                            // Закрываем iframe через 5 секунд
                            setTimeout(() => {
                                document.body.removeChild(iframe);
                                this.showNotification('Установка завершена! Перезагрузите ТВ');
                                
                                // Добавляем в список установленных (для отображения badge)
                                const AppJson = {
                                    Id: appData.name.replace(/\s+/g, '_') + "_debug",
                                    AppName: appData.name,
                                    Title: appData.name,
                                    URL: appData.url,
                                    StartCommand: appData.url,
                                    IconURL: iconUrl,
                                    Type: "Browser",
                                    InstallTime: new Date().toISOString().split('T')[0],
                                    RunTimes: 0,
                                    StoreType: "store",
                                    PreInstall: false
                                };
                                
                                // Добавляем в localStorage для отображения badge
                                try {
                                    let stored = localStorage.getItem('vidaa3_installed_apps');
                                    let apps = stored ? JSON.parse(stored) : [];
                                    if (!apps.some(a => a.URL === appData.url)) {
                                        apps.push(AppJson);
                                        localStorage.setItem('vidaa3_installed_apps', JSON.stringify(apps));
                                    }
                                } catch (e) {}
                                
                                this.installedApps = this.loadInstalledApps();
                                this.updateAppCards();
                                this.closeModal();
                            }, this.performanceMode.vidaa3CleanupDelay);
                        }, this.performanceMode.vidaa3AutofillDelay);
                    } else {
                        // Если кнопка не найдена, показываем инструкцию
                        const overlay = doc.createElement('div');
                        overlay.style.cssText = `
                            position: fixed;
                            top: 50%;
                            left: 50%;
                            transform: translate(-50%, -50%);
                            background: rgba(0, 0, 0, 0.95);
                            color: white;
                            padding: 40px;
                            border-radius: 20px;
                            z-index: 10000;
                            text-align: center;
                            font-size: 22px;
                            max-width: 80%;
                        `;
                        overlay.innerHTML = `
                            <h2 style="margin-bottom: 30px;">✓ Форма заполнена</h2>
                            <p style="margin-bottom: 20px;">Найдите и нажмите кнопку <strong>Install</strong></p>
                            <p style="font-size: 18px; opacity: 0.7;">После установки перезагрузите ТВ</p>
                            <button style="
                                margin-top: 30px;
                                padding: 15px 40px;
                                font-size: 20px;
                                background: #0066FF;
                                color: white;
                                border: none;
                                border-radius: 10px;
                                cursor: pointer;
                            ">Закрыть</button>
                        `;
                        doc.body.appendChild(overlay);
                        
                        overlay.querySelector('button').onclick = () => {
                            document.body.removeChild(iframe);
                        };
                    }

                } catch (e) {
                    //console.error('Ошибка при заполнении формы:', e);
                    this.showNotification('Ошибка доступа к Debug странице');
                    
                    // Показываем инструкцию вручную
                    setTimeout(() => {
                        document.body.removeChild(iframe);
                        alert(`Установка ${appData.name}:\n\n1. Откройте hisense://debug\n2. Заполните поля:\n   - AppName: ${appData.name}\n   - AppUrl: ${appData.url}\n   - конки: ${iconUrl}\n3. Нажмите Install\n4. Перезагрузите ТВ`);
                    }, this.performanceMode.vidaa3FallbackDelay);
                }
            }, this.performanceMode.vidaa3AutofillDelay);
        };

        // Если iframe не загрузился
        iframe.onerror = () => {
            document.body.removeChild(iframe);
            this.showNotification('Не удалось открыть Debug режим');
            alert(`Для установки на Vidaa 3:\n\n1. Откройте браузер и введите: hisense://debug\n2. Заполните поля:\n   - AppName: ${appData.name}\n   - AppUrl: ${appData.url}\n   - конки: ${iconUrl}\n3. Нажмите Install\n4. Перезагрузите ТВ`);
        };
    }

    // ==================== VIDAA 5 УСТАНОВКА ====================
    installAppVidaa5(appData) {
        //this.log('🔧 Установка через Vidaa 5 (TvBrowser/5.0)');
        
        // Для Vidaa 5 используем тот же механизм, что и для Vidaa 4-5, 7-8
        // Так как у него есть Hisense API, но нет WebSDK_createFileRequest
        
        const btn = document.querySelector('.install-btn');
        const originalContent = btn.innerHTML;
        
        btn.innerHTML = '⏳ Установка...';
        btn.style.background = 'linear-gradient(135deg, #00D9FF, #0066FF)';
        btn.disabled = true;

        setTimeout(() => {
            // Определяем StoreType
            const storeType = this.getStoreType(appData);
            
            const iconUrl = this.getAppIconUrl(appData, true);

            // Формируем объект приложения
            const AppJson = {
                Id: appData.name.replace(/\s+/g, '_') + "_debug",
                AppName: appData.name,
                Title: appData.name,
                URL: appData.url,
                StartCommand: appData.url,
                IconURL: iconUrl,
                Icon_96: iconUrl,
                Image: iconUrl,
                Thumb: iconUrl,
                Type: "Browser",
                InstallTime: new Date().toISOString().split('T')[0],
                RunTimes: 0,
                StoreType: storeType,
                PreInstall: false
            };

            // Проверяем дубликат
            const exists = this.installedApps.some(app => app.URL === appData.url);
            if (exists) {
                btn.innerHTML = '⚠️ Уже установлено';
                btn.style.background = 'linear-gradient(135deg, #ff9800, #f57c00)';
                setTimeout(() => {
                    btn.innerHTML = originalContent;
                    btn.disabled = false;
                    btn.style.background = '';
                }, 1200);
                return;
            }

            // Добавляем в список установленных
            this.installedApps.push(AppJson);

            // Сохраняем через Hisense API (так как у Vidaa 5 есть Hisense объект)
            const saved = this.writeAppInfoHisense({ AppInfo: this.installedApps });

            if (saved) {
                btn.innerHTML = `✓ Установлено`;
                btn.style.background = 'linear-gradient(135deg, #00C853, #00E676)';

                setTimeout(() => {
                    // Перезагружаем список установленных приложений
                    this.installedApps = this.loadInstalledApps();
                    this.updateAppCards();
                    this.updateInstallButton();
                    this.showNotification(`${appData.name} успешно установлено!`);

                    // Если мы в разделе "Установленные", обновляем его
                    if (this.currentTab === 'installed') {
                        this.filterInstalled();
                    }

                    btn.innerHTML = originalContent;
                    btn.disabled = false;
                    btn.style.background = '';
                }, this.performanceMode.installRefreshDelay);
            } else {
                btn.innerHTML = '❌ Ошибка';
                btn.style.background = 'linear-gradient(135deg, #f44336, #d32f2f)';
                setTimeout(() => {
                    btn.innerHTML = originalContent;
                    btn.disabled = false;
                    btn.style.background = '';
                }, this.performanceMode.errorResetDelay);
            }
        }, this.performanceMode.installStartDelay);
    }

    // ==================== УНВЕРСАЛЬНЫЕ ФУНКЦ ====================
    // Загрузка установленных приложений (автоопределение платформы)
    // СПРАВЛЕННЫЙ МЕТОД ЗАГРУЗК - нормализуем данные
loadInstalledApps() {
    this.log('📥 Загрузка установленных приложений...');
    
    let installed = [];
    
    // Vidaa 9
    if (typeof HiUtils_createRequest === 'function') {
        this.log('📱 Платформа: Vidaa OS 9');
        const data = this.readAppInfoVidaa9();
        installed = data.AppInfo || [];
    }
    // Vidaa 6
    else if (typeof WebSDK_createFileRequest === 'function') {
        this.log('📱 Платформа: Vidaa OS 6');
        const data = this.readAppInfoVidaa6();
        installed = data.AppInfo || [];
    }
    // Vidaa 4-5, 7-8
    else if (typeof Hisense !== 'undefined' && typeof Hisense.File !== 'undefined') {
        // Здесь могут быть Vidaa 4, 5, 7, 8
        // Проверяем, не Vidaa 5 ли это по User Agent
        const ua = navigator.userAgent.toLowerCase();
        if (ua.includes('tvbrowser/5.0') || ua.includes('tvbrowser5') || ua.includes('firefox/78.0')) {
            this.log('📱 Платформа: Vidaa OS 5 (TvBrowser/5.0)');
        } else {
            this.log('📱 Платформа: Vidaa OS 4-5, 7-8');
        }
        const data = this.readAppInfoHisense();
        installed = data.AppInfo || [];
    }
    // Vidaa 3 или Браузер
    else {
        this.log('📱 Платформа: Vidaa OS 3 или Браузер');
        try {
            const stored = localStorage.getItem('vidaa3_installed_apps');
            if (stored) {
                const parsed = JSON.parse(stored);
                this.log('📦 Сырые данные из localStorage:', parsed);
                
                // Нормализуем данные для Vidaa 3
                installed = parsed.map(app => ({
                    Id: app.Id || app.id,
                    AppName: app.AppName || app.name,
                    Title: app.Title || app.title,
                    URL: app.URL || app.url, // Важно!
                    StartCommand: app.StartCommand || app.startCommand,
                    IconURL: app.IconURL || app.icon,
                    Type: app.Type || 'Browser',
                    InstallTime: app.InstallTime || app.installTime,
                    StoreType: app.StoreType || 'store'
                }));
                this.log('✅ Нормализованные данные:', installed);
            }
        } catch (e) {
            console.error('Ошибка чтения localStorage:', e);
            installed = [];
        }
    }
    
    this.log('✅ Загружено установленных приложений:', installed.length);
    this.log('📋 Список:', installed.map(app => `${app.AppName} (${app.URL})`));
    this.rebuildInstalledIndex(installed);
    
    return installed;
}

rebuildInstalledIndex(installed = this.installedApps) {
    const apps = Array.isArray(installed) ? installed : [];

    this.installedUrlSet = new Set();
    this.installedNameSet = new Set();

    apps.forEach(app => {
        const url = app && (app.URL || app.url);
        const name = app && (app.AppName || app.Title || app.name);

        if (typeof url === 'string' && url.trim()) {
            this.installedUrlSet.add(url.trim());
        }

        if (typeof name === 'string' && name.trim()) {
            this.installedNameSet.add(name.trim().toLowerCase());
        }
    });
}

// Обновленный метод isAppInstalled с комбинированной проверкой
isAppInstalled(appUrl, appName) {
    if (!appUrl && !appName) return false;
    
    this.log(`🔍 Проверка: URL="${appUrl}", мя="${appName}"`);
    
    // ШАГ 1: Проверка по URL (самый надежный способ)
    if (appUrl && appUrl.trim() !== '') {
        const urlMatch = this.installedUrlSet.has(appUrl.trim());
        
        if (urlMatch) {
            this.log(`✅ Найдено по URL: ${appUrl}`);
            return true;
        }
        this.log(`❌ Не найдено по URL: ${appUrl}`);
    }
    
    // ШАГ 2: Если URL нет или не нашли, проверяем по имени
    if (appName && appName.trim() !== '') {
        const normalizedName = appName.trim().toLowerCase();
        const nameMatch = this.installedNameSet.has(normalizedName);
        
        if (nameMatch) {
            this.log(`✅ Найдено по имени: ${appName}`);
            return true;
        }
        this.log(`❌ Не найдено по имени: ${appName}`);
    }
    
    this.log(`❌ Приложение не найдено`);
    return false;
}

// Обновленный updateAppCards
updateAppCards() {
    this.log('🔄 Обновление карточек приложений...');
    
    const cards = this.cardElements.length ? this.cardElements : Array.from(document.querySelectorAll('.app-card'));
    
    cards.forEach((card, index) => {
        const app = card.__appData || this.apps[index];
        if (!app) return;

        const isInstalled = this.isAppInstalled(app.url, app.name);

        let badge = card.querySelector('.installed-badge');
        if (isInstalled) {
            if (!badge) {
                badge = document.createElement('div');
                badge.className = 'installed-badge';
                badge.innerHTML = '✓ Установлено';
                const icon = card.querySelector('.app-icon');
                if (icon) {
                    icon.style.position = 'relative';
                    icon.appendChild(badge);
                }
                card.classList.add('app-installed');
            }
        } else {
            if (badge) {
                badge.remove();
                card.classList.remove('app-installed');
            }
        }
    });
}

// Добавьте метод для принудительного обновления
refreshInstalledStatus() {
    this.log('🔄 Принудительное обновление статуса установки');
    this.installedApps = this.loadInstalledApps();
    this.updateAppCards();
    
    // Если мы в разделе "Установленные", обновляем отображение
    if (this.currentTab === 'installed') {
        this.filterInstalled();
    }
}


    // Сохранение установленных приложений (автоопределение платформы)
    saveInstalledApps() {
        const data = { AppInfo: this.installedApps };

        // Vidaa 9
        if (typeof HiUtils_createRequest === 'function') {
            const success = this.writeAppInfoVidaa9(data);
            if (success) {
                //this.log('✓ Сохранено в websdk/Appinfo.json (Vidaa 9)');
            }
            return success;
        }

        // Vidaa 6
        if (typeof WebSDK_createFileRequest === 'function') {
            const success = this.writeAppInfoVidaa6(data);
            if (success) {
                //this.log('✓ Сохранено в websdk/Appinfo.json (Vidaa 6)');
            }
            return success;
        }

        // Vidaa 4-5, 7-8
        if (typeof Hisense !== 'undefined' && typeof Hisense.File !== 'undefined') {
            const success = this.writeAppInfoHisense(data);
            if (success) {
                //this.log('✓ Сохранено в launcher/Appinfo.json (Hisense)');
            }
            return success;
        }

        // Vidaa 3 или Браузер
        try {
            localStorage.setItem('vidaa3_installed_apps', JSON.stringify(this.installedApps));
            //this.log('✓ Сохранено в localStorage (Vidaa 3/браузер)');
            return true;
        } catch (e) {
            //console.error('Ошибка localStorage:', e);
            return false;
        }
    }


    

    // Установка приложения
    installApp(appData = null) {

    if (!appData) {
        const appName = document.getElementById('modal-name').textContent;
        const appIndex = this.apps.findIndex(a => a.name === appName);
        if (appIndex === -1) return;
        appData = this.apps[appIndex];
    }

    const btn = document.querySelector('.install-btn');
    const isInstalled = this.isAppInstalled(appData.url);

    if (isInstalled) {
        this.uninstallApp(appData);
        return;
    }

    // ==================== VIDAA 3 ====================
    if (this.vidaaVersion.version === '3') {
        this.installAppVidaa3(appData);
        return;
    }

    // ==================== VIDAA 5 ====================
    if (this.vidaaVersion.version === '5') {
        this.installAppVidaa5(appData);
        return;
    }

    // ==================== VIDAA 4,6,7,8,9 ====================
    const originalContent = btn.innerHTML;
    btn.innerHTML = '⏳ Установка...';
    btn.style.background = 'linear-gradient(135deg, #00D9FF, #0066FF)';
    btn.disabled = true;

    setTimeout(() => {
        // Определяем StoreType красиво
        const storeType = this.getStoreType(appData);
        //this.log(`📦 Установка ${appData.name} с StoreType: ${storeType}`);

        const iconUrl = this.getAppIconUrl(appData, true);

        // Формируем объект приложения
        const AppJson = {
            Id: appData.name.replace(/\s+/g, '_') + "_debug",
            AppName: appData.name,
            Title: appData.name,
            URL: appData.url,
            StartCommand: appData.url,
            IconURL: iconUrl,
            Icon_96: iconUrl,
            Image: iconUrl,
            Thumb: iconUrl,
            Type: "Browser",
            InstallTime: new Date().toISOString().split('T')[0],
            RunTimes: 0,
            StoreType: storeType,
            PreInstall: false
        };

        // Проверяем дубликат
        const exists = this.installedApps.some(app => app.URL === appData.url);
        if (exists) {
            //this.log("Приложение уже установлено:", appData.name);
            btn.innerHTML = '⚠️ Уже установлено';
            btn.style.background = 'linear-gradient(135deg, #ff9800, #f57c00)';
            setTimeout(() => {
                btn.innerHTML = originalContent;
                btn.disabled = false;
                btn.style.background = '';
            }, 1200);
            return;
        }

        // Для Vidaa 9: перечитываем актуальный список перед установкой
        if (typeof HiUtils_createRequest === 'function') {
            const freshData = this.readAppInfoVidaa9();
            this.installedApps = freshData.AppInfo || [];

            // Проверяем по Id (для обновления существующего)
            const index = this.installedApps.findIndex(a => a.Id === AppJson.Id);
            if (index >= 0) {
                this.installedApps[index] = AppJson; // Обновляем
            } else {
                this.installedApps.push(AppJson); // Добавляем новое
            }
        } else {
            // Для других версий просто добавляем
            this.installedApps.push(AppJson);
        }

        // Сохраняем
        const saved = this.saveInstalledApps();

        if (saved) {
    btn.innerHTML = `✓ Установлено`;
    btn.style.background = 'linear-gradient(135deg, #00C853, #00E676)';

    setTimeout(() => {
        // Перезагружаем список установленных приложений
        this.installedApps = this.loadInstalledApps();
        this.updateAppCards();
        this.updateInstallButton();
        this.showNotification(`${appData.name} успешно установлено!`);

        // Если мы в разделе "Установленные", обновляем его
        if (this.currentTab === 'installed') {
            this.filterInstalled();
        }

        btn.innerHTML = originalContent;
        btn.disabled = false;
        btn.style.background = '';
    }, this.performanceMode.installRefreshDelay);
} else {
            btn.innerHTML = '❌ Ошибка';
            btn.style.background = 'linear-gradient(135deg, #f44336, #d32f2f)';
            setTimeout(() => {
                btn.innerHTML = originalContent;
                btn.disabled = false;
                btn.style.background = '';
            }, this.performanceMode.errorResetDelay);
        }
    }, this.performanceMode.installStartDelay);
}

    // Удаление приложения
    uninstallApp(appData) {
        const btn = document.querySelector('.install-btn');
        const originalContent = btn.innerHTML;
        
        btn.innerHTML = '⏳ Удаление...';
        btn.style.background = 'linear-gradient(135deg, #ff9800, #f57c00)';
        btn.disabled = true;

        setTimeout(() => {
            // Удаляем из массива
            this.installedApps = this.installedApps.filter(app => app.URL !== appData.url);
            this.rebuildInstalledIndex();

            // Сохраняем
            const saved = this.saveInstalledApps();

            if (saved) {
                btn.innerHTML = `✓ Удалено`;
                btn.style.background = 'linear-gradient(135deg, #607d8b, #455a64)';

                setTimeout(() => {
                    // Перезагружаем список установленных приложений
                    this.installedApps = this.loadInstalledApps();
                    this.updateAppCards();
                    this.updateInstallButton();
                    this.showNotification(`${appData.name} удалено`);

                    // Если мы в разделе "Установленные", обновляем его
                    if (this.currentTab === 'installed') {
                        this.filterInstalled();
                    }

                    btn.innerHTML = originalContent;
                    btn.disabled = false;
                    btn.style.background = '';
                }, this.performanceMode.uninstallRefreshDelay);
            }
        }, this.performanceMode.uninstallStartDelay);
    }


	// Обновление кнопки установки в модальном окне
    updateInstallButton() {
        const appName = document.getElementById('modal-name').textContent;
        const app = this.apps.find(a => a.name === appName);
        if (!app) return;

        const btn = document.querySelector('.install-btn');
        const isInstalled = this.isAppInstalled(app.url);

        if (isInstalled) {
            btn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24"><path d="M6 6h12v12H6z" stroke="currentColor" stroke-width="2" fill="none"/><path d="M9 9l6 6M15 9l-6 6" stroke="currentColor" stroke-width="2"/></svg> Удалить';
            btn.style.background = 'linear-gradient(135deg, #f44336, #d32f2f)';
        } else {
            btn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24"><path d="M12 2v14M7 12l5 5 5-5M5 20h14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg> Установить';
            btn.style.background = '';
        }
    }

    injectStyles() {
        const style = document.createElement('style');
        style.textContent = `
            ${this.isVidaaTV ? `
            /* Только для Vidaa TV - скрываем курсор */
            * {
                cursor: none !important;
                outline: none !important;
            }
            *:focus {
                outline: none !important;
            }
            body {
                cursor: none !important;
            }
            ` : `
            /* Для ПК - показываем курсор */
            * {
                outline: none !important;
            }
            *:focus {
                outline: none !important;
            }
            `}
            
            .installed-badge {
                position: absolute;
                top: 0px;
                right: 0px;
                background: linear-gradient(135deg, rgba(0, 200, 83, 0.6), rgba(0, 230, 118, 0.6));
                color: white;
                align-items: center;
                justify-content: center;
                font-size: 10px;
                padding: 4px 8px;
                border-radius: 6px;
                font-weight: 600;
                text-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
                z-index: 10;
            }
            
            .app-card.app-installed {
                border-color: #00C853;
            }
            
            .app-card.app-installed .app-icon {
                position: relative;
            }
            
            .menu-item.focused {
                background: #183253 !important;
                color: var(--text-main) !important;
                transform: none;
                box-shadow: 0 0 0 2px rgba(124, 232, 210, 0.22);
            }
            
            .app-card.focused {
                transform: none;
                border-color: rgba(124, 232, 210, 0.3) !important;
                box-shadow: 0 0 0 2px rgba(124, 232, 210, 0.22);
                background: #173050;
                z-index: 10;
            }
            
            .modal-close.focused,
            .install-btn.focused {
                transform: none;
                box-shadow: 0 0 0 2px rgba(124, 232, 210, 0.22);
            }
            
            .app-card.focused {
                scroll-margin: 100px;
            }
        `;
        document.head.appendChild(style);
    }

    updateFocusableElements() {
        this.focusableElements = [];
        
        if (this.modal.classList.contains('active')) {
            this.focusableElements.push(
                document.querySelector('.install-btn'),
                document.querySelector('.modal-close')
            );
        } else {
            const menuItems = Array.from(document.querySelectorAll('.menu-item'));
            const visibleCards = Array.from(document.querySelectorAll('.app-card'))
                .filter(card => card.style.display !== 'none');
            this.focusableElements = [...menuItems, ...visibleCards];
        }
        
        this.focusableElements = this.focusableElements.filter(el => el);
    }

    setFocus(index) {
        document.querySelectorAll('.focused').forEach(el => {
            el.classList.remove('focused');
        });
        
        if (index < 0) index = 0;
        if (index >= this.focusableElements.length) {
            index = this.focusableElements.length - 1;
        }
        
        this.focusIndex = index;
        const element = this.focusableElements[index];
        
        if (element) {
            element.classList.add('focused');
            
            // Только для Vidaa TV делаем автопрокрутку
            if (this.isVidaaTV && !this.isElementFullyVisible(element)) {
                element.scrollIntoView({
                    behavior: 'auto',
                    block: 'center',
                    inline: 'nearest'
                });
            }
        }
    }

    isElementFullyVisible(element) {
        const rect = element.getBoundingClientRect();
        const viewHeight = window.innerHeight || document.documentElement.clientHeight;
        const viewWidth = window.innerWidth || document.documentElement.clientWidth;

        return rect.top >= 80 && rect.left >= 0 && rect.bottom <= viewHeight - 80 && rect.right <= viewWidth;
    }

    navigate(direction) {
        const totalElements = this.focusableElements.length;
        if (totalElements === 0) return;

        if (this.modal.classList.contains('active')) {
            if (direction === 'down' || direction === 'right') {
                this.setFocus(this.focusIndex + 1);
            } else if (direction === 'up' || direction === 'left') {
                this.setFocus(this.focusIndex - 1);
            }
        } else {
            const menuCount = document.querySelectorAll('.menu-item').length;
            
            if (this.focusIndex < menuCount) {
                if (direction === 'down') {
                    this.setFocus(this.focusIndex + 1);
                } else if (direction === 'up') {
                    this.setFocus(this.focusIndex - 1);
                } else if (direction === 'right') {
                    this.setFocus(menuCount);
                }
            } else {
                if (direction === 'left') {
                    this.setFocus(menuCount - 1);
                } else if (direction === 'down') {
					const columns = 3;
					this.setFocus(this.focusIndex + columns);
                } else if (direction === 'up') {
                    const newIndex = this.focusIndex - 3;
                    if (newIndex < menuCount) {
                        this.setFocus(menuCount);
                    } else {
                        this.setFocus(newIndex);
                    }
                } else if (direction === 'right') {
                    this.setFocus(this.focusIndex + 1);
                }
            }
        }
    }

    handleOK() {
        const focused = this.focusableElements[this.focusIndex];
        if (!focused) return;

        if (focused.classList.contains('menu-item')) {
            const tab = focused.dataset.tab;
            this.switchTab(tab);
        }
        else if (focused.classList.contains('app-card')) {
            this.openAppModal(focused);
        }
        else if (focused.classList.contains('install-btn')) {
            this.installApp();
        }
        else if (focused.classList.contains('modal-close')) {
            this.closeModal();
        }
    }

    handleBack() {
        if (this.modal.classList.contains('active')) {
            this.closeModal();
        } else if (this.currentTab !== 'all') {
            this.switchTab('all');
        }
    }

    setupMouseClicks() {
        document.addEventListener('click', (e) => {
            const menuItem = e.target.closest('.menu-item');
            const appCard = e.target.closest('.app-card');
            const modalClose = e.target.closest('.modal-close');
            const installBtn = e.target.closest('.install-btn');

            if (menuItem) {
                this.switchTab(menuItem.dataset.tab);
                const index = this.focusableElements.indexOf(menuItem);
                if (index >= 0) this.setFocus(index);
            } else if (appCard && appCard.style.display !== 'none') {
                this.openAppModal(appCard);
            } else if (modalClose || e.target === this.modal) {
                this.closeModal();
            } else if (installBtn) {
                this.installApp();
            }
        });
        
        // Добавляем hover эффект для ПК (обновление фокуса при наведении мышки)
        if (!this.isVidaaTV) {
            document.addEventListener('mouseover', (e) => {
                const focusable = e.target.closest('.menu-item, .app-card, .install-btn, .modal-close');
                if (focusable) {
                    const index = this.focusableElements.indexOf(focusable);
                    if (index >= 0) {
                        this.setFocus(index);
                    }
                }
            });
        }
    }

    switchTab(tabName) {
        this.currentTab = tabName;

        document.querySelectorAll('.menu-item').forEach(item => {
            item.classList.remove('active');
            if (item.dataset.tab === tabName) {
                item.classList.add('active');
            }
        });

        if (tabName === 'info') {
            document.querySelectorAll('.tab-content').forEach(tab => {
                tab.classList.remove('active');
            });
            document.getElementById('tab-info').classList.add('active');
        } else if (tabName === 'installed') {
            document.querySelectorAll('.tab-content').forEach(tab => {
                tab.classList.remove('active');
            });
            document.getElementById('tab-all').classList.add('active');
            this.filterInstalled();
        } else {
            document.querySelectorAll('.tab-content').forEach(tab => {
                tab.classList.remove('active');
            });
            document.getElementById('tab-all').classList.add('active');
            this.filterApps(tabName);
        }

        this.updateFocusableElements();
        const menuCount = document.querySelectorAll('.menu-item').length;
        this.setFocus(menuCount);
    }

    filterApps(category) {
    const cards = document.querySelectorAll('.app-card');
    let visibleCount = 0;

    cards.forEach(card => {
        const cardCategory = card.dataset.category || '';
        const shouldShow = category === 'all' || cardCategory.toLowerCase() === category.toLowerCase();

        card.style.display = shouldShow ? 'flex' : 'none';
        if (shouldShow) visibleCount++;
    });

    this.showEmptyMessage(visibleCount === 0);
}

filterInstalled() {
    this.log('=== ФЛЬТРАЦЯ УСТАНОВЛЕННЫХ ===');
    
    const cards = this.cardElements.length ? this.cardElements : Array.from(document.querySelectorAll('.app-card'));
    let visibleCount = 0;

    cards.forEach((card) => {
        const app = card.__appData;
        const isInstalled = app ? this.isAppInstalled(app.url, app.name) : false;

        if (isInstalled) {
            card.style.display = 'flex';
            visibleCount++;
        } else {
            card.style.display = 'none';
        }
    });

    this.log('👁️ Видимых карточек:', visibleCount);
    this.showEmptyMessage(visibleCount === 0, 'У вас пока нет установленных приложений');
    this.updateFocusableElements();
}

// Добавьте метод для синхронизации URL из установленных приложений
syncUrlsFromInstalled() {
    this.log('🔄 Синхронизация URL из установленных приложений...');
    
    // Создаем карту URL по имени приложения
    const urlMap = {};
    this.installedApps.forEach(app => {
        if (app.URL) {
            const name = app.AppName || app.Title;
            if (name) {
                urlMap[name] = app.URL;
                this.log(`📌 ${name} -> ${app.URL}`);
            }
        }
    });
    
    // Обновляем URL в this.apps
    let updatedCount = 0;
    this.apps = this.apps.map(app => {
        if (!app.url && urlMap[app.name]) {
            app.url = urlMap[app.name];
            updatedCount++;
            this.log(`✅ URL добавлен для ${app.name}: ${app.url}`);
        }
        return app;
    });
    
    this.log(`✅ Обновлено URL: ${updatedCount}`);
}

    showEmptyMessage(show, customText = null) {
        let emptyMsg = document.querySelector('.empty-message');
        
        if (show) {
            if (!emptyMsg) {
                emptyMsg = document.createElement('div');
                emptyMsg.className = 'empty-message';
                emptyMsg.innerHTML = `
                    <svg width="100" height="100" viewBox="0 0 24 24" style="opacity: 0.3;">
                        <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/>
                        <path d="M8 12h8M12 8v8" stroke="currentColor" stroke-width="2"/>
                    </svg>
                    <h3>${customText || 'Приложений не найдено'}</h3>
                    <p>${customText ? 'Установите приложения из каталога' : 'В этой категории пока нет приложений'}</p>
                `;
                document.querySelector('.apps-grid').appendChild(emptyMsg);
            }
            emptyMsg.style.display = 'flex';
        } else if (emptyMsg) {
            emptyMsg.style.display = 'none';
        }
    }


    closeModal() {
        this.modal.classList.remove('active');
        document.body.style.overflow = 'auto';

        this.updateFocusableElements();
        const menuCount = document.querySelectorAll('.menu-item').length;
        this.setFocus(menuCount);
    }

    showNotification(message) {
        let notification = document.querySelector('.notification');

        if (!notification) {
            notification = document.createElement('div');
            notification.className = 'notification';
            document.body.appendChild(notification);
        }

        notification.textContent = message;
        notification.style.display = 'block';

        if (this.notificationTimer) {
            clearTimeout(this.notificationTimer);
        }

        if (this.notificationRemoveTimer) {
            clearTimeout(this.notificationRemoveTimer);
        }

        this.notificationTimer = setTimeout(() => {
            notification.style.display = 'none';
        }, this.performanceMode.notificationDuration);
    }

    detectVidaaVersion() {
    let OS = '';
    let version = 'не определена';
    let firmware = '';
    
    // Получаем User Agent для дополнительных проверок
    const ua = navigator.userAgent.toLowerCase();
    
    // Сначала проверим User Agent на явные признаки TvBrowser (Vidaa 5)
    if (ua.includes('tvbrowser/5.0') || ua.includes('tvbrowser5')) {
        version = '5';
        OS = 'U05';
        this.log('📺 Определено по TvBrowser/5.0: Vidaa 5');
        return {
            version: version,
            os: OS,
            firmware: firmware,
            fullVersion: `5 (${OS}) ${firmware}`
        };
    }
    
    // ==================== VIDAA 9 ====================
    if (typeof HiUtils_createRequest === 'function') {
        version = '9';
        OS = 'U09';
        this.log('📺 Определено по HiUtils_createRequest: Vidaa 9');
    }
    // ==================== VIDAA 6 ====================
    else if (typeof WebSDK_createFileRequest === 'function') {
        // Дополнительная проверка: в Vidaa 3 тоже может быть эта функция, 
        // но в Vidaa 6 обычно есть и другие признаки
        // Проверяем User Agent на наличие Vidaa 6 признаков
        const isVidaa6UA = ua.includes('vidaa6') || ua.includes('u06') || ua.includes('webos');
        
        // Проверяем наличие других Vidaa 6 специфичных функций
        const hasVidaa6Features = typeof window.HiSys !== 'undefined' || 
                                  typeof window.HiEvent !== 'undefined' ||
                                  typeof window.HiPlayer !== 'undefined';
        
        if (isVidaa6UA || hasVidaa6Features || ua.includes('hibrowser')) {
            version = '6';
            OS = 'U06';
            this.log('📺 Определено по WebSDK_createFileRequest и признакам: Vidaa 6');
        } else {
            // Если нет дополнительных признаков Vidaa 6, проверяем Vidaa 3
            this.log('⚠️ Найдена WebSDK_createFileRequest, но нет признаков Vidaa 6, проверяем Vidaa 3');
            
            // Проверяем признаки Vidaa 3
            if (ua.includes('vidaa3') || ua.includes('u03') || ua.includes('smart-tv') && !ua.includes('webos')) {
                version = '3';
                OS = 'U03';
                this.log('📺 Определено по User Agent: Vidaa 3');
            } else {
                // По умолчанию оставляем как Vidaa 6
                version = '6';
                OS = 'U06';
                this.log('📺 Предположительно Vidaa 6 (по WebSDK_createFileRequest)');
            }
        }
    }
    // ==================== VIDAA 4-5, 7-8 (Hisense API) ====================
    else if (typeof Hisense !== 'undefined' && typeof Hisense.File !== 'undefined') {
        try {
            if (typeof Hisense_GetOSVersion === 'function') {
                OS = Hisense_GetOSVersion();
            }
            if (typeof Hisense_GetFirmWareVersion === 'function') {
                firmware = Hisense_GetFirmWareVersion();
            }
        } catch (e) {}
        
        // Определяем версию по OS строке
        if (OS.indexOf("U9") >= 0 || /^U09\./.test(OS)) {
            version = '9';
        } else if (OS.indexOf("U8") >= 0 || /^U08\./.test(OS)) {
            version = '8';
        } else if (OS.indexOf("U7") >= 0 || OS.indexOf("U07") >= 0) {
            version = '7';
        } else if (OS.indexOf("U6") >= 0 || OS.indexOf("U06") >= 0) {
            version = '6';
        } else if (OS.indexOf("U5") >= 0 || OS.indexOf("U05") >= 0) {
            version = '5';
        } else if (OS.indexOf("U4") >= 0) {
            version = '4';
        } else if (OS.indexOf("U3") >= 0) {
            version = '3';
        } else {
            // Если OS не дала версию, но есть TvBrowser в User Agent
            if (ua.includes('tvbrowser/5.0') || ua.includes('tvbrowser5')) {
                version = '5';
                OS = 'U05';
            } else {
                version = '4 или старше';
            }
        }
        
        this.log(`📺 Определено по Hisense API: Vidaa ${version}`);
    }
    // ==================== VIDAA 3 (без API) ====================
    else {
        // Проверяем User Agent на Vidaa 3
        if (ua.includes('vidaa3') || ua.includes('u03') || 
            (ua.includes('smart-tv') && ua.includes('hisense') && !ua.includes('webos'))) {
            version = '3';
            OS = 'U03';
            this.log('📺 Определено по User Agent: Vidaa 3');
        }
        // Проверяем наличие debug режима (характерно для Vidaa 3)
        else if (window.location.protocol === 'hisense:' || document.referrer.includes('debug')) {
            version = '3';
            OS = 'U03';
            this.log('📺 Определено по debug режиму: Vidaa 3');
        }
        // Если ничего не нашли, проверяем браузер
        else {
            const isTVBrowser = ua.includes('hibrowser') || ua.includes('smart-tv') || ua.includes('hisense');
            if (isTVBrowser) {
                // Проверяем на TvBrowser/5.0 еще раз (на всякий случай)
                if (ua.includes('tvbrowser/5.0') || ua.includes('tvbrowser5')) {
                    version = '5';
                    OS = 'U05';
                } else {
                    version = '4 или старше';
                }
                this.log(`📺 Определено по браузеру: Vidaa ${version}`);
            }
        }
    }
    
    return {
        version: version,
        os: OS,
        firmware: firmware,
        fullVersion: version !== 'не определена' ? `${version} (${OS}) ${firmware}` : 'не определена'
    };
}

// Добавьте также метод для дополнительной проверки Vidaa 3
isVidaa3() {
    const ua = navigator.userAgent.toLowerCase();
    
    // Проверка по User Agent
    if (ua.includes('vidaa3') || ua.includes('u03')) {
        return true;
    }
    
    // Проверка по отсутствию современных API при наличии Hisense
    if (typeof Hisense !== 'undefined') {
        // В Vidaa 3 нет WebSDK_createFileRequest, но может быть Hisense
        if (typeof WebSDK_createFileRequest !== 'function' && 
            typeof HiUtils_createRequest !== 'function') {
            
            // Проверка на старый браузер
            const isOldBrowser = !window.Promise || !window.fetch || !window.Symbol;
            
            if (isOldBrowser && ua.includes('hisense')) {
                return true;
            }
        }
    }
    
    return false;
}

// Метод для проверки, является ли устройство Vidaa 5
isVidaa5() {
    const ua = navigator.userAgent.toLowerCase();
    return ua.includes('tvbrowser/5.0') || ua.includes('tvbrowser5');
}


    setupDeviceInfo() {

    const ua = navigator.userAgent;
    let browser = 'Неизвестный';
    let browserEngine = '';

    if (ua.indexOf('HiBrowser') > -1) {
        browser = 'HiBrowser';
        browserEngine = 'на Chromium';
    } else if (ua.indexOf('Chrome') > -1) {
        browser = 'Chrome';
        const version = ua.match(/Chrome\/(\d+)/);
        if (version) browserEngine = `на Chromium ${version[1]}`;
    } else if (ua.indexOf('Safari') > -1) {
        browser = 'Safari';
        browserEngine = 'на WebKit';
    } else if (ua.indexOf('Firefox') > -1) {
        browser = 'Firefox';
        browserEngine = 'на Gecko';
    } else if (ua.indexOf('TvBrowser') > -1 || ua.indexOf('tvbrowser') > -1) {
        browser = 'TvBrowser';
        const version = ua.match(/TvBrowser\/(\d+\.\d+)/i);
        if (version) browserEngine = `версия ${version[1]}`;
    }

    let platform = 'Неизвестная';
    let platformDetails = '';

    if (this.vidaaVersion.version !== 'не определена') {
        platform = 'Vidaa OS';
        platformDetails = this.vidaaVersion.fullVersion;
    } else if (typeof Hisense !== 'undefined') {
        platform = 'Vidaa OS';
        platformDetails = '4 или старше';
    } else if (ua.indexOf('Android') > -1) {
        platform = 'Android';
    } else if (ua.indexOf('iPhone') > -1 || ua.indexOf('iPad') > -1) {
        platform = 'iOS';
    } else if (ua.indexOf('Windows') > -1) {
        platform = 'Windows';
    } else if (ua.indexOf('Mac') > -1) {
        platform = 'macOS';
    } else if (ua.indexOf('Linux') > -1) {
        platform = 'Linux';
    }

    const platformInfo = document.getElementById('platform-info');
    if (platformInfo) {
        platformInfo.innerHTML = platformDetails ? `${platform}: ${platformDetails}` : platform;
    }

    const browserInfo = document.getElementById('browser-info');
    if (browserInfo) {
        browserInfo.innerHTML = browserEngine ? `${browser}: ${browserEngine}` : browser;
    }

    const screenInfo = document.getElementById('screen-info');
    if (screenInfo) {
        screenInfo.textContent = `${window.screen.width} × ${window.screen.height}px`;
    }


}


updateDeviceUUIDInfo() {
    const idEl = document.getElementById("device-id");
    const uuidEl = document.getElementById("device-uuid");

    if (idEl) idEl.textContent = this.getDeviceId();
    if (uuidEl) uuidEl.textContent = this.getPersonalUUID();
}

}

// нициализация
document.addEventListener('DOMContentLoaded', () => {
    new VidaaStore();
});
