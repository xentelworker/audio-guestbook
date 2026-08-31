export default function BulkActionBar({
  list, selectedIds, busy, status, onToggleAll, onClear,
  onShow, onHide, onDownload, onDelete
}) {
  const selectedCount = list.filter(m => selectedIds.includes(m.id)).length
  const all = list.length > 0 && selectedCount === list.length

  return (
    <div className="bulk-action-bar">
      <label className="bulk-select-all">
        <input type="checkbox" checked={all} disabled={busy} onChange={onToggleAll} />
        {all ? 'Deselect All' : 'Select All'}
      </label>
      <strong>{selectedCount} selected</strong>
      {status && <span className="bulk-action-status">{status}</span>}
      <div className="bulk-action-buttons">
        <button disabled={!selectedCount || busy} onClick={onShow}>👁 Show</button>
        <button disabled={!selectedCount || busy} onClick={onHide}>◉ Hide</button>
        <button disabled={!selectedCount || busy} onClick={onDownload}>↓ ZIP</button>
        <button disabled={!selectedCount || busy} onClick={onClear}>Clear</button>
        <button className="danger-button" disabled={!selectedCount || busy} onClick={onDelete}>🗑 Delete</button>
      </div>
    </div>
  )
}
