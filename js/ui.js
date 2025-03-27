class UI {
    constructor() {
        this.toasts = [];
        this.modals = new Map();
        this.loadingElements = new Map();
    }

    showLoading(containerId = 'main-content') {
        const container = document.getElementById(containerId);
        if (!container) return;

        const loadingEl = document.createElement('div');
        loadingEl.className = 'loading';
        loadingEl.textContent = 'Načítání...';
        
        container.appendChild(loadingEl);
        this.loadingElements.set(containerId, loadingEl);
    }

    hideLoading(containerId = 'main-content') {
        const loadingEl = this.loadingElements.get(containerId);
        if (loadingEl && loadingEl.parentNode) {
            loadingEl.parentNode.removeChild(loadingEl);
            this.loadingElements.delete(containerId);
        }
    }

    showAlert(message, type = 'info') {
        const alert = document.createElement('div');
        alert.className = `alert ${type}`;
        alert.innerHTML = `
            <i class="fas fa-${this._getAlertIcon(type)}"></i>
            <span>${message}</span>
        `;
        
        document.body.appendChild(alert);
        
        setTimeout(() => alert.classList.add('show'), 10);
        
        setTimeout(() => {
            alert.classList.remove('show');
            setTimeout(() => alert.remove(), 300);
        }, 3000);
    }

    showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal) return;
        
        modal.classList.add('active');
        this.modals.set(modalId, modal);
        
        const closeBtn = modal.querySelector('.modal-close');
        const cancelBtn = modal.querySelector('.btn-cancel, [data-dismiss="modal"]');
        
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.hideModal(modalId));
        }
        
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.hideModal(modalId));
        }
    }

    hideModal(modalId) {
        const modal = this.modals.get(modalId);
        if (!modal) return;
        
        modal.classList.remove('active');
        this.modals.delete(modalId);
    }

    updateProfile(profile) {
        if (!profile) return;

        const userNameElements = document.querySelectorAll('.user-name');
        const userAvatarElements = document.querySelectorAll('.user-avatar');
        
        userNameElements.forEach(el => {
            el.textContent = profile.username || profile.email;
        });
        
        userAvatarElements.forEach(el => {
            if (profile.avatar_url) {
                el.innerHTML = `<img src="${profile.avatar_url}" alt="${profile.username || 'User'}" />`;
            } else {
                const initials = this._getInitials(profile);
                el.textContent = initials;
            }
        });
    }

    updatePageTitle(title) {
        document.title = `Justax - ${title}`;
        
        const pageTitle = document.querySelector('.header-content h1');
        if (pageTitle) {
            pageTitle.textContent = title;
        }
    }

    setActiveNavItem(path) {
        const navLinks = document.querySelectorAll('.sidebar-link');
        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === path) {
                link.classList.add('active');
            }
        });
    }

    showError(message, containerId = 'global-error') {
        const errorContainer = document.getElementById(containerId);
        if (!errorContainer) return;

        errorContainer.innerHTML = `
            <div class="error-message">
                <i class="fas fa-exclamation-circle"></i>
                <div>
                    <div class="error-text">${message}</div>
                    <button class="retry-button" id="retry-btn">Zkusit znovu</button>
                </div>
            </div>
        `;
        
        errorContainer.style.display = 'block';
        
        const retryBtn = errorContainer.querySelector('#retry-btn');
        if (retryBtn) {
            retryBtn.addEventListener('click', () => {
                errorContainer.style.display = 'none';
                window.location.reload();
            });
        }
    }

    hideError(containerId = 'global-error') {
        const errorContainer = document.getElementById(containerId);
        if (errorContainer) {
            errorContainer.style.display = 'none';
        }
    }

    updateProgressBar(value, containerId) {
        const progressBar = document.querySelector(`#${containerId} .progress-bar`);
        if (progressBar) {
            progressBar.style.width = `${value}%`;
        }
    }

    toggleSidebar() {
        const sidebar = document.querySelector('.sidebar');
        if (sidebar) {
            sidebar.classList.toggle('active');
        }
    }

    _getAlertIcon(type) {
        const icons = {
            success: 'check-circle',
            error: 'exclamation-circle',
            warning: 'exclamation-triangle',
            info: 'info-circle'
        };
        return icons[type] || icons.info;
    }

    _getInitials(profile) {
        const firstInitial = profile.first_name ? profile.first_name[0] : '';
        const lastInitial = profile.last_name ? profile.last_name[0] : '';
        return (firstInitial + lastInitial).toUpperCase() || 'U';
    }

    handleOffline() {
        const offlineBanner = document.getElementById('offline-banner');
        if (offlineBanner) {
            offlineBanner.style.display = 'block';
        }

        this.showAlert('Jste offline. Některé funkce nemusí být dostupné.', 'warning');
    }

    handleOnline() {
        const offlineBanner = document.getElementById('offline-banner');
        if (offlineBanner) {
            offlineBanner.style.display = 'none';
        }

        this.showAlert('Připojení obnoveno', 'success');
    }

    initializeOfflineHandling() {
        window.addEventListener('online', () => this.handleOnline());
        window.addEventListener('offline', () => this.handleOffline());
    }
}

// Создаем и экспортируем единственный экземпляр
const ui = new UI();
export default ui;