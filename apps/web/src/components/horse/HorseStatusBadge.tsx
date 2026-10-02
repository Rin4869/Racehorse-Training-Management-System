import type { HealthStatus, HorseStatus } from '../../lib/types';

interface HorseStatusBadgeProps {
  status?: HorseStatus;
  healthStatus?: HealthStatus;
  locked?: boolean;
}

export function HorseStatusBadge({ status, healthStatus, locked }: HorseStatusBadgeProps) {
  return (
    <div className="row" style={{ gap: '4px' }}>
      {status === 'ACTIVE' && (
        <span className="badge badge-info">● Hoạt động</span>
      )}
      {status === 'RESTING' && (
        <span className="badge badge-neutral">● Nghỉ dưỡng</span>
      )}
      {status === 'RETIRED' && (
        <span className="badge badge-neutral">● Giải nghệ</span>
      )}

      {healthStatus === 'FIT' && (
        <span className="badge badge-success">Khỏe mạnh</span>
      )}
      {healthStatus === 'MONITORING' && (
        <span className="badge badge-warning">Cần theo dõi</span>
      )}
      {healthStatus === 'QUARANTINED' && (
        <span className="badge badge-warning">Cách ly</span>
      )}
      {healthStatus === 'INJURED' && (
        <span className="badge badge-danger">Chấn thương</span>
      )}

      {locked && (
        <span className="badge badge-danger">🔒 Khóa tập</span>
      )}
    </div>
  );
}
