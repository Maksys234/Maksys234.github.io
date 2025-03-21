/**
 * Общий JavaScript файл для загрузки компонентов и управления активной ссылкой
 */

// Объект конфигурации страниц с их заголовками
const pageConfig = {
    '/dashboard.html': 'Dashboard',
    '/': 'Dashboard', // Для главной страницы
    '/dashboard/pokrok.html': 'Pokrok',
    '/dashboard/procvicovani.html': 'Procvičování',
    '/dashboard/profile.html': 'Nastavení profilu'
};

// Загрузка компонентов при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    // Загрузка сайдбара
    loadSidebar();
    
    // Загрузка хедера
    loadHeader();
});

// Функция загрузки сайдбара
function loadSidebar() {
    fetch('/components/sidebar.html')
        .then(response => {
            if (!response.ok) {
                throw new Error('Sidebar component not found');
            }
            return response.text();
        })
        .then(html => {
            document.getElementById('sidebar-container').innerHTML = html;
            
            // После загрузки сайдбара, устанавливаем активную ссылку
            setActiveLink();
        })
        .catch(error => {
            console.error('Error loading sidebar:', error);
        });
}

// Функция загрузки хедера
function loadHeader() {
    fetch('/components/header.html')
        .then(response => {
            if (!response.ok) {
                throw new Error('Header component not found');
            }
            return response.text();
        })
        .then(html => {
            document.getElementById('header-container').innerHTML = html;
            
            // Установка заголовка страницы
            setPageTitle();
        })
        .catch(error => {
            console.error('Error loading header:', error);
        });
}

// Функция установки активной ссылки в меню
function setActiveLink() {
    const currentPath = window.location.pathname;
    
    // Проверяем главную страницу или dashboard.html
    if (currentPath === '/' || currentPath === '/dashboard.html') {
        const dashboardLink = document.getElementById('dashboard-link');
        if (dashboardLink) {
            dashboardLink.classList.add('active');
        }
    }
    
    // Проверяем остальные страницы на основе их пути
    if (currentPath.includes('/pokrok')) {
        const pokrokLink = document.getElementById('pokrok-link');
        if (pokrokLink) {
            pokrokLink.classList.add('active');
        }
    }
    
    if (currentPath.includes('/procvicovani')) {
        const procvicovaniLink = document.getElementById('procvicovani-link');
        if (procvicovaniLink) {
            procvicovaniLink.classList.add('active');
        }
    }
    
    if (currentPath.includes('/profile')) {
        const profileLink = document.getElementById('profile-link');
        if (profileLink) {
            profileLink.classList.add('active');
        }
    }
}

// Функция установки заголовка страницы
function setPageTitle() {
    const currentPath = window.location.pathname;
    const pageTitleElement = document.getElementById('page-title');
    
    if (pageTitleElement) {
        // Устанавливаем заголовок из конфигурации
        for (const path in pageConfig) {
            if (currentPath === path || (path === '/' && currentPath === '/dashboard.html')) {
                pageTitleElement.textContent = pageConfig[path];
                break;
            } else if (currentPath.includes(path) && path !== '/') {
                pageTitleElement.textContent = pageConfig[path];
                break;
            }
        }
    }
}