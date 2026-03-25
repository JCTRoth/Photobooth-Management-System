import { Link } from 'react-router-dom';
import { MarriageLoginPanel } from '@/components/MarriageLoginPanel';

export function MarriageLogin() {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <Link to="/" className="auth-back-link">
          Back to home
        </Link>
        <h1 className="auth-title">Wedding Photos</h1>
        <MarriageLoginPanel />
      </div>
    </div>
  );
}
