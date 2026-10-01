import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { setLanguage } from '../i18n';
import { useAuth } from '../auth/useAuth';

export function Layout() {
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const pageTitle = location.pathname.startsWith('/admin/users')
    ? t('nav.users')
    : location.pathname.startsWith('/vaccinations')
      ? t('healthSchedule.title')
    : location.pathname === '/my-horses'
      ? t('horseFlow.myHorses')
      : location.pathname === '/horses/new'
        ? t('horseFlow.addHorse')
        : location.pathname.endsWith('/edit')
          ? t('horseFlow.editHorse')
          : location.pathname.startsWith('/horses/')
            ? t('horseFlow.profileEyebrow')
            : location.pathname === '/horses'
              ? t('horseFlow.directoryTitle')
              : t('dashboard.overview');

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <NavLink className="brand-lockup" to="/overview">
          <span className="brand-kicker">RACEHORSE CLUB</span>
          <strong>{t('app.title')}</strong>
          <span className="brand-caption">{t('dashboard.subtitle')}</span>
        </NavLink>
        <nav className="sidebar-nav" aria-label={t('dashboard.navigation')}>
          <NavLink to="/overview" className={({ isActive }) => isActive ? 'side-link active' : 'side-link'}>
            <span aria-hidden="true">◆</span>{t('dashboard.overview')}
          </NavLink>
          <NavLink to="/horses" className={({ isActive }) => isActive ? 'side-link active' : 'side-link'}>
            <span aria-hidden="true">▤</span>{t('horseFlow.directoryTitle')}
          </NavLink>
          {user?.role !== 'OWNER' && (
            <NavLink to="/vaccinations" className={({ isActive }) => isActive ? 'side-link active' : 'side-link'}>
              <span aria-hidden="true">◷</span>{t('healthSchedule.nav')}
            </NavLink>
          )}
          {user?.role === 'OWNER' && (
            <NavLink to="/my-horses" className={({ isActive }) => isActive ? 'side-link active' : 'side-link'}>
              <span aria-hidden="true">♞</span>{t('horseFlow.myHorses')}
            </NavLink>
          )}
          {user?.role === 'MANAGER' && (
            <NavLink to="/admin/users" className={({ isActive }) => isActive ? 'side-link active' : 'side-link'}>
              <span aria-hidden="true">□</span>{t('nav.users')}
            </NavLink>
          )}
        </nav>
        <div className="sidebar-footer">
          <div className="lang">
            <button type="button" className="linklike" onClick={() => setLanguage('vi')} disabled={i18n.language === 'vi'}>VI</button>
            <span aria-hidden>/</span>
            <button type="button" className="linklike" onClick={() => setLanguage('en')} disabled={i18n.language === 'en'}>EN</button>
          </div>
          <span>{t('dashboard.signedInAs')} <strong>{user?.name}</strong></span>
        </div>
      </aside>
      <section className="main-panel">
        <header className="topbar">
          <div className="topbar-inner">
            <h1 className="topbar-title">{pageTitle}</h1>
            <div className="topbar-right">
              {user && (
                <div className="profile-chip">
                  <span className="profile-initial">{user.name.slice(0, 1).toUpperCase()}</span>
                  <span><strong>{user.name}</strong><small>{user.role ? t(`role.${user.role}`) : ''}</small></span>
                </div>
              )}
              <button type="button" className="btn logout-btn" onClick={handleLogout}>{t('nav.logout')}</button>
            </div>
          </div>
        </header>
        <main className="content"><Outlet /></main>
      </section>
    </div>
  );
}
