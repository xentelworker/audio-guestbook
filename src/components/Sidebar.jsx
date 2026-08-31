export default function Sidebar({ page, user, onNavigate, onLogout }) {
  const item = (key, icon, label) => (
    <button
      type="button"
      className={page === key ? 'active' : ''}
      onClick={() => onNavigate(key)}
    >
      <span>{icon}</span>{label}
    </button>
  )

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-icon">🎙</div>
        <div><strong>Audio Guestbook</strong><small>Client Portal</small></div>
      </div>

      <nav className="sidebar-nav">
        {item('dashboard','▦','Dashboard')}
        {item('events','◉','Events')}
        {item('messages','♫','Messages')}
        {item('trash','🗑','Trash')}
        {item('activity','☷','Activity')}
        {item('settings','⚙','Settings')}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user"><small>Signed in as</small><span>{user?.email}</span></div>
        <button type="button" onClick={onLogout}>Log Out</button>
      </div>
    </aside>
  )
}
