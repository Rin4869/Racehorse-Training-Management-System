import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { setLanguage } from '../i18n';
import { useAuth } from '../auth/useAuth';

export function Layout() {
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-inner">
          <span className="brand">{t('app.title')}</span>
          <nav className="nav">
            <NavLink to="/horses">{t('nav.horses')}</NavLink>
            {user?.role === 'MANAGER' && (
              <NavLink to="/admin/users">{t('nav.users')}</NavLink>
            )}
          </nav>
          <div className="topbar-right">
            <div className="lang">
              <button
                type="button"
                className="linklike"
                onClick={() => setLanguage('vi')}
                disabled={i18n.language === 'vi'}
              >
                VI
              </button>
              <span aria-hidden>/</span>
              <button
                type="button"
                className="linklike"
                onClick={() => setLanguage('en')}
                disabled={i18n.language === 'en'}
              >
                EN
              </button>
            </div>
            {user && (
              <span className="whoami">
                {user.name}
                {user.role ? ` · ${t(`role.${user.role}`)}` : ''}
              </span>
            )}
            <button type="button" className="btn" onClick={handleLogout}>
              {t('nav.logout')}
            </button>
          </div>
        </div>
      </header>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
