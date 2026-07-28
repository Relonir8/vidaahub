
class VidaaStore {
    constructor() {
        this.DEBUG = false;
        this.apps = []; 
        this.categories = [];
        this.modal = document.getElementById('app-modal');
        this.currentTab = 'all';
        this.vidaaVersion = this.detectVidaaVersion(); 
        this.focusIndex = 0;
        this.focusableElements = [];

        
        this.isVidaaTV = this.detectVidaaTV();
        this.cardElements = [];
        this.notificationTimer = null;
        this.notificationRemoveTimer = null;
        this.supportsHistory = typeof window !== 'undefined' && !!window.history && typeof window.history.pushState === 'function' && typeof window.history.replaceState === 'function';
        this.isHandlingHistoryNavigation = false;
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
        
        this.installedApps = this.loadInstalledApps();
        
        
        this.specialStoreTypes = {
            'vidaappcfd': 'custom',
            'lampa': 'hisense',
            'zona': 'hisense',
            'vidaatube': 'hisense'
        };
		
		
        this.redButtonPressCount = 0;
        this.redButtonTimer = null;
        
        this.init();
    }
    
    
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
    

    await this.loadAppsFromAPI();
    this.renderCategoryMenu();
    
    
    this.syncUrlsFromInstalled()
    
    this.applyPerformanceMode();
    this.injectStyles();
    this.setupBrowserHistory();
    this.setupKeyboardNavigation();
    this.setupMouseClicks();
    
    this.renderAppCards();
    
    
        
    setTimeout(() => {
        this.refreshInstalledStatus();
    }, this.performanceMode.installRefreshDelay);
    
    this.updateFocusableElements();
    this.setFocus(0);
}

    getBaseHistoryState(tab = this.currentTab || 'all') {
        return {
            vidaaHub: true,
            modalOpen: false,
            tab
        };
    }

    getHistoryTab(state = window.history.state) {
        if (state && state.vidaaHub && typeof state.tab === 'string' && state.tab) {
            return state.tab;
        }

        return 'all';
    }

    setupBrowserHistory() {
        if (!this.supportsHistory) {
            return;
        }

        const currentState = window.history.state;
        if (!currentState || !currentState.vidaaHub) {
            window.history.replaceState(this.getBaseHistoryState(), document.title, window.location.href);
        } else if (currentState.modalOpen) {
            window.history.replaceState({ ...currentState, modalOpen: false, tab: this.getHistoryTab(currentState) }, document.title, window.location.href);
        }

        window.addEventListener('popstate', () => {
            if (this.isHandlingHistoryNavigation) {
                this.isHandlingHistoryNavigation = false;
                return;
            }

            if (this.modal.classList.contains('active')) {
                this.closeModal({ skipHistorySync: true });
            }

            const targetTab = this.getHistoryTab();
            if (this.currentTab !== targetTab) {
                this.switchTab(targetTab, { skipHistorySync: true });
            }
        });
    }

    syncHistoryForTab(tabName, replace = false) {
        if (!this.supportsHistory) {
            return;
        }

        const currentState = window.history.state;
        const currentTab = this.getHistoryTab(currentState);
        const nextState = this.getBaseHistoryState(tabName);

        if (currentState && currentState.vidaaHub && currentState.modalOpen) {
            return;
        }

        if (currentState && currentState.vidaaHub && currentTab === tabName) {
            if (replace) {
                window.history.replaceState(nextState, document.title, window.location.href);
            }
            return;
        }

        if (replace) {
            window.history.replaceState(nextState, document.title, window.location.href);
        } else {
            window.history.pushState(nextState, document.title, window.location.href);
        }
    }

    pushModalHistoryState() {
        if (!this.supportsHistory) {
            return;
        }

        const nextState = {
            ...this.getBaseHistoryState(this.currentTab),
            modalOpen: true
        };
        const currentState = window.history.state;

        if (currentState && currentState.vidaaHub && currentState.modalOpen) {
            window.history.replaceState(nextState, document.title, window.location.href);
            return;
        }

        window.history.pushState(nextState, document.title, window.location.href);
    }

    syncHistoryAfterModalClose() {
        if (!this.supportsHistory) {
            return false;
        }

        const currentState = window.history.state;
        const nextState = this.getBaseHistoryState(this.currentTab);

        if (currentState && currentState.vidaaHub && currentState.modalOpen) {
            this.isHandlingHistoryNavigation = true;
            window.history.back();
            return true;
        }

        if (currentState && currentState.vidaaHub) {
            window.history.replaceState(nextState, document.title, window.location.href);
        }

        return false;
    }

    syncHistoryAfterTabReset() {
        if (!this.supportsHistory || this.currentTab === 'all') {
            return false;
        }

        const currentState = window.history.state;
        if (currentState && currentState.vidaaHub && !currentState.modalOpen && this.getHistoryTab(currentState) === this.currentTab) {
            this.isHandlingHistoryNavigation = true;
            window.history.back();
            return true;
        }

        return false;
    }

    applyPerformanceMode() {
        document.body.classList.toggle('tv-performance', this.isVidaaTV);
    }

    detectVidaaTV() {
        const ua = navigator.userAgent.toLowerCase();
        const isVidaaUA = /vidaa|hisense|hibrowser/.test(ua);
        const hasNativeAPI =
            typeof HiUtils_createRequest === 'function' ||
            typeof WebSDK_createFileRequest === 'function' ||
            (typeof Hisense !== 'undefined' && typeof Hisense.File !== 'undefined');
        return !!(hasNativeAPI || isVidaaUA);
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

        const categoryOrder = ['Медиа', 'ТВ-Каналы'];
        this.categories = [...new Set(this.apps.map(app => app.category).filter(Boolean))].sort((left, right) => {
            const leftIndex = categoryOrder.indexOf(left);
            const rightIndex = categoryOrder.indexOf(right);

            if (leftIndex === -1 && rightIndex === -1) {
                return left.localeCompare(right, 'ru');
            }

            if (leftIndex === -1) {
                return 1;
            }

            if (rightIndex === -1) {
                return -1;
            }

            return leftIndex - rightIndex;
        });
    } catch (error) {
        console.error('Ошибка загрузки каталога:', error);
        this.showNotification('Ошибка загрузки каталога');
        this.apps = [];
        this.categories = [];
    }
}

    getCategoryIcon(category) {
        const icons = {
            'Медиа': `
                <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
                    <rect x="3" y="5" width="18" height="14" rx="3" stroke="currentColor" stroke-width="1.5" fill="none"/>
                    <path d="M10 9.5L15 12L10 14.5V9.5Z" fill="currentColor"/>
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

    getCategoryLabel(category) {
        const labels = {};

        return labels[category] || category;
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
                <span>${this.getCategoryLabel(category)}</span>
            `;
            container.appendChild(button);
        });
    }

    async getAppDetails(appid) {
        try {
            return this.apps.find(app => app.appid === appid) || null;
        } catch (error) {
            console.error('Ошибка получения данных приложения:', error);
            this.showNotification('Ошибка получения данных приложения');
            return null;
        }
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

            
            const iconWrap = document.createElement('div');
            iconWrap.className = 'app-icon';

            const img = document.createElement('img');
            img.src = app.icon;
            img.alt = app.name;
            img.loading = 'lazy';
            img.decoding = 'async';

            iconWrap.appendChild(img);

            
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

    
    setupKeyboardNavigation() {
        document.addEventListener('keydown', (e) => {
            const code = e.key || e.keyCode;
            
            
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
        

        
        this.showNotification(`🔴 ${this.redButtonPressCount}/3`);

        if (this.redButtonTimer) {
            clearTimeout(this.redButtonTimer);
        }
        
        this.redButtonTimer = setTimeout(() => {
            this.redButtonPressCount = 0;
        }, 10000);
        
        
        if (this.redButtonPressCount >= 3) {
            this.redButtonPressCount = 0;
            clearTimeout(this.redButtonTimer);
            this.openDebugMode();
        }
    }

    openDebugMode() {
    
    this.showNotification('🔧 Переход в Debug режим...');

    setTimeout(() => {

        let opened = false;

        
        try {
            if (window.Hisense && Hisense.System && typeof Hisense.System.launch === "function") {
                
                Hisense.System.launch('hisense://debug');
                opened = true;
            }
        } catch (e) {
            
        }

        
        if (!opened) {
            try {
                if (window.Hisense && Hisense.Browser && typeof Hisense.Browser.open === "function") {
                    
                    Hisense.Browser.open('hisense://debug');
                    opened = true;
                }
            } catch (e) {
                
            }
        }

        
        if (!opened) {
            try {
                if (typeof HiUtils_createRequest === "function") {
                    
                    HiUtils_createRequest("openBrowser", { url: "hisense://debug" });
                    opened = true;
                }
            } catch (e) {
                
            }
        }

        
        if (!opened) {
            try {
                if (typeof WebSDK_createFileRequest === "function") {
                    
                    WebSDK_createFileRequest("open", JSON.stringify({ url: "hisense://debug" }));
                    opened = true;
                }
            } catch (e) {
                
            }
        }

        
        if (!opened) {
            try {
                
                window.location.href = 'hisense://debug';
                opened = true;
            } catch (e) {
                
            }
        }

        
        setTimeout(() => {
            if (!opened) {
                

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

    
    async openAppModal(card) {
        const appid = card.dataset.appid;
        const index = parseInt(card.dataset.index);

        
        const appDetails = await this.getAppDetails(appid);
        
        if (!appDetails) {
            this.showNotification('Ошибка загрузки данных приложения');
            return;
        }
        
        
        this.apps[index] = { ...this.apps[index], ...appDetails };
        
        
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

        this.modal.dataset.appid = appDetails.appid || appid;
        
        this.modal.classList.add('active');
        document.body.style.overflow = 'hidden';
        this.pushModalHistoryState();
        this.updateInstallButton();
        this.updateFocusableElements();
        this.setFocus(0);
    }
    
    
    
isAllowedStoreType(value) {
    const type = value ? String(value).toLowerCase().trim() : '';
    return {
        hisense: true,
        store: true,
        browser: true,
        opera: true,
        hbbtv: true,
        netrange: true,
        foxxum: true,
        custom: true
    }[type] === true;
}

isVidaa6() {
    const version = this.vidaaVersion || {};
    return version.version === '6' ||
        version.version === '6.01' ||
        version.os === 'U06' ||
        /U0?6/i.test(String(version.os || '')) ||
        /U0?6/i.test(String(version.fullVersion || '')) ||
        /V0006\./i.test(String(version.firmware || ''));
}

isVidaa960() {
    const version = this.vidaaVersion || {};
    return version.version === '9.60' ||
        /U09\.60/i.test(String(version.osVersion || '')) ||
        /\.09\.60\./.test(String(version.firmware || ''));
}

getStoreType(appData) {
    const appId = appData && appData.appid ? String(appData.appid).toLowerCase().trim() : '';
    const appName = appData && appData.name ? String(appData.name).toLowerCase().trim() : '';
    const commonType = appData && appData.store_type ? String(appData.store_type).toLowerCase().trim() : '';
    const vidaa6Type = appData && appData.store_type_vidaa6 ? String(appData.store_type_vidaa6).toLowerCase().trim() : '';

    if (this.isVidaa6() && this.isAllowedStoreType(vidaa6Type)) {
        return vidaa6Type;
    }

    if (this.isAllowedStoreType(commonType)) {
        return commonType;
    }

    if (this.specialStoreTypes[appId]) {
        return this.specialStoreTypes[appId];
    }

    if (appName === 'wink') {
        return 'hisense';
    }

    if (typeof HiUtils_createRequest === 'function') {
        return 'custom';
    } else if (typeof WebSDK_createFileRequest === 'function') {
        return 'store'; 
    } else if (typeof Hisense !== 'undefined' && typeof Hisense.File !== 'undefined') {
        return 'store';
    }

    return 'store';
}

buildAppInfoEntry(appData, iconUrl = null) {
    const safeName = String((appData && appData.name) || (appData && appData.appid) || 'app');
    const resolvedIconUrl = iconUrl || this.getAppIconUrl(appData, true);

    return {
        Id: safeName.replace(/\s+/g, '_') + "_debug",
        AppName: safeName,
        Title: safeName,
        URL: appData.url,
        StartCommand: appData.url,
        IconURL: resolvedIconUrl,
        Icon_96: resolvedIconUrl,
        Image: resolvedIconUrl,
        Thumb: resolvedIconUrl,
        Type: "Browser",
        InstallTime: new Date().toISOString().split('T')[0],
        RunTimes: 0,
        StoreType: this.getStoreType(appData),
        PreInstall: false
    };
}
    

    
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
            
        }
        return { AppInfo: [] };
    }

    writeAppInfoHiUtilsAt(path, mode, appsObj) {
        if (typeof HiUtils_createRequest !== 'function') {
            return false;
        }
        try {
            const result = HiUtils_createRequest('fileWrite', {
                path,
                mode,
                writedata: JSON.stringify(appsObj)
            });
            return !!(result && result.ret);
        } catch (e) {
            
            return false;
        }
    }

    writeAppInfoVidaa9(appsObj) {
        return this.writeAppInfoHiUtilsAt('websdk/Appinfo.json', 6, appsObj);
    }

    isValidAppInfoData(data) {
        return !!(data && Array.isArray(data.AppInfo));
    }

    readAppInfoWebSDK(path, mode) {
        if (typeof WebSDK_createFileRequest !== 'function') {
            return null;
        }
        try {
            const raw = WebSDK_createFileRequest("read", JSON.stringify({
                path,
                mode
            }));

            if (raw === null || typeof raw === 'undefined') {
                return null;
            }

            const trimmed = String(raw).trim();
            if (
                !trimmed ||
                trimmed === 'null' ||
                trimmed === 'undefined' ||
                trimmed.toLowerCase().includes('fail') ||
                trimmed.toLowerCase().includes('error')
            ) {
                return null;
            }

            return JSON.parse(trimmed);
        } catch (e) {
            return null;
        }
    }

    writeAppInfoWebSDK(path, mode, appsObj) {
        if (typeof WebSDK_createFileRequest !== 'function') {
            return false;
        }
        try {
            const payload = JSON.stringify({
                path,
                writedata: JSON.stringify(appsObj),
                mode
            });
            const result = WebSDK_createFileRequest("write", payload);
            return !!result && String(result).toLowerCase().includes("success");
        } catch (e) {
            return false;
        }
    }

    
    readAppInfoVidaa6() {
        return this.readAppInfoWebSDK("websdk/Appinfo.json", 6) || { AppInfo: [] };
    }

    writeAppInfoVidaa6(appsObj) {
        return this.writeAppInfoWebSDK("websdk/Appinfo.json", 6, appsObj);
    }

    
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
            
            return false;
        }
    }

    
    readAppInfoVidaa5() {
        
        return this.readAppInfoHisense();
    }

    writeAppInfoVidaa5(appsObj) {
        
        return this.writeAppInfoHisense(appsObj);
    }

    
    installAppVidaa3(appData) {
        
        const iconUrl = this.getAppIconUrl(appData, true);
        
        
        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.top = '0';
        iframe.style.left = '0';
        iframe.style.width = '100%';
        iframe.style.height = '100%';
        iframe.style.zIndex = '9999';
        iframe.style.background = 'white';
        document.body.appendChild(iframe);

        
        iframe.src = 'hisense://debug';

        
        iframe.onload = () => {
            setTimeout(() => {
                try {
                    const doc = iframe.contentDocument || iframe.contentWindow.document;
                    
                    
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

                    
                    if (appNameInput) appNameInput.value = appData.name;
                    if (thumbnailInput) thumbnailInput.value = iconUrl;
                    if (iconSmallInput) iconSmallInput.value = iconUrl;
                    if (iconLargeInput) iconLargeInput.value = iconUrl;
                    if (appUrlInput) appUrlInput.value = appData.url;

                    
                    const installButton = doc.querySelector('button[type="submit"]') ||
                                         doc.querySelector('input[type="submit"]') ||
                                         Array.from(doc.querySelectorAll('button')).find(btn => 
                                             btn.textContent.toLowerCase().includes('install'));

                    if (installButton) {
                        
                        this.showNotification(`Установка ${appData.name}...`);
                        
                        
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

                        
                        setTimeout(() => {
                            installButton.click();
                            overlay.innerHTML = `
                                <h2 style="margin-bottom: 20px;">⏳ Установка...</h2>
                                <p>Дождитесь завершения установки</p>
                                <p style="font-size: 18px; opacity: 0.7; margin-top: 20px;">
                                    После завершения перезагрузите ТВ
                                </p>
                            `;
                            
                            
                            setTimeout(() => {
                                document.body.removeChild(iframe);
                                
                                
                                const AppJson = this.buildAppInfoEntry(appData, iconUrl);
                                
                                
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
                    
                    this.showNotification('Ошибка доступа к Debug странице');
                    
                    
                    setTimeout(() => {
                        document.body.removeChild(iframe);
                        alert(`Установка ${appData.name}:\n\n1. Откройте hisense://debug\n2. Заполните поля:\n   - AppName: ${appData.name}\n   - AppUrl: ${appData.url}\n   - конки: ${iconUrl}\n3. Нажмите Install\n4. Перезагрузите ТВ`);
                    }, this.performanceMode.vidaa3FallbackDelay);
                }
            }, this.performanceMode.vidaa3AutofillDelay);
        };

        
        iframe.onerror = () => {
            document.body.removeChild(iframe);
            this.showNotification('Не удалось открыть Debug режим');
            alert(`Для установки на Vidaa 3:\n\n1. Откройте браузер и введите: hisense://debug\n2. Заполните поля:\n   - AppName: ${appData.name}\n   - AppUrl: ${appData.url}\n   - конки: ${iconUrl}\n3. Нажмите Install\n4. Перезагрузите ТВ`);
        };
    }

    
    installAppVidaa5(appData) {
        
        
        
        
        
        const btn = document.querySelector('.install-btn');
        const originalContent = btn.innerHTML;
        
        btn.innerHTML = '⏳ Установка...';
        btn.classList.add('is-processing');
        btn.disabled = true;

        setTimeout(() => {
            
            const iconUrl = this.getAppIconUrl(appData, true);

            
            const AppJson = this.buildAppInfoEntry(appData, iconUrl);

            
            const exists = this.installedApps.some(app => {
                const installedUrl = app.URL || app.url;
                const installedName = app.AppName || app.Title || app.name;
                return installedUrl === appData.url || installedName === appData.name;
            });
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

            
            this.installedApps.push(AppJson);

            
            const saveResult = this.saveInstalledAppsDetailed();

            if (saveResult.ok) {
                setTimeout(() => {
                    
                    this.installedApps = this.loadInstalledApps();
                    this.updateAppCards();
                    this.updateInstallButton();

                    
                    if (this.currentTab === 'installed') {
                        this.filterInstalled();
                    }

                    btn.classList.remove('is-processing');
                    btn.disabled = false;
                    this.updateInstallButton();
                }, this.performanceMode.installRefreshDelay);
            } else {
                this.rollbackInstalledByUrl(appData.url);
                btn.innerHTML = '❌ Ошибка';
                btn.style.background = 'linear-gradient(135deg, #f44336, #d32f2f)';
                setTimeout(() => {
                    btn.innerHTML = originalContent;
                    btn.classList.remove('is-processing');
                    btn.disabled = false;
                    btn.style.background = '';
                }, this.performanceMode.errorResetDelay);
            }
        }, this.performanceMode.installStartDelay);
    }

    
detectAppInfoStorage() {
    let data = null;

    if (typeof HiUtils_createRequest === 'function') {
        data = this.readAppInfoVidaa9();
        return {
            method: 'HiUtils',
            path: 'websdk/Appinfo.json',
            mode: 6,
            data: this.isValidAppInfoData(data) ? data : { AppInfo: [] }
        };
    }

    if (typeof WebSDK_createFileRequest === 'function') {
        const useLauncherFirst = this.vidaaVersion && (
            this.vidaaVersion.version === '5' ||
            this.vidaaVersion.version === '6' ||
            this.vidaaVersion.version === '6.01' ||
            this.vidaaVersion.os === 'U05' ||
            this.vidaaVersion.os === 'U06' ||
            /U0?5|U0?6/i.test(String(this.vidaaVersion.os || '')) ||
            /V0005\.|V0006\./i.test(String(this.vidaaVersion.firmware || ''))
        );
        const candidates = useLauncherFirst
            ? [
                { path: 'launcher/Appinfo.json', mode: 1 },
                { path: 'websdk/Appinfo.json', mode: 6 }
            ]
            : [
                { path: 'websdk/Appinfo.json', mode: 6 },
                { path: 'launcher/Appinfo.json', mode: 1 }
            ];

        for (const candidate of candidates) {
            data = this.readAppInfoWebSDK(candidate.path, candidate.mode);
            if (this.isValidAppInfoData(data)) {
                return {
                    method: 'WebSDK',
                    path: candidate.path,
                    mode: candidate.mode,
                    data
                };
            }
        }

        return {
            method: 'WebSDK',
            path: candidates[0].path,
            mode: candidates[0].mode,
            data: { AppInfo: [] }
        };
    }

    if (typeof Hisense !== 'undefined' && typeof Hisense.File !== 'undefined') {
        data = this.readAppInfoHisense();
        return {
            method: 'Hisense.File',
            path: 'launcher/Appinfo.json',
            mode: 1,
            data: this.isValidAppInfoData(data) ? data : { AppInfo: [] }
        };
    }

    try {
        const stored = localStorage.getItem('vidaa3_installed_apps');
        const parsed = stored ? JSON.parse(stored) : [];
        const appInfo = Array.isArray(parsed) ? parsed : (parsed.AppInfo || []);
        return {
            method: 'localStorage',
            path: 'localStorage',
            mode: 0,
            data: { AppInfo: appInfo }
        };
    } catch (e) {
        console.error('Ошибка чтения localStorage:', e);
        return {
            method: 'localStorage',
            path: 'localStorage',
            mode: 0,
            data: { AppInfo: [] }
        };
    }
}

normalizeInstalledApps(apps) {
    return (Array.isArray(apps) ? apps : []).map(app => ({
        ...app,
        Id: app.Id || app.id,
        AppName: app.AppName || app.name,
        Title: app.Title || app.title || app.AppName || app.name,
        URL: app.URL || app.url,
        StartCommand: app.StartCommand || app.startCommand || app.URL || app.url,
        IconURL: app.IconURL || app.icon,
        Type: app.Type || 'Browser',
        InstallTime: app.InstallTime || app.installTime,
        StoreType: app.StoreType || 'store'
    }));
}


loadInstalledApps() {
    this.log('📥 Загрузка установленных приложений...');

    const storage = this.detectAppInfoStorage();
    this.appInfoStorage = {
        method: storage.method,
        path: storage.path,
        mode: storage.mode
    };

    const installed = this.normalizeInstalledApps(storage.data.AppInfo || []);

    this.log('📦 Хранилище Appinfo:', this.appInfoStorage);
    this.log('✅ Загружено установленных приложений:', installed.length);
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


isAppInstalled(appUrl, appName) {
    if (!appUrl && !appName) return false;
    
    this.log(`🔍 Проверка: URL="${appUrl}", мя="${appName}"`);
    
    
    if (appUrl && appUrl.trim() !== '') {
        const urlMatch = this.installedUrlSet.has(appUrl.trim());
        
        if (urlMatch) {
            this.log(`✅ Найдено по URL: ${appUrl}`);
            return true;
        }
        this.log(`❌ Не найдено по URL: ${appUrl}`);
    }
    
    
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
                badge.innerHTML = '✓';
                badge.setAttribute('aria-label', 'Установлено');
                badge.title = 'Установлено';
                card.appendChild(badge);
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


refreshInstalledStatus() {
    this.log('🔄 Принудительное обновление статуса установки');
    this.installedApps = this.loadInstalledApps();
    this.updateAppCards();
    
    
    if (this.currentTab === 'installed') {
        this.filterInstalled();
    }
}


    saveInstalledAppsDetailed() {
        const data = { AppInfo: this.installedApps };

        try {
            if (!this.appInfoStorage) {
                this.loadInstalledApps();
            }

            if (this.appInfoStorage.method === 'HiUtils') {
                let success = this.writeAppInfoHiUtilsAt('websdk/Appinfo.json', 6, data);
                let usedPath = 'websdk/Appinfo.json';
                if (!success) {
                    
                    success = this.writeAppInfoHiUtilsAt('launcher/Appinfo.json', 1, data);
                    usedPath = 'launcher/Appinfo.json';
                }
                return {
                    ok: success,
                    method: 'HiUtils',
                    message: success ? `Сохранено в ${usedPath}` : 'HiUtils fileWrite вернул ошибку (проверены websdk и launcher пути)'
                };
            }

            if (this.appInfoStorage.method === 'WebSDK') {
                let success = this.writeAppInfoWebSDK(this.appInfoStorage.path, this.appInfoStorage.mode, data);
                let usedPath = this.appInfoStorage.path;
                let usedMode = this.appInfoStorage.mode;
                if (!success) {
                    
                    usedPath = this.appInfoStorage.path === 'websdk/Appinfo.json' ? 'launcher/Appinfo.json' : 'websdk/Appinfo.json';
                    usedMode = usedPath === 'websdk/Appinfo.json' ? 6 : 1;
                    success = this.writeAppInfoWebSDK(usedPath, usedMode, data);
                }
                return {
                    ok: success,
                    method: 'WebSDK',
                    message: success
                        ? `Сохранено в ${usedPath} mode ${usedMode}`
                        : `WebSDK write вернул ошибку для websdk и launcher путей`
                };
            }

            if (this.appInfoStorage.method === 'Hisense.File') {
                const success = this.writeAppInfoHisense(data);
                return {
                    ok: success,
                    method: 'Hisense.File',
                    message: success ? 'Сохранено в launcher/Appinfo.json' : 'Hisense.File.write вернул ошибку'
                };
            }

            localStorage.setItem('vidaa3_installed_apps', JSON.stringify(this.installedApps));
            return {
                ok: true,
                method: 'localStorage',
                message: 'Сохранено в localStorage'
            };
        } catch (e) {
            return {
                ok: false,
                method: this.appInfoStorage ? this.appInfoStorage.method : 'unknown',
                message: e.message || 'Исключение при сохранении Appinfo',
                details: {
                    storage: this.appInfoStorage,
                    stack: e.stack || null
                }
            };
        }
    }

    
    saveInstalledApps() {
        return this.saveInstalledAppsDetailed().ok;
    }

    rollbackInstalledByUrl(url) {
        this.installedApps = this.installedApps.filter(app => (app.URL || app.url) !== url);
        this.rebuildInstalledIndex();
    }

    installViaNativeAPI(appData, iconUrl, storeType, callback) {
        let callbackCalled = false;
        const appId = appData.name.replace(/\s+/g, '_') + "_debug";
        const nativeInstaller = window.Hisense_installApp;
        const done = (payload) => {
            if (callbackCalled) return;
            callbackCalled = true;

            if (payload === true) {
                callback({ ok: true, method: 'Hisense_installApp', message: 'Установка выполнена через нативный API' });
                return;
            }

            if (typeof payload === 'string') {
                const lower = payload.toLowerCase();
                callback({
                    ok: lower.includes('success') || lower.includes('ok'),
                    method: 'Hisense_installApp',
                    message: payload,
                    details: { raw: payload }
                });
                return;
            }

            if (payload && typeof payload === 'object') {
                const success = payload.success === true || payload.ret === true || payload.code === 0;
                callback({
                    ok: success,
                    method: 'Hisense_installApp',
                    message: success ? 'Установка выполнена через нативный API' : (payload.message || payload.error || 'Нативный API вернул ошибку'),
                    details: payload
                });
                return;
            }

            callback({
                ok: false,
                method: 'Hisense_installApp',
                message: 'Нативный API не подтвердил установку',
                details: { raw: payload }
            });
        };

        try {
            const result = nativeInstaller.call(
                window,
                appId,
                appData.name,
                iconUrl,
                iconUrl,
                iconUrl,
                appData.url,
                storeType,
                done
            );

            if (result !== undefined && result !== null) {
                done(result);
                return;
            }

            setTimeout(() => {
                if (!callbackCalled) {
                    done({
                        success: false,
                        message: 'Нативный API не вернул ответ за 8 секунд'
                    });
                }
            }, 8000);
        } catch (e) {
            callback({
                ok: false,
                method: 'Hisense_installApp',
                message: e.message || 'Ошибка вызова Hisense_installApp',
                details: { stack: e.stack || null }
            });
        }
    }

    
    getVowOSStore() {
        try {
            if (window.vowOS && window.vowOS.store && typeof window.vowOS.store.installApp === 'function') return window.vowOS.store;
            if (window.vowOs && window.vowOs.store && typeof window.vowOs.store.installApp === 'function') return window.vowOs.store;
            if (window.VowOS && window.VowOS.store && typeof window.VowOS.store.installApp === 'function') return window.VowOS.store;
        } catch (e) {}
        return null;
    }

    
    installViaVowOSStore(appData, iconUrl, storeType, callback) {
        const store = this.getVowOSStore();
        if (!store) {
            callback({ ok: false, method: 'vowOS.store.installApp', message: 'vowOS.store.installApp недоступен' });
            return;
        }

        let callbackCalled = false;
        const done = (payload) => {
            if (callbackCalled) return;
            callbackCalled = true;

            if (payload === true) {
                callback({ ok: true, method: 'vowOS.store.installApp', message: 'Установка выполнена через vowOS.store.installApp' });
                return;
            }

            if (typeof payload === 'string') {
                const lower = payload.toLowerCase();
                callback({
                    ok: lower.includes('success') || lower.includes('ok'),
                    method: 'vowOS.store.installApp',
                    message: payload,
                    details: { raw: payload }
                });
                return;
            }

            if (payload && typeof payload === 'object') {
                const success = payload.success === true || payload.ret === true || payload.ok === true || payload.code === 0;
                callback({
                    ok: success,
                    method: 'vowOS.store.installApp',
                    message: success ? 'Установка выполнена через vowOS.store.installApp' : (payload.message || payload.error || 'vowOS.store.installApp вернул ошибку'),
                    details: payload
                });
                return;
            }

            callback({
                ok: false,
                method: 'vowOS.store.installApp',
                message: 'vowOS.store.installApp не подтвердил установку',
                details: { raw: payload }
            });
        };

        try {
            const ret = store.installApp({
                appId: appData.name.replace(/\s+/g, '_') + '_debug',
                appName: appData.name,
                thumbnail: iconUrl,
                iconSmall: iconUrl,
                iconBig: iconUrl,
                appUrl: appData.url,
                storetype: storeType,
                configUrl: '',
                configUrlDownload: '',
                mediaId: ''
            }, done);

            if (ret === true || ret === false) {
                done({ ret });
                return;
            }

            setTimeout(() => {
                if (!callbackCalled) {
                    done({ ret: false, message: 'vowOS.store.installApp не вернул ответ за 8 секунд' });
                }
            }, 8000);
        } catch (e) {
            callback({
                ok: false,
                method: 'vowOS.store.installApp',
                message: e.message || 'Ошибка вызова vowOS.store.installApp',
                details: { stack: e.stack || null }
            });
        }
    }

    
    installApp(appData = null) {

    if (!appData) {
        const modalAppId = this.modal.dataset.appid;
        const appIndex = this.apps.findIndex(a => a.appid === modalAppId);
        if (appIndex === -1) return;
        appData = this.apps[appIndex];
    }

    const btn = document.querySelector('.install-btn');
    const isInstalled = this.isAppInstalled(appData.url, appData.name);

    if (isInstalled) {
        this.uninstallApp(appData);
        return;
    }

    
    if (this.vidaaVersion.version === '3') {
        this.installAppVidaa3(appData);
        return;
    }

    
    if (this.vidaaVersion.version === '5' && typeof window.Hisense_installApp !== 'function') {
        this.installAppVidaa5(appData);
        return;
    }

    
    const originalContent = btn.innerHTML;
    btn.innerHTML = '⏳ Установка...';
    btn.classList.add('is-processing');
    btn.disabled = true;

    setTimeout(() => {
        
        const storeType = this.getStoreType(appData);
        

        const iconUrl = this.getAppIconUrl(appData, true);

        
        const AppJson = this.buildAppInfoEntry(appData, iconUrl);

        const installViaAppInfo = () => {
            if (typeof HiUtils_createRequest === 'function') {
                const freshData = this.readAppInfoVidaa9();
                this.installedApps = this.normalizeInstalledApps(freshData.AppInfo || []);
            }

            const index = this.installedApps.findIndex(app => {
                const installedUrl = app.URL || app.url;
                const installedName = app.AppName || app.Title || app.name;
                return installedUrl === appData.url || installedName === appData.name || app.Id === AppJson.Id;
            });

            if (index >= 0) {
                this.installedApps[index] = AppJson;
            } else {
                this.installedApps.push(AppJson);
            }

            const saveResult = this.saveInstalledAppsDetailed();
            if (!saveResult.ok) {
                this.rollbackInstalledByUrl(appData.url);
            }
            return saveResult;
        };

        const finishSuccess = () => {
            setTimeout(() => {
                this.installedApps = this.loadInstalledApps();
                this.updateAppCards();
                this.updateInstallButton();

                if (this.currentTab === 'installed') {
                    this.filterInstalled();
                }

                btn.classList.remove('is-processing');
                btn.disabled = false;
                btn.style.background = '';
                this.updateInstallButton();
            }, this.performanceMode.installRefreshDelay);
        };

        const finishError = (saveResult = null, nativeResult = null) => {
            if (saveResult && saveResult.message) {
                this.warn('Ошибка установки:', saveResult);
            }

            
            const detailParts = [];
            if (nativeResult && nativeResult.message) {
                detailParts.push(nativeResult.message);
            }
            if (saveResult && saveResult.message) {
                detailParts.push(saveResult.message);
            }
            this.showNotification(detailParts.length ? `❌ ${detailParts.join(' | ')}` : '❌ Не удалось установить приложение', 7000);

            btn.innerHTML = '❌ Ошибка';
            btn.style.background = 'linear-gradient(135deg, #f44336, #d32f2f)';
            setTimeout(() => {
                btn.innerHTML = originalContent;
                btn.classList.remove('is-processing');
                btn.disabled = false;
                btn.style.background = '';
            }, this.performanceMode.errorResetDelay);
        };

        
        const exists = this.installedApps.some(app => {
            const installedUrl = app.URL || app.url;
            const installedName = app.AppName || app.Title || app.name;
            return installedUrl === appData.url || installedName === appData.name;
        });
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

        const handleNativeInstallResult = (nativeResult) => {
            if (nativeResult && nativeResult.ok) {
                finishSuccess();
                return;
            }

            
            
            if (this.getVowOSStore()) {
                this.installViaVowOSStore(appData, iconUrl, storeType, (vowResult) => handleVowOSInstallResult(vowResult, nativeResult));
                return;
            }

            const saveResult = installViaAppInfo();
            if (saveResult.ok) {
                finishSuccess();
            } else {
                finishError(saveResult, nativeResult);
            }
        };

        
        
        const handleVowOSInstallResult = (nativeResult, priorNativeResult = null) => {
            const saveResult = installViaAppInfo();
            if (saveResult.ok || (nativeResult && nativeResult.ok)) {
                finishSuccess();
            } else {
                const combinedMessage = [priorNativeResult && priorNativeResult.message, nativeResult && nativeResult.message].filter(Boolean).join(' | ');
                finishError(saveResult, combinedMessage ? { message: combinedMessage } : nativeResult);
            }
        };

        if (typeof window.Hisense_installApp === 'function') {
            this.installViaNativeAPI(appData, iconUrl, storeType, handleNativeInstallResult);
            return;
        }

        
        if (this.getVowOSStore()) {
            this.installViaVowOSStore(appData, iconUrl, storeType, handleVowOSInstallResult);
            return;
        }

        const saveResult = installViaAppInfo();
        if (saveResult.ok) {
            finishSuccess();
        } else {
            finishError(saveResult, { message: 'Нативный API установки не найден (нет Hisense_installApp и vowOS.store.installApp)' });
        }
    }, this.performanceMode.installStartDelay);
}

    
    uninstallApp(appData) {
        const btn = document.querySelector('.install-btn');
        const originalContent = btn.innerHTML;
        
        btn.innerHTML = '⏳ Удаление...';
        btn.classList.add('is-processing');
        btn.disabled = true;

        setTimeout(() => {
            
            this.installedApps = this.installedApps.filter(app => {
                const installedUrl = app.URL || app.url;
                const installedName = app.AppName || app.Title || app.name;
                return !(installedUrl === appData.url || installedName === appData.name);
            });
            this.rebuildInstalledIndex();

            
            const saveResult = this.saveInstalledAppsDetailed();

            if (saveResult.ok) {
                setTimeout(() => {
                    
                    this.installedApps = this.loadInstalledApps();
                    this.updateAppCards();
                    this.updateInstallButton();

                    
                    if (this.currentTab === 'installed') {
                        this.filterInstalled();
                    }

                    btn.classList.remove('is-processing');
                    btn.disabled = false;
                    this.updateInstallButton();
                }, this.performanceMode.uninstallRefreshDelay);
            } else {
                btn.innerHTML = '❌ Ошибка';
                setTimeout(() => {
                    btn.innerHTML = originalContent;
                    btn.classList.remove('is-processing');
                    btn.disabled = false;
                    this.updateInstallButton();
                }, this.performanceMode.errorResetDelay);
            }
        }, this.performanceMode.uninstallStartDelay);
    }


	
    updateInstallButton() {
        const modalAppId = this.modal.dataset.appid;
        const app = this.apps.find(a => a.appid === modalAppId);
        if (!app) return;

        const btn = document.querySelector('.install-btn');
        const isInstalled = this.isAppInstalled(app.url, app.name);

        if (isInstalled) {
            btn.innerHTML = '🗑️ Удалить';
            btn.style.background = 'linear-gradient(135deg, #f44336, #d32f2f)';
        } else {
            btn.innerHTML = '📥 Установить';
            btn.style.background = '';
        }
    }

    injectStyles() {
        const style = document.createElement('style');
        style.textContent = `
            ${this.isVidaaTV ? `
            
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
            
            * {
                outline: none !important;
            }
            *:focus {
                outline: none !important;
            }
            `}
            
            .installed-badge {
                position: absolute;
                top: -1px;
                right: -1px;
                display: inline-flex;
                background: rgba(99, 196, 141, 0.18);
                border-top: 1px solid rgba(99, 196, 141, 0.42);
                border-right: 1px solid rgba(99, 196, 141, 0.42);
                border-bottom: 1px solid rgba(99, 196, 141, 0.3);
                border-left: 1px solid rgba(99, 196, 141, 0.3);
                color: #baf1cf;
                align-items: center;
                justify-content: center;
                font-size: 12px;
                line-height: 1;
                width: 30px;
                height: 26px;
                padding: 0;
                border-radius: 0 14px 0 12px;
                font-weight: 800;
                box-shadow: none;
                z-index: 2;
                pointer-events: none;
            }
            
            .app-card.app-installed {
                border-color: rgba(99, 196, 141, 0.42);
            }
            
            .menu-item.focused {
                background: var(--bg-card-strong) !important;
                color: var(--text-main) !important;
                transform: none;
                box-shadow: 0 0 0 2px rgba(126, 167, 218, 0.24);
            }
            
            .app-card.focused {
                transform: none;
                border-color: rgba(126, 167, 218, 0.34) !important;
                box-shadow: 0 0 0 2px rgba(126, 167, 218, 0.24);
                background: var(--bg-card-strong);
                z-index: 10;
            }
            
            .modal-close.focused,
            .install-btn.focused {
                transform: none;
                box-shadow: 0 0 0 2px rgba(126, 167, 218, 0.24);
            }
            
            .app-card.focused {
                scroll-margin: 100px;
            }
        `;
        document.head.appendChild(style);
    }

    updateFocusableElements() {
        this.focusableElements = [];

        const isElementAvailableForFocus = (element) => {
            if (!element || element.hidden) {
                return false;
            }

            const tabContent = element.closest('.tab-content');
            if (tabContent && !tabContent.classList.contains('active')) {
                return false;
            }

            return window.getComputedStyle(element).display !== 'none' && element.offsetParent !== null;
        };
        
        if (this.modal.classList.contains('active')) {
            this.focusableElements.push(
                document.querySelector('.install-btn'),
                document.querySelector('.modal-close')
            );
        } else {
            const menuItems = Array.from(document.querySelectorAll('.menu-item')).filter(isElementAvailableForFocus);
            const visibleCards = Array.from(document.querySelectorAll('.app-card'))
                .filter(isElementAvailableForFocus);
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
            if (!this.syncHistoryAfterTabReset()) {
                this.switchTab('all', { historyMode: 'replace' });
            }
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

    switchTab(tabName, options = {}) {
        const historyMode = options.historyMode || (options.skipHistorySync ? 'skip' : 'push');
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

        if (historyMode === 'push') {
            this.syncHistoryForTab(tabName);
        } else if (historyMode === 'replace') {
            this.syncHistoryForTab(tabName, true);
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


syncUrlsFromInstalled() {
    this.log('🔄 Синхронизация URL из установленных приложений...');
    
    
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


    closeModal(options = {}) {
        const skipHistorySync = options.skipHistorySync === true;

        this.modal.classList.remove('active');
        document.body.style.overflow = 'auto';

        if (!skipHistorySync) {
            this.syncHistoryAfterModalClose();
        }

        this.updateFocusableElements();
        const menuCount = document.querySelectorAll('.menu-item').length;
        this.setFocus(menuCount);
    }

    showNotification(message, duration = this.performanceMode.notificationDuration) {
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
        }, duration);
    }

    detectVidaaVersion() {
    let OS = '';
    let version = 'не определена';
    let firmware = '';
    let osVersion = '';
    
    
    const ua = navigator.userAgent.toLowerCase();
    
    
    if (ua.includes('tvbrowser/5.0') || ua.includes('tvbrowser5')) {
        version = '5';
        OS = 'U05';
        this.log('📺 Определено по TvBrowser/5.0: Vidaa 5');
        return {
            version: version,
            os: OS,
            firmware: firmware,
            osVersion: osVersion,
            fullVersion: `5 (${OS}) ${firmware}`
        };
    }
    
    
    try {
        if (typeof Hisense_GetOSVersion === 'function') {
            osVersion = String(Hisense_GetOSVersion() || '');
        }
    } catch (e) {}
    try {
        if (typeof Hisense_GetFirmWareVersion === 'function') {
            firmware = String(Hisense_GetFirmWareVersion() || '');
        }
    } catch (e) {}
    
    
    if (typeof HiUtils_createRequest === 'function') {
        version = '9';
        OS = 'U09';

        
        if (/U09\.60/i.test(osVersion) || /\.09\.60\./.test(firmware) || /9\.60/.test(osVersion)) {
            version = '9.60';
            this.log('📺 Определено по HiUtils_createRequest: Vidaa 9 (сборка U09.60)');
        } else {
            this.log('📺 Определено по HiUtils_createRequest: Vidaa 9');
        }
    }
    
    else if (typeof WebSDK_createFileRequest === 'function') {
        
        
        
        const isVidaa6UA = ua.includes('vidaa6') || ua.includes('u06') || ua.includes('webos');
        
        
        const hasVidaa6Features = typeof window.HiSys !== 'undefined' || 
                                  typeof window.HiEvent !== 'undefined' ||
                                  typeof window.HiPlayer !== 'undefined';
        
        if (isVidaa6UA || hasVidaa6Features || ua.includes('hibrowser')) {
            version = '6';
            OS = 'U06';
            this.log('📺 Определено по WebSDK_createFileRequest и признакам: Vidaa 6');
        } else {
            
            this.log('⚠️ Найдена WebSDK_createFileRequest, но нет признаков Vidaa 6, проверяем Vidaa 3');
            
            
            if (ua.includes('vidaa3') || ua.includes('u03') || ua.includes('smart-tv') && !ua.includes('webos')) {
                version = '3';
                OS = 'U03';
                this.log('📺 Определено по User Agent: Vidaa 3');
            } else {
                
                version = '6';
                OS = 'U06';
                this.log('📺 Предположительно Vidaa 6 (по WebSDK_createFileRequest)');
            }
        }
    }
    
    else if (typeof Hisense !== 'undefined' && typeof Hisense.File !== 'undefined') {
        try {
            if (typeof Hisense_GetOSVersion === 'function') {
                OS = Hisense_GetOSVersion();
            }
            if (typeof Hisense_GetFirmWareVersion === 'function') {
                firmware = Hisense_GetFirmWareVersion();
            }
        } catch (e) {}
        
        
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
            
            if (ua.includes('tvbrowser/5.0') || ua.includes('tvbrowser5')) {
                version = '5';
                OS = 'U05';
            } else {
                version = '4 или старше';
            }
        }
        
        this.log(`📺 Определено по Hisense API: Vidaa ${version}`);
    }
    
    else {
        
        if (ua.includes('vidaa3') || ua.includes('u03') || 
            (ua.includes('smart-tv') && ua.includes('hisense') && !ua.includes('webos'))) {
            version = '3';
            OS = 'U03';
            this.log('📺 Определено по User Agent: Vidaa 3');
        }
        
        else if (window.location.protocol === 'hisense:' || document.referrer.includes('debug')) {
            version = '3';
            OS = 'U03';
            this.log('📺 Определено по debug режиму: Vidaa 3');
        }
        
        else {
            const isTVBrowser = ua.includes('hibrowser') || ua.includes('smart-tv') || ua.includes('hisense');
            if (isTVBrowser) {
                
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
        osVersion: osVersion,
        fullVersion: version !== 'не определена' ? `${version} (${OS}) ${firmware}` : 'не определена'
    };
}


isVidaa3() {
    const ua = navigator.userAgent.toLowerCase();
    
    
    if (ua.includes('vidaa3') || ua.includes('u03')) {
        return true;
    }
    
    
    if (typeof Hisense !== 'undefined') {
        
        if (typeof WebSDK_createFileRequest !== 'function' && 
            typeof HiUtils_createRequest !== 'function') {
            
            
            const isOldBrowser = !window.Promise || !window.fetch || !window.Symbol;
            
            if (isOldBrowser && ua.includes('hisense')) {
                return true;
            }
        }
    }
    
    return false;
}


isVidaa5() {
    const ua = navigator.userAgent.toLowerCase();
    return ua.includes('tvbrowser/5.0') || ua.includes('tvbrowser5');
}

}


document.addEventListener('DOMContentLoaded', () => {
    new VidaaStore();
});
