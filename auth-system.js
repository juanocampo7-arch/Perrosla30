// ==========================================
// SISTEMA DE AUTENTICACIÓN CON ROLES
// ==========================================

window.authSystem = {
    // Base de datos de usuarios (en producción iría a Firebase)
    users: {
        'ADMIN': {
            password: '1089607033',
            role: 'admin',
            name: 'Administrador',
            permissions: ['mesero', 'cocina', 'caja', 'editar-menu', 'nomina', 'historial', 'inventario', 'estadisticas', 'recetas', 'domicilios', 'fiscal']
        },
        'NATALIA': {
            password: '0000',
            role: 'mesero',
            name: 'Natalia',
            permissions: ['mesero', 'domicilios', 'caja']
        },
        'SEBAS': {
            password: '0000',
            role: 'mesero',
            name: 'Sebas',
            permissions: ['mesero', 'domicilios', 'caja']
        },
        'JUANJO': {
            password: '0000',
            role: 'mesero',
            name: 'Juanjo',
            permissions: ['mesero', 'domicilios', 'caja']
        },
        'MESAS': {
            password: '1111',
            role: 'receptionist',
            name: 'Recepcionista',
            permissions: ['mesero', 'domicilios', 'caja', 'cocina']
        }
    },

    // Sesión actual
    currentSession: null,

    // Validar credenciales
    validateCredentials: function(username, password) {
        const user = this.users[username?.toUpperCase()];
        if (!user) {
            console.warn(`❌ Usuario no encontrado: ${username}`);
            return null;
        }
        if (user.password !== password) {
            console.warn(`❌ Contraseña incorrecta para: ${username}`);
            return null;
        }
        return user;
    },

    // Iniciar sesión
    login: function(username, password) {
        const user = this.validateCredentials(username, password);
        if (!user) return false;

        this.currentSession = {
            username: username.toUpperCase(),
            role: user.role,
            name: user.name,
            permissions: user.permissions,
            loginTime: new Date(),
            isAuthenticated: true
        };

        // Guardar en sessionStorage (se limpia al cerrar pestaña)
        sessionStorage.setItem('pos_session', JSON.stringify(this.currentSession));
        console.log(`✅ Sesión iniciada: ${user.name} (${user.role})`);
        return true;
    },

    // Cerrar sesión
    logout: function() {
        this.currentSession = null;
        sessionStorage.removeItem('pos_session');
        console.log('✅ Sesión cerrada');
    },

    // Verificar si hay sesión activa
    isAuthenticated: function() {
        if (!this.currentSession) {
            const stored = sessionStorage.getItem('pos_session');
            if (stored) {
                try {
                    this.currentSession = JSON.parse(stored);
                } catch (e) {
                    return false;
                }
            }
        }
        return !!this.currentSession?.isAuthenticated;
    },

    // Obtener sesión actual
    getCurrentSession: function() {
        if (!this.currentSession) {
            const stored = sessionStorage.getItem('pos_session');
            if (stored) {
                try {
                    this.currentSession = JSON.parse(stored);
                } catch (e) {
                    return null;
                }
            }
        }
        return this.currentSession;
    },

    // Verificar permiso
    hasPermission: function(view) {
        const session = this.getCurrentSession();
        if (!session) return false;
        return session.permissions.includes(view);
    },

    // Verificar rol
    hasRole: function(role) {
        const session = this.getCurrentSession();
        if (!session) return false;
        return session.role === role;
    },

    // Obtener nombre de usuario
    getUserName: function() {
        const session = this.getCurrentSession();
        return session?.name || 'Usuario';
    },

    // Verificar si es admin
    isAdmin: function() {
        return this.hasRole('admin');
    },

    // Verificar si es mesero
    isWaiter: function() {
        return this.hasRole('mesero');
    },

    // Verificar si es recepcionista
    isReceptionist: function() {
        return this.hasRole('receptionist');
    }
};

// ==========================================
// INTEGRACIÓN CON PANTALLA DE LOGIN
// ==========================================

window.attemptLoginNew = function() {
    const username = document.getElementById('login-user')?.value?.trim();
    const password = document.getElementById('login-pass')?.value;

    if (!username || !password) {
        window.showToast('Completa usuario y contraseña', 'error');
        return;
    }

    // Validar credenciales
    if (!window.authSystem.login(username, password)) {
        window.showToast('❌ Usuario o contraseña incorrectos', 'error');
        return;
    }

    // Limpiar campos
    document.getElementById('login-user').value = '';
    document.getElementById('login-pass').value = '';

    // Mostrar mensaje de bienvenida
    const userName = window.authSystem.getUserName();
    const userRole = window.authSystem.currentSession.role;
    const roleText = {
        admin: '👨‍💼 Administrador',
        mesero: '🍽️ Mesero',
        receptionist: '📞 Recepcionista'
    }[userRole] || 'Usuario';

    window.showToast(`✅ ¡Bienvenido ${userName}! (${roleText})`);

    // Ocultar pantalla de login
    const loginScreen = document.getElementById('login-screen');
    const appWrapper = document.getElementById('app-wrapper');

    if (loginScreen && appWrapper) {
        loginScreen.classList.add('opacity-0');
        setTimeout(() => {
            loginScreen.classList.add('hidden');
            appWrapper.classList.remove('hidden');
            appWrapper.classList.add('flex');

            // Actualizar interfaz según rol
            window.updateUIByRole();

            // Mostrar selector de modo impresión
            setTimeout(() => {
                if (!sessionStorage.getItem('pos_printMode')) {
                    document.getElementById('printer-mode-modal')?.classList.remove('hidden');
                }
            }, 400);
        }, 300);
    }
};

// ==========================================
// ACTUALIZAR INTERFAZ SEGÚN ROL
// ==========================================

window.updateUIByRole = function() {
    const session = window.authSystem.getCurrentSession();
    if (!session) return;

    // Mostrar nombre de usuario en header (si existe el elemento)
    const userBadge = document.querySelector('.user-name-badge');
    if (userBadge) {
        userBadge.textContent = session.name;
    }

    // Mostrar rol en header
    const roleBadge = document.querySelector('.user-role-badge');
    if (roleBadge) {
        const roleText = {
            admin: 'ADMIN 👨‍💼',
            mesero: 'MESERO 🍽️',
            receptionist: 'RECEPCIONISTA 📞'
        }[session.role];
        roleBadge.textContent = roleText;
    }

    // Mostrar/ocultar botones de menú según permisos
    const menuButtons = {
        'menu-mesero': 'mesero',
        'menu-cocina': 'cocina',
        'menu-caja': 'caja',
        'menu-editar-menu': 'editar-menu',
        'menu-nomina': 'nomina',
        'menu-historial': 'historial',
        'menu-inventario': 'inventario',
        'menu-estadisticas': 'estadisticas',
        'menu-recetas': 'recetas',
        'menu-domicilios': 'domicilios',
        'menu-fiscal': 'fiscal'
    };

    for (const [btnId, permission] of Object.entries(menuButtons)) {
        const btn = document.getElementById(btnId);
        if (btn) {
            if (session.permissions.includes(permission)) {
                btn.classList.remove('hidden', 'opacity-50', 'cursor-not-allowed');
            } else {
                btn.classList.add('hidden');
            }
        }
    }

    // Si es mesero, solo mostrar sus mesas
    if (window.authSystem.isWaiter()) {
        // Cargar automáticamente el nombre del mesero
        const waiterSelect = document.getElementById('waiter-name');
        if (waiterSelect) {
            waiterSelect.value = session.name;
            window.state.waiterName = session.name;
        }
        
        // Desactivar cambio de mesero
        if (waiterSelect) {
            waiterSelect.disabled = true;
        }
    }

    // Si es recepcionista, mostrar opciones de domicilio
    if (window.authSystem.isReceptionist()) {
        const domiView = document.getElementById('view-domicilios');
        if (domiView) {
            domiView.classList.remove('hidden');
        }
    }

    // Si es admin, mostrar badge especial
    if (window.authSystem.isAdmin()) {
        const adminBadge = document.getElementById('admin-unlocked-badge');
        if (adminBadge) {
            adminBadge.classList.remove('hidden');
            adminBadge.classList.add('flex');
        }
        window.state.isAdminUnlocked = true;
    }
};

// ==========================================
// PROTEGER VISTAS CON PERMISOS
// ==========================================

window.switchViewWithPermission = function(view) {
    if (!window.authSystem.hasPermission(view)) {
        window.showToast(`❌ No tienes permiso para acceder a esta sección`, 'error');
        return;
    }
    window.switchView(view);
};

// ==========================================
// CERRAR SESIÓN
// ==========================================

window.logoutUser = function() {
    if (confirm('¿Seguro que deseas cerrar sesión?')) {
        window.authSystem.logout();
        
        // Limpiar estado
        window.state = {};
        window.state.currentOrderItems = [];
        window.state.domiOrderItems = [];
        
        // Volver a pantalla de login
        const loginScreen = document.getElementById('login-screen');
        const appWrapper = document.getElementById('app-wrapper');
        
        if (loginScreen && appWrapper) {
            appWrapper.classList.add('hidden');
            appWrapper.classList.remove('flex');
            loginScreen.classList.remove('opacity-0', 'hidden');
            
            // Cerrar sidebar si está abierto
            const sidebar = document.getElementById('sidebar');
            if (sidebar && !sidebar.classList.contains('-translate-x-full')) {
                window.toggleSidebar();
            }
        }
        
        window.showToast('✅ Sesión cerrada correctamente');
    }
};

// ==========================================
// INICIALIZAR AUTENTICACIÓN
// ==========================================

window.initializeAuth = function() {
    // Verificar si hay sesión guardada
    if (window.authSystem.isAuthenticated()) {
        // Ya hay sesión, mostrar app
        const session = window.authSystem.getCurrentSession();
        console.log(`✅ Sesión restaurada: ${session.name}`);
        
        document.getElementById('login-screen')?.classList.add('hidden');
        document.getElementById('app-wrapper')?.classList.remove('hidden');
        document.getElementById('app-wrapper')?.classList.add('flex');
        
        window.updateUIByRole();
    }
};

// Llamar al iniciar la página
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', window.initializeAuth);
} else {
    window.initializeAuth();
}

console.log('✅ Sistema de autenticación cargado');
