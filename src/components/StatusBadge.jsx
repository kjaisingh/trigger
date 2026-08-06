const LABELS = {
  active: 'Active',
  fired: 'Fired',
  paused: 'Paused',
  unsupported: 'Unsupported',
  error: 'Error',
};

export default function StatusBadge({ status }) {
  return <span className={`badge badge-${status}`}>{LABELS[status] || status}</span>;
}
